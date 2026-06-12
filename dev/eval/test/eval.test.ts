import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { compareRunSummaries } from "../src/lib/compare.ts";
import {
  EVAL_DATASET_SCHEMA,
  buildEvalDataset,
  reportEvalDataset,
  validateGoalCaseContracts,
  exportEvalDatasetSplit,
  type EvalDatasetFile,
  type EvalDatasetItem,
} from "../src/lib/dataset.ts";
import { ensureCleanOutputDir, ensureWithinRoot, sanitizeUnknown } from "../src/lib/io.ts";
import { runSuite } from "../src/lib/run.ts";
import { validateEvalSuite } from "../src/lib/model.ts";
import { runCommand } from "../src/lib/command.ts";

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bagakit-eval-test-"));
}

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");

function dataset(items: EvalDatasetItem[]): EvalDatasetFile {
  return {
    schema: EVAL_DATASET_SCHEMA,
    dataset_id: "demo-dataset",
    title: "Demo dataset",
    description: "Deterministic eval fixture",
    item_schema: "demo/v1",
    items,
  };
}

function goalCase(overrides: Partial<EvalDatasetItem> = {}): EvalDatasetItem {
  return {
    id: "case-1",
    skill_id: "demo-skill",
    prompt: "Run the demo case",
    expected_outcome: "The demo outcome is observable",
    notes_for_human_review: "No manual review needed",
    goal_dimensions: ["correctness"],
    polarity: "should",
    success_evidence: ["state matches"],
    guard_ids: ["guard-demo"],
    provenance: { source_class: "synthetic" },
    privacy: { class: "public", sanitized: true, raw_transcript_included: false },
    grader: {
      type: "state",
      rubric_id: "state-demo",
      calibration_status: "not_required",
      transfer_limit: "Only proves the deterministic fixture",
    },
    lifecycle: { stage: "capability" },
    trials: { count: 1, min_pass_rate: 1 },
    ...overrides,
  };
}

test("sanitization applies longest replacements throughout nested output", () => {
  const payload = {
    path: "/private/work/repo/output",
    nested: ["/private/work", { root: "/private/work/repo" }],
  };
  assert.deepEqual(
    sanitizeUnknown(payload, [
      { from: "/private/work", to: "<work>" },
      { from: "/private/work/repo", to: "<repo>" },
    ]),
    {
      path: "<repo>/output",
      nested: ["<work>", { root: "<repo>" }],
    },
  );
});

