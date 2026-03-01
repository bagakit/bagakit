import fs from "node:fs";
import path from "node:path";

import {
  archiveItem,
  flowRunnerCommand,
  loadNextAction,
  readItemState,
  validateFlowRunner,
} from "../adapters/flow_runner.ts";
import {
  initializeRunnerConfig,
  runnerConfigStatus,
  writeRunnerConfig,
} from "./config.ts";
import {
  ensureDir,
  isPidLive,
  loadJsonIfExists,
  readJsonFile,
  repoRelative,
  sanitizeSegment,
  uniqueStampedId,
  utcNow,
  writeJsonFile,
  writeText,
} from "./io.ts";
import type {
  AgentLoopNextPayload,
  AgentLoopRunPayload,
  AgentLoopWatchPayload,
  FlowNextPayload,
  RunLockPayload,
  RunRecord,
  RunnerConfig,
  RunnerConfigStatus,
  RunnerResult,
} from "./model.ts";
import { RUN_LOCK_SCHEMA, RUN_RECORD_SCHEMA, RUNNER_RESULT_SCHEMA, WATCH_SCHEMA } from "./model.ts";
import { AgentLoopPaths } from "./paths.ts";
import { buildSessionBrief, renderPrompt } from "./prompt.ts";

type StopEnvelope = Readonly<{
  run_status: AgentLoopRunPayload["run_status"];
  stop_reason: AgentLoopRunPayload["stop_reason"];
  operator_message: string;
  next_safe_action: string;
  can_resume: boolean;
  checkpoint_observed: boolean;
  runner_session_id: string;
  flow_next: FlowNextPayload;
}>;

export function applyAgentLoop(root: string, toolDir: string): string {
  const paths = new AgentLoopPaths(root);
  ensureDir(paths.loopDir);
  ensureDir(paths.sessionsDir);
  ensureDir(paths.runsDir);
  initializeRunnerConfig(paths, toolDir);
  return repoRelative(root, paths.loopDir);
}

export function configureRunner(
  root: string,
  runnerName: string,
  argv: string[],
  timeoutSeconds: number,
  refreshCommands: string[][],
): RunnerConfig {
  const paths = new AgentLoopPaths(root);
  ensureDir(paths.loopDir);
  const nextConfig: RunnerConfig = {
    schema: "bagakit/agent-loop/runner-config/v1",
    runner_name: runnerName,
    transport: "stdin_prompt",
    argv,
    env: {},
    timeout_seconds: timeoutSeconds,
    refresh_commands: refreshCommands,
  };
  writeRunnerConfig(paths, nextConfig);
  return nextConfig;
}

function nextSafeActionForState(flowNext: FlowNextPayload, configStatus: RunnerConfigStatus): string {
  if (flowNext.recommended_action === "run_session") {
    if (configStatus.status === "ready") {
      return "run";
    }
    return configStatus.status === "missing" ? "configure_runner" : "repair_runner_config";
  }
  if (flowNext.recommended_action === "clear_blocker") {
    return "resolve_blocker";
  }
  if (flowNext.recommended_action === "archive_closeout") {
    return "archive_owned_item";
  }
  if (flowNext.action_reason === "closeout_pending") {
    return "close_item_upstream";
  }
  return "idle";
}

export function computeNext(root: string, itemId?: string): AgentLoopNextPayload {
  const paths = new AgentLoopPaths(root);
  const configStatus = runnerConfigStatus(paths);
  const flowNext = loadNextAction(root, itemId);
  return {
    schema: "bagakit/agent-loop/next/v1",
    command: "next",
    runner_config_status: configStatus.status,
    runner_ready: configStatus.status === "ready",
    next_safe_action: nextSafeActionForState(flowNext, configStatus),
    flow_next: flowNext,
  };
}

function buildRunRecord(
  runId: string,
  stop: StopEnvelope,
  itemId: string,
  sessionsLaunched: number,
  sessionBudget: number,
): RunRecord {
  return {
    schema: RUN_RECORD_SCHEMA,
    run_id: runId,
    recorded_at: utcNow(),
    run_status: stop.run_status,
    stop_reason: stop.stop_reason,
    item_id: itemId,
    sessions_launched: sessionsLaunched,
    session_budget: sessionBudget,
    checkpoint_observed: stop.checkpoint_observed,
    runner_session_id: stop.runner_session_id,
  };
}

