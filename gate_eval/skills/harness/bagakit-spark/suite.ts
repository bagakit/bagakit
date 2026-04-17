import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { EvalCaseResult, EvalSuiteDefinition } from "../../../../dev/eval/src/lib/model.ts";

function readRepoFile(repoRoot: string, rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

function assertIncludes(text: string, needle: string, label: string): void {
  assert.ok(text.includes(needle), `${label} should include ${needle}`);
}

export const SUITE: EvalSuiteDefinition = {
  id: "bagakit-spark-behavior-starter-eval",
  owner: "gate_eval/skills/harness/bagakit-spark",
  title: "Spark Behavior Starter Eval",
  summary: "Check deterministic review surfaces for accepted-snapshot closure, weak-question findings, research gaps, and next actions.",
  defaultOutputDir: "gate_eval/skills/harness/bagakit-spark/results/runs",
  cases: [
    {
      id: "review-packet-catches-premature-closure",
      title: "Review Packet Catches Premature Closure",
      summary: "Spark review packets should distinguish a premature summary from an accepted dialogue snapshot.",
      focus: ["premature-closure", "accepted-snapshot", "next-action"],
      run: (context): EvalCaseResult => {
        const templateRel = "skills/harness/bagakit-spark/references/review-packet-template.md";
        const contractRel = "skills/harness/bagakit-spark/references/workflow-contract.toml";
        const badFixtureRel = "gate_eval/skills/harness/bagakit-spark/fixtures/premature-closure.md";
        const goodFixtureRel = "gate_eval/skills/harness/bagakit-spark/fixtures/accepted-snapshot.md";
        const template = readRepoFile(context.repoRoot, templateRel);
        const contract = readRepoFile(context.repoRoot, contractRel);
        const badFixture = readRepoFile(context.repoRoot, badFixtureRel);
        const goodFixture = readRepoFile(context.repoRoot, goodFixtureRel);

        for (const field of ["premature closure evidence", "weak-question evidence", "research sufficiency judgment", "next_action"]) {
          assertIncludes(template, field, "spark review packet template");
        }
        assertIncludes(contract, "review-packet", "spark workflow contract");
        assertIncludes(contract, "references/review-packet-template.md", "spark workflow contract");
        assertIncludes(badFixture, "verdict: `fail`", "premature closure fixture");
        assertIncludes(badFixture, "missing accepted snapshot and next question", "premature closure fixture");
        assertIncludes(goodFixture, "verdict: `pass`", "accepted snapshot fixture");
        assertIncludes(goodFixture, "next_action", "accepted snapshot fixture");

        return {
          assertions: [
            "review packet template requires premature-closure evidence",
            "workflow contract exposes the review packet artifact",
            "fixtures distinguish failed premature closure from accepted snapshot closure",
          ],
          artifacts: [
            { label: "review-packet-template", path: templateRel },
            { label: "workflow-contract", path: contractRel },
            { label: "premature-closure-fixture", path: badFixtureRel },
            { label: "accepted-snapshot-fixture", path: goodFixtureRel },
          ],
          outputs: {
            required_review_fields: ["premature closure evidence", "weak-question evidence", "research sufficiency judgment", "next_action"],
          },
        };
      },
    },
  ],
};

export default SUITE;
