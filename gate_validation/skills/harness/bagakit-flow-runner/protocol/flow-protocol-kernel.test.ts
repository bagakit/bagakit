import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  FLOW_PROTOCOL_SCHEMAS,
  appendNdjson,
  applySourceRefresh,
  archiveFlowItem,
  atomicWriteJson,
  createFlowItem,
  normalizeFlowState,
  openIncident,
  projectNextAction,
  projectResumeCandidates,
  readJsonFile,
  readNdjsonFile,
  recordCheckpoint,
  resolveIncident,
  validateItemState,
  validateNextActionPayload,
  validateResumeCandidatesPayload,
  type ItemPaths,
  type LoopRecipe,
  type RunnerPolicy,
} from "../../../../../skills/harness/bagakit-flow-runner/scripts/lib/protocol/index.ts";

const NOW = "2026-05-06T00:00:00Z";

function recipe(): LoopRecipe {
  return {
    schema: FLOW_PROTOCOL_SCHEMAS.recipe,
    recipe_id: "bounded-session",
    recipe_version: "v1",
    stage_chain: [
      { stage_key: "inspect", goal: "inspect the work item" },
      { stage_key: "review", goal: "review the result" },
    ],
  };
}

function pathsFor(itemId: string, root = ".bagakit/flow-runner/items"): ItemPaths {
  const base = `${root}/${itemId}`;
  return {
    handoff: `${base}/handoff.md`,
    checkpoints: `${base}/checkpoints.ndjson`,
    progress_log: `${base}/progress.ndjson`,
    mutation_receipts: `${base}/mutation-receipts.ndjson`,
    plan_revisions_dir: `${base}/plan-revisions`,
    incidents_dir: `${base}/incidents`,
  };
}

function policy(): RunnerPolicy {
  return {
    schema: FLOW_PROTOCOL_SCHEMAS.policy,
    safety: {
      snapshot_before_session: true,
      checkpoint_before_stop: true,
      persist_state_before_stop: true,
    },
  };
}

test("createFlowItem builds a valid item and receipt from recipe truth", () => {
  const result = createFlowItem({
    item_id: "manual-one",
    title: "Manual one",
    source_kind: "manual",
    source_ref: "manual:one",
    priority: 10,
    confidence: 0.8,
    recipe: recipe(),
    paths: pathsFor("manual-one"),
    now: NOW,
  });

  assert.equal(result.state.current_stage, "inspect");
  assert.equal(result.state.current_step_status, "pending");
  assert.equal(result.receipt.schema, FLOW_PROTOCOL_SCHEMAS.mutationReceipt);
  assert.equal(result.receipt.mutation, "create_item");
  validateItemState(result.state);
});

test("validation rejects current stage drift from declared steps", () => {
  const created = createFlowItem({
    item_id: "manual-one",
    title: "Manual one",
    source_kind: "manual",
    source_ref: "manual:one",
    priority: 10,
    confidence: 0.8,
    recipe: recipe(),
    paths: pathsFor("manual-one"),
    now: NOW,
  });

  assert.throws(
    () => validateItemState({ ...created.state, current_stage: "missing-stage" }),
    /current_stage must match one declared step/,
  );
});

test("checkpoint mutation updates runner-owned state and emits protocol payloads", () => {
  const created = createFlowItem({
    item_id: "manual-one",
    title: "Manual one",
    source_kind: "manual",
    source_ref: "manual:one",
    priority: 10,
    confidence: 0.8,
    recipe: recipe(),
    paths: pathsFor("manual-one"),
    now: NOW,
  });

  const checkpointed = recordCheckpoint(created.state, {
    stage: "inspect",
    session_status: "progress",
    objective: "inspect",
    attempted: "read files",
    result: "found next edit",
    next_action: "continue",
    clean_state: "yes",
    now: "2026-05-06T00:01:00Z",
    item_path: ".bagakit/flow-runner/items/manual-one/state.json",
  });

  assert.equal(checkpointed.state.status, "in_progress");
  assert.equal(checkpointed.state.runtime.session_count, 1);
  assert.equal(checkpointed.payload.checkpoint.item_status, "in_progress");
  assert.equal(checkpointed.payload.progress.schema, FLOW_PROTOCOL_SCHEMAS.progress);
  assert.equal(checkpointed.receipt.authority, "runner_local");
  assert.ok(checkpointed.receipt.events.some((event) => event.field_path === "runtime.session_count"));
});

