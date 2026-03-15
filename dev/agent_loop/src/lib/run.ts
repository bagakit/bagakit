import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { captureSnapshot, itemExists } from "../adapters/flow_runner.ts";
import { launchStdinRunnerSession } from "../../../agent_runner/src/lib/session.ts";
import { canonicalFlowStop, decideContinuationAfterSessionStop } from "./continuation.ts";
import { runnerConfigStatus } from "./config.ts";
import { describeRunnerLaunchError } from "./launch_error.ts";
import {
  acquireRunLock,
  autoArchiveOwnedItem,
  runnerResultIssue,
  recordRun,
  releaseRunLock,
  resultPathForSession,
  snapshotLabel,
  writeSessionArtifacts,
  loadRunnerResult,
  allocateSession,
} from "./core.ts";
import { resolveResumeTarget, safeLoadNextAction } from "./front_door.ts";
import { ensureDir, readJsonFile, repoRelative } from "./io.ts";
import type {
  AgentLoopRunPayload,
  AgentLoopSessionRunPayload,
  FlowNextPayload,
  RecoverySessionContext,
  RunStopReason,
  RunRecord,
  RunnerConfig,
  RunnerResult,
} from "./model.ts";
import { AgentLoopPaths } from "./paths.ts";
import { shouldUseHostTimeout } from "./runner_truth.ts";

type LaunchStop = Readonly<{
  stop_reason: RunStopReason;
  flow_next: FlowNextPayload;
  operator_message: string;
  next_safe_action: string;
  can_resume: boolean;
  run_status: AgentLoopRunPayload["run_status"];
}>;

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

function recordSessionRun(
  root: string,
  itemId: string,
  sessionsLaunched: number,
  stop: {
    run_status: AgentLoopRunPayload["run_status"];
    stop_reason: RunStopReason;
    operator_message: string;
    next_safe_action: string;
    checkpoint_observed: boolean;
    runner_session_id: string;
    flow_next: FlowNextPayload;
  },
): AgentLoopSessionRunPayload {
  const record = recordRun(root, itemId, sessionsLaunched, 1, {
    ...stop,
    can_resume: stop.run_status !== "terminal" || stop.stop_reason === "session_completed",
  });
  return {
    schema: "bagakit/agent-loop/session-run/v1",
    command: "session-run",
    session_status: stop.run_status === "terminal" ? "completed" : "operator_action_required",
    stop_reason: stop.stop_reason,
    operator_message: stop.operator_message,
    next_safe_action: stop.next_safe_action,
    item_id: itemId,
    runner_session_id: stop.runner_session_id,
    checkpoint_observed: stop.checkpoint_observed,
    flow_next: stop.flow_next,
    run_record_path: record.run_record_path,
    host_notification_request: record.host_notification_request,
  };
}

function runRefreshCommands(root: string, config: RunnerConfig): void {
  for (const argv of config.refresh_commands) {
    const command = argv.map((part) => part.split("{repo_root}").join(root));
    const result = spawnSync(command[0]!, command.slice(1), {
      cwd: root,
      encoding: "utf8",
    });
    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || "refresh command failed").trim());
    }
  }
}

function validateRunnerResult(result: RunnerResult | null, sessionId: string): {
  stopReason: RunStopReason | "";
  message: string;
} {
  const issue = runnerResultIssue(result, sessionId);
  if (issue) {
    return {
      stopReason: result === null ? "runner_output_missing" : "runner_output_invalid",
      message: issue,
    };
  }
  if (!result) {
    throw new Error("runner-result validation expected a value");
  }
  if (result.status === "operator_cancelled") {
    return {
      stopReason: "operator_cancelled",
      message: "runner reported operator_cancelled",
    };
  }
  return {
    stopReason: "",
    message: "",
  };
}

function checkpointObserved(before: FlowNextPayload, after: FlowNextPayload): boolean {
  if (!before.item_id || !after.item_id || before.item_id !== after.item_id) {
    return false;
  }
  const beforeSession = before.session_number ?? 0;
  const afterSession = after.session_number ?? 0;
  return afterSession > beforeSession;
}