test("output directories fail closed when prior eval artifacts exist", () => {
  const root = tempDir();
  try {
    const outputDir = path.join(root, "results");
    ensureCleanOutputDir(outputDir);
    fs.writeFileSync(path.join(outputDir, "summary.json"), "{}\n", "utf8");
    assert.throws(() => ensureCleanOutputDir(outputDir), new RegExp("refusing to write eval results into a non-empty directory"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("dataset building preserves explicit splits and routes tagged holdouts deterministically", () => {
  const built = buildEvalDataset(
    dataset([
      goalCase({ id: "fixed", split: "baseline" }),
      goalCase({ id: "tagged", tags: ["holdout"] }),
      goalCase({ id: "hashed" }),
    ]),
    {
      baselineSplit: "baseline",
      holdoutSplit: "holdout",
      holdoutRatio: 0,
      holdoutTags: ["holdout"],
      seed: "stable-seed",
    },
  );

  assert.deepEqual(built.items.map((item) => [item.id, item.split]), [
    ["fixed", "baseline"],
    ["tagged", "holdout"],
    ["hashed", "baseline"],
  ]);
  assert.deepEqual(reportEvalDataset(built).splits, [
    { split: "baseline", count: 2 },
    { split: "holdout", count: 1 },
  ]);
});

test("dataset export rejects unknown splits and output paths stay in the repository", () => {
  assert.throws(() => exportEvalDatasetSplit(dataset([goalCase({ split: "baseline" })]), "missing"), /unknown dataset split/);
  const emptyConfigured = buildEvalDataset(dataset([goalCase({ id: "only-baseline" })]), {
    baselineSplit: "baseline",
    holdoutSplit: "holdout",
    holdoutRatio: 0,
    holdoutTags: [],
    seed: "stable",
  });
  assert.equal(exportEvalDatasetSplit(emptyConfigured, "holdout").items.length, 0);
  const root = tempDir();
  try {
    assert.equal(ensureWithinRoot(root, path.join(root, "results")), path.resolve(root, "results"));
    assert.throws(() => ensureWithinRoot(root, path.join(root, "..", "outside")), /must stay within repository root/);
    const outside = tempDir();
    const link = path.join(root, "linked");
    try {
      fs.symlinkSync(outside, link, "dir");
      assert.throws(() => ensureWithinRoot(root, path.join(link, "results")), /must stay within repository root/);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
      fs.rmSync(link, { recursive: true, force: true });
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("public file-output commands reject traversal and symlink escapes", () => {
  const root = tempDir(), outside = tempDir();
  try {
    fs.writeFileSync(path.join(root, "dataset.json"), JSON.stringify(dataset([goalCase({ split: "baseline" })])));
    const summary = {schema:"bagakit.eval-run/v1", suiteId:"demo", runId:"one", totals:{cases:1,passedCases:1,failedCases:0}, cases:[{id:"a",status:"pass"}]};
    fs.writeFileSync(path.join(root, "summary.json"), JSON.stringify(summary));
    fs.symlinkSync(outside, path.join(root, "escape"), "dir");
    for (const args of [
      ["dataset-build", "--in", "dataset.json"],
      ["dataset-export", "--file", "dataset.json", "--split", "baseline"],
      ["compare-runs", "--baseline", "summary.json", "--candidate", "summary.json"],
    ]) {
      for (const output of [path.relative(root, path.join(outside,"out.json")), "escape/out.json"]) {
        const result = runCommand(process.execPath, ["--experimental-strip-types", path.join(repoRoot,"dev/eval/src/cli.ts"), ...args, "--out", output], {cwd:root});
        assert.equal(result.status, 1, result.stdout + result.stderr);
        assert.match(result.stderr, /must stay within repository root/);
        assert.equal(fs.existsSync(path.join(outside,"out.json")), false);
      }
      const result = runCommand(process.execPath, ["--experimental-strip-types", path.join(repoRoot,"dev/eval/src/cli.ts"), ...args, "--out", "out.json"], {cwd:root});
      assert.equal(result.status, 0, result.stderr);
      assert.ok(fs.existsSync(path.join(root,"out.json")));
    }
    for (const bad of [{...summary, cases:undefined}, {...summary,cases:[]}, {...summary,cases:[{id:"a",status:"fail"}]}]) {
      fs.writeFileSync(path.join(root,"bad.json"),JSON.stringify(bad));
      const result = runCommand(process.execPath,["--experimental-strip-types",path.join(repoRoot,"dev/eval/src/cli.ts"),"compare-runs","--baseline","summary.json","--candidate","bad.json"],{cwd:root});
      assert.equal(result.status,1,result.stdout + result.stderr);
      assert.match(result.stderr,/cases/);
    }
  } finally {
    fs.rmSync(root,{recursive:true,force:true});
    fs.rmSync(outside,{recursive:true,force:true});
  }
});

test("suite loading validation rejects duplicate cases and case timeout records a failure", async () => {
  assert.throws(() => validateEvalSuite({ id: "x", owner: "x", title: "x", summary: "x", defaultOutputDir: "results", cases: [
    { id: "same", title: "a", summary: "a", focus: [], run: () => ({}) },
    { id: "same", title: "b", summary: "b", focus: [], run: () => ({}) },
  ] }), /duplicate id/);
  const root = tempDir();
  try {
    const exit = await runSuite({ id: "timeout", owner: "test", title: "Timeout", summary: "", defaultOutputDir: "results", caseTimeoutMs: 5,
      cases: [{ id: "slow", title: "slow", summary: "slow", focus: ["timeout"], run: async ({ signal }) => {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 30);
          signal.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("aborted")); }, { once: true });
        });
        return {};
      } }],
    }, { repoRoot: root, selectedCaseIds: [], keepTemp: false, commandSummary: "test" });
    assert.equal(exit, 1);
    const runDir = fs.readdirSync(path.join(root, "results"))[0];
    const report = JSON.parse(fs.readFileSync(path.join(root, "results", runDir, "cases", "slow.json"), "utf8"));
    assert.match(report.error, /timed out/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("goal-case contracts reject raw transcripts after accepting a complete case", () => {
  const valid = dataset([goalCase()]);
  assert.doesNotThrow(() => validateGoalCaseContracts(valid));

  const unsafe = dataset([
    goalCase({ privacy: { class: "private_local", sanitized: false, raw_transcript_included: true } }),
  ]);
  assert.throws(() => validateGoalCaseContracts(unsafe), new RegExp("must not include raw private transcripts"));
});

test("runner records declared trials as not executed", async () => {
  const root = tempDir();
  try {
    const exit = await runSuite({
      id: "trial-demo",
      owner: "test",
      title: "Trial Demo",
      summary: "Records declared trial requests",
      defaultOutputDir: "results",
      cases: [{
        id: "declares-trials",
        title: "declares trials",
        summary: "case declares repeated trial intent",
        focus: ["reliability"],
        run: () => ({ outputs: { trials: { count: 3, min_pass_rate: 0.67, reliability_metric: "case_pass_rate" } } }),
      }],
    }, { repoRoot: root, selectedCaseIds: [], keepTemp: false, commandSummary: "test" });
    assert.equal(exit, 0);
    const runDir = fs.readdirSync(path.join(root, "results"))[0];
    const summary = JSON.parse(fs.readFileSync(path.join(root, "results", runDir, "summary.json"), "utf8"));
    const report = JSON.parse(fs.readFileSync(path.join(root, "results", runDir, "cases", "declares-trials.json"), "utf8"));
    assert.equal(report.trialExecution.status, "declared_not_executed");
    assert.equal(report.trialExecution.executedTrials, 1);
    assert.equal(report.trialExecution.requestedTrials, 3);
    assert.equal(summary.trialExecution.casesWithTrialRequests, 1);
    assert.equal(summary.trialExecution.executedRepeatedTrials, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runCommand kills a timed out child process", () => {
  const result = runCommand(process.execPath, ["-e", "setTimeout(() => {}, 1000)"], {
    cwd: repoRoot,
    timeoutMs: 10,
  });
  assert.equal(result.timedOut, true);
  assert.notEqual(result.status, 0);
});

test("eval only fails fast through the explicit eval-fast entrypoint", () => {
  const gate = fs.readFileSync(path.join(repoRoot, "scripts/gate.sh"), "utf8");
  const evalBlock = gate.match(/\n  eval\)[\s\S]*?\n    ;;/)?.[0] ?? "";
  const evalFastBlock = gate.match(/\n  eval-fast\)[\s\S]*?\n    ;;/)?.[0] ?? "";
  assert.ok(evalBlock);
  assert.ok(evalFastBlock);
  assert.doesNotMatch(evalBlock, /--fail-fast/);
  assert.match(evalFastBlock, /--fail-fast/);
});

test("run comparison reports aggregate and focus deltas", () => {
  const root = tempDir();
  try {
    const baselinePath = path.join(root, "baseline.json");
    const candidatePath = path.join(root, "candidate.json");
    fs.writeFileSync(baselinePath, JSON.stringify({
      schema: "bagakit.eval-run/v1",
      suiteId: "demo",
      owner: "dev/eval",
      title: "Demo",
      runId: "baseline",
      totals: { cases: 2, passedCases: 1, failedCases: 1, durationMs: 10 },
      cases: [{ id: "a", status: "fail" }, { id: "b", status: "pass" }],
      focusIndex: { safety: { passed: 0, failed: 1, cases: ["a"] } },
    }), "utf8");
    fs.writeFileSync(candidatePath, JSON.stringify({
      schema: "bagakit.eval-run/v1",
      suiteId: "demo",
      owner: "dev/eval",
      title: "Demo",
      runId: "candidate",
      totals: { cases: 2, passedCases: 2, failedCases: 0, durationMs: 9 },
      cases: [{ id: "a", status: "pass" }, { id: "b", status: "pass" }],
      focusIndex: { safety: { passed: 1, failed: 0, cases: ["a"] } },
    }), "utf8");

    const comparison = compareRunSummaries(baselinePath, candidatePath);
    assert.deepEqual(comparison.delta, { passedCases: 1, failedCases: -1 });
    assert.deepEqual(comparison.focusDelta.safety, {
      baselinePassed: 0,
      candidatePassed: 1,
      deltaPassed: 1,
      baselineFailed: 1,
      candidateFailed: 0,
      deltaFailed: -1,
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("run comparison rejects malformed and mismatched summaries", () => {
  const root = tempDir();
  try {
    const bad = path.join(root, "bad.json");
    const good = path.join(root, "good.json");
    fs.writeFileSync(bad, JSON.stringify({ schema: "bagakit.eval-run/v1", suiteId: "x", runId: "b", totals: { cases: 2, passedCases: 2, failedCases: 1 }, cases: [{ id: "a", status: "pass" }, { id: "b", status: "fail" }] }));
    fs.writeFileSync(good, JSON.stringify({ schema: "bagakit.eval-run/v1", suiteId: "y", runId: "c", totals: { cases: 1, passedCases: 1, failedCases: 0 }, cases: [{ id: "a", status: "pass" }] }));
    assert.throws(() => compareRunSummaries(bad, good), /cases must equal/);
    fs.writeFileSync(bad, JSON.stringify({ schema: "bagakit.eval-run/v1", suiteId: "x", runId: "b", totals: { cases: 1, passedCases: 1, failedCases: 0 }, cases: [{ id: "a", status: "pass" }] }));
    assert.throws(() => compareRunSummaries(bad, good), /suites differ/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("run comparison validates focus indexes and case universes", () => {
  const root = tempDir();
  try {
    const baseline = path.join(root, "baseline.json");
    const candidate = path.join(root, "candidate.json");
    const summary = (suiteId: string, focusIndex: unknown, cases = [{ id: "a", status: "pass" }, { id: "b", status: "fail" }]) => ({
      schema: "bagakit.eval-run/v1", suiteId, runId: suiteId, totals: { cases: 2, passedCases: 1, failedCases: 1, durationMs: 1 }, focusIndex, cases,
    });
    fs.writeFileSync(baseline, JSON.stringify(summary("demo", { quality: { passed: 1, failed: 0, cases: ["a", "a"] } })));
    fs.writeFileSync(candidate, JSON.stringify(summary("demo", { quality: { passed: 1, failed: 0, cases: ["a"] } })));
    assert.throws(() => compareRunSummaries(baseline, candidate), /unique IDs/);
    fs.writeFileSync(baseline, JSON.stringify(summary("demo", { quality: { passed: 1, failed: 0, cases: ["a"] } })));
    fs.writeFileSync(candidate, JSON.stringify(summary("demo", { quality: { passed: 1, failed: 0, cases: ["a"] } }, [{ id: "a", status: "pass" }, { id: "c", status: "fail" }])));
    assert.throws(() => compareRunSummaries(baseline, candidate), /case universes differ/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
