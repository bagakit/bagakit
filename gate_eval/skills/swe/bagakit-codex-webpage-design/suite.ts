import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { EvalSuiteDefinition } from "../../../../dev/eval/src/lib/model.ts";

interface HistoricalFailureCase {
  id: string;
  source_refs: string[];
  failure: string;
  contract_guard_ids: string[];
}

interface HistoricalFailureBench {
  schema: string;
  summary: string;
  cases: HistoricalFailureCase[];
}

const CASES_PATH = "gate_eval/skills/swe/bagakit-codex-webpage-design/cases/historical-failures.json";
const CONTRACT_PATH = "skills/swe/bagakit-codex-webpage-design/references/workflow-contract.toml";

function readText(repoRoot: string, relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readBench(repoRoot: string): HistoricalFailureBench {
  return JSON.parse(readText(repoRoot, CASES_PATH)) as HistoricalFailureBench;
}

function contractIds(contractText: string, key = "id"): Set<string> {
  const pattern = new RegExp(`^${key} = "([^"]+)"`, "gm");
  return new Set(Array.from(contractText.matchAll(pattern), (match) => String(match[1])));
}

function contractCaseIds(contractText: string): Set<string> {
  return contractIds(contractText, "case_id");
}

export const SUITE: EvalSuiteDefinition = {
  id: "bagakit-codex-webpage-design-historical-failure-bench",
  owner: "gate_eval/skills/swe/bagakit-codex-webpage-design",
  title: "Codex Webpage Design Historical Failure Bench",
  summary: "Historical failure bench for reference-led webpage design, visual parity, behavior honesty, canvas stability, and workflow/control review.",
  defaultOutputDir: "gate_eval/skills/swe/bagakit-codex-webpage-design/results/runs",
  cases: [
    {
      id: "historical-failures-are-covered-by-skill-contract",
      title: "Historical Failures Are Covered By Skill Contract",
      summary: "Every recorded historical failure should map to structured workflow guard IDs instead of prose phrase anchors.",
      focus: ["historical failure bench", "visual-parity", "workflow-control", "canvas-stability"],
      run: (context) => {
        const bench = readBench(context.repoRoot);
        const contractText = readText(context.repoRoot, CONTRACT_PATH);
        const guardIds = contractIds(contractText);
        const mappedCaseIds = contractCaseIds(contractText);

        assert.equal(
          bench.schema,
          "bagakit.codex-webpage-design.historical-failures/v2",
          "unexpected historical failure bench schema",
        );
        assert.ok(bench.cases.length >= 7, "historical failure bench should preserve the current failure set");

        for (const item of bench.cases) {
          assert.ok(item.id.trim(), "case id is required");
          assert.ok(item.failure.trim(), `case ${item.id} needs failure text`);
          assert.ok(item.source_refs.length > 0, `case ${item.id} needs source refs`);
          assert.ok(item.contract_guard_ids.length > 0, `case ${item.id} needs contract guard ids`);
          assert.ok(mappedCaseIds.has(item.id), `case ${item.id} needs a contract mapping`);
          for (const sourceRef of item.source_refs) {
            assert.ok(
              fs.existsSync(path.join(context.repoRoot, sourceRef)),
              `case ${item.id} source ref missing: ${sourceRef}`,
            );
          }
          for (const guardId of item.contract_guard_ids) {
            assert.ok(guardIds.has(guardId), `case ${item.id} references unknown guard: ${guardId}`);
          }
          assert.equal(
            Object.hasOwn(item, "must_find"),
            false,
            `case ${item.id} should not use must_find phrase anchors`,
          );
        }

        return {
          assertions: [
            "historical failure bench data is present and schema-valid",
            "each bench case points to existing selector, Spark, or evolver evidence",
            "each bench case maps to structured workflow guards",
          ],
          artifacts: [
            { label: "historical-failures", path: CASES_PATH },
            { label: "workflow-contract", path: CONTRACT_PATH },
          ],
          outputs: {
            cases: bench.cases.map((item) => item.id),
          },
        };
      },
    },
    {
      id: "skill-entry-stays-thin-and-delegates-details",
      title: "Skill Entry Stays Thin And Delegates Details",
      summary: "The main SKILL.md should stay a concise protocol and route detailed rules to references and bench cases.",
      focus: ["progressive disclosure", "skill-maintainability"],
      run: (context) => {
        const skillPath = "skills/swe/bagakit-codex-webpage-design/SKILL.md";
        const skillText = readText(context.repoRoot, skillPath);
        const lineCount = skillText.split(/\r?\n/).length;

        assert.ok(lineCount <= 260, `SKILL.md should stay thin; found ${lineCount} lines`);
        assert.ok(skillText.includes("references/workflow-contract.toml"), "SKILL.md should link the structured contract");
        assert.ok(skillText.includes("gate_eval/"), "SKILL.md should point failures to the bench surface");

        return {
          assertions: [
            "main skill file remains below the thin-entry line budget",
            "main skill links the structured workflow contract",
            "main skill routes repeated failures to gate_eval bench cases",
          ],
          artifacts: [
            { label: "skill-entry", path: skillPath },
          ],
          outputs: {
            skill_lines: lineCount,
          },
        };
      },
    },
  ],
};
