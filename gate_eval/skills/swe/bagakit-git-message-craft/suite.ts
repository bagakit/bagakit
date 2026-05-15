import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runCommand, type CommandResult } from "../../../../dev/eval/src/lib/command.ts";
import type { EvalSuiteDefinition } from "../../../../dev/eval/src/lib/model.ts";
import { cleanupTempDir, createTempDir, registerTempRepo, writeTextFile } from "../../../../dev/eval/src/lib/temp.ts";

function expectOk(result: CommandResult, label: string): void {
  assert.equal(result.status, 0, `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

function extractInitializedDir(output: string): string {
  const line = output.split("\n").find((entry) => entry.startsWith("initialized: "));
  assert.ok(line, `missing initialized: line in init output\n${output}`);
  return line.slice("initialized: ".length);
}

function loadBehaviorDataset(repoRoot: string): Record<string, unknown> {
  const datasetPath = path.join(
    repoRoot,
    "gate_eval",
    "skills",
    "swe",
    "bagakit-git-message-craft",
    "cases",
    "agent-behavior-eval-dataset.json",
  );
  return JSON.parse(fs.readFileSync(datasetPath, "utf8")) as Record<string, unknown>;
}

export const SUITE: EvalSuiteDefinition = {
  id: "bagakit-git-message-craft-shared-runner-eval",
  owner: "gate_eval/skills/swe/bagakit-git-message-craft",
  title: "Git Message Craft Shared Runner Eval",
  summary: "Measure deterministic message drafting and archive quality for bagakit-git-message-craft.",
  defaultOutputDir: "gate_eval/skills/swe/bagakit-git-message-craft/results/runs",
  cases: [
    {
      id: "paired-agent-behavior-contract-is-runnable",
      title: "Paired Agent Behavior Contract Is Runnable",
      summary: "The manual forward-test dataset should support fair baseline and with-skill runs for activation, message quality, and side-effect control.",
      focus: ["agent-behavior", "activation-routing", "paired-baseline"],
      run: (context) => {
        const dataset = loadBehaviorDataset(context.repoRoot) as {
          schema: string;
          skill_id: string;
          comparison: {
            method: string;
            baseline_condition: string;
            candidate_condition: string;
            required_capture: string[];
          };
          score_dimensions: string[];
          cases: Array<{
            id: string;
            partition: string;
            prompt: string;
            expected_activation: string;
            expected_route: string;
            assertions: string[];
            forbidden_outcomes: string[];
          }>;
        };
        assert.equal(dataset.schema, "bagakit/agent-behavior-eval/v1");
        assert.equal(dataset.skill_id, "bagakit-git-message-craft");
        assert.equal(dataset.comparison.method, "paired-fresh-sessions");
        assert.ok(dataset.comparison.baseline_condition.trim().length > 0);
        assert.ok(dataset.comparison.candidate_condition.trim().length > 0);
        for (const capture of [
          "final_artifact",
          "tool_and_action_trace",
          "validation_evidence",
          "elapsed_time",
          "token_usage",
          "human_rating",
        ]) {
          assert.ok(dataset.comparison.required_capture.includes(capture), `missing required capture: ${capture}`);
        }
        assert.ok(dataset.score_dimensions.includes("trigger_accuracy"));
        assert.ok(dataset.score_dimensions.includes("scope_and_side_effect_control"));
        assert.ok(dataset.cases.some((item) => item.expected_activation === "activate"));
        assert.ok(dataset.cases.some((item) => item.expected_activation === "decline"));
        assert.ok(dataset.cases.some((item) => item.partition === "development"));
        assert.ok(dataset.cases.some((item) => item.partition === "holdout"));
        assert.equal(new Set(dataset.cases.map((item) => item.id)).size, dataset.cases.length, "case ids must be unique");
        for (const item of dataset.cases) {
          assert.ok(item.id.trim().length > 0, "case id must be non-empty");
          assert.ok(["development", "holdout"].includes(item.partition), `${item.id} has invalid partition`);
          assert.ok(item.prompt.trim().length > 0, `${item.id} prompt must be non-empty`);
          assert.ok(["activate", "decline"].includes(item.expected_activation), `${item.id} has invalid expected_activation`);
          assert.ok(item.expected_route.length > 0, `${item.id} needs an expected route`);
          assert.ok(item.assertions.length >= 2, `${item.id} needs observable success assertions`);
          assert.ok(item.forbidden_outcomes.length >= 2, `${item.id} needs failure boundaries`);
        }

        return {
          assertions: [
            "the dataset defines paired fresh-session baseline and with-skill conditions",
            "the dataset covers both correct activation and correct decline behavior",
            "every case names observable success assertions and forbidden side effects",
          ],
          commands: ["manual: run each dataset prompt in paired fresh sessions"],
          artifacts: [
            {
              label: "agent-behavior-dataset",
              path: path.join(
                context.repoRoot,
                "gate_eval",
                "skills",
                "swe",
                "bagakit-git-message-craft",
                "cases",
                "agent-behavior-eval-dataset.json",
              ),
            },
          ],
          outputs: {
            case_count: dataset.cases.length,
            activation_routes: [...new Set(dataset.cases.map((item) => item.expected_activation))],
          },
        };
      },
    },
    {
      id: "draft-and-archive-keep-git-facing-evidence-clean",
      title: "Draft And Archive Keep Git Facing Evidence Clean",
      summary: "Drafted messages should lint cleanly and archive should capture commit evidence without leaking machine-local paths.",
      focus: ["message-quality", "archive-quality"],
      run: (context) => {
        const { repoRoot } = context;
        const tempRepo = createTempDir("bagakit-git-message-craft-eval-");
        const replacements = registerTempRepo(context, tempRepo);
        try {
          expectOk(runCommand("git", ["init", "-q"], { cwd: tempRepo, replacements }), "git init");
        expectOk(runCommand("git", ["config", "user.name", "Bagakit"], { cwd: tempRepo, replacements }), "git config user.name");
        expectOk(runCommand("git", ["config", "user.email", "bagakit@example.com"], { cwd: tempRepo, replacements }), "git config user.email");
        writeTextFile(path.join(tempRepo, "app.py"), "print('hello')\n");
        expectOk(runCommand("git", ["add", "app.py"], { cwd: tempRepo, replacements }), "git add");
        expectOk(runCommand("git", ["commit", "-q", "-m", "init"], { cwd: tempRepo, replacements }), "git commit");
        writeTextFile(path.join(tempRepo, "app.py"), "print('hello')\nprint('world')\n");

        const script = path.join(repoRoot, "skills", "swe", "bagakit-git-message-craft", "scripts", "bagakit-git-message-craft.sh");
          const initResult = runCommand("sh", [script, "init", "--root", tempRepo, "--topic", "commit clarity", "--install-hooks", "no"], { cwd: repoRoot });
          expectOk(initResult, "init");
          const sessionDir = extractInitializedDir(initResult.stdout);
        const messageFile = path.join(sessionDir, "commit-refactor-preserve-git-facing-evidence.txt");
        expectOk(
          runCommand(
            "sh",
            [
              script,
              "draft-message",
              "--root",
              tempRepo,
              "--dir",
              sessionDir,
              "--type",
              "refactor",
              "--scope",
              "commit",
              "--summary",
              "preserve git facing evidence",
              "--why-before",
              "reviewers had to recover intent from mixed local context",
              "--why-change",
              "draft a ranked fact message and keep archive evidence explicit",
              "--why-gain",
              "history stays readable and archive remains self contained",
              "--fact",
              "p0|drafted message keeps ranked facts only|app.py:1",
              "--check",
              "git diff --check",
              "--output",
              messageFile,
            ],
            { cwd: repoRoot, replacements },
          ),
          "draft-message",
        );
        expectOk(runCommand("sh", [script, "lint-message", "--root", tempRepo, "--message", messageFile], { cwd: repoRoot, replacements }), "lint-message");
        const messageText = fs.readFileSync(messageFile, "utf8");
        expectOk(runCommand("git", ["add", "app.py"], { cwd: tempRepo, replacements }), "git add changed app");
        expectOk(runCommand("git", ["commit", "-q", "-F", messageFile], { cwd: tempRepo, replacements }), "git commit drafted message");
        const commitSha = runCommand("git", ["rev-parse", "--short", "HEAD"], { cwd: tempRepo, replacements });
        expectOk(commitSha, "rev-parse");
        expectOk(runCommand("sh", [script, "archive", "--root", tempRepo, "--dir", sessionDir, "--commit", commitSha.stdout.trim(), "--check-evidence", `lint-message passed for ${messageFile}`], { cwd: repoRoot, replacements }), "archive");
        const archiveFile = path.join(tempRepo, ".git", "bagakit", "git-message-craft", "archive", `${path.basename(sessionDir)}.md`);
        const archiveText = fs.readFileSync(archiveFile, "utf8");
        assert.ok(messageText.split("\n").includes("[[BAGAKIT]]"));
        assert.ok(messageText.split("\n").includes("- GitMessageCraft: Protocol=bagakit.git-message-craft/v1"));
        assert.ok(archiveText.includes("## Commit Evidence"));
        assert.ok(!archiveText.includes(tempRepo));

          return {
          assertions: [
            "drafted message keeps the footer protocol marker expected by lint-message",
            "archive records commit evidence after the drafted message is committed",
            "archive output stays free of machine-local repo paths",
          ],
          commands: [
            `sh ${script} init --root <temp-repo> --topic "commit clarity" --install-hooks no`,
            `sh ${script} draft-message --root <temp-repo> --dir <temp-repo>/.bagakit/git-message-craft/<session> --type refactor --scope commit --summary "preserve git facing evidence" ...`,
            `sh ${script} lint-message --root <temp-repo> --message <temp-repo>/.bagakit/git-message-craft/<session>/commit-refactor-preserve-git-facing-evidence.txt`,
            `sh ${script} archive --root <temp-repo> --dir <temp-repo>/.bagakit/git-message-craft/<session> --commit ${commitSha.stdout.trim()}`,
          ],
          artifacts: [
            { label: "commit-message", path: messageFile },
            { label: "archive-file", path: archiveFile },
          ],
          outputs: {
            commit_sha: commitSha.stdout.trim(),
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
