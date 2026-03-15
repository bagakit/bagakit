import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parseArgvJson, normalizeRefreshCommands, presetArgv, runnerConfigStatus, writeRunnerConfig } from "../src/lib/config.ts";
import { decideContinuationAfterSessionStop } from "../src/lib/continuation.ts";
import { notificationConfigIssue } from "../src/lib/notification_delivery.ts";
import { applyAgentLoop } from "../src/lib/core.ts";
import { writeJsonFile } from "../src/lib/io.ts";
import { AgentLoopPaths } from "../src/lib/paths.ts";
import { shouldUseHostTimeout } from "../src/lib/runner_truth.ts";
import { readSessionHostSnapshot } from "../src/lib/session_host_snapshot.ts";
import { deriveSessionHostStatus } from "../src/lib/session_host_status.ts";
import { renderWatchScreen } from "../src/lib/watch_presenter.ts";

test("codex preset stays repo-root placeholder based", () => {
  const preset = presetArgv("codex");
  assert.equal(preset.runner_name, "codex");
  assert.deepEqual(preset.argv, ["codex", "exec", "--skip-git-repo-check", "-C", "{repo_root}", "-"]);
});

test("custom argv parser rejects empty commands", () => {
  assert.throws(() => parseArgvJson("[]"));
});

test("refresh command parser keeps argv matrices", () => {
  const commands = normalizeRefreshCommands(['["bash","scripts/demo.sh"]', '["node","tool.mjs"]']);
  assert.deepEqual(commands, [["bash", "scripts/demo.sh"], ["node", "tool.mjs"]]);
});

test("trusted runner launchers do not use host timeout authority", () => {
  assert.equal(
    shouldUseHostTimeout({
      schema: "bagakit/agent-loop/runner-config/v1",
      runner_name: "codexL",
      transport: "stdin_prompt",
      argv: ["codexL", "exec", "-"],
      env: {},
      timeout_seconds: 1800,
      refresh_commands: [],
    }),
    false,
  );
  assert.equal(
    shouldUseHostTimeout({
      schema: "bagakit/agent-loop/runner-config/v1",
      runner_name: "fake",
      transport: "stdin_prompt",
      argv: ["python3", "runner.py"],
      env: {},
      timeout_seconds: 1800,
      refresh_commands: [],
    }),
    true,
  );
});

test("apply initializes template config and marks it invalid until configured", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-loop-"));
  const toolDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const applied = applyAgentLoop(root, toolDir);
  assert.equal(applied, ".bagakit/agent-loop");
  const paths = new AgentLoopPaths(root);
  const installed = fs.readFileSync(paths.installedEntrypoint, "utf8");
  assert.ok(installed.startsWith("set -euo pipefail\n"));
  assert.ok(installed.includes('exec bash "$script_dir/'));
  assert.equal(fs.readFileSync(paths.binGitignoreFile, "utf8"), "*\n!.gitignore\n");
  const status = runnerConfigStatus(paths);
  assert.equal(status.status, "invalid");
});

test("apply replaces an old symlinked entrypoint with the installed wrapper", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-loop-"));
  const toolDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const paths = new AgentLoopPaths(root);
  fs.mkdirSync(paths.binDir, { recursive: true });
  fs.symlinkSync(path.join(toolDir, "agent-loop.sh"), paths.installedEntrypoint);
  applyAgentLoop(root, toolDir);
  const installed = fs.readFileSync(paths.installedEntrypoint, "utf8");
  assert.ok(installed.startsWith("set -euo pipefail\n"));
  assert.ok(installed.includes('exec bash "$script_dir/'));
});

test("runner config becomes ready after explicit argv is written", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-loop-"));
  const paths = new AgentLoopPaths(root);
  fs.mkdirSync(paths.loopDir, { recursive: true });
  writeRunnerConfig(paths, {
    schema: "bagakit/agent-loop/runner-config/v1",
    runner_name: "custom",
    transport: "stdin_prompt",
    argv: ["python3", "runner.py"],
    env: {},
    timeout_seconds: 60,
    refresh_commands: [],
  });
  const status = runnerConfigStatus(paths);
  assert.equal(status.status, "ready");
  assert.equal(status.config?.argv[0], "python3");
});

