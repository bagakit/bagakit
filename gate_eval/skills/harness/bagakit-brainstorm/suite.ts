import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runCommand, type CommandResult } from "../../../../dev/eval/src/lib/command.ts";
import type { EvalSuiteDefinition } from "../../../../dev/eval/src/lib/model.ts";
import { cleanupTempDir, createTempDir, registerTempRepo } from "../../../../dev/eval/src/lib/temp.ts";

function expectOk(result: CommandResult, label: string): void {
  assert.equal(result.status, 0, `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

function extractCreatedDir(output: string): string {
  const line = output.split("\n").find((entry) => entry.startsWith("created="));
  assert.ok(line, `missing created= line in init output\n${output}`);
  return line.slice("created=".length);
}

export const SUITE: EvalSuiteDefinition = {
  id: "bagakit-brainstorm-shared-runner-eval",
  owner: "gate_eval/skills/harness/bagakit-brainstorm",
  title: "Brainstorm Shared Runner Eval",
  summary: "Measure deterministic init-time review-surface and status-reporting quality for bagakit-brainstorm.",
  defaultOutputDir: "gate_eval/skills/harness/bagakit-brainstorm/results/runs",
  cases: [
    {
      id: "init-status-surfaces-review-artifacts",
      title: "Init Status Surfaces Review Artifacts",
      summary: "Init with review-quality and eval-effect review should create those files and expose them in status output.",
      focus: ["artifact-readiness", "status-reporting"],
      run: (context) => {
        const { repoRoot } = context;
        const tempRepo = createTempDir("bagakit-brainstorm-eval-");
        const replacements = registerTempRepo(context, tempRepo);
        const script = path.join(repoRoot, "skills", "harness", "bagakit-brainstorm", "scripts", "bagakit-brainstorm.py");
        try {
          const initResult = runCommand("python3", [script, "init", "--topic", "Eval topic", "--slug", "eval-topic", "--root", tempRepo, "--with-review-quality", "--with-eval-effect-review"], { cwd: repoRoot });
          expectOk(initResult, "init");
          const artifactDir = extractCreatedDir(initResult.stdout);
          const statusResult = runCommand("python3", [script, "status", "--root", tempRepo, "--dir", artifactDir], { cwd: repoRoot, replacements });
          expectOk(statusResult, "status");

          const expectedFiles = [
            "input_and_qa.md",
            "finding_and_analyze.md",
            "expert_forum.md",
            "outcome_and_handoff.md",
            "review_quality.md",
            "eval_effect_review.md",
          ];
          for (const fileName of expectedFiles) {
            assert.ok(fs.existsSync(path.join(artifactDir, fileName)), `missing ${fileName}`);
          }
          assert.ok(statusResult.stdout.split("\n").includes("stage_review_quality=pending"));
          assert.ok(statusResult.stdout.split("\n").includes("stage_eval_effect_review=pending"));
          assert.ok(statusResult.stdout.split("\n").includes("archive_status=missing"));

          return {
            assertions: [
              "init creates the optional review_quality and eval_effect_review artifacts when explicitly requested",
              "status output surfaces those optional stages separately from the required analysis stages",
              "archive status stays missing until the run is explicitly archived",
            ],
            commands: [
              `python3 ${script} init --topic "Eval topic" --slug "eval-topic" --root <temp-repo> --with-review-quality --with-eval-effect-review`,
              `python3 ${script} status --root <temp-repo> --dir <temp-repo>/.bagakit/brainstorm/runs/<artifact>`,
            ],
            artifacts: expectedFiles.map((fileName) => ({
              label: fileName.replace(".md", ""),
              path: path.join(artifactDir, fileName),
            })),
            outputs: {
              artifact_dir: artifactDir,
            },
            replacements,
          };
        } finally {
          cleanupTempDir(tempRepo, context.keepTemp);
        }
      },
    },
  ],
};