function hostPathsForSession(root: string, sessionId: string) {
  const paths = new AgentLoopPaths(root);
  return {
    session_dir: repoRelative(root, paths.sessionDir(sessionId)),
    session_brief: repoRelative(root, paths.sessionBrief(sessionId)),
    prompt_file: repoRelative(root, paths.promptFile(sessionId)),
    stdout_file: repoRelative(root, paths.stdoutFile(sessionId)),
    stderr_file: repoRelative(root, paths.stderrFile(sessionId)),
    session_meta_file: repoRelative(root, path.join(paths.sessionDir(sessionId), "session-meta.json")),
    runner_result_file: repoRelative(root, paths.runnerResultFile(sessionId)),
  };
}

function latestRecoveryRequest(root: string, itemId: string): RecoverySessionContext | undefined {
  const paths = new AgentLoopPaths(root);
  if (!itemId || !fs.existsSync(paths.runsDir)) {
    return undefined;
  }
  const entries = fs.readdirSync(paths.runsDir) as string[];
  for (const entry of entries.filter((name) => name.endsWith(".json")).sort().reverse()) {
    try {
      const record = readJsonFile<RunRecord>(path.join(paths.runsDir, entry));
      if (record.item_id === itemId && record.run_status === "operator_action_required" && record.recovery_request) {
        return record.recovery_request;
      }
    } catch {
      continue;
    }
  }
  return undefined;
}

function stopForFlowState(flowNext: FlowNextPayload): LaunchStop {
  return canonicalFlowStop(flowNext);
}

