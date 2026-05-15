import fs from "node:fs";
import path from "node:path";

import { readSkillDescriptorAtRelativeDir } from "./skill_catalog.ts";
import {
  ACTIVATION_MODES,
  CANDIDATE_RESULT_STATUSES,
  COMPOSITION_ROLES,
  EPISODE_DISPOSITIONS,
  EVALUATION_OVERALL,
  EVOLVER_SCOPE_HINTS,
  EVOLVER_SIGNAL_KINDS,
  EVOLVER_SIGNAL_STATUSES,
  EVOLVER_SIGNAL_TRIGGERS,
  FALLBACK_STRATEGIES,
  FEEDBACK_CHANNELS,
  FEEDBACK_SIGNALS,
  LESSON_UPDATE_ACTIONS,
  PLAN_CONFIDENCE,
  PLAN_KINDS,
  PLAN_AVAILABILITY,
  PLANNING_ENTRY_RECIPE_IDS,
  PLANNING_ENTRY_ROUTE_PARTICIPANTS,
  PLAN_STATUSES,
  PREFLIGHT_ANSWERS,
  RECIPE_STATUSES,
  SEARCH_SOURCE_SCOPES,
  SEARCH_STATUSES,
  TASK_STATUSES,
  TASK_SIGNAL_KINDS,
  USAGE_PHASES,
  USAGE_RESULTS,
  normalizePreflightDecisionToken,
  type ActivationMode,
  type BenchmarkLogEntry,
  type CompositionRole,
  type EvolverSignalContract,
  type EvolverSignalContractRecord,
  type EvolverSignalLogEntry,
  type EvolverSignalKind,
  type EvolverSignalStatus,
  type EvolverSignalTrigger,
  type EvolverScopeHint,
  type ErrorPatternLogEntry,
  type EpisodeDisposition,
  type EvaluationOverall,
  type FeedbackChannel,
  type FeedbackLogEntry,
  type FeedbackSignal,
  type PlanConfidence,
  type PlanKind,
  type PlanAvailability,
  type PlanningEntryRecipeId,
  type PlanStatus,
  type PreflightAnswer,
  type PreflightDecision,
  type RecipeLogEntry,
  type RecipeStatus,
  type SearchLogEntry,
  type SearchSourceScope,
  type SearchStatus,
  type BagakitDriverDirective,
  type BagakitDriverPayload,
  type CandidateResultLogEntry,
  type CandidateResultStatus,
  type SkillPlanEntry,
  type SkillUsageDoc,
  type LessonUpdateAction,
  type LessonUpdateLogEntry,
  type TaskStatus,
  type TaskSignalKind,
  type TaskSignalLogEntry,
  type SelectionLessonLogEntry,
  type UsageLogEntry,
  type UsagePhase,
  type UsageResult,
} from "./model.ts";
import { isRecord, parseTomlFile } from "./toml.ts";

function nowIso(): string {
  return new Date().toISOString();
}

function laterIso(left: string, right: string): string {
  return left >= right ? left : right;
}

function toStableToken(raw: string): string {
  let collapsed = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  while (collapsed.startsWith("-")) {
    collapsed = collapsed.slice(1);
  }
  while (collapsed.endsWith("-")) {
    collapsed = collapsed.slice(0, -1);
  }
  return collapsed;
}

function requireStableToken(raw: string, label: string): string {
  const value = raw.trim();
  if (value === "") {
    throw new Error(`${label} must not be empty`);
  }
  if (toStableToken(value) !== value) {
    throw new Error(`${label} must already be a stable token (lowercase letters, digits, hyphens): ${raw}`);
  }
  return value;
}

function assertEnumValue<const T extends readonly string[]>(values: T, raw: string, label: string): T[number] {
  if (values.includes(raw)) {
    return raw as T[number];
  }
  throw new Error(`invalid ${label}: ${raw}`);
}

function readString(record: Record<string, unknown>, key: string, fallback = ""): string {
  const value = record[key];
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  throw new Error(`expected string-compatible value for ${key}`);
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = readString(record, key, "");
  return value.trim() === "" ? undefined : value;
}

function readBoolean(record: Record<string, unknown>, key: string, fallback = false): boolean {
  const value = record[key];
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  throw new Error(`expected boolean value for ${key}`);
}

function readNumber(record: Record<string, unknown>, key: string, fallback = 0): number {
  const value = record[key];
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  throw new Error(`expected numeric value for ${key}`);
}

function readOptionalNumber(record: Record<string, unknown>, key: string): number | undefined {
  if (record[key] === undefined) {
    return undefined;
  }
  return readNumber(record, key);
}

function readRecord(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  if (value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    throw new Error(`expected table value for ${key}`);
  }
  return value;
}

function readRecordArray(record: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = record[key];
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`expected array table for ${key}`);
  }
  return value.map((entry) => {
    if (!isRecord(entry)) {
      throw new Error(`invalid entry in ${key}`);
    }
    return entry;
  });
}

function formatTomlValue(value: string | number | boolean): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return Number.isInteger(value) ? String(value) : String(value);
}

function pushKeyValue(lines: string[], key: string, value: string | number | boolean): void {
  lines.push(`${key} = ${formatTomlValue(value)}`);
}

function renderArrayTable<T extends Record<string, string | number | boolean>>(
  lines: string[],
  tableName: string,
  entries: T[],
  fieldOrder: string[],
): void {
  for (const entry of entries) {
    lines.push("");
    lines.push(`[[${tableName}]]`);
    for (const field of fieldOrder) {
      const value = entry[field];
      if (value === undefined) {
        continue;
      }
      pushKeyValue(lines, field, value);
    }
  }
}

function joinNotes(...parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join("; ");
}

const PLANNING_ENTRY_ARTIFACT_PREFIXES = [
  ".bagakit/brainstorm/",
  ".bagakit/feature-tracker/",
  ".bagakit/flow-runner/",
] as const;
const GENERIC_PLANNING_FILES = new Set(["task_plan.md", "findings.md", "progress.md"]);
const PLANNING_ENTRY_USAGE_EVIDENCE_PREFIX: Record<string, readonly string[]> = {
  "bagakit-brainstorm": [".bagakit/brainstorm/"],
  "bagakit-feature-tracker": [".bagakit/feature-tracker/"],
  "bagakit-flow-runner": [".bagakit/flow-runner/"],
  "bagakit-skill-selector": [".bagakit/skill-selector/"],
};

function canonicalPlanningEntryRecipeSource(recipeId: PlanningEntryRecipeId): string {
  return `skills/harness/bagakit-skill-selector/recipes/${recipeId}.md`;
}

function isPlanningEntryRecipeId(recipeId: string): recipeId is PlanningEntryRecipeId {
  return (PLANNING_ENTRY_RECIPE_IDS as readonly string[]).includes(recipeId);
}

function requireSelectedPlanForUsage(doc: SkillUsageDoc, skillId: string): void {
  const matching = doc.skill_plan.filter((entry) => entry.skill_id === skillId);
  if (matching.length === 0) {
    throw new Error(`usage_log.skill_id must refer to a planned skill: ${skillId}`);
  }
  if (!matching.some((entry) => entry.selected)) {
    throw new Error(`usage_log.skill_id must refer to a selected skill: ${skillId}`);
  }
}

function normalizeClusterText(value: string): string {
  return value.trim();
}

function resolveRepoRelativePath(root: string, relativePath: string, label: string): string {
  const absolute = path.resolve(root, relativePath);
  const relative = path.relative(root, absolute);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return absolute;
  }
  throw new Error(`${label} escapes the allowed root: ${relativePath}`);
}

function resolvePathInside(baseDir: string, relativePath: string, label: string): string {
  const absolute = path.resolve(baseDir, relativePath);
  const relative = path.relative(baseDir, absolute);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return absolute;
  }
  throw new Error(`${label} escapes the owning skill directory: ${relativePath}`);
}

function parseSkillPlanEntry(record: Record<string, unknown>): SkillPlanEntry {
  return {
    timestamp: readString(record, "timestamp"),
    skill_id: readString(record, "skill_id"),
    kind: assertEnumValue(PLAN_KINDS, readString(record, "kind"), "skill_plan.kind"),
    source: readString(record, "source"),
    why: readString(record, "why"),
    expected_impact: readString(record, "expected_impact"),
    confidence: assertEnumValue(PLAN_CONFIDENCE, readString(record, "confidence", "medium"), "skill_plan.confidence"),
    availability: assertEnumValue(
      PLAN_AVAILABILITY,
      readString(record, "availability", "unknown"),
      "skill_plan.availability",
    ),
    availability_detail: readString(record, "availability_detail"),
    selected: readBoolean(record, "selected", true),
    status: assertEnumValue(PLAN_STATUSES, readString(record, "status", "planned"), "skill_plan.status"),
    composition_role: assertEnumValue(
      COMPOSITION_ROLES,
      readString(record, "composition_role", "standalone"),
      "skill_plan.composition_role",
    ),
    composition_id: readString(record, "composition_id"),
    activation_mode: assertEnumValue(
      ACTIVATION_MODES,
      readString(record, "activation_mode", "standalone"),
      "skill_plan.activation_mode",
    ),
    fallback_strategy: assertEnumValue(
      FALLBACK_STRATEGIES,
      readString(record, "fallback_strategy", "none"),
      "skill_plan.fallback_strategy",
    ),
    rejection_reason: readString(record, "rejection_reason"),
    expected_failure_mode: readString(record, "expected_failure_mode"),
    evidence_needed: readString(record, "evidence_needed"),
    notes: readString(record, "notes"),
  };
}

function parseUsageLogEntry(record: Record<string, unknown>): UsageLogEntry {
  const action = readString(record, "action");
  return {
    timestamp: readString(record, "timestamp"),
    skill_id: readString(record, "skill_id"),
    phase: assertEnumValue(USAGE_PHASES, readString(record, "phase"), "usage_log.phase"),
    action,
    result: assertEnumValue(USAGE_RESULTS, readString(record, "result"), "usage_log.result"),
    evidence: readString(record, "evidence"),
    metric_hint: readString(record, "metric_hint"),
    attempt_key: readString(record, "attempt_key", action),
    attempt_index: readNumber(record, "attempt_index", 1),
    backoff_required: readBoolean(record, "backoff_required", false),
    notes: readString(record, "notes"),
  };
}

function parseFeedbackLogEntry(record: Record<string, unknown>): FeedbackLogEntry {
  return {
    timestamp: readString(record, "timestamp"),
    skill_id: readString(record, "skill_id"),
    channel: assertEnumValue(FEEDBACK_CHANNELS, readString(record, "channel"), "feedback_log.channel"),
    signal: assertEnumValue(FEEDBACK_SIGNALS, readString(record, "signal"), "feedback_log.signal"),
    detail: readString(record, "detail"),
    impact_scope: readString(record, "impact_scope"),
    confidence: assertEnumValue(
      PLAN_CONFIDENCE,
      readString(record, "confidence", "medium"),
      "feedback_log.confidence",
    ),
  };
}

