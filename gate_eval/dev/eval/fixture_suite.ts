import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runCommand } from "../../../dev/eval/src/lib/command.ts";
import { createTempDir, writeTextFile } from "../../../dev/eval/src/lib/temp.ts";
import type { EvalSuiteDefinition } from "../../../dev/eval/src/lib/model.ts";

export const SUITE: EvalSuiteDefinition = {
  id: "dev-eval-fixture-suite",
  owner: "gate_eval/dev/eval",
  title: "Dev Eval Fixture Suite",
  summary: "Dogfood the shared eval runner and packet contract on one deterministic fixture suite.",
  defaultOutputDir: "gate_eval/dev/eval/results/runs",
  cases: [
    {
      id: "sanitized-command-output",
      title: "Sanitized Command Output",
      summary: "Command results should replace temp-workspace paths before they land in case output.",
      focus: ["sanitization", "packet-output"],
      run: () => {
        const tempRepo = createTempDir("bagakit-dev-eval-");
        const canonicalTempRepo = fs.realpathSync(tempRepo);
        const replacements = [
          { from: canonicalTempRepo, to: "<temp-repo>" },
          { from: tempRepo, to: "<temp-repo>" },
        ];
        writeTextFile(path.join(tempRepo, "README.md"), "# fixture\n");
        const result = runCommand(
          "node",
          [
            "-e",
            "console.log(process.cwd()); console.error(process.cwd());",
          ],
          {
            cwd: tempRepo,
            replacements,
          },
        );
        assert.equal(result.status, 0);
        assert.equal(result.stdout.trim(), "<temp-repo>");
        assert.equal(result.stderr.trim(), "<temp-repo>");
        return {
          assertions: [
            "stdout temp path is sanitized",
            "stderr temp path is sanitized",
          ],
          commands: [
            "node -e \"console.log(process.cwd()); console.error(process.cwd());\"",
          ],
          artifacts: [
            {
              label: "fixture-root",
              path: tempRepo,
            },
          ],
          outputs: {
            stdout: result.stdout.trim(),
            stderr: result.stderr.trim(),
          },
          replacements,
        };
      },
    },
    {
      id: "structured-output-shape",
      title: "Structured Output Shape",
      summary: "Case outputs should support structured data without losing packet compatibility.",
      focus: ["packet-output"],
      run: () => {
        const tempRepo = createTempDir("bagakit-dev-eval-");
        const replacements = [{ from: tempRepo, to: "<temp-repo>" }];
        writeTextFile(path.join(tempRepo, "evidence", "note.txt"), "ok\n");
        return {
          assertions: [
            "structured outputs are preserved in case packet",
          ],
          commands: [
            "write evidence/note.txt",
          ],
          artifacts: [
            {
              label: "evidence-note",
              path: path.join(tempRepo, "evidence", "note.txt"),
            },
          ],
          outputs: {
            evidence_count: 1,
            note_path: path.join(tempRepo, "evidence", "note.txt"),
          },
          replacements,
        };
      },
    },
  ],
};
