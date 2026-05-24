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

function featureCount(tempRepo: string): number {
  const indexPath = path.join(tempRepo, ".bagakit", "feature-tracker", "index", "features.json");
  const payload = JSON.parse(fs.readFileSync(indexPath, "utf8")) as { features: Array<{ feat_id: string }> };
  return payload.features.length;
}

function writeReviewedTaskPlan(tempRepo: string, objective: string): string {
  const planPath = path.join(tempRepo, ".bagakit", "feature-tracker", "artifacts", "reviewed-task-plan.json");
  writeTextFile(
    planPath,
    `${JSON.stringify({
      schema: "bagakit.feature-task-plan.v1",
      review: {
        status: "approved",
        evidence_ref: "gate_eval/skills/harness/bagakit-feature-tracker/validation.toml",
      },
      source_refs: ["gate_eval/skills/harness/bagakit-feature-tracker/suite.ts"],
      tasks: [
        {
          id: "T-001",
          title: "Execute reviewed eval task",
          objective,
          outcome: "The eval observes public status projection from reviewed task truth.",
          acceptance: ["The public projection matches canonical task state."],
          verification: [
            {
              kind: "command",
              ref: "gate_eval/skills/harness/bagakit-feature-tracker/validation.toml",
              proves: "The deterministic eval case observes the intended public projection boundary.",
            },
          ],
          source_refs: ["gate_eval/skills/harness/bagakit-feature-tracker/suite.ts"],
          supersedes: [],
        },
      ],
    }, null, 2)}\n`,
  );
  return planPath;
}