test("runner config rejects bare interactive codex argv", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-loop-"));
  const paths = new AgentLoopPaths(root);
  fs.mkdirSync(paths.loopDir, { recursive: true });
  writeRunnerConfig(paths, {
    schema: "bagakit/agent-loop/runner-config/v1",
    runner_name: "codex",
    transport: "stdin_prompt",
    argv: ["codex"],
    env: {},
    timeout_seconds: 60,
    refresh_commands: [],
  });
  const status = runnerConfigStatus(paths);
  assert.equal(status.status, "invalid");
});

test("runner config rejects bare interactive codexL argv", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-loop-"));
  const paths = new AgentLoopPaths(root);
  fs.mkdirSync(paths.loopDir, { recursive: true });
  writeRunnerConfig(paths, {
    schema: "bagakit/agent-loop/runner-config/v1",
    runner_name: "codexL",
    transport: "stdin_prompt",
    argv: ["codexL"],
    env: {},
    timeout_seconds: 60,
    refresh_commands: [],
  });
  const status = runnerConfigStatus(paths);
  assert.equal(status.status, "invalid");
});

test("watch presenter keeps action-first sections visible", () => {
  const screen = renderWatchScreen(
    {
      schema: "bagakit/agent-loop/watch/v2",
      command: "watch",
      refreshed_at: "2026-04-20T00:00:00Z",
      runner_config_status: "ready",
      runner_name: "codex",
      run_lock: { status: "idle" },
      decision: {
        recommended_action: "run_session",
        action_reason: "active_work",
        next_safe_action: "run",
      },
      focus_item: {
        item_id: "manual-one",
        title: "Manual item",
        source_kind: "manual",
        source_ref: "manual:one",
        status: "todo",
        resolution: "live",
        current_stage: "inspect",
        current_step_status: "pending",
        session_number: 0,
        handoff_path: ".bagakit/flow-runner/items/manual-one/handoff.md",
        progress_log_path: ".bagakit/flow-runner/items/manual-one/progress.ndjson",
        checkpoint_request: {
          stage: "inspect",
          session_status: "progress",
          command_example: "checkpoint ...",
        },
      },
      latest_run: {
        schema: "bagakit/agent-loop/run-record/v2",
        run_id: "run-1",
        recorded_at: "2026-04-20T00:00:00Z",
        run_status: "operator_action_required",
        stop_reason: "session_budget_exhausted",
        operator_message: "budget hit",
        next_safe_action: "resume_run",
        next_command_example: "bagakit agent loop run ...",
        can_resume: true,
        item_id: "manual-one",
        sessions_launched: 1,
        session_budget: 1,
        checkpoint_observed: true,
        runner_session_id: "sess-1",
      },
      latest_session: {
        session_id: "sess-1",
        item_id: "manual-one",
        runner_name: "codex",
        started_at: "2026-04-20T00:00:00Z",
        exit_code: 0,
        signal: null,
        result_status: "completed",
        checkpoint_written: true,
      },
      current_notification: {
        schema: "bagakit/agent-loop/host-notification/v1",
        source: "agent_loop_host",
        audience: "maintainer",
        run_id: "run-1",
        item_id: "manual-one",
        recorded_at: "2026-04-20T00:00:00Z",
        reason: "session_budget_exhausted",
        severity: "warn",
        summary: "budget hit",
        next_user_action: "resume",
        details: "budget hit",
        dedupe_key: "agent-loop:session_budget_exhausted:manual-one",
      },
      recent_runs: [],
      recent_sessions: [],
      detail: {
        handoff_excerpt: "",
        progress_excerpt: "",
        stdout_excerpt: "",
        stderr_excerpt: "",
      },
    },
    { ansi: false, width: 120 },
  );
  assert.ok(screen.includes("Action"));
  assert.ok(screen.includes("Focus Item"));
  assert.ok(screen.includes("Loop Status"));
  assert.ok(screen.includes("Controls:"));
});