test("source-owned checkpoint rejects runner-local lifecycle override", () => {
  const created = createFlowItem({
    item_id: "feature-demo",
    title: "Feature demo",
    source_kind: "feature-tracker",
    source_ref: "feature-tracker:demo",
    priority: 100,
    confidence: 0.7,
    recipe: recipe(),
    paths: pathsFor("feature-demo"),
    now: NOW,
  });

  assert.throws(
    () => recordCheckpoint(created.state, {
      stage: "inspect",
      session_status: "progress",
      objective: "inspect",
      attempted: "work",
      result: "done",
      next_action: "refresh source",
      clean_state: "yes",
      now: "2026-05-06T00:02:00Z",
      item_path: ".bagakit/flow-runner/items/feature-demo/state.json",
      item_status_override: "completed",
      source_status: "todo",
    }),
    /source-owned items do not accept runner-local item status overrides/,
  );
});

test("source-owned blocked checkpoint requires source block or open incident", () => {
  const created = createFlowItem({
    item_id: "feature-demo",
    title: "Feature demo",
    source_kind: "feature-tracker",
    source_ref: "feature-tracker:demo",
    priority: 100,
    confidence: 0.7,
    recipe: recipe(),
    paths: pathsFor("feature-demo"),
    now: NOW,
  });

  assert.throws(
    () => recordCheckpoint(created.state, {
      stage: "inspect",
      session_status: "blocked",
      objective: "inspect",
      attempted: "work",
      result: "blocked by local execution",
      next_action: "open incident",
      clean_state: "yes",
      now: "2026-05-06T00:02:00Z",
      item_path: ".bagakit/flow-runner/items/feature-demo/state.json",
      source_status: "in_progress",
    }),
    /source-owned blocked checkpoint requires a blocked source status or an open incident/,
  );

  const upstreamBlocked = recordCheckpoint(created.state, {
    stage: "inspect",
    session_status: "blocked",
    objective: "inspect",
    attempted: "work",
    result: "upstream blocked",
    next_action: "wait for source",
    clean_state: "yes",
    now: "2026-05-06T00:03:00Z",
    item_path: ".bagakit/flow-runner/items/feature-demo/state.json",
    source_status: "blocked",
  });
  assert.equal(upstreamBlocked.state.status, "blocked");

  const localIncident = openIncident(created.state, {
    incident_id: "inc-001",
    family: "validation",
    summary: "blocked by validation",
    recommended_resume: "resume_execution",
    now: "2026-05-06T00:04:00Z",
  });
  const locallyBlocked = recordCheckpoint(localIncident.state, {
    stage: "inspect",
    session_status: "blocked",
    objective: "inspect",
    attempted: "work",
    result: "local incident remains",
    next_action: "resolve incident",
    clean_state: "yes",
    now: "2026-05-06T00:05:00Z",
    item_path: ".bagakit/flow-runner/items/feature-demo/state.json",
    source_status: "in_progress",
  });
  assert.deepEqual(locallyBlocked.state.runtime.open_incident_ids, ["inc-001"]);
  assert.equal(locallyBlocked.state.status, "blocked");
});

test("source authority mutations reject runner-owned items", () => {
  const created = createFlowItem({
    item_id: "manual-one",
    title: "Manual one",
    source_kind: "manual",
    source_ref: "manual:one",
    priority: 10,
    confidence: 0.8,
    recipe: recipe(),
    paths: pathsFor("manual-one"),
    now: NOW,
  });

  assert.throws(
    () => applySourceRefresh(created.state, {
      now: "2026-05-06T00:03:00Z",
      source_status: "completed",
    }),
    /source refresh requires a source-owned item/,
  );
  assert.throws(
    () => normalizeFlowState(created.state, {
      now: "2026-05-06T00:03:00Z",
      archive_status: "archived",
      paths: pathsFor("manual-one", ".bagakit/flow-runner/archive"),
      authority: "source_mirror",
    }),
    /source normalization requires a source-owned item/,
  );
});

