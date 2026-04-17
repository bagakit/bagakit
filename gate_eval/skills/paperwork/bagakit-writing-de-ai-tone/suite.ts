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
  const tempRepo = createTempDir("bagakit-de-ai-tone-eval-");
  return {
    tempRepo,
    replacements: registerTempRepo(context, tempRepo),
  };
}

export const SUITE: EvalSuiteDefinition = {
  id: "bagakit-writing-de-ai-tone-behavior-starter-eval",
  owner: "gate_eval/skills/paperwork/bagakit-writing-de-ai-tone",
  title: "Bagakit Writing De-AI-Tone Behavior Starter Eval",
  summary: "Check AI-tone detection, technical profile exemptions, and writing-core dispatch.",
  defaultOutputDir: "gate_eval/skills/paperwork/bagakit-writing-de-ai-tone/results/runs",
  cases: [
    {
      id: "de-ai-tone-detects-patterns-and-core-dispatches",
      title: "De-AI-Tone Detects Patterns And Core Dispatches",
      summary: "The public CLI should flag representative Chinese AI-tone patterns while technical profile exemptions stay non-blocking.",
      focus: ["ai-tone", "profile-exemption", "core-dispatch"],
      run: (context): EvalCaseResult => {
        const fixture = withFixture(context);
        const cliRel = "skills/paperwork/bagakit-writing-de-ai-tone/scripts/bagakit-writing-de-ai-tone-cli.sh";
        const coreCliRel = "skills/paperwork/bagakit-writing-core/scripts/bagakit-writing-core-cli.sh";
        const cli = path.join(context.repoRoot, cliRel);
        const coreCli = path.join(context.repoRoot, coreCliRel);
        try {
          const aiTonePath = path.join(fixture.tempRepo, "ai-tone.md");
          fs.writeFileSync(
            aiTonePath,
            [
              "# 随着 AI 的不断发展",
              "",
              "随着 AI 的不断发展，团队通过统一能力进行分析，从而打通链路，进而赋能业务闭环。",
              "",
              "这不是工具问题，而是底层逻辑问题。不是流程问题，而是生态问题。",
              "",
              "大多数人会把它写成该做 vs 不该做。很多团队往往又会写成老路 vs 新路。",
              "",
              "业内人士指出，这具有里程碑式的意义。",
              "",
            ].join("\n"),
          );
          const technicalPath = path.join(fixture.tempRepo, "technical.md");
          fs.writeFileSync(
            technicalPath,
            [
              "# Pipeline note",
              "",
              "The network 链路 records packet timing. The control 闭环 is part of the simulator.",
              "The retry code is robust and documented in the API reference.",
              "",
            ].join("\n"),
          );

          const lint = runCommand("bash", [cli, "lint", "--profile", "blog", "--fail-on", "none", aiTonePath], {
            cwd: context.repoRoot,
            replacements: fixture.replacements,
          });
          expectOk(lint, "de-AI-tone lint");
          const lintJson = JSON.parse(lint.stdout);
          const codes = new Set((lintJson.findings ?? []).map((item: { code?: string }) => item.code));
          for (const expected of [
            "P1_FORMULAIC_OPENING",
            "P1_PROCESS_FILLER",
            "P1_LEXICON_ALWAYS",
            "P1_FAKE_CONTRAST",
            "P1_CONFLICT_BAIT_BINARY",
            "P1_UNSUPPORTED_PEOPLE_GENERALIZATION",
          ]) {
            assert.ok(codes.has(expected), `lint should include ${expected}`);
          }

          const technical = runCommand("bash", [cli, "lint", "--profile", "technical", "--fail-on", "none", technicalPath], {
            cwd: context.repoRoot,
            replacements: fixture.replacements,
          });
          expectOk(technical, "technical profile lint");
          const technicalJson = JSON.parse(technical.stdout);
          const technicalCodes = new Set((technicalJson.findings ?? []).map((item: { code?: string }) => item.code));
          assert.equal(technicalCodes.has("P1_LEXICON_ALWAYS"), false, "technical exemption should suppress always lexicon warning in this fixture");

          const viaCore = runCommand("bash", [coreCli, "de-ai-tone", "lint", "--profile", "blog", "--fail-on", "none", aiTonePath], {
            cwd: context.repoRoot,
            replacements: fixture.replacements,
          });
          expectOk(viaCore, "writing-core de-AI-tone dispatch");
          const viaCoreJson = JSON.parse(viaCore.stdout);
          assert.equal(viaCoreJson.schema, "bagakit.de_ai_tone_lint.v1");

          return {
            assertions: [
              "de-AI-tone lint catches representative structural and lexical AI-tone issues",
              "technical profile exemptions avoid false positives for precise technical terms",
              "writing-core dispatch reaches the de-AI-tone primitive",
            ],
            commands: [
              `bash ${cliRel} lint --profile blog --fail-on none <temp-repo>/ai-tone.md`,
              `bash ${cliRel} lint --profile technical --fail-on none <temp-repo>/technical.md`,
              `bash ${coreCliRel} de-ai-tone lint --profile blog --fail-on none <temp-repo>/ai-tone.md`,
            ],
            artifacts: [
              { label: "ai-tone-fixture", path: aiTonePath },
              { label: "technical-fixture", path: technicalPath },
              { label: "de-ai-tone-cli", path: cliRel },
              { label: "writing-core-cli", path: coreCliRel },
            ],
            outputs: {
              lint_codes: Array.from(codes).sort(),
              technical_codes: Array.from(technicalCodes).sort(),
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
