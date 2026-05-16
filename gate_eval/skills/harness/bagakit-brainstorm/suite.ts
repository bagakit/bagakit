import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runCommand, type CommandResult } from "../../../../dev/eval/src/lib/command.ts";
import { evaluateGoalCasePilot } from "../../../../dev/eval/src/lib/goal_cases.ts";
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
      summary: "Init with review-quality and eval-effect review should create those files, including the raw discussion log, and expose them in status output.",
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
            "raw_discussion_log.md",
            "finding_and_analyze.md",
            "expert_forum.md",
            "outcome_and_handoff.md",
            "review_quality.md",
            "eval_effect_review.md",
          ];
          for (const fileName of expectedFiles) {
            assert.ok(fs.existsSync(path.join(artifactDir, fileName)), `missing ${fileName}`);
          }
          assert.ok(statusResult.stdout.split("\n").includes("support_raw_discussion_log=in_progress"));
          assert.ok(statusResult.stdout.split("\n").includes("raw_discussion_log_gate=fail"));
          assert.ok(statusResult.stdout.split("\n").includes("stage_review_quality=pending"));
          assert.ok(statusResult.stdout.split("\n").includes("stage_eval_effect_review=pending"));
          assert.ok(statusResult.stdout.split("\n").includes("archive_status=missing"));

          return {
            assertions: [
              "init creates the optional review_quality and eval_effect_review artifacts when explicitly requested",
              "init also creates the default raw_discussion_log support artifact for append-only discussion capture",
              "status output surfaces those optional stages separately from the required analysis stages",
              "status output exposes raw_discussion_log gate state independently from analysis-stage state",
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
    {
      id: "lifecycle-regression-signals",
      title: "Lifecycle Regression Signals",
      summary: "Run the lifecycle validation harness and surface regression signals for archive placement, adapter escapes, and incomplete export failures.",
      focus: ["archive-completion-gate", "adapter-boundary", "export-error-cleanliness"],
      run: (context) => {
        const { repoRoot } = context;
        const validationScript = path.join(repoRoot, "gate_validation", "skills", "harness", "bagakit-brainstorm", "check-bagakit-brainstorm.sh");
        const result = runCommand("bash", [validationScript, "--root", repoRoot], { cwd: repoRoot });
        expectOk(result, "lifecycle validation");
        assert.ok(result.stdout.split("\n").includes("ok: bagakit-brainstorm lifecycle smoke passed"));
        assert.equal(result.stderr.includes("Traceback"), false, `validation emitted traceback\nstderr:\n${result.stderr}`);

        const stdoutLines = result.stdout.split("\n").filter((line) => line.length > 0).length;
        const stderrLines = result.stderr.split("\n").filter((line) => line.length > 0).length;

        return {
          assertions: [
            "valid local archive completion remains accepted by check-complete",
            "forged complete archive placement is rejected unless archived_artifact is under the archive root",
            "adapter absolute and parent-traversal rendered paths are blocked without writing external files",
            "incomplete export fails with error lines and no Python traceback",
          ],
          commands: [
            "bash gate_validation/skills/harness/bagakit-brainstorm/check-bagakit-brainstorm.sh --root <repo-root>",
          ],
          outputs: {
            validation_status: result.status,
            stdout_line_count: stdoutLines,
            stderr_line_count: stderrLines,
            emitted_traceback: result.stderr.includes("Traceback"),
          },
        };
      },
    },
    {
      id: "serious-moment-goal-case-pilot",
      title: "Serious-Moment Goal Case Pilot",
      summary: "Compare lifecycle-oriented baseline coverage with clarification, principle, expert-frame, correction, and approval cases.",
      focus: ["skill-goal", "serious-moment", "baseline-candidate", "privacy", "negative-case"],
      run: (context) => {
        const datasetRel = "gate_eval/skills/harness/bagakit-brainstorm/cases/serious-moments.json";
        const contractRel = "skills/harness/bagakit-brainstorm/references/decision-quality-contract.toml";
        const result = evaluateGoalCasePilot({
          repoRoot: context.repoRoot,
          datasetRel,
          contractRel,
          baselineGuardIds: ["clarify-before-option-generation", "no-unapproved-handoff"],
        });
        assert.equal(result.candidate.coverage, 1);
        assert.ok(result.deltaCoverage > 0);
        assert.ok(result.shouldCases > 0 && result.shouldNotCases > 0);
        return {
          assertions: [
            "all sanitized Brainstorm cases map to structured behavior guards",
            "the candidate guard map adds principle, expert-frame, and correction-trace coverage",
            "the pilot includes positive and negative cases plus calibration evidence",
          ],
          artifacts: [
            { label: "serious-moment-dataset", path: datasetRel },
            { label: "decision-quality-contract", path: contractRel },
            { label: "pilot-calibration", path: result.calibrationRefs[0] },
          ],
          outputs: result,
        };
      },
    },
  ],
};