function parseSearchLogEntry(record: Record<string, unknown>): SearchLogEntry {
  return {
    timestamp: readString(record, "timestamp"),
    reason: readString(record, "reason"),
    query: readString(record, "query"),
    source_scope: assertEnumValue(
      SEARCH_SOURCE_SCOPES,
      readString(record, "source_scope", "hybrid"),
      "search_log.source_scope",
    ),
    status: assertEnumValue(SEARCH_STATUSES, readString(record, "status", "open"), "search_log.status"),
    notes: readString(record, "notes"),
  };
}

function parseBenchmarkLogEntry(record: Record<string, unknown>): BenchmarkLogEntry {
  return {
    timestamp: readString(record, "timestamp"),
    benchmark_id: readString(record, "benchmark_id"),
    metric: readString(record, "metric"),
    baseline: readNumber(record, "baseline"),
    candidate: readNumber(record, "candidate"),
    delta: readNumber(record, "delta"),
    higher_is_better: readBoolean(record, "higher_is_better", true),
    passed: readBoolean(record, "passed", true),
    notes: readString(record, "notes"),
  };
}

function parseErrorPatternLogEntry(record: Record<string, unknown>): ErrorPatternLogEntry {
  return {
    timestamp: readString(record, "timestamp"),
    error_type: readString(record, "error_type"),
    message_pattern: readString(record, "message_pattern"),
    skill_id: readString(record, "skill_id"),
    occurrence_index: readNumber(record, "occurrence_index", 1),
    resolution: readString(record, "resolution"),
    notes: readString(record, "notes"),
  };
}

function parseRecipeLogEntry(record: Record<string, unknown>): RecipeLogEntry {
  return {
    timestamp: readString(record, "timestamp"),
    recipe_id: readString(record, "recipe_id"),
    source: readString(record, "source"),
    why: readString(record, "why"),
    status: assertEnumValue(RECIPE_STATUSES, readString(record, "status", "selected"), "recipe_log.status"),
    synthesis_artifact: readOptionalString(record, "synthesis_artifact"),
    notes: readString(record, "notes"),
  };
}

function parseEvolverSignalLogEntry(record: Record<string, unknown>): EvolverSignalLogEntry {
  const timestamp = readString(record, "timestamp");
  return {
    timestamp,
    updated_at: readOptionalString(record, "updated_at") ?? timestamp,
    signal_id: readString(record, "signal_id"),
    kind: assertEnumValue(EVOLVER_SIGNAL_KINDS, readString(record, "kind"), "evolver_signal_log.kind"),
    trigger: assertEnumValue(EVOLVER_SIGNAL_TRIGGERS, readString(record, "trigger"), "evolver_signal_log.trigger"),
    skill_id: readString(record, "skill_id"),
    scope_hint: assertEnumValue(
      EVOLVER_SCOPE_HINTS,
      readString(record, "scope_hint", "unset"),
      "evolver_signal_log.scope_hint",
    ),
    title: readString(record, "title"),
    summary: readString(record, "summary"),
    confidence: readNumber(record, "confidence", 0.5),
    status: assertEnumValue(
      EVOLVER_SIGNAL_STATUSES,
      readString(record, "status", "suggested"),
      "evolver_signal_log.status",
    ),
    topic_hint: readOptionalString(record, "topic_hint"),
    attempt_key: readOptionalString(record, "attempt_key"),
    error_type: readOptionalString(record, "error_type"),
    occurrence_index: readNumber(record, "occurrence_index", 1),
    evidence_ref: readOptionalString(record, "evidence_ref"),
    notes: readString(record, "notes"),
  };
}

function parseTaskSignalLogEntry(record: Record<string, unknown>): TaskSignalLogEntry {
  return {
    timestamp: readString(record, "timestamp"),
    signal_id: readString(record, "signal_id"),
    kind: assertEnumValue(TASK_SIGNAL_KINDS, readString(record, "kind"), "task_signal_log.kind"),
    summary: readString(record, "summary"),
    task_cluster: readString(record, "task_cluster"),
    evidence_ref: readString(record, "evidence_ref"),
    confidence: assertEnumValue(PLAN_CONFIDENCE, readString(record, "confidence", "medium"), "task_signal_log.confidence"),
    notes: readString(record, "notes"),
  };
}

function parseCandidateResultLogEntry(record: Record<string, unknown>): CandidateResultLogEntry {
  return {
    timestamp: readString(record, "timestamp"),
    result_id: readString(record, "result_id"),
    candidate_id: readString(record, "candidate_id"),
    task_signal_id: readString(record, "task_signal_id"),
    action_ref: readString(record, "action_ref"),
    result_status: assertEnumValue(
      CANDIDATE_RESULT_STATUSES,
      readString(record, "result_status"),
      "candidate_result_log.result_status",
    ),
    verification_ref: readString(record, "verification_ref"),
    feedback_ref: readString(record, "feedback_ref"),
    score: readOptionalNumber(record, "score"),
    cost_hint: readString(record, "cost_hint"),
    latency_hint: readString(record, "latency_hint"),
    notes: readString(record, "notes"),
  };
}

function parseSelectionLessonLogEntry(record: Record<string, unknown>): SelectionLessonLogEntry {
  return {
    timestamp: readString(record, "timestamp"),
    lesson_id: readString(record, "lesson_id"),
    task_signal_kind: assertEnumValue(
      TASK_SIGNAL_KINDS,
      readString(record, "task_signal_kind"),
      "selection_lesson_log.task_signal_kind",
    ),
    task_cluster: readString(record, "task_cluster"),
    candidate_id: readString(record, "candidate_id"),
    recommendation: readString(record, "recommendation"),
    confidence: assertEnumValue(
      PLAN_CONFIDENCE,
      readString(record, "confidence", "medium"),
      "selection_lesson_log.confidence",
    ),
    support_ref: readString(record, "support_ref"),
    limitation: readString(record, "limitation"),
    invalidates_ref: readString(record, "invalidates_ref"),
    notes: readString(record, "notes"),
  };
}

function parseLessonUpdateLogEntry(record: Record<string, unknown>): LessonUpdateLogEntry {
  return {
    timestamp: readString(record, "timestamp"),
    lesson_id: readString(record, "lesson_id"),
    action: assertEnumValue(LESSON_UPDATE_ACTIONS, readString(record, "action"), "lesson_update_log.action"),
    target_ref: readString(record, "target_ref"),
    reason: readString(record, "reason"),
    evidence_ref: readString(record, "evidence_ref"),
    notes: readString(record, "notes"),
  };
}

export function createSkillUsageDoc(taskId: string, objective: string, owner: string): SkillUsageDoc {
  const timestamp = nowIso();
  return {
    schema_version: "1.0",
    task_id: requireStableToken(taskId, "task_id"),
    objective,
    owner,
    created_at: timestamp,
    updated_at: timestamp,
    status: "planning",
    preflight: {
      question: "Do we have enough skill coverage for this task?",
      answer: "pending",
      gap_summary: "",
      decision: "pending",
    },
    evaluation: {
      quality_score: 0,
      evidence_score: 0,
      feedback_score: 0,
      overall: "pending",
      summary: "",
    },
    next_actions: {
      needs_feedback_confirmation: false,
      needs_new_search: false,
      next_search_query: "",
      notes: "",
    },
    attempt_policy: {
      retry_backoff_threshold: 3,
    },
    evolver_handoff_policy: {
      enabled: true,
    },
    episode_refs: {
      source_prompt_ref: "",
      final_artifact_ref: "",
      verification_ref: "",
    },
    skill_plan: [],
    usage_log: [],
    feedback_log: [],
    search_log: [],
    benchmark_log: [],
    error_pattern_log: [],
    recipe_log: [],
    task_signal_log: [],
    candidate_result_log: [],
    selection_lesson_log: [],
    lesson_update_log: [],
    evolver_signal_log: [],
  };
}

export function readSkillUsageDoc(filePath: string): SkillUsageDoc {
  const raw = parseTomlFile(filePath);
  if (!isRecord(raw)) {
    throw new Error(`invalid skill usage file: ${filePath}`);
  }

  const episodeDispositionRecord = readRecord(raw, "episode_disposition");
  const episodeDispositionValue = readOptionalString(episodeDispositionRecord, "value");

  return {
    schema_version: readString(raw, "schema_version", "1.0"),
    task_id: requireStableToken(readString(raw, "task_id"), "task_id"),
    objective: readString(raw, "objective"),
    owner: readString(raw, "owner"),
    created_at: readString(raw, "created_at"),
    updated_at: readString(raw, "updated_at"),
    status: assertEnumValue(TASK_STATUSES, readString(raw, "status", "planning"), "status"),
    preflight: {
      question: readString(readRecord(raw, "preflight"), "question", "Do we have enough skill coverage for this task?"),
      answer: assertEnumValue(
        PREFLIGHT_ANSWERS,
        readString(readRecord(raw, "preflight"), "answer", "pending"),
        "preflight.answer",
      ),
      gap_summary: readString(readRecord(raw, "preflight"), "gap_summary"),
      decision: normalizePreflightDecisionToken(readString(readRecord(raw, "preflight"), "decision", "pending")),
    },
    evaluation: {
      quality_score: readNumber(readRecord(raw, "evaluation"), "quality_score", 0),
      evidence_score: readNumber(readRecord(raw, "evaluation"), "evidence_score", 0),
      feedback_score: readNumber(readRecord(raw, "evaluation"), "feedback_score", 0),
      overall: assertEnumValue(
        EVALUATION_OVERALL,
        readString(readRecord(raw, "evaluation"), "overall", "pending"),
        "evaluation.overall",
      ),
      summary: readString(readRecord(raw, "evaluation"), "summary"),
    },
    next_actions: {
      needs_feedback_confirmation: readBoolean(readRecord(raw, "next_actions"), "needs_feedback_confirmation", false),
      needs_new_search: readBoolean(readRecord(raw, "next_actions"), "needs_new_search", false),
      next_search_query: readString(readRecord(raw, "next_actions"), "next_search_query"),
      notes: readString(readRecord(raw, "next_actions"), "notes"),
    },
    attempt_policy: {
      retry_backoff_threshold: readNumber(readRecord(raw, "attempt_policy"), "retry_backoff_threshold", 3),
    },
    evolver_handoff_policy: {
      enabled: readBoolean(readRecord(raw, "evolver_handoff_policy"), "enabled", true),
    },
    episode_refs: {
      source_prompt_ref: readString(readRecord(raw, "episode_refs"), "source_prompt_ref"),
      final_artifact_ref: readString(readRecord(raw, "episode_refs"), "final_artifact_ref"),
      verification_ref: readString(readRecord(raw, "episode_refs"), "verification_ref"),
    },
    episode_disposition: episodeDispositionValue
      ? {
          value: assertEnumValue(
            EPISODE_DISPOSITIONS,
            episodeDispositionValue,
            "episode_disposition.value",
          ),
          closed_at: readString(episodeDispositionRecord, "closed_at"),
          reason: readString(episodeDispositionRecord, "reason"),
        }
      : undefined,
    skill_plan: readRecordArray(raw, "skill_plan").map(parseSkillPlanEntry),
    usage_log: readRecordArray(raw, "usage_log").map(parseUsageLogEntry),
    feedback_log: readRecordArray(raw, "feedback_log").map(parseFeedbackLogEntry),
    search_log: readRecordArray(raw, "search_log").map(parseSearchLogEntry),
    benchmark_log: readRecordArray(raw, "benchmark_log").map(parseBenchmarkLogEntry),
    error_pattern_log: readRecordArray(raw, "error_pattern_log").map(parseErrorPatternLogEntry),
    recipe_log: readRecordArray(raw, "recipe_log").map(parseRecipeLogEntry),
    task_signal_log: readRecordArray(raw, "task_signal_log").map(parseTaskSignalLogEntry),
    candidate_result_log: readRecordArray(raw, "candidate_result_log").map(parseCandidateResultLogEntry),
    selection_lesson_log: readRecordArray(raw, "selection_lesson_log").map(parseSelectionLessonLogEntry),
    lesson_update_log: readRecordArray(raw, "lesson_update_log").map(parseLessonUpdateLogEntry),
    evolver_signal_log: readRecordArray(raw, "evolver_signal_log").map(parseEvolverSignalLogEntry),
  };
}

