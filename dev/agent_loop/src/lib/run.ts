import { spawnSync } from "node:child_process";
import path from "node:path";

import { appendCheckpoint, captureSnapshot, itemExists, loadNextAction } from "../adapters/flow_runner.ts";
import { runnerConfigStatus } from "./config.ts";
import {
  acquireRunLock,
  autoArchiveOwnedItem,
  recordRun,
  releaseRunLock,
  resultPathForSession,
  sessionPrompt,
  snapshotLabel,
  writeSessionArtifacts,
  writeSessionMeta,
  writeSessionOutput,
  loadRunnerResult,
  allocateSession,
} from "./core.ts";
import { ensureDir, repoRelative } from "./io.ts";
import type {
  AgentLoopRunPayload,
  FlowNextPayload,
  RunStopReason,
  RunnerConfig,
  RunnerResult,
} from "./model.ts";
import { RUNNER_RESULT_SCHEMA } from "./model.ts";
import { AgentLoopPaths } from "./paths.ts";

type LaunchOutcome = Readonly<{
  stop_reason: RunStopReason | "";
  checkpoint_observed: boolean;
  runner_session_id: string;
  flow_next: FlowNextPayload;
  operator_message: string;
  next_safe_action: string;
  can_resume: boolean;
  run_status: AgentLoopRunPayload["run_status"];
}>;

function expandTemplate(value: string, replacements: Record<string, string>): string {
  let rendered = value;
  for (const [key, replacement] of Object.entries(replacements)) {
    rendered = rendered.split(`{${key}}`).join(replacement);
  }
  return rendered;
}

function runRefreshCommands(root: string, config: RunnerConfig): void {
  for (const argv of config.refresh_commands) {
    const command = argv.map((part) => expandTemplate(part, { repo_root: root }));
    const result = spawnSync(command[0]!, command.slice(1), {
      cwd: root,
      encoding: "utf8",
    });
    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || "refresh command failed").trim());
    }
  }
}

function validateRunnerResult(result: RunnerResult | null, sessionId: string): string {
  if (!result) {
    return "runner_output_missing";
  }
  if (result.schema !== RUNNER_RESULT_SCHEMA) {
    return "runner_output_invalid";
  }
  if (result.session_id !== sessionId) {
    return "runner_output_invalid";
  }
  return "";
}

function fallbackCheckpoint(root: string, flowNext: FlowNextPayload, stopReason: RunStopReason): void {
  if (!flowNext.item_id || !flowNext.current_stage) {
    return;
  }
  if (!flowNext.session_contract.checkpoint_before_stop) {
    return;
  }
  appendCheckpoint(
    root,
    flowNext.item_id,
    flowNext.current_stage,
    "blocked",
    `stabilize agent-loop after ${stopReason}`,
    "observed runner failure",
    `agent-loop stopped because ${stopReason}`,
    "repair runner state and resume the bounded session",
    "unknown",
  );
}

function checkpointObserved(before: FlowNextPayload, after: FlowNextPayload): boolean {
  if (!before.item_id || !after.item_id || before.item_id !== after.item_id) {
    return false;
  }
  const beforeSession = before.session_number ?? 0;
  const afterSession = after.session_number ?? 0;
  return afterSession > beforeSession;
}

function stopForFlowState(flowNext: FlowNextPayload): Omit<LaunchOutcome, "runner_session_id" | "checkpoint_observed"> {
  if (flowNext.recommended_action === "clear_blocker") {
    return {
      stop_reason: "blocked_item",
      flow_next: flowNext,
      operator_message: "the selected item is blocked and needs maintainer action",
      next_safe_action: "resolve_blocker",
      can_resume: true,
      run_status: "operator_action_required",
    };
  }
  if (flowNext.recommended_action === "stop" && flowNext.action_reason === "closeout_pending") {
    return {
      stop_reason: "closeout_pending",
      flow_next: flowNext,
      operator_message: "the selected item is waiting for upstream closeout or manual review",
      next_safe_action: "close_item_upstream",
      can_resume: true,
      run_status: "operator_action_required",
    };
  }
  return {
    stop_reason: "no_actionable_item",
    flow_next: flowNext,
    operator_message: "no actionable item is available",
    next_safe_action: "idle",
    can_resume: false,
    run_status: "terminal",
  };
}

