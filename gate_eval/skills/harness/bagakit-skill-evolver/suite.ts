import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runCommand, type CommandResult } from "../../../../dev/eval/src/lib/command.ts";
import { createTempDir, writeTextFile } from "../../../../dev/eval/src/lib/temp.ts";
import type { EvalCaseContext, EvalSuiteDefinition } from "../../../../dev/eval/src/lib/model.ts";

const EVOLVER_CLI = "skills/harness/bagakit-skill-evolver/scripts/evolver.ts";

function createFixtureRepo(): string {
  const repo = createTempDir("bagakit-evolver-eval-");
  writeTextFile(path.join(repo, "README.md"), "# eval\n");
  fs.mkdirSync(path.join(repo, "docs", "specs"), { recursive: true });
  return repo;
}

function tempReplacements(tempRepo: string): { from: string; to: string }[] {
  const canonicalTempRepo = fs.realpathSync(tempRepo);
  return [
    { from: canonicalTempRepo, to: "<temp-repo>" },
    { from: tempRepo, to: "<temp-repo>" },
  ];
}

function registerTempReplacements(context: EvalCaseContext, tempRepo: string): { from: string; to: string }[] {
  const replacements = tempReplacements(tempRepo);
  for (const replacement of replacements) {
    context.addReplacement(replacement.from, replacement.to);
  }
  return replacements;
}

function runEvolver(
  context: EvalCaseContext,
  tempRepo: string,
  argv: string[],
): CommandResult {
  return runCommand(
    "node",
    ["--experimental-strip-types", EVOLVER_CLI, ...argv, "--root", tempRepo],
    {
      cwd: context.repoRoot,
      replacements: tempReplacements(tempRepo),
    },
  );
}

function cleanupTempDir(tempRepo: string, keepTemp: boolean): void {
  if (!keepTemp) {
    fs.rmSync(tempRepo, { recursive: true, force: true });
  }
}

function assertContains(text: string, fragment: string, label: string, assertions: string[]): void {
  assert.ok(text.includes(fragment), `${label} missing fragment: ${fragment}`);
  assertions.push(`${label} contains ${JSON.stringify(fragment)}`);
}

