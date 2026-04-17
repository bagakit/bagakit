import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runCommand, type CommandResult } from "../../../../dev/eval/src/lib/command.ts";
import type { EvalCaseContext, EvalCaseResult, EvalSuiteDefinition } from "../../../../dev/eval/src/lib/model.ts";
import { cleanupTempDir, createTempDir, registerTempRepo } from "../../../../dev/eval/src/lib/temp.ts";

function expectFailed(result: CommandResult, label: string, needle: string): void {
  assert.notEqual(result.status, 0, `${label} should fail`);
  const combined = `${result.stdout}\n${result.stderr}`;
  assert.ok(combined.includes(needle), `${label} should mention ${needle}\n${combined}`);
}

function withFixture(context: EvalCaseContext): { tempRepo: string; replacements: Array<{ from: string; to: string }> } {
  const tempRepo = createTempDir("bagakit-topdown-eval-");
  return {
    tempRepo,
    replacements: registerTempRepo(context, tempRepo),
  };
}

function readRepoFile(repoRoot: string, rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

export const SUITE: EvalSuiteDefinition = {
  id: "topdown-image2-sprite-pipeline-behavior-starter-eval",
  owner: "gate_eval/skills/gamemaker/topdown-image2-sprite-pipeline",
  title: "Topdown Image2 Sprite Pipeline Behavior Starter Eval",
  summary: "Check review-handoff behavior for package completeness, reviewer ownership, provenance, and accepted deviations.",
  defaultOutputDir: "gate_eval/skills/gamemaker/topdown-image2-sprite-pipeline/results/runs",
  cases: [
    {
      id: "handoff-review-rejects-incomplete-package",
      title: "Handoff Review Rejects Incomplete Package",
      summary: "The CLI handoff check should fail an empty package and the review packet should split provenance and visual ownership.",
      focus: ["handoff-completeness", "provenance-review", "visual-review"],
      run: (context): EvalCaseResult => {
        const fixture = withFixture(context);
        const cliRel = "skills/gamemaker/topdown-image2-sprite-pipeline/scripts/topdown-image2-sprite-pipeline-cli.sh";
        const templateRel = "skills/gamemaker/topdown-image2-sprite-pipeline/references/review-packet-template.md";
        const checklistRel = "skills/gamemaker/topdown-image2-sprite-pipeline/references/review-checklist.md";
        try {
          const cli = path.join(context.repoRoot, cliRel);
          const handoff = runCommand("sh", [cli, "check-handoff", "--root", fixture.tempRepo], {
            cwd: context.repoRoot,
            replacements: fixture.replacements,
          });
          expectFailed(handoff, "check-handoff", "missing handoff artifact");

          const template = readRepoFile(context.repoRoot, templateRel);
          const checklist = readRepoFile(context.repoRoot, checklistRel);
          for (const needle of ["provenance reviewer", "visual reviewer", "accepted_deviations", "counterevidence"]) {
            assert.ok(template.includes(needle), `review packet template should include ${needle}`);
          }
          for (const needle of ["review-disposition.md", "preview-contact-sheet.png", "independent-image2-validation-report.json"]) {
            assert.ok(checklist.includes(needle), `review checklist should include ${needle}`);
          }

          return {
            assertions: [
              "empty package is rejected by the public check-handoff command",
              "review packet separates provenance and visual reviewer ownership",
              "review checklist names independent validation and disposition artifacts",
            ],
            commands: [`sh ${cliRel} check-handoff --root <temp-repo>`],
            artifacts: [
              { label: "review-packet-template", path: templateRel },
              { label: "review-checklist", path: checklistRel },
            ],
            outputs: {
              handoff_status: handoff.status,
              stderr_sample: handoff.stderr.split("\n").filter(Boolean).slice(0, 3),
            },
            replacements: fixture.replacements,
          };
        } finally {
          cleanupTempDir(fixture.tempRepo, context.keepTemp);
        }
      },
    },
  ],
};

export default SUITE;
