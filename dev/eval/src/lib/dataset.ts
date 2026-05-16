import fs from "node:fs";

export const EVAL_DATASET_SCHEMA = "bagakit.eval-dataset/v1";

export interface EvalDatasetBuildMeta {
  baseline_split: string;
  holdout_split: string;
  holdout_ratio: number;
  holdout_tags: string[];
  seed: string;
}

export type EvalCasePolarity = "should" | "should_not";
export type EvalGraderType = "state" | "outcome" | "trace" | "path" | "human_rubric" | "model_rubric";
export type EvalCalibrationStatus = "not_required" | "pending" | "calibrated";
export type EvalLifecycleStage = "capability" | "regression_candidate" | "graduated_regression" | "retired";

export interface EvalCaseProvenance {
  source_class: string;
  evidence_ref?: string;
  parent_case_id?: string;
}

export interface EvalCasePrivacy {
  class: "public" | "internal_sanitized" | "private_local";
  sanitized: boolean;
  raw_transcript_included?: boolean;
}

export interface EvalCaseGrader {
  type: EvalGraderType;
  rubric_id: string;
  calibration_status: EvalCalibrationStatus;
  calibration_evidence?: string[];
  transfer_limit: string;
}

export interface EvalCaseLifecycle {
  stage: EvalLifecycleStage;
  regression_ref?: string;
  retirement_reason?: string;
}

export interface EvalCaseTrials {
  count: number;
  min_pass_rate: number;
  reliability_metric?: string;
}

export interface EvalDatasetItem {
  id: string;
  skill_id: string;
  prompt: string;
  expected_outcome: string;
  notes_for_human_review: string;
  reference_output?: string;
  reference_state?: Record<string, unknown>;
  allowed_tools?: string[];
  expected_tools?: string[];
  tags?: string[];
  risk_tags?: string[];
  dimensions?: string[];
  goal_dimensions?: string[];
  polarity?: EvalCasePolarity;
  success_evidence?: string[];
  guard_ids?: string[];
  provenance?: EvalCaseProvenance;
  privacy?: EvalCasePrivacy;
  grader?: EvalCaseGrader;
  lifecycle?: EvalCaseLifecycle;
  trials?: EvalCaseTrials;
  split?: string;
  metadata?: Record<string, unknown>;
}

export interface EvalDatasetFile {
  schema: typeof EVAL_DATASET_SCHEMA;
  dataset_id: string;
  title: string;
  description: string;
  item_schema: string;
  build?: EvalDatasetBuildMeta;
  items: EvalDatasetItem[];
}

export interface EvalDatasetReport {
  schema: "bagakit.eval-dataset-report/v1";
  dataset_id: string;
  title: string;
  totals: {
    items: number;
    with_split: number;
    without_split: number;
  };
  splits: Array<{ split: string; count: number }>;
  skills: Array<{ skill_id: string; count: number }>;
  tags: Array<{ tag: string; count: number }>;
  risk_tags: Array<{ tag: string; count: number }>;
  dimensions: Array<{ dimension: string; count: number }>;
  polarities: Array<{ polarity: string; count: number }>;
  lifecycle_stages: Array<{ stage: string; count: number }>;
  grader_types: Array<{ grader_type: string; count: number }>;
  provenance_classes: Array<{ source_class: string; count: number }>;
  privacy_classes: Array<{ privacy_class: string; count: number }>;
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function assertStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${label} must be an array of strings`);
  }
  return value as string[];
}

function assertOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return assertString(value, label);
}

function assertBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean`);
  }
  return value;
}

function assertNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

