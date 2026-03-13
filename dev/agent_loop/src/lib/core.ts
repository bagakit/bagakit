import fs from "node:fs";
import path from "node:path";

import {
  archiveItem,
  flowRunnerCommand,
  loadNextAction,
  loadResumeCandidates,
  readItemState,
  validateFlowRunner,
} from "../adapters/flow_runner.ts";
import {
  initializeRunnerConfig,
  runnerConfigStatus,
  writeRunnerConfig,
} from "./config.ts";
import { initializeNotificationConfig, latestNotificationReceipt, notificationConfigIssue, notificationReceiptIssue } from "./notification_delivery.ts";
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
  FlowResumeCandidatesPayload,
  HostNotificationRequest,
  NotificationSeverity,
  RunLockPayload,
  RunLockState,
  RunRecord,
  RunnerConfig,
  RunnerConfigStatus,
  RunnerResult,
  WatchFocusItem,
  WatchSessionSummary,
} from "./model.ts";
import { HOST_NOTIFICATION_SCHEMA, RUN_LOCK_SCHEMA, RUN_RECORD_SCHEMA, RUNNER_RESULT_SCHEMA, RUN_SCHEMA, WATCH_SCHEMA } from "./model.ts";
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
  resume_candidates?: FlowResumeCandidatesPayload;
}>;

function notificationSeverity(stopReason: AgentLoopRunPayload["stop_reason"]): NotificationSeverity {
  switch (stopReason) {
    case "runner_launch_failed":
    case "runner_timeout":
    case "runner_exited_nonzero":
    case "runner_output_missing":
    case "runner_output_invalid":
    case "flow_runner_refresh_failed":
      return "critical";
    case "run_lock_conflict":
    case "runner_config_required":
    case "runner_config_invalid":
    case "session_budget_exhausted":
    case "checkpoint_missing":
    case "blocked_item":
    case "closeout_pending":
    case "operator_cancelled":
      return "warn";
    default:
      return "info";
  }
}

function nextUserAction(nextSafeAction: string): string {
  switch (nextSafeAction) {
    case "configure_runner":
      return "Configure the runner before retrying the loop.";
    case "repair_runner_config":
      return "Repair the runner configuration before the next bounded session.";
    case "resolve_blocker":
      return "Resolve the blocker and rerun the pinned item.";
    case "close_item_upstream":
      return "Complete closeout in the upstream owner before rerunning.";
    case "inspect_run_lock":
      return "Wait for the active run or clear the stale lock if it is no longer live.";
    case "inspect_runner_session":
      return "Inspect the latest runner session exhaust and decide whether to rerun.";
    case "inspect_flow_runner_state":
      return "Inspect flow-runner state and restore canonical runtime surfaces before continuing.";
    case "repair_runner_result":
      return "Repair the runner result exhaust and rerun the item once the session outcome is understood.";
    case "resume_run":
      return "Resume the same item with a fresh bounded session.";
    case "archive_owned_item":
      return "Archive the runner-owned item through the canonical closeout path.";
    case "run":
      return "Launch the next bounded session.";
    default:
      return "Review the stop details and choose the next maintainer action.";
  }
}

function nextCommandExample(itemId: string, stop: StopEnvelope, sessionBudget: number): string {
  switch (stop.next_safe_action) {
    case "run":
    case "resume_run":
    case "inspect_runner_session":
    case "repair_runner_result":
    case "resolve_blocker":
    case "close_item_upstream":
      return `bash "dev/agent_loop/agent-loop.sh" run --root . --item ${itemId} --max-sessions ${sessionBudget}`;
    case "configure_runner":
    case "repair_runner_config":
      return `bash "dev/agent_loop/agent-loop.sh" configure-runner --root . --preset codex`;
    case "inspect_run_lock":
      return `cat .bagakit/agent-loop/run.lock`;
    case "inspect_flow_runner_state":
      return `bash "skills/harness/bagakit-flow-runner/scripts/flow-runner.sh" next --root . --item ${itemId} --json`;
    case "inspect_resume_candidates":
      return `bash "skills/harness/bagakit-flow-runner/scripts/flow-runner.sh" resume-candidates --root . --json`;
    case "archive_owned_item":
      return `bash "skills/harness/bagakit-flow-runner/scripts/flow-runner.sh" archive-item --root . --item ${itemId}`;
    default:
      return "";
  }
}

function buildHostNotificationRequest(runId: string, itemId: string, stop: StopEnvelope): HostNotificationRequest | undefined {
  if (stop.run_status !== "operator_action_required") {
    return undefined;
  }
  return {
    schema: HOST_NOTIFICATION_SCHEMA,
    source: "agent_loop_host",
    audience: "maintainer",
    run_id: runId,
    item_id: itemId,
    recorded_at: utcNow(),
    reason: stop.stop_reason,
    severity: notificationSeverity(stop.stop_reason),
    summary: stop.operator_message,
    next_user_action: nextUserAction(stop.next_safe_action),
    details: stop.operator_message,
    dedupe_key: `agent-loop:${stop.stop_reason}:${itemId}`,
  };
}

