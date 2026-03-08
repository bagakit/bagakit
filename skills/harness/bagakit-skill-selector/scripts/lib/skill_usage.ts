import fs from "node:fs";
import path from "node:path";

import { getNestedString, parseMarkdownFrontmatter } from "./frontmatter.ts";
import {
  ACTIVATION_MODES,
  COMPOSITION_ROLES,
  EVALUATION_OVERALL,
  EVOLVER_SCOPE_HINTS,
  EVOLVER_SIGNAL_KINDS,
  EVOLVER_SIGNAL_STATUSES,
  EVOLVER_SIGNAL_TRIGGERS,
  FALLBACK_STRATEGIES,
  FEEDBACK_CHANNELS,
  FEEDBACK_SIGNALS,
  PLAN_CONFIDENCE,
  PLAN_KINDS,
  PLAN_STATUSES,
  PREFLIGHT_ANSWERS,
  RECIPE_STATUSES,
  SEARCH_SOURCE_SCOPES,
  SEARCH_STATUSES,
  TASK_STATUSES,
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
  type EvaluationOverall,
  type FeedbackChannel,
  type FeedbackLogEntry,
  type FeedbackSignal,
  type PlanConfidence,
  type PlanKind,
  type PlanStatus,
  type PreflightAnswer,
  type PreflightDecision,
  type RecipeLogEntry,
  type RecipeStatus,
  type SearchLogEntry,
  type SearchSourceScope,
  type SearchStatus,
  type SelectorDriverDirective,
  type SelectorDriverPayload,
  type SkillPlanEntry,
  type SkillUsageDoc,
  type TaskStatus,
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

export function createSkillUsageDoc(taskId: string, objective: string, owner: string): SkillUsageDoc {
  const timestamp = nowIso();
  return {
    schema_version: "1.0",
    task_id: taskId,
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
    skill_plan: [],
    usage_log: [],
    feedback_log: [],
    search_log: [],
    benchmark_log: [],
    error_pattern_log: [],
    recipe_log: [],
    evolver_signal_log: [],
  };
}

export function readSkillUsageDoc(filePath: string): SkillUsageDoc {
  const raw = parseTomlFile(filePath);
  if (!isRecord(raw)) {
    throw new Error(`invalid skill usage file: ${filePath}`);
  }

  return {
    schema_version: readString(raw, "schema_version", "1.0"),
    task_id: readString(raw, "task_id"),
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
    skill_plan: readRecordArray(raw, "skill_plan").map(parseSkillPlanEntry),
    usage_log: readRecordArray(raw, "usage_log").map(parseUsageLogEntry),
    feedback_log: readRecordArray(raw, "feedback_log").map(parseFeedbackLogEntry),
    search_log: readRecordArray(raw, "search_log").map(parseSearchLogEntry),
    benchmark_log: readRecordArray(raw, "benchmark_log").map(parseBenchmarkLogEntry),
    error_pattern_log: readRecordArray(raw, "error_pattern_log").map(parseErrorPatternLogEntry),
    recipe_log: readRecordArray(raw, "recipe_log").map(parseRecipeLogEntry),
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
  lines.push(
    "# Append records below with [[recipe_log]], [[skill_plan]], [[usage_log]], [[feedback_log]], [[search_log]], [[benchmark_log]], [[error_pattern_log]], and [[evolver_signal_log]].",
  );

  renderArrayTable(lines, "recipe_log", doc.recipe_log, [
    "timestamp",
    "recipe_id",
    "source",
    "why",
    "status",
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
    "selected",
    "status",
    "composition_role",
    "composition_id",
    "activation_mode",
    "fallback_strategy",
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
): void {
  ensureNoBridgeSignalCollision(doc, entry.signal_id);
  const existing = findEvolverSignal(doc, entry.signal_id);
  if (!existing) {
    doc.evolver_signal_log.push(entry);
    doc.updated_at = nowIso();
    return;
  }
  if (options?.preserveDismissed && existing.status === "dismissed") {
    return;
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
): void {
  if (!doc.evolver_handoff_policy.enabled) {
    return;
  }
  const observedAt = nowIso();
  upsertEvolverSignal(
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
): void {
  if (!doc.evolver_handoff_policy.enabled || input.occurrence_index < 2) {
    return;
  }
  const observedAt = nowIso();
  upsertEvolverSignal(
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

export function appendRecipeLog(
  doc: SkillUsageDoc,
  input: {
    recipe_id: string;
    source: string;
    why: string;
    status: RecipeStatus;
    notes: string;
  },
): void {
  doc.recipe_log.push({
    timestamp: nowIso(),
    recipe_id: input.recipe_id,
    source: input.source,
    why: input.why,
    status: input.status,
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

export function appendSkillPlan(
  doc: SkillUsageDoc,
  input: {
    skill_id: string;
    kind: PlanKind;
    source: string;
    why: string;
    expected_impact: string;
    confidence: PlanConfidence;
    selected: boolean;
    status: PlanStatus;
    composition_role: CompositionRole;
    composition_id: string;
    activation_mode: ActivationMode;
    fallback_strategy: string;
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

  doc.skill_plan.push({
    timestamp: nowIso(),
    skill_id: input.skill_id,
    kind: input.kind,
    source: input.source,
    why: input.why,
    expected_impact: input.expected_impact,
    confidence: input.confidence,
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
    suggestEvolverSignalFromBackoff(doc, {
      skill_id: input.skill_id,
      attempt_key: attemptKey,
      occurrence_index: attemptIndex,
    });
    messages.push(`note: evolver review signal suggested for ${input.skill_id}:${attemptKey}`);
  }

  doc.updated_at = nowIso();
  return messages;
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
  if (doc.skill_plan.length < 1) {
    issues.push("missing [[skill_plan]] entries");
  }
  if (doc.usage_log.length < 1) {
    issues.push("missing [[usage_log]] entries");
  }
  if (doc.evaluation.overall === "pending") {
    issues.push("evaluation.overall is pending or missing");
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

  if (!strict) {
    return issues;
  }

  const composedCounts = new Map<string, { entrypoint: number; peer: number }>();
  for (const plan of doc.skill_plan) {
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

export function loadSelectorDrivers(
  repoRoot: string,
  doc: SkillUsageDoc,
  includeUnselected: boolean,
): SelectorDriverPayload[] {
  const drivers: SelectorDriverPayload[] = [];
  const seenPaths = new Set<string>();

  for (const plan of doc.skill_plan) {
    if (plan.kind !== "local") {
      continue;
    }
    if (!includeUnselected && (!plan.selected || plan.status === "not_used" || plan.status === "deprecated")) {
      continue;
    }

    const skillDir = resolveRepoRelativePath(repoRoot, plan.source, "skill source");
    const skillMdPath = path.join(skillDir, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) {
      continue;
    }
    const frontmatter = parseMarkdownFrontmatter(fs.readFileSync(skillMdPath, "utf-8"));
    const skillName = getNestedString(frontmatter, ["name"]);
    if (!skillName || !skillName.startsWith("bagakit-")) {
      continue;
    }
    const driverRef = getNestedString(frontmatter, ["metadata", "bagakit", "selector_driver_file"]);
    if (!driverRef) {
      continue;
    }

    const driverPath = resolvePathInside(skillDir, driverRef, "selector driver file");
    if (seenPaths.has(driverPath)) {
      continue;
    }
    seenPaths.add(driverPath);

    const rawDriver = parseTomlFile(driverPath);
    if (!isRecord(rawDriver)) {
      throw new Error(`invalid selector driver file: ${driverPath}`);
    }
    const version = readNumber(rawDriver, "version");
    if (version !== 1) {
      throw new Error(`unsupported selector driver version for ${skillName}: ${String(version)}`);
    }
    const insertTarget = readString(rawDriver, "insert_target");
    if (insertTarget !== "bagakit_footer") {
      throw new Error(`unsupported insert_target for ${skillName}: ${insertTarget}`);
    }
    const summaryLine = readString(rawDriver, "summary_line");
    if (summaryLine.trim() === "") {
      throw new Error(`missing summary_line for ${skillName}`);
    }

    const directives = readRecordArray(rawDriver, "directive").map<SelectorDriverDirective>((entry) => ({
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

export function renderDriverPack(taskFile: string, drivers: SelectorDriverPayload[]): string {
  const lines = [
    "# Bagakit Driver Pack",
    "",
    `Generated from \`${taskFile}\`.`,
    "",
  ];
  if (drivers.length === 0) {
    lines.push("No selector drivers were declared by the selected local Bagakit skills.");
    lines.push("");
    return lines.join("\n");
  }

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
