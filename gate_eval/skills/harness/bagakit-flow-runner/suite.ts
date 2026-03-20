import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runCommand, type CommandResult } from "../../../../dev/eval/src/lib/command.ts";
import type { EvalSuiteDefinition } from "../../../../dev/eval/src/lib/model.ts";
import { cleanupTempDir, createTempDir, registerTempRepo, writeTextFile } from "../../../../dev/eval/src/lib/temp.ts";

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

function featureId(tempRepo: string): string {
  const indexPath = path.join(tempRepo, ".bagakit", "feature-tracker", "index", "features.json");
  const payload = JSON.parse(fs.readFileSync(indexPath, "utf8")) as { features: Array<{ feat_id: string }> };
  return payload.features[0].feat_id;
}

export const SUITE: EvalSuiteDefinition = {
  id: "bagakit-flow-runner-shared-runner-eval",
  owner: "gate_eval/skills/harness/bagakit-flow-runner",
  title: "Flow Runner Shared Runner Eval",
  summary: "Measure deterministic next-action and closeout quality for bagakit-flow-runner.",
  defaultOutputDir: "gate_eval/skills/harness/bagakit-flow-runner/results/runs",
  cases: [
    {
      id: "next-and-closeout-packets-stay-coherent",
      title: "Next And Closeout Packets Stay Coherent",
      summary: "Tracker ingestion, next-action, resume candidates, and closeout state should stay coherent across one bounded execution loop.",
      focus: ["next-action", "resume-candidates", "closeout-signaling"],
      run: (context) => {
        const { repoRoot } = context;
        const tempRepo = createTempDir("bagakit-flow-runner-eval-");
        const replacements = registerTempRepo(context, tempRepo);
        try {
          initGitRepo(tempRepo, replacements);

        const trackerScript = path.join(repoRoot, "skills", "harness", "bagakit-feature-tracker", "scripts", "feature-tracker.sh");
        const flowScript = path.join(repoRoot, "skills", "harness", "bagakit-flow-runner", "scripts", "flow-runner.sh");
        expectOk(runCommand("bash", [trackerScript, "check-reference-readiness", "--root", tempRepo], { cwd: repoRoot, replacements }), "check-reference-readiness");
        expectOk(runCommand("bash", [trackerScript, "initialize-tracker", "--root", tempRepo], { cwd: repoRoot, replacements }), "initialize-tracker");
        expectOk(runCommand("bash", [trackerScript, "create-feature", "--root", tempRepo, "--title", "Flow source", "--slug", "flow-source", "--goal", "Drive flow", "--workspace-mode", "proposal_only"], { cwd: repoRoot, replacements }), "create-feature");
        const featId = featureId(tempRepo);
        expectOk(runCommand("bash", [trackerScript, "assign-feature-workspace", "--root", tempRepo, "--feature", featId, "--workspace-mode", "worktree"], { cwd: repoRoot, replacements }), "assign-feature-workspace");
        expectOk(runCommand("bash", [flowScript, "apply", "--root", tempRepo], { cwd: repoRoot, replacements }), "apply");
        expectOk(runCommand("bash", [flowScript, "ingest-feature-tracker", "--root", tempRepo], { cwd: repoRoot, replacements }), "ingest-feature-tracker");

        const itemId = `feature-${featId}`;
        const activateResult = runCommand("bash", [flowScript, "activate-feature-tracker", "--root", tempRepo, "--feature", featId, "--json"], { cwd: repoRoot, replacements });
        expectOk(activateResult, "activate-feature-tracker");
        const activatePayload = JSON.parse(activateResult.stdout) as Record<string, unknown>;
        assert.equal(activatePayload.schema, "bagakit/flow-runner/feature-activation/v1");
        assert.equal(activatePayload.command, "activate-feature-tracker");
        assert.equal(activatePayload.feature_id, featId);
        assert.equal(activatePayload.item_id, itemId);
        assert.equal((activatePayload.flow_next as Record<string, unknown>).recommended_action, "run_session");

        const nextResult = runCommand("bash", [flowScript, "next", "--root", tempRepo, "--json"], { cwd: repoRoot, replacements });
        expectOk(nextResult, "next");
        const nextPayload = JSON.parse(nextResult.stdout) as Record<string, unknown>;
        assert.equal(nextPayload.recommended_action, "run_session");

        const resumeResult = runCommand("bash", [flowScript, "resume-candidates", "--root", tempRepo, "--json"], { cwd: repoRoot, replacements });
        expectOk(resumeResult, "resume-candidates");
        const resumePayload = JSON.parse(resumeResult.stdout) as { live: Array<Record<string, unknown>> };
        assert.equal(resumePayload.live.length, 1);

        expectOk(runCommand("bash", [flowScript, "checkpoint", "--root", tempRepo, "--item", itemId, "--stage", "inspect", "--session-status", "progress", "--objective", "Inspect", "--attempted", "Read runtime", "--result", "Ready", "--next-action", "Run one bounded session", "--clean-state", "yes", "--json"], { cwd: repoRoot, replacements }), "checkpoint inspect");
        expectOk(runCommand("bash", [flowScript, "checkpoint", "--root", tempRepo, "--item", itemId, "--stage", "review", "--session-status", "gate_passed", "--objective", "Review", "--attempted", "Check status", "--result", "Done", "--next-action", "Ask feature-tracker to close out", "--clean-state", "yes", "--json"], { cwd: repoRoot, replacements }), "checkpoint review");

        const stopResult = runCommand("bash", [flowScript, "next", "--root", tempRepo, "--item", itemId, "--json"], { cwd: repoRoot, replacements });
        expectOk(stopResult, "next closeout");
        const stopPayload = JSON.parse(stopResult.stdout) as Record<string, unknown>;
        assert.equal(stopPayload.recommended_action, "stop");
        assert.equal(stopPayload.action_reason, "closeout_pending");

        const statePath = path.join(tempRepo, ".bagakit", "flow-runner", "items", itemId, "state.json");
        const checkpointsPath = path.join(tempRepo, ".bagakit", "flow-runner", "items", itemId, "checkpoints.ndjson");
        assert.ok(fs.existsSync(statePath));
        assert.ok(fs.existsSync(checkpointsPath));

          return {
          assertions: [
            "initial next packet recommends a bounded session",
            "explicit activation packet proves one tracker feature is execution-ready",
            "resume candidates surface the live tracker-backed item",
            "closeout next packet switches to stop with closeout_pending reason",
          ],
          commands: [
            `bash ${flowScript} apply --root <temp-repo>`,
            `bash ${flowScript} ingest-feature-tracker --root <temp-repo>`,
            `bash ${flowScript} activate-feature-tracker --root <temp-repo> --feature ${featId} --json`,
            `bash ${flowScript} next --root <temp-repo> --json`,
            `bash ${flowScript} resume-candidates --root <temp-repo> --json`,
            `bash ${flowScript} checkpoint --root <temp-repo> --item ${itemId} --stage inspect --session-status progress --objective "Inspect" --attempted "Read runtime" --result "Ready" --next-action "Run one bounded session" --clean-state yes --json`,
            `bash ${flowScript} checkpoint --root <temp-repo> --item ${itemId} --stage review --session-status gate_passed --objective "Review" --attempted "Check status" --result "Done" --next-action "Ask feature-tracker to close out" --clean-state yes --json`,
          ],
          artifacts: [
            { label: "runner-state", path: statePath },
            { label: "runner-checkpoints", path: checkpointsPath },
          ],
          outputs: {
            live_candidates: resumePayload.live.length,
            item_id: itemId,
          },
            replacements,
          };
        } finally {
          cleanupTempDir(tempRepo, context.keepTemp);
        }
      },
    },
    {
      id: "planning-entry-handoff-reaches-flow-activation",
      title: "Planning Entry Handoff Reaches Flow Activation",
      summary: "An approved planning-entry handoff should materialize tracker truth and then activate into a runnable flow-runner packet without hidden host translation.",
      focus: ["planning-entry-handoff", "feature-materialization", "flow-activation"],
      run: (context) => {
        const { repoRoot } = context;
        const tempRepo = createTempDir("bagakit-flow-runner-handoff-eval-");
        const replacements = registerTempRepo(context, tempRepo);
        try {
          initGitRepo(tempRepo, replacements);

          const trackerScript = path.join(repoRoot, "skills", "harness", "bagakit-feature-tracker", "scripts", "feature-tracker.sh");
          const flowScript = path.join(repoRoot, "skills", "harness", "bagakit-flow-runner", "scripts", "flow-runner.sh");
          expectOk(runCommand("bash", [trackerScript, "check-reference-readiness", "--root", tempRepo], { cwd: repoRoot, replacements }), "check-reference-readiness");
          expectOk(runCommand("bash", [trackerScript, "initialize-tracker", "--root", tempRepo], { cwd: repoRoot, replacements }), "initialize-tracker");
          expectOk(runCommand("bash", [flowScript, "apply", "--root", tempRepo], { cwd: repoRoot, replacements }), "apply");

          const handoffPath = path.join(tempRepo, ".bagakit", "planning-entry", "handoffs", "approved.json");
          writeTextFile(
            handoffPath,
            `${JSON.stringify({
              schema: "bagakit/planning-entry-handoff/v1",
              handoff_id: "peh-flow-eval-approved",
              created_at: "2026-04-26T00:00:00Z",
              updated_at: "2026-04-26T00:00:00Z",
              status: "approved",
              producer_surface: "bagakit-brainstorm",
              title: "Flow activation from handoff",
              goal: "Move an approved planning-entry handoff into runnable execution truth",
              objective: "Create canonical planning truth and then activate one runnable flow item.",
              demand_summary: "The request was clarified upstream and is ready for bounded execution setup.",
              success_criteria: ["Tracker truth and flow activation happen without markdown scraping."],
              constraints: ["Do not create a second planning SSOT."],
              clarification_status: "complete",
              discussion_clear: true,
              user_review_status: "approved",
              recommended_route: {
                scene: "ambiguous_delivery",
                recipe_id: "planning-entry-brainstorm-feature-flow",
              },
              source_artifacts: [
                ".bagakit/brainstorm/archive/eval/input_and_qa.md",
                ".bagakit/brainstorm/archive/eval/expert_forum.md",
                ".bagakit/brainstorm/archive/eval/outcome_and_handoff.md",
              ],
              source_refs: [
                "input_and_qa.md#Q-001",
                "expert_forum.md#Decision-Target-And-Exit",
                "outcome_and_handoff.md#Outcome-Summary",
              ],
            }, null, 2)}\n`,
          );

          expectOk(
            runCommand(
              "bash",
              [trackerScript, "create-feature-from-planning-entry-handoff", "--root", tempRepo, "--handoff", handoffPath, "--workspace-mode", "current_tree"],
              { cwd: repoRoot, replacements },
            ),
            "create-feature-from-planning-entry-handoff",
          );
          const featId = featureId(tempRepo);

          const activateResult = runCommand("bash", [flowScript, "activate-feature-tracker", "--root", tempRepo, "--feature", featId, "--json"], { cwd: repoRoot, replacements });
          expectOk(activateResult, "activate-feature-tracker");
          const activatePayload = JSON.parse(activateResult.stdout) as Record<string, unknown>;
          assert.equal(activatePayload.schema, "bagakit/flow-runner/feature-activation/v1");
          assert.equal(activatePayload.feature_id, featId);
          assert.equal((activatePayload.flow_next as Record<string, unknown>).recommended_action, "run_session");

          const proposalPath = path.join(tempRepo, ".bagakit", "feature-tracker", "features", featId, "proposal.md");
          const proposalText = fs.readFileSync(proposalPath, "utf8");
          assert.ok(proposalText.includes("peh-flow-eval-approved"));
          assert.ok(proposalText.includes("planning-entry-brainstorm-feature-flow"));

          return {
            assertions: [
              "approved planning-entry handoff materializes canonical feature-tracker truth",
              "the same feature activates into a runnable flow-runner packet through an explicit bridge",
              "tracker proposal projection preserves the handoff id and recommended route for traceability",
            ],
            commands: [
              `bash ${trackerScript} initialize-tracker --root <temp-repo>`,
              `bash ${flowScript} apply --root <temp-repo>`,
              `bash ${trackerScript} create-feature-from-planning-entry-handoff --root <temp-repo> --handoff <temp-repo>/.bagakit/planning-entry/handoffs/approved.json --workspace-mode current_tree`,
              `bash ${flowScript} activate-feature-tracker --root <temp-repo> --feature ${featId} --json`,
            ],
            artifacts: [
              { label: "planning-entry-handoff", path: handoffPath },
              { label: "feature-proposal", path: proposalPath },
            ],
            outputs: {
              feat_id: featId,
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