export const SUITE: EvalSuiteDefinition = {
  id: "bagakit-feature-tracker-shared-runner-eval",
  owner: "gate_eval/skills/harness/bagakit-feature-tracker",
  title: "Feature Tracker Shared Runner Eval",
  summary: "Measure status projection and planning-entry integration quality for bagakit-feature-tracker.",
  defaultOutputDir: "gate_eval/skills/harness/bagakit-feature-tracker/results/runs",
  cases: [
    {
      id: "feature-status-projects-active-task",
      title: "Feature Status Projects Active Task",
      summary: "Starting a task should update feature status, task state, and the computed dependency projection coherently.",
      focus: ["state-transition", "status-projection", "computed-dependency-graph"],
      run: (context) => {
        const { repoRoot } = context;
        const tempRepo = createTempDir("bagakit-feature-tracker-eval-");
        const replacements = registerTempRepo(context, tempRepo);
        try {
          initGitRepo(tempRepo, replacements);

          const script = path.join(repoRoot, "skills", "harness", "bagakit-feature-tracker", "scripts", "feature-tracker.sh");
          expectOk(runCommand("bash", [script, "initialize-tracker", "--root", tempRepo], { cwd: repoRoot, replacements }), "initialize-tracker");
          expectOk(
            runCommand(
              "bash",
              [script, "create-feature", "--root", tempRepo, "--title", "Eval feature", "--slug", "eval-feature", "--goal", "Ship eval", "--workspace-mode", "proposal_only"],
              { cwd: repoRoot, replacements },
            ),
            "create-feature",
          );
          const featId = featureId(tempRepo);
          const planPath = writeReviewedTaskPlan(tempRepo, "Project the active eval task from reviewed semantic truth.");
          expectOk(runCommand("bash", [script, "set-task-plan", "--root", tempRepo, "--feature", featId, "--tasks-file", planPath, "--expected-revision", "0"], { cwd: repoRoot, replacements }), "set-task-plan");
          expectOk(runCommand("bash", [script, "assign-feature-workspace", "--root", tempRepo, "--feature", featId, "--workspace-mode", "current_tree"], { cwd: repoRoot, replacements }), "assign-feature-workspace");
          expectOk(runCommand("bash", [script, "start-task", "--root", tempRepo, "--feature", featId, "--task", "T-001"], { cwd: repoRoot, replacements }), "start-task");
          expectOk(runCommand("bash", [script, "replan-features", "--root", tempRepo, "--json"], { cwd: repoRoot, replacements }), "replan-features");

          const statusResult = runCommand("bash", [script, "show-feature-status", "--root", tempRepo, "--feature", featId, "--json"], { cwd: repoRoot, replacements });
          expectOk(statusResult, "show-feature-status");
          const statusPayload = JSON.parse(statusResult.stdout) as Record<string, unknown>;
          const graphResult = runCommand("bash", [script, "show-feature-dag", "--root", tempRepo, "--json"], { cwd: repoRoot, replacements });
          expectOk(graphResult, "show-feature-dag");
          const graphPayload = JSON.parse(graphResult.stdout) as Record<string, unknown>;
          const statePath = path.join(tempRepo, ".bagakit", "feature-tracker", "features", featId, "state.json");
          const tasksPath = path.join(tempRepo, ".bagakit", "feature-tracker", "features", featId, "tasks.json");
          const issuerPath = path.join(tempRepo, ".bagakit", "feature-tracker", "local", "issuer.json");
          const featureDir = path.join(tempRepo, ".bagakit", "feature-tracker", "features", featId);
          const statePayload = JSON.parse(fs.readFileSync(statePath, "utf8")) as Record<string, unknown>;
          const tasksPayload = JSON.parse(fs.readFileSync(tasksPath, "utf8")) as { tasks: Array<Record<string, unknown>> };
          const issuerPayload = JSON.parse(fs.readFileSync(issuerPath, "utf8")) as Record<string, unknown>;

          assert.match(featId, new RegExp("^f-[23456789abcdefghjkmnpqrstuvwxyz]{9}$"));
          assert.equal(statePayload.workspace_mode, "current_tree");
          assert.equal(statePayload.current_task_id, "T-001");
          assert.equal(tasksPayload.tasks[0].status, "in_progress");
          assert.ok(JSON.stringify(statusPayload).includes("T-001"));
          assert.match(JSON.stringify(graphPayload), new RegExp(featId));
          assert.ok(Array.isArray(graphPayload.features));
          assert.ok(Array.isArray(graphPayload.layers));
          assert.ok(
            ["features", "generated_by", "layers", "notes", "version"].every((key) => key in graphPayload),
          );
          assert.equal("execution_mode" in graphPayload, false);
          assert.equal("max_parallel" in graphPayload, false);
          assert.equal("parallel_recommendation" in graphPayload, false);
          assert.equal("first_unfinished_layer" in graphPayload, false);
          assert.equal(issuerPayload.namespace, featId.slice(5, 7));
          assert.equal(fs.existsSync(path.join(featureDir, "tasks.md")), false);
          assert.equal(fs.existsSync(path.join(featureDir, "artifacts")), false);
          assert.equal(fs.existsSync(path.join(featureDir, "proposal.md")), false);
          assert.equal(fs.existsSync(path.join(featureDir, "spec-delta.md")), false);
          assert.equal(fs.existsSync(path.join(featureDir, "verification.md")), false);
          assert.equal("created_at" in statePayload, false);
          assert.equal("updated_at" in statePayload, false);
          assert.equal("generated_at" in graphPayload, false);
          assert.equal("started_at" in tasksPayload.tasks[0], false);
          assert.equal("updated_at" in tasksPayload.tasks[0], false);

          return {
            assertions: [
              "feature state records the assigned workspace mode and active task",
              "tasks.json marks the started task as in progress without per-task timestamps",
              "new features start with a minimal default layout and no eager helper markdown files",
              "feature ids use the c3/n2/g4 opaque shape and stay aligned with local issuer state",
              "show-feature-dag computes a pure dependency projection from canonical feature state without embedding execution-planning fields",
            ],
            commands: [
              `bash ${script} initialize-tracker --root <temp-repo>`,
              `bash ${script} create-feature --root <temp-repo> --title "Eval feature" --slug "eval-feature" --goal "Ship eval" --workspace-mode proposal_only`,
              `bash ${script} assign-feature-workspace --root <temp-repo> --feature ${featId} --workspace-mode current_tree`,
              `bash ${script} start-task --root <temp-repo> --feature ${featId} --task T-001`,
              `bash ${script} replan-features --root <temp-repo> --json`,
              `bash ${script} show-feature-status --root <temp-repo> --feature ${featId} --json`,
              `bash ${script} show-feature-dag --root <temp-repo> --json`,
            ],
            artifacts: [
              { label: "feature-state", path: statePath },
              { label: "feature-tasks", path: tasksPath },
            ],
            outputs: {
              feat_id: featId,
              status_keys: Object.keys(statusPayload),
            },
            replacements,
          };
        } finally {
          cleanupTempDir(tempRepo, context.keepTemp);
        }
      },
    },
    {
      id: "planning-entry-handoff-materializes-feature",
      title: "Planning Entry Handoff Materializes Feature",
      summary: "An approved planning-entry handoff should create canonical tracker truth and a proposal projection without scraping arbitrary brainstorm prose.",
      focus: ["planning-entry-handoff", "feature-creation", "proposal-projection"],
      run: (context) => {
        const { repoRoot } = context;
        const tempRepo = createTempDir("bagakit-feature-tracker-handoff-");
        const replacements = registerTempRepo(context, tempRepo);
        try {
          initGitRepo(tempRepo, replacements);

          const script = path.join(repoRoot, "skills", "harness", "bagakit-feature-tracker", "scripts", "feature-tracker.sh");
          expectOk(runCommand("bash", [script, "initialize-tracker", "--root", tempRepo], { cwd: repoRoot, replacements }), "initialize-tracker");

          const handoffPath = path.join(tempRepo, ".bagakit", "planning-entry", "handoffs", "approved.json");
          writeTextFile(
            handoffPath,
            `${JSON.stringify({
              schema: "bagakit/planning-entry-handoff/v1",
              handoff_id: "peh-eval-approved",
              created_at: "2026-04-26T00:00:00Z",
              updated_at: "2026-04-26T00:00:00Z",
              status: "approved",
              producer_surface: "bagakit-brainstorm",
              title: "Handoff eval feature",
              goal: "Materialize one approved planning-entry handoff into tracker state",
              objective: "Create canonical planning truth from the approved handoff.",
              demand_summary: "The request was clarified upstream and is ready for tracker materialization.",
              success_criteria: ["A tracker feature exists without markdown scraping."],
              constraints: ["Do not create a second planning SSOT."],
              clarification_status: "complete",
              discussion_clear: true,
              user_review_status: "approved",
              recommended_route: {
                scene: "ambiguous_delivery",
                recipe_id: "planning-entry-brainstorm-to-feature",
              },
              source_artifacts: [
                ".bagakit/brainstorm/archive/eval/input_and_qa.md",
                ".bagakit/brainstorm/archive/eval/expert_forum.md",
                ".bagakit/brainstorm/archive/eval/outcome_and_handoff.md",
              ],
              source_refs: [
                ".bagakit/brainstorm/archive/eval/input_and_qa.md#Q-001",
                ".bagakit/brainstorm/archive/eval/expert_forum.md#Decision-Target-And-Exit",
                ".bagakit/brainstorm/archive/eval/outcome_and_handoff.md#Outcome-Summary",
              ],
            }, null, 2)}\n`,
          );

          expectOk(
            runCommand(
              "bash",
              [script, "create-feature-from-planning-entry-handoff", "--root", tempRepo, "--handoff", handoffPath, "--workspace-mode", "proposal_only"],
              { cwd: repoRoot, replacements },
            ),
            "create-feature-from-planning-entry-handoff",
          );

          assert.equal(featureCount(tempRepo), 1);
          const featId = featureId(tempRepo);
          const proposalPath = path.join(tempRepo, ".bagakit", "feature-tracker", "features", featId, "proposal.md");
          const proposalText = fs.readFileSync(proposalPath, "utf8");
          const statePath = path.join(tempRepo, ".bagakit", "feature-tracker", "features", featId, "state.json");
          const statePayload = JSON.parse(fs.readFileSync(statePath, "utf8")) as { history: Array<{ action?: string; detail?: string }> };

          assert.ok(proposalText.includes("peh-eval-approved"));
          assert.ok(proposalText.includes("planning-entry-brainstorm-to-feature"));
          assert.ok(proposalText.includes("The request was clarified upstream and is ready for tracker materialization."));
          assert.ok(statePayload.history.some((entry) => entry.action === "planning_entry_handoff_applied"));

          return {
            assertions: [
              "feature-tracker can create canonical planning truth from an approved planning-entry handoff",
              "the resulting proposal projection preserves handoff id, demand summary, and recommended route",
              "tracker state history records that the planning-entry handoff was applied",
            ],
            commands: [
              `bash ${script} initialize-tracker --root <temp-repo>`,
              `bash ${script} create-feature-from-planning-entry-handoff --root <temp-repo> --handoff <temp-repo>/.bagakit/planning-entry/handoffs/approved.json --workspace-mode proposal_only`,
            ],
            artifacts: [
              { label: "planning-entry-handoff", path: handoffPath },
              { label: "feature-proposal", path: proposalPath },
              { label: "feature-state", path: statePath },
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