test("source refresh keeps local incidents blocking until source closeout wins", () => {
  const created = createFlowItem({
    item_id: "feature-demo",
    title: "Feature demo",
    source_kind: "feature-tracker",
    source_ref: "feature-tracker:demo",
    priority: 100,
    confidence: 0.7,
    recipe: recipe(),
    paths: pathsFor("feature-demo"),
    now: NOW,
  });
  const blocked = openIncident(created.state, {
    incident_id: "inc-001",
    family: "validation",
    summary: "blocked by validation",
    recommended_resume: "resume_execution",
    now: "2026-05-06T00:03:00Z",
  });

  const stillBlocked = applySourceRefresh(blocked.state, {
    now: "2026-05-06T00:04:00Z",
    source_status: "todo",
  });
  assert.equal(stillBlocked.state.status, "blocked");
  assert.deepEqual(stillBlocked.state.runtime.open_incident_ids, ["inc-001"]);

  const closedBySource = applySourceRefresh(stillBlocked.state, {
    now: "2026-05-06T00:05:00Z",
    source_status: "completed",
  });
  assert.equal(closedBySource.state.status, "completed");
  assert.deepEqual(closedBySource.state.runtime.open_incident_ids, []);
});

test("source refresh preserves runner-owned step state while updating lifecycle baseline", () => {
  const created = createFlowItem({
    item_id: "feature-demo",
    title: "Feature demo",
    source_kind: "feature-tracker",
    source_ref: "feature-tracker:demo",
    priority: 100,
    confidence: 0.7,
    recipe: recipe(),
    paths: pathsFor("feature-demo"),
    now: NOW,
  });
  const checkpointed = recordCheckpoint(created.state, {
    stage: "inspect",
    session_status: "progress",
    objective: "inspect",
    attempted: "work",
    result: "still running",
    next_action: "continue",
    clean_state: "yes",
    now: "2026-05-06T00:04:00Z",
    item_path: ".bagakit/flow-runner/items/feature-demo/state.json",
    source_status: "in_progress",
  });

  const refreshed = applySourceRefresh(checkpointed.state, {
    now: "2026-05-06T00:05:00Z",
    source_status: "todo",
  });
  assert.equal(refreshed.state.status, "todo");
  assert.equal(refreshed.state.current_stage, "inspect");
  assert.equal(refreshed.state.current_step_status, "active");
  assert.equal(refreshed.state.steps.find((step) => step.stage_key === "inspect")?.status, "active");
});

test("resolveIncident resumes runner-owned blocked item through receipt state", () => {
  const created = createFlowItem({
    item_id: "manual-one",
    title: "Manual one",
    source_kind: "manual",
    source_ref: "manual:one",
    priority: 10,
    confidence: 0.8,
    recipe: recipe(),
    paths: pathsFor("manual-one"),
    now: NOW,
  });
  const blocked = openIncident(created.state, {
    incident_id: "inc-001",
    family: "tooling",
    summary: "missing tool",
    recommended_resume: "resume_execution",
    now: "2026-05-06T00:03:00Z",
  });

  const resolved = resolveIncident(blocked.state, blocked.payload.incident, {
    close_note: "tool installed",
    now: "2026-05-06T00:04:00Z",
  });
  assert.equal(resolved.state.status, "todo");
  assert.equal(resolved.payload.incident.status, "closed");
});

