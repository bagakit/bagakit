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

function runEvalCli(args: string[]): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(
    "node",
    ["--experimental-strip-types", "dev/eval/src/cli.ts", ...args],
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

  const datasetTemp = fs.mkdtempSync(path.join(os.tmpdir(), "bagakit-eval-dataset-"));
  try {
    const sourceDataset = path.join(datasetTemp, "source.json");
    const builtDataset = path.join(datasetTemp, "built.json");
    const holdoutDataset = path.join(datasetTemp, "holdout.json");
    const comparisonFile = path.join(datasetTemp, "comparison.json");
    fs.writeFileSync(
      sourceDataset,
      `${JSON.stringify(
        {
          schema: "bagakit.eval-dataset/v1",
          dataset_id: "demo-dataset",
          title: "Demo Dataset",
          description: "self-eval dataset fixture",
          item_schema: "bagakit.eval-row/v1",
          items: [
            {
              id: "row-1",
              skill_id: "bagakit-feature-tracker",
              prompt: "do one thing",
              expected_outcome: "done",
              reference_output: "done",
              allowed_tools: ["git"],
              expected_tools: ["git"],
              tags: ["core"],
              risk_tags: [],
              notes_for_human_review: "-",
              goal_dimensions: ["task_fidelity"],
              polarity: "should",
              success_evidence: ["the expected state is produced"],
              guard_ids: ["demo-success"],
              provenance: { source_class: "synthetic" },
              privacy: { class: "public", sanitized: true, raw_transcript_included: false },
              grader: {
                type: "state",
                rubric_id: "demo-state-v1",
                calibration_status: "not_required",
                transfer_limit: "demo only",
              },
              lifecycle: { stage: "capability" },
              trials: { count: 1, min_pass_rate: 1 },
            },
            {
              id: "row-2",
              skill_id: "bagakit-feature-tracker",
              prompt: "do risky thing",
              expected_outcome: "done",
              reference_output: "done",
              allowed_tools: ["git"],
              expected_tools: ["git"],
              tags: ["core"],
              risk_tags: ["high-risk"],
              notes_for_human_review: "-",
              goal_dimensions: ["risk_handling"],
              polarity: "should_not",
              success_evidence: ["the risky path is not silently accepted"],
              guard_ids: ["demo-risk"],
              provenance: { source_class: "synthetic" },
              privacy: { class: "public", sanitized: true, raw_transcript_included: false },
              grader: {
                type: "outcome",
                rubric_id: "demo-outcome-v1",
                calibration_status: "not_required",
                transfer_limit: "demo only",
              },
              lifecycle: { stage: "regression_candidate" },
              trials: { count: 2, min_pass_rate: 1 },
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    const buildRun = runEvalCli([
      "dataset-build",
      "--in",
      sourceDataset,
      "--out",
      builtDataset,
      "--holdout-tag",
      "high-risk",
      "--holdout-ratio",
      "0.0",
      "--seed",
      "stable",
    ]);
    assert.equal(buildRun.status, 0);
    const built = readJson(builtDataset) as Record<string, unknown>;
    assert.equal((built.build as Record<string, unknown>).holdout_ratio, 0);
    const items = built.items as Array<Record<string, unknown>>;
    assert.equal(items[0]?.split, "baseline");
    assert.equal(items[1]?.split, "holdout");

    const strictCheckRun = runEvalCli([
      "dataset-check",
      "--file",
      builtDataset,
      "--strict-goal-contract",
    ]);
    assert.equal(strictCheckRun.status, 0, strictCheckRun.stderr);
    assert.equal((JSON.parse(strictCheckRun.stdout) as { strict_goal_contract: boolean }).strict_goal_contract, true);

    const exportRun = runEvalCli([
      "dataset-export",
      "--file",
      builtDataset,
      "--split",
      "holdout",
      "--out",
      holdoutDataset,
    ]);
    assert.equal(exportRun.status, 0);
    const holdout = readJson(holdoutDataset) as Record<string, unknown>;
    assert.equal((holdout.items as Array<unknown>).length, 1);

    const reportRun = runEvalCli([
      "dataset-report",
      "--file",
      builtDataset,
    ]);
    assert.equal(reportRun.status, 0);
    const report = JSON.parse(reportRun.stdout) as Record<string, unknown>;
    assert.equal((report.totals as Record<string, unknown>).items, 2);
    assert.equal((report.polarities as Array<unknown>).length, 2);
    assert.equal((report.lifecycle_stages as Array<unknown>).length, 2);

    const baselineSummaryFile = path.join(datasetTemp, "baseline-summary.json");
    const candidateSummaryFile = path.join(datasetTemp, "candidate-summary.json");
    fs.writeFileSync(
      baselineSummaryFile,
      `${JSON.stringify(
        {
          schema: "bagakit.eval-run/v1",
          suiteId: "demo-suite",
          owner: "gate_eval/dev/eval",
          title: "demo",
          runId: "baseline-1",
          totals: { cases: 2, passedCases: 1, failedCases: 1, durationMs: 10 },
          focusIndex: {
            quality: { passed: 1, failed: 1, cases: ["a", "b"] },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    fs.writeFileSync(
      candidateSummaryFile,
      `${JSON.stringify(
        {
          schema: "bagakit.eval-run/v1",
          suiteId: "demo-suite",
          owner: "gate_eval/dev/eval",
          title: "demo",
          runId: "candidate-1",
          totals: { cases: 2, passedCases: 2, failedCases: 0, durationMs: 8 },
          focusIndex: {
            quality: { passed: 2, failed: 0, cases: ["a", "b"] },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    const compareRun = runEvalCli([
      "compare-runs",
      "--baseline",
      baselineSummaryFile,
      "--candidate",
      candidateSummaryFile,
      "--out",
      comparisonFile,
    ]);
    assert.equal(compareRun.status, 0);
    const comparison = readJson(comparisonFile) as Record<string, unknown>;
    assert.equal((comparison.delta as Record<string, unknown>).passedCases, 1);
  } finally {
    fs.rmSync(datasetTemp, { recursive: true, force: true });
  }

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
