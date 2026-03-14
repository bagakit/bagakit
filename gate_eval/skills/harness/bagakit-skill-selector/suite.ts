import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runCommand, type CommandResult } from "../../../../dev/eval/src/lib/command.ts";
import type { EvalSuiteDefinition } from "../../../../dev/eval/src/lib/model.ts";
import { cleanupTempDir, createTempDir, registerTempRepo } from "../../../../dev/eval/src/lib/temp.ts";
import { readSkillUsageDoc } from "../../../../skills/harness/bagakit-skill-selector/scripts/lib/skill_usage.ts";

function expectOk(result: CommandResult, label: string): void {
  assert.equal(result.status, 0, `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

export const SUITE: EvalSuiteDefinition = {
  id: "bagakit-skill-selector-shared-runner-eval",
  owner: "gate_eval/skills/harness/bagakit-skill-selector",
  title: "Skill Selector Shared Runner Eval",
  summary: "Measure deterministic composition logging, retry-backoff evidence, and explicit selector->evolver bridge behavior for bagakit-skill-selector.",
  defaultOutputDir: "gate_eval/skills/harness/bagakit-skill-selector/results/runs",
  cases: [
    {
      id: "composition-log-drives-driver-pack-and-ranking",
      title: "Composition Log Drives Driver Pack, Ranking, And Evolver Bridge",
      summary: "Selector task logs should drive retry backoff, review-signal bridge, driver-pack rendering, and ranking output coherently.",
      focus: ["composition-log", "retry-backoff", "evolver-bridge", "derived-reports"],
      run: (context) => {
        const { repoRoot } = context;
        const tempRepo = createTempDir("bagakit-skill-selector-eval-");
        const replacements = registerTempRepo(context, tempRepo);
        try {
          const target = path.join(tempRepo, ".bagakit", "skill-selector", "tasks", "demo", "skill-usage.toml");
          const preferencesFile = path.join(tempRepo, ".bagakit", "skill-selector", "project-preferences.toml");
          const survey = path.join(tempRepo, ".bagakit", "skill-selector", "tasks", "demo", "candidate-survey.md");
          const driverPack = path.join(tempRepo, ".bagakit", "skill-selector", "tasks", "demo", "bagakit-drivers.md");
          const ranking = path.join(tempRepo, ".bagakit", "skill-selector", "tasks", "demo", "skill-ranking.md");
          const evolverExport = path.join(tempRepo, ".bagakit", "skill-selector", "tasks", "demo", "evolver-signals.json");
          const script = path.join(repoRoot, "skills", "harness", "bagakit-skill-selector", "scripts", "skill_selector.ts");
          const evolverScript = path.join(repoRoot, "skills", "harness", "bagakit-skill-evolver", "scripts", "evolver.ts");
          const run = (argv: string[], label: string) => {
            const result = runCommand("node", ["--experimental-strip-types", script, ...argv], { cwd: repoRoot, replacements });
            expectOk(result, label);
            return result;
          };
          const runEvolver = (argv: string[], label: string) => {
            const result = runCommand("node", ["--experimental-strip-types", evolverScript, ...argv], { cwd: repoRoot, replacements });
            expectOk(result, label);
            return result;
          };

        run(["init", "--file", target, "--task-id", "demo-task", "--objective", "eval selector loop", "--owner", "validator"], "init");
        run(["preflight", "--file", target, "--answer", "partial", "--gap-summary", "need driver loading coverage", "--decision", "compose_then_execute", "--status", "in_progress"], "preflight");
        run(["recipe", "--file", target, "--recipe-id", "research-to-knowledge", "--source", "skills/harness/bagakit-skill-selector/recipes/research-to-knowledge.md", "--why", "evaluate composition logging", "--synthesis-artifact", ".bagakit/living-knowledge/notes/research-to-knowledge.md", "--status", "selected"], "recipe");
        run(["preferences-init", "--file", preferencesFile], "preferences-init");
        fs.appendFileSync(
          preferencesFile,
          "\n[[skill_preference]]\n"
          + "timestamp = \"2026-04-20T00:00:00Z\"\n"
          + "skill_id = \"bagakit-brainstorm\"\n"
          + "preference = \"prefer\"\n"
          + "reason = \"Option-shaping work in this host often benefits from explicit brainstorm handoff.\"\n"
          + "notes = \"\"\n",
          "utf8",
        );
        run(["plan", "--file", target, "--skill-id", "bagakit-skill-selector", "--kind", "local", "--source", "skills/harness/bagakit-skill-selector", "--why", "orchestrate composition", "--expected-impact", "keep composition visible", "--availability", "available", "--availability-detail", "available as a canonical local skill in the current catalog root", "--composition-role", "composition_entrypoint", "--composition-id", "loop", "--activation-mode", "composed"], "plan selector");
        run(["plan", "--file", target, "--skill-id", "bagakit-living-knowledge", "--kind", "local", "--source", "skills/harness/bagakit-living-knowledge", "--why", "provide shared knowledge", "--expected-impact", "keep recall explicit", "--availability", "available", "--availability-detail", "available as a canonical local skill in the current catalog root", "--composition-role", "composition_peer", "--composition-id", "loop", "--activation-mode", "composed", "--fallback-strategy", "standalone_first"], "plan living-knowledge");
        run(["plan", "--file", target, "--skill-id", "bagakit-researcher", "--kind", "local", "--source", "skills/harness/bagakit-researcher", "--why", "provide evidence production", "--expected-impact", "keep research explicit", "--composition-role", "composition_peer", "--composition-id", "loop", "--activation-mode", "composed", "--fallback-strategy", "standalone_first"], "plan researcher");
        run(["availability", "--file", target, "--skill-id", "bagakit-researcher", "--availability", "available", "--availability-detail", "available as a canonical local skill after explicit host check"], "availability researcher");
        run(["usage", "--file", target, "--skill-id", "bagakit-skill-selector", "--phase", "execution", "--attempt-key", "driver-pack-load", "--action", "loaded selector drivers", "--result", "partial", "--evidence", "suite.ts"], "usage partial");
        run(["usage", "--file", target, "--skill-id", "bagakit-skill-selector", "--phase", "execution", "--attempt-key", "driver-pack-load", "--action", "loaded selector drivers", "--result", "failed", "--evidence", "suite.ts"], "usage failed 1");
        run(["usage", "--file", target, "--skill-id", "bagakit-skill-selector", "--phase", "execution", "--attempt-key", "driver-pack-load", "--action", "loaded selector drivers", "--result", "failed", "--evidence", "suite.ts"], "usage failed 2");
        run(["error-pattern", "--file", target, "--error-type", "driver_load_failure", "--message-pattern", "loaded selector drivers", "--skill-id", "bagakit-skill-selector", "--resolution", "switch method"], "error-pattern");
        run([
          "evolver-signal",
          "--file",
          target,
          "--signal-id",
          "driver-load-review",
          "--kind",
          "gotcha",
          "--trigger",
          "manual_review",
          "--skill-id",
          "bagakit-skill-selector",
          "--title",
          "Driver load loop deserves repo review",
          "--summary",
          "selector-visible repeated driver load failures may reflect a reusable repository-level reporting gap",
          "--scope-hint",
          "upstream",
          "--attempt-key",
          "driver-pack-load",
          "--error-type",
          "driver_load_failure",
          "--occurrence-index",
          "3",
          "--evidence-ref",
          target,
        ], "evolver-signal");
        run(["feedback", "--file", target, "--skill-id", "bagakit-skill-selector", "--channel", "self_review", "--signal", "positive", "--detail", "ranking stays readable", "--impact-scope", "driver-loop", "--confidence", "high"], "feedback");
        run(["search", "--file", target, "--reason", "retry backoff threshold hit", "--query", "driver-pack-load alternative strategy", "--source-scope", "local"], "search");
        run(["benchmark", "--file", target, "--benchmark-id", "selector-smoke", "--metric", "evidence_quality", "--baseline", "0.6", "--candidate", "0.8", "--higher-is-better", "--notes", "exercise benchmark logging"], "benchmark");
        run(["candidate-survey", "--file", target, "--root", repoRoot, "--output", survey], "candidate-survey");
        run(["drivers", "--file", target, "--root", repoRoot, "--output", driverPack], "drivers");
        run(["skill-ranking", "--file", target, "--output", ranking], "skill-ranking");
        run(["evolver-export", "--file", target, "--output", evolverExport], "evolver-export");
        run(["evolver-bridge", "--file", target, "--root", tempRepo, "--output", evolverExport], "evolver-bridge");
        run(["evaluate", "--file", target, "--quality-score", "0.78", "--evidence-score", "0.86", "--feedback-score", "0.72", "--overall", "conditional_pass", "--summary", "selector loop stays coherent", "--status", "completed"], "evaluate");
        run(["validate", "--file", target, "--strict"], "validate");
        const evolverSignals = JSON.parse(runEvolver(["list-signals", "--root", tempRepo, "--json"], "evolver list-signals").stdout) as Array<Record<string, unknown>>;

        const surveyText = fs.readFileSync(survey, "utf8");
        const driverText = fs.readFileSync(driverPack, "utf8");
        const rankingText = fs.readFileSync(ranking, "utf8");
        const usageDoc = readSkillUsageDoc(target);
        const evolverExportPayload = JSON.parse(fs.readFileSync(evolverExport, "utf8")) as {
          schema: string;
          producer: string;
          signals: Array<Record<string, unknown>>;
        };
        const signalDir = path.join(tempRepo, ".mem_inbox", "signals");
        const signalFiles = fs.readdirSync(signalDir).sort();
        const expectedSignalIds = [
          "demo-task-driver-load-review",
          "demo-task-pattern-bagakit-skill-selector-driver-load-failure-loaded-selector-drivers",
          "demo-task-retry-bagakit-skill-selector-driver-pack-load",
        ].sort();
        const exportedSignalsById = new Map(
          evolverExportPayload.signals.map((signal) => [String(signal.id), signal]),
        );
        const importedSignalsById = new Map(
          evolverSignals.map((signal) => [String(signal.id), signal]),
        );
        const usageSignalsById = new Map(
          usageDoc.evolver_signal_log.map((signal) => [signal.signal_id, signal]),
        );
        assert.equal(usageDoc.next_actions.needs_new_search, true);
        assert.equal(usageDoc.usage_log.some((entry) => entry.backoff_required), true);
        assert.ok(usageDoc.recipe_log.some((entry) => entry.synthesis_artifact === ".bagakit/living-knowledge/notes/research-to-knowledge.md"));
        assert.ok(usageDoc.skill_plan.every((entry) => entry.kind !== "local" || entry.availability === "available"));
        assert.deepEqual([...exportedSignalsById.keys()].sort(), expectedSignalIds);
        assert.deepEqual([...importedSignalsById.keys()].sort(), expectedSignalIds);
        assert.equal(exportedSignalsById.get("demo-task-driver-load-review")?.source_channel, "selector");
        assert.equal(exportedSignalsById.get("demo-task-retry-bagakit-skill-selector-driver-pack-load")?.topic_hint, "driver-pack-load");
        assert.equal(exportedSignalsById.get("demo-task-pattern-bagakit-skill-selector-driver-load-failure-loaded-selector-drivers")?.topic_hint, "driver-load-failure");
        assert.ok(
          (exportedSignalsById.get("demo-task-retry-bagakit-skill-selector-driver-pack-load")?.evidence as string[]).includes(
            "trigger=retry_backoff",
          ),
        );
        assert.ok(
          (exportedSignalsById.get("demo-task-pattern-bagakit-skill-selector-driver-load-failure-loaded-selector-drivers")?.evidence as string[]).includes(
            "error_type=driver_load_failure",
          ),
        );
        for (const signalId of expectedSignalIds) {
          const exported = exportedSignalsById.get(signalId);
          const imported = importedSignalsById.get(signalId);
          assert.ok(exported, `missing exported signal ${signalId}`);
          assert.ok(imported, `missing imported signal ${signalId}`);
          assert.equal(imported?.status, "pending");
          assert.equal(imported?.producer, "bagakit-skill-selector");
          assert.equal(imported?.source_channel, exported?.source_channel);
          assert.equal(imported?.topic_hint, exported?.topic_hint);
          assert.deepEqual(imported?.evidence, exported?.evidence);
          assert.deepEqual(imported?.local_refs, exported?.local_refs);
          assert.equal(imported?.created_at, exported?.created_at);
          assert.equal(imported?.updated_at, exported?.updated_at);
          assert.ok(signalFiles.includes(`${signalId}.json`));
        }
        assert.equal(usageSignalsById.get("driver-load-review")?.status, "imported");
        assert.equal(usageSignalsById.get("retry-bagakit-skill-selector-driver-pack-load")?.status, "imported");
        assert.equal(
          usageSignalsById.get("pattern-bagakit-skill-selector-driver-load-failure-loaded-selector-drivers")?.status,
          "imported",
        );
        assert.ok(
          (usageSignalsById.get("driver-load-review")?.updated_at ?? "") >=
          (usageSignalsById.get("driver-load-review")?.timestamp ?? ""),
        );
        assert.ok(surveyText.includes("Candidate Survey"));
        assert.ok(surveyText.includes("Project Preference Hints"));
        assert.ok(surveyText.includes("bagakit-brainstorm"));
        assert.ok(surveyText.includes("repo_visible"));
        assert.ok(surveyText.includes("| bagakit-researcher | local | repo_visible | available | yes | neutral |"));
        assert.ok(driverText.includes("bagakit-researcher"));
        assert.ok(driverText.includes("RetryBackoffThreshold: `3`"));
        assert.ok(driverText.includes("EvolverReview=<pending review signals or none>"));
        assert.ok(rankingText.includes("Skill Ranking Report"));
        assert.ok(rankingText.includes("## Evolver Review Signals"));
        assert.equal(evolverExportPayload.schema, "bagakit.evolver.signal.v1");

          return {
          assertions: [
            "selector log records retry backoff and new-search requirement after repeated failures",
            "candidate survey keeps visible, available, selected, and project-hint state explicit without becoming task SSOT drift",
            "selector auto-generated retry and error-pattern review signals are exported with normalized ids and routeable topic hints",
            "driver pack includes composed peers declared by the chosen plans",
            "skill ranking report is produced from the same task log without a second control plane",
            "selector review signals bridge through the default suggested path into evolver intake without auto-opening a topic",
          ],
          commands: [
            `node --experimental-strip-types ${script} init --file <temp-repo>/.bagakit/skill-selector/tasks/demo/skill-usage.toml --task-id demo-task --objective "eval selector loop" --owner validator`,
            `node --experimental-strip-types ${script} candidate-survey --file <temp-repo>/.bagakit/skill-selector/tasks/demo/skill-usage.toml --root . --output <temp-repo>/.bagakit/skill-selector/tasks/demo/candidate-survey.md`,
            `node --experimental-strip-types ${script} drivers --file <temp-repo>/.bagakit/skill-selector/tasks/demo/skill-usage.toml --root . --output <temp-repo>/.bagakit/skill-selector/tasks/demo/bagakit-drivers.md`,
            `node --experimental-strip-types ${script} skill-ranking --file <temp-repo>/.bagakit/skill-selector/tasks/demo/skill-usage.toml --output <temp-repo>/.bagakit/skill-selector/tasks/demo/skill-ranking.md`,
            `node --experimental-strip-types ${script} evolver-bridge --file <temp-repo>/.bagakit/skill-selector/tasks/demo/skill-usage.toml --root <temp-repo> --output <temp-repo>/.bagakit/skill-selector/tasks/demo/evolver-signals.json`,
          ],
          artifacts: [
            { label: "usage-log", path: target },
            { label: "candidate-survey", path: survey },
            { label: "driver-pack", path: driverPack },
            { label: "ranking-report", path: ranking },
            { label: "evolver-export", path: evolverExport },
          ],
          outputs: {
            ranking_top_line: rankingText.split("\n").find((line) => line.includes("| 1 |")) ?? "",
            evolver_signal_count: signalFiles.length,
          },
            replacements,
          };
        } finally {
          cleanupTempDir(tempRepo, context.keepTemp);
        }
      },
    },
    {
      id: "disabled-handoff-policy-suppresses-auto-signal",
      title: "Disabled Handoff Policy Suppresses Auto-Suggested Evolver Signal",
      summary: "Retry backoff should still trigger task-local search, but selector should not claim or emit an evolver review signal when auto-suggestion is disabled.",
      focus: ["retry-backoff", "evolver-handoff-policy", "negative-path"],
      run: (context) => {
        const { repoRoot } = context;
        const tempRepo = createTempDir("bagakit-skill-selector-disabled-");
        const replacements = registerTempRepo(context, tempRepo);
        try {
          const target = path.join(tempRepo, ".bagakit", "skill-selector", "tasks", "disabled", "skill-usage.toml");
          const script = path.join(repoRoot, "skills", "harness", "bagakit-skill-selector", "scripts", "skill_selector.ts");
          const run = (argv: string[], label: string) => {
            const result = runCommand("node", ["--experimental-strip-types", script, ...argv], { cwd: repoRoot, replacements });
            expectOk(result, label);
            return result;
          };

          run(["init", "--file", target, "--task-id", "disabled-task", "--objective", "disable auto evolver signal", "--owner", "validator"], "init disabled");

          const initialText = fs.readFileSync(target, "utf8").replace("enabled = true", "enabled = false");
          fs.writeFileSync(target, initialText, "utf8");

          run(["usage", "--file", target, "--skill-id", "bagakit-skill-selector", "--phase", "execution", "--attempt-key", "disabled-backoff", "--action", "run selector with disabled evolver handoff", "--result", "failed", "--evidence", "suite.ts"], "usage disabled 1");
          run(["usage", "--file", target, "--skill-id", "bagakit-skill-selector", "--phase", "execution", "--attempt-key", "disabled-backoff", "--action", "run selector with disabled evolver handoff", "--result", "failed", "--evidence", "suite.ts"], "usage disabled 2");
          const usage3 = run(["usage", "--file", target, "--skill-id", "bagakit-skill-selector", "--phase", "execution", "--attempt-key", "disabled-backoff", "--action", "run selector with disabled evolver handoff", "--result", "failed", "--evidence", "suite.ts"], "usage disabled 3");

          const finalText = fs.readFileSync(target, "utf8");
          const disabledDoc = readSkillUsageDoc(target);
          assert.ok(finalText.includes("enabled = false"));
          assert.ok(finalText.includes("needs_new_search = true"));
          assert.equal(disabledDoc.evolver_signal_log.length, 0);
          assert.ok(!usage3.stdout.includes("evolver review signal suggested"));
          assert.ok(usage3.stdout.includes("backoff required for bagakit-skill-selector:disabled-backoff after try-3"));

          return {
            assertions: [
              "retry backoff still marks task-local search follow-up when handoff auto-suggestion is disabled",
              "selector does not claim or write an evolver review signal when the policy is disabled",
            ],
            commands: [
              `node --experimental-strip-types ${script} init --file <temp-repo>/.bagakit/skill-selector/tasks/disabled/skill-usage.toml --task-id disabled-task --objective "disable auto evolver signal" --owner validator`,
              `node --experimental-strip-types ${script} usage --file <temp-repo>/.bagakit/skill-selector/tasks/disabled/skill-usage.toml --skill-id bagakit-skill-selector --phase execution --attempt-key disabled-backoff --action "run selector with disabled evolver handoff" --result failed --evidence suite.ts`,
            ],
            artifacts: [{ label: "usage-log", path: target }],
            outputs: {
              usage_stdout: usage3.stdout.trim(),
            },
            replacements,
          };
        } finally {
          cleanupTempDir(tempRepo, context.keepTemp);
        }
      },
    },
    {
      id: "candidate-survey-without-preferences-is-noop",
      title: "Candidate Survey Without Preferences Is A No-Op",
      summary: "Selector should still produce a readable candidate survey when no project-preferences file exists.",
      focus: ["candidate-survey", "project-preferences", "negative-path"],
      run: (context) => {
        const { repoRoot } = context;
        const tempRepo = createTempDir("bagakit-skill-selector-survey-");
        const replacements = registerTempRepo(context, tempRepo);
        try {
          const target = path.join(tempRepo, ".bagakit", "skill-selector", "tasks", "survey", "skill-usage.toml");
          const survey = path.join(tempRepo, ".bagakit", "skill-selector", "tasks", "survey", "candidate-survey.md");
          const script = path.join(repoRoot, "skills", "harness", "bagakit-skill-selector", "scripts", "skill_selector.ts");
          const run = (argv: string[], label: string) => {
            const result = runCommand("node", ["--experimental-strip-types", script, ...argv], { cwd: repoRoot, replacements });
            expectOk(result, label);
            return result;
          };

          run(["init", "--file", target, "--task-id", "survey-task", "--objective", "find the right selector-adjacent skill", "--owner", "validator"], "init survey");
          run(["preflight", "--file", target, "--answer", "partial", "--gap-summary", "need explicit comparison", "--decision", "compare_then_execute", "--status", "in_progress"], "preflight survey");
          run([
            "plan",
            "--file",
            target,
            "--skill-id",
            "bagakit-skill-selector",
            "--kind",
            "local",
            "--source",
            "skills/harness/bagakit-skill-selector",
            "--why",
            "compare selector-adjacent options",
            "--expected-impact",
            "keep candidate coverage explicit",
            "--availability",
            "available",
            "--availability-detail",
            "available as a canonical local skill in the current catalog root",
          ], "plan survey");
          run(["candidate-survey", "--file", target, "--root", repoRoot, "--output", survey], "candidate-survey no prefs");

          const surveyText = fs.readFileSync(survey, "utf8");
          assert.ok(surveyText.includes("Candidate Survey"));
          assert.ok(surveyText.includes("Preferences: none"));
          assert.ok(surveyText.includes("| bagakit-skill-selector | local | repo_visible | available | yes | neutral |"));

          return {
            assertions: [
              "candidate survey remains usable when no project-preferences file exists",
              "missing project-preferences file stays a no-op instead of a validation or runtime failure",
            ],
            commands: [
              `node --experimental-strip-types ${script} candidate-survey --file <temp-repo>/.bagakit/skill-selector/tasks/survey/skill-usage.toml --root . --output <temp-repo>/.bagakit/skill-selector/tasks/survey/candidate-survey.md`,
            ],
            artifacts: [{ label: "candidate-survey", path: survey }],
            outputs: {
              survey_header: surveyText.split("\n").slice(0, 6).join(" | "),
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
