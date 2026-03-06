import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runCommand, type CommandResult } from "../../../../dev/eval/src/lib/command.ts";
import type { EvalSuiteDefinition } from "../../../../dev/eval/src/lib/model.ts";
import { createTempDir } from "../../../../dev/eval/src/lib/temp.ts";

const PYTHON = process.env.PYTHON3 ?? "python3";

function expectOk(result: CommandResult, label: string): void {
  assert.equal(
    result.status,
    0,
    `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
}

export const SUITE: EvalSuiteDefinition = {
  id: "bagakit-researcher-shared-runner-eval",
  owner: "gate_eval/skills/harness/bagakit-researcher",
  title: "Researcher Shared Runner Eval",
  summary: "Measure deterministic evidence-linkage quality for bagakit-researcher with the shared eval runner.",
  defaultOutputDir: "gate_eval/skills/harness/bagakit-researcher/results/runs",
  cases: [
    {
      id: "topic-index-links-source-and-summary",
      title: "Topic Index Links Source And Summary",
      summary: "A refreshed topic index should surface the source card and reusable summary produced for the same source id.",
      focus: ["evidence-linkage", "topic-index-coherence", "workspace-reporting"],
      run: ({ repoRoot }) => {
        const tempRepo = createTempDir("bagakit-researcher-eval-");
        const canonicalTempRepo = fs.realpathSync(tempRepo);
        const replacements = [
          { from: canonicalTempRepo, to: "<temp-repo>" },
          { from: tempRepo, to: "<temp-repo>" },
        ];
        const script = path.join(
          repoRoot,
          "skills",
          "harness",
          "bagakit-researcher",
          "scripts",
          "bagakit-researcher.py",
        );
        const topicClass = "frontier";
        const topic = "evidence-loop";
        const workspaceRoot = path.join(
          tempRepo,
          ".bagakit",
          "researcher",
          "topics",
          topicClass,
          topic,
        );
        const sourcePath = path.join(workspaceRoot, "originals", "a01.md");
        const summaryPath = path.join(workspaceRoot, "summaries", "a01.md");
        const indexPath = path.join(workspaceRoot, "index.md");

        const initTopic = runCommand(
          PYTHON,
          [
            script,
            "init-topic",
            "--root",
            tempRepo,
            "--topic-class",
            topicClass,
            "--topic",
            topic,
            "--title",
            "Evidence Loop",
          ],
          { cwd: repoRoot, replacements },
        );
        expectOk(initTopic, "init-topic");

        const addSource = runCommand(
          PYTHON,
          [
            script,
            "add-source-card",
            "--root",
            tempRepo,
            "--topic-class",
            topicClass,
            "--topic",
            topic,
            "--source-id",
            "a01",
            "--title",
            "Example Source",
            "--url",
            "https://example.com/research",
            "--authority",
            "primary",
            "--published",
            "2026-04-19",
            "--why",
            "sets the baseline",
          ],
          { cwd: repoRoot, replacements },
        );
        expectOk(addSource, "add-source-card");

        const addSummary = runCommand(
          PYTHON,
          [
            script,
            "add-summary",
            "--root",
            tempRepo,
            "--topic-class",
            topicClass,
            "--topic",
            topic,
            "--source-id",
            "a01",
            "--title",
            "Example Source Summary",
            "--why-matters",
            "clarifies the baseline",
            "--borrow",
            "one reusable idea",
            "--avoid",
            "one wrong direction",
            "--implication",
            "one Bagakit implication",
          ],
          { cwd: repoRoot, replacements },
        );
        expectOk(addSummary, "add-summary");

        const refreshIndex = runCommand(
          PYTHON,
          [
            script,
            "refresh-index",
            "--root",
            tempRepo,
            "--topic-class",
            topicClass,
            "--topic",
            topic,
            "--title",
            "Evidence Loop",
          ],
          { cwd: repoRoot, replacements },
        );
        expectOk(refreshIndex, "refresh-index");

        const listTopics = runCommand(
          PYTHON,
          [
            script,
            "list-topics",
            "--root",
            tempRepo,
          ],
          { cwd: repoRoot, replacements },
        );
        expectOk(listTopics, "list-topics");

        const doctor = runCommand(
          PYTHON,
          [
            script,
            "doctor",
            "--root",
            tempRepo,
            "--topic-class",
            topicClass,
            "--topic",
            topic,
          ],
          { cwd: repoRoot, replacements },
        );
        expectOk(doctor, "doctor");

        assert.ok(fs.existsSync(sourcePath), "expected source card to exist");
        assert.ok(fs.existsSync(summaryPath), "expected summary card to exist");
        assert.ok(fs.existsSync(indexPath), "expected topic index to exist");

        const indexText = fs.readFileSync(indexPath, "utf8");
        const summaryText = fs.readFileSync(summaryPath, "utf8");
        assert.ok(
          listTopics.stdout
            .split("\n")
            .includes("frontier/evidence-loop\t.bagakit/researcher/topics/frontier/evidence-loop/index.md"),
        );
        assert.ok(indexText.includes("## Source Cards"));
        assert.ok(indexText.includes("- `originals/a01.md` — Example Source"));
        assert.ok(indexText.includes("## Summaries"));
        assert.ok(indexText.includes("- `summaries/a01.md` — Example Source Summary"));
        assert.ok(summaryText.includes("## Borrow"));
        assert.ok(summaryText.includes("- one reusable idea"));
        assert.ok(summaryText.includes("## Bagakit Implication"));
        assert.ok(summaryText.includes("- one Bagakit implication"));

        return {
          assertions: [
            "topic listing surfaces the initialized workspace",
            "refreshed index links both the source card and its reusable summary",
            "summary retains the expected borrow and implication sections",
          ],
          commands: [
            `python3 ${script} init-topic --root ${tempRepo} --topic-class ${topicClass} --topic ${topic} --title "Evidence Loop"`,
            `python3 ${script} add-source-card --root ${tempRepo} --topic-class ${topicClass} --topic ${topic} --source-id a01 --title "Example Source" --url https://example.com/research --authority primary --published 2026-04-19 --why "sets the baseline"`,
            `python3 ${script} add-summary --root ${tempRepo} --topic-class ${topicClass} --topic ${topic} --source-id a01 --title "Example Source Summary" --why-matters "clarifies the baseline" --borrow "one reusable idea" --avoid "one wrong direction" --implication "one Bagakit implication"`,
            `python3 ${script} refresh-index --root ${tempRepo} --topic-class ${topicClass} --topic ${topic} --title "Evidence Loop"`,
            `python3 ${script} list-topics --root ${tempRepo}`,
            `python3 ${script} doctor --root ${tempRepo} --topic-class ${topicClass} --topic ${topic}`,
          ],
          artifacts: [
            { label: "topic-index", path: indexPath },
            { label: "source-card", path: sourcePath },
            { label: "summary-card", path: summaryPath },
          ],
          outputs: {
            listed_topics: listTopics.stdout.trim().split("\n"),
            index_entries: [
              "- `originals/a01.md` — Example Source",
              "- `summaries/a01.md` — Example Source Summary",
            ],
            summary_signals: [
              "one reusable idea",
              "one Bagakit implication",
            ],
          },
          replacements,
        };
      },
    },
  ],
};
