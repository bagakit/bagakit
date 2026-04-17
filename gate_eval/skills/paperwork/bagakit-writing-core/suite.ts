import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runCommand, type CommandResult } from "../../../../dev/eval/src/lib/command.ts";
import type { EvalCaseContext, EvalCaseResult, EvalSuiteDefinition } from "../../../../dev/eval/src/lib/model.ts";
import { cleanupTempDir, createTempDir, registerTempRepo } from "../../../../dev/eval/src/lib/temp.ts";

function expectOk(result: CommandResult, label: string): void {
  assert.equal(result.status, 0, `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

function withFixture(context: EvalCaseContext): { tempRepo: string; replacements: Array<{ from: string; to: string }> } {
  const tempRepo = createTempDir("bagakit-writing-core-eval-");
  return {
    tempRepo,
    replacements: registerTempRepo(context, tempRepo),
  };
}

export const SUITE: EvalSuiteDefinition = {
  id: "bagakit-writing-core-behavior-starter-eval",
  owner: "gate_eval/skills/paperwork/bagakit-writing-core",
  title: "Bagakit Writing Core Behavior Starter Eval",
  summary: "Check that route, lint, review, and anti-rationalization surfaces are reachable through the writing-core CLI.",
  defaultOutputDir: "gate_eval/skills/paperwork/bagakit-writing-core/results/runs",
  cases: [
    {
      id: "core-route-lint-review-surfaces-are-reachable",
      title: "Core Route Lint Review Surfaces Are Reachable",
      summary: "The public CLI should expose route/foundation checks, lint JSON, review packet, and anti-rationalization discipline.",
      focus: ["route", "lint", "review-packet", "anti-rationalization"],
      run: (context): EvalCaseResult => {
        const fixture = withFixture(context);
        const cliRel = "skills/paperwork/bagakit-writing-core/scripts/bagakit-writing-core-cli.sh";
        const cli = path.join(context.repoRoot, cliRel);
        try {
          const routePath = path.join(fixture.tempRepo, "route.md");
          fs.writeFileSync(
            routePath,
            [
              "# Route",
              "",
              "- title_promise: A title must make a judgment.",
              "- first_question: What should the reader decide first?",
              "- evidence_movement: Start from claim, then evidence.",
              "- chapter_movement: Move from problem to mechanism to action.",
              "- exit_move: Decide the next writing action.",
              "",
            ].join("\n"),
          );
          const draftPath = path.join(fixture.tempRepo, "draft.md");
          fs.writeFileSync(
            draftPath,
            [
              "# Title With A Claim",
              "",
              "## First Claim",
              "",
              "本文将通过多个步骤从而进而说明这个问题。",
              "",
              "- one",
              "- two",
              "- three",
              "- four",
              "",
              "## Second Claim",
              "",
              "The next action is check.",
              "",
              "## Third Claim",
              "",
              "Goal, status, next step.",
              "",
            ].join("\n"),
          );

          const route = runCommand("bash", [cli, "route", "check-foundation", routePath], {
            cwd: context.repoRoot,
            replacements: fixture.replacements,
          });
          expectOk(route, "route check");
          const routeJson = JSON.parse(route.stdout);
          assert.equal(routeJson.stable, true, "route fixture should be stable");

          const lint = runCommand("bash", [cli, "lint", "--fail-on", "none", draftPath], {
            cwd: context.repoRoot,
            replacements: fixture.replacements,
          });
          expectOk(lint, "lint");
          const lintJson = JSON.parse(lint.stdout);
          const codes = new Set((lintJson.findings ?? []).map((item: { code?: string }) => item.code));
          assert.ok(codes.has("AI_PATTERNS") || codes.has("LIST_BLOCK_CLUSTER"), "lint should expose at least one writing signal");
          assert.ok(lintJson.proseMechanics, "lint should expose proseMechanics metrics");

          const deAiTone = runCommand("bash", [cli, "de-ai-tone", "lint", "--profile", "blog", "--fail-on", "none", draftPath], {
            cwd: context.repoRoot,
            replacements: fixture.replacements,
          });
          expectOk(deAiTone, "de-AI-tone dispatch");
          const deAiToneJson = JSON.parse(deAiTone.stdout);
          assert.equal(deAiToneJson.schema, "bagakit.de_ai_tone_lint.v1", "core should dispatch to de-AI-tone lint schema");

          const review = runCommand("bash", [cli, "print-review-packet-template"], {
            cwd: context.repoRoot,
            replacements: fixture.replacements,
          });
          expectOk(review, "review packet template");
          assert.ok(review.stdout.includes("skill: `bagakit-writing-core`"));
          assert.ok(review.stdout.includes("counterevidence"));

          const anti = runCommand("bash", [cli, "print-anti-rationalization-table"], {
            cwd: context.repoRoot,
            replacements: fixture.replacements,
          });
          expectOk(anti, "anti-rationalization table");
          assert.ok(anti.stdout.includes("The model knows the tool or API"));
          assert.ok(anti.stdout.includes("accepted deviation"));

          return {
            assertions: [
              "route check marks a complete route memo stable",
              "lint emits structured writing signals and prose mechanics",
              "de-AI-tone primitive is reachable through writing-core",
              "review packet exposes the generic writing-core skill id",
              "anti-rationalization table is reachable through the public CLI",
            ],
            commands: [
              `bash ${cliRel} route check-foundation <temp-repo>/route.md`,
              `bash ${cliRel} lint --fail-on none <temp-repo>/draft.md`,
              `bash ${cliRel} de-ai-tone lint --profile blog --fail-on none <temp-repo>/draft.md`,
              `bash ${cliRel} print-review-packet-template`,
              `bash ${cliRel} print-anti-rationalization-table`,
            ],
            artifacts: [
              { label: "route-fixture", path: routePath },
              { label: "draft-fixture", path: draftPath },
              { label: "writing-core-cli", path: cliRel },
            ],
            outputs: {
              route_stable: routeJson.stable,
              lint_codes: Array.from(codes).sort(),
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
