import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runCommand } from "../../../dev/eval/src/lib/command.ts";
import { runAgentEvalSession } from "../../../dev/eval/src/lib/agent_session.ts";
import { cleanupTempDir, createTempDir, registerTempRepo, writeTextFile } from "../../../dev/eval/src/lib/temp.ts";
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
      run: (context) => {
        const tempRepo = createTempDir("bagakit-dev-eval-");
        const replacements = registerTempRepo(context, tempRepo);
        try {
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
        } finally {
          cleanupTempDir(tempRepo, context.keepTemp);
        }
      },
    },
    {
      id: "structured-output-shape",
      title: "Structured Output Shape",
      summary: "Case outputs should support structured data without losing packet compatibility.",
      focus: ["packet-output"],
      run: (context) => {
        const tempRepo = createTempDir("bagakit-dev-eval-");
        const replacements = registerTempRepo(context, tempRepo);
        try {
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
        } finally {
          cleanupTempDir(tempRepo, context.keepTemp);
        }
      },
    },
    {
      id: "agent-session-substrate",
      title: "Agent Session Substrate",
      summary: "Eval should be able to drive one bounded agent session through the shared agent-runner substrate.",
      focus: ["agent-substrate", "shared-runner"],
      run: (context) => {
        const tempRepo = createTempDir("bagakit-dev-eval-agent-");
        registerTempRepo(context, tempRepo);
        try {
          const runnerConfigFile = path.join(tempRepo, "runner.json");
          writeTextFile(
            runnerConfigFile,
            `${JSON.stringify(
              {
                schema: "bagakit/agent-runner/config/v1",
                runner_name: "fake-agent",
                transport: "stdin_prompt",
                argv: [
                  "python3",
                  "-c",
                  "import sys; print('agent-session-ok'); print(sys.stdin.read().strip())",
                ],
                env: {},
                timeout_seconds: 2,
              },
              null,
              2,
            )}\n`,
          );
          const session = runAgentEvalSession(context, {
            workspaceRoot: tempRepo,
            sessionId: "sess-eval-agent",
            workloadId: "case-agent-substrate",
            promptText: "bounded eval prompt\n",
            configFile: runnerConfigFile,
          });
          assert.equal(session.launch.exit_code, 0);
          assert.ok(session.launch.stdout.includes("agent-session-ok"));
          assert.ok(session.launch.stdout.includes("bounded eval prompt"));
          const meta = JSON.parse(fs.readFileSync(session.artifacts.sessionMetaFile, "utf8")) as Record<string, unknown>;
          assert.equal(meta.schema, "bagakit/agent-runner/session-meta/v1");
          return {
            assertions: [
              "eval launches one bounded runner session through dev/agent_runner using a config file",
              "shared substrate writes prompt and transcript artifacts for the eval workspace",
            ],
            commands: [
              "python3 -c \"import sys; print('agent-session-ok'); print(sys.stdin.read().strip())\"",
            ],
            artifacts: [
              { label: "eval-session-dir", path: session.artifacts.sessionDir },
              { label: "runner-config", path: runnerConfigFile },
              { label: "eval-prompt", path: session.artifacts.promptFile },
              { label: "eval-stdout", path: session.artifacts.stdoutFile },
              { label: "eval-session-meta", path: session.artifacts.sessionMetaFile },
            ],
            outputs: {
              stdout: session.launch.stdout.trim().split("\n"),
            },
          };
        } finally {
          cleanupTempDir(tempRepo, context.keepTemp);
        }
      },
    },
  ],
};