export function writeSkillUsageDoc(filePath: string, doc: SkillUsageDoc): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, renderSkillUsageDoc(doc), "utf-8");
}

export function renderSkillUsageDoc(doc: SkillUsageDoc): string {
  const lines: string[] = [];
  pushKeyValue(lines, "schema_version", doc.schema_version);
  pushKeyValue(lines, "task_id", doc.task_id);
  pushKeyValue(lines, "objective", doc.objective);
  pushKeyValue(lines, "owner", doc.owner);
  pushKeyValue(lines, "created_at", doc.created_at);
  pushKeyValue(lines, "updated_at", doc.updated_at);
  pushKeyValue(lines, "status", doc.status);
  lines.push("");
  lines.push("[preflight]");
  pushKeyValue(lines, "question", doc.preflight.question);
  pushKeyValue(lines, "answer", doc.preflight.answer);
  pushKeyValue(lines, "gap_summary", doc.preflight.gap_summary);
  pushKeyValue(lines, "decision", doc.preflight.decision);
  lines.push("");
  lines.push("[evaluation]");
  pushKeyValue(lines, "quality_score", doc.evaluation.quality_score);
  pushKeyValue(lines, "evidence_score", doc.evaluation.evidence_score);
  pushKeyValue(lines, "feedback_score", doc.evaluation.feedback_score);
  pushKeyValue(lines, "overall", doc.evaluation.overall);
  pushKeyValue(lines, "summary", doc.evaluation.summary);
  lines.push("");
  lines.push("[next_actions]");
  pushKeyValue(lines, "needs_feedback_confirmation", doc.next_actions.needs_feedback_confirmation);
  pushKeyValue(lines, "needs_new_search", doc.next_actions.needs_new_search);
  pushKeyValue(lines, "next_search_query", doc.next_actions.next_search_query);
  pushKeyValue(lines, "notes", doc.next_actions.notes);
  lines.push("");
  lines.push("[attempt_policy]");
  pushKeyValue(lines, "retry_backoff_threshold", doc.attempt_policy.retry_backoff_threshold);
  lines.push("");
  lines.push("[evolver_handoff_policy]");
  pushKeyValue(lines, "enabled", doc.evolver_handoff_policy.enabled);
  lines.push("");
  lines.push("[episode_refs]");
  pushKeyValue(lines, "source_prompt_ref", doc.episode_refs.source_prompt_ref);
  pushKeyValue(lines, "final_artifact_ref", doc.episode_refs.final_artifact_ref);
  pushKeyValue(lines, "verification_ref", doc.episode_refs.verification_ref);
  if (doc.episode_disposition) {
    lines.push("");
    lines.push("[episode_disposition]");
    pushKeyValue(lines, "value", doc.episode_disposition.value);
    pushKeyValue(lines, "closed_at", doc.episode_disposition.closed_at);
    pushKeyValue(lines, "reason", doc.episode_disposition.reason);
  }
  lines.push("");
  lines.push(
    "# Append records below with [[recipe_log]], [[task_signal_log]], [[selection_lesson_log]], [[lesson_update_log]], [[evolver_signal_log]], [[skill_plan]], [[candidate_result_log]], [[usage_log]], [[feedback_log]], [[search_log]], [[benchmark_log]], and [[error_pattern_log]].",
  );

  renderArrayTable(lines, "recipe_log", doc.recipe_log, [
    "timestamp",
    "recipe_id",
    "source",
    "why",
    "status",
    "synthesis_artifact",
    "notes",
  ]);
  renderArrayTable(lines, "task_signal_log", doc.task_signal_log, [
    "timestamp",
    "signal_id",
    "kind",
    "summary",
    "task_cluster",
    "evidence_ref",
    "confidence",
    "notes",
  ]);
  renderArrayTable(lines, "selection_lesson_log", doc.selection_lesson_log, [
    "timestamp",
    "lesson_id",
    "task_signal_kind",
    "task_cluster",
    "candidate_id",
    "recommendation",
    "confidence",
    "support_ref",
    "limitation",
    "invalidates_ref",
    "notes",
  ]);
  renderArrayTable(lines, "lesson_update_log", doc.lesson_update_log, [
    "timestamp",
    "lesson_id",
    "action",
    "target_ref",
    "reason",
    "evidence_ref",
    "notes",
  ]);
  renderArrayTable(lines, "evolver_signal_log", doc.evolver_signal_log, [
    "timestamp",
    "updated_at",
    "signal_id",
    "kind",
    "trigger",
    "skill_id",
    "scope_hint",
    "title",
    "summary",
    "confidence",
    "status",
    "topic_hint",
    "attempt_key",
    "error_type",
    "occurrence_index",
    "evidence_ref",
    "notes",
  ]);
  renderArrayTable(lines, "skill_plan", doc.skill_plan, [
    "timestamp",
    "skill_id",
    "kind",
    "source",
    "why",
    "expected_impact",
    "confidence",
    "availability",
    "availability_detail",
    "selected",
    "status",
    "composition_role",
    "composition_id",
    "activation_mode",
    "fallback_strategy",
    "rejection_reason",
    "expected_failure_mode",
    "evidence_needed",
    "notes",
  ]);
  renderArrayTable(lines, "candidate_result_log", doc.candidate_result_log, [
    "timestamp",
    "result_id",
    "candidate_id",
    "task_signal_id",
    "action_ref",
    "result_status",
    "verification_ref",
    "feedback_ref",
    "score",
    "cost_hint",
    "latency_hint",
    "notes",
  ]);
  renderArrayTable(lines, "usage_log", doc.usage_log, [
    "timestamp",
    "skill_id",
    "phase",
    "action",
    "result",
    "evidence",
    "metric_hint",
    "attempt_key",
    "attempt_index",
    "backoff_required",
    "notes",
  ]);
  renderArrayTable(lines, "feedback_log", doc.feedback_log, [
    "timestamp",
    "skill_id",
    "channel",
    "signal",
    "detail",
    "impact_scope",
    "confidence",
  ]);
  renderArrayTable(lines, "search_log", doc.search_log, [
    "timestamp",
    "reason",
    "query",
    "source_scope",
    "status",
    "notes",
  ]);
  renderArrayTable(lines, "benchmark_log", doc.benchmark_log, [
    "timestamp",
    "benchmark_id",
    "metric",
    "baseline",
    "candidate",
    "delta",
    "higher_is_better",
    "passed",
    "notes",
  ]);
  renderArrayTable(lines, "error_pattern_log", doc.error_pattern_log, [
    "timestamp",
    "error_type",
    "message_pattern",
    "skill_id",
    "occurrence_index",
    "resolution",
    "notes",
  ]);

  return `${lines.join("\n")}\n`;
}

function findEvolverSignal(doc: SkillUsageDoc, signalId: string): EvolverSignalLogEntry | undefined {
  return doc.evolver_signal_log.find((entry) => entry.signal_id === signalId);
}

function ensureNoBridgeSignalCollision(doc: SkillUsageDoc, signalId: string): void {
  const normalized = bridgeSignalId(doc.task_id, signalId);
  const collided = doc.evolver_signal_log.find(
    (entry) => entry.signal_id !== signalId && bridgeSignalId(doc.task_id, entry.signal_id) === normalized,
  );
  if (collided) {
    throw new Error(
      `evolver_signal_log.signal_id collides after bridge normalization (${signalId} -> ${normalized}; existing=${collided.signal_id})`,
    );
  }
}

function upsertEvolverSignal(
  doc: SkillUsageDoc,
  entry: EvolverSignalLogEntry,
  options?: { preserveDismissed?: boolean },
): boolean {
  ensureNoBridgeSignalCollision(doc, entry.signal_id);
  const existing = findEvolverSignal(doc, entry.signal_id);
  if (!existing) {
    doc.evolver_signal_log.push(entry);
    doc.updated_at = nowIso();
    return true;
  }
  if (options?.preserveDismissed && existing.status === "dismissed") {
    return false;
  }
  existing.updated_at = laterIso(existing.updated_at, entry.updated_at);
  existing.kind = entry.kind;
  existing.trigger = entry.trigger;
  existing.skill_id = entry.skill_id;
  existing.scope_hint = entry.scope_hint;
  existing.title = entry.title;
  existing.summary = entry.summary;
  existing.confidence = entry.confidence;
  existing.status = entry.status;
  existing.topic_hint = entry.topic_hint;
  existing.attempt_key = entry.attempt_key;
  existing.error_type = entry.error_type;
  existing.occurrence_index = entry.occurrence_index;
  existing.evidence_ref = entry.evidence_ref;
  existing.notes = entry.notes;
  doc.updated_at = nowIso();
  return true;
}

function requireUniqueSignalId(doc: SkillUsageDoc, signalId: string): void {
  if (signalId.trim() === "") {
    throw new Error("task_signal_log.signal_id must not be empty");
  }
  if (doc.task_signal_log.some((entry) => entry.signal_id === signalId)) {
    throw new Error(`task_signal_log.signal_id already exists: ${signalId}`);
  }
}

function requireUniqueCandidateResultId(doc: SkillUsageDoc, resultId: string): void {
  if (resultId.trim() === "") {
    throw new Error("candidate_result_log.result_id must not be empty");
  }
  if (doc.candidate_result_log.some((entry) => entry.result_id === resultId)) {
    throw new Error(`candidate_result_log.result_id already exists: ${resultId}`);
  }
}

function requireUniqueSelectionLessonId(doc: SkillUsageDoc, lessonId: string): void {
  if (lessonId.trim() === "") {
    throw new Error("selection_lesson_log.lesson_id must not be empty");
  }
  if (doc.selection_lesson_log.some((entry) => entry.lesson_id === lessonId)) {
    throw new Error(`selection_lesson_log.lesson_id already exists: ${lessonId}`);
  }
}