export function applyAgentLoop(root: string, toolDir: string): string {
  const paths = new AgentLoopPaths(root);
  ensureDir(paths.loopDir);
  ensureDir(paths.sessionsDir);
  ensureDir(paths.runsDir);
  ensureDir(paths.notificationDir);
  initializeRunnerConfig(paths, toolDir);
  initializeNotificationConfig(root, toolDir);
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

export function computeResumeCandidates(root: string): FlowResumeCandidatesPayload {
  return loadResumeCandidates(root);
}

function buildRunRecord(
  runId: string,
  stop: StopEnvelope,
  itemId: string,
  sessionsLaunched: number,
  sessionBudget: number,
): RunRecord {
  const hostNotificationRequest = buildHostNotificationRequest(runId, itemId, stop);
  const commandExample = nextCommandExample(itemId, stop, sessionBudget);
  return {
    schema: RUN_RECORD_SCHEMA,
    run_id: runId,
    recorded_at: utcNow(),
    run_status: stop.run_status,
    stop_reason: stop.stop_reason,
    operator_message: stop.operator_message,
    next_safe_action: stop.next_safe_action,
    next_command_example: commandExample,
    can_resume: stop.can_resume,
    item_id: itemId,
    sessions_launched: sessionsLaunched,
    session_budget: sessionBudget,
    checkpoint_observed: stop.checkpoint_observed,
    runner_session_id: stop.runner_session_id,
    host_notification_request: hostNotificationRequest,
    resume_candidates: stop.resume_candidates,
  };
}

function sortedRunRecords(paths: AgentLoopPaths): RunRecord[] {
  if (!fs.existsSync(paths.runsDir)) {
    return [];
  }
  const entries = fs.readdirSync(paths.runsDir) as string[];
  return entries
    .filter((entry: string) => entry.endsWith(".json"))
    .flatMap((entry: string) => {
      try {
        return [readJsonFile<RunRecord>(path.join(paths.runsDir, entry))];
      } catch {
        return [];
      }
    })
    .sort((left: RunRecord, right: RunRecord) => right.recorded_at.localeCompare(left.recorded_at));
}

export function runnerResultIssue(result: RunnerResult | null, sessionId: string): string {
  if (!result) {
    return `session ${sessionId} is missing runner-result.json`;
  }
  if (result.schema !== RUNNER_RESULT_SCHEMA) {
    return `session ${sessionId} has invalid runner-result schema`;
  }
  if (result.session_id !== sessionId) {
    return `session ${sessionId} runner-result session_id mismatch`;
  }
  if (result.status !== "completed" && result.status !== "operator_cancelled") {
    return `session ${sessionId} runner-result status is invalid`;
  }
  if (typeof result.checkpoint_written !== "boolean" || typeof result.note !== "string") {
    return `session ${sessionId} runner-result field types are invalid`;
  }
  return "";
}

function loadSessionMeta(filePath: string): {
  exit_code: number | null;
  item_id?: string;
  workload_id?: string;
  runner_name?: string;
  started_at?: string;
} | null {
  try {
    return loadJsonIfExists<{
      exit_code: number | null;
      item_id?: string;
      workload_id?: string;
      runner_name?: string;
      started_at?: string;
    }>(filePath);
  } catch {
    return null;
  }
}

function sessionMetaIssue(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    return "";
  }
  try {
    readJsonFile<unknown>(filePath);
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function sortedSessionSummaries(paths: AgentLoopPaths): WatchSessionSummary[] {
  if (!fs.existsSync(paths.sessionsDir)) {
    return [];
  }
  const entries = fs.readdirSync(paths.sessionsDir, { withFileTypes: true }) as Array<{ name: string; isDirectory(): boolean }>;
  const summaries: WatchSessionSummary[] = entries
    .filter((entry: any) => entry.isDirectory())
    .map((entry: any) => {
      const briefPath = path.join(paths.sessionDir(entry.name), "session-brief.json");
      const metadataPath = path.join(paths.sessionDir(entry.name), "session-meta.json");
      const resultPath = path.join(paths.sessionDir(entry.name), "runner-result.json");
      try {
        const brief = readJsonFile<{
          session_id: string;
          started_at: string;
          runner_name: string;
          item: { item_id: string };
        }>(briefPath);
        const metadata = loadSessionMeta(metadataPath);
        let result: RunnerResult | null = null;
        let issue = "";
        try {
          result = loadJsonIfExists<RunnerResult>(resultPath);
          issue = runnerResultIssue(result, brief.session_id);
        } catch (error) {
          issue = error instanceof Error ? error.message : String(error);
        }
        const resultStatus: RunnerResult["status"] | "" =
          result?.status === "completed" || result?.status === "operator_cancelled" ? result.status : "";
        return {
          session_id: brief.session_id,
          item_id: brief.item.item_id,
          runner_name: brief.runner_name,
          started_at: brief.started_at,
          exit_code: metadata?.exit_code ?? null,
          result_status: resultStatus,
          checkpoint_written: result?.checkpoint_written ?? null,
          issue: issue || undefined,
        };
      } catch (error) {
        const metadata = loadSessionMeta(metadataPath);
        return {
          session_id: entry.name,
          item_id: metadata?.workload_id || metadata?.item_id || "",
          runner_name: metadata?.runner_name || "",
          started_at: metadata?.started_at || "",
          exit_code: metadata?.exit_code ?? null,
          result_status: "" as const,
          checkpoint_written: null,
          issue: error instanceof Error ? error.message : String(error),
        };
      }
    });
  return summaries.sort((left: WatchSessionSummary, right: WatchSessionSummary) => right.started_at.localeCompare(left.started_at));
}

function safeNextPayload(root: string, itemId?: string): { payload: FlowNextPayload; error: string } {
  try {
    return {
      payload: loadNextAction(root, itemId),
      error: "",
    };
  } catch (error) {
    return {
      payload: {
        schema: "bagakit/flow-runner/next-action/v2",
        command: "next",
        recommended_action: "stop",
        action_reason: "no_actionable_item",
        session_contract: {
          launch_bounded_session: false,
          persist_state_before_stop: false,
          checkpoint_before_stop: false,
          snapshot_before_session: false,
          archive_only_closeout: false,
        },
      },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function runLockState(paths: AgentLoopPaths): RunLockState {
  const lock = loadJsonIfExists<RunLockPayload>(paths.runLockFile);
  if (!lock) {
    return { status: "idle" };
  }
  return {
    status: isPidLive(lock.pid) ? "held" : "stale",
    pid: lock.pid,
    runner_name: lock.runner_name,
    created_at: lock.created_at,
  };
}

function readTail(filePath: string, lines: number): string {
  if (!fs.existsSync(filePath)) {
    return "";
  }
  const kept = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter((line) => line.length > 0).slice(-lines);
  return kept.join("\n");
}

function focusItemFromNext(root: string, flowNext: FlowNextPayload): WatchFocusItem | undefined {
  if (!flowNext.item_id) {
    return undefined;
  }
  try {
    const state = readItemState(root, flowNext.item_id);
    return {
      item_id: state.item_id,
      title: state.title,
      source_kind: state.source_kind,
      source_ref: state.source_ref,
      status: state.status,
      resolution: state.resolution,
      current_stage: state.current_stage,
      current_step_status: state.current_step_status,
      session_number: state.runtime.session_count,
      handoff_path: state.paths.handoff,
      progress_log_path: state.paths.progress_log,
      current_safe_anchor: state.runtime.current_safe_anchor,
      checkpoint_request: flowNext.checkpoint_request,
    };
  } catch {
    return undefined;
  }
}

function latestNotification(recentRuns: RunRecord[]): HostNotificationRequest | undefined {
  const latestRun = recentRuns[0];
  if (!latestRun || latestRun.run_status !== "operator_action_required") {
    return undefined;
  }
  return latestRun.host_notification_request;
}

function sessionMatchesItem(session: WatchSessionSummary, itemId: string): boolean {
  return session.item_id === itemId;
}

function runRecordIssues(paths: AgentLoopPaths): string[] {
  if (!fs.existsSync(paths.runsDir)) {
    return [];
  }
  const entries = fs.readdirSync(paths.runsDir) as string[];
  return entries
    .filter((entry: string) => entry.endsWith(".json"))
    .flatMap((entry: string) => {
      try {
        const record = readJsonFile<RunRecord>(path.join(paths.runsDir, entry));
        return record.schema === RUN_RECORD_SCHEMA ? [] : [`run record ${entry} has invalid schema`];
      } catch (error) {
        return [`run record ${entry} is unreadable: ${error instanceof Error ? error.message : String(error)}`];
      }
    });
}

export function watchAgentLoop(root: string, itemId?: string): AgentLoopWatchPayload {
  const paths = new AgentLoopPaths(root);
  const configStatus = runnerConfigStatus(paths);
  const allRuns = sortedRunRecords(paths);
  const allSessions = sortedSessionSummaries(paths);
  const nextAttempt = safeNextPayload(root, itemId);
  const flowNext = nextAttempt.payload;
  const focusItem = focusItemFromNext(root, flowNext);
  const watchItemId = focusItem?.item_id || itemId || "";
  const recentRuns = (watchItemId ? allRuns.filter((run) => run.item_id === watchItemId) : allRuns).slice(0, 5);
  const recentSessions = (
    watchItemId
      ? allSessions.filter((session) => sessionMatchesItem(session, watchItemId))
      : allSessions
  ).slice(0, 5);
  const latestSession = recentSessions[0];
  const latestRun = recentRuns[0];
  return {
    schema: WATCH_SCHEMA,
    command: "watch",
    refreshed_at: utcNow(),
    watch_issue: nextAttempt.error || undefined,
    runner_config_status: configStatus.status,
    runner_name: configStatus.config?.runner_name || "unset",
    run_lock: runLockState(paths),
    decision: {
      recommended_action: flowNext.recommended_action,
      action_reason: flowNext.action_reason,
      next_safe_action: nextSafeActionForState(flowNext, configStatus),
    },
    focus_item: focusItem,
    latest_run: latestRun,
    latest_session: latestSession,
    current_notification: latestNotification(recentRuns),
    latest_notification_delivery: latestRun ? latestNotificationReceipt(root, latestRun.run_id) || undefined : undefined,
    recent_runs: recentRuns,
    recent_sessions: recentSessions,
    detail: {
      handoff_excerpt: focusItem ? readTail(path.join(root, focusItem.handoff_path), 10) : "",
      progress_excerpt: focusItem ? readTail(path.join(root, focusItem.progress_log_path), 10) : "",
      stdout_excerpt: latestSession ? readTail(paths.stdoutFile(latestSession.session_id), 10) : "",
      stderr_excerpt: latestSession ? readTail(paths.stderrFile(latestSession.session_id), 10) : "",
    },
  };
}

export function validateAgentLoop(root: string): string[] {
  const paths = new AgentLoopPaths(root);
  const issues: string[] = [];
  const configStatus = runnerConfigStatus(paths);
  if (configStatus.status === "invalid") {
    issues.push(configStatus.message);
  }
  const notifyIssue = notificationConfigIssue(root);
  if (notifyIssue) {
    issues.push(notifyIssue);
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
    const hasSummaryIssue = Boolean(session.issue);
    if (session.issue) {
      issues.push(session.issue.startsWith("session ") ? session.issue : `session ${session.session_id} is unreadable: ${session.issue}`);
    }
    for (const required of ["session-brief.json", "prompt.txt", "stdout.txt", "stderr.txt", "session-meta.json"]) {
      if (!fs.existsSync(path.join(sessionDir, required))) {
        issues.push(`session ${session.session_id} is missing ${required}`);
      }
    }
    const metaIssue = sessionMetaIssue(path.join(sessionDir, "session-meta.json"));
    if (metaIssue) {
      issues.push(`session ${session.session_id} has unreadable session-meta.json: ${metaIssue}`);
    }
    if (hasSummaryIssue) {
      continue;
    }
    const result = loadJsonIfExists<RunnerResult>(path.join(sessionDir, "runner-result.json"));
    const resultIssue = runnerResultIssue(result, session.session_id);
    if (resultIssue) {
      issues.push(resultIssue);
    }
  }
  issues.push(...runRecordIssues(paths));
  const receiptIssue = notificationReceiptIssue(root);
  if (receiptIssue) {
    issues.push(receiptIssue);
  }
  const latestDelivery = latestNotificationReceipt(root);
  if (latestDelivery && latestDelivery.schema !== "bagakit/agent-loop/notification-receipt/v1") {
    issues.push("invalid notification receipt schema");
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
      const code = (error as { code?: string }).code;
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
): string {
  const paths = new AgentLoopPaths(root);
  const state = readItemState(root, flowNext.item_id || "");
  const brief = buildSessionBrief(root, sessionId, runnerName, paths, state, flowNext, flowRunnerCommand(root));
  writeJsonFile(paths.sessionBrief(sessionId), brief);
  return renderPrompt(brief);
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
    schema: RUN_SCHEMA,
    command: "run",
    run_status: stop.run_status,
    stop_reason: stop.stop_reason,
    operator_message: stop.operator_message,
    next_safe_action: stop.next_safe_action,
    next_command_example: record.next_command_example,
    can_resume: stop.can_resume,
    item_id: itemId,
    sessions_launched: sessionsLaunched,
    session_budget: sessionBudget,
    checkpoint_observed: stop.checkpoint_observed,
    runner_session_id: stop.runner_session_id,
    run_record_path: repoRelative(root, paths.runRecordFile(runId)),
    flow_next: stop.flow_next,
    host_notification_request: record.host_notification_request,
    resume_candidates: stop.resume_candidates,
  };
}

export function snapshotLabel(itemId: string, sessionNumber: number): string {
  return `agent-loop-${sanitizeSegment(itemId)}-${sessionNumber}`;
}
