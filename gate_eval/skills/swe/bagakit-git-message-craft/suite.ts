import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runCommand, type CommandResult } from "../../../../dev/eval/src/lib/command.ts";
import type { EvalSuiteDefinition } from "../../../../dev/eval/src/lib/model.ts";
import { createTempDir, writeTextFile } from "../../../../dev/eval/src/lib/temp.ts";

function expectOk(result: CommandResult, label: string): void {
  assert.equal(result.status, 0, `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

function extractInitializedDir(output: string): string {
  const line = output.split("\n").find((entry) => entry.startsWith("initialized: "));
  assert.ok(line, `missing initialized: line in init output\n${output}`);
  return line.slice("initialized: ".length);
}

export const SUITE: EvalSuiteDefinition = {
  id: "bagakit-git-message-craft-shared-runner-eval",
  owner: "gate_eval/skills/swe/bagakit-git-message-craft",
  title: "Git Message Craft Shared Runner Eval",
  summary: "Measure deterministic message drafting and archive quality for bagakit-git-message-craft.",
  defaultOutputDir: "gate_eval/skills/swe/bagakit-git-message-craft/results/runs",
  cases: [
    {
      id: "draft-and-archive-keep-git-facing-evidence-clean",
      title: "Draft And Archive Keep Git Facing Evidence Clean",
      summary: "Drafted messages should lint cleanly and archive should capture commit evidence without leaking machine-local paths.",
      focus: ["message-quality", "archive-quality"],
      run: ({ repoRoot, addReplacement }) => {
        const tempRepo = createTempDir("bagakit-git-message-craft-eval-");
        const canonicalTempRepo = fs.realpathSync(tempRepo);
        const replacements = [
          { from: canonicalTempRepo, to: "<temp-repo>" },
          { from: tempRepo, to: "<temp-repo>" },
        ];
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
        for (const replacement of replacements) {
          addReplacement(replacement.from, replacement.to);
        }
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
      },
    },
  ],
};
