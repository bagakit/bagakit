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
  captureSnapshot,
  computeNextAction,
  computeResumeCandidates,
  createManualItem,
  ingestFeatureTracker,
  loadItemState,
  openIncident,
  resolveIncident,
  validateFlowRunner,
} from "../../../../skills/harness/bagakit-flow-runner/scripts/lib/core.ts";
import {
  validatePolicy,
  validateRecipe,
} from "../../../../skills/harness/bagakit-flow-runner/scripts/lib/protocol/validation.ts";

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

function writeExecutable(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content, { encoding: "utf8", mode: 0o755 });
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function readNdjson(filePath: string): Record<string, unknown>[] {
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
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
    const surfaceText = fs.readFileSync(path.join(root, ".bagakit", "flow-runner", "surface.toml"), "utf8");
    assert.match(surfaceText, new RegExp("^schema_version = 1$", "m"));
    assert.match(surfaceText, new RegExp('^surface_root = "\\.bagakit/flow-runner"$', "m"));
    assert.match(surfaceText, new RegExp('^owner_id = "bagakit-flow-runner"$', "m"));
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
    const receipts = readNdjson(path.join(root, ".bagakit", "flow-runner", "archive", "demo", "mutation-receipts.ndjson"));
    assert.deepEqual(receipts.map((receipt) => receipt.mutation), [
      "create_item",
      "open_incident",
      "open_incident",
      "resolve_incident",
      "resolve_incident",
      "checkpoint",
      "checkpoint",
      "archive_item",
    ]);
    assert.equal(receipts.at(-1)?.authority, "runner_local");
    assert.deepEqual(validateFlowRunner(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("snapshot archives stable untracked paths when a listed path vanishes", () => {
  const root = makeTempRepo();
  const originalPath = process.env.PATH;
  try {
    initGitRepo(root);
    applyFlowRunner(root, skillDir);
    createManualItem(root, skillDir, "snapshot-demo", "Snapshot demo", "manual", "manual:snapshot", 100, 0.8);

    fs.writeFileSync(path.join(root, "kept file.txt"), "kept\n", "utf8");
    fs.writeFileSync(path.join(root, "line\nbreak.txt"), "newline\n", "utf8");
    fs.writeFileSync(path.join(root, "vanishing.txt"), "transient\n", "utf8");
    fs.symlinkSync("kept file.txt", path.join(root, "kept-link"));

    const shimDir = path.join(root, ".snapshot-command-shims");
    fs.mkdirSync(shimDir);
    const realGit = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
    const realTar = spawnSync("sh", ["-c", "command -v tar"], { encoding: "utf8" }).stdout.trim();
    assert.ok(realGit);
    assert.ok(realTar);
    writeExecutable(path.join(shimDir, "git"), `#!/bin/sh
"$SNAPSHOT_REAL_GIT" "$@"
exit_code=$?
for arg in "$@"; do
  if [ "$arg" = "ls-files" ]; then
    rm -f "$SNAPSHOT_DELETE_PATH"
    break
  fi
done
exit "$exit_code"
`);
    writeExecutable(path.join(shimDir, "tar"), `#!/bin/sh
if [ "\${COPYFILE_DISABLE:-}" != "1" ]; then
  echo "COPYFILE_DISABLE was not set" >&2
  exit 42
fi
exec "$SNAPSHOT_REAL_TAR" "$@"
`);
    process.env.PATH = `${shimDir}${path.delimiter}${originalPath ?? ""}`;
    process.env.SNAPSHOT_REAL_GIT = realGit;
    process.env.SNAPSHOT_REAL_TAR = realTar;
    process.env.SNAPSHOT_DELETE_PATH = path.join(root, "vanishing.txt");

    const metadata = captureSnapshot(root, "snapshot-demo", "race-safe");
    assert.equal(metadata.has_untracked_archive, true);
    assert.equal(fs.existsSync(path.join(root, "vanishing.txt")), false);

    const archivePath = path.join(root, ".bagakit", "flow-runner", "backups", metadata.snapshot_id, "untracked.tar");
    const extractDir = path.join(root, ".snapshot-extract");
    fs.mkdirSync(extractDir);
    const extract = spawnSync(realTar, ["-xf", archivePath, "-C", extractDir], { encoding: "utf8" });
    assert.equal(extract.status, 0, extract.stderr || extract.stdout);
    assert.equal(fs.readFileSync(path.join(extractDir, "kept file.txt"), "utf8"), "kept\n");
    assert.equal(fs.readFileSync(path.join(extractDir, "line\nbreak.txt"), "utf8"), "newline\n");
    assert.equal(fs.readlinkSync(path.join(extractDir, "kept-link")), "kept file.txt");
    assert.equal(fs.existsSync(path.join(extractDir, "vanishing.txt")), false);
  } finally {
    process.env.PATH = originalPath;
    delete process.env.SNAPSHOT_REAL_GIT;
    delete process.env.SNAPSHOT_REAL_TAR;
    delete process.env.SNAPSHOT_DELETE_PATH;
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

    const featureDir = path.join(root, ".bagakit", "feature-tracker", "features", "f-demo");
    const discardedDir = path.join(root, ".bagakit", "feature-tracker", "features-discarded", "f-demo");
    fs.mkdirSync(path.dirname(discardedDir), { recursive: true });
    fs.renameSync(featureDir, discardedDir);
    writeJson(path.join(root, ".bagakit", "feature-tracker", "index", "features.json"), {
      features: [
        {
          feat_id: "f-demo",
          title: "Demo feature",
          status: "discarded",
          workspace_mode: "worktree",
        },
      ],
    });
    const discardedState = readJson<Record<string, unknown>>(path.join(discardedDir, "state.json"));
    discardedState.status = "discarded";
    writeJson(path.join(discardedDir, "state.json"), discardedState);

    result = ingestFeatureTracker(root);
    assert.equal(result.retired, 1);
    const receipts = readNdjson(path.join(root, ".bagakit", "flow-runner", "archive", itemId, "mutation-receipts.ndjson"));
    assert.equal(receipts.at(-1)?.mutation, "state_normalization");
    assert.equal(receipts.at(-1)?.authority, "source_mirror");
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

test("manual item creation rejects forged feature-tracker source ownership", () => {
  const root = makeTempRepo();
  try {
    initGitRepo(root);
    applyFlowRunner(root, skillDir);
    assert.throws(
      () => createManualItem(root, skillDir, "forged", "Forged tracker", "feature-tracker", "feature-tracker:f-demo", 100, 0.8),
      /feature-tracker sourced items/,
    );
    assert.equal(fs.existsSync(path.join(root, ".bagakit", "flow-runner", "items", "forged", "state.json")), false);
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
    assert.ok(["safety", "schema"].every((key) => key in policy));
    assert.ok(
      ["checkpoint_before_stop", "persist_state_before_stop", "snapshot_before_session"].every(
        (key) => key in (policy.safety as Record<string, unknown>),
      ),
    );

    const recipe = readJson<Record<string, unknown>>(path.join(root, ".bagakit", "flow-runner", "recipe.json"));
    assert.equal(recipe.schema, "bagakit/flow-runner/recipe/v2");
    assert.ok(["recipe_id", "recipe_version", "schema", "stage_chain"].every((key) => key in recipe));
    const stageChain = recipe.stage_chain as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(stageChain));
    assert.ok(stageChain.length > 0);
    for (const stage of stageChain) {
      assert.ok(["goal", "stage_key"].every((key) => key in stage));
    }

    assert.doesNotThrow(() => validatePolicy({ ...policy, future_extension: { enabled: true } }));
    assert.doesNotThrow(() => validateRecipe({
      ...recipe,
      future_extension: true,
      stage_chain: stageChain.map((stage) => ({ ...stage, future_hint: "compatible" })),
    }));
    assert.throws(
      () => validatePolicy({
        schema: "bagakit/flow-runner/policy/v2",
        safety: {
          snapshot_before_session: true,
          checkpoint_before_stop: true,
        },
      }),
      /persist_state_before_stop must be a boolean/,
    );
    assert.throws(
      () => validateRecipe({
        schema: "bagakit/flow-runner/recipe/v2",
        recipe_id: "missing-version",
        stage_chain: [{ stage_key: "inspect", goal: "inspect" }],
      }),
      /recipe_version must be a non-empty string/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