function sortedRunRecords(paths: AgentLoopPaths): RunRecord[] {
  if (!fs.existsSync(paths.runsDir)) {
    return [];
  }
  return fs
    .readdirSync(paths.runsDir)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => readJsonFile<RunRecord>(path.join(paths.runsDir, entry)))
    .sort((left, right) => right.recorded_at.localeCompare(left.recorded_at));
}

type SessionSummary = Readonly<{
  session_id: string;
  item_id: string;
  runner_name: string;
  started_at: string;
  exit_code: number | null;
  result_status: RunnerResult["status"] | "";
  checkpoint_written: boolean | null;
}>;

function sortedSessionSummaries(paths: AgentLoopPaths): SessionSummary[] {
  if (!fs.existsSync(paths.sessionsDir)) {
    return [];
  }
  return fs
    .readdirSync(paths.sessionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const briefPath = path.join(paths.sessionDir(entry.name), "session-brief.json");
      const metadataPath = path.join(paths.sessionDir(entry.name), "session-meta.json");
      const resultPath = path.join(paths.sessionDir(entry.name), "runner-result.json");
      const brief = readJsonFile<{
        session_id: string;
        started_at: string;
        runner_name: string;
        item: { item_id: string };
      }>(briefPath);
      const metadata = loadJsonIfExists<{ exit_code: number | null }>(metadataPath);
      const result = loadJsonIfExists<RunnerResult>(resultPath);
      return {
        session_id: brief.session_id,
        item_id: brief.item.item_id,
        runner_name: brief.runner_name,
        started_at: brief.started_at,
        exit_code: metadata?.exit_code ?? null,
        result_status: result?.status ?? "",
        checkpoint_written: result?.checkpoint_written ?? null,
      };
    })
    .sort((left, right) => right.started_at.localeCompare(left.started_at));
}

export function watchAgentLoop(root: string, itemId?: string): AgentLoopWatchPayload {
  const paths = new AgentLoopPaths(root);
  return {
    schema: WATCH_SCHEMA,
    command: "watch",
    runner_config_status: runnerConfigStatus(paths).status,
    flow_next: loadNextAction(root, itemId),
    recent_runs: sortedRunRecords(paths).slice(0, 5),
    recent_sessions: sortedSessionSummaries(paths).slice(0, 5),
  };
}

export function validateAgentLoop(root: string): string[] {
  const paths = new AgentLoopPaths(root);
  const issues: string[] = [];
  const configStatus = runnerConfigStatus(paths);
  if (configStatus.status === "invalid") {
    issues.push(configStatus.message);
  }
  if (fs.existsSync(paths.runLockFile)) {
    const lock = loadJsonIfExists<RunLockPayload>(paths.runLockFile);
    if (!lock) {
      issues.push("run.lock is not valid JSON");
    } else if (lock.schema !== RUN_LOCK_SCHEMA) {
      issues.push("run.lock schema is invalid");
    } else if (!isPidLive(lock.pid)) {
      issues.push("run.lock is stale");
    }
  }
  for (const session of sortedSessionSummaries(paths)) {
    const sessionDir = paths.sessionDir(session.session_id);
    for (const required of ["session-brief.json", "prompt.txt", "stdout.txt", "stderr.txt", "session-meta.json"]) {
      if (!fs.existsSync(path.join(sessionDir, required))) {
        issues.push(`session ${session.session_id} is missing ${required}`);
      }
    }
    const result = loadJsonIfExists<RunnerResult>(path.join(sessionDir, "runner-result.json"));
    if (result) {
      if (result.schema !== RUNNER_RESULT_SCHEMA) {
        issues.push(`session ${session.session_id} has invalid runner-result schema`);
      }
      if (result.session_id !== session.session_id) {
        issues.push(`session ${session.session_id} runner-result session_id mismatch`);
      }
    }
  }
  for (const record of sortedRunRecords(paths)) {
    if (record.schema !== RUN_RECORD_SCHEMA) {
      issues.push(`run record ${record.run_id} has invalid schema`);
    }
  }
  try {
    validateFlowRunner(root);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }
  return issues;
}

function recoverStaleLock(paths: AgentLoopPaths): boolean {
  const payload = loadJsonIfExists<RunLockPayload>(paths.runLockFile);
  if (!payload || isPidLive(payload.pid)) {
    return false;
  }
  const stalePath = path.join(paths.loopDir, `run.lock.stale.${uniqueStampedId("", "agent-loop")}.json`);
  fs.renameSync(paths.runLockFile, stalePath);
  return true;
}

