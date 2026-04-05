import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { EvalSuiteDefinition } from "../../../../dev/eval/src/lib/model.ts";

interface HistoricalFailureCase {
  id: string;
  source_refs: string[];
  failure: string;
  expected_blockers: string[];
  must_find: string[];
}

interface HistoricalFailureBench {
  schema: string;
  summary: string;
  cases: HistoricalFailureCase[];
}

const CASES_PATH = "gate_eval/skills/swe/bagakit-codex-webpage-design/cases/historical-failures.json";

function readText(repoRoot: string, relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readBench(repoRoot: string): HistoricalFailureBench {
  return JSON.parse(readText(repoRoot, CASES_PATH)) as HistoricalFailureBench;
}

function skillSurfaceText(repoRoot: string): string {
  const parts = [
    "skills/swe/bagakit-codex-webpage-design/SKILL.md",
    "skills/swe/bagakit-codex-webpage-design/references/image-prompt-guide.md",
    "skills/swe/bagakit-codex-webpage-design/references/implementation-loop.md",
    "skills/swe/bagakit-codex-webpage-design/references/visual-quality-rubric.md",
    "skills/swe/bagakit-codex-webpage-design/references/artifact-contract.md",
  ];
  return parts.map((relativePath) => readText(repoRoot, relativePath)).join("\n\n");
}

function normalize(text: string): string {
  return text.split(/\s+/).filter(Boolean).join(" ");
}

function assertIncludes(haystack: string, needle: string, label: string): void {
  assert.ok(
    normalize(haystack).includes(normalize(needle)),
    `missing ${label}: ${needle}`,
  );
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
      summary: "Every recorded historical failure should have explicit blocker phrases in the skill surface.",
      focus: ["historical failure bench", "visual-parity", "workflow-control", "canvas-stability"],
      run: (context) => {
        const bench = readBench(context.repoRoot);
        const surface = skillSurfaceText(context.repoRoot);

        assert.equal(
          bench.schema,
          "bagakit.codex-webpage-design.historical-failures/v1",
          "unexpected historical failure bench schema",
        );
        assert.ok(bench.cases.length >= 7, "historical failure bench should preserve the current failure set");

        for (const item of bench.cases) {
          assert.ok(item.id.trim(), "case id is required");
          assert.ok(item.failure.trim(), `case ${item.id} needs failure text`);
          assert.ok(item.source_refs.length > 0, `case ${item.id} needs source refs`);
          assert.ok(item.expected_blockers.length > 0, `case ${item.id} needs expected blockers`);
          assert.ok(item.must_find.length > 0, `case ${item.id} needs must_find anchors`);
          for (const sourceRef of item.source_refs) {
            assert.ok(
              fs.existsSync(path.join(context.repoRoot, sourceRef)),
              `case ${item.id} source ref missing: ${sourceRef}`,
            );
          }
          for (const phrase of item.must_find) {
            assertIncludes(surface, phrase, `${item.id} must_find`);
          }
        }

        return {
          assertions: [
            "historical failure bench data is present and schema-valid",
            "each bench case points to existing selector, Spark, or evolver evidence",
            "each bench case has blocker phrases covered by the skill surface",
          ],
          artifacts: [
            { label: "historical-failures", path: CASES_PATH },
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
        assertIncludes(skillText, "thin operating protocol", "thin protocol");
        assertIncludes(skillText, "Load only the relevant reference", "progressive disclosure");
        assertIncludes(skillText, "historical failures live in `gate_eval/`", "bench delegation");
        assertIncludes(skillText, "prefer adding or updating a bench case", "failure learning");

        return {
          assertions: [
            "main skill file remains below the thin-entry line budget",
            "main skill explicitly delegates details to references",
            "main skill explicitly routes repeated failures to gate_eval bench cases",
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