test("watch presenter prefers current decision over historical attention residue", () => {
  const screen = renderWatchScreen(
    {
      schema: "bagakit/agent-loop/watch/v2",
      command: "watch",
      refreshed_at: "2026-04-20T00:00:00Z",
      runner_config_status: "ready",
      runner_name: "codex",
      run_lock: { status: "idle" },
      decision: {
        recommended_action: "run_session",
        action_reason: "active_work",
        next_safe_action: "run",
      },
      focus_item: {
        item_id: "manual-two",
        title: "Manual two",
        source_kind: "manual",
        source_ref: "manual:two",
        status: "todo",
        resolution: "live",
        current_stage: "implement",
        current_step_status: "active",
        session_number: 1,
        handoff_path: ".bagakit/flow-runner/items/manual-two/handoff.md",
        progress_log_path: ".bagakit/flow-runner/items/manual-two/progress.ndjson",
      },
      latest_run: {
        schema: "bagakit/agent-loop/run-record/v2",
        run_id: "run-2",
        recorded_at: "2026-04-20T00:00:00Z",
        run_status: "terminal",
        stop_reason: "item_archived",
        operator_message: "old stop",
        next_safe_action: "idle",
        next_command_example: "",
        can_resume: false,
        item_id: "manual-old",
        sessions_launched: 1,
        session_budget: 1,
        checkpoint_observed: true,
        runner_session_id: "sess-2",
      },
      recent_runs: [],
      recent_sessions: [],
      detail: {
        handoff_excerpt: "",
        progress_excerpt: "",
        stdout_excerpt: "",
        stderr_excerpt: "",
      },
    },
    { ansi: false, width: 120 },
  );
  assert.ok(screen.includes("READY"));
});

test("watch presenter surfaces degraded refresh errors before ready state", () => {
  const screen = renderWatchScreen(
    {
      schema: "bagakit/agent-loop/watch/v2",
      command: "watch",
      refreshed_at: "2026-04-20T00:00:00Z",
      watch_issue: "flow-runner script is missing",
      runner_config_status: "ready",
      runner_name: "codex",
      run_lock: { status: "idle" },
      decision: {
        recommended_action: "run_session",
        action_reason: "active_work",
        next_safe_action: "run",
      },
      recent_runs: [],
      recent_sessions: [],
      detail: {
        handoff_excerpt: "",
        progress_excerpt: "",
        stdout_excerpt: "",
        stderr_excerpt: "",
      },
    },
    { ansi: false, width: 120 },
  );
  assert.ok(screen.includes("WATCH DEGRADED"));
});

test("watch presenter does not show ready when launch is blocked by config", () => {
  const screen = renderWatchScreen(
    {
      schema: "bagakit/agent-loop/watch/v2",
      command: "watch",
      refreshed_at: "2026-04-20T00:00:00Z",
      runner_config_status: "invalid",
      runner_name: "codex",
      run_lock: { status: "idle" },
      decision: {
        recommended_action: "run_session",
        action_reason: "active_work",
        next_safe_action: "repair_runner_config",
      },
      recent_runs: [],
      recent_sessions: [],
      detail: {
        handoff_excerpt: "",
        progress_excerpt: "",
        stdout_excerpt: "",
        stderr_excerpt: "",
      },
    },
    { ansi: false, width: 120 },
  );
  assert.ok(screen.includes("LAUNCH BLOCKED"));
});

test("notification config validation rejects unknown transport", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-loop-"));
  const paths = new AgentLoopPaths(root);
  fs.mkdirSync(paths.loopDir, { recursive: true });
  writeJsonFile(paths.notificationConfigFile, {
    schema: "bagakit/agent-loop/notification-config/v1",
    transport: "commnad",
    command: {
      argv: [],
      env: {},
      timeout_seconds: 30,
      payload_mode: "stdin_json",
    },
  });
  assert.ok(notificationConfigIssue(root).includes("disabled or command"));
});

test("notification config validation rejects empty command argv", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-loop-"));
  const paths = new AgentLoopPaths(root);
  fs.mkdirSync(paths.loopDir, { recursive: true });
  writeJsonFile(paths.notificationConfigFile, {
    schema: "bagakit/agent-loop/notification-config/v1",
    transport: "command",
    command: {
      argv: [],
      env: {},
      timeout_seconds: 30,
      payload_mode: "stdin_json",
    },
  });
  assert.ok(notificationConfigIssue(root).includes("must not be empty"));
});

test("notification config validation rejects invalid timeout", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-loop-"));
  const paths = new AgentLoopPaths(root);
  fs.mkdirSync(paths.loopDir, { recursive: true });
  writeJsonFile(paths.notificationConfigFile, {
    schema: "bagakit/agent-loop/notification-config/v1",
    transport: "command",
    command: {
      argv: ["python3", "notify.py"],
      env: {},
      timeout_seconds: "nan",
      payload_mode: "stdin_json",
    },
  });
  assert.ok(notificationConfigIssue(root).includes("positive finite number"));
});

