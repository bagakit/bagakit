import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parseArgvJson, normalizeRefreshCommands, presetArgv, runnerConfigStatus, writeRunnerConfig } from "../src/lib/config.ts";
import { applyAgentLoop } from "../src/lib/core.ts";
import { AgentLoopPaths } from "../src/lib/paths.ts";
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

test("apply initializes template config and marks it invalid until configured", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-loop-"));
  const toolDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const applied = applyAgentLoop(root, toolDir);
  assert.equal(applied, ".bagakit/agent-loop");
  const paths = new AgentLoopPaths(root);
  const status = runnerConfigStatus(paths);
  assert.equal(status.status, "invalid");
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
});