function autoBackoffSignalId(skillId: string, attemptKey: string): string {
  return `retry-${toStableToken(skillId)}-${toStableToken(attemptKey)}`;
}

function autoErrorPatternSignalId(skillId: string, errorType: string, messagePattern: string): string {
  return `pattern-${toStableToken(skillId)}-${toStableToken(errorType)}-${toStableToken(messagePattern)}`;
}

function bridgeSignalId(taskId: string, signalId: string): string {
  return toStableToken(`${taskId}--${signalId}`);
}

function suggestEvolverSignalFromBackoff(
  doc: SkillUsageDoc,
  input: { skill_id: string; attempt_key: string; occurrence_index: number },
): boolean {
  if (!doc.evolver_handoff_policy.enabled) {
    return false;
  }
  const observedAt = nowIso();
  return upsertEvolverSignal(
    doc,
    {
      timestamp: observedAt,
      signal_id: autoBackoffSignalId(input.skill_id, input.attempt_key),
      updated_at: observedAt,
      kind: "gotcha",
      trigger: "retry_backoff",
      skill_id: input.skill_id,
      scope_hint: "unset",
      title: `Repeated task-local issue: ${input.attempt_key}`,
      summary: `${input.skill_id} reached selector retry backoff on ${input.attempt_key} and now deserves repository-level review`,
      confidence: 0.6,
      status: "suggested",
      topic_hint: toStableToken(input.attempt_key) || undefined,
      attempt_key: input.attempt_key,
      error_type: undefined,
      occurrence_index: input.occurrence_index,
      evidence_ref: undefined,
      notes: "auto-suggested from selector retry backoff",
    },
    { preserveDismissed: true },
  );
}

function suggestEvolverSignalFromErrorPattern(
  doc: SkillUsageDoc,
  input: { skill_id: string; error_type: string; message_pattern: string; occurrence_index: number },
): boolean {
  if (!doc.evolver_handoff_policy.enabled || input.occurrence_index < 2) {
    return false;
  }
  const observedAt = nowIso();
  return upsertEvolverSignal(
    doc,
    {
      timestamp: observedAt,
      signal_id: autoErrorPatternSignalId(input.skill_id, input.error_type, input.message_pattern),
      updated_at: observedAt,
      kind: "gotcha",
      trigger: "error_pattern",
      skill_id: input.skill_id,
      scope_hint: "unset",
      title: `Repeated pattern review: ${input.error_type}`,
      summary: `${input.skill_id} repeated the same ${input.error_type} pattern often enough to deserve repository-level review`,
      confidence: 0.58,
      status: "suggested",
      topic_hint: toStableToken(input.error_type) || undefined,
      attempt_key: undefined,
      error_type: input.error_type,
      occurrence_index: input.occurrence_index,
      evidence_ref: undefined,
      notes: "auto-suggested from selector error-pattern clustering",
    },
    { preserveDismissed: true },
  );
}

function resolveSelectorRepoRoot(filePath: string): string {
  return path.resolve(path.dirname(filePath), "../../../../");
}

function normalizeRepoRelativeRef(rawPath: string, root: string): string {
  const absolute = path.resolve(root, rawPath);
  return path.relative(root, absolute).split(path.sep).join("/");
}

function findDerivedRankingRef(filePath: string): string | undefined {
  const repoRoot = resolveSelectorRepoRoot(filePath);
  const absolute = path.join(path.dirname(filePath), "skill-ranking.md");
  if (!fs.existsSync(absolute)) {
    return undefined;
  }
  return normalizeRepoRelativeRef(absolute, repoRoot);
}

export function buildEvolverSignalContract(
  doc: SkillUsageDoc,
  filePath: string,
  options?: { statuses?: EvolverSignalStatus[] | "all" },
): EvolverSignalContract {
  const statuses = options?.statuses ?? ["suggested"];
  const repoRoot = resolveSelectorRepoRoot(filePath);
  const taskFileRef = normalizeRepoRelativeRef(filePath, repoRoot);
  const rankingRef = findDerivedRankingRef(filePath);
  const signals = doc.evolver_signal_log.filter((entry) => {
    return statuses === "all" || statuses.includes(entry.status);
  });
  return {
    schema: "bagakit.evolver.signal.v1",
    producer: "bagakit-skill-selector",
    generated_at: nowIso(),
    signals: signals.map<EvolverSignalContractRecord>((entry) => {
      const localRefs = [taskFileRef];
      if (entry.evidence_ref) {
        localRefs.push(normalizeRepoRelativeRef(entry.evidence_ref, repoRoot));
      }
      if (rankingRef) {
        localRefs.push(rankingRef);
      }
      return {
        version: 1,
        id: bridgeSignalId(doc.task_id, entry.signal_id),
        kind: entry.kind,
        title: entry.title,
        summary: entry.summary,
        producer: "bagakit-skill-selector",
        source_channel: "selector",
        topic_hint: entry.topic_hint,
        confidence: entry.confidence,
        evidence: [
          `trigger=${entry.trigger}`,
          `skill_id=${entry.skill_id}`,
          `scope_hint=${entry.scope_hint}`,
          `occurrence_index=${entry.occurrence_index}`,
          ...(entry.attempt_key ? [`attempt_key=${entry.attempt_key}`] : []),
          ...(entry.error_type ? [`error_type=${entry.error_type}`] : []),
          ...(entry.notes.trim() ? [entry.notes] : []),
        ],
        local_refs: [...new Set(localRefs)],
        status: "pending",
        created_at: entry.timestamp,
        updated_at: entry.updated_at,
      };
    }),
  };
}

export interface SelectorEvalCaseScaffold {
  episode: Record<string, unknown>;
  expected: Record<string, unknown>;
}

export function selectorEvalCaseScaffoldFromDoc(
  doc: SkillUsageDoc,
  filePath: string,
  options: { label: "silver" | "gold"; reviewNeeded: boolean },
): SelectorEvalCaseScaffold {
  const repoRoot = resolveSelectorRepoRoot(filePath);
  const episodeRef = normalizeRepoRelativeRef(filePath, repoRoot);
  return {
    episode: {
      schema: "bagakit.selector.eval.episode.v1",
      task_id: doc.task_id,
      objective: doc.objective,
      episode_ref: episodeRef,
      source_prompt_ref: doc.episode_refs.source_prompt_ref,
      final_artifact_ref: doc.episode_refs.final_artifact_ref,
      verification_ref: doc.episode_refs.verification_ref,
      preflight: doc.preflight,
      task_signals: doc.task_signal_log.map((entry) => ({
        signal_id: entry.signal_id,
        kind: entry.kind,
        task_cluster: entry.task_cluster,
        evidence_ref: entry.evidence_ref,
      })),
      candidates: doc.skill_plan.map((entry) => ({
        candidate_id: entry.skill_id,
        kind: entry.kind,
        source: entry.source,
        selected: entry.selected,
        availability: entry.availability,
        rejection_reason: entry.rejection_reason,
        expected_failure_mode: entry.expected_failure_mode,
        evidence_needed: entry.evidence_needed,
      })),
      composition_patterns: doc.recipe_log.map((entry) => ({
        recipe_id: entry.recipe_id,
        status: entry.status,
        synthesis_artifact: entry.synthesis_artifact ?? "",
      })),
      candidate_results: doc.candidate_result_log.map((entry) => ({
        result_id: entry.result_id,
        candidate_id: entry.candidate_id,
        task_signal_id: entry.task_signal_id,
        result_status: entry.result_status,
        verification_ref: entry.verification_ref,
        score: entry.score ?? null,
      })),
      lesson_updates: doc.lesson_update_log.map((entry) => ({
        lesson_id: entry.lesson_id,
        action: entry.action,
        evidence_ref: entry.evidence_ref,
      })),
      evolver_signals: doc.evolver_signal_log.map((entry) => ({
        signal_id: entry.signal_id,
        trigger: entry.trigger,
        status: entry.status,
        confidence: entry.confidence,
      })),
    },
    expected: {
      schema: "bagakit.selector.eval.expected.v1",
      label: options.label,
      review_needed: options.reviewNeeded,
      expected_task_signals: doc.task_signal_log.map((entry) => entry.signal_id),
      expected_candidates: doc.skill_plan.map((entry) => entry.skill_id),
      expected_selected_candidates: doc.skill_plan.filter((entry) => entry.selected).map((entry) => entry.skill_id),
      expected_route: doc.preflight.decision,
      expected_candidate_results: doc.candidate_result_log.map((entry) => entry.result_id),
      expected_lesson_updates: doc.lesson_update_log.map((entry) => `${entry.lesson_id}:${entry.action}`),
      expected_evolver_signals: doc.evolver_signal_log.map((entry) => entry.signal_id),
      maintainer_notes: options.reviewNeeded
        ? "Silver scaffold generated from selector episode. Review against original task context before promoting to gold."
        : "",
    },
  };
}

export function renderSelectorEvalCaseScaffold(scaffold: SelectorEvalCaseScaffold): string {
  const episode = scaffold.episode;
  const expected = scaffold.expected;
  return [
    "# Selector Eval Case Scaffold",
    "",
    `Task: ${String(episode.task_id ?? "")}`,
    `Label: ${String(expected.label ?? "")}`,
    `Review Needed: ${String(expected.review_needed ?? "")}`,
    "",
    "Files:",
    "",
    "- `episode.json` captures what the selector episode recorded.",
    "- `expected.json` starts as a silver label and should be reviewed before gold promotion.",
    "",
    "Review checklist:",
    "",
    "- confirm the expected task signals are ideal, not merely copied from the log",
    "- confirm rejected candidates and missing candidates are represented",
    "- confirm candidate results have reviewable evidence",
    "- confirm lesson updates and evolver signals are warranted",
    "",
  ].join("\n");
}

export function updateEvolverSignalStatuses(
  doc: SkillUsageDoc,
  signalIds: string[],
  status: EvolverSignalStatus,
): void {
  const wanted = new Set(signalIds);
  for (const signal of doc.evolver_signal_log) {
    if (wanted.has(signal.signal_id)) {
      signal.status = status;
      signal.updated_at = nowIso();
    }
  }
  doc.updated_at = nowIso();
}

export function updatePreflight(
  doc: SkillUsageDoc,
  input: {
    answer: PreflightAnswer;
    gap_summary: string;
    decision: PreflightDecision;
    status: TaskStatus;
  },
): void {
  doc.preflight.answer = input.answer;
  doc.preflight.gap_summary = input.gap_summary;
  doc.preflight.decision = input.decision;
  doc.status = input.status;
  doc.updated_at = nowIso();
}

export function updateEpisodeRefs(
  doc: SkillUsageDoc,
  input: {
    source_prompt_ref?: string;
    final_artifact_ref?: string;
    verification_ref?: string;
  },
): void {
  if (input.source_prompt_ref !== undefined) {
    doc.episode_refs.source_prompt_ref = input.source_prompt_ref;
  }
  if (input.final_artifact_ref !== undefined) {
    doc.episode_refs.final_artifact_ref = input.final_artifact_ref;
  }
  if (input.verification_ref !== undefined) {
    doc.episode_refs.verification_ref = input.verification_ref;
  }
  doc.updated_at = nowIso();
}