function assertEnum<T extends string>(value: unknown, label: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`${label} must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}

function loadProvenance(value: unknown, label: string): EvalCaseProvenance | undefined {
  if (value === undefined) return undefined;
  const record = assertRecord(value, label);
  return {
    source_class: assertString(record.source_class, `${label}.source_class`),
    evidence_ref: assertOptionalString(record.evidence_ref, `${label}.evidence_ref`),
    parent_case_id: assertOptionalString(record.parent_case_id, `${label}.parent_case_id`),
  };
}

function loadPrivacy(value: unknown, label: string): EvalCasePrivacy | undefined {
  if (value === undefined) return undefined;
  const record = assertRecord(value, label);
  return {
    class: assertEnum(record.class, `${label}.class`, ["public", "internal_sanitized", "private_local"] as const),
    sanitized: assertBoolean(record.sanitized, `${label}.sanitized`),
    raw_transcript_included:
      record.raw_transcript_included === undefined
        ? undefined
        : assertBoolean(record.raw_transcript_included, `${label}.raw_transcript_included`),
  };
}

function loadGrader(value: unknown, label: string): EvalCaseGrader | undefined {
  if (value === undefined) return undefined;
  const record = assertRecord(value, label);
  return {
    type: assertEnum(record.type, `${label}.type`, ["state", "outcome", "trace", "path", "human_rubric", "model_rubric"] as const),
    rubric_id: assertString(record.rubric_id, `${label}.rubric_id`),
    calibration_status: assertEnum(record.calibration_status, `${label}.calibration_status`, ["not_required", "pending", "calibrated"] as const),
    calibration_evidence: normalizeStringArray(
      assertStringArray(record.calibration_evidence ?? [], `${label}.calibration_evidence`),
    ),
    transfer_limit: assertString(record.transfer_limit, `${label}.transfer_limit`),
  };
}

function loadLifecycle(value: unknown, label: string): EvalCaseLifecycle | undefined {
  if (value === undefined) return undefined;
  const record = assertRecord(value, label);
  return {
    stage: assertEnum(record.stage, `${label}.stage`, ["capability", "regression_candidate", "graduated_regression", "retired"] as const),
    regression_ref: assertOptionalString(record.regression_ref, `${label}.regression_ref`),
    retirement_reason: assertOptionalString(record.retirement_reason, `${label}.retirement_reason`),
  };
}

function loadTrials(value: unknown, label: string): EvalCaseTrials | undefined {
  if (value === undefined) return undefined;
  const record = assertRecord(value, label);
  const count = assertNumber(record.count, `${label}.count`);
  const minPassRate = assertNumber(record.min_pass_rate, `${label}.min_pass_rate`);
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(`${label}.count must be a positive integer`);
  }
  if (minPassRate < 0 || minPassRate > 1) {
    throw new Error(`${label}.min_pass_rate must be between 0 and 1`);
  }
  return {
    count,
    min_pass_rate: minPassRate,
    reliability_metric: assertOptionalString(record.reliability_metric, `${label}.reliability_metric`),
  };
}

function normalizeStringArray(values: string[]): string[] {
  return [...new Set(values.map((entry) => entry.trim()).filter(Boolean))].sort();
}

function compareCountDesc<T extends { count: number }>(left: T, right: T): number {
  if (right.count !== left.count) {
    return right.count - left.count;
  }
  return JSON.stringify(left).localeCompare(JSON.stringify(right));
}

function countMap(values: string[]): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort(compareCountDesc);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function loadEvalDataset(filePath: string): EvalDatasetFile {
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  const record = assertRecord(payload, filePath);
  if (record.schema !== EVAL_DATASET_SCHEMA) {
    throw new Error(`${filePath}.schema must be ${EVAL_DATASET_SCHEMA}`);
  }
  const itemsRaw = record.items;
  if (!Array.isArray(itemsRaw)) {
    throw new Error(`${filePath}.items must be an array`);
  }
  const items = itemsRaw.map((rawItem, index) => {
    const item = assertRecord(rawItem, `${filePath}.items[${index}]`);
    return {
      id: assertString(item.id, `${filePath}.items[${index}].id`),
      skill_id: assertString(item.skill_id, `${filePath}.items[${index}].skill_id`),
      prompt: assertString(item.prompt, `${filePath}.items[${index}].prompt`),
      expected_outcome: assertString(item.expected_outcome, `${filePath}.items[${index}].expected_outcome`),
      notes_for_human_review: assertString(item.notes_for_human_review ?? "-", `${filePath}.items[${index}].notes_for_human_review`),
      reference_output: item.reference_output ? assertString(item.reference_output, `${filePath}.items[${index}].reference_output`) : undefined,
      reference_state: item.reference_state ? assertRecord(item.reference_state, `${filePath}.items[${index}].reference_state`) : undefined,
      allowed_tools: normalizeStringArray(assertStringArray(item.allowed_tools ?? [], `${filePath}.items[${index}].allowed_tools`)),
      expected_tools: normalizeStringArray(assertStringArray(item.expected_tools ?? [], `${filePath}.items[${index}].expected_tools`)),
      tags: normalizeStringArray(assertStringArray(item.tags ?? [], `${filePath}.items[${index}].tags`)),
      risk_tags: normalizeStringArray(assertStringArray(item.risk_tags ?? [], `${filePath}.items[${index}].risk_tags`)),
      dimensions: normalizeStringArray(assertStringArray(item.dimensions ?? [], `${filePath}.items[${index}].dimensions`)),
      goal_dimensions: normalizeStringArray(assertStringArray(item.goal_dimensions ?? [], `${filePath}.items[${index}].goal_dimensions`)),
      polarity: item.polarity === undefined
        ? undefined
        : assertEnum(item.polarity, `${filePath}.items[${index}].polarity`, ["should", "should_not"] as const),
      success_evidence: normalizeStringArray(assertStringArray(item.success_evidence ?? [], `${filePath}.items[${index}].success_evidence`)),
      guard_ids: normalizeStringArray(assertStringArray(item.guard_ids ?? [], `${filePath}.items[${index}].guard_ids`)),
      provenance: loadProvenance(item.provenance, `${filePath}.items[${index}].provenance`),
      privacy: loadPrivacy(item.privacy, `${filePath}.items[${index}].privacy`),
      grader: loadGrader(item.grader, `${filePath}.items[${index}].grader`),
      lifecycle: loadLifecycle(item.lifecycle, `${filePath}.items[${index}].lifecycle`),
      trials: loadTrials(item.trials, `${filePath}.items[${index}].trials`),
      split: assertOptionalString(item.split, `${filePath}.items[${index}].split`),
      metadata: item.metadata ? assertRecord(item.metadata, `${filePath}.items[${index}].metadata`) : undefined,
    } satisfies EvalDatasetItem;
  });

  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) {
      throw new Error(`${filePath}.items has duplicate id: ${item.id}`);
    }
    ids.add(item.id);
  }

  return {
    schema: EVAL_DATASET_SCHEMA,
    dataset_id: assertString(record.dataset_id, `${filePath}.dataset_id`),
    title: assertString(record.title, `${filePath}.title`),
    description: assertString(record.description, `${filePath}.description`),
    item_schema: assertString(record.item_schema, `${filePath}.item_schema`),
    build: record.build ? (assertRecord(record.build, `${filePath}.build`) as EvalDatasetBuildMeta) : undefined,
    items,
  };
}

export function buildEvalDataset(
  input: EvalDatasetFile,
  options: {
    baselineSplit: string;
    holdoutSplit: string;
    holdoutRatio: number;
    holdoutTags: string[];
    seed: string;
  },
): EvalDatasetFile {
  const holdoutTagSet = new Set(options.holdoutTags);
  const items = input.items.map((item) => {
    if (item.split) {
      return item;
    }
    const taggedHoldout = [...(item.tags ?? []), ...(item.risk_tags ?? [])].some((tag) => holdoutTagSet.has(tag));
    if (taggedHoldout) {
      return { ...item, split: options.holdoutSplit };
    }
    const bucket = hashString(`${options.seed}:${input.dataset_id}:${item.id}`) / 0xffffffff;
    return {
      ...item,
      split: bucket < options.holdoutRatio ? options.holdoutSplit : options.baselineSplit,
    };
  });
  return {
    ...input,
    build: {
      baseline_split: options.baselineSplit,
      holdout_split: options.holdoutSplit,
      holdout_ratio: options.holdoutRatio,
      holdout_tags: [...options.holdoutTags].sort(),
      seed: options.seed,
    },
    items,
  };
}

export function exportEvalDatasetSplit(input: EvalDatasetFile, split: string): EvalDatasetFile {
  return {
    ...input,
    items: input.items.filter((item) => item.split === split),
  };
}

export function reportEvalDataset(input: EvalDatasetFile): EvalDatasetReport {
  const splitCounts = countMap(input.items.flatMap((item) => (item.split ? [item.split] : []))).map(({ label, count }) => ({
    split: label,
    count,
  }));
  const skillCounts = countMap(input.items.map((item) => item.skill_id)).map(({ label, count }) => ({
    skill_id: label,
    count,
  }));
  const tagCounts = countMap(input.items.flatMap((item) => item.tags ?? [])).map(({ label, count }) => ({
    tag: label,
    count,
  }));
  const riskTagCounts = countMap(input.items.flatMap((item) => item.risk_tags ?? [])).map(({ label, count }) => ({
    tag: label,
    count,
  }));
  const dimensionCounts = countMap(input.items.flatMap((item) => item.dimensions ?? [])).map(({ label, count }) => ({
    dimension: label,
    count,
  }));
  const polarityCounts = countMap(input.items.flatMap((item) => item.polarity ? [item.polarity] : [])).map(({ label, count }) => ({ polarity: label, count }));
  const lifecycleCounts = countMap(input.items.flatMap((item) => item.lifecycle ? [item.lifecycle.stage] : [])).map(({ label, count }) => ({ stage: label, count }));
  const graderCounts = countMap(input.items.flatMap((item) => item.grader ? [item.grader.type] : [])).map(({ label, count }) => ({ grader_type: label, count }));
  const provenanceCounts = countMap(input.items.flatMap((item) => item.provenance ? [item.provenance.source_class] : [])).map(({ label, count }) => ({ source_class: label, count }));
  const privacyCounts = countMap(input.items.flatMap((item) => item.privacy ? [item.privacy.class] : [])).map(({ label, count }) => ({ privacy_class: label, count }));
  return {
    schema: "bagakit.eval-dataset-report/v1",
    dataset_id: input.dataset_id,
    title: input.title,
    totals: {
      items: input.items.length,
      with_split: input.items.filter((item) => !!item.split).length,
      without_split: input.items.filter((item) => !item.split).length,
    },
    splits: splitCounts,
    skills: skillCounts,
    tags: tagCounts,
    risk_tags: riskTagCounts,
    dimensions: dimensionCounts,
    polarities: polarityCounts,
    lifecycle_stages: lifecycleCounts,
    grader_types: graderCounts,
    provenance_classes: provenanceCounts,
    privacy_classes: privacyCounts,
  };
}

export function validateGoalCaseContracts(input: EvalDatasetFile): void {
  for (const item of input.items) {
    const label = `${input.dataset_id}:${item.id}`;
    if ((item.goal_dimensions ?? []).length === 0) {
      throw new Error(`${label} must declare goal_dimensions`);
    }
    if (!item.polarity) {
      throw new Error(`${label} must declare polarity`);
    }
    if ((item.success_evidence ?? []).length === 0) {
      throw new Error(`${label} must declare success_evidence`);
    }
    if ((item.guard_ids ?? []).length === 0) {
      throw new Error(`${label} must declare guard_ids`);
    }
    if (!item.provenance) {
      throw new Error(`${label} must declare provenance`);
    }
    if (!item.privacy) {
      throw new Error(`${label} must declare privacy`);
    }
    if (item.privacy.raw_transcript_included) {
      throw new Error(`${label} must not include raw private transcripts`);
    }
    if (item.privacy.class !== "private_local" && !item.privacy.sanitized) {
      throw new Error(`${label} shared cases must be sanitized`);
    }
    if (!item.grader) {
      throw new Error(`${label} must declare grader`);
    }
    if (
      item.grader.type === "model_rubric" &&
      (item.grader.calibration_status !== "calibrated" || (item.grader.calibration_evidence ?? []).length === 0)
    ) {
      throw new Error(`${label} model_rubric grader must be calibrated with evidence`);
    }
    if (!item.lifecycle) {
      throw new Error(`${label} must declare lifecycle`);
    }
    if (item.lifecycle.stage === "graduated_regression" && !item.lifecycle.regression_ref) {
      throw new Error(`${label} graduated_regression must declare regression_ref`);
    }
    if (item.lifecycle.stage === "retired" && !item.lifecycle.retirement_reason) {
      throw new Error(`${label} retired case must declare retirement_reason`);
    }
    if (!item.trials) {
      throw new Error(`${label} must declare trials`);
    }
  }
}

export function writeEvalDataset(filePath: string, dataset: EvalDatasetFile | Record<string, unknown>): void {
  fs.writeFileSync(filePath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
}
