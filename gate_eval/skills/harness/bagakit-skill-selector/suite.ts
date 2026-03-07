import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runCommand, type CommandResult } from "../../../../dev/eval/src/lib/command.ts";
import type { EvalSuiteDefinition } from "../../../../dev/eval/src/lib/model.ts";
import { cleanupTempDir, createTempDir, registerTempRepo } from "../../../../dev/eval/src/lib/temp.ts";

function expectOk(result: CommandResult, label: string): void {
  assert.equal(result.status, 0, `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

export const SUITE: EvalSuiteDefinition = {
  id: "bagakit-skill-selector-shared-runner-eval",
  owner: "gate_eval/skills/harness/bagakit-skill-selector",
  title: "Skill Selector Shared Runner Eval",
  summary: "Measure deterministic composition logging and retry-backoff evidence for bagakit-skill-selector.",
  defaultOutputDir: "gate_eval/skills/harness/bagakit-skill-selector/results/runs",
  cases: [
    {
      id: "composition-log-drives-driver-pack-and-ranking",
      title: "Composition Log Drives Driver Pack And Ranking",
      summary: "Selector usage logs should drive retry backoff, driver-pack rendering, and ranking output coherently.",
      focus: ["composition-log", "retry-backoff", "derived-reports"],
      run: (context) => {
        const { repoRoot } = context;
        const tempRepo = createTempDir("bagakit-skill-selector-eval-");
        const replacements = registerTempRepo(context, tempRepo);
        try {
          const target = path.join(tempRepo, ".bagakit", "skill-selector", "tasks", "demo", "skill-usage.toml");
          const driverPack = path.join(tempRepo, ".bagakit", "skill-selector", "tasks", "demo", "bagakit-drivers.md");
          const ranking = path.join(tempRepo, ".bagakit", "skill-selector", "tasks", "demo", "skill-ranking.md");
          const script = path.join(repoRoot, "skills", "harness", "bagakit-skill-selector", "scripts", "skill_selector.ts");
          const run = (argv: string[], label: string) => expectOk(runCommand("node", ["--experimental-strip-types", script, ...argv], { cwd: repoRoot, replacements }), label);

        run(["init", "--file", target, "--task-id", "demo-task", "--objective", "eval selector loop", "--owner", "validator"], "init");
        run(["preflight", "--file", target, "--answer", "partial", "--gap-summary", "need driver loading coverage", "--decision", "compose_then_execute", "--status", "in_progress"], "preflight");
        run(["recipe", "--file", target, "--recipe-id", "research-to-knowledge", "--source", "skills/harness/bagakit-skill-selector/recipes/research-to-knowledge.md", "--why", "evaluate composition logging", "--status", "selected"], "recipe");
        run(["plan", "--file", target, "--skill-id", "bagakit-skill-selector", "--kind", "local", "--source", "skills/harness/bagakit-skill-selector", "--why", "orchestrate composition", "--expected-impact", "keep composition visible", "--composition-role", "composition_entrypoint", "--composition-id", "loop", "--activation-mode", "composed"], "plan selector");
        run(["plan", "--file", target, "--skill-id", "bagakit-living-knowledge", "--kind", "local", "--source", "skills/harness/bagakit-living-knowledge", "--why", "provide shared knowledge", "--expected-impact", "keep recall explicit", "--composition-role", "composition_peer", "--composition-id", "loop", "--activation-mode", "composed", "--fallback-strategy", "standalone_first"], "plan living-knowledge");
        run(["plan", "--file", target, "--skill-id", "bagakit-researcher", "--kind", "local", "--source", "skills/harness/bagakit-researcher", "--why", "provide evidence production", "--expected-impact", "keep research explicit", "--composition-role", "composition_peer", "--composition-id", "loop", "--activation-mode", "composed", "--fallback-strategy", "standalone_first"], "plan researcher");
        run(["usage", "--file", target, "--skill-id", "bagakit-skill-selector", "--phase", "execution", "--attempt-key", "driver-pack-load", "--action", "loaded selector drivers", "--result", "partial", "--evidence", "suite.ts"], "usage partial");
        run(["usage", "--file", target, "--skill-id", "bagakit-skill-selector", "--phase", "execution", "--attempt-key", "driver-pack-load", "--action", "loaded selector drivers", "--result", "failed", "--evidence", "suite.ts"], "usage failed 1");
        run(["usage", "--file", target, "--skill-id", "bagakit-skill-selector", "--phase", "execution", "--attempt-key", "driver-pack-load", "--action", "loaded selector drivers", "--result", "failed", "--evidence", "suite.ts"], "usage failed 2");
        run(["error-pattern", "--file", target, "--error-type", "driver_load_failure", "--message-pattern", "loaded selector drivers", "--skill-id", "bagakit-skill-selector", "--resolution", "switch method"], "error-pattern");
        run(["feedback", "--file", target, "--skill-id", "bagakit-skill-selector", "--channel", "self_review", "--signal", "positive", "--detail", "ranking stays readable", "--impact-scope", "driver-loop", "--confidence", "high"], "feedback");
        run(["search", "--file", target, "--reason", "retry backoff threshold hit", "--query", "driver-pack-load alternative strategy", "--source-scope", "local"], "search");
        run(["benchmark", "--file", target, "--benchmark-id", "selector-smoke", "--metric", "evidence_quality", "--baseline", "0.6", "--candidate", "0.8", "--higher-is-better", "--notes", "exercise benchmark logging"], "benchmark");
        run(["drivers", "--file", target, "--root", repoRoot, "--output", driverPack], "drivers");
        run(["skill-ranking", "--file", target, "--output", ranking], "skill-ranking");
        run(["evaluate", "--file", target, "--quality-score", "0.78", "--evidence-score", "0.86", "--feedback-score", "0.72", "--overall", "conditional_pass", "--summary", "selector loop stays coherent", "--status", "completed"], "evaluate");
        run(["validate", "--file", target, "--strict"], "validate");

        const targetText = fs.readFileSync(target, "utf8");
        const driverText = fs.readFileSync(driverPack, "utf8");
        const rankingText = fs.readFileSync(ranking, "utf8");
        assert.ok(targetText.includes("backoff_required = true"));
        assert.ok(targetText.includes("needs_new_search = true"));
        assert.ok(driverText.includes("bagakit-researcher"));
        assert.ok(driverText.includes("RetryBackoffThreshold: `3`"));
        assert.ok(rankingText.includes("Skill Ranking Report"));

          return {
          assertions: [
            "selector log records retry backoff and new-search requirement after repeated failures",
            "driver pack includes composed peers declared by the chosen plans",
            "skill ranking report is produced from the same task log without a second control plane",
          ],
          commands: [
            `node --experimental-strip-types ${script} init --file <temp-repo>/.bagakit/skill-selector/tasks/demo/skill-usage.toml --task-id demo-task --objective "eval selector loop" --owner validator`,
            `node --experimental-strip-types ${script} drivers --file <temp-repo>/.bagakit/skill-selector/tasks/demo/skill-usage.toml --root . --output <temp-repo>/.bagakit/skill-selector/tasks/demo/bagakit-drivers.md`,
            `node --experimental-strip-types ${script} skill-ranking --file <temp-repo>/.bagakit/skill-selector/tasks/demo/skill-usage.toml --output <temp-repo>/.bagakit/skill-selector/tasks/demo/skill-ranking.md`,
          ],
          artifacts: [
            { label: "usage-log", path: target },
            { label: "driver-pack", path: driverPack },
            { label: "ranking-report", path: ranking },
          ],
          outputs: {
            ranking_top_line: rankingText.split("\n").find((line) => line.includes("| 1 |")) ?? "",
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
