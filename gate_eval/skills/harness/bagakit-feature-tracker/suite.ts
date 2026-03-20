import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runCommand, type CommandResult } from "../../../../dev/eval/src/lib/command.ts";
import type { EvalSuiteDefinition } from "../../../../dev/eval/src/lib/model.ts";
import { cleanupTempDir, createTempDir, registerTempRepo, writeTextFile } from "../../../../dev/eval/src/lib/temp.ts";

function expectOk(result: CommandResult, label: string): void {
  assert.equal(result.status, 0, `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

function expectFail(result: CommandResult, label: string): void {
  assert.notEqual(result.status, 0, `${label} unexpectedly passed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
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

function featureIdByTitle(tempRepo: string, title: string): string {
  const indexPath = path.join(tempRepo, ".bagakit", "feature-tracker", "index", "features.json");
  const payload = JSON.parse(fs.readFileSync(indexPath, "utf8")) as {
    features: Array<{ feat_id: string; title?: string }>;
  };
  const match = payload.features.find((item) => item.title === title);
  assert.ok(match, `missing feature with title ${title}`);
  return match!.feat_id;
}

function updateFeatureState(
  tempRepo: string,
  featId: string,
  mutate: (state: Record<string, unknown>) => void,
  statusDir = "features",
): void {
  const statePath = path.join(tempRepo, ".bagakit", "feature-tracker", statusDir, featId, "state.json");
  const statePayload = JSON.parse(fs.readFileSync(statePath, "utf8")) as Record<string, unknown>;
  mutate(statePayload);
  fs.writeFileSync(statePath, `${JSON.stringify(statePayload, null, 2)}\n`);
}

function gitWorktreeCount(tempRepo: string, replacements: { from: string; to: string }[]): number {
  const result = runCommand("git", ["worktree", "list", "--porcelain"], { cwd: tempRepo, replacements });
  expectOk(result, "git worktree list");
  return result.stdout
    .split("\n")
    .filter((line) => line.startsWith("worktree "))
    .length;
}

export const SUITE: EvalSuiteDefinition = {
  id: "bagakit-feature-tracker-shared-runner-eval",
  owner: "gate_eval/skills/harness/bagakit-feature-tracker",
  title: "Feature Tracker Shared Runner Eval",
  summary: "Measure deterministic feature lifecycle and status projection quality for bagakit-feature-tracker.",
  defaultOutputDir: "gate_eval/skills/harness/bagakit-feature-tracker/results/runs",
  cases: [
    {
      id: "feature-status-projects-active-task",
      title: "Feature Status Projects Active Task",
      summary: "Starting a task should update feature status projection, task state, and DAG presence coherently.",
      focus: ["state-transition", "status-projection", "dag-coherence"],
      run: (context) => {
        const { repoRoot } = context;
        const tempRepo = createTempDir("bagakit-feature-tracker-eval-");
        const replacements = registerTempRepo(context, tempRepo);
        try {
          initGitRepo(tempRepo, replacements);

          const script = path.join(repoRoot, "skills", "harness", "bagakit-feature-tracker", "scripts", "feature-tracker.sh");
          expectOk(runCommand("bash", [script, "check-reference-readiness", "--root", tempRepo], { cwd: repoRoot, replacements }), "check-reference-readiness");
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
          expectOk(runCommand("bash", [script, "assign-feature-workspace", "--root", tempRepo, "--feature", featId, "--workspace-mode", "current_tree"], { cwd: repoRoot, replacements }), "assign-feature-workspace");
          expectOk(runCommand("bash", [script, "start-task", "--root", tempRepo, "--feature", featId, "--task", "T-001"], { cwd: repoRoot, replacements }), "start-task");
          expectOk(runCommand("bash", [script, "replan-features", "--root", tempRepo, "--json"], { cwd: repoRoot, replacements }), "replan-features");

          const statusResult = runCommand("bash", [script, "show-feature-status", "--root", tempRepo, "--feature", featId, "--json"], { cwd: repoRoot, replacements });
          expectOk(statusResult, "show-feature-status");
          const statusPayload = JSON.parse(statusResult.stdout) as Record<string, unknown>;
          const statePath = path.join(tempRepo, ".bagakit", "feature-tracker", "features", featId, "state.json");
          const tasksPath = path.join(tempRepo, ".bagakit", "feature-tracker", "features", featId, "tasks.json");
          const dagPath = path.join(tempRepo, ".bagakit", "feature-tracker", "index", "FEATURES_DAG.json");
          const issuerPath = path.join(tempRepo, ".bagakit", "feature-tracker", "local", "issuer.json");
          const featureDir = path.join(tempRepo, ".bagakit", "feature-tracker", "features", featId);
          const statePayload = JSON.parse(fs.readFileSync(statePath, "utf8")) as Record<string, unknown>;
          const tasksPayload = JSON.parse(fs.readFileSync(tasksPath, "utf8")) as { tasks: Array<Record<string, unknown>> };
          const dagPayload = JSON.parse(fs.readFileSync(dagPath, "utf8")) as Record<string, unknown>;
          const issuerPayload = JSON.parse(fs.readFileSync(issuerPath, "utf8")) as Record<string, unknown>;

          assert.match(featId, new RegExp("^f-[23456789abcdefghjkmnpqrstuvwxyz]{9}$"));
          assert.equal(statePayload.workspace_mode, "current_tree");
          assert.equal(statePayload.current_task_id, "T-001");
          assert.equal(tasksPayload.tasks[0].status, "in_progress");
          assert.ok(JSON.stringify(statusPayload).includes("T-001"));
          assert.match(JSON.stringify(dagPayload), new RegExp(featId));
          assert.ok(Array.isArray(dagPayload.features));
          assert.ok(Array.isArray(dagPayload.layers));
          assert.deepEqual(Object.keys(dagPayload).sort(), ["features", "generated_by", "layers", "notes", "version"]);
          assert.equal("execution_mode" in dagPayload, false);
          assert.equal("max_parallel" in dagPayload, false);
          assert.equal("parallel_recommendation" in dagPayload, false);
          assert.equal("first_unfinished_layer" in dagPayload, false);
          assert.equal(issuerPayload.namespace, featId.slice(5, 7));
          assert.equal(fs.existsSync(path.join(featureDir, "tasks.md")), false);
          assert.equal(fs.existsSync(path.join(featureDir, "artifacts")), false);
          assert.equal(fs.existsSync(path.join(featureDir, "proposal.md")), false);
          assert.equal(fs.existsSync(path.join(featureDir, "spec-delta.md")), false);
          assert.equal(fs.existsSync(path.join(featureDir, "verification.md")), false);
          assert.equal("created_at" in statePayload, false);
          assert.equal("updated_at" in statePayload, false);
          assert.equal("generated_at" in dagPayload, false);
          assert.equal("started_at" in tasksPayload.tasks[0], false);
          assert.equal("updated_at" in tasksPayload.tasks[0], false);

          return {
            assertions: [
              "feature state records the assigned workspace mode and active task",
              "tasks.json marks the started task as in progress without per-task timestamps",
              "new features start with a minimal default layout and no eager helper markdown files",
              "feature ids use the c3/n2/g4 opaque shape and stay aligned with local issuer state",
              "FEATURES_DAG.json stays a pure dependency projection instead of embedding execution-planning fields",
            ],
            commands: [
              `bash ${script} initialize-tracker --root <temp-repo>`,
              `bash ${script} create-feature --root <temp-repo> --title "Eval feature" --slug "eval-feature" --goal "Ship eval" --workspace-mode proposal_only`,
              `bash ${script} assign-feature-workspace --root <temp-repo> --feature ${featId} --workspace-mode current_tree`,
              `bash ${script} start-task --root <temp-repo> --feature ${featId} --task T-001`,
              `bash ${script} replan-features --root <temp-repo> --json`,
              `bash ${script} show-feature-status --root <temp-repo> --feature ${featId} --json`,
            ],
            artifacts: [
              { label: "feature-state", path: statePath },
              { label: "feature-tasks", path: tasksPath },
              { label: "features-dag", path: dagPath },
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
      id: "feature-root-rejects-unsupported-prose",
      title: "Feature Root Rejects Unsupported Prose",
      summary: "Feature roots should reject unsupported prose files like PRD.md and Changelog.md.",
      focus: ["artifact-boundary", "validation", "feature-surface"],
      run: (context) => {
        const { repoRoot } = context;
        const tempRepo = createTempDir("bagakit-feature-tracker-boundary-");
        const replacements = registerTempRepo(context, tempRepo);
        try {
          initGitRepo(tempRepo, replacements);

          const script = path.join(repoRoot, "skills", "harness", "bagakit-feature-tracker", "scripts", "feature-tracker.sh");
          expectOk(runCommand("bash", [script, "check-reference-readiness", "--root", tempRepo], { cwd: repoRoot, replacements }), "check-reference-readiness");
          expectOk(runCommand("bash", [script, "initialize-tracker", "--root", tempRepo], { cwd: repoRoot, replacements }), "initialize-tracker");
          expectOk(
            runCommand(
              "bash",
              [script, "create-feature", "--root", tempRepo, "--title", "Boundary feature", "--slug", "boundary-feature", "--goal", "Reject unsupported files", "--workspace-mode", "proposal_only"],
              { cwd: repoRoot, replacements },
            ),
            "create-feature",
          );
          const featId = featureId(tempRepo);
          const featureDir = path.join(tempRepo, ".bagakit", "feature-tracker", "features", featId);
          writeTextFile(path.join(featureDir, "PRD.md"), "# shadow product doc\n");
          writeTextFile(path.join(featureDir, "Changelog.md"), "# shadow changelog\n");

          const validateResult = runCommand("bash", [script, "validate-tracker", "--root", tempRepo], { cwd: repoRoot, replacements });
          expectFail(validateResult, "validate-tracker");
          assert.ok(validateResult.stderr.includes("unsupported feature-root file"));
          assert.ok(validateResult.stderr.includes("PRD.md") || validateResult.stderr.includes("Changelog.md"));
          assert.ok(validateResult.stderr.includes("proposal.md"));
          assert.ok(validateResult.stderr.includes("repo/release surfaces"));

          return {
            assertions: [
              "feature-tracker validation rejects unsupported prose files in active feature roots",
              "validation points PRD-like intent toward proposal.md or upstream planning artifacts",
              "validation points changelog-like history toward repo or release surfaces",
              "the current contract keeps feature-root helper artifacts explicit instead of allowing a general markdown bucket",
            ],
            commands: [
              `bash ${script} create-feature --root <temp-repo> --title "Boundary feature" --slug "boundary-feature" --goal "Reject unsupported files" --workspace-mode proposal_only`,
              `bash ${script} validate-tracker --root <temp-repo>`,
            ],
            artifacts: [
              { label: "feature-dir", path: featureDir },
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
          expectOk(runCommand("bash", [script, "check-reference-readiness", "--root", tempRepo], { cwd: repoRoot, replacements }), "check-reference-readiness");
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
                "input_and_qa.md#Q-001",
                "expert_forum.md#Decision-Target-And-Exit",
                "outcome_and_handoff.md#Outcome-Summary",
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
    {
      id: "graph-mutations-preflight-before-side-effects",
      title: "Graph Mutations Preflight Before Side Effects",
      summary: "Create, archive, and discard should fail before mutating tracked state or cleanup side effects when the resulting active graph is invalid.",
      focus: ["create-feature", "archive-feature", "discard-feature", "preflight"],
      run: (context) => {
        const { repoRoot } = context;
        const tempRepo = createTempDir("bagakit-feature-tracker-preflight-");
        const replacements = registerTempRepo(context, tempRepo);
        try {
          initGitRepo(tempRepo, replacements);

          const script = path.join(repoRoot, "skills", "harness", "bagakit-feature-tracker", "scripts", "feature-tracker.sh");
          expectOk(runCommand("bash", [script, "check-reference-readiness", "--root", tempRepo], { cwd: repoRoot, replacements }), "check-reference-readiness");
          expectOk(runCommand("bash", [script, "initialize-tracker", "--root", tempRepo], { cwd: repoRoot, replacements }), "initialize-tracker");
          expectOk(runCommand("bash", [script, "create-feature", "--root", tempRepo, "--title", "Boundary feature", "--slug", "boundary-feature", "--goal", "Block graph changes", "--workspace-mode", "proposal_only"], { cwd: repoRoot, replacements }), "create-feature boundary");
          expectOk(runCommand("bash", [script, "create-feature", "--root", tempRepo, "--title", "Archive blocked feature", "--slug", "archive-blocked-feature", "--goal", "Archive should preflight graph", "--workspace-mode", "proposal_only"], { cwd: repoRoot, replacements }), "create-feature archive target");
          expectOk(runCommand("bash", [script, "create-feature", "--root", tempRepo, "--title", "Discard blocked feature", "--slug", "discard-blocked-feature", "--goal", "Discard should preflight graph", "--workspace-mode", "proposal_only"], { cwd: repoRoot, replacements }), "create-feature discard target");

          const boundaryId = featureIdByTitle(tempRepo, "Boundary feature");
          const archiveBlockedId = featureIdByTitle(tempRepo, "Archive blocked feature");
          const discardBlockedId = featureIdByTitle(tempRepo, "Discard blocked feature");
          updateFeatureState(tempRepo, archiveBlockedId, (state) => {
            state.status = "done";
          });
          updateFeatureState(tempRepo, boundaryId, (state) => {
            state.depends_on = [boundaryId];
          });

          const featureCountBefore = featureCount(tempRepo);
          const worktreesBefore = gitWorktreeCount(tempRepo, replacements);

          const failedCreate = runCommand("bash", [script, "create-feature", "--root", tempRepo, "--title", "Blocked create feature", "--slug", "blocked-create-feature", "--goal", "Create should preflight graph", "--workspace-mode", "worktree"], { cwd: repoRoot, replacements });
          expectFail(failedCreate, "create-feature preflight");
          assert.ok(failedCreate.stderr.includes("feat cannot depend on itself"));
          assert.equal(featureCount(tempRepo), featureCountBefore);
          assert.equal(gitWorktreeCount(tempRepo, replacements), worktreesBefore);

          const failedArchive = runCommand("bash", [script, "archive-feature", "--root", tempRepo, "--feature", archiveBlockedId], { cwd: repoRoot, replacements });
          expectFail(failedArchive, "archive-feature preflight");
          assert.ok(failedArchive.stderr.includes("feat cannot depend on itself"));
          assert.equal(fs.existsSync(path.join(tempRepo, ".bagakit", "feature-tracker", "features", archiveBlockedId)), true);
          assert.equal(fs.existsSync(path.join(tempRepo, ".bagakit", "feature-tracker", "features-archived", archiveBlockedId)), false);

          const failedDiscard = runCommand("bash", [script, "discard-feature", "--root", tempRepo, "--feature", discardBlockedId, "--reason", "superseded"], { cwd: repoRoot, replacements });
          expectFail(failedDiscard, "discard-feature preflight");
          assert.ok(failedDiscard.stderr.includes("feat cannot depend on itself"));
          assert.equal(fs.existsSync(path.join(tempRepo, ".bagakit", "feature-tracker", "features", discardBlockedId)), true);
          assert.equal(fs.existsSync(path.join(tempRepo, ".bagakit", "feature-tracker", "features-discarded", discardBlockedId)), false);

          updateFeatureState(tempRepo, boundaryId, (state) => {
            state.depends_on = [];
          });
          expectOk(runCommand("bash", [script, "replan-features", "--root", tempRepo], { cwd: repoRoot, replacements }), "replan after invalid graph");

          const dagPath = path.join(tempRepo, ".bagakit", "feature-tracker", "index", "FEATURES_DAG.json");
          fs.rmSync(dagPath, { force: true });
          const featureCountBeforeMissingDag = featureCount(tempRepo);
          const worktreesBeforeMissingDag = gitWorktreeCount(tempRepo, replacements);

          const missingDagCreate = runCommand("bash", [script, "create-feature", "--root", tempRepo, "--title", "Blocked create by missing dag", "--slug", "blocked-create-by-missing-dag", "--goal", "Create should fail before mutation when dag is missing", "--workspace-mode", "worktree"], { cwd: repoRoot, replacements });
          expectFail(missingDagCreate, "create-feature missing dag");
          assert.ok(missingDagCreate.stderr.includes("dag file missing"));
          assert.equal(featureCount(tempRepo), featureCountBeforeMissingDag);
          assert.equal(gitWorktreeCount(tempRepo, replacements), worktreesBeforeMissingDag);

          const missingDagArchive = runCommand("bash", [script, "archive-feature", "--root", tempRepo, "--feature", archiveBlockedId], { cwd: repoRoot, replacements });
          expectFail(missingDagArchive, "archive-feature missing dag");
          assert.ok(missingDagArchive.stderr.includes("dag file missing"));
          assert.equal(fs.existsSync(path.join(tempRepo, ".bagakit", "feature-tracker", "features", archiveBlockedId)), true);
          assert.equal(fs.existsSync(path.join(tempRepo, ".bagakit", "feature-tracker", "features-archived", archiveBlockedId)), false);

          const missingDagDiscard = runCommand("bash", [script, "discard-feature", "--root", tempRepo, "--feature", discardBlockedId, "--reason", "superseded"], { cwd: repoRoot, replacements });
          expectFail(missingDagDiscard, "discard-feature missing dag");
          assert.ok(missingDagDiscard.stderr.includes("dag file missing"));
          assert.equal(fs.existsSync(path.join(tempRepo, ".bagakit", "feature-tracker", "features", discardBlockedId)), true);
          assert.equal(fs.existsSync(path.join(tempRepo, ".bagakit", "feature-tracker", "features-discarded", discardBlockedId)), false);

          expectOk(runCommand("bash", [script, "replan-features", "--root", tempRepo], { cwd: repoRoot, replacements }), "replan after missing dag");
          fs.chmodSync(dagPath, 0o444);
          const featureCountBeforeUnwritableDag = featureCount(tempRepo);
          const worktreesBeforeUnwritableDag = gitWorktreeCount(tempRepo, replacements);

          const unwritableDagCreate = runCommand("bash", [script, "create-feature", "--root", tempRepo, "--title", "Blocked create by unwritable dag", "--slug", "blocked-create-by-unwritable-dag", "--goal", "Create should fail before mutation when dag is not writable", "--workspace-mode", "worktree"], { cwd: repoRoot, replacements });
          expectFail(unwritableDagCreate, "create-feature unwritable dag");
          assert.ok(unwritableDagCreate.stderr.includes("dag target is not writable"));
          assert.equal(featureCount(tempRepo), featureCountBeforeUnwritableDag);
          assert.equal(gitWorktreeCount(tempRepo, replacements), worktreesBeforeUnwritableDag);

          const unwritableDagArchive = runCommand("bash", [script, "archive-feature", "--root", tempRepo, "--feature", archiveBlockedId], { cwd: repoRoot, replacements });
          expectFail(unwritableDagArchive, "archive-feature unwritable dag");
          assert.ok(unwritableDagArchive.stderr.includes("dag target is not writable"));
          assert.equal(fs.existsSync(path.join(tempRepo, ".bagakit", "feature-tracker", "features", archiveBlockedId)), true);
          assert.equal(fs.existsSync(path.join(tempRepo, ".bagakit", "feature-tracker", "features-archived", archiveBlockedId)), false);

          const unwritableDagDiscard = runCommand("bash", [script, "discard-feature", "--root", tempRepo, "--feature", discardBlockedId, "--reason", "superseded"], { cwd: repoRoot, replacements });
          expectFail(unwritableDagDiscard, "discard-feature unwritable dag");
          assert.ok(unwritableDagDiscard.stderr.includes("dag target is not writable"));
          assert.equal(fs.existsSync(path.join(tempRepo, ".bagakit", "feature-tracker", "features", discardBlockedId)), true);
          assert.equal(fs.existsSync(path.join(tempRepo, ".bagakit", "feature-tracker", "features-discarded", discardBlockedId)), false);
          fs.chmodSync(dagPath, 0o644);

          const dagSymlinkTargetPath = path.join(tempRepo, ".bagakit", "feature-tracker", "index", "FEATURES_DAG.symlink-target.json");
          fs.renameSync(dagPath, dagSymlinkTargetPath);
          fs.symlinkSync(path.basename(dagSymlinkTargetPath), dagPath);
          const featureCountBeforeSymlinkDag = featureCount(tempRepo);
          const worktreesBeforeSymlinkDag = gitWorktreeCount(tempRepo, replacements);

          const symlinkDagCreate = runCommand("bash", [script, "create-feature", "--root", tempRepo, "--title", "Blocked create by dag symlink", "--slug", "blocked-create-by-dag-symlink", "--goal", "Create should fail before mutation when dag path is a symlink", "--workspace-mode", "worktree"], { cwd: repoRoot, replacements });
          expectFail(symlinkDagCreate, "create-feature symlink dag");
          assert.ok(symlinkDagCreate.stderr.includes("dag target is not a regular file"));
          assert.equal(featureCount(tempRepo), featureCountBeforeSymlinkDag);
          assert.equal(gitWorktreeCount(tempRepo, replacements), worktreesBeforeSymlinkDag);

          const symlinkDagArchive = runCommand("bash", [script, "archive-feature", "--root", tempRepo, "--feature", archiveBlockedId], { cwd: repoRoot, replacements });
          expectFail(symlinkDagArchive, "archive-feature symlink dag");
          assert.ok(symlinkDagArchive.stderr.includes("dag target is not a regular file"));
          assert.equal(fs.existsSync(path.join(tempRepo, ".bagakit", "feature-tracker", "features", archiveBlockedId)), true);
          assert.equal(fs.existsSync(path.join(tempRepo, ".bagakit", "feature-tracker", "features-archived", archiveBlockedId)), false);

          const symlinkDagDiscard = runCommand("bash", [script, "discard-feature", "--root", tempRepo, "--feature", discardBlockedId, "--reason", "superseded"], { cwd: repoRoot, replacements });
          expectFail(symlinkDagDiscard, "discard-feature symlink dag");
          assert.ok(symlinkDagDiscard.stderr.includes("dag target is not a regular file"));
          assert.equal(fs.existsSync(path.join(tempRepo, ".bagakit", "feature-tracker", "features", discardBlockedId)), true);
          assert.equal(fs.existsSync(path.join(tempRepo, ".bagakit", "feature-tracker", "features-discarded", discardBlockedId)), false);

          fs.unlinkSync(dagPath);
          fs.renameSync(dagSymlinkTargetPath, dagPath);

          return {
            assertions: [
              "create-feature fails before writing a new feature record or creating a new worktree when the prospective active graph is invalid",
              "archive-feature fails before moving the feature into features-archived when the post-closeout active graph would be invalid",
              "discard-feature fails before moving the feature into features-discarded when the post-closeout active graph would be invalid",
              "create-feature, archive-feature, and discard-feature also fail before mutation when FEATURES_DAG.json is missing",
              "create-feature, archive-feature, and discard-feature fail before mutation when an existing regular FEATURES_DAG.json is not writable",
              "create-feature, archive-feature, and discard-feature also fail before mutation when FEATURES_DAG.json is a symlink instead of a regular file",
            ],
            commands: [
              `bash ${script} create-feature --root <temp-repo> --title "Blocked create feature" --slug "blocked-create-feature" --goal "Create should preflight graph" --workspace-mode worktree`,
              `bash ${script} archive-feature --root <temp-repo> --feature ${archiveBlockedId}`,
              `bash ${script} discard-feature --root <temp-repo> --feature ${discardBlockedId} --reason superseded`,
            ],
            artifacts: [
              { label: "feature-index", path: path.join(tempRepo, ".bagakit", "feature-tracker", "index", "features.json") },
            ],
            outputs: {
              boundary_id: boundaryId,
              archive_blocked_id: archiveBlockedId,
              discard_blocked_id: discardBlockedId,
            },
            replacements,
          };
        } finally {
          cleanupTempDir(tempRepo, context.keepTemp);
        }
      },
    },
    {
      id: "dag-contract-validation-rejects-missing-fields-and-symlinks",
      title: "DAG Contract Validation Rejects Missing Fields And Symlinks",
      summary: "show-feature-dag and validate-tracker should reject DAG payloads that are missing stable contract fields or routed through symlink paths.",
      focus: ["show-feature-dag", "validate-tracker", "dag-contract"],
      run: (context) => {
        const { repoRoot } = context;
        const tempRepo = createTempDir("bagakit-feature-tracker-dag-validation-");
        const replacements = registerTempRepo(context, tempRepo);
        try {
          initGitRepo(tempRepo, replacements);

          const script = path.join(repoRoot, "skills", "harness", "bagakit-feature-tracker", "scripts", "feature-tracker.sh");
          expectOk(runCommand("bash", [script, "check-reference-readiness", "--root", tempRepo], { cwd: repoRoot, replacements }), "check-reference-readiness");
          expectOk(runCommand("bash", [script, "initialize-tracker", "--root", tempRepo], { cwd: repoRoot, replacements }), "initialize-tracker");
          expectOk(
            runCommand(
              "bash",
              [script, "create-feature", "--root", tempRepo, "--title", "Schema feature", "--slug", "schema-feature", "--goal", "Validate dag contract shape", "--workspace-mode", "proposal_only"],
              { cwd: repoRoot, replacements },
            ),
            "create-feature",
          );

          const featId = featureId(tempRepo);
          const dagPath = path.join(tempRepo, ".bagakit", "feature-tracker", "index", "FEATURES_DAG.json");
          writeTextFile(
            dagPath,
            `${JSON.stringify({
              features: [
                {
                  feat_id: featId,
                  depends_on: [],
                  dependents: [],
                },
              ],
              layers: [
                {
                  layer: 0,
                  feat_ids: [featId],
                },
              ],
              notes: [],
            }, null, 2)}\n`,
          );

          const missingFieldShow = runCommand("bash", [script, "show-feature-dag", "--root", tempRepo], { cwd: repoRoot, replacements });
          expectFail(missingFieldShow, "show-feature-dag missing fields");
          assert.ok(missingFieldShow.stderr.includes("missing dag version field"));

          const missingFieldValidate = runCommand("bash", [script, "validate-tracker", "--root", tempRepo], { cwd: repoRoot, replacements });
          expectFail(missingFieldValidate, "validate-tracker missing fields");
          assert.ok(missingFieldValidate.stderr.includes("missing dag version field"));
          assert.ok(missingFieldValidate.stderr.includes("missing dag generated_by field"));
          assert.ok(missingFieldValidate.stderr.includes("missing dag layer field for feature[0]"));

          expectOk(runCommand("bash", [script, "replan-features", "--root", tempRepo], { cwd: repoRoot, replacements }), "replan-features restore valid dag");

          const dagSymlinkTargetPath = path.join(tempRepo, ".bagakit", "feature-tracker", "index", "FEATURES_DAG.symlink-target.json");
          fs.renameSync(dagPath, dagSymlinkTargetPath);
          fs.symlinkSync(path.basename(dagSymlinkTargetPath), dagPath);

          const symlinkShow = runCommand("bash", [script, "show-feature-dag", "--root", tempRepo], { cwd: repoRoot, replacements });
          expectFail(symlinkShow, "show-feature-dag symlink");
          assert.ok(symlinkShow.stderr.includes("dag file is not a regular file"));

          const symlinkValidate = runCommand("bash", [script, "validate-tracker", "--root", tempRepo], { cwd: repoRoot, replacements });
          expectFail(symlinkValidate, "validate-tracker symlink");
          assert.ok(symlinkValidate.stderr.includes("dag file is not a regular file"));

          fs.unlinkSync(dagPath);
          fs.renameSync(dagSymlinkTargetPath, dagPath);

          return {
            assertions: [
              "show-feature-dag rejects DAG payloads missing required stable contract fields instead of treating missing keys as optional defaults",
              "validate-tracker reports missing top-level DAG contract fields such as version/generated_by and missing per-feature layer values",
              "show-feature-dag and validate-tracker both fail closed when FEATURES_DAG.json is a symlink path",
            ],
            commands: [
              `bash ${script} show-feature-dag --root <temp-repo>`,
              `bash ${script} validate-tracker --root <temp-repo>`,
            ],
            artifacts: [
              { label: "features-dag", path: dagPath },
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
    {
      id: "feature-closeout-preserves-root-artifacts",
      title: "Feature Closeout Preserves Root Artifacts",
      summary: "Archive should keep closed roots valid by preserving live-only or legacy root entries under artifacts.",
      focus: ["closeout", "artifact-boundary", "dag-refresh"],
      run: (context) => {
        const { repoRoot } = context;
        const tempRepo = createTempDir("bagakit-feature-tracker-closeout-");
        const replacements = registerTempRepo(context, tempRepo);
        try {
          initGitRepo(tempRepo, replacements);

          const script = path.join(repoRoot, "skills", "harness", "bagakit-feature-tracker", "scripts", "feature-tracker.sh");
          expectOk(runCommand("bash", [script, "check-reference-readiness", "--root", tempRepo], { cwd: repoRoot, replacements }), "check-reference-readiness");
          expectOk(runCommand("bash", [script, "initialize-tracker", "--root", tempRepo], { cwd: repoRoot, replacements }), "initialize-tracker");
          expectOk(
            runCommand(
              "bash",
              [script, "create-feature", "--root", tempRepo, "--title", "Closeout feature", "--slug", "closeout-feature", "--goal", "Archive cleanly", "--workspace-mode", "proposal_only"],
              { cwd: repoRoot, replacements },
            ),
            "create-feature",
          );
          const featId = featureId(tempRepo);
          const liveFeatureDir = path.join(tempRepo, ".bagakit", "feature-tracker", "features", featId);
          const dagPath = path.join(tempRepo, ".bagakit", "feature-tracker", "index", "FEATURES_DAG.json");

          const createdDag = JSON.parse(fs.readFileSync(dagPath, "utf8")) as {
            features: Array<{ feat_id: string }>;
          };
          assert.deepEqual(createdDag.features.map((item) => item.feat_id), [featId]);

          expectOk(runCommand("bash", [script, "materialize-feature-artifact", "--root", tempRepo, "--feature", featId, "--kind", "proposal"], { cwd: repoRoot, replacements }), "materialize proposal");
          expectOk(runCommand("bash", [script, "materialize-feature-artifact", "--root", tempRepo, "--feature", featId, "--kind", "verification"], { cwd: repoRoot, replacements }), "materialize verification");
          writeTextFile(path.join(liveFeatureDir, "ui-verification.md"), "legacy ui verification\n");
          writeTextFile(path.join(liveFeatureDir, "summary.md"), "operator-authored active summary\n");
          writeTextFile(path.join(liveFeatureDir, "PRD.md"), "legacy product doc\n");

          updateFeatureState(tempRepo, featId, (state) => {
            state.status = "done";
          });

          expectOk(runCommand("bash", [script, "archive-feature", "--root", tempRepo, "--feature", featId], { cwd: repoRoot, replacements }), "archive-feature");
          expectOk(runCommand("bash", [script, "validate-tracker", "--root", tempRepo], { cwd: repoRoot, replacements }), "validate-tracker");

          const archivedDir = path.join(tempRepo, ".bagakit", "feature-tracker", "features-archived", featId);
          const refreshedDag = JSON.parse(fs.readFileSync(dagPath, "utf8")) as {
            features: Array<{ feat_id: string }>;
          };
          assert.equal(refreshedDag.features.some((item) => item.feat_id === featId), false);
          assert.equal(fs.existsSync(path.join(archivedDir, "summary.md")), true);
          assert.equal(fs.existsSync(path.join(archivedDir, "proposal.md")), false);
          assert.equal(fs.existsSync(path.join(archivedDir, "verification.md")), false);
          assert.equal(fs.existsSync(path.join(archivedDir, "ui-verification.md")), false);
          assert.equal(fs.existsSync(path.join(archivedDir, "PRD.md")), false);
          assert.equal(fs.existsSync(path.join(archivedDir, "artifacts", "closeout-preserved-root", "proposal.md")), true);
          assert.equal(fs.existsSync(path.join(archivedDir, "artifacts", "closeout-preserved-root", "verification.md")), true);
          assert.equal(fs.existsSync(path.join(archivedDir, "artifacts", "closeout-preserved-root", "ui-verification.md")), true);
          assert.equal(fs.existsSync(path.join(archivedDir, "artifacts", "closeout-preserved-root", "summary.md")), true);
          assert.equal(fs.existsSync(path.join(archivedDir, "artifacts", "closeout-preserved-root", "PRD.md")), true);
          assert.equal(fs.readFileSync(path.join(archivedDir, "artifacts", "closeout-preserved-root", "summary.md"), "utf8"), "operator-authored active summary\n");
          const summaryBefore = fs.readFileSync(path.join(archivedDir, "summary.md"), "utf8");
          fs.rmSync(dagPath, { force: true });
          expectOk(runCommand("bash", [script, "archive-feature", "--root", tempRepo, "--feature", featId], { cwd: repoRoot, replacements }), "archive-feature idempotent");
          assert.equal(fs.readFileSync(path.join(archivedDir, "summary.md"), "utf8"), summaryBefore);
          assert.equal(fs.readFileSync(path.join(archivedDir, "artifacts", "closeout-preserved-root", "summary.md"), "utf8"), "operator-authored active summary\n");
          assert.equal(fs.existsSync(dagPath), true);
          fs.rmSync(dagPath, { force: true, recursive: true });
          fs.mkdirSync(dagPath, { recursive: true });
          expectOk(runCommand("bash", [script, "archive-feature", "--root", tempRepo, "--feature", featId], { cwd: repoRoot, replacements }), "archive-feature idempotent malformed dag");
          assert.equal(fs.readFileSync(path.join(archivedDir, "summary.md"), "utf8"), summaryBefore);
          assert.equal(fs.existsSync(dagPath), true);
          assert.equal(fs.statSync(dagPath).isFile(), true);
          const driftedDag = JSON.parse(fs.readFileSync(dagPath, "utf8")) as { notes?: string[] };
          driftedDag.notes = [...(driftedDag.notes ?? []), "manual drift sentinel"];
          writeTextFile(dagPath, `${JSON.stringify(driftedDag, null, 2)}\n`);
          const driftedDagBefore = fs.readFileSync(dagPath, "utf8");
          expectOk(runCommand("bash", [script, "archive-feature", "--root", tempRepo, "--feature", featId], { cwd: repoRoot, replacements }), "archive-feature idempotent valid drift");
          assert.equal(fs.readFileSync(dagPath, "utf8"), driftedDagBefore);
          assert.equal(fs.readFileSync(path.join(archivedDir, "summary.md"), "utf8"), summaryBefore);

          const closedMaterialize = runCommand("bash", [script, "materialize-feature-artifact", "--root", tempRepo, "--feature", featId, "--kind", "verification"], { cwd: repoRoot, replacements });
          expectFail(closedMaterialize, "materialize closed verification");
          assert.ok(closedMaterialize.stderr.includes("live-feature helper files are not materializable after closeout"));

          expectOk(
            runCommand(
              "bash",
              [script, "create-feature", "--root", tempRepo, "--title", "False archived feature", "--slug", "false-archived-feature", "--goal", "Reject false archived rerun", "--workspace-mode", "proposal_only"],
              { cwd: repoRoot, replacements },
            ),
            "create false archived feature",
          );
          expectOk(
            runCommand(
              "bash",
              [script, "create-feature", "--root", tempRepo, "--title", "False discarded feature", "--slug", "false-discarded-feature", "--goal", "Reject false discarded rerun", "--workspace-mode", "proposal_only"],
              { cwd: repoRoot, replacements },
            ),
            "create false discarded feature",
          );
          const falseArchivedId = featureIdByTitle(tempRepo, "False archived feature");
          const falseDiscardedId = featureIdByTitle(tempRepo, "False discarded feature");
          const falseArchivedActiveDir = path.join(tempRepo, ".bagakit", "feature-tracker", "features", falseArchivedId);
          const falseDiscardedActiveDir = path.join(tempRepo, ".bagakit", "feature-tracker", "features", falseDiscardedId);
          updateFeatureState(tempRepo, falseArchivedId, (state) => {
            state.status = "archived";
          });
          updateFeatureState(tempRepo, falseDiscardedId, (state) => {
            state.status = "discarded";
          });

          const inconsistentArchive = runCommand("bash", [script, "archive-feature", "--root", tempRepo, "--feature", falseArchivedId], { cwd: repoRoot, replacements });
          expectFail(inconsistentArchive, "archive-feature false archived rerun");
          assert.ok(inconsistentArchive.stderr.includes("claims status=archived but still lives under features/"));
          assert.equal(fs.existsSync(falseArchivedActiveDir), true);
          assert.equal(fs.existsSync(path.join(tempRepo, ".bagakit", "feature-tracker", "features-archived", falseArchivedId)), false);

          const inconsistentDiscard = runCommand("bash", [script, "discard-feature", "--root", tempRepo, "--feature", falseDiscardedId, "--reason", "superseded"], { cwd: repoRoot, replacements });
          expectFail(inconsistentDiscard, "discard-feature false discarded rerun");
          assert.ok(inconsistentDiscard.stderr.includes("claims status=discarded but still lives under features/"));
          assert.equal(fs.existsSync(falseDiscardedActiveDir), true);
          assert.equal(fs.existsSync(path.join(tempRepo, ".bagakit", "feature-tracker", "features-discarded", falseDiscardedId)), false);

          expectOk(
            runCommand(
              "bash",
              [script, "create-feature", "--root", tempRepo, "--title", "Broken active feature", "--slug", "broken-active-feature", "--goal", "Break active graph without blocking closed rerun", "--workspace-mode", "proposal_only"],
              { cwd: repoRoot, replacements },
            ),
            "create broken active feature",
          );
          const brokenActiveId = featureIdByTitle(tempRepo, "Broken active feature");
          updateFeatureState(tempRepo, brokenActiveId, (state) => {
            state.depends_on = [brokenActiveId];
          });
          fs.rmSync(dagPath, { force: true });
          const brokenActiveRerun = runCommand("bash", [script, "archive-feature", "--root", tempRepo, "--feature", featId], { cwd: repoRoot, replacements });
          expectOk(brokenActiveRerun, "archive-feature idempotent broken active graph");
          assert.ok(brokenActiveRerun.stderr.includes("skipped FEATURES_DAG.json repair on already-closed rerun"));
          assert.ok(brokenActiveRerun.stderr.includes("feat cannot depend on itself"));
          assert.equal(fs.existsSync(dagPath), false);

          return {
            assertions: [
              "create-feature refreshes the active DAG projection immediately",
              "archive-feature drops the closed feature from the active DAG without requiring manual replanning",
              "closed feature roots keep canonical summary.md while an operator-authored active-root summary.md is preserved under artifacts/closeout-preserved-root",
              "archive-feature idempotent reruns heal missing or malformed DAG surfaces without reshuffling summary.md, but leave schema-valid DAG drift untouched",
              "closed features reject new helper materialization after closeout",
              "archive-feature and discard-feature reject false already-closed reruns when the feature still lives under features/",
              "already-closed archive-feature reruns warn instead of failing when unrelated active-graph breakage blocks missing-DAG repair",
            ],
            commands: [
              `bash ${script} create-feature --root <temp-repo> --title "Closeout feature" --slug "closeout-feature" --goal "Archive cleanly" --workspace-mode proposal_only`,
              `bash ${script} archive-feature --root <temp-repo> --feature ${featId}`,
              `bash ${script} validate-tracker --root <temp-repo>`,
            ],
            artifacts: [
              { label: "archived-feature-dir", path: archivedDir },
              { label: "features-dag", path: dagPath },
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
    {
      id: "replan-rolls-back-invalid-overrides",
      title: "Replan Rolls Back Invalid Overrides",
      summary: "Failed dependency replans should not persist partial state, and malformed DAG archives should not block regeneration.",
      focus: ["replan", "rollback", "dag-archive"],
      run: (context) => {
        const { repoRoot } = context;
        const tempRepo = createTempDir("bagakit-feature-tracker-replan-");
        const replacements = registerTempRepo(context, tempRepo);
        try {
          initGitRepo(tempRepo, replacements);

          const script = path.join(repoRoot, "skills", "harness", "bagakit-feature-tracker", "scripts", "feature-tracker.sh");
          expectOk(runCommand("bash", [script, "check-reference-readiness", "--root", tempRepo], { cwd: repoRoot, replacements }), "check-reference-readiness");
          expectOk(runCommand("bash", [script, "initialize-tracker", "--root", tempRepo], { cwd: repoRoot, replacements }), "initialize-tracker");
          expectOk(runCommand("bash", [script, "create-feature", "--root", tempRepo, "--title", "Cycle A", "--slug", "cycle-a", "--goal", "Check rollback", "--workspace-mode", "proposal_only"], { cwd: repoRoot, replacements }), "create-feature A");
          expectOk(runCommand("bash", [script, "create-feature", "--root", tempRepo, "--title", "Cycle B", "--slug", "cycle-b", "--goal", "Check rollback", "--workspace-mode", "proposal_only"], { cwd: repoRoot, replacements }), "create-feature B");

          const featA = featureIdByTitle(tempRepo, "Cycle A");
          const featB = featureIdByTitle(tempRepo, "Cycle B");
          const dagPath = path.join(tempRepo, ".bagakit", "feature-tracker", "index", "FEATURES_DAG.json");
          const archiveDir = path.join(tempRepo, ".bagakit", "feature-tracker", "index", "archive");

          const failedReplan = runCommand("bash", [script, "replan-features", "--root", tempRepo, "--dependency", `${featA}:${featB}`, "--dependency", `${featB}:${featA}`], { cwd: repoRoot, replacements });
          expectFail(failedReplan, "cyclic replan");
          assert.ok(failedReplan.stderr.includes("dependency cycle detected"));

          const stateAPath = path.join(tempRepo, ".bagakit", "feature-tracker", "features", featA, "state.json");
          const stateBPath = path.join(tempRepo, ".bagakit", "feature-tracker", "features", featB, "state.json");
          const stateA = JSON.parse(fs.readFileSync(stateAPath, "utf8")) as Record<string, unknown>;
          const stateB = JSON.parse(fs.readFileSync(stateBPath, "utf8")) as Record<string, unknown>;
          assert.deepEqual(stateA.depends_on ?? [], []);
          assert.deepEqual(stateB.depends_on ?? [], []);

          fs.writeFileSync(dagPath, "not json\n", "utf8");
          expectOk(runCommand("bash", [script, "replan-features", "--root", tempRepo, "--clear-dependencies", featA, "--clear-dependencies", featB], { cwd: repoRoot, replacements }), "replan after malformed dag");
          const archivedFiles = fs.readdirSync(archiveDir).filter((name) => name.endsWith(".json")).sort();
          assert.ok(archivedFiles.length > 0);
          assert.equal(fs.readFileSync(path.join(archiveDir, archivedFiles.at(-1)!), "utf8"), "not json\n");
          JSON.parse(fs.readFileSync(dagPath, "utf8"));

          fs.rmSync(dagPath, { force: true, recursive: true });
          fs.mkdirSync(dagPath, { recursive: true });
          writeTextFile(path.join(dagPath, "README.txt"), "directory sentinel\n");
          expectOk(runCommand("bash", [script, "replan-features", "--root", tempRepo, "--clear-dependencies", featA, "--clear-dependencies", featB], { cwd: repoRoot, replacements }), "replan after dag directory");
          const archivedDirs = fs.readdirSync(archiveDir).filter((name) => name.endsWith(".json") && fs.statSync(path.join(archiveDir, name)).isDirectory()).sort();
          assert.ok(archivedDirs.length > 0);
          assert.equal(fs.readFileSync(path.join(archiveDir, archivedDirs.at(-1)!, "README.txt"), "utf8"), "directory sentinel\n");
          assert.equal(fs.statSync(dagPath).isFile(), true);
          JSON.parse(fs.readFileSync(dagPath, "utf8"));

          return {
            assertions: [
              "failed cyclic replans do not persist depends_on overrides into canonical feature state",
              "replan-features can archive a malformed prior DAG as raw history and still write a fresh projection",
              "replan-features also recovers when the existing DAG path is a directory instead of a file",
            ],
            commands: [
              `bash ${script} replan-features --root <temp-repo> --dependency ${featA}:${featB} --dependency ${featB}:${featA}`,
              `bash ${script} replan-features --root <temp-repo> --clear-dependencies ${featA} --clear-dependencies ${featB}`,
            ],
            artifacts: [
              { label: "features-dag", path: dagPath },
              { label: "dag-archive-dir", path: archiveDir },
            ],
            outputs: {
              feat_a: featA,
              feat_b: featB,
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
