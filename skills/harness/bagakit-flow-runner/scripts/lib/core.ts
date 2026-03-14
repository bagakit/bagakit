import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  ACTION_REASONS,
  ACTIVATION_SCHEMA,
  ARCHIVE_STATUSES,
  CHECKPOINT_SCHEMA,
  CLEAN_STATES,
  INCIDENT_SCHEMA,
  INCIDENT_RESUMES,
  INCIDENT_STATUSES,
  ITEM_SCHEMA,
  ITEM_STATUSES,
  NEXT_SCHEMA,
  PLAN_REVISION_SCHEMA,
  POLICY_SCHEMA,
  PROGRESS_SCHEMA,
  RECIPE_SCHEMA,
  RESOLUTION_KINDS,
  RESUME_SCHEMA,
  SESSION_STATUSES,
  SNAPSHOT_SCHEMA,
  STEP_STATUSES,
  type ArchiveStatus,
  type CheckpointPayload,
  type CheckpointReceipt,
  type CleanState,
  type FeatureActivationPayload,
  type IncidentRecord,
  type IncidentResume,
  type ItemPaths,
  type ItemRuntime,
  type ItemState,
  type ItemStep,
  type ItemStatus,
  type LoopRecipe,
  type NextActionPayload,
  type PlanRevision,
  type ProgressEntry,
  type ResolutionKind,
  type ResumeCandidate,
  type ResumeCandidatesPayload,
  type RunnerPolicy,
  type SafeAnchor,
  type SessionContract,
  type SessionStatus,
  type SnapshotMetadata,
  type StepStatus,
} from "./model.ts";
import {
  appendNdjson,
  copyTemplateIfMissing,
  ensureGitRepo,
  readJsonFile,
  readNdjson,
  readText,
  runGit,
  sanitizeSnapshotLabel,
  utcNow,
  writeJsonFile,
  writeText,
} from "./io.ts";
import { FlowRunnerPaths } from "./paths.ts";

function assertBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean`);
  }
  return value;
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function assertNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be an array of strings`);
  }
  return value;
}

function assertEnum<T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new Error(`${label} must be one of ${allowed.join(", ")}`);
  }
  return value as T[number];
}

