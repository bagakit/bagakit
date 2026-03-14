import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  activateFeatureTracker,
  appendCheckpoint,
  applyFlowRunner,
  archiveItem,
  computeNextAction,
  computeResumeCandidates,
  createManualItem,
  ingestFeatureTracker,
  loadItemState,
  openIncident,
  resolveIncident,
  validateFlowRunner,
} from "../../../../skills/harness/bagakit-flow-runner/scripts/lib/core.ts";

function makeTempRepo(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bagakit-flow-runner-test-"));
}

function initGitRepo(root: string): void {
  const run = (args: string[]) => {
    const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  };
  run(["init", "-q", "-b", "main"]);
  run(["config", "user.name", "Bagakit"]);
  run(["config", "user.email", "bagakit@example.com"]);
  fs.writeFileSync(path.join(root, "README.md"), "# demo\n", "utf8");
  run(["add", "README.md"]);
  run(["commit", "-q", "-m", "init"]);
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function initFeatureTrackerFixture(root: string, status: string): void {
  const trackerRoot = path.join(root, ".bagakit", "feature-tracker");
  writeJson(path.join(trackerRoot, "index", "features.json"), {
    features: [
      {
        feat_id: "f-demo",
        title: "Demo feature",
        status,
        workspace_mode: "worktree",
      },
    ],
  });
  writeJson(path.join(trackerRoot, "features", "f-demo", "state.json"), {
    feat_id: "f-demo",
    title: "Demo feature",
    status,
    workspace_mode: "worktree",
    current_task_id: "",
  });
  writeJson(path.join(trackerRoot, "features", "f-demo", "tasks.json"), {
    tasks: [],
  });
}

const currentFile = fileURLToPath(import.meta.url);
const skillDir = path.resolve(path.dirname(currentFile), "../../../../skills/harness/bagakit-flow-runner");

test("manual item next/checkpoint/archive flow stays coherent", () => {
  const root = makeTempRepo();
  try {
    initGitRepo(root);
    applyFlowRunner(root, skillDir);
    createManualItem(root, skillDir, "demo", "Demo item", "manual", "manual:demo", 100, 0.8);

    const nextPayload = computeNextAction(root);
    assert.equal(nextPayload.recommended_action, "run_session");
    assert.equal(nextPayload.session_contract.launch_bounded_session, true);

    const incidentId = openIncident(root, "demo", "review", "Need review", "resume_execution");
    const secondIncidentId = openIncident(root, "demo", "review", "Need another review", "resume_execution");
    assert.notEqual(incidentId, secondIncidentId);
    let blockedPayload = computeNextAction(root);
    assert.equal(blockedPayload.recommended_action, "clear_blocker");
    assert.equal(blockedPayload.checkpoint_request?.session_status, "blocked");

    resolveIncident(root, "demo", incidentId, "resolved");
    let state = loadItemState(path.join(root, ".bagakit", "flow-runner", "items", "demo", "state.json"));
    assert.equal(state.status, "blocked");
    assert.equal(state.current_step_status, "blocked");
    assert.equal(state.steps.find((step) => step.stage_key === state.current_stage)?.status, "blocked");

    resolveIncident(root, "demo", secondIncidentId, "resolved");
    blockedPayload = computeNextAction(root);
    assert.equal(blockedPayload.recommended_action, "run_session");

    appendCheckpoint(
      root,
      "demo",
      "inspect",
      "progress",
      "Inspect",
      "Read files",
      "Ready",
      "Proceed",
      "yes",
      "in_progress",
    );
    appendCheckpoint(
      root,
      "demo",
      "closeout",
      "gate_passed",
      "Closeout",
      "Checked evidence",
      "Done",
      "Archive",
      "yes",
      "completed",
    );

    state = loadItemState(path.join(root, ".bagakit", "flow-runner", "items", "demo", "state.json"));
    assert.equal(state.steps.find((step) => step.stage_key === state.current_stage)?.status, state.current_step_status);

    const resumePayload = computeResumeCandidates(root);
    assert.equal(resumePayload.closeout.length, 1);
    archiveItem(root, "demo");
    assert.deepEqual(validateFlowRunner(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("cannot resolve the last blocker with stay_blocked unless another blocking source remains", () => {
  const root = makeTempRepo();
  try {
    initGitRepo(root);
    applyFlowRunner(root, skillDir);
    createManualItem(root, skillDir, "blocked-demo", "Blocked demo", "manual", "manual:blocked-demo", 100, 0.8);
    const incidentId = openIncident(root, "blocked-demo", "review", "Need decision", "stay_blocked");
    assert.throws(
      () => resolveIncident(root, "blocked-demo", incidentId, "resolved"),
      /stay_blocked/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("feature-tracker refresh preserves local incident blocks until source closeout wins", () => {
  const root = makeTempRepo();
  try {
    initGitRepo(root);
    initFeatureTrackerFixture(root, "in_progress");
    applyFlowRunner(root, skillDir);

    let result = ingestFeatureTracker(root);
    assert.equal(result.imported, 1);

    const itemId = "feature-f-demo";
    const incidentId = openIncident(root, itemId, "review", "Need review", "stay_blocked");

    result = ingestFeatureTracker(root);
    assert.equal(result.updated, 1);

    let state = loadItemState(path.join(root, ".bagakit", "flow-runner", "items", itemId, "state.json"));
    assert.equal(state.status, "blocked");
    assert.deepEqual(state.runtime.open_incident_ids, [incidentId]);
    assert.equal(state.steps.find((step) => step.stage_key === state.current_stage)?.status, "blocked");

    initFeatureTrackerFixture(root, "done");
    result = ingestFeatureTracker(root);
    assert.equal(result.updated, 1);

    state = loadItemState(path.join(root, ".bagakit", "flow-runner", "items", itemId, "state.json"));
    assert.equal(state.status, "completed");
    assert.deepEqual(state.runtime.open_incident_ids, []);
    assert.equal(state.steps.find((step) => step.stage_key === state.current_stage)?.status, state.current_step_status);
    const incident = readJson<{ status: string; close_note: string }>(
      path.join(root, ".bagakit", "flow-runner", "items", itemId, "incidents", `${incidentId}.json`),
    );
    assert.equal(incident.status, "closed");
    assert.match(incident.close_note, /feature-tracker closeout/);
    assert.deepEqual(validateFlowRunner(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("feature-tracker activation returns a runnable packet and fails closed for proposal_only", () => {
  const root = makeTempRepo();
  try {
    initGitRepo(root);
    initFeatureTrackerFixture(root, "proposal");
    const statePath = path.join(root, ".bagakit", "feature-tracker", "features", "f-demo", "state.json");
    const statePayload = readJson<Record<string, unknown>>(statePath);
    statePayload.workspace_mode = "proposal_only";
    writeJson(statePath, statePayload);
    applyFlowRunner(root, skillDir);

    assert.throws(
      () => activateFeatureTracker(root, "f-demo"),
      new RegExp("proposal_only"),
    );

    const updatedStatePayload = readJson<Record<string, unknown>>(statePath);
    updatedStatePayload.workspace_mode = "current_tree";
    writeJson(statePath, updatedStatePayload);

    const payload = activateFeatureTracker(root, "f-demo");
    assert.equal(payload.schema, "bagakit/flow-runner/feature-activation/v1");
    assert.equal(payload.command, "activate-feature-tracker");
    assert.equal(payload.feature_id, "f-demo");
    assert.equal(payload.item_id, "feature-f-demo");
    assert.equal(payload.flow_next.recommended_action, "run_session");
    assert.equal(payload.flow_next.item_id, "feature-f-demo");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("manual item creation rejects non-finite numbers before writing state", () => {
  const root = makeTempRepo();
  try {
    initGitRepo(root);
    applyFlowRunner(root, skillDir);
    assert.throws(
      () => createManualItem(root, skillDir, "bad", "Bad item", "manual", "manual:bad", Number.NaN, 0.8),
      /finite number/,
    );
    assert.equal(fs.existsSync(path.join(root, ".bagakit", "flow-runner", "items", "bad", "state.json")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("applied policy and recipe templates stay aligned with the documented contract", () => {
  const root = makeTempRepo();
  try {
    initGitRepo(root);
    applyFlowRunner(root, skillDir);

    const policy = readJson<Record<string, unknown>>(path.join(root, ".bagakit", "flow-runner", "policy.json"));
    assert.equal(policy.schema, "bagakit/flow-runner/policy/v2");
    assert.deepEqual(Object.keys(policy).sort(), ["safety", "schema"]);
    assert.deepEqual(Object.keys(policy.safety as Record<string, unknown>).sort(), [
      "checkpoint_before_stop",
      "persist_state_before_stop",
      "snapshot_before_session",
    ]);

    const recipe = readJson<Record<string, unknown>>(path.join(root, ".bagakit", "flow-runner", "recipe.json"));
    assert.equal(recipe.schema, "bagakit/flow-runner/recipe/v2");
    assert.deepEqual(Object.keys(recipe).sort(), ["recipe_id", "recipe_version", "schema", "stage_chain"]);
    const stageChain = recipe.stage_chain as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(stageChain));
    assert.ok(stageChain.length > 0);
    for (const stage of stageChain) {
      assert.deepEqual(Object.keys(stage).sort(), ["goal", "stage_key"]);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
