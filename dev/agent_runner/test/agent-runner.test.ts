import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { launchStdinRunnerSession } from "../src/lib/session.ts";
import type { AgentRunnerLaunchRequest } from "../src/lib/model.ts";

function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function baseRequest(tempRoot: string): AgentRunnerLaunchRequest {
  const sessionDir = path.join(tempRoot, "session");
  return {
    cwd: tempRoot,
    session_id: "sess-demo",
    workload_id: "case-demo",
    started_at: "2026-04-20T00:00:00Z",
    prompt_text: "hello from prompt\n",
    template_context: {
      repo_root: tempRoot,
      session_dir: sessionDir,
    },
    config: {
      runner_name: "fake",
      transport: "stdin_prompt",
      argv: [],
      env: {},
      timeout_seconds: 2,
    },
    paths: {
      session_dir: sessionDir,
      prompt_file: path.join(sessionDir, "prompt.txt"),
      stdout_file: path.join(sessionDir, "stdout.txt"),
      stderr_file: path.join(sessionDir, "stderr.txt"),
      session_meta_file: path.join(sessionDir, "session-meta.json"),
    },
  };
}

test("launchStdinRunnerSession writes prompt, output, and session meta", () => {
  const tempRoot = tempDir("bagakit-agent-runner-");
  const request = baseRequest(tempRoot);
  request.config = {
    ...request.config,
    argv: [
      "python3",
      "-c",
      "import os,sys; print(os.environ['MODE']); print(sys.stdin.read().strip())",
    ],
    env: {
      MODE: "demo-{session_dir}",
    },
  };

  const result = launchStdinRunnerSession(request);
  assert.equal(result.exit_code, 0);
  assert.ok(result.stdout.includes("demo-"));
  assert.ok(result.stdout.includes("hello from prompt"));
  assert.equal(fs.readFileSync(request.paths.prompt_file, "utf8"), request.prompt_text);
  assert.equal(fs.readFileSync(request.paths.stdout_file, "utf8"), result.stdout);
  const meta = JSON.parse(fs.readFileSync(request.paths.session_meta_file, "utf8")) as Record<string, unknown>;
  assert.equal(meta.schema, "bagakit/agent-runner/session-meta/v1");
  assert.equal(meta.workload_id, "case-demo");
  assert.deepEqual(meta.env_keys, ["MODE"]);
});

test("launchStdinRunnerSession records timeout launch errors", () => {
  const tempRoot = tempDir("bagakit-agent-runner-");
  const request = baseRequest(tempRoot);
  request.config = {
    ...request.config,
    timeout_seconds: 1,
    argv: [
      "python3",
      "-c",
      "import time; time.sleep(2)",
    ],
  };

  const result = launchStdinRunnerSession(request);
  assert.equal(result.launch_error, "ETIMEDOUT");
  const meta = JSON.parse(fs.readFileSync(request.paths.session_meta_file, "utf8")) as Record<string, unknown>;
  assert.equal(meta.launch_error, "ETIMEDOUT");
});

test("launchStdinRunnerSession tolerates larger runner stderr transcripts without ENOBUFS", () => {
  const tempRoot = tempDir("bagakit-agent-runner-");
  const request = baseRequest(tempRoot);
  request.config = {
    ...request.config,
    argv: [
      "python3",
      "-c",
      "import sys; sys.stderr.write('x' * (2 * 1024 * 1024)); sys.stderr.flush()",
    ],
  };

  const result = launchStdinRunnerSession(request);
  assert.equal(result.launch_error, "");
  assert.equal(result.exit_code, 0);
  assert.ok(result.stderr.length >= 2 * 1024 * 1024);
});

test("launchStdinRunnerSession treats non-positive timeout as no host timeout", () => {
  const tempRoot = tempDir("bagakit-agent-runner-");
  const request = baseRequest(tempRoot);
  request.config = {
    ...request.config,
    timeout_seconds: 0,
    argv: [
      "python3",
      "-c",
      "import time; time.sleep(1.1)",
    ],
  };

  const result = launchStdinRunnerSession(request);
  assert.equal(result.launch_error, "");
  assert.equal(result.exit_code, 0);
});