function toRepoRelative(root: string, absolutePath: string): string {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

export function ensureRunnerExists(paths: FlowRunnerPaths): void {
  if (!fs.existsSync(paths.runnerDir)) {
    throw new Error("flow-runner is not initialized. run flow-runner.sh apply --root <repo> first");
  }
}

export function loadPolicy(paths: FlowRunnerPaths): RunnerPolicy {
  const payload = readJsonFile<unknown>(paths.policyFile);
  const record = assertRecord(payload, paths.policyFile);
  if (record.schema !== POLICY_SCHEMA) {
    throw new Error(`invalid flow-runner policy schema in ${paths.policyFile}`);
  }
  const safety = assertRecord(record.safety, `${paths.policyFile}.safety`);
  return {
    schema: POLICY_SCHEMA,
    safety: {
      snapshot_before_session: assertBoolean(safety.snapshot_before_session, "policy.safety.snapshot_before_session"),
      checkpoint_before_stop: assertBoolean(safety.checkpoint_before_stop, "policy.safety.checkpoint_before_stop"),
      persist_state_before_stop: assertBoolean(safety.persist_state_before_stop, "policy.safety.persist_state_before_stop"),
    },
  };
}

export function loadRecipe(paths: FlowRunnerPaths): LoopRecipe {
  const payload = readJsonFile<unknown>(paths.recipeFile);
  const record = assertRecord(payload, paths.recipeFile);
  if (record.schema !== RECIPE_SCHEMA) {
    throw new Error(`invalid flow-runner recipe schema in ${paths.recipeFile}`);
  }
  const stagesRaw = record.stage_chain;
  if (!Array.isArray(stagesRaw) || stagesRaw.length === 0) {
    throw new Error(`recipe stage_chain must be a non-empty array: ${paths.recipeFile}`);
  }
  const stage_chain = stagesRaw.map((item, index) => {
    const stage = assertRecord(item, `recipe.stage_chain[${index}]`);
    return {
      stage_key: assertString(stage.stage_key, `recipe.stage_chain[${index}].stage_key`),
      goal: assertString(stage.goal, `recipe.stage_chain[${index}].goal`),
    };
  });
  return {
    schema: RECIPE_SCHEMA,
    recipe_id: assertString(record.recipe_id, "recipe.recipe_id"),
    recipe_version: assertString(record.recipe_version, "recipe.recipe_version"),
    stage_chain,
  };
}

function defaultSteps(recipe: LoopRecipe): ItemStep[] {
  return recipe.stage_chain.map((stage) => ({
    stage_key: stage.stage_key,
    goal: stage.goal,
    status: "pending",
    rollback_anchor: "",
    evidence_refs: [],
  }));
}

function itemStageKeys(state: ItemState): Set<string> {
  return new Set(state.steps.map((step) => step.stage_key));
}

function safeAnchorFromValue(value: unknown, label: string): SafeAnchor {
  if (value === null) {
    return null;
  }
  const record = assertRecord(value, label);
  return {
    kind: assertString(record.kind, `${label}.kind`),
    ref: assertString(record.ref, `${label}.ref`),
    summary: assertString(record.summary, `${label}.summary`),
  };
}

export function loadItemState(filePath: string): ItemState {
  const payload = readJsonFile<unknown>(filePath);
  const record = assertRecord(payload, filePath);
  if (record.schema !== ITEM_SCHEMA) {
    throw new Error(`invalid flow-runner item schema in ${filePath}`);
  }
  const paths = assertRecord(record.paths, `${filePath}.paths`);
  const runtime = assertRecord(record.runtime, `${filePath}.runtime`);
  const stepsRaw = record.steps;
  if (!Array.isArray(stepsRaw) || stepsRaw.length === 0) {
    throw new Error(`item.steps must be a non-empty array: ${filePath}`);
  }
  const steps = stepsRaw.map((item, index) => {
    const step = assertRecord(item, `${filePath}.steps[${index}]`);
    return {
      stage_key: assertString(step.stage_key, `${filePath}.steps[${index}].stage_key`),
      goal: assertString(step.goal, `${filePath}.steps[${index}].goal`),
      status: assertEnum(step.status, STEP_STATUSES, `${filePath}.steps[${index}].status`),
      rollback_anchor: typeof step.rollback_anchor === "string" ? step.rollback_anchor : "",
      evidence_refs: step.evidence_refs === undefined ? [] : assertStringArray(step.evidence_refs, `${filePath}.steps[${index}].evidence_refs`),
    };
  });
  return {
    schema: ITEM_SCHEMA,
    item_id: assertString(record.item_id, `${filePath}.item_id`),
    title: assertString(record.title, `${filePath}.title`),
    source_kind: assertString(record.source_kind, `${filePath}.source_kind`),
    source_ref: assertString(record.source_ref, `${filePath}.source_ref`),
    status: assertEnum(record.status, ITEM_STATUSES, `${filePath}.status`),
    archive_status: assertEnum(record.archive_status, ARCHIVE_STATUSES, `${filePath}.archive_status`),
    resolution: assertEnum(record.resolution, RESOLUTION_KINDS, `${filePath}.resolution`),
    current_stage: assertString(record.current_stage, `${filePath}.current_stage`),
    current_step_status: assertEnum(record.current_step_status, STEP_STATUSES, `${filePath}.current_step_status`),
    priority: assertNumber(record.priority, `${filePath}.priority`),
    confidence: assertNumber(record.confidence, `${filePath}.confidence`),
    created_at: assertString(record.created_at, `${filePath}.created_at`),
    updated_at: assertString(record.updated_at, `${filePath}.updated_at`),
    paths: {
      handoff: assertString(paths.handoff, `${filePath}.paths.handoff`),
      checkpoints: assertString(paths.checkpoints, `${filePath}.paths.checkpoints`),
      progress_log: assertString(paths.progress_log, `${filePath}.paths.progress_log`),
      plan_revisions_dir: assertString(paths.plan_revisions_dir, `${filePath}.paths.plan_revisions_dir`),
      incidents_dir: assertString(paths.incidents_dir, `${filePath}.paths.incidents_dir`),
    },
    runtime: {
      active_plan_revision_id: assertString(runtime.active_plan_revision_id, `${filePath}.runtime.active_plan_revision_id`),
      active_action_id: assertString(runtime.active_action_id, `${filePath}.runtime.active_action_id`),
      open_incident_ids: runtime.open_incident_ids === undefined ? [] : assertStringArray(runtime.open_incident_ids, `${filePath}.runtime.open_incident_ids`),
      session_count: assertNumber(runtime.session_count, `${filePath}.runtime.session_count`),
      latest_checkpoint_at: typeof runtime.latest_checkpoint_at === "string" ? runtime.latest_checkpoint_at : "",
      latest_snapshot_id: typeof runtime.latest_snapshot_id === "string" ? runtime.latest_snapshot_id : "",
      current_safe_anchor: safeAnchorFromValue(runtime.current_safe_anchor ?? null, `${filePath}.runtime.current_safe_anchor`),
    },
    steps,
  };
}

export function saveItemState(filePath: string, state: ItemState): void {
  writeJsonFile(filePath, state);
}

function syncResolutionFromStatus(state: ItemState): ItemState {
  const resolution: ResolutionKind = state.status === "completed" || state.status === "cancelled" ? "closeout" : "live";
  return {
    ...state,
    resolution,
  };
}

function syncCurrentStepRecord(state: ItemState, stepStatus: StepStatus, stage = state.current_stage): ItemState {
  return {
    ...state,
    current_stage: stage,
    current_step_status: stepStatus,
    steps: state.steps.map((step) =>
      step.stage_key === stage ? { ...step, status: stepStatus } : step,
    ),
  };
}

function closeOpenIncidents(
  paths: FlowRunnerPaths,
  itemId: string,
  incidentIds: string[],
  closeNote: string,
  archived = false,
): void {
  for (const incidentId of incidentIds) {
    const incidentPath = paths.itemIncident(itemId, incidentId, archived);
    if (!fs.existsSync(incidentPath)) {
      continue;
    }
    const incident = readJsonFile<IncidentRecord>(incidentPath);
    if (incident.schema !== INCIDENT_SCHEMA || incident.status !== "open") {
      continue;
    }
    writeJsonFile(incidentPath, {
      ...incident,
      status: "closed",
      closed_at: utcNow(),
      close_note: closeNote,
    } satisfies IncidentRecord);
  }
}

function uniqueTimestampedId(baseDir: string, prefix: string, middle: string, fileSuffix = ""): string {
  const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z").replace(/[-:]/g, "");
  let attempt = 0;
  while (true) {
    const suffix = attempt === 0 ? "" : `-${String(attempt + 1).padStart(2, "0")}`;
    const candidate = `${prefix}${stamp}-${middle}${suffix}`;
    const targetPath = path.join(baseDir, `${candidate}${fileSuffix}`);
    if (!fs.existsSync(targetPath)) {
      return candidate;
    }
    attempt += 1;
  }
}

function ensureItemLayout(paths: FlowRunnerPaths, itemId: string): void {
  fs.mkdirSync(paths.itemDir(itemId), { recursive: true });
  fs.mkdirSync(paths.itemPlanRevisionsDir(itemId), { recursive: true });
  fs.mkdirSync(paths.itemIncidentsDir(itemId), { recursive: true });
  if (!fs.existsSync(paths.itemHandoff(itemId))) {
    writeText(paths.itemHandoff(itemId), `# Work Item Handoff: ${itemId}\n`);
  }
  if (!fs.existsSync(paths.itemCheckpoints(itemId))) {
    writeText(paths.itemCheckpoints(itemId), "");
  }
  if (!fs.existsSync(paths.itemProgressLog(itemId))) {
    writeText(paths.itemProgressLog(itemId), "");
  }
}

function initialItemPaths(paths: FlowRunnerPaths, itemId: string): ItemPaths {
  return itemPathsForLocation(paths, itemId, false);
}

function itemPathsForLocation(paths: FlowRunnerPaths, itemId: string, archived: boolean): ItemPaths {
  return {
    handoff: toRepoRelative(paths.root, paths.itemHandoff(itemId, archived)),
    checkpoints: toRepoRelative(paths.root, paths.itemCheckpoints(itemId, archived)),
    progress_log: toRepoRelative(paths.root, paths.itemProgressLog(itemId, archived)),
    plan_revisions_dir: toRepoRelative(paths.root, paths.itemPlanRevisionsDir(itemId, archived)),
    incidents_dir: toRepoRelative(paths.root, paths.itemIncidentsDir(itemId, archived)),
  };
}

function writeInitialPlanRevision(paths: FlowRunnerPaths, itemId: string, sourceKind: string, sourceRef: string, title: string, currentTaskSnapshot: string): string {
  const revisionId = "pr-001";
  const revision: PlanRevision = {
    schema: PLAN_REVISION_SCHEMA,
    revision_id: revisionId,
    created_at: utcNow(),
    source_kind: sourceKind,
    source_ref: sourceRef,
    title_snapshot: title,
    current_task_snapshot: currentTaskSnapshot,
    notes: [],
  };
  writeJsonFile(paths.itemPlanRevision(itemId, revisionId), revision);
  return revisionId;
}

export function applyFlowRunner(root: string, skillDir: string): string {
  ensureGitRepo(root);
  const paths = new FlowRunnerPaths(root);
  fs.mkdirSync(paths.runnerDir, { recursive: true });
  fs.mkdirSync(paths.itemsDir, { recursive: true });
  fs.mkdirSync(paths.archiveDir, { recursive: true });
  fs.mkdirSync(paths.backupsDir, { recursive: true });
  copyTemplateIfMissing(skillDir, "runner-policy-template.json", paths.policyFile);
  copyTemplateIfMissing(skillDir, "loop-recipe-template.json", paths.recipeFile);
  if (!fs.existsSync(path.join(paths.runnerDir, ".gitignore"))) {
    writeText(path.join(paths.runnerDir, ".gitignore"), "backups/\n");
  }
  writeJsonFile(paths.nextActionFile, {
    schema: NEXT_SCHEMA,
    command: "next",
    recommended_action: "stop",
    action_reason: "no_actionable_item",
    session_contract: {
      launch_bounded_session: false,
      persist_state_before_stop: true,
      checkpoint_before_stop: true,
      snapshot_before_session: false,
      archive_only_closeout: false,
    },
  });
  writeJsonFile(paths.resumeCandidatesFile, {
    schema: RESUME_SCHEMA,
    command: "resume-candidates",
    live: [],
    closeout: [],
  });
  return paths.runnerDir;
}

export function createManualItem(
  root: string,
  skillDir: string,
  itemId: string,
  title: string,
  sourceKind: string,
  sourceRef: string,
  priority: number,
  confidence: number,
): string {
  const paths = new FlowRunnerPaths(root);
  ensureRunnerExists(paths);
  const recipe = loadRecipe(paths);
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(itemId)) {
    throw new Error(`invalid item id: ${itemId}`);
  }
  if (fs.existsSync(paths.itemDir(itemId)) || fs.existsSync(paths.itemDir(itemId, true))) {
    throw new Error(`item already exists: ${itemId}`);
  }
  if (!Number.isFinite(priority)) {
    throw new Error("priority must be a finite number");
  }
  if (!Number.isFinite(confidence)) {
    throw new Error("confidence must be a finite number");
  }
  ensureItemLayout(paths, itemId);
  const activePlanRevisionId = writeInitialPlanRevision(paths, itemId, sourceKind, sourceRef, title, "");
  const state: ItemState = {
    schema: ITEM_SCHEMA,
    item_id: itemId,
    title,
    source_kind: sourceKind,
    source_ref: sourceRef,
    status: "todo",
    archive_status: "active",
    resolution: "live",
    current_stage: recipe.stage_chain[0]!.stage_key,
    current_step_status: "pending",
    priority,
    confidence,
    created_at: utcNow(),
    updated_at: utcNow(),
    paths: initialItemPaths(paths, itemId),
    runtime: {
      active_plan_revision_id: activePlanRevisionId,
      active_action_id: "act-000",
      open_incident_ids: [],
      session_count: 0,
      latest_checkpoint_at: "",
      latest_snapshot_id: "",
      current_safe_anchor: null,
    },
    steps: defaultSteps(recipe),
  };
  saveItemState(paths.itemState(itemId), state);
  const template = readText(path.join(skillDir, "references", "tpl", "item-handoff-template.md"));
  writeText(
    paths.itemHandoff(itemId),
    template
      .replaceAll("<item-id>", itemId)
      .replaceAll("<title>", title)
      .replaceAll("<stage>", state.current_stage)
      .replaceAll("<status>", state.status)
      .replaceAll("<next-action>", "run one bounded session"),
  );
  return itemId;
}