export const SUITE: EvalSuiteDefinition = {
  id: "bagakit-skill-evolver-deterministic-eval",
  owner: "gate_eval/skills/harness/bagakit-skill-evolver",
  title: "Bagakit Skill Evolver Eval",
  summary:
    "Measure deterministic non-gating evidence ingest, report quality, promotion readiness, routing, and weak-link warning behavior.",
  defaultOutputDir: "gate_eval/skills/harness/bagakit-skill-evolver/results/runs",
  cases: [
    {
      id: "evidence-ingest",
      title: "Evidence Ingest",
      summary: "Structured evidence records should accumulate before routing is set.",
      focus: ["evidence-ingest", "promotion-readiness"],
      run: (context) => {
        const tempRepo = createFixtureRepo();
        const replacements = registerTempReplacements(context, tempRepo);
        const commands: string[] = [];
        try {
          const run = (argv: string[]): CommandResult => {
            commands.push(
              `node --experimental-strip-types ${EVOLVER_CLI} ${argv.join(" ")} --root <temp-repo>`,
            );
            return runEvolver(context, tempRepo, argv);
          };

          writeTextFile(path.join(tempRepo, "docs", "specs", "signal.md"), "signal\n");
          assert.equal(run(["init-topic", "--slug", "evidence-loop", "--title", "Evidence Loop"]).status, 0);
          assert.equal(
            run(["preflight", "--topic", "evidence-loop", "--decision", "track", "--rationale", "repo-scope"]).status,
            0,
          );
          assert.equal(
            run([
              "add-source",
              "--topic",
              "evidence-loop",
              "--source-id",
              "s1",
              "--kind",
              "doc",
              "--title",
              "Signal",
              "--origin",
              "manual",
              "--local-ref",
              "docs/specs/signal.md",
            ]).status,
            0,
          );
          assert.equal(
            run([
              "add-feedback",
              "--topic",
              "evidence-loop",
              "--channel",
              "maintainer",
              "--signal",
              "positive",
              "--detail",
              "worth keeping",
            ]).status,
            0,
          );
          assert.equal(
            run([
              "add-benchmark",
              "--topic",
              "evidence-loop",
              "--benchmark",
              "b1",
              "--metric",
              "report_quality",
              "--result",
              "pass",
            ]).status,
            0,
          );
          assert.equal(
            run([
              "record-decision",
              "--topic",
              "evidence-loop",
              "--decision",
              "Capture evidence",
              "--rationale",
              "repo-scope lesson",
            ]).status,
            0,
          );
          const readiness = run(["promotion-readiness", "--topic", "evidence-loop", "--json"]);
          assert.equal(readiness.status, 0);
          const payload = JSON.parse(readiness.stdout) as Record<string, unknown>;
          const evidenceCounts = payload.evidence_counts as Record<string, unknown>;
          assert.equal(payload.state, "blocked");
          assert.equal(evidenceCounts.sources, 1);
          assert.equal(evidenceCounts.feedback, 1);
          assert.equal(evidenceCounts.benchmarks, 1);

          return {
            assertions: [
              "promotion-readiness reports evidence counts before routing",
            ],
            commands,
            artifacts: [
              {
                label: "topic-dir",
                path: path.join(tempRepo, ".bagakit", "evolver", "topics", "evidence-loop"),
              },
            ],
            outputs: {
              readiness: payload,
            },
            replacements,
          };
        } finally {
          cleanupTempDir(tempRepo, context.keepTemp);
        }
      },
    },
    {
      id: "report-quality",
      title: "Report Quality",
      summary: "Derived reports should expose routing, proof, handoff, and archive closure.",
      focus: ["report-quality", "handoff"],
      run: (context) => {
        const assertions: string[] = [];
        const commands: string[] = [];
        const tempRepo = createFixtureRepo();
        const replacements = registerTempReplacements(context, tempRepo);
        try {
          const run = (argv: string[]): CommandResult => {
            commands.push(
              `node --experimental-strip-types ${EVOLVER_CLI} ${argv.join(" ")} --root <temp-repo>`,
            );
            return runEvolver(context, tempRepo, argv);
          };

          writeTextFile(path.join(tempRepo, "docs", "specs", "report-rule.md"), "rule\n");
          writeTextFile(path.join(tempRepo, "docs", "specs", "report-rule-proof.md"), "proof\n");
          assert.equal(run(["init-topic", "--slug", "report-quality", "--title", "Report Quality"]).status, 0);
          assert.equal(
            run(["preflight", "--topic", "report-quality", "--decision", "track", "--rationale", "repo-scope"]).status,
            0,
          );
          assert.equal(
            run([
              "add-candidate",
              "--topic",
              "report-quality",
              "--candidate",
              "c1",
              "--kind",
              "local",
              "--source",
              "skills/demo",
              "--summary",
              "candidate",
            ]).status,
            0,
          );
          assert.equal(
            run([
              "add-source",
              "--topic",
              "report-quality",
              "--source-id",
              "s1",
              "--kind",
              "doc",
              "--title",
              "Rule",
              "--origin",
              "manual",
              "--local-ref",
              "docs/specs/report-rule.md",
            ]).status,
            0,
          );
          assert.equal(
            run([
              "record-decision",
              "--topic",
              "report-quality",
              "--decision",
              "Ship report rule",
              "--rationale",
              "durable",
            ]).status,
            0,
          );
          assert.equal(
            run([
              "record-promotion",
              "--topic",
              "report-quality",
              "--surface",
              "spec",
              "--target",
              "docs/specs/report-rule.md",
              "--summary",
              "land rule",
              "--promotion",
              "report-rule",
              "--status",
              "landed",
              "--ref",
              "docs/specs/report-rule.md",
              "--proof-refs",
              "docs/specs/report-rule-proof.md",
            ]).status,
            0,
          );
          assert.equal(
            run([
              "set-route",
              "--topic",
              "report-quality",
              "--decision",
              "upstream",
              "--rationale",
              "reusable",
              "--upstream-promotions",
              "report-rule",
            ]).status,
            0,
          );
          assert.equal(
            run(["archive-topic", "--topic", "report-quality", "--summary", "archive report topic"]).status,
            0,
          );
          assert.equal(run(["check"]).status, 0);

          const topicDir = path.join(tempRepo, ".bagakit", "evolver", "topics", "report-quality");
          const report = fs.readFileSync(path.join(topicDir, "REPORT.md"), "utf8");
          const handoff = fs.readFileSync(path.join(topicDir, "HANDOFF.md"), "utf8");
          const archive = fs.readFileSync(path.join(topicDir, "ARCHIVE.md"), "utf8");
          assertContains(report, "## Routing Decision", "REPORT.md", assertions);
          assertContains(report, "proof:", "REPORT.md", assertions);
          assertContains(handoff, "## Strongest Evidence", "HANDOFF.md", assertions);
          assertContains(handoff, "## Open Promotion Actions", "HANDOFF.md", assertions);
          assertContains(archive, "## Promotion Trail", "ARCHIVE.md", assertions);
          assertContains(archive, "docs/specs/report-rule-proof.md", "ARCHIVE.md", assertions);

          return {
            assertions,
            commands,
            artifacts: [
              {
                label: "report-topic-dir",
                path: topicDir,
              },
            ],
            replacements,
          };
        } finally {
          cleanupTempDir(tempRepo, context.keepTemp);
        }
      },
    },
    {
      id: "promotion-readiness",
      title: "Promotion Readiness",
      summary: "Landed promotions should require proof refs and produce a landed readiness state.",
      focus: ["promotion-readiness", "proof-refs"],
      run: (context) => {
        const tempRepo = createFixtureRepo();
        const replacements = registerTempReplacements(context, tempRepo);
        const commands: string[] = [];
        try {
          const run = (argv: string[]): CommandResult => {
            commands.push(
              `node --experimental-strip-types ${EVOLVER_CLI} ${argv.join(" ")} --root <temp-repo>`,
            );
            return runEvolver(context, tempRepo, argv);
          };

          writeTextFile(path.join(tempRepo, "docs", "specs", "promo.md"), "promo\n");
          writeTextFile(path.join(tempRepo, "docs", "specs", "promo-proof.md"), "proof\n");
          assert.equal(run(["init-topic", "--slug", "promo-ready", "--title", "Promo Ready"]).status, 0);
          assert.equal(
            run(["preflight", "--topic", "promo-ready", "--decision", "track", "--rationale", "repo-scope"]).status,
            0,
          );
          assert.equal(
            run([
              "add-source",
              "--topic",
              "promo-ready",
              "--source-id",
              "s1",
              "--kind",
              "doc",
              "--title",
              "Promo",
              "--origin",
              "manual",
              "--local-ref",
              "docs/specs/promo.md",
            ]).status,
            0,
          );
          assert.equal(
            run([
              "record-decision",
              "--topic",
              "promo-ready",
              "--decision",
              "Land promotion",
              "--rationale",
              "ready",
            ]).status,
            0,
          );
          const badPromotion = run([
            "record-promotion",
            "--topic",
            "promo-ready",
            "--surface",
            "spec",
            "--target",
            "docs/specs/promo.md",
            "--summary",
            "land promo",
            "--promotion",
            "promo",
            "--status",
            "landed",
            "--ref",
            "docs/specs/promo.md",
          ]);
          assert.equal(badPromotion.status, 1);
          assert.ok(badPromotion.stderr.includes("landed promotion requires --proof-refs"));
          assert.equal(
            run([
              "record-promotion",
              "--topic",
              "promo-ready",
              "--surface",
              "spec",
              "--target",
              "docs/specs/promo.md",
              "--summary",
              "land promo",
              "--promotion",
              "promo",
              "--status",
              "landed",
              "--ref",
              "docs/specs/promo.md",
              "--proof-refs",
              "docs/specs/promo-proof.md",
            ]).status,
            0,
          );
          assert.equal(
            run([
              "set-route",
              "--topic",
              "promo-ready",
              "--decision",
              "upstream",
              "--rationale",
              "reusable",
              "--upstream-promotions",
              "promo",
            ]).status,
            0,
          );
          const readiness = JSON.parse(
            run(["promotion-readiness", "--topic", "promo-ready", "--json"]).stdout,
          ) as Record<string, unknown>;
          assert.equal(readiness.state, "upstream-landed");
          assert.equal(readiness.archive_ready, true);

          return {
            assertions: [
              "landed promotion requires explicit proof refs and becomes upstream-landed",
            ],
            warnings: [
              "proof-ref enforcement remains validator-backed; this slice records the resulting operator-facing readiness state.",
            ],
            commands,
            outputs: {
              readiness,
              rejectedPromotionStderr: badPromotion.stderr.trim(),
            },
            replacements,
          };
        } finally {
          cleanupTempDir(tempRepo, context.keepTemp);
        }
      },
    },
    {
      id: "routing",
      title: "Routing",
      summary: "Host, upstream, and split routes should remain explicit and repository-scoped.",
      focus: ["routing", "repo-boundary"],
      run: (context) => {
        const tempRepo = createFixtureRepo();
        const replacements = registerTempReplacements(context, tempRepo);
        const commands: string[] = [];
        try {
          const run = (argv: string[]): CommandResult => {
            commands.push(
              `node --experimental-strip-types ${EVOLVER_CLI} ${argv.join(" ")} --root <temp-repo>`,
            );
            return runEvolver(context, tempRepo, argv);
          };

          writeTextFile(path.join(tempRepo, "docs", "host-note.md"), "host\n");
          writeTextFile(path.join(tempRepo, "docs", "specs", "split.md"), "split\n");
          writeTextFile(path.join(tempRepo, "docs", "specs", "split-proof.md"), "proof\n");

          assert.equal(run(["init-topic", "--slug", "host-topic", "--title", "Host Topic"]).status, 0);
          assert.equal(
            run(["preflight", "--topic", "host-topic", "--decision", "track", "--rationale", "host case"]).status,
            0,
          );
          assert.equal(
            run([
              "add-source",
              "--topic",
              "host-topic",
              "--source-id",
              "s1",
              "--kind",
              "doc",
              "--title",
              "Host",
              "--origin",
              "manual",
              "--local-ref",
              "docs/host-note.md",
            ]).status,
            0,
          );
          assert.equal(
            run([
              "record-decision",
              "--topic",
              "host-topic",
              "--decision",
              "Keep host-side",
              "--rationale",
              "host only",
            ]).status,
            0,
          );
          assert.equal(
            run([
              "set-route",
              "--topic",
              "host-topic",
              "--decision",
              "host",
              "--rationale",
              "host adoption",
              "--host-target",
              "docs/host-note.md",
            ]).status,
            0,
          );
          const hostReadiness = JSON.parse(
            run(["promotion-readiness", "--topic", "host-topic", "--json"]).stdout,
          ) as Record<string, unknown>;
          assert.equal(hostReadiness.state, "host-proposed");

          assert.equal(run(["init-topic", "--slug", "split-topic", "--title", "Split Topic"]).status, 0);
          assert.equal(
            run(["preflight", "--topic", "split-topic", "--decision", "track", "--rationale", "split case"]).status,
            0,
          );
          assert.equal(
            run([
              "add-source",
              "--topic",
              "split-topic",
              "--source-id",
              "s1",
              "--kind",
              "doc",
              "--title",
              "Split",
              "--origin",
              "manual",
              "--local-ref",
              "docs/specs/split.md",
            ]).status,
            0,
          );
          assert.equal(
            run([
              "record-decision",
              "--topic",
              "split-topic",
              "--decision",
              "Split route",
              "--rationale",
              "mixed lesson",
            ]).status,
            0,
          );
          assert.equal(
            run([
              "record-promotion",
              "--topic",
              "split-topic",
              "--surface",
              "spec",
              "--target",
              "docs/specs/split.md",
              "--summary",
              "land split spec",
              "--promotion",
              "split-spec",
              "--status",
              "proposed",
            ]).status,
            0,
          );
          assert.equal(
            run([
              "set-route",
              "--topic",
              "split-topic",
              "--decision",
              "split",
              "--rationale",
              "host plus upstream",
              "--host-target",
              "docs/host-note.md",
              "--upstream-promotions",
              "split-spec",
            ]).status,
            0,
          );
          const splitReadiness = JSON.parse(
            run(["promotion-readiness", "--topic", "split-topic", "--json"]).stdout,
          ) as Record<string, unknown>;
          assert.equal(splitReadiness.state, "split-proposed");

          return {
            assertions: [
              "host route stays separate from upstream promotions",
              "split route keeps host target and upstream promotion ids together without collapsing them",
            ],
            commands,
            outputs: {
              host: hostReadiness,
              split: splitReadiness,
            },
            replacements,
          };
        } finally {
          cleanupTempDir(tempRepo, context.keepTemp);
        }
      },
    },
    {
      id: "weak-link-refs",
      title: "Weak-Link Refs",
      summary: "Weak refs should warn without invalidating the topic.",
      focus: ["weak-link-warnings", "warning-surface"],
      run: (context) => {
        const tempRepo = createFixtureRepo();
        const replacements = registerTempReplacements(context, tempRepo);
        const commands: string[] = [];
        try {
          const run = (argv: string[]): CommandResult => {
            commands.push(
              `node --experimental-strip-types ${EVOLVER_CLI} ${argv.join(" ")} --root <temp-repo>`,
            );
            return runEvolver(context, tempRepo, argv);
          };

          assert.equal(run(["init-topic", "--slug", "weak-links", "--title", "Weak Links"]).status, 0);
          assert.equal(
            run(["preflight", "--topic", "weak-links", "--decision", "track", "--rationale", "weak-link warning"]).status,
            0,
          );
          assert.equal(
            run([
              "add-source",
              "--topic",
              "weak-links",
              "--source-id",
              "s1",
              "--kind",
              "doc",
              "--title",
              "Missing Summary",
              "--origin",
              "manual",
              "--summary-ref",
              "docs/specs/missing-summary.md",
            ]).status,
            0,
          );
          assert.equal(
            run([
              "add-context-ref",
              "--topic",
              "weak-links",
              "--ref",
              ".bagakit/researcher/topics/research/missing-topic/index.md",
            ]).status,
            0,
          );
          assert.equal(
            run([
              "record-decision",
              "--topic",
              "weak-links",
              "--decision",
              "Track weak refs",
              "--rationale",
              "warning only",
            ]).status,
            0,
          );
          const checkResult = run(["check"]);
          assert.equal(checkResult.status, 0);
          assert.ok(checkResult.stderr.includes("warn: weak-links: missing source ref target docs/specs/missing-summary.md"));
          assert.ok(
            checkResult.stderr.includes(
              "warn: weak-links: missing weak ref target .bagakit/researcher/topics/research/missing-topic/index.md",
            ),
          );

          return {
            assertions: [
              "missing weak-link refs stay warning-only",
            ],
            commands,
            outputs: {
              stderr: checkResult.stderr.trim(),
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