export function appendRecipeLog(
  doc: SkillUsageDoc,
  input: {
    recipe_id: string;
    source: string;
    why: string;
    status: RecipeStatus;
    synthesis_artifact?: string;
    notes: string;
  },
): void {
  doc.recipe_log.push({
    timestamp: nowIso(),
    recipe_id: input.recipe_id,
    source: input.source,
    why: input.why,
    status: input.status,
    synthesis_artifact: input.synthesis_artifact,
    notes: input.notes,
  });
  doc.updated_at = nowIso();
}

export function appendEvolverSignal(
  doc: SkillUsageDoc,
  input: {
    signal_id: string;
    kind: EvolverSignalKind;
    trigger: EvolverSignalTrigger;
    skill_id: string;
    scope_hint: EvolverScopeHint;
    title: string;
    summary: string;
    confidence: number;
    status: EvolverSignalStatus;
    topic_hint?: string;
    attempt_key?: string;
    error_type?: string;
    occurrence_index: number;
    evidence_ref?: string;
    notes: string;
  },
): void {
  const observedAt = nowIso();
  upsertEvolverSignal(doc, {
    timestamp: observedAt,
    updated_at: observedAt,
    signal_id: input.signal_id,
    kind: input.kind,
    trigger: input.trigger,
    skill_id: input.skill_id,
    scope_hint: input.scope_hint,
    title: input.title,
    summary: input.summary,
    confidence: input.confidence,
    status: input.status,
    topic_hint: input.topic_hint,
    attempt_key: input.attempt_key,
    error_type: input.error_type,
    occurrence_index: input.occurrence_index,
    evidence_ref: input.evidence_ref,
    notes: input.notes,
  });
}

export function appendTaskSignalLog(
  doc: SkillUsageDoc,
  input: {
    signal_id: string;
    kind: TaskSignalKind;
    summary: string;
    task_cluster: string;
    evidence_ref: string;
    confidence: PlanConfidence;
    notes: string;
  },
): void {
  requireUniqueSignalId(doc, input.signal_id);
  doc.task_signal_log.push({
    timestamp: nowIso(),
    signal_id: input.signal_id,
    kind: input.kind,
    summary: input.summary,
    task_cluster: input.task_cluster,
    evidence_ref: input.evidence_ref,
    confidence: input.confidence,
    notes: input.notes,
  });
  doc.updated_at = nowIso();
}

export function appendCandidateResultLog(
  doc: SkillUsageDoc,
  input: {
    result_id: string;
    candidate_id: string;
    task_signal_id: string;
    action_ref: string;
    result_status: CandidateResultStatus;
    verification_ref: string;
    feedback_ref: string;
    score?: number;
    cost_hint: string;
    latency_hint: string;
    notes: string;
  },
): void {
  requireUniqueCandidateResultId(doc, input.result_id);
  if (!doc.skill_plan.some((entry) => entry.skill_id === input.candidate_id)) {
    throw new Error(`candidate_result_log.candidate_id must refer to a planned candidate: ${input.candidate_id}`);
  }
  if (input.task_signal_id.trim() && !doc.task_signal_log.some((entry) => entry.signal_id === input.task_signal_id)) {
    throw new Error(`candidate_result_log.task_signal_id must refer to a task signal: ${input.task_signal_id}`);
  }
  if (input.score !== undefined && (input.score < 0 || input.score > 1)) {
    throw new Error("candidate_result_log.score must be within [0,1]");
  }
  doc.candidate_result_log.push({
    timestamp: nowIso(),
    result_id: input.result_id,
    candidate_id: input.candidate_id,
    task_signal_id: input.task_signal_id,
    action_ref: input.action_ref,
    result_status: input.result_status,
    verification_ref: input.verification_ref,
    feedback_ref: input.feedback_ref,
    score: input.score,
    cost_hint: input.cost_hint,
    latency_hint: input.latency_hint,
    notes: input.notes,
  });
  doc.updated_at = nowIso();
}

export function appendSelectionLessonLog(
  doc: SkillUsageDoc,
  input: {
    lesson_id: string;
    task_signal_kind: TaskSignalKind;
    task_cluster: string;
    candidate_id: string;
    recommendation: string;
    confidence: PlanConfidence;
    support_ref: string;
    limitation: string;
    invalidates_ref: string;
    notes: string;
  },
): void {
  requireUniqueSelectionLessonId(doc, input.lesson_id);
  if (input.candidate_id.trim() && !doc.skill_plan.some((entry) => entry.skill_id === input.candidate_id)) {
    throw new Error(`selection_lesson_log.candidate_id must refer to a planned candidate: ${input.candidate_id}`);
  }
  doc.selection_lesson_log.push({
    timestamp: nowIso(),
    lesson_id: input.lesson_id,
    task_signal_kind: input.task_signal_kind,
    task_cluster: input.task_cluster,
    candidate_id: input.candidate_id,
    recommendation: input.recommendation,
    confidence: input.confidence,
    support_ref: input.support_ref,
    limitation: input.limitation,
    invalidates_ref: input.invalidates_ref,
    notes: input.notes,
  });
  doc.updated_at = nowIso();
}

export function appendLessonUpdateLog(
  doc: SkillUsageDoc,
  input: {
    lesson_id: string;
    action: LessonUpdateAction;
    target_ref: string;
    reason: string;
    evidence_ref: string;
    notes: string;
  },
): void {
  if (input.lesson_id.trim() === "") {
    throw new Error("lesson_update_log.lesson_id must not be empty");
  }
  doc.lesson_update_log.push({
    timestamp: nowIso(),
    lesson_id: input.lesson_id,
    action: input.action,
    target_ref: input.target_ref,
    reason: input.reason,
    evidence_ref: input.evidence_ref,
    notes: input.notes,
  });
  doc.updated_at = nowIso();
}

export function appendSkillPlan(
  doc: SkillUsageDoc,
  input: {
    skill_id: string;
    kind: PlanKind;
    source: string;
    why: string;
    expected_impact: string;
    confidence: PlanConfidence;
    availability: PlanAvailability;
    availability_detail: string;
    selected: boolean;
    status: PlanStatus;
    composition_role: CompositionRole;
    composition_id: string;
    activation_mode: ActivationMode;
    fallback_strategy: string;
    rejection_reason: string;
    expected_failure_mode: string;
    evidence_needed: string;
    notes: string;
  },
): void {
  if (input.composition_role === "standalone") {
    if (input.composition_id !== "") {
      throw new Error("--composition-id requires a non-standalone composition role");
    }
    if (input.activation_mode !== "standalone") {
      throw new Error("standalone plans must use --activation-mode standalone");
    }
    if (input.fallback_strategy !== "none") {
      throw new Error("standalone plans must use --fallback-strategy none");
    }
  } else {
    if (input.composition_id === "") {
      throw new Error("composed plans require --composition-id");
    }
    if (input.activation_mode !== "composed") {
      throw new Error("composed plans must use --activation-mode composed");
    }
  }
  if (input.composition_role === "composition_entrypoint" && input.skill_id !== "bagakit-skill-selector") {
    throw new Error("only bagakit-skill-selector may be logged as the composition entrypoint");
  }
  if (input.composition_role === "composition_peer" && input.fallback_strategy !== "standalone_first") {
    throw new Error("composition peers must declare --fallback-strategy standalone_first");
  }
  if (doc.skill_plan.some((entry) => entry.skill_id === input.skill_id)) {
    throw new Error(`skill_plan.skill_id already exists: ${input.skill_id}. keep one row per candidate id and update that row explicitly`);
  }

  doc.skill_plan.push({
    timestamp: nowIso(),
    skill_id: input.skill_id,
    kind: input.kind,
    source: input.source,
    why: input.why,
    expected_impact: input.expected_impact,
    confidence: input.confidence,
    availability: input.availability,
    availability_detail: input.availability_detail,
    selected: input.selected,
    status: input.status,
    composition_role: input.composition_role,
    composition_id: input.composition_id,
    activation_mode: input.activation_mode,
    fallback_strategy: assertEnumValue(
      FALLBACK_STRATEGIES,
      input.fallback_strategy,
      "skill_plan.fallback_strategy",
    ),
    rejection_reason: input.rejection_reason,
    expected_failure_mode: input.expected_failure_mode,
    evidence_needed: input.evidence_needed,
    notes: input.notes,
  });
  doc.updated_at = nowIso();
}

export function appendUsageLog(
  doc: SkillUsageDoc,
  input: {
    skill_id: string;
    phase: UsagePhase;
    action: string;
    result: UsageResult;
    evidence: string;
    metric_hint: string;
    attempt_key: string;
    notes: string;
  },
): string[] {
  requireSelectedPlanForUsage(doc, input.skill_id);
  const attemptKey = input.attempt_key.trim() || input.action.trim();
  const priorAttempts = doc.usage_log.filter(
    (entry) => entry.skill_id === input.skill_id && (entry.attempt_key || entry.action) === attemptKey,
  ).length;
  const attemptIndex = priorAttempts + 1;
  const threshold = doc.attempt_policy.retry_backoff_threshold;
  const backoffRequired = input.result !== "success" && attemptIndex >= threshold;

  let notes = input.notes;
  if (attemptIndex > 1) {
    notes = joinNotes(notes, `try-${attemptIndex}`);
  }
  if (backoffRequired) {
    notes = joinNotes(notes, `backoff threshold ${threshold} reached`);
  }

  doc.usage_log.push({
    timestamp: nowIso(),
    skill_id: input.skill_id,
    phase: input.phase,
    action: input.action,
    result: input.result,
    evidence: input.evidence,
    metric_hint: input.metric_hint,
    attempt_key: attemptKey,
    attempt_index: attemptIndex,
    backoff_required: backoffRequired,
    notes,
  });

  const messages: string[] = [];
  if (attemptIndex > 1) {
    messages.push(`note: retry detected for ${input.skill_id}:${attemptKey} (try-${attemptIndex})`);
  }
  if (backoffRequired) {
    doc.next_actions.needs_new_search = true;
    if (doc.next_actions.next_search_query.trim() === "") {
      doc.next_actions.next_search_query = `${attemptKey} alternative strategy`;
    }
    doc.next_actions.notes = joinNotes(
      doc.next_actions.notes,
      `${attemptKey} reached try-${attemptIndex}; step back and switch method before retrying again`,
    );
    messages.push(
      `note: backoff required for ${input.skill_id}:${attemptKey} after try-${attemptIndex}; switch method before retrying`,
    );
    const suggested = suggestEvolverSignalFromBackoff(doc, {
      skill_id: input.skill_id,
      attempt_key: attemptKey,
      occurrence_index: attemptIndex,
    });
    if (suggested) {
      messages.push(`note: evolver review signal suggested for ${input.skill_id}:${attemptKey}`);
    }
  }

  doc.updated_at = nowIso();
  return messages;
}