function launchRunnerSession(
  root: string,
  config: RunnerConfig,
  flowNext: FlowNextPayload,
  recovery?: RecoverySessionContext,
): LaunchOutcome {
  if (!flowNext.item_id) {
    throw new Error("flow-runner next payload did not include item_id");
  }
  const { sessionId } = allocateSession(root, config.runner_name, flowNext.item_id);
  const prompt = writeSessionArtifacts(root, sessionId, config.runner_name, flowNext, recovery);
  const paths = new AgentLoopPaths(root);
  const templateContext = {
    repo_root: root,
    session_dir: paths.sessionDir(sessionId),
    session_brief: paths.sessionBrief(sessionId),
    prompt_file: paths.promptFile(sessionId),
    runner_result: paths.runnerResultFile(sessionId),
  };
  const startedAt = new Date().toISOString();

  if (flowNext.session_contract.snapshot_before_session && flowNext.item_id && flowNext.session_number) {
    captureSnapshot(root, flowNext.item_id, snapshotLabel(flowNext.item_id, flowNext.session_number));
  }

  const result = launchStdinRunnerSession({
    cwd: root,
    session_id: sessionId,
    workload_id: flowNext.item_id,
    started_at: startedAt,
    prompt_text: prompt,
    template_context: templateContext,
    config: {
      ...config,
      timeout_seconds: shouldUseHostTimeout(config) ? config.timeout_seconds : 0,
    },
    paths: {
      session_dir: paths.sessionDir(sessionId),
      prompt_file: paths.promptFile(sessionId),
      stdout_file: paths.stdoutFile(sessionId),
      stderr_file: paths.stderrFile(sessionId),
      session_meta_file: path.join(paths.sessionDir(sessionId), "session-meta.json"),
    },
  });

  let stopReason: RunStopReason | "" = "";
  let launchMessage = "";
  if (result.launch_error) {
    stopReason = result.launch_error === "ETIMEDOUT" ? "runner_timeout" : "runner_launch_failed";
    launchMessage = describeRunnerLaunchError(result.launch_error, sessionId);
  } else if (result.signal === "SIGINT" || result.signal === "SIGTERM") {
    stopReason = "operator_cancelled";
  } else if ((result.exit_code ?? 0) !== 0) {
    stopReason = "runner_exited_nonzero";
  }

  const refreshedAttempt = safeLoadNextAction(root, flowNext.item_id, flowNext);
  if (refreshedAttempt.error) {
    return {
      stop_reason: "flow_runner_refresh_failed",
      checkpoint_observed: false,
      runner_session_id: sessionId,
      flow_next: refreshedAttempt.payload,
      operator_message: refreshedAttempt.error,
      next_safe_action: "inspect_flow_runner_state",
      can_resume: true,
      run_status: "operator_action_required",
    };
  }
  const refreshed = refreshedAttempt.payload;
  const observed = checkpointObserved(flowNext, refreshed);
  let runnerResult: RunnerResult | null = null;
  let outputStop: RunStopReason | "" = "";
  let outputMessage = "";
  try {
    runnerResult = loadRunnerResult(root, sessionId);
    const validation = validateRunnerResult(runnerResult, sessionId);
    outputStop = validation.stopReason;
    outputMessage = validation.message;
  } catch (error) {
    outputStop = "runner_output_invalid";
    outputMessage = error instanceof Error ? error.message : String(error);
  }
  if (stopReason === "runner_launch_failed" && result.launch_error === "ENOBUFS" && (runnerResult || observed)) {
    stopReason = "";
    launchMessage = "";
  }
  if (!stopReason && outputStop) {
    stopReason = outputStop;
  }
  if (!stopReason && runnerResult && !runnerResult.checkpoint_written && !observed) {
    stopReason = "checkpoint_missing";
  }

  if (stopReason) {
    const freshAttempt = safeLoadNextAction(root, flowNext.item_id, refreshed);
    const fresh = freshAttempt.payload;
    return {
      stop_reason: stopReason,
      checkpoint_observed: observed || ((fresh.session_number ?? 0) > (flowNext.session_number ?? 0)),
      runner_session_id: sessionId,
      flow_next: fresh,
      operator_message: launchMessage || outputMessage || `runner session stopped because ${stopReason.replaceAll("_", " ")}`,
      next_safe_action: stopReason === "checkpoint_missing" ? "repair_runner_result" : "inspect_runner_session",
      can_resume: stopReason !== "operator_cancelled",
      run_status: "operator_action_required",
    };
  }

  const finalNextAttempt = safeLoadNextAction(root, flowNext.item_id, refreshed);
  if (finalNextAttempt.error) {
    return {
      stop_reason: "flow_runner_refresh_failed",
      checkpoint_observed: observed,
      runner_session_id: sessionId,
      flow_next: finalNextAttempt.payload,
      operator_message: finalNextAttempt.error,
      next_safe_action: "inspect_flow_runner_state",
      can_resume: true,
      run_status: "operator_action_required",
    };
  }
  const finalNext = finalNextAttempt.payload;
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

export function runAgentLoop(
  root: string,
  itemId: string | undefined,
  maxSessions: number,
  options: { resume_mode?: boolean } = {},
): AgentLoopRunPayload {
  const paths = new AgentLoopPaths(root);
  ensureDir(paths.loopDir);
  ensureDir(paths.sessionsDir);
  ensureDir(paths.runsDir);

  let currentItem = itemId;
  let sessionsLaunched = 0;
  let pendingRecovery: RecoverySessionContext | undefined;
  if (options.resume_mode) {
    const resolvedTarget = resolveResumeTarget(root, itemId);
    currentItem = resolvedTarget.itemId;
    if (resolvedTarget.stop) {
      const attempt = safeLoadNextAction(root, currentItem);
      return recordRun(root, currentItem || "none", sessionsLaunched, maxSessions, {
        run_status: "operator_action_required",
        stop_reason: resolvedTarget.stop.stop_reason,
        operator_message: resolvedTarget.stop.operator_message,
        next_safe_action: resolvedTarget.stop.next_safe_action,
        can_resume: resolvedTarget.stop.can_resume,
        checkpoint_observed: false,
        runner_session_id: "",
        flow_next: attempt.payload,
        resume_candidates: resolvedTarget.stop.resume_candidates,
      });
    }
  }

  const configStatus = runnerConfigStatus(paths);
  const runnerName = configStatus.config?.runner_name ?? "unset";
  const lockAttempt = (() => {
    try {
      return {
        lockPath: acquireRunLock(root, runnerName),
        error: "",
      };
    } catch (error) {
      return {
        lockPath: "",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  })();
  if (lockAttempt.error) {
    const attempt = safeLoadNextAction(root, currentItem);
    return recordRun(root, attempt.payload.item_id || currentItem || "none", sessionsLaunched, maxSessions, {
      run_status: "operator_action_required",
      stop_reason: "run_lock_conflict",
      operator_message: lockAttempt.error,
      next_safe_action: "inspect_run_lock",
      can_resume: true,
      checkpoint_observed: false,
      runner_session_id: "",
      flow_next: attempt.payload,
    });
  }
  const lockPath = lockAttempt.lockPath;
  try {
    if (configStatus.status === "missing") {
      const flowNext = safeLoadNextAction(root, currentItem).payload;
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
      const flowNext = safeLoadNextAction(root, currentItem).payload;
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
        const attempt = safeLoadNextAction(root, currentItem);
        const flowNext = attempt.payload;
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
      const nextAttempt = safeLoadNextAction(root, currentItem);
      if (nextAttempt.error) {
        return recordRun(root, currentItem || "none", sessionsLaunched, maxSessions, {
          run_status: "operator_action_required",
          stop_reason: "flow_runner_refresh_failed",
          operator_message: nextAttempt.error,
          next_safe_action: "inspect_flow_runner_state",
          can_resume: true,
          checkpoint_observed: false,
          runner_session_id: "",
          flow_next: nextAttempt.payload,
        });
      }
      let flowNext = nextAttempt.payload;
      if (pendingRecovery && flowNext.item_id !== pendingRecovery.previous_item_id) {
        pendingRecovery = undefined;
      }
      if (!pendingRecovery && flowNext.item_id) {
        pendingRecovery = latestRecoveryRequest(root, flowNext.item_id);
      }

      if (flowNext.recommended_action === "archive_closeout" && flowNext.item_id) {
        autoArchiveOwnedItem(root, flowNext.item_id);
        if (currentItem && currentItem === flowNext.item_id) {
          const terminalNext = safeLoadNextAction(root).payload;
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
          stop_reason: pendingRecovery ? pendingRecovery.previous_stop_reason : "session_budget_exhausted",
          operator_message: pendingRecovery
            ? `the session budget was exhausted before one bounded recovery session could run after ${pendingRecovery.previous_stop_reason}`
            : "the session budget was exhausted before the loop reached a stop state",
          next_safe_action: pendingRecovery ? pendingRecovery.previous_next_safe_action : "resume_run",
          can_resume: true,
          checkpoint_observed: false,
          runner_session_id: pendingRecovery?.previous_session_id || "",
          flow_next: flowNext,
          recovery_request: pendingRecovery || undefined,
        });
      }

      const currentRecovery = pendingRecovery;
      const launch = launchRunnerSession(root, configStatus.config, flowNext, currentRecovery);
      pendingRecovery = undefined;
      sessionsLaunched += 1;

      if (launch.stop_reason) {
        if (currentRecovery) {
          return recordRun(root, flowNext.item_id || "none", sessionsLaunched, maxSessions, {
            run_status: launch.run_status,
            stop_reason: launch.stop_reason,
            operator_message: `one bounded recovery session already ran and stopped again: ${launch.operator_message}`,
            next_safe_action: launch.next_safe_action,
            can_resume: launch.can_resume,
            checkpoint_observed: launch.checkpoint_observed,
            runner_session_id: launch.runner_session_id,
            flow_next: launch.flow_next,
            recovery_request: currentRecovery,
          });
        }
        const continuation = decideContinuationAfterSessionStop(
          {
            run_status: launch.run_status,
            stop_reason: launch.stop_reason,
            operator_message: launch.operator_message,
            next_safe_action: launch.next_safe_action,
            can_resume: launch.can_resume,
            checkpoint_observed: launch.checkpoint_observed,
            runner_session_id: launch.runner_session_id,
            flow_next: launch.flow_next,
          },
          hostPathsForSession(root, launch.runner_session_id),
        );
        if (continuation.kind === "recover") {
          pendingRecovery = continuation.recovery;
          continue;
        }
        if (continuation.stop.flow_next.recommended_action === "archive_closeout" && continuation.stop.flow_next.item_id) {
          autoArchiveOwnedItem(root, continuation.stop.flow_next.item_id);
          if (currentItem && currentItem === continuation.stop.flow_next.item_id) {
            const terminalNext = safeLoadNextAction(root).payload;
            return recordRun(root, continuation.stop.flow_next.item_id, sessionsLaunched, maxSessions, {
              run_status: "terminal",
              stop_reason: "item_archived",
              operator_message: "the selected runner-owned item was archived",
              next_safe_action: terminalNext.action_reason === "no_actionable_item" ? "idle" : "run",
              can_resume: false,
              checkpoint_observed: launch.checkpoint_observed,
              runner_session_id: launch.runner_session_id,
              flow_next: terminalNext,
            });
          }
        }
        return recordRun(root, flowNext.item_id || "none", sessionsLaunched, maxSessions, {
          run_status: continuation.stop.run_status,
          stop_reason: continuation.stop.stop_reason,
          operator_message: continuation.stop.operator_message,
          next_safe_action: continuation.stop.next_safe_action,
          can_resume: continuation.stop.can_resume,
          checkpoint_observed: launch.checkpoint_observed,
          runner_session_id: launch.runner_session_id,
          flow_next: continuation.stop.flow_next,
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
          const terminalNext = safeLoadNextAction(root).payload;
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
          run_status: stop.run_status,
          stop_reason: stop.stop_reason,
          operator_message: stop.operator_message,
          next_safe_action: stop.next_safe_action,
          can_resume: stop.can_resume,
          checkpoint_observed: launch.checkpoint_observed,
          runner_session_id: launch.runner_session_id,
          flow_next: stop.flow_next,
        });
      }

      if (currentItem && !itemExists(root, currentItem)) {
        const terminalNext = safeLoadNextAction(root).payload;
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

export function runSingleSession(root: string, itemId: string): AgentLoopSessionRunPayload {
  const paths = new AgentLoopPaths(root);
  ensureDir(paths.loopDir);
  ensureDir(paths.sessionsDir);
  ensureDir(paths.runsDir);

  const configStatus = runnerConfigStatus(paths);
  if (configStatus.status === "missing" || configStatus.status === "invalid" || !configStatus.config) {
    const nextAttempt = safeLoadNextAction(root, itemId);
    return recordSessionRun(root, itemId, 0, {
      run_status: "operator_action_required",
      stop_reason: configStatus.status === "missing" ? "runner_config_required" : "runner_config_invalid",
      operator_message: configStatus.message,
      next_safe_action: configStatus.status === "missing" ? "configure_runner" : "repair_runner_config",
      runner_session_id: "",
      checkpoint_observed: false,
      flow_next: nextAttempt.payload,
    });
  }

  const lockAttempt = (() => {
    try {
      return {
        lockPath: acquireRunLock(root, configStatus.config.runner_name),
        error: "",
      };
    } catch (error) {
      return {
        lockPath: "",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  })();
  if (lockAttempt.error) {
    const nextAttempt = safeLoadNextAction(root, itemId);
    return recordSessionRun(root, itemId, 0, {
      run_status: "operator_action_required",
      stop_reason: "run_lock_conflict",
      operator_message: lockAttempt.error,
      next_safe_action: "inspect_run_lock",
      runner_session_id: "",
      checkpoint_observed: false,
      flow_next: nextAttempt.payload,
    });
  }
  const lockPath = lockAttempt.lockPath;
  try {
    try {
      runRefreshCommands(root, configStatus.config);
    } catch (error) {
      const nextAttempt = safeLoadNextAction(root, itemId);
      return recordSessionRun(root, itemId, 0, {
        run_status: "operator_action_required",
        stop_reason: "runner_config_invalid",
        operator_message: error instanceof Error ? error.message : String(error),
        next_safe_action: "repair_runner_config",
        runner_session_id: "",
        checkpoint_observed: false,
        flow_next: nextAttempt.payload,
      });
    }
    const nextAttempt = safeLoadNextAction(root, itemId);
    if (nextAttempt.error) {
      return recordSessionRun(root, itemId, 0, {
        run_status: "operator_action_required",
        stop_reason: "flow_runner_refresh_failed",
        operator_message: nextAttempt.error,
        next_safe_action: "inspect_flow_runner_state",
        runner_session_id: "",
        checkpoint_observed: false,
        flow_next: nextAttempt.payload,
      });
    }
    const flowNext = nextAttempt.payload;
    if (flowNext.recommended_action !== "run_session") {
      const stop = stopForFlowState(flowNext);
      return recordSessionRun(root, flowNext.item_id || itemId, 0, {
        run_status: stop.run_status,
        stop_reason: stop.stop_reason,
        operator_message: stop.operator_message,
        next_safe_action: stop.next_safe_action,
        runner_session_id: "",
        checkpoint_observed: false,
        flow_next: flowNext,
      });
    }
    const launched = launchRunnerSession(root, configStatus.config, flowNext);
    return recordSessionRun(root, flowNext.item_id || itemId, 1, {
      run_status: launched.stop_reason ? launched.run_status : "terminal",
      stop_reason: launched.stop_reason || "session_completed",
      operator_message: launched.operator_message,
      next_safe_action: launched.next_safe_action,
      runner_session_id: launched.runner_session_id,
      checkpoint_observed: launched.checkpoint_observed,
      flow_next: launched.flow_next,
    });
  } finally {
    releaseRunLock(lockPath);
  }
}
