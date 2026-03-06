import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runCommand, type CommandResult } from "../../../../dev/eval/src/lib/command.ts";
import type { EvalSuiteDefinition } from "../../../../dev/eval/src/lib/model.ts";
import { createTempDir, writeTextFile } from "../../../../dev/eval/src/lib/temp.ts";

function expectOk(result: CommandResult, label: string): void {
  assert.equal(result.status, 0, `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

function initGitRepo(cwd: string, replacements: { from: string; to: string }[]): void {
  expectOk(runCommand("git", ["init", "-q"], { cwd, replacements }), "git init");
  expectOk(runCommand("git", ["config", "user.name", "Bagakit"], { cwd, replacements }), "git config user.name");
  expectOk(runCommand("git", ["config", "user.email", "bagakit@example.com"], { cwd, replacements }), "git config user.email");
  writeTextFile(path.join(cwd, "README.md"), "# demo\n");
  expectOk(runCommand("git", ["add", "README.md"], { cwd, replacements }), "git add");
  expectOk(runCommand("git", ["commit", "-q", "-m", "init"], { cwd, replacements }), "git commit");
}

export const SUITE: EvalSuiteDefinition = {
  id: "bagakit-living-knowledge-shared-runner-eval",
  owner: "gate_eval/skills/harness/bagakit-living-knowledge",
  title: "Living Knowledge Shared Runner Eval",
  summary: "Measure deterministic recall and reviewed-note ingestion quality for bagakit-living-knowledge.",
  defaultOutputDir: "gate_eval/skills/harness/bagakit-living-knowledge/results/runs",
  cases: [
    {
      id: "shared-root-recall-and-ingest",
      title: "Shared Root Recall And Ingest",
      summary: "Applying the substrate should enable indexed recall over shared docs and safe reviewed-note ingestion.",
      focus: ["shared-root-recall", "ingest-quality"],
      run: ({ repoRoot, addReplacement }) => {
        const tempRepo = createTempDir("bagakit-living-knowledge-eval-");
        const canonicalTempRepo = fs.realpathSync(tempRepo);
        const replacements = [
          { from: canonicalTempRepo, to: "<temp-repo>" },
          { from: tempRepo, to: "<temp-repo>" },
        ];
        for (const replacement of replacements) {
          addReplacement(replacement.from, replacement.to);
        }
        initGitRepo(tempRepo, replacements);

        const script = path.join(repoRoot, "skills", "harness", "bagakit-living-knowledge", "scripts", "bagakit-living-knowledge.sh");
        expectOk(runCommand("sh", [script, "apply", "--root", tempRepo], { cwd: repoRoot, replacements }), "apply");
        writeTextFile(path.join(tempRepo, "docs", "notes", "decision-shared-root.md"), "# Shared Root Decision\n\n- Keep docs as shared root.\n");
        expectOk(runCommand("sh", [script, "index", "--root", tempRepo], { cwd: repoRoot, replacements }), "index");
        const searchResult = runCommand("sh", [script, "recall", "search", "--root", tempRepo, "shared root"], { cwd: repoRoot, replacements });
        expectOk(searchResult, "recall search");
        const getResult = runCommand("sh", [script, "recall", "get", "--root", tempRepo, "docs/notes/decision-shared-root.md", "--from", "1", "--lines", "8"], { cwd: repoRoot, replacements });
        expectOk(getResult, "recall get");

        writeTextFile(path.join(tempRepo, "docs", "reviewed-note.md"), "# Reviewed Note\n\n- Ready for shared ingestion.\n");
        expectOk(runCommand("sh", [script, "ingest", "--root", tempRepo, "--source", "docs/reviewed-note.md", "--dest", "notes/reviewed-note.md"], { cwd: repoRoot, replacements }), "ingest");
        const ingestedPath = path.join(tempRepo, "docs", "notes", "reviewed-note.md");
        assert.ok(fs.existsSync(ingestedPath));
        assert.ok(searchResult.stdout.includes("docs/notes/decision-shared-root.md"));
        assert.ok(getResult.stdout.split("\n").includes("# Shared Root Decision"));

        return {
          assertions: [
            "indexed recall surfaces the shared-root note from docs",
            "recall get returns the expected note heading",
            "ingest writes the reviewed note into docs/notes without leaving runtime-only state in the path",
          ],
          commands: [
            `sh ${script} apply --root <temp-repo>`,
            `sh ${script} index --root <temp-repo>`,
            `sh ${script} recall search --root <temp-repo> "shared root"`,
            `sh ${script} recall get --root <temp-repo> docs/notes/decision-shared-root.md --from 1 --lines 8`,
            `sh ${script} ingest --root <temp-repo> --source docs/reviewed-note.md --dest notes/reviewed-note.md`,
          ],
          artifacts: [
            { label: "shared-root-note", path: path.join(tempRepo, "docs", "notes", "decision-shared-root.md") },
            { label: "ingested-note", path: ingestedPath },
          ],
          outputs: {
            search_hits: searchResult.stdout.trim().split("\n"),
          },
          replacements,
        };
      },
    },
  ],
};