function featureTrackerIndex(root: string): Record<string, unknown> {
  const indexPath = path.join(root, ".bagakit", "feature-tracker", "index", "features.json");
  const payload = readJsonFile<unknown>(indexPath);
  const record = assertRecord(payload, indexPath);
  if (!Array.isArray(record.features)) {
    throw new Error(`feature tracker index missing features list: ${indexPath}`);
  }
  return record;
}

function loadFeatureSource(root: string, featureId: string): { statePath: string; state: Record<string, unknown>; tasks: Record<string, unknown> } {
  const candidates = [
    path.join(root, ".bagakit", "feature-tracker", "features", featureId),
    path.join(root, ".bagakit", "feature-tracker", "features-archived", featureId),
    path.join(root, ".bagakit", "feature-tracker", "features-discarded", featureId),
  ];
  for (const candidate of candidates) {
    const statePath = path.join(candidate, "state.json");
    const tasksPath = path.join(candidate, "tasks.json");
    if (fs.existsSync(statePath) && fs.existsSync(tasksPath)) {
      return {
        statePath,
        state: assertRecord(readJsonFile(statePath), statePath),
        tasks: assertRecord(readJsonFile(tasksPath), tasksPath),
      };
    }
  }
  throw new Error(`missing feature-tracker state for ${featureId}`);
}

function sourceTaskSnapshot(tasks: Record<string, unknown>, currentTaskId: string): string {
  const rawTasks = Array.isArray(tasks.tasks) ? tasks.tasks : [];
  for (const task of rawTasks) {
    if (!task || typeof task !== "object") {
      continue;
    }
    const record = task as Record<string, unknown>;
    if (String(record.id ?? "") === currentTaskId) {
      return `${currentTaskId} ${String(record.title ?? "").trim()}`.trim();
    }
  }
  return "";
}

function mapFeatureSourceStatus(sourceState: Record<string, unknown>): ItemStatus {
  const workspaceMode = String(sourceState.workspace_mode ?? "").trim();
  const sourceStatus = String(sourceState.status ?? "").trim();
  if (workspaceMode === "proposal_only") {
    return "blocked";
  }
  if (sourceStatus === "blocked") {
    return "blocked";
  }
  if (sourceStatus === "in_progress") {
    return "in_progress";
  }
  if (sourceStatus === "done") {
    return "completed";
  }
  return "todo";
}

function effectiveTrackerItemStatus(current: ItemState, sourceStatus: ItemStatus): ItemStatus {
  if (sourceStatus === "completed" || sourceStatus === "cancelled") {
    return sourceStatus;
  }
  if (current.runtime.open_incident_ids.length > 0) {
    return "blocked";
  }
  return sourceStatus;
}

function stepStatusForItemStatus(itemStatus: ItemStatus, priorStatus: StepStatus): StepStatus {
  if (itemStatus === "blocked") {
    return "blocked";
  }
  if (itemStatus === "completed" || itemStatus === "cancelled") {
    return "done";
  }
  if (itemStatus === "in_progress") {
    return priorStatus === "done" || priorStatus === "blocked" || priorStatus === "pending" ? "active" : priorStatus;
  }
  return "pending";
}

function parseFeatureSourceRef(sourceRef: string): string | null {
  const prefix = "feature-tracker:";
  if (!sourceRef.startsWith(prefix)) {
    return null;
  }
  const featureId = sourceRef.slice(prefix.length).trim();
  return featureId || null;
}

function trackerMirrorSourceStatus(root: string, state: ItemState): ItemStatus {
  const featureId = parseFeatureSourceRef(state.source_ref);
  if (!featureId) {
    throw new Error(`invalid feature-tracker source_ref: ${state.source_ref}`);
  }
  return mapFeatureSourceStatus(loadFeatureSource(root, featureId).state);
}

function trackerItemId(featureId: string): string {
  return `feature-${featureId}`;
}

