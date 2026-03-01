import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parseArgvJson, normalizeRefreshCommands, presetArgv, runnerConfigStatus, writeRunnerConfig } from "../src/lib/config.ts";
import { applyAgentLoop } from "../src/lib/core.ts";
import { AgentLoopPaths } from "../src/lib/paths.ts";

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
