import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { SuiteConfig } from "../src/lib/model.ts";
import { runProcessSuite } from "../src/lib/runners.ts";

function tempRoot(): string {
  return mkdtempSync(path.join(os.tmpdir(), `bagakit-validator-process-${process.pid}-`));
}

function suite(repoRoot: string, script: string, timeoutSeconds: number): SuiteConfig {
  return {
    id: "process-group-timeout",
    owner: "test",
    description: "process group timeout",
    configPath: path.join(repoRoot, "validation.toml"),
    defaultInGate: true,
    validationClass: "smoke",
    protects: [],
    oracle: [],
    exercisedSurface: [],
    proves: [],
    doesNotProve: [],
    groups: [],
    params: {},
    defaultParams: [],
    timeoutSeconds,
    runner: {
      kind: "executable",
      command: "{node}",
      cwd: ".",
      args: [script],
    },
  };
}

const delayedMarkerScript = `
const { spawn } = require("node:child_process");
const marker = process.argv[2];
require("node:fs").writeFileSync(process.argv[3], "started");
spawn(process.execPath, ["-e", "setTimeout(() => require('node:fs').writeFileSync(process.argv[1], 'late'), 350)", marker], { stdio: "ignore" });
setTimeout(() => {}, 5000);
`;

test("timeout reaps delayed descendants in the process group", async () => {
  const root = tempRoot();
  const script = path.join(root, "delayed.cjs");
  const marker = path.join(root, "marker");
  const started = path.join(root, "started");
  writeFileSync(script, delayedMarkerScript, "utf8");
  try {
    const configured = suite(root, script, 0.2);
    if (configured.runner.kind !== "executable") {
      throw new Error("test fixture must use executable runner");
    }
    configured.runner.args.push(marker, started);
    assert.equal(runProcessSuite(configured, root), 1);
    assert.equal(existsSync(started), true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.equal(existsSync(marker), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a process that exits before its timeout remains successful", async () => {
  const root = tempRoot();
  const script = path.join(root, "quick.cjs");
  const marker = path.join(root, "marker");
  writeFileSync(
    script,
    `const { spawn } = require("node:child_process"); spawn(process.execPath, ["-e", "setTimeout(() => require('node:fs').writeFileSync(process.argv[1], 'ok'), 100)", ${JSON.stringify(marker)}], { stdio: "ignore" }); setTimeout(() => process.exit(0), 10);\n`,
    "utf8",
  );
  try {
    assert.equal(runProcessSuite(suite(root, script, 1), root), 0);
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal(existsSync(marker), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