export function ingestFeatureTracker(root: string): { imported: number; updated: number; retired: number } {
  const paths = new FlowRunnerPaths(root);
  ensureRunnerExists(paths);
  const recipe = loadRecipe(paths);
  const features = featureTrackerIndex(root).features as Record<string, unknown>[];
  let imported = 0;
  let updated = 0;
  let retired = 0;

  for (const feature of features) {
    const featureId = String(feature.feat_id ?? feature.feature_id ?? "").trim();
    if (!featureId) {
      continue;
    }
    const source = loadFeatureSource(root, featureId);
    const itemId = trackerItemId(featureId);
    const sourceStatus = String(source.state.status ?? "").trim();
    const currentTaskId = String(source.state.current_task_id ?? "").trim();
    const currentTaskSnapshot = currentTaskId ? sourceTaskSnapshot(source.tasks, currentTaskId) : "";
    const titleBase = String(feature.title ?? featureId).trim();
    const title = currentTaskSnapshot ? `${titleBase} / ${currentTaskSnapshot}` : titleBase;
    const activeStatePath = paths.itemState(itemId);
    const archivedStatePath = paths.itemState(itemId, true);
    const activeExists = fs.existsSync(activeStatePath);
    const archivedExists = fs.existsSync(archivedStatePath);

    if (sourceStatus === "archived" || sourceStatus === "discarded") {
      if (activeExists && archivedExists) {
        throw new Error(`duplicate active and archived runner items detected: ${itemId}`);
      }
      if (activeExists) {
        const current = loadItemState(activeStatePath);
        closeOpenIncidents(
          paths,
          itemId,
          current.runtime.open_incident_ids,
          "closed automatically because feature-tracker retired the mirrored item",
        );
        const retiredState = syncCurrentStepRecord(syncResolutionFromStatus({
          ...current,
          status: sourceStatus === "archived" ? "completed" : "cancelled",
          archive_status: "archived",
          paths: itemPathsForLocation(paths, itemId, true),
          updated_at: utcNow(),
          runtime: {
            ...current.runtime,
            open_incident_ids: [],
          },
        }), "done");
        saveItemState(activeStatePath, retiredState);
        fs.mkdirSync(paths.archiveDir, { recursive: true });
        fs.renameSync(paths.itemDir(itemId), paths.itemDir(itemId, true));
        retired += 1;
      }
      continue;
    }

    if (archivedExists && !activeExists) {
      throw new Error(`archived runner item conflicts with active feature-tracker source: ${itemId}`);
    }
    if (archivedExists && activeExists) {
      throw new Error(`duplicate active and archived runner items detected: ${itemId}`);
    }

    const mappedStatus = mapFeatureSourceStatus(source.state);
    if (activeExists) {
      const current = loadItemState(activeStatePath);
      const effectiveStatus = effectiveTrackerItemStatus(current, mappedStatus);
      const clearOpenIncidents = mappedStatus === "completed" || mappedStatus === "cancelled";
      if (clearOpenIncidents) {
        closeOpenIncidents(
          paths,
          itemId,
          current.runtime.open_incident_ids,
          "closed automatically because feature-tracker closeout became authoritative",
        );
      }
      const refreshed = syncCurrentStepRecord(syncResolutionFromStatus({
        ...current,
        title,
        source_ref: `feature-tracker:${featureId}`,
        status: effectiveStatus,
        updated_at: utcNow(),
        runtime: {
          ...current.runtime,
          open_incident_ids: clearOpenIncidents ? [] : current.runtime.open_incident_ids,
        },
      }), stepStatusForItemStatus(effectiveStatus, current.current_step_status));
      saveItemState(activeStatePath, refreshed);
      updated += 1;
      continue;
    }

    ensureItemLayout(paths, itemId);
    const activePlanRevisionId = writeInitialPlanRevision(
      paths,
      itemId,
      "feature-tracker",
      `feature-tracker:${featureId}`,
      title,
      currentTaskSnapshot,
    );
    const state: ItemState = syncCurrentStepRecord(syncResolutionFromStatus({
      schema: ITEM_SCHEMA,
      item_id: itemId,
      title,
      source_kind: "feature-tracker",
      source_ref: `feature-tracker:${featureId}`,
      status: mappedStatus,
      archive_status: "active",
      resolution: "live",
      current_stage: recipe.stage_chain[0]!.stage_key,
      current_step_status: "pending",
      priority: 100,
      confidence: 0.7,
      created_at: utcNow(),
      updated_at: utcNow(),
      paths: initialItemPaths(paths, itemId),
      runtime: {
        active_plan_revision_id: activePlanRevisionId,
        active_action_id: "act-000",
        open_incident_ids: [],
        session_count: 0,
        latest_checkpoint_at: "",
        latest_snapshot_id: "",
        current_safe_anchor: null,
      },
      steps: defaultSteps(recipe),
    }), stepStatusForItemStatus(mappedStatus, "pending"));
    saveItemState(activeStatePath, state);
    writeText(
      paths.itemHandoff(itemId),
      `# Work Item Handoff: ${itemId}\n\n- source: feature-tracker:${featureId}\n- title: ${title}\n- workspace_mode: ${String(source.state.workspace_mode ?? "").trim()}\n`,
    );
    imported += 1;
  }

  return { imported, updated, retired };
}

export function activateFeatureTracker(root: string, featureId: string): FeatureActivationPayload {
  const paths = new FlowRunnerPaths(root);
  ensureRunnerExists(paths);
  const source = loadFeatureSource(root, featureId);
  const sourceStatus = String(source.state.status ?? "").trim();
  const workspaceMode = String(source.state.workspace_mode ?? "").trim();
  if (sourceStatus === "archived" || sourceStatus === "discarded") {
    throw new Error(`feature-tracker source is already closed: ${featureId}`);
  }
  if (workspaceMode === "proposal_only") {
    throw new Error(`feature-tracker source is proposal_only and not execution-ready: ${featureId}`);
  }
  if (sourceStatus === "blocked") {
    throw new Error(`feature-tracker source is blocked and not execution-ready: ${featureId}`);
  }

  ingestFeatureTracker(root);
  const itemId = trackerItemId(featureId);
  const nextPayload = computeNextAction(root, itemId);
  if (nextPayload.recommended_action !== "run_session") {
    throw new Error(
      `feature-tracker source did not activate into a runnable flow item: ${featureId}; ` +
      `got ${nextPayload.recommended_action}:${nextPayload.action_reason}`,
    );
  }
  if (!nextPayload.item_path) {
    throw new Error(`activated flow item is missing item_path: ${itemId}`);
  }
  return {
    schema: ACTIVATION_SCHEMA,
    command: "activate-feature-tracker",
    feature_id: featureId,
    item_id: itemId,
    item_path: nextPayload.item_path,
    source_state_path: toRepoRelative(root, source.statePath),
    workspace_mode: workspaceMode,
    source_status: sourceStatus,
    flow_next: nextPayload,
  };
}

function listItemStates(paths: FlowRunnerPaths, archived = false): ItemState[] {
  const baseDir = archived ? paths.archiveDir : paths.itemsDir;
  if (!fs.existsSync(baseDir)) {
    return [];
  }
  return fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => loadItemState(path.join(baseDir, entry.name, "state.json")))
    .sort((left, right) => left.item_id.localeCompare(right.item_id));
}

function statusRank(state: ItemState): [number, number, number, string] {
  const statusOrder = state.status === "in_progress" ? 0 : state.status === "todo" ? 1 : state.status === "blocked" ? 2 : 3;
  return [statusOrder, -state.priority, -state.confidence, state.item_id];
}

function selectNextState(paths: FlowRunnerPaths, explicitItemId?: string): ItemState | null {
  const liveItems = listItemStates(paths).filter((state) => state.archive_status === "active");
  if (explicitItemId) {
    const found = liveItems.find((state) => state.item_id === explicitItemId);
    if (!found) {
      throw new Error(`unknown item: ${explicitItemId}`);
    }
    return found;
  }
  const inProgress = liveItems.filter((state) => state.status === "in_progress");
  if (inProgress.length > 1) {
    throw new Error("multiple in-progress items detected; choose one explicitly");
  }
  if (inProgress.length === 1) {
    return inProgress[0]!;
  }
  const actionable = liveItems.filter((state) => state.status === "todo" || state.status === "blocked" || state.status === "completed" || state.status === "cancelled");
  if (actionable.length === 0) {
    return null;
  }
  actionable.sort((left, right) => {
    const a = statusRank(left);
    const b = statusRank(right);
    return a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3].localeCompare(b[3]);
  });
  return actionable[0]!;
}

function executionModeForState(state: ItemState): "normal_execution" | "blocked_clearance" | "closeout" {
  if (state.status === "blocked") {
    return "blocked_clearance";
  }
  if (state.status === "completed" || state.status === "cancelled") {
    return "closeout";
  }
  return "normal_execution";
}

function recommendedActionForState(state: ItemState): { action: RecommendedAction; reason: typeof ACTION_REASONS[number] } {
  if (state.source_kind === "feature-tracker" && state.current_step_status === "done" && (state.current_stage === "review" || state.current_stage === "closeout")) {
    return { action: "stop", reason: "closeout_pending" };
  }
  if (state.status === "blocked") {
    return { action: "clear_blocker", reason: "blocked_item" };
  }
  if (state.status === "completed" || state.status === "cancelled") {
    if (state.source_kind === "feature-tracker") {
      return { action: "stop", reason: "closeout_pending" };
    }
    return { action: "archive_closeout", reason: "closeout_pending" };
  }
  return { action: "run_session", reason: "active_work" };
}

function buildSessionContract(policy: RunnerPolicy, action: RecommendedAction): SessionContract {
  return {
    launch_bounded_session: action === "run_session",
    persist_state_before_stop: policy.safety.persist_state_before_stop,
    checkpoint_before_stop: policy.safety.checkpoint_before_stop,
    snapshot_before_session: action === "run_session" && policy.safety.snapshot_before_session,
    archive_only_closeout: action === "archive_closeout",
  };
}

