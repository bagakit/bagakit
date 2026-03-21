import type { SuiteConfig, ValidationClass } from "./model.ts";

export type SuiteRunOutcome = "passed" | "failed" | "skipped";

export interface SuiteTimingRecord {
  suiteId: string;
  owner: string;
  runnerKind: string;
  validationClass: ValidationClass;
  groups: string[];
  outcome: SuiteRunOutcome;
  durationMs: number;
}

export interface TimingSummaryOptions {
  totalWallMs?: number;
  executionModeLabel?: string;
}

export function nowTick(): bigint {
  return process.hrtime.bigint();
}

export function elapsedMs(start: bigint, end: bigint = nowTick()): number {
  return Number(end - start) / 1_000_000;
}

function roundMs(value: number): string {
  return `${Math.round(value)}ms`;
}

function formatCount(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function aggregateByValidationClass(records: SuiteTimingRecord[]): Array<{
  validationClass: ValidationClass;
  suiteCount: number;
  totalMs: number;
}> {
  const totals = new Map<ValidationClass, { suiteCount: number; totalMs: number }>();
  for (const record of records) {
    const current = totals.get(record.validationClass) ?? { suiteCount: 0, totalMs: 0 };
    current.suiteCount += 1;
    current.totalMs += record.durationMs;
    totals.set(record.validationClass, current);
  }
  return [...totals.entries()]
    .map(([validationClass, value]) => ({
      validationClass,
      suiteCount: value.suiteCount,
      totalMs: value.totalMs,
    }))
    .sort((left, right) => right.totalMs - left.totalMs || left.validationClass.localeCompare(right.validationClass));
}

function aggregateByGroup(records: SuiteTimingRecord[]): Array<{
  group: string;
  suiteCount: number;
  totalMs: number;
}> {
  const totals = new Map<string, { suiteCount: number; totalMs: number }>();
  for (const record of records) {
    for (const group of record.groups) {
      const current = totals.get(group) ?? { suiteCount: 0, totalMs: 0 };
      current.suiteCount += 1;
      current.totalMs += record.durationMs;
      totals.set(group, current);
    }
  }
  return [...totals.entries()]
    .map(([group, value]) => ({
      group,
      suiteCount: value.suiteCount,
      totalMs: value.totalMs,
    }))
    .sort((left, right) => right.totalMs - left.totalMs || left.group.localeCompare(right.group));
}

export function renderTimingSummary(
  records: SuiteTimingRecord[],
  options: TimingSummaryOptions = {},
): string[] {
  if (records.length === 0) {
    return ["Timing summary: no suites executed."];
  }
  const sorted = [...records].sort(
    (left, right) =>
      right.durationMs - left.durationMs ||
      left.suiteId.localeCompare(right.suiteId),
  );
  const suiteLines = [
    "Timing summary:",
    ...(options.totalWallMs !== undefined ? [`- total wall time: ${roundMs(options.totalWallMs)}`] : []),
    ...(options.executionModeLabel ? [`- execution mode: ${options.executionModeLabel}`] : []),
    "- executed suite timings (slowest first):",
    ...sorted.map(
      (record) =>
        `  - ${record.suiteId} | ${record.outcome} | ${roundMs(record.durationMs)} | class=${record.validationClass} | owner=${record.owner}`,
    ),
  ];

  const classLines = aggregateByValidationClass(records).map(
    (entry) => `  - ${entry.validationClass} | ${formatCount(entry.suiteCount, "suite")} | ${roundMs(entry.totalMs)}`,
  );
  const groupLines = aggregateByGroup(records).map(
    (entry) => `  - ${entry.group} | ${formatCount(entry.suiteCount, "suite")} | ${roundMs(entry.totalMs)}`,
  );

  return [
    ...suiteLines,
    "- validation_class totals:",
    ...(classLines.length > 0 ? classLines : ["  - none"]),
    "- group totals (overlapping membership):",
    ...(groupLines.length > 0 ? groupLines : ["  - none"]),
  ];
}

export function suiteTimingRecord(
  suite: SuiteConfig,
  outcome: SuiteRunOutcome,
  durationMs: number,
): SuiteTimingRecord {
  return {
    suiteId: suite.id,
    owner: suite.owner,
    runnerKind: suite.runner.kind,
    validationClass: suite.validationClass,
    groups: suite.groups,
    outcome,
    durationMs,
  };
}