test("projection prefers sole in-progress item and keeps source-owned closeout as stop", () => {
  const manual = createFlowItem({
    item_id: "manual-one",
    title: "Manual one",
    source_kind: "manual",
    source_ref: "manual:one",
    priority: 10,
    confidence: 0.8,
    recipe: recipe(),
    paths: pathsFor("manual-one"),
    now: NOW,
  });
  const feature = applySourceRefresh(createFlowItem({
    item_id: "feature-demo",
    title: "Feature demo",
    source_kind: "feature-tracker",
    source_ref: "feature-tracker:demo",
    priority: 100,
    confidence: 0.7,
    recipe: recipe(),
    paths: pathsFor("feature-demo"),
    now: NOW,
  }).state, {
    now: "2026-05-06T00:06:00Z",
    source_status: "completed",
  });

  const next = projectNextAction({
    items: [manual.state, feature.state],
    policy: policy(),
    explicit_item_id: "feature-demo",
    item_path_for: (item) => `.bagakit/flow-runner/items/${item.item_id}/state.json`,
  });
  assert.equal(next.recommended_action, "stop");
  assert.equal(next.action_reason, "closeout_pending");
  assert.equal(next.session_contract.archive_only_closeout, false);

  const resume = projectResumeCandidates([manual.state, feature.state]);
  assert.deepEqual(resume.live.map((item) => item.item_id), ["manual-one"]);
  assert.deepEqual(resume.closeout.map((item) => item.item_id), ["feature-demo"]);
});

test("next-action validator preserves checkpoint request and rejects malformed request payloads", () => {
  const manual = createFlowItem({
    item_id: "manual-one",
    title: "Manual one",
    source_kind: "manual",
    source_ref: "manual:one",
    priority: 10,
    confidence: 0.8,
    recipe: recipe(),
    paths: pathsFor("manual-one"),
    now: NOW,
  });
  const next = projectNextAction({
    items: [manual.state],
    policy: policy(),
    explicit_item_id: "manual-one",
    item_path_for: (item) => `.bagakit/flow-runner/items/${item.item_id}/state.json`,
    checkpoint_command_for: () => "flow-runner checkpoint ...",
  });

  const validated = validateNextActionPayload(next);
  assert.equal(validated.checkpoint_request?.stage, "inspect");
  assert.equal(validated.checkpoint_request?.command_example, "flow-runner checkpoint ...");

  const defaultCommand = validateNextActionPayload(projectNextAction({
    items: [manual.state],
    policy: policy(),
    explicit_item_id: "manual-one",
  }));
  assert.match(defaultCommand.checkpoint_request?.command_example ?? "", /flow-runner checkpoint --item manual-one/);

  assert.throws(
    () => validateNextActionPayload({
      ...next,
      checkpoint_request: {
        stage: "inspect",
        session_status: "bogus",
        command_example: "flow-runner checkpoint ...",
      },
    }),
    /checkpoint_request\.session_status/,
  );
  assert.throws(
    () => validateNextActionPayload({
      ...next,
      checkpoint_request: {
        stage: "inspect",
        session_status: "progress",
        command_example: "",
      },
    }),
    /checkpoint_request\.command_example/,
  );
});

test("resume-candidates validator checks candidate structure instead of shallow arrays", () => {
  const manual = createFlowItem({
    item_id: "manual-one",
    title: "Manual one",
    source_kind: "manual",
    source_ref: "manual:one",
    priority: 10,
    confidence: 0.8,
    recipe: recipe(),
    paths: pathsFor("manual-one"),
    now: NOW,
  });
  const resume = projectResumeCandidates([manual.state], {
    item_path_for: (item) => `.bagakit/flow-runner/items/${item.item_id}/state.json`,
  });

  const validated = validateResumeCandidatesPayload(resume);
  assert.equal(validated.live[0]?.item_id, "manual-one");

  assert.throws(
    () => validateResumeCandidatesPayload({
      ...resume,
      live: [{ ...resume.live[0], item_status: "bogus" }],
    }),
    /live\[0\]\.item_status/,
  );
  assert.throws(
    () => validateResumeCandidatesPayload({
      ...resume,
      live: [{ ...resume.live[0], open_incident_ids: ["inc-1", 42] }],
    }),
    /live\[0\]\.open_incident_ids/,
  );
});