export function computeNextAction(root: string, explicitItemId?: string): NextActionPayload {
  const paths = new FlowRunnerPaths(root);
  ensureRunnerExists(paths);
  const policy = loadPolicy(paths);
  const state = selectNextState(paths, explicitItemId);
  if (!state) {
    const payload: NextActionPayload = {
      schema: NEXT_SCHEMA,
      command: "next",
      recommended_action: "stop",
      action_reason: "no_actionable_item",
      session_contract: {
        launch_bounded_session: false,
        persist_state_before_stop: policy.safety.persist_state_before_stop,
        checkpoint_before_stop: policy.safety.checkpoint_before_stop,
        snapshot_before_session: false,
        archive_only_closeout: false,
      },
    };
    writeJsonFile(paths.nextActionFile, payload);
    return payload;
  }
  const { action, reason } = recommendedActionForState(state);
  const sessionStatus: SessionStatus =
    action === "run_session" ? "progress" : action === "clear_blocker" ? "blocked" : "terminal";
  const payload: NextActionPayload = {
    schema: NEXT_SCHEMA,
    command: "next",
    item_id: state.item_id,
    item_path: toRepoRelative(root, paths.itemState(state.item_id)),
    item_status: state.status,
    resolution: state.resolution,
    current_stage: state.current_stage,
    current_step_status: state.current_step_status,
    execution_mode: executionModeForState(state),
    active_plan_revision_id: state.runtime.active_plan_revision_id,
    active_action_id: state.runtime.active_action_id,
    session_number: state.runtime.session_count + 1,
    progress_log_path: state.paths.progress_log,
    current_safe_anchor: state.runtime.current_safe_anchor,
    recommended_action: action,
    action_reason: reason,
    session_contract: buildSessionContract(policy, action),
    checkpoint_request: {
      stage: state.current_stage,
      session_status: sessionStatus,
      command_example:
        `bash "$BAGAKIT_FLOW_RUNNER_SKILL_DIR/scripts/flow-runner.sh" checkpoint --root . --item ${state.item_id} ` +
        `--stage ${state.current_stage} --session-status ${sessionStatus} --objective "..." --attempted "..." ` +
        `--result "..." --next-action "..." --clean-state yes`,
    },
  };
  writeJsonFile(paths.nextActionFile, payload);
  return payload;
}

function resumeCandidateFromState(paths: FlowRunnerPaths, state: ItemState, archived = false): ResumeCandidate {
  return {
    item_id: state.item_id,
    item_path: toRepoRelative(paths.root, paths.itemState(state.item_id, archived)),
    title: state.title,
    source_kind: state.source_kind,
    source_ref: state.source_ref,
    item_status: state.status,
    resolution: state.resolution,
    current_stage: state.current_stage,
    current_step_status: state.current_step_status,
    active_plan_revision_id: state.runtime.active_plan_revision_id,
    active_action_id: state.runtime.active_action_id,
    session_number: state.runtime.session_count,
    progress_log_path: state.paths.progress_log,
    current_safe_anchor: state.runtime.current_safe_anchor,
    open_incident_ids: [...state.runtime.open_incident_ids],
  };
}

export function computeResumeCandidates(root: string): ResumeCandidatesPayload {
  const paths = new FlowRunnerPaths(root);
  ensureRunnerExists(paths);
  const live: ResumeCandidate[] = [];
  const closeout: ResumeCandidate[] = [];
  for (const state of listItemStates(paths)) {
    const candidate = resumeCandidateFromState(paths, state);
    if (state.status === "completed" || state.status === "cancelled") {
      closeout.push(candidate);
    } else {
      live.push(candidate);
    }
  }
  const payload: ResumeCandidatesPayload = {
    schema: RESUME_SCHEMA,
    command: "resume-candidates",
    live,
    closeout,
  };
  writeJsonFile(paths.resumeCandidatesFile, payload);
  return payload;
}

export function listItemSummaries(root: string): ResumeCandidate[] {
  const paths = new FlowRunnerPaths(root);
  ensureRunnerExists(paths);
  return listItemStates(paths).map((state) => resumeCandidateFromState(paths, state));
}

export function captureSnapshot(root: string, itemId: string, label: string): SnapshotMetadata {
  ensureGitRepo(root);
  const paths = new FlowRunnerPaths(root);
  ensureRunnerExists(paths);
  const state = loadItemState(paths.itemState(itemId));
  const safeLabel = sanitizeSnapshotLabel(label);
  const snapshotId = uniqueTimestampedId(paths.backupsDir, "", `${itemId}-${safeLabel}`);
  const snapshotDir = path.join(paths.backupsDir, snapshotId);
  fs.mkdirSync(snapshotDir, { recursive: false });

  const branch = runGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
  const head = runGit(root, ["rev-parse", "HEAD"]).trim();
  writeText(path.join(snapshotDir, "branch.txt"), `${branch}\n`);
  writeText(path.join(snapshotDir, "head.txt"), `${head}\n`);
  writeText(path.join(snapshotDir, "status.txt"), runGit(root, ["status", "--short"]));
  writeText(path.join(snapshotDir, "diff.patch"), runGit(root, ["diff"]));
  writeText(path.join(snapshotDir, "staged.patch"), runGit(root, ["diff", "--staged"]));

  const untracked = runGit(root, ["ls-files", "--others", "--exclude-standard"])
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (untracked.length > 0) {
    const tarPath = path.join(snapshotDir, "untracked.tar");
    const result = spawnSync("tar", ["-cf", tarPath, ...untracked], { cwd: root, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || "tar failed").trim());
    }
  }

  const metadata: SnapshotMetadata = {
    schema: SNAPSHOT_SCHEMA,
    snapshot_id: snapshotId,
    item_id: itemId,
    created_at: utcNow(),
    label: safeLabel,
    branch,
    head,
    has_untracked_archive: untracked.length > 0,
  };
  writeJsonFile(path.join(snapshotDir, "metadata.json"), metadata);

  const updated = {
    ...state,
    runtime: {
      ...state.runtime,
      latest_snapshot_id: snapshotId,
      current_safe_anchor: {
        kind: "git_snapshot",
        ref: toRepoRelative(root, snapshotDir),
        summary: safeLabel,
      },
    },
    updated_at: utcNow(),
  } satisfies ItemState;
  saveItemState(paths.itemState(itemId), updated);
  return metadata;
}

