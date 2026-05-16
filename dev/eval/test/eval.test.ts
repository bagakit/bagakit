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
  type EvalDatasetFile,
  type EvalDatasetItem,
} from "../src/lib/dataset.ts";
import { ensureCleanOutputDir, sanitizeUnknown } from "../src/lib/io.ts";

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bagakit-eval-test-"));
}

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

test("goal-case contracts reject raw transcripts after accepting a complete case", () => {
  const valid = dataset([goalCase()]);
  assert.doesNotThrow(() => validateGoalCaseContracts(valid));

  const unsafe = dataset([
    goalCase({ privacy: { class: "private_local", sanitized: false, raw_transcript_included: true } }),
  ]);
  assert.throws(() => validateGoalCaseContracts(unsafe), new RegExp("must not include raw private transcripts"));
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
      focusIndex: { safety: { passed: 0, failed: 1, cases: ["a"] } },
    }), "utf8");
    fs.writeFileSync(candidatePath, JSON.stringify({
      schema: "bagakit.eval-run/v1",
      suiteId: "demo",
      owner: "dev/eval",
      title: "Demo",
      runId: "candidate",
      totals: { cases: 2, passedCases: 2, failedCases: 0, durationMs: 9 },
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
