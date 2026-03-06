import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const resultsRoot = path.join(repoRoot, "gate_eval", "dev", "eval", "results", "runs");

function rmIfExists(target: string): void {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
}

function assertNoTempLeak(value: unknown, label: string): void {
  const text = JSON.stringify(value);
  const tempRoots = [os.tmpdir(), `${path.sep}private${os.tmpdir()}`];
  for (const tempRoot of tempRoots) {
    if (tempRoot && text.includes(tempRoot)) {
      throw new Error(`${label} leaked machine-local temp path: ${tempRoot}`);
    }
  }
}

function runSuite(moduleRef: string, outDir: string): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(
    "node",
    [
      "--experimental-strip-types",
      "dev/eval/src/cli.ts",
      "run",
      "--root",
      repoRoot,
      "--suite",
      moduleRef,
      "--out",
      outDir,
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function main(): void {
  const passOut = "gate_eval/dev/eval/results/runs/self-eval-pass";
  const failOut = "gate_eval/dev/eval/results/runs/self-eval-fail";
  rmIfExists(path.join(resultsRoot, "self-eval-pass"));
  rmIfExists(path.join(resultsRoot, "self-eval-fail"));

  const passRun = runSuite("gate_eval/dev/eval/fixture_suite.ts", passOut);
  assert.equal(passRun.status, 0);
  const passSummary = readJson(path.join(repoRoot, passOut, "summary.json")) as Record<string, unknown>;
  const passCase = readJson(path.join(repoRoot, passOut, "cases", "sanitized-command-output.json")) as Record<string, unknown>;
  assert.equal(passSummary.schema, "bagakit.eval-run/v1");
  assert.equal(passCase.schema, "bagakit.eval-case/v1");
  assertNoTempLeak(passSummary, "pass summary");
  assertNoTempLeak(passCase, "pass case");

  const failRun = runSuite("gate_eval/dev/eval/failure_suite.ts", failOut);
  assert.equal(failRun.status, 1);
  const failSummary = readJson(path.join(repoRoot, failOut, "summary.json")) as Record<string, unknown>;
  const failCase = readJson(path.join(repoRoot, failOut, "cases", "sanitized-failure-error.json")) as Record<string, unknown>;
  assert.equal(failSummary.schema, "bagakit.eval-run/v1");
  assert.equal(failCase.schema, "bagakit.eval-case/v1");
  assert.equal(failCase.status, "fail");
  assert.equal(failCase.error, "intentional failure inside <temp-repo>");
  assertNoTempLeak(failSummary, "fail summary");
  assertNoTempLeak(failCase, "fail case");

  console.log(
    JSON.stringify(
      {
        status: "pass",
        pass_out: passOut,
        fail_out: failOut,
      },
      null,
      2,
    ),
  );
}

main();