export function appendCheckpoint(
  root: string,
  itemId: string,
  stage: string,
  sessionStatus: SessionStatus,
  objective: string,
  attempted: string,
  result: string,
  nextAction: string,
  cleanState: CleanState,
  itemStatusOverride?: ItemStatus,
): CheckpointPayload {
  const paths = new FlowRunnerPaths(root);
  ensureRunnerExists(paths);
  const state = loadItemState(paths.itemState(itemId));
  const validStages = itemStageKeys(state);
  if (!validStages.has(stage)) {
    throw new Error(`invalid checkpoint stage ${JSON.stringify(stage)}; expected one of ${[...validStages].sort().join(", ")}`);
  }
  if (state.source_kind === "feature-tracker" && itemStatusOverride !== undefined) {
    throw new Error("tracker-sourced items do not accept --item-status overrides; refresh lifecycle from feature-tracker instead");
  }
  if (itemStatusOverride) {
    const allowedBySession: Record<SessionStatus, ItemStatus[]> = {
      progress: ["in_progress"],
      blocked: ["blocked"],
      gate_passed: ["completed", "cancelled"],
      terminal: ["completed", "cancelled"],
    };
    if (!allowedBySession[sessionStatus].includes(itemStatusOverride)) {
      throw new Error(`item-status ${JSON.stringify(itemStatusOverride)} is not allowed for session-status ${JSON.stringify(sessionStatus)}`);
    }
  }
  const sessionNumber = state.runtime.session_count + 1;
  const receipt: CheckpointReceipt = {
    stage,
    session_status: sessionStatus,
    objective,
    attempted,
    result,
    next_action: nextAction,
    clean_state: cleanState,
    recorded_at: utcNow(),
    session_number: sessionNumber,
  };
  const progressEntry: ProgressEntry = {
    schema: PROGRESS_SCHEMA,
    item_id: itemId,
    session_number: sessionNumber,
    stage,
    session_status: sessionStatus,
    objective,
    attempted,
    result,
    next_action: nextAction,
    clean_state: cleanState,
    recorded_at: receipt.recorded_at,
  };
  let nextStatus: ItemStatus;
  if (itemStatusOverride) {
    nextStatus = itemStatusOverride;
  } else if (state.source_kind === "feature-tracker") {
    const sourceStatus = trackerMirrorSourceStatus(root, state);
    if (sessionStatus === "blocked") {
      nextStatus = "blocked";
    } else {
      if (sessionStatus === "progress" && sourceStatus === "blocked") {
        throw new Error("cannot record a progress checkpoint for a tracker-sourced item whose source status is blocked");
      }
      nextStatus = sourceStatus;
    }
  } else if (sessionStatus === "progress") {
    nextStatus = "in_progress";
  } else if (sessionStatus === "blocked") {
    nextStatus = "blocked";
  } else {
    nextStatus = "completed";
  }
  const nextStepStatus: StepStatus =
    sessionStatus === "progress" ? "active" : sessionStatus === "blocked" ? "blocked" : "done";
  const updated = syncCurrentStepRecord(syncResolutionFromStatus({
    ...state,
    status: nextStatus,
    updated_at: utcNow(),
    runtime: {
      ...state.runtime,
      active_action_id: `act-${String(sessionNumber).padStart(3, "0")}`,
      session_count: sessionNumber,
      latest_checkpoint_at: receipt.recorded_at,
    },
  }), nextStepStatus, stage);
  appendNdjson(paths.itemCheckpoints(itemId), {
    schema: CHECKPOINT_SCHEMA,
    command: "checkpoint",
    item_id: itemId,
    ...receipt,
  });
  appendNdjson(paths.itemProgressLog(itemId), progressEntry);
  saveItemState(paths.itemState(itemId), updated);

  const payload: CheckpointPayload = {
    schema: CHECKPOINT_SCHEMA,
    command: "checkpoint",
    item_id: itemId,
    item_path: toRepoRelative(root, paths.itemState(itemId)),
    progress_log_path: updated.paths.progress_log,
    resolution: updated.resolution,
    item_status: updated.status,
    current_stage: updated.current_stage,
    current_step_status: updated.current_step_status,
    checkpoint_receipt: receipt,
    current_safe_anchor: updated.runtime.current_safe_anchor,
  };
  return payload;
}

export function openIncident(root: string, itemId: string, family: string, summary: string, recommendedResume: IncidentResume): string {
  const paths = new FlowRunnerPaths(root);
  ensureRunnerExists(paths);
  const state = loadItemState(paths.itemState(itemId));
  const incidentId = uniqueTimestampedId(paths.itemIncidentsDir(itemId), "inc-", itemId, ".json");
  const incident: IncidentRecord = {
    schema: INCIDENT_SCHEMA,
    incident_id: incidentId,
    family,
    summary,
    status: "open",
    opened_at: utcNow(),
    closed_at: "",
    close_note: "",
    recommended_resume: recommendedResume,
  };
  writeJsonFile(paths.itemIncident(itemId, incidentId), incident);
  const updated = syncCurrentStepRecord(syncResolutionFromStatus({
    ...state,
    status: "blocked",
    updated_at: utcNow(),
    runtime: {
      ...state.runtime,
      open_incident_ids: Array.from(new Set([...state.runtime.open_incident_ids, incidentId])),
    },
  }), "blocked");
  saveItemState(paths.itemState(itemId), updated);
  return incidentId;
}

export function resolveIncident(root: string, itemId: string, incidentId: string, closeNote: string): string {
  const paths = new FlowRunnerPaths(root);
  ensureRunnerExists(paths);
  const state = loadItemState(paths.itemState(itemId));
  const incidentPath = paths.itemIncident(itemId, incidentId);
  const incident = readJsonFile<IncidentRecord>(incidentPath);
  if (incident.schema !== INCIDENT_SCHEMA || incident.status !== "open") {
    throw new Error(`incident is not open: ${incidentId}`);
  }
  const remainingOpenIds = state.runtime.open_incident_ids.filter((current) => current !== incidentId);
  const blockingSourceStatus =
    state.source_kind === "feature-tracker" ? trackerMirrorSourceStatus(root, state) : null;
  if (incident.recommended_resume === "stay_blocked" && remainingOpenIds.length === 0 && blockingSourceStatus !== "blocked") {
    throw new Error("cannot resolve the last open incident with recommended_resume=stay_blocked unless another blocking source remains");
  }
  const resolved: IncidentRecord = {
    ...incident,
    status: "closed",
    closed_at: utcNow(),
    close_note: closeNote,
  };
  writeJsonFile(incidentPath, resolved);
  const openIds = remainingOpenIds;
  let nextStatus: ItemStatus = state.status;
  if (openIds.length === 0 && state.status === "blocked") {
    if (resolved.recommended_resume === "stay_blocked") {
      nextStatus = "blocked";
    } else if (state.source_kind === "feature-tracker") {
      nextStatus = trackerMirrorSourceStatus(root, state);
    } else {
      nextStatus = resolved.recommended_resume === "closeout" ? "completed" : "todo";
    }
  }
  const nextStepStatus: StepStatus =
    nextStatus === "blocked" ? "blocked" : nextStatus === "completed" || nextStatus === "cancelled" ? "done" : "pending";
  const updated = syncCurrentStepRecord(syncResolutionFromStatus({
    ...state,
    status: nextStatus,
    updated_at: utcNow(),
    runtime: {
      ...state.runtime,
      open_incident_ids: openIds,
    },
  }), nextStepStatus);
  saveItemState(paths.itemState(itemId), updated);
  return incidentId;
}

export function archiveItem(root: string, itemId: string): void {
  const paths = new FlowRunnerPaths(root);
  ensureRunnerExists(paths);
  const activeStatePath = paths.itemState(itemId);
  if (!fs.existsSync(activeStatePath)) {
    throw new Error(`item not found: ${itemId}`);
  }
  const state = loadItemState(activeStatePath);
  if (state.status !== "completed" && state.status !== "cancelled") {
    throw new Error("only completed or cancelled items may be archived");
  }
  if (state.source_kind === "feature-tracker") {
    throw new Error("feature-tracker sourced items must be closed by feature-tracker, not archived by flow-runner");
  }
  if (!itemStageKeys(state).has(state.current_stage)) {
    throw new Error("current_stage must match one declared step before archive");
  }
  if (state.current_step_status !== "done") {
    throw new Error("only items with a completed current step may be archived");
  }
  if (state.runtime.open_incident_ids.length > 0) {
    throw new Error("items with open incidents may not be archived");
  }
  const archivedDir = paths.itemDir(itemId, true);
  if (fs.existsSync(archivedDir)) {
    throw new Error(`archived item already exists: ${itemId}`);
  }
  const archivedState = syncResolutionFromStatus({
    ...state,
    archive_status: "archived",
    paths: itemPathsForLocation(paths, itemId, true),
    updated_at: utcNow(),
  });
  saveItemState(activeStatePath, archivedState);
  fs.mkdirSync(paths.archiveDir, { recursive: true });
  fs.renameSync(paths.itemDir(itemId), archivedDir);
}