export function updatePlanAvailability(
  doc: SkillUsageDoc,
  input: {
    skill_id: string;
    availability: PlanAvailability;
    availability_detail: string;
  },
): void {
  const plan = [...doc.skill_plan].reverse().find((entry) => entry.skill_id === input.skill_id);
  if (!plan) {
    throw new Error(`unknown planned skill_id: ${input.skill_id}`);
  }
  plan.availability = input.availability;
  plan.availability_detail = input.availability_detail;
  doc.updated_at = nowIso();
}

export function appendFeedbackLog(
  doc: SkillUsageDoc,
  input: {
    skill_id: string;
    channel: FeedbackChannel;
    signal: FeedbackSignal;
    detail: string;
    impact_scope: string;
    confidence: PlanConfidence;
  },
): void {
  doc.feedback_log.push({
    timestamp: nowIso(),
    skill_id: input.skill_id,
    channel: input.channel,
    signal: input.signal,
    detail: input.detail,
    impact_scope: input.impact_scope,
    confidence: input.confidence,
  });
  doc.updated_at = nowIso();
}

export function appendSearchLog(
  doc: SkillUsageDoc,
  input: {
    reason: string;
    query: string;
    source_scope: SearchSourceScope;
    status: SearchStatus;
    notes: string;
  },
): void {
  doc.search_log.push({
    timestamp: nowIso(),
    reason: input.reason,
    query: input.query,
    source_scope: input.source_scope,
    status: input.status,
    notes: input.notes,
  });
  doc.next_actions.needs_new_search = true;
  doc.next_actions.next_search_query = input.query;
  doc.updated_at = nowIso();
}

export function appendBenchmarkLog(
  doc: SkillUsageDoc,
  input: {
    benchmark_id: string;
    metric: string;
    baseline: number;
    candidate: number;
    higher_is_better: boolean;
    notes: string;
  },
): { passed: boolean; delta: number } {
  const delta = input.higher_is_better ? input.candidate - input.baseline : input.baseline - input.candidate;
  const passed = delta >= 0;
  doc.benchmark_log.push({
    timestamp: nowIso(),
    benchmark_id: input.benchmark_id,
    metric: input.metric,
    baseline: input.baseline,
    candidate: input.candidate,
    delta,
    higher_is_better: input.higher_is_better,
    passed,
    notes: input.notes,
  });
  if (!passed) {
    doc.next_actions.needs_new_search = true;
    if (doc.next_actions.next_search_query.trim() === "") {
      doc.next_actions.next_search_query = `${input.benchmark_id} ${input.metric} improve strategy`;
    }
  }
  doc.updated_at = nowIso();
  return { passed, delta };
}

export function appendErrorPatternLog(
  doc: SkillUsageDoc,
  input: {
    error_type: string;
    message_pattern: string;
    skill_id: string;
    resolution: string;
    notes: string;
  },
): { occurrenceIndex: number } {
  const normalizedPattern = normalizeClusterText(input.message_pattern);
  const failureDepth = doc.usage_log.filter(
    (entry) =>
      entry.skill_id === input.skill_id &&
      entry.result === "failed" &&
      normalizeClusterText(entry.action) === normalizedPattern,
  ).length;
  const priorLoggedDepth = doc.error_pattern_log
    .filter(
      (entry) =>
        entry.skill_id === input.skill_id &&
        entry.error_type === input.error_type &&
        normalizeClusterText(entry.message_pattern) === normalizedPattern,
    )
    .reduce((maxDepth, entry) => Math.max(maxDepth, entry.occurrence_index), 0);
  const occurrenceIndex = failureDepth > 0 ? failureDepth : priorLoggedDepth + 1;

  doc.error_pattern_log.push({
    timestamp: nowIso(),
    error_type: input.error_type,
    message_pattern: input.message_pattern,
    skill_id: input.skill_id,
    occurrence_index: occurrenceIndex,
    resolution: input.resolution,
    notes: input.notes,
  });
  suggestEvolverSignalFromErrorPattern(doc, {
    skill_id: input.skill_id,
    error_type: input.error_type,
    message_pattern: input.message_pattern,
    occurrence_index: occurrenceIndex,
  });
  doc.updated_at = nowIso();
  return { occurrenceIndex };
}

export function updateEvaluation(
  doc: SkillUsageDoc,
  input: {
    quality_score: number;
    evidence_score: number;
    feedback_score: number;
    overall: EvaluationOverall;
    summary: string;
    status?: TaskStatus;
    needs_feedback_confirmation?: boolean;
    needs_new_search?: boolean;
    next_search_query?: string;
    notes?: string;
  },
): void {
  doc.evaluation.quality_score = input.quality_score;
  doc.evaluation.evidence_score = input.evidence_score;
  doc.evaluation.feedback_score = input.feedback_score;
  doc.evaluation.overall = input.overall;
  doc.evaluation.summary = input.summary;

  if (input.status) {
    doc.status = input.status;
  }
  if (input.needs_feedback_confirmation !== undefined) {
    doc.next_actions.needs_feedback_confirmation = input.needs_feedback_confirmation;
  }
  if (input.needs_new_search !== undefined) {
    doc.next_actions.needs_new_search = input.needs_new_search;
  }
  if (input.next_search_query !== undefined) {
    doc.next_actions.next_search_query = input.next_search_query;
  }
  if (input.notes !== undefined) {
    doc.next_actions.notes = input.notes;
  }

  doc.updated_at = nowIso();
}

export interface EpisodeDispositionDecision {
  disposition: "receipt_only" | "full_episode";
  material_signals: string[];
}

export function deriveEpisodeDisposition(doc: SkillUsageDoc): EpisodeDispositionDecision {
  const signals = new Set<string>();

  if (doc.preflight.decision !== "direct_execute" && doc.preflight.decision !== "pending") {
    signals.add(`route_${doc.preflight.decision}`);
  }
  if (doc.preflight.answer === "no" || doc.preflight.answer === "partial" || doc.preflight.gap_summary.trim() !== "") {
    signals.add("coverage_gap");
  }
  if (doc.skill_plan.length > 1) {
    signals.add("multiple_candidates");
  }
  if (doc.skill_plan.some((entry) => !entry.selected || entry.kind === "research")) {
    signals.add("candidate_comparison");
  }
  if (doc.skill_plan.some((entry) => entry.composition_role !== "standalone" || entry.activation_mode === "composed")) {
    signals.add("composition");
  }
  if (doc.usage_log.some((entry) => entry.result !== "success")) {
    signals.add("usage_failure_or_partial");
  }
  if (doc.usage_log.some((entry) => entry.attempt_index > 1 || entry.backoff_required)) {
    signals.add("retry");
  }
  if (doc.feedback_log.length > 0) {
    signals.add("explicit_feedback");
  }
  if (doc.recipe_log.length > 0) {
    signals.add("recipe_evidence");
  }
  if (doc.search_log.length > 0) {
    signals.add("search_follow_up");
  }
  if (doc.benchmark_log.length > 0) {
    signals.add("benchmark_evidence");
  }
  if (doc.error_pattern_log.length > 0) {
    signals.add("error_pattern");
  }
  if (doc.task_signal_log.length > 0) {
    signals.add("task_signal");
  }
  if (doc.candidate_result_log.length > 0) {
    signals.add("candidate_result");
  }
  if (doc.selection_lesson_log.length > 0) {
    signals.add("selection_lesson");
  }
  if (doc.lesson_update_log.length > 0) {
    signals.add("lesson_update");
  }
  if (doc.evolver_signal_log.length > 0) {
    signals.add("evolver_signal");
  }
  if (doc.evaluation.overall === "conditional_pass" || doc.evaluation.overall === "fail") {
    signals.add("non_passing_evaluation");
  }
  if (
    doc.next_actions.needs_feedback_confirmation ||
    doc.next_actions.needs_new_search ||
    doc.next_actions.next_search_query.trim() !== ""
  ) {
    signals.add("open_next_action");
  }
  const materialSignals = [...signals].sort();
  return {
    disposition: materialSignals.length > 0 ? "full_episode" : "receipt_only",
    material_signals: materialSignals,
  };
}

export function closeSkillUsage(
  doc: SkillUsageDoc,
  requestedDisposition?: EpisodeDisposition,
): EpisodeDispositionDecision & { selected_disposition: EpisodeDisposition } {
  const decision = deriveEpisodeDisposition(doc);
  if (doc.episode_disposition && doc.status === "completed") {
    if (requestedDisposition && requestedDisposition !== doc.episode_disposition.value) {
      throw new Error(
        `selector episode is already closed as ${doc.episode_disposition.value}; use a new episode instead of rewriting the terminal disposition`,
      );
    }
    return { ...decision, selected_disposition: doc.episode_disposition.value };
  }
  if (decision.disposition === "full_episode" && requestedDisposition && requestedDisposition !== "full_episode") {
    throw new Error(
      `episode requires full_episode because material signals are present: ${decision.material_signals.join(",")}`,
    );
  }

  const selectedDisposition = decision.disposition === "full_episode"
    ? "full_episode"
    : requestedDisposition ?? doc.episode_disposition?.value ?? "receipt_only";
  const reason = decision.material_signals.length > 0
    ? decision.material_signals.join(",")
    : selectedDisposition === "audit_sample"
      ? "operator_selected_audit_sample"
      : selectedDisposition === "full_episode"
        ? "operator_requested_full_episode"
        : "routine_direct_execute";
  const timestamp = nowIso();
  doc.episode_disposition = {
    value: selectedDisposition,
    closed_at: timestamp,
    reason,
  };
  doc.status = "completed";
  doc.updated_at = timestamp;
  return { ...decision, selected_disposition: selectedDisposition };
}