test("archiveFlowItem rejects source-owned items and archives runner-owned closeout", () => {
  const terminalManual = recordCheckpoint(createFlowItem({
    item_id: "manual-one",
    title: "Manual one",
    source_kind: "manual",
    source_ref: "manual:one",
    priority: 10,
    confidence: 0.8,
    recipe: recipe(),
    paths: pathsFor("manual-one"),
    now: NOW,
  }).state, {
    stage: "inspect",
    session_status: "terminal",
    objective: "finish",
    attempted: "done",
    result: "complete",
    next_action: "archive",
    clean_state: "yes",
    now: "2026-05-06T00:07:00Z",
    item_path: ".bagakit/flow-runner/items/manual-one/state.json",
  });

  const archived = archiveFlowItem(terminalManual.state, {
    now: "2026-05-06T00:08:00Z",
    archived_paths: pathsFor("manual-one", ".bagakit/flow-runner/archive"),
  });
  assert.equal(archived.state.archive_status, "archived");

  const terminalFeature = applySourceRefresh(createFlowItem({
    item_id: "feature-demo",
    title: "Feature demo",
    source_kind: "feature-tracker",
    source_ref: "feature-tracker:demo",
    priority: 100,
    confidence: 0.7,
    recipe: recipe(),
    paths: pathsFor("feature-demo"),
    now: NOW,
  }).state, {
    now: "2026-05-06T00:09:00Z",
    source_status: "completed",
  });

  assert.throws(
    () => archiveFlowItem(terminalFeature.state, {
      now: "2026-05-06T00:10:00Z",
      archived_paths: pathsFor("feature-demo", ".bagakit/flow-runner/archive"),
    }),
    /source-owned items must be closed by their source/,
  );
});

test("state normalization records source-owned archive relocation without runner archive authority", () => {
  const terminalFeature = applySourceRefresh(createFlowItem({
    item_id: "feature-demo",
    title: "Feature demo",
    source_kind: "feature-tracker",
    source_ref: "feature-tracker:demo",
    priority: 100,
    confidence: 0.7,
    recipe: recipe(),
    paths: pathsFor("feature-demo"),
    now: NOW,
  }).state, {
    now: "2026-05-06T00:09:00Z",
    source_status: "completed",
  });

  const normalized = normalizeFlowState(terminalFeature.state, {
    now: "2026-05-06T00:10:00Z",
    archive_status: "archived",
    paths: pathsFor("feature-demo", ".bagakit/flow-runner/archive"),
    authority: "source_mirror",
    notes: ["feature-tracker retired mirrored item"],
  });

  assert.equal(normalized.state.archive_status, "archived");
  assert.equal(normalized.state.paths.mutation_receipts, ".bagakit/flow-runner/archive/feature-demo/mutation-receipts.ndjson");
  assert.equal(normalized.receipt.mutation, "state_normalization");
  assert.equal(normalized.receipt.authority, "source_mirror");
  assert.ok(normalized.receipt.events.some((event) => event.field_path === "paths"));
});

test("source archive normalization requires terminal source-owned state", () => {
  const feature = createFlowItem({
    item_id: "feature-demo",
    title: "Feature demo",
    source_kind: "feature-tracker",
    source_ref: "feature-tracker:demo",
    priority: 100,
    confidence: 0.7,
    recipe: recipe(),
    paths: pathsFor("feature-demo"),
    now: NOW,
  });

  assert.throws(
    () => normalizeFlowState(feature.state, {
      now: "2026-05-06T00:10:00Z",
      archive_status: "archived",
      paths: pathsFor("feature-demo", ".bagakit/flow-runner/archive"),
      authority: "source_mirror",
    }),
    /source archive normalization requires a terminal source-owned item/,
  );
});

test("persistence helpers write atomic json and ndjson with validators", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "flow-kernel-"));
  const jsonPath = path.join(root, "state.json");
  const logPath = path.join(root, "events.ndjson");
  const created = createFlowItem({
    item_id: "manual-one",
    title: "Manual one",
    source_kind: "manual",
    source_ref: "manual:one",
    priority: 10,
    confidence: 0.8,
    recipe: recipe(),
    paths: pathsFor("manual-one"),
    now: NOW,
  });

  atomicWriteJson(jsonPath, created.state);
  appendNdjson(logPath, created.receipt);
  appendNdjson(logPath, { schema: "demo", ok: true });

  const loaded = readJsonFile(jsonPath, validateItemState);
  const entries = readNdjsonFile(logPath);
  assert.equal(loaded.item_id, "manual-one");
  assert.equal(entries.length, 2);
  assert.throws(() => atomicWriteJson(path.join(root, "bad.json"), { bad: undefined }));

  fs.rmSync(root, { recursive: true, force: true });
});