function validateNextActionFile(root: string, paths: FlowRunnerPaths, issues: string[]): void {
  try {
    if (!fs.existsSync(paths.nextActionFile)) {
      issues.push(`missing next-action file: ${paths.nextActionFile}`);
      return;
    }
    const payload = readJsonFile<unknown>(paths.nextActionFile);
    const record = assertRecord(payload, paths.nextActionFile);
    if (record.schema !== NEXT_SCHEMA) {
      issues.push(`invalid next-action schema: ${paths.nextActionFile}`);
    }
    if (record.command !== "next") {
      issues.push(`invalid next-action command: ${paths.nextActionFile}`);
    }
    if (record.item_id !== undefined) {
      const itemId = assertString(record.item_id, `${paths.nextActionFile}.item_id`);
      if (!fs.existsSync(paths.itemState(itemId)) && !fs.existsSync(paths.itemState(itemId, true))) {
        issues.push(`next-action item_id does not exist in runtime trees: ${paths.nextActionFile}`);
      }
    }
  } catch (error) {
    issues.push(String(error));
  }
}

function validateResumeCandidatesFile(paths: FlowRunnerPaths, issues: string[]): void {
  try {
    if (!fs.existsSync(paths.resumeCandidatesFile)) {
      issues.push(`missing resume-candidates file: ${paths.resumeCandidatesFile}`);
      return;
    }
    const payload = readJsonFile<unknown>(paths.resumeCandidatesFile);
    const record = assertRecord(payload, paths.resumeCandidatesFile);
    if (record.schema !== RESUME_SCHEMA) {
      issues.push(`invalid resume-candidates schema: ${paths.resumeCandidatesFile}`);
    }
    if (record.command !== "resume-candidates") {
      issues.push(`invalid resume-candidates command: ${paths.resumeCandidatesFile}`);
    }
    if (!Array.isArray(record.live) || !Array.isArray(record.closeout)) {
      issues.push(`invalid resume-candidates lists: ${paths.resumeCandidatesFile}`);
    }
  } catch (error) {
    issues.push(String(error));
  }
}

function validateCheckpointEntries(filePath: string, itemId: string, issues: string[]): number {
  try {
    let count = 0;
    for (const [index, entry] of readNdjson<unknown>(filePath).entries()) {
      count = index + 1;
      const record = assertRecord(entry, `${filePath} line ${index + 1}`);
      if (record.schema !== CHECKPOINT_SCHEMA) {
        issues.push(`invalid checkpoint schema in ${filePath} at line ${index + 1}`);
      }
      if (record.command !== "checkpoint") {
        issues.push(`invalid checkpoint command in ${filePath} at line ${index + 1}`);
      }
      if (String(record.session_number ?? "") !== String(index + 1)) {
        issues.push(`checkpoint session_number drift in ${filePath} at line ${index + 1}`);
      }
      if (String(record.stage ?? "").trim() === "") {
        issues.push(`checkpoint stage missing in ${filePath} at line ${index + 1}`);
      }
      if (!(SESSION_STATUSES as readonly string[]).includes(String(record.session_status ?? ""))) {
        issues.push(`invalid checkpoint session_status in ${filePath} at line ${index + 1}`);
      }
      if (!(CLEAN_STATES as readonly string[]).includes(String(record.clean_state ?? ""))) {
        issues.push(`invalid checkpoint clean_state in ${filePath} at line ${index + 1}`);
      }
      if (String(record.item_id ?? "") !== itemId) {
        issues.push(`checkpoint item_id drift in ${filePath} at line ${index + 1}`);
      }
    }
    return count;
  } catch (error) {
    issues.push(String(error));
    return -1;
  }
}

function validateProgressEntries(filePath: string, itemId: string, issues: string[]): number {
  try {
    let count = 0;
    for (const [index, entry] of readNdjson<unknown>(filePath).entries()) {
      count = index + 1;
      const record = assertRecord(entry, `${filePath} line ${index + 1}`);
      if (record.schema !== PROGRESS_SCHEMA) {
        issues.push(`invalid progress schema in ${filePath} at line ${index + 1}`);
      }
      if (String(record.session_number ?? "") !== String(index + 1)) {
        issues.push(`progress session_number drift in ${filePath} at line ${index + 1}`);
      }
      if (String(record.stage ?? "").trim() === "") {
        issues.push(`progress stage missing in ${filePath} at line ${index + 1}`);
      }
      if (!(SESSION_STATUSES as readonly string[]).includes(String(record.session_status ?? ""))) {
        issues.push(`invalid progress session_status in ${filePath} at line ${index + 1}`);
      }
      if (!(CLEAN_STATES as readonly string[]).includes(String(record.clean_state ?? ""))) {
        issues.push(`invalid progress clean_state in ${filePath} at line ${index + 1}`);
      }
      if (String(record.item_id ?? "") !== itemId) {
        issues.push(`progress item_id drift in ${filePath} at line ${index + 1}`);
      }
    }
    return count;
  } catch (error) {
    issues.push(String(error));
    return -1;
  }
}

function validatePlanRevisionDir(dirPath: string, activeRevisionId: string, issues: string[]): void {
  try {
    if (!fs.existsSync(dirPath)) {
      issues.push(`missing plan-revisions dir: ${dirPath}`);
      return;
    }
    const entries = fs.readdirSync(dirPath, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json"));
    if (entries.length === 0) {
      issues.push(`plan-revisions dir is empty: ${dirPath}`);
    }
    for (const entry of entries) {
      const filePath = path.join(dirPath, entry.name);
      const record = assertRecord(readJsonFile<unknown>(filePath), filePath);
      if (record.schema !== PLAN_REVISION_SCHEMA) {
        issues.push(`invalid plan revision schema: ${filePath}`);
      }
      const revisionId = String(record.revision_id ?? "").trim();
      if (revisionId !== entry.name.replace(/\.json$/, "")) {
        issues.push(`plan revision id drift in ${filePath}`);
      }
    }
    if (!fs.existsSync(path.join(dirPath, `${activeRevisionId}.json`))) {
      issues.push(`missing active plan revision ${activeRevisionId} in ${dirPath}`);
    }
  } catch (error) {
    issues.push(String(error));
  }
}

function validateIncidentDir(dirPath: string, openIds: string[], issues: string[]): void {
  try {
    if (!fs.existsSync(dirPath)) {
      issues.push(`missing incidents dir: ${dirPath}`);
      return;
    }
    const seenIds = new Set<string>();
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }
      const filePath = path.join(dirPath, entry.name);
      const record = assertRecord(readJsonFile<unknown>(filePath), filePath);
      if (record.schema !== INCIDENT_SCHEMA) {
        issues.push(`invalid incident schema: ${filePath}`);
      }
      const incidentId = String(record.incident_id ?? "").trim();
      if (!incidentId) {
        issues.push(`missing incident id in ${filePath}`);
        continue;
      }
      if (incidentId !== entry.name.replace(/\.json$/, "")) {
        issues.push(`incident id drift in ${filePath}`);
      }
      if (seenIds.has(incidentId)) {
        issues.push(`duplicate incident id in ${dirPath}: ${incidentId}`);
      }
      seenIds.add(incidentId);
      const status = String(record.status ?? "").trim();
      if (!(INCIDENT_STATUSES as readonly string[]).includes(status)) {
        issues.push(`invalid incident status in ${filePath}`);
      }
      if (!(INCIDENT_RESUMES as readonly string[]).includes(String(record.recommended_resume ?? ""))) {
        issues.push(`invalid incident recommended_resume in ${filePath}`);
      }
      if (openIds.includes(incidentId) && status !== "open") {
        issues.push(`incident must remain open while referenced from runtime: ${filePath}`);
      }
      if (!openIds.includes(incidentId) && status === "open") {
        issues.push(`open incident file must remain referenced from runtime: ${filePath}`);
      }
    }
    if (new Set(openIds).size !== openIds.length) {
      issues.push(`runtime open_incident_ids contains duplicates: ${dirPath}`);
    }
    for (const openId of openIds) {
      if (!seenIds.has(openId)) {
        issues.push(`missing incident file referenced from runtime: ${path.join(dirPath, `${openId}.json`)}`);
      }
    }
  } catch (error) {
    issues.push(String(error));
  }
}

