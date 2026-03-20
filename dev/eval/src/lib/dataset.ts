import fs from "node:fs";

export const EVAL_DATASET_SCHEMA = "bagakit.eval-dataset/v1";

export interface EvalDatasetBuildMeta {
  baseline_split: string;
  holdout_split: string;
  holdout_ratio: number;
  holdout_tags: string[];
  seed: string;
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
  };
}

export function writeEvalDataset(filePath: string, dataset: EvalDatasetFile | Record<string, unknown>): void {
  fs.writeFileSync(filePath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
}
