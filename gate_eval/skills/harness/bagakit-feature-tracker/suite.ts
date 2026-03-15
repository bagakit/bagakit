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

          return {
            assertions: [
              "feature-tracker validation rejects unsupported prose files in active feature roots",
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
  ],
};