function launchRunnerSession(root: string, config: RunnerConfig, flowNext: FlowNextPayload): LaunchOutcome {
  if (!flowNext.item_id) {
    throw new Error("flow-runner next payload did not include item_id");
  }
  const { sessionId } = allocateSession(root, config.runner_name, flowNext.item_id);
  writeSessionArtifacts(root, sessionId, config.runner_name, flowNext);
  const paths = new AgentLoopPaths(root);
  const replacements = {
    repo_root: root,
    session_dir: paths.sessionDir(sessionId),
    session_brief: paths.sessionBrief(sessionId),
    prompt_file: paths.promptFile(sessionId),
    runner_result: paths.runnerResultFile(sessionId),
  };
  const argv = config.argv.map((part) => expandTemplate(part, replacements));
  const env = Object.fromEntries(
    Object.entries(config.env).map(([key, value]) => [key, expandTemplate(value, replacements)]),
  );

  if (flowNext.session_contract.snapshot_before_session && flowNext.item_id && flowNext.session_number) {
    captureSnapshot(root, flowNext.item_id, snapshotLabel(flowNext.item_id, flowNext.session_number));
  }

  const prompt = sessionPrompt(root, sessionId);
  const result = spawnSync(argv[0]!, argv.slice(1), {
    cwd: root,
    encoding: "utf8",
    input: prompt,
    timeout: config.timeout_seconds * 1000,
    env: {
      ...process.env,
      ...env,
    },
  });
  writeSessionOutput(root, sessionId, result.stdout ?? "", result.stderr ?? "");
  writeSessionMeta(root, sessionId, result.status ?? null, result.signal ?? null);

  let stopReason: RunStopReason | "" = "";
  if (result.error) {
    stopReason = (result.error as NodeJS.ErrnoException).code === "ETIMEDOUT" ? "runner_timeout" : "runner_launch_failed";
  } else if (result.signal === "SIGINT" || result.signal === "SIGTERM") {
    stopReason = "operator_cancelled";
  } else if ((result.status ?? 0) !== 0) {
    stopReason = "runner_exited_nonzero";
  }

  const refreshed = loadNextAction(root, flowNext.item_id);
  const observed = checkpointObserved(flowNext, refreshed);
  const runnerResult = loadRunnerResult(root, sessionId);
  const outputStop = validateRunnerResult(runnerResult, sessionId) as RunStopReason | "";
  if (!stopReason && outputStop) {
    stopReason = outputStop;
  }
  if (!stopReason && runnerResult && !runnerResult.checkpoint_written && !observed) {
    stopReason = "checkpoint_missing";
  }
  if (stopReason && !observed) {
    fallbackCheckpoint(root, refreshed, stopReason);
  }

  if (stopReason) {
    const fresh = loadNextAction(root, flowNext.item_id);
    return {
      stop_reason: stopReason,
      checkpoint_observed: observed || ((fresh.session_number ?? 0) > (flowNext.session_number ?? 0)),
      runner_session_id: sessionId,
      flow_next: fresh,
      operator_message: `runner session stopped because ${stopReason.replaceAll("_", " ")}`,
      next_safe_action: stopReason === "checkpoint_missing" ? "repair_runner_result" : "inspect_runner_session",
      can_resume: stopReason !== "operator_cancelled",
      run_status: "operator_action_required",
    };
  }

  const finalNext = loadNextAction(root, flowNext.item_id);
  return {
    stop_reason: "",
    checkpoint_observed: observed,
    runner_session_id: sessionId,
    flow_next: finalNext,
    operator_message: "",
    next_safe_action: "continue",
    can_resume: true,
    run_status: "terminal",
  };
}