function validateSnapshotDir(snapshotDir: string, issues: string[]): void {
  try {
    const metadataPath = path.join(snapshotDir, "metadata.json");
    if (!fs.existsSync(metadataPath)) {
      issues.push(`missing snapshot metadata: ${metadataPath}`);
      return;
    }
    const record = assertRecord(readJsonFile<unknown>(metadataPath), metadataPath);
    if (record.schema !== SNAPSHOT_SCHEMA) {
      issues.push(`invalid snapshot schema: ${metadataPath}`);
    }
  } catch (error) {
    issues.push(String(error));
  }
}

export function validateFlowRunner(root: string): string[] {
  const paths = new FlowRunnerPaths(root);
  ensureRunnerExists(paths);
  const issues: string[] = [];
  try {
    loadPolicy(paths);
  } catch (error) {
    issues.push(String(error));
  }
  try {
    loadRecipe(paths);
  } catch (error) {
    issues.push(String(error));
  }
  validateNextActionFile(root, paths, issues);
  validateResumeCandidatesFile(paths, issues);

  const seenItemIds = new Set<string>();
  let activeInProgress = 0;
  for (const archived of [false, true]) {
    const baseDir = archived ? paths.archiveDir : paths.itemsDir;
    if (!fs.existsSync(baseDir)) {
      continue;
    }
    for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        issues.push(`unexpected non-directory under flow-runner runtime: ${path.join(baseDir, entry.name)}`);
        continue;
      }
      const statePath = path.join(baseDir, entry.name, "state.json");
      let state: ItemState;
      try {
        state = loadItemState(statePath);
      } catch (error) {
        issues.push(String(error));
        continue;
      }
      if (seenItemIds.has(state.item_id)) {
        issues.push(`duplicate flow-runner item_id across active and archive trees: ${state.item_id}`);
      }
      seenItemIds.add(state.item_id);
      if (state.archive_status !== (archived ? "archived" : "active")) {
        issues.push(`archive_status does not match physical location: ${statePath}`);
      }
      const currentStep = state.steps.find((step) => step.stage_key === state.current_stage);
      if (!currentStep) {
        issues.push(`current_stage does not exist in steps for ${statePath}`);
      } else if (currentStep.status !== state.current_step_status) {
        issues.push(`current_step_status drift from steps[] in ${statePath}`);
      }
      const expectedResolution: ResolutionKind =
        state.status === "completed" || state.status === "cancelled" ? "closeout" : "live";
      if (state.resolution !== expectedResolution) {
        issues.push(`resolution must match item status in ${statePath}`);
      }
      if (archived && state.runtime.open_incident_ids.length > 0) {
        issues.push(`archived item must not keep open incidents: ${statePath}`);
      }
      if (!archived && state.status === "in_progress") {
        activeInProgress += 1;
      }
      if (state.paths.handoff !== toRepoRelative(root, paths.itemHandoff(state.item_id, archived))) {
        issues.push(`handoff path drift in ${statePath}`);
      }
      if (state.paths.checkpoints !== toRepoRelative(root, paths.itemCheckpoints(state.item_id, archived))) {
        issues.push(`checkpoint path drift in ${statePath}`);
      }
      if (state.paths.progress_log !== toRepoRelative(root, paths.itemProgressLog(state.item_id, archived))) {
        issues.push(`progress path drift in ${statePath}`);
      }
      if (!fs.existsSync(paths.itemHandoff(state.item_id, archived))) {
        issues.push(`missing handoff file: ${paths.itemHandoff(state.item_id, archived)}`);
      }
      if (!fs.existsSync(paths.itemCheckpoints(state.item_id, archived))) {
        issues.push(`missing checkpoints file: ${paths.itemCheckpoints(state.item_id, archived)}`);
      } else {
        const checkpointCount = validateCheckpointEntries(paths.itemCheckpoints(state.item_id, archived), state.item_id, issues);
        if (checkpointCount >= 0 && checkpointCount !== state.runtime.session_count) {
          issues.push(`session_count drift from checkpoints.ndjson in ${statePath}`);
        }
      }
      if (!fs.existsSync(paths.itemProgressLog(state.item_id, archived))) {
        issues.push(`missing progress log: ${paths.itemProgressLog(state.item_id, archived)}`);
      } else {
        const progressCount = validateProgressEntries(paths.itemProgressLog(state.item_id, archived), state.item_id, issues);
        if (progressCount >= 0 && progressCount !== state.runtime.session_count) {
          issues.push(`session_count drift from progress.ndjson in ${statePath}`);
        }
      }
      validatePlanRevisionDir(paths.itemPlanRevisionsDir(state.item_id, archived), state.runtime.active_plan_revision_id, issues);
      validateIncidentDir(paths.itemIncidentsDir(state.item_id, archived), state.runtime.open_incident_ids, issues);
      if (state.runtime.open_incident_ids.length > 0 && !archived && state.status !== "blocked") {
        issues.push(`active item with open incidents must remain blocked: ${statePath}`);
      }
      if (!archived && state.status === "blocked" && state.runtime.open_incident_ids.length === 0) {
        if (state.source_kind === "feature-tracker") {
          try {
            if (trackerMirrorSourceStatus(root, state) !== "blocked") {
              issues.push(`blocked tracker mirror must keep an open incident or a blocked upstream source: ${statePath}`);
            }
          } catch (error) {
            issues.push(String(error));
          }
        } else {
          issues.push(`blocked item must keep an open incident or an upstream blocking source: ${statePath}`);
        }
      }
      if (state.runtime.latest_snapshot_id) {
        const snapshotDir = path.join(paths.backupsDir, state.runtime.latest_snapshot_id);
        if (!fs.existsSync(snapshotDir)) {
          issues.push(`missing snapshot dir for latest_snapshot_id in ${statePath}`);
        } else {
          validateSnapshotDir(snapshotDir, issues);
        }
      }
      if (state.source_kind === "feature-tracker") {
        const featureId = parseFeatureSourceRef(state.source_ref);
        if (!featureId) {
          issues.push(`invalid feature-tracker source_ref in ${statePath}`);
        } else {
          try {
            const source = loadFeatureSource(root, featureId);
            const sourceStatus = String(source.state.status ?? "").trim();
            const workspaceMode = String(source.state.workspace_mode ?? "").trim();
            if ((sourceStatus === "archived" || sourceStatus === "discarded") && state.archive_status !== "archived") {
              issues.push(`feature-tracker source is closed but runner item remains active: ${statePath}`);
            }
            if (workspaceMode === "proposal_only" && state.status === "in_progress") {
              issues.push(`proposal_only feature must not appear as in_progress in flow-runner: ${statePath}`);
            }
            if (sourceStatus === "done" && state.status !== "completed" && state.status !== "cancelled") {
              issues.push(`done feature must map to completed or cancelled runner state: ${statePath}`);
            }
            if (sourceStatus !== "archived" && sourceStatus !== "discarded" && state.archive_status === "archived") {
              issues.push(`active feature-tracker source must not map to archived runner item: ${statePath}`);
            }
          } catch (error) {
            issues.push(String(error));
          }
        }
      }
    }
  }
  if (activeInProgress > 1) {
    issues.push("multiple in-progress active items detected");
  }
  return issues;
}