export function validateSkillUsage(doc: SkillUsageDoc, strict: boolean): string[] {
  const issues: string[] = [];

  if (doc.preflight.answer === "pending") {
    issues.push("preflight.answer is pending or missing");
  }
  const normalizedPreflightDecision = doc.preflight.decision.trim().toLowerCase();
  if (doc.preflight.answer !== "pending" && (normalizedPreflightDecision === "" || normalizedPreflightDecision === "pending")) {
    issues.push("preflight.decision must not remain pending once preflight.answer is set");
  }
  if (doc.status !== "planning" && (normalizedPreflightDecision === "" || normalizedPreflightDecision === "pending")) {
    issues.push("preflight.decision must not remain pending once execution has started");
  }
  const disposition = doc.episode_disposition?.value;
  const requiresFullEpisode = disposition === undefined || disposition === "full_episode" || disposition === "audit_sample";
  if (doc.episode_disposition) {
    if (doc.episode_disposition.closed_at.trim() === "") {
      issues.push("episode_disposition.closed_at must not be empty");
    }
    if (doc.episode_disposition.reason.trim() === "") {
      issues.push("episode_disposition.reason must not be empty");
    }
    if (doc.status !== "completed") {
      issues.push("closed selector episodes must use status=completed");
    }
    const derivedDisposition = deriveEpisodeDisposition(doc);
    if (derivedDisposition.disposition === "full_episode" && disposition !== "full_episode") {
      issues.push(
        `episode_disposition must be full_episode for material signals (${derivedDisposition.material_signals.join(",")})`,
      );
    }
    if (disposition === "receipt_only" && doc.preflight.decision !== "direct_execute") {
      issues.push("receipt_only requires preflight.decision=direct_execute");
    }
    const expectedReason = derivedDisposition.material_signals.length > 0
      ? derivedDisposition.material_signals.join(",")
      : disposition === "audit_sample"
        ? "operator_selected_audit_sample"
        : disposition === "full_episode"
          ? "operator_requested_full_episode"
          : "routine_direct_execute";
    if (doc.episode_disposition.reason !== expectedReason) {
      issues.push(`episode_disposition.reason must equal deterministic close reason: ${expectedReason}`);
    }
  }
  if (requiresFullEpisode) {
    if (doc.skill_plan.length < 1) {
      issues.push("missing [[skill_plan]] entries");
    }
    if (doc.usage_log.length < 1) {
      issues.push("missing [[usage_log]] entries");
    }
    if (doc.evaluation.overall === "pending") {
      issues.push("evaluation.overall is pending or missing");
    }
  }
  for (const [label, value] of [
    ["evaluation.quality_score", doc.evaluation.quality_score],
    ["evaluation.evidence_score", doc.evaluation.evidence_score],
    ["evaluation.feedback_score", doc.evaluation.feedback_score],
  ] as const) {
    if (value < 0 || value > 1) {
      issues.push(`${label} must be within [0,1]`);
    }
  }
  if (!Number.isInteger(doc.attempt_policy.retry_backoff_threshold) || doc.attempt_policy.retry_backoff_threshold < 2) {
    issues.push("attempt_policy.retry_backoff_threshold must be an integer >= 2");
  }
  const plannedSkillIds = new Set(doc.skill_plan.map((plan) => plan.skill_id));
  const selectedSkillIds = new Set(doc.skill_plan.filter((plan) => plan.selected).map((plan) => plan.skill_id));
  const taskSignalIds = new Set<string>();
  const candidateResultIds = new Set<string>();
  const selectionLessonIds = new Set<string>();
  if (plannedSkillIds.size !== doc.skill_plan.length) {
    issues.push("skill_plan.skill_id must be unique within one task file");
  }
  for (const plan of doc.skill_plan) {
    if (plan.skill_id.trim() === "") {
      issues.push("skill_plan.skill_id must not be empty");
    }
    if (plan.availability === "unavailable" && plan.selected) {
      issues.push(`skill_plan.selected candidate must not remain unavailable (${plan.skill_id})`);
    }
    if (plan.status === "used" && plan.availability === "unavailable") {
      issues.push(`skill_plan.used candidate must not remain unavailable (${plan.skill_id})`);
    }
  }
  for (const signal of doc.task_signal_log) {
    if (signal.signal_id.trim() === "") {
      issues.push("task_signal_log.signal_id must not be empty");
    } else if (taskSignalIds.has(signal.signal_id)) {
      issues.push(`duplicate task_signal_log.signal_id (${signal.signal_id})`);
    } else {
      taskSignalIds.add(signal.signal_id);
    }
    if (signal.summary.trim() === "") {
      issues.push(`task_signal_log.summary must not be empty (${signal.signal_id})`);
    }
    if (signal.evidence_ref.trim() === "") {
      issues.push(`task_signal_log.evidence_ref must not be empty (${signal.signal_id})`);
    }
  }
  for (const result of doc.candidate_result_log) {
    if (result.result_id.trim() === "") {
      issues.push("candidate_result_log.result_id must not be empty");
    } else if (candidateResultIds.has(result.result_id)) {
      issues.push(`duplicate candidate_result_log.result_id (${result.result_id})`);
    } else {
      candidateResultIds.add(result.result_id);
    }
    if (!plannedSkillIds.has(result.candidate_id)) {
      issues.push(`candidate_result_log.candidate_id must refer to a planned skill (${result.candidate_id})`);
    }
    if (result.task_signal_id.trim() !== "" && !taskSignalIds.has(result.task_signal_id)) {
      issues.push(`candidate_result_log.task_signal_id must refer to a task signal (${result.task_signal_id})`);
    }
    if (result.verification_ref.trim() === "") {
      issues.push(`candidate_result_log.verification_ref must not be empty (${result.result_id})`);
    }
    if (result.score !== undefined && (result.score < 0 || result.score > 1)) {
      issues.push(`candidate_result_log.score must be within [0,1] (${result.result_id})`);
    }
  }
  for (const lesson of doc.selection_lesson_log) {
    if (lesson.lesson_id.trim() === "") {
      issues.push("selection_lesson_log.lesson_id must not be empty");
    } else if (selectionLessonIds.has(lesson.lesson_id)) {
      issues.push(`duplicate selection_lesson_log.lesson_id (${lesson.lesson_id})`);
    } else {
      selectionLessonIds.add(lesson.lesson_id);
    }
    if (lesson.candidate_id.trim() !== "" && !plannedSkillIds.has(lesson.candidate_id)) {
      issues.push(`selection_lesson_log.candidate_id must refer to a planned skill (${lesson.candidate_id})`);
    }
    if (lesson.support_ref.trim() === "") {
      issues.push(`selection_lesson_log.support_ref must not be empty (${lesson.lesson_id})`);
    }
  }
  for (const update of doc.lesson_update_log) {
    if (update.lesson_id.trim() === "") {
      issues.push("lesson_update_log.lesson_id must not be empty");
    }
    if (update.reason.trim() === "") {
      issues.push(`lesson_update_log.reason must not be empty (${update.lesson_id})`);
    }
    if (update.evidence_ref.trim() === "") {
      issues.push(`lesson_update_log.evidence_ref must not be empty (${update.lesson_id})`);
    }
  }
  for (const usage of doc.usage_log) {
    if (usage.skill_id.trim() === "") {
      issues.push("usage_log.skill_id must not be empty");
      continue;
    }
    if (!plannedSkillIds.has(usage.skill_id)) {
      issues.push(`usage_log.skill_id must refer to a planned skill (${usage.skill_id})`);
      continue;
    }
    if (!selectedSkillIds.has(usage.skill_id)) {
      issues.push(`usage_log.skill_id must refer to a selected skill (${usage.skill_id})`);
    }
  }
  for (const recipe of doc.recipe_log) {
    if (!isPlanningEntryRecipeId(recipe.recipe_id)) {
      continue;
    }
    if (recipe.source !== canonicalPlanningEntryRecipeSource(recipe.recipe_id)) {
      issues.push(`planning-entry recipe source must match the canonical selector path (${recipe.recipe_id})`);
    }
    if (recipe.status === "selected" || recipe.status === "used") {
      const requiredParticipants = PLANNING_ENTRY_ROUTE_PARTICIPANTS[recipe.recipe_id];
      const allowedSelectedParticipants = new Set([...requiredParticipants, "bagakit-skill-selector"]);
      for (const skillId of requiredParticipants) {
        if (!selectedSkillIds.has(skillId)) {
          issues.push(`planning-entry recipe requires selected skill_plan participant (${recipe.recipe_id}:${skillId})`);
        }
      }
      for (const selectedSkillId of selectedSkillIds) {
        if (!allowedSelectedParticipants.has(selectedSkillId)) {
          issues.push(`planning-entry recipe must not select off-route participant (${recipe.recipe_id}:${selectedSkillId})`);
        }
      }
      if (recipe.synthesis_artifact) {
        const artifact = recipe.synthesis_artifact.trim();
        if (GENERIC_PLANNING_FILES.has(artifact)) {
          issues.push(`planning-entry recipe must not use generic root planning file as synthesis artifact (${recipe.recipe_id}:${artifact})`);
        }
        if (!PLANNING_ENTRY_ARTIFACT_PREFIXES.some((prefix) => artifact.startsWith(prefix))) {
          issues.push(`planning-entry recipe synthesis_artifact must stay inside canonical Bagakit planning surfaces (${recipe.recipe_id}:${artifact})`);
        }
      }
      for (const usage of doc.usage_log) {
        if (!allowedSelectedParticipants.has(usage.skill_id)) {
          continue;
        }
        const evidence = usage.evidence.trim();
        if (GENERIC_PLANNING_FILES.has(evidence)) {
          issues.push(`planning-entry usage evidence must not use generic root planning file (${recipe.recipe_id}:${usage.skill_id}:${evidence})`);
          continue;
        }
        const allowedPrefixes = PLANNING_ENTRY_USAGE_EVIDENCE_PREFIX[usage.skill_id] ?? [];
        if (allowedPrefixes.length > 0 && !allowedPrefixes.some((prefix) => evidence.startsWith(prefix))) {
          issues.push(`planning-entry usage evidence must stay inside canonical route surfaces (${recipe.recipe_id}:${usage.skill_id}:${evidence})`);
        }
      }
    }
  }
  for (const errorPattern of doc.error_pattern_log) {
    if (!Number.isInteger(errorPattern.occurrence_index) || errorPattern.occurrence_index < 1) {
      issues.push(
        `error_pattern_log.occurrence_index must be an integer >= 1 (${errorPattern.skill_id}:${errorPattern.error_type})`,
      );
    }
    if (errorPattern.skill_id.trim() === "") {
      issues.push("error_pattern_log.skill_id must not be empty");
    } else if (plannedSkillIds.size > 0 && !plannedSkillIds.has(errorPattern.skill_id)) {
      issues.push(`error_pattern_log.skill_id must refer to a planned skill (${errorPattern.skill_id})`);
    }
    const matchingFailedUsages = doc.usage_log.filter(
      (entry) =>
        entry.skill_id === errorPattern.skill_id &&
        entry.result === "failed" &&
        normalizeClusterText(entry.action) === normalizeClusterText(errorPattern.message_pattern),
    ).length;
    if (matchingFailedUsages > 0 && errorPattern.occurrence_index !== matchingFailedUsages) {
      issues.push(
        "error_pattern_log.occurrence_index must match failed usage depth for the same skill and message pattern "
        + `(${errorPattern.skill_id}:${errorPattern.error_type})`,
      );
    }
  }
  const evolverSignalIds = new Set<string>();
  const evolverBridgeIds = new Set<string>();
  for (const signal of doc.evolver_signal_log) {
    if (signal.signal_id.trim() === "") {
      issues.push("evolver_signal_log.signal_id must not be empty");
    } else if (evolverSignalIds.has(signal.signal_id)) {
      issues.push(`duplicate evolver_signal_log.signal_id (${signal.signal_id})`);
    } else {
      evolverSignalIds.add(signal.signal_id);
    }
    const normalizedBridgeId = bridgeSignalId(doc.task_id, signal.signal_id);
    if (evolverBridgeIds.has(normalizedBridgeId)) {
      issues.push(`duplicate evolver bridge id after normalization (${normalizedBridgeId})`);
    } else {
      evolverBridgeIds.add(normalizedBridgeId);
    }
    if (signal.skill_id.trim() === "") {
      issues.push("evolver_signal_log.skill_id must not be empty");
    } else if (plannedSkillIds.size > 0 && !plannedSkillIds.has(signal.skill_id)) {
      issues.push(`evolver_signal_log.skill_id must refer to a planned skill (${signal.skill_id})`);
    }
    if (signal.confidence < 0 || signal.confidence > 1) {
      issues.push(`evolver_signal_log.confidence must be within [0,1] (${signal.signal_id})`);
    }
    if (!Number.isInteger(signal.occurrence_index) || signal.occurrence_index < 1) {
      issues.push(`evolver_signal_log.occurrence_index must be an integer >= 1 (${signal.signal_id})`);
    }
  }

  if (!strict || disposition === "receipt_only") {
    return issues;
  }

  const hasGoldReadyEvidence =
    doc.task_signal_log.length > 0 ||
    doc.candidate_result_log.length > 0 ||
    doc.selection_lesson_log.length > 0 ||
    doc.lesson_update_log.length > 0 ||
    doc.episode_refs.source_prompt_ref.trim() !== "" ||
    doc.episode_refs.final_artifact_ref.trim() !== "" ||
    doc.episode_refs.verification_ref.trim() !== "";
  if (hasGoldReadyEvidence) {
    for (const ref of [
      ["episode_refs.source_prompt_ref", doc.episode_refs.source_prompt_ref],
      ["episode_refs.final_artifact_ref", doc.episode_refs.final_artifact_ref],
      ["episode_refs.verification_ref", doc.episode_refs.verification_ref],
    ] as const) {
      if (ref[1].trim() === "") {
        issues.push(`strict mode: ${ref[0]} should be set for gold-ready selector episodes`);
      }
    }
  }

  const composedCounts = new Map<string, { entrypoint: number; peer: number }>();
  for (const plan of doc.skill_plan) {
    if (plan.kind === "local" && plan.selected && plan.availability === "unknown") {
      issues.push(`strict mode: selected local skill_plan must record availability (${plan.skill_id})`);
    }
    if (!plan.selected && ["not_used", "replaced", "deprecated"].includes(plan.status)) {
      const hasNegativeEvidence =
        plan.rejection_reason.trim() !== "" ||
        plan.expected_failure_mode.trim() !== "" ||
        plan.evidence_needed.trim() !== "";
      if (!hasNegativeEvidence) {
        issues.push(`strict mode: non-selected skill_plan should preserve rejection evidence (${plan.skill_id})`);
      }
    }

    if (plan.composition_role === "standalone") {
      if (plan.composition_id !== "") {
        issues.push(`strict mode: standalone skill_plan must not set composition_id (${plan.skill_id})`);
      }
      if (plan.activation_mode !== "standalone") {
        issues.push(`strict mode: standalone skill_plan must use activation_mode=standalone (${plan.skill_id})`);
      }
      if (plan.fallback_strategy !== "none") {
        issues.push(`strict mode: standalone skill_plan must use fallback_strategy=none (${plan.skill_id})`);
      }
      continue;
    }

    if (plan.composition_id === "") {
      issues.push(`strict mode: composed skill_plan requires composition_id (${plan.skill_id})`);
      continue;
    }
    if (plan.activation_mode !== "composed") {
      issues.push(`strict mode: composed skill_plan must use activation_mode=composed (${plan.skill_id})`);
    }
    const bucket = composedCounts.get(plan.composition_id) ?? { entrypoint: 0, peer: 0 };
    composedCounts.set(plan.composition_id, bucket);
    if (plan.composition_role === "composition_entrypoint") {
      if (plan.skill_id !== "bagakit-skill-selector") {
        issues.push(
          `strict mode: bagakit-skill-selector must be the only composition_entrypoint (${plan.skill_id})`,
        );
      }
      bucket.entrypoint += 1;
    } else if (plan.composition_role === "composition_peer") {
      if (plan.fallback_strategy !== "standalone_first") {
        issues.push(
          `strict mode: composition peers must declare fallback_strategy=standalone_first (${plan.skill_id})`,
        );
      }
      bucket.peer += 1;
    } else {
      issues.push(`strict mode: unknown composition_role ${plan.composition_role} (${plan.skill_id})`);
    }
  }

  const hasResearchCandidate = doc.skill_plan.some((plan) => plan.kind === "research");
  const hasFailedUsage = doc.usage_log.some((entry) => entry.result === "failed");
  const hasRetryBackoff = doc.usage_log.some((entry) => entry.backoff_required);
  const hasNegativeFeedback = doc.feedback_log.some((entry) => entry.signal === "negative");
  const hasFailedBenchmark = doc.benchmark_log.some((entry) => !entry.passed);
  if (hasResearchCandidate && doc.benchmark_log.length < 1) {
    issues.push("strict mode: research candidate requires at least one [[benchmark_log]] entry");
  }
  if ((hasFailedUsage || hasNegativeFeedback || hasFailedBenchmark) && doc.search_log.length < 1) {
    issues.push("strict mode: failed usage, negative feedback, or failed benchmark requires [[search_log]] follow-up");
  }
  if (hasRetryBackoff && doc.search_log.length < 1) {
    issues.push("strict mode: retry backoff requires [[search_log]] follow-up");
  }
  if (doc.evolver_handoff_policy.enabled) {
    for (const usage of doc.usage_log) {
      if (!usage.backoff_required) {
        continue;
      }
      const matchingSignal = doc.evolver_signal_log.some(
        (signal) =>
          signal.trigger === "retry_backoff" &&
          signal.skill_id === usage.skill_id &&
          signal.attempt_key === usage.attempt_key,
      );
      if (!matchingSignal) {
        issues.push(
          `strict mode: retry backoff requires matching [[evolver_signal_log]] review suggestion (${usage.skill_id}:${usage.attempt_key})`,
        );
      }
    }
  }

  for (const [compositionId, counts] of composedCounts.entries()) {
    if (counts.entrypoint !== 1) {
      issues.push(`strict mode: each composition_id requires exactly one composition_entrypoint (${compositionId})`);
    }
    if (counts.peer < 1) {
      issues.push(`strict mode: each composition_id requires at least one composition_peer (${compositionId})`);
    }
  }

  return issues;
}