export function runAgentLoop(root: string, itemId: string | undefined, maxSessions: number): AgentLoopRunPayload {
  const paths = new AgentLoopPaths(root);
  ensureDir(paths.loopDir);
  ensureDir(paths.sessionsDir);
  ensureDir(paths.runsDir);

  const configStatus = runnerConfigStatus(paths);
  const runnerName = configStatus.config?.runner_name ?? "unset";
  const lockPath = acquireRunLock(root, runnerName);
  let sessionsLaunched = 0;
  let currentItem = itemId;
  try {
    if (configStatus.status === "missing") {
      const flowNext = loadNextAction(root, currentItem);
      return recordRun(root, flowNext.item_id || "none", sessionsLaunched, maxSessions, {
        run_status: "operator_action_required",
        stop_reason: "runner_config_required",
        operator_message: configStatus.message,
        next_safe_action: "configure_runner",
        can_resume: true,
        checkpoint_observed: false,
        runner_session_id: "",
        flow_next: flowNext,
      });
    }
    if (configStatus.status === "invalid" || !configStatus.config) {
      const flowNext = loadNextAction(root, currentItem);
      return recordRun(root, flowNext.item_id || "none", sessionsLaunched, maxSessions, {
        run_status: "operator_action_required",
        stop_reason: "runner_config_invalid",
        operator_message: configStatus.message,
        next_safe_action: "repair_runner_config",
        can_resume: true,
        checkpoint_observed: false,
        runner_session_id: "",
        flow_next: flowNext,
      });
    }

    while (true) {
      try {
        runRefreshCommands(root, configStatus.config);
      } catch (error) {
        const flowNext = loadNextAction(root, currentItem);
        return recordRun(root, flowNext.item_id || "none", sessionsLaunched, maxSessions, {
          run_status: "operator_action_required",
          stop_reason: "runner_config_invalid",
          operator_message: error instanceof Error ? error.message : String(error),
          next_safe_action: "repair_runner_config",
          can_resume: true,
          checkpoint_observed: false,
          runner_session_id: "",
          flow_next: flowNext,
        });
      }
      let flowNext = loadNextAction(root, currentItem);

      if (flowNext.recommended_action === "archive_closeout" && flowNext.item_id) {
        autoArchiveOwnedItem(root, flowNext.item_id);
        if (currentItem && currentItem === flowNext.item_id) {
          const terminalNext = loadNextAction(root);
          return recordRun(root, flowNext.item_id, sessionsLaunched, maxSessions, {
            run_status: "terminal",
            stop_reason: "item_archived",
            operator_message: "the selected runner-owned item was archived",
            next_safe_action: terminalNext.action_reason === "no_actionable_item" ? "idle" : "run",
            can_resume: false,
            checkpoint_observed: true,
            runner_session_id: "",
            flow_next: terminalNext,
          });
        }
        continue;
      }

      if (flowNext.recommended_action !== "run_session") {
        const stop = stopForFlowState(flowNext);
        return recordRun(root, flowNext.item_id || "none", sessionsLaunched, maxSessions, {
          ...stop,
          checkpoint_observed: false,
          runner_session_id: "",
        });
      }

      if (sessionsLaunched >= maxSessions) {
        return recordRun(root, flowNext.item_id || "none", sessionsLaunched, maxSessions, {
          run_status: "operator_action_required",
          stop_reason: "session_budget_exhausted",
          operator_message: "the session budget was exhausted before the loop reached a stop state",
          next_safe_action: "resume_run",
          can_resume: true,
          checkpoint_observed: false,
          runner_session_id: "",
          flow_next: flowNext,
        });
      }

      const launch = launchRunnerSession(root, configStatus.config, flowNext);
      sessionsLaunched += 1;

      if (launch.stop_reason) {
        return recordRun(root, flowNext.item_id || "none", sessionsLaunched, maxSessions, {
          run_status: launch.run_status,
          stop_reason: launch.stop_reason,
          operator_message: launch.operator_message,
          next_safe_action: launch.next_safe_action,
          can_resume: launch.can_resume,
          checkpoint_observed: launch.checkpoint_observed,
          runner_session_id: launch.runner_session_id,
          flow_next: launch.flow_next,
        });
      }

      if (!launch.checkpoint_observed) {
        return recordRun(root, flowNext.item_id || "none", sessionsLaunched, maxSessions, {
          run_status: "operator_action_required",
          stop_reason: "checkpoint_missing",
          operator_message: `runner session exited without writing a checkpoint; inspect ${resultPathForSession(root, launch.runner_session_id)}`,
          next_safe_action: "inspect_runner_session",
          can_resume: true,
          checkpoint_observed: false,
          runner_session_id: launch.runner_session_id,
          flow_next: launch.flow_next,
        });
      }

      if (launch.flow_next.recommended_action === "archive_closeout" && launch.flow_next.item_id) {
        autoArchiveOwnedItem(root, launch.flow_next.item_id);
        if (currentItem && currentItem === launch.flow_next.item_id) {
          const terminalNext = loadNextAction(root);
          return recordRun(root, launch.flow_next.item_id, sessionsLaunched, maxSessions, {
            run_status: "terminal",
            stop_reason: "item_archived",
            operator_message: "the selected runner-owned item was archived",
            next_safe_action: terminalNext.action_reason === "no_actionable_item" ? "idle" : "run",
            can_resume: false,
            checkpoint_observed: true,
            runner_session_id: launch.runner_session_id,
            flow_next: terminalNext,
          });
        }
        continue;
      }

      if (launch.flow_next.recommended_action !== "run_session") {
        const stop = stopForFlowState(launch.flow_next);
        return recordRun(root, launch.flow_next.item_id || flowNext.item_id || "none", sessionsLaunched, maxSessions, {
          ...stop,
          checkpoint_observed: launch.checkpoint_observed,
          runner_session_id: launch.runner_session_id,
        });
      }

      if (currentItem && !itemExists(root, currentItem)) {
        const terminalNext = loadNextAction(root);
        return recordRun(root, currentItem, sessionsLaunched, maxSessions, {
          run_status: "terminal",
          stop_reason: "item_archived",
          operator_message: "the pinned item is no longer active",
          next_safe_action: terminalNext.action_reason === "no_actionable_item" ? "idle" : "run",
          can_resume: false,
          checkpoint_observed: true,
          runner_session_id: launch.runner_session_id,
          flow_next: terminalNext,
        });
      }
    }
  } finally {
    releaseRunLock(lockPath);
  }
}