export function acquireRunLock(root: string, runnerName: string): string {
  const paths = new AgentLoopPaths(root);
  ensureDir(paths.loopDir);
  const payload: RunLockPayload = {
    schema: RUN_LOCK_SCHEMA,
    pid: process.pid,
    created_at: utcNow(),
    runner_name: runnerName,
  };
  while (true) {
    try {
      fs.writeFileSync(paths.runLockFile, `${JSON.stringify(payload, null, 2)}\n`, { flag: "wx" });
      return paths.runLockFile;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") {
        throw error;
      }
      if (!recoverStaleLock(paths)) {
        throw new Error(`run lock is already held: ${repoRelative(root, paths.runLockFile)}`);
      }
    }
  }
}

export function releaseRunLock(lockPath: string): void {
  if (fs.existsSync(lockPath)) {
    fs.unlinkSync(lockPath);
  }
}

export function autoArchiveOwnedItem(root: string, itemId: string): void {
  archiveItem(root, itemId);
}

export function allocateSession(root: string, runnerName: string, itemId: string): {
  sessionId: string;
  sessionDir: string;
} {
  const paths = new AgentLoopPaths(root);
  const sessionId = uniqueStampedId("sess-", `${runnerName}-${itemId}`);
  const sessionDir = paths.sessionDir(sessionId);
  ensureDir(sessionDir);
  return { sessionId, sessionDir };
}

export function writeSessionArtifacts(
  root: string,
  sessionId: string,
  runnerName: string,
  flowNext: FlowNextPayload,
): void {
  const paths = new AgentLoopPaths(root);
  const state = readItemState(root, flowNext.item_id || "");
  const brief = buildSessionBrief(root, sessionId, runnerName, paths, state, flowNext, flowRunnerCommand(root));
  writeJsonFile(paths.sessionBrief(sessionId), brief);
  const prompt = renderPrompt(brief);
  writeText(paths.promptFile(sessionId), prompt);
}

export function sessionPrompt(root: string, sessionId: string): string {
  const paths = new AgentLoopPaths(root);
  return fs.readFileSync(paths.promptFile(sessionId), "utf8");
}

export function writeSessionMeta(
  root: string,
  sessionId: string,
  exitCode: number | null,
  signal: string | null,
): void {
  const paths = new AgentLoopPaths(root);
  writeJsonFile(path.join(paths.sessionDir(sessionId), "session-meta.json"), {
    exit_code: exitCode,
    signal,
  });
}

export function writeSessionOutput(root: string, sessionId: string, stdout: string, stderr: string): void {
  const paths = new AgentLoopPaths(root);
  fs.writeFileSync(paths.stdoutFile(sessionId), stdout, "utf8");
  fs.writeFileSync(paths.stderrFile(sessionId), stderr, "utf8");
}

export function loadRunnerResult(root: string, sessionId: string): RunnerResult | null {
  const paths = new AgentLoopPaths(root);
  return loadJsonIfExists<RunnerResult>(paths.runnerResultFile(sessionId));
}

export function resultPathForSession(root: string, sessionId: string): string {
  const paths = new AgentLoopPaths(root);
  return repoRelative(root, paths.runnerResultFile(sessionId));
}

export function recordRun(
  root: string,
  itemId: string,
  sessionsLaunched: number,
  sessionBudget: number,
  stop: StopEnvelope,
): AgentLoopRunPayload {
  const paths = new AgentLoopPaths(root);
  const runId = uniqueStampedId("run-", `${itemId}-${stop.stop_reason}`);
  const record = buildRunRecord(runId, stop, itemId, sessionsLaunched, sessionBudget);
  writeJsonFile(paths.runRecordFile(runId), record);
  return {
    schema: "bagakit/agent-loop/run/v1",
    command: "run",
    run_status: stop.run_status,
    stop_reason: stop.stop_reason,
    operator_message: stop.operator_message,
    next_safe_action: stop.next_safe_action,
    can_resume: stop.can_resume,
    item_id: itemId,
    sessions_launched: sessionsLaunched,
    session_budget: sessionBudget,
    checkpoint_observed: stop.checkpoint_observed,
    runner_session_id: stop.runner_session_id,
    run_record_path: repoRelative(root, paths.runRecordFile(runId)),
    flow_next: stop.flow_next,
  };
}

export function snapshotLabel(itemId: string, sessionNumber: number): string {
  return `agent-loop-${sanitizeSegment(itemId)}-${sessionNumber}`;
}