export function buildValidationSummary(doc: SkillUsageDoc): string {
  return [
    "summary:",
    `disposition=${doc.episode_disposition?.value ?? "open"}`,
    `recipe=${doc.recipe_log.length}`,
    `skill_plan=${doc.skill_plan.length}`,
    `usage=${doc.usage_log.length}`,
    `feedback=${doc.feedback_log.length}`,
    `search=${doc.search_log.length}`,
    `benchmark=${doc.benchmark_log.length}`,
    `error_pattern=${doc.error_pattern_log.length}`,
    `evolver_signal=${doc.evolver_signal_log.length}`,
  ].join(" ");
}

export function loadBagakitDrivers(
  repoRoot: string,
  doc: SkillUsageDoc,
  includeUnselected: boolean,
): BagakitDriverPayload[] {
  const drivers: BagakitDriverPayload[] = [];
  const seenPaths = new Set<string>();

  for (const plan of doc.skill_plan) {
    if (plan.kind !== "local") {
      continue;
    }
    if (!includeUnselected && (!plan.selected || plan.status === "not_used" || plan.status === "deprecated")) {
      continue;
    }

    const descriptor = readSkillDescriptorAtRelativeDir(repoRoot, plan.source);
    if (!descriptor || !descriptor.bagakit) {
      continue;
    }
    const skillName = descriptor.name;
    const driverRef = descriptor.bagakit_driver_file;
    if (!driverRef) {
      continue;
    }

    const driverPath = resolvePathInside(descriptor.absolute_dir, driverRef, "Bagakit driver file");
    if (seenPaths.has(driverPath)) {
      continue;
    }
    seenPaths.add(driverPath);

    const rawDriver = parseTomlFile(driverPath);
    if (!isRecord(rawDriver)) {
      throw new Error(`invalid Bagakit driver file: ${driverPath}`);
    }
    const version = readNumber(rawDriver, "version");
    if (version !== 1) {
      throw new Error(`unsupported Bagakit driver version for ${skillName}: ${String(version)}`);
    }
    const insertTarget = readString(rawDriver, "insert_target");
    if (insertTarget !== "bagakit_footer") {
      throw new Error(`unsupported insert_target for ${skillName}: ${insertTarget}`);
    }
    const summaryLine = readString(rawDriver, "summary_line");
    if (summaryLine.trim() === "") {
      throw new Error(`missing summary_line for ${skillName}`);
    }

    const directives = readRecordArray(rawDriver, "directive").map<BagakitDriverDirective>((entry) => ({
      id: readString(entry, "id"),
      when: readString(entry, "when"),
      instruction: readString(entry, "instruction"),
    }));
    const retryThreshold = rawDriver.retry_backoff_threshold === undefined
      ? undefined
      : readNumber(rawDriver, "retry_backoff_threshold");
    if (retryThreshold !== undefined && (!Number.isInteger(retryThreshold) || retryThreshold < 2)) {
      throw new Error(`invalid retry_backoff_threshold for ${skillName}: ${String(retryThreshold)}`);
    }
    if (retryThreshold !== undefined && skillName !== "bagakit-skill-selector") {
      throw new Error(`retry_backoff_threshold is reserved for bagakit-skill-selector (${skillName})`);
    }

    drivers.push({
      skill_name: skillName,
      skill_source: plan.source,
      driver_ref: driverRef,
      driver_path: driverPath,
      summary_line: summaryLine,
      directives,
      retry_backoff_threshold: retryThreshold,
    });
  }

  return drivers;
}

export function renderDriverPack(taskFile: string, drivers: BagakitDriverPayload[]): string {
  const lines = [
    "# Bagakit Driver Pack",
    "",
    `Generated from \`${taskFile}\`.`,
    "",
  ];
  if (drivers.length === 0) {
    lines.push("No Bagakit driver files were found for the selected local Bagakit skills.");
    lines.push("");
    return lines.join("\n");
  }

  lines.push("## Shared Footer Rules");
  lines.push("Render one `[[BAGAKIT]]` block containing all active Driver summary lines.");
  lines.push(
    "When decision-bearing alert candidates exist, append exactly one `- 👩🏻‍🚒 ALERTS !! <severity-sorted candidates>` line after the normal summaries; omit it when there are no alerts.",
  );
  lines.push("Individual skills contribute alert candidates and must not create separate Alert headings.");
  lines.push("");

  for (const driver of drivers) {
    lines.push(`## ${driver.skill_name}`);
    lines.push(`Skill source: \`${driver.skill_source}\``);
    lines.push(`Driver file: \`${driver.driver_ref}\``);
    lines.push("Insert target: `[[BAGAKIT]]`");
    lines.push(driver.summary_line);
    for (const directive of driver.directives) {
      lines.push(`- (${directive.id}) When ${directive.when}, ${directive.instruction}`);
    }
    if (driver.retry_backoff_threshold !== undefined) {
      lines.push(`- RetryBackoffThreshold: \`${driver.retry_backoff_threshold}\``);
    }
    lines.push("");
  }

  return lines.join("\n");
}