test("session host status keeps active sessions running when result is not written yet", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-loop-"));
  const paths = new AgentLoopPaths(root);
  const sessionId = "sess-live";
  fs.mkdirSync(paths.sessionDir(sessionId), { recursive: true });
  writeJsonFile(paths.sessionBrief(sessionId), {
    session_id: sessionId,
    started_at: "2026-04-20T00:00:00Z",
    runner_name: "codex",
    item: {
      item_id: "manual-one",
    },
  });
  writeJsonFile(path.join(paths.sessionDir(sessionId), "session-meta.json"), {
    item_id: "manual-one",
    runner_name: "codex",
    started_at: "2026-04-20T00:00:00Z",
    exit_code: null,
    signal: null,
  });
  fs.writeFileSync(path.join(paths.sessionDir(sessionId), "prompt.txt"), "", "utf8");
  fs.writeFileSync(path.join(paths.sessionDir(sessionId), "stdout.txt"), "", "utf8");
  fs.writeFileSync(path.join(paths.sessionDir(sessionId), "stderr.txt"), "", "utf8");

  const snapshot = readSessionHostSnapshot(root, sessionId);
  const status = deriveSessionHostStatus(snapshot);
  assert.equal(status.execution_state, "running");
});

test("continuation layer opens recovery when a stopped session still leaves flow truth runnable", () => {
  const decision = decideContinuationAfterSessionStop(
    {
      run_status: "operator_action_required",
      stop_reason: "runner_launch_failed",
      operator_message: "buffer exhausted",
      next_safe_action: "inspect_runner_session",
      can_resume: true,
      checkpoint_observed: true,
      runner_session_id: "sess-1",
      flow_next: {
        schema: "bagakit/flow-runner/next-action/v2",
        command: "next",
        item_id: "manual-one",
        recommended_action: "run_session",
        action_reason: "active_work",
        session_contract: {
          launch_bounded_session: true,
          persist_state_before_stop: true,
          checkpoint_before_stop: true,
          snapshot_before_session: false,
          archive_only_closeout: false,
        },
      },
    },
    {
      session_dir: ".bagakit/agent-loop/runner-sessions/sess-1",
      session_brief: ".bagakit/agent-loop/runner-sessions/sess-1/session-brief.json",
      prompt_file: ".bagakit/agent-loop/runner-sessions/sess-1/prompt.txt",
      stdout_file: ".bagakit/agent-loop/runner-sessions/sess-1/stdout.txt",
      stderr_file: ".bagakit/agent-loop/runner-sessions/sess-1/stderr.txt",
      session_meta_file: ".bagakit/agent-loop/runner-sessions/sess-1/session-meta.json",
      runner_result_file: ".bagakit/agent-loop/runner-sessions/sess-1/runner-result.json",
    },
  );
  assert.equal(decision.kind, "recover");
  if (decision.kind === "recover") {
    assert.equal(decision.recovery.previous_session_id, "sess-1");
    assert.equal(decision.recovery.previous_stop_reason, "runner_launch_failed");
  }
});

test("continuation layer stops on canonical flow closeout even if the session stop looked scary", () => {
  const decision = decideContinuationAfterSessionStop(
    {
      run_status: "operator_action_required",
      stop_reason: "runner_output_invalid",
      operator_message: "bad runner result",
      next_safe_action: "inspect_runner_session",
      can_resume: true,
      checkpoint_observed: true,
      runner_session_id: "sess-2",
      flow_next: {
        schema: "bagakit/flow-runner/next-action/v2",
        command: "next",
        item_id: "manual-two",
        recommended_action: "stop",
        action_reason: "closeout_pending",
        session_contract: {
          launch_bounded_session: false,
          persist_state_before_stop: true,
          checkpoint_before_stop: true,
          snapshot_before_session: false,
          archive_only_closeout: false,
        },
      },
    },
    {
      session_dir: ".bagakit/agent-loop/runner-sessions/sess-2",
      session_brief: ".bagakit/agent-loop/runner-sessions/sess-2/session-brief.json",
      prompt_file: ".bagakit/agent-loop/runner-sessions/sess-2/prompt.txt",
      stdout_file: ".bagakit/agent-loop/runner-sessions/sess-2/stdout.txt",
      stderr_file: ".bagakit/agent-loop/runner-sessions/sess-2/stderr.txt",
      session_meta_file: ".bagakit/agent-loop/runner-sessions/sess-2/session-meta.json",
      runner_result_file: ".bagakit/agent-loop/runner-sessions/sess-2/runner-result.json",
    },
  );
  assert.equal(decision.kind, "stop");
  if (decision.kind === "stop") {
    assert.equal(decision.stop.stop_reason, "closeout_pending");
    assert.equal(decision.stop.next_safe_action, "close_item_upstream");
  }
});
