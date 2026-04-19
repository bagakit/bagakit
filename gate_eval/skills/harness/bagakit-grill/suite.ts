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
  id: "bagakit-grill-starter-eval",
  owner: "gate_eval/skills/harness/bagakit-grill",
  title: "Grill Starter Eval",
  summary: "Check deterministic grill run lifecycle, one-question progression, research-needed handoff, convergence checks, and generated brief projection.",
  defaultOutputDir: "gate_eval/skills/harness/bagakit-grill/results/runs",
  cases: [
    {
      id: "structured-run-drives-readonly-brief",
      title: "Structured Run Drives Readonly Brief",
      summary: "A grill run should progress through questions and one research-needed node, require convergence before completion, and keep the brief generated from structured truth.",
      focus: ["structured-ssot", "one-question", "option-surface", "research-needed", "convergence-check", "readonly-brief"],
      run: (context) => {
        const { repoRoot } = context;
        const tempRepo = createTempDir("bagakit-grill-eval-");
        const replacements = registerTempRepo(context, tempRepo);
        const cli = path.join(repoRoot, "skills", "harness", "bagakit-grill", "scripts", "grill.sh");
        try {
          expectOk(runCommand("bash", [cli, "init", "--root", tempRepo, "--run-id", "eval", "--target", "Design a compact grill skill"], { cwd: repoRoot, replacements }), "init");
          expectOk(runCommand("bash", [cli, "plan", "--root", tempRepo, "--run", "eval", "--node", "q001", "--question", "Is the target grillable?", "--option", "Yes, it has a concrete target snapshot.", "--option", "No, route back to Spark for framing.", "--decision", "intake boundary", "--recommended-answer", "Yes, it has a concrete target snapshot.", "--rationale", "Grill starts only after Spark-worthy vagueness is resolved."], { cwd: repoRoot, replacements }), "plan q001");
          const nextQ = runCommand("bash", [cli, "next", "--root", tempRepo, "--run", "eval", "--json"], { cwd: repoRoot, replacements });
          expectOk(nextQ, "next q001");
          const nextPayload = JSON.parse(nextQ.stdout) as { next: { id: string } };
          assert.equal(nextPayload.next.id, "q001");
          expectOk(runCommand("bash", [cli, "answer", "--root", tempRepo, "--run", "eval", "--node", "q001", "--answer", "Yes, continue with grill."], { cwd: repoRoot, replacements }), "answer q001");
          expectOk(runCommand("bash", [cli, "plan", "--root", tempRepo, "--run", "eval", "--node", "q002", "--depends-on", "q001", "--question", "Should completion require a branch-width check after multi-round agreement?", "--option", "Record close/switch/correct before completing.", "--option", "Complete automatically once all nodes are answered.", "--decision", "convergence boundary", "--recommended-answer", "Yes, record close/switch/correct before completing.", "--rationale", "Repeated agreement can hide a narrow question path."], { cwd: repoRoot, replacements }), "plan q002");
          expectOk(runCommand("bash", [cli, "answer", "--root", tempRepo, "--run", "eval", "--node", "q002", "--answer", "Yes, close only after checking adjacent branches."], { cwd: repoRoot, replacements }), "answer q002");
          expectOk(runCommand("bash", [cli, "plan", "--root", tempRepo, "--run", "eval", "--node", "r001", "--kind", "research_needed", "--depends-on", "q002", "--question", "What prior art should shape the next question?", "--decision", "question quality evidence", "--recommended-answer", "Use researcher through selector.", "--rationale", "Grill identifies research gaps without executing research."], { cwd: repoRoot, replacements }), "plan r001");
          expectOk(runCommand("bash", [cli, "attach-evidence", "--root", tempRepo, "--run", "eval", "--node", "r001", "--evidence-ref", "researcher/topic#claim", "--summary", "One-question-at-a-time prior art."], { cwd: repoRoot, replacements }), "attach evidence");
          const pendingStatus = runCommand("bash", [cli, "status", "--root", tempRepo, "--run", "eval", "--json"], { cwd: repoRoot, replacements });
          expectOk(pendingStatus, "pending status");
          assert.equal((JSON.parse(pendingStatus.stdout) as { status: string }).status, "convergence_pending");
          expectOk(runCommand("bash", [cli, "convergence-check", "--root", tempRepo, "--run", "eval", "--goal", "Protect Grill's plan-questioning boundary.", "--signal", "Two accepted answers left no current DAG branch open.", "--adjacent-branch", "Whether the target model itself needs correction before closure.", "--decision", "close"], { cwd: repoRoot, replacements }), "convergence check");
          expectOk(runCommand("bash", [cli, "render", "--root", tempRepo, "--run", "eval"], { cwd: repoRoot, replacements }), "render");

          const runPath = path.join(tempRepo, ".bagakit", "grill", "runs", "eval", "grill-run.json");
          const briefPath = path.join(tempRepo, ".bagakit", "grill", "runs", "eval", "grill-brief.md");
          const run = JSON.parse(fs.readFileSync(runPath, "utf8")) as { status: string; question_nodes: Array<{ status: string; options_considered?: string[] }>; qa_events: Array<{ options_considered?: string[] }>; convergence_check: { status: string; decision: string } };
          const brief = fs.readFileSync(briefPath, "utf8");
          assert.equal(run.status, "complete");
          assert.equal(run.question_nodes[0].status, "answered");
          assert.equal(run.question_nodes[1].status, "answered");
          assert.equal(run.question_nodes[2].status, "evidence_attached");
          assert.equal(run.question_nodes[0].options_considered?.length, 2);
          assert.equal(run.qa_events[0].options_considered?.length, 2);
          assert.equal(run.qa_events.length, 2);
          assert.equal(run.convergence_check.status, "resolved");
          assert.equal(run.convergence_check.decision, "close");
          assert.ok(brief.includes("Generated by bagakit-grill"));
          assert.ok(brief.includes("Options considered"));
          assert.ok(brief.includes("convergence_check: resolved"));
          assert.ok(!brief.includes("question_nodes"));

          return {
            assertions: [
              "structured grill-run.json is authoritative",
              "next selects one ready question",
              "question nodes preserve the option surface before recommendation",
              "research_needed can be satisfied by attached evidence refs",
              "multi-round no-branch requires convergence-check before completion",
              "grill-brief.md is generated and omits full state fields",
            ],
            commands: [
              `bash ${cli} init --root <temp-repo> --run-id eval --target "Design a compact grill skill"`,
              `bash ${cli} plan --root <temp-repo> --run eval --node q001 --option ... --option ...`,
              `bash ${cli} next --root <temp-repo> --run eval --json`,
              `bash ${cli} answer --root <temp-repo> --run eval --node q001 --answer ...`,
              `bash ${cli} answer --root <temp-repo> --run eval --node q002 --answer ...`,
              `bash ${cli} attach-evidence --root <temp-repo> --run eval --node r001 --evidence-ref researcher/topic#claim --summary ...`,
              `bash ${cli} convergence-check --root <temp-repo> --run eval --goal ... --decision close`,
              `bash ${cli} render --root <temp-repo> --run eval`,
            ],
            artifacts: [
              { label: "grill-run", path: runPath },
              { label: "grill-brief", path: briefPath },
            ],
            outputs: {
              run_status: run.status,
              qa_events: run.qa_events.length,
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

export default SUITE;
