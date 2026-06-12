import fs from "node:fs";

export interface EvalRunSummary {
  schema: string;
  suiteId: string;
  owner: string;
  title: string;
  runId: string;
  totals: {
    cases: number;
    passedCases: number;
    failedCases: number;
    durationMs: number;
  };
  focusIndex?: Record<string, { passed: number; failed: number; cases: string[] }>;
  cases: Array<{ id: string; status: "pass" | "fail" }>;
}

export interface EvalRunComparison {
  schema: "bagakit.eval-run-comparison/v1";
  baseline: {
    suiteId: string;
    runId: string;
    passedCases: number;
    failedCases: number;
  };
  candidate: {
    suiteId: string;
    runId: string;
    passedCases: number;
    failedCases: number;
  };
  holdout?: {
    suiteId: string;
    runId: string;
    passedCases: number;
    failedCases: number;
  };
  delta: {
    passedCases: number;
    failedCases: number;
  };
  focusDelta: Record<string, {
    baselinePassed: number;
    candidatePassed: number;
    deltaPassed: number;
    baselineFailed: number;
    candidateFailed: number;
    deltaFailed: number;
  }>;
}

function loadSummary(filePath: string): EvalRunSummary {
  let value: unknown;
  try {
    value = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  } catch (error) {
    throw new Error(`invalid eval summary ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${filePath} must contain an object`);
  const summary = value as Record<string, unknown>;
  if (summary.schema !== "bagakit.eval-run/v1") throw new Error(`${filePath}.schema must be bagakit.eval-run/v1`);
  if (typeof summary.suiteId !== "string" || !summary.suiteId) throw new Error(`${filePath}.suiteId must be a non-empty string`);
  if (typeof summary.runId !== "string" || !summary.runId) throw new Error(`${filePath}.runId must be a non-empty string`);
  const totals = summary.totals;
  if (!totals || typeof totals !== "object" || Array.isArray(totals)) throw new Error(`${filePath}.totals must be an object`);
  const counts = totals as Record<string, unknown>;
  for (const key of ["cases", "passedCases", "failedCases"]) {
    if (!Number.isInteger(counts[key]) || (counts[key] as number) < 0) throw new Error(`${filePath}.totals.${key} must be a non-negative integer`);
  }
  if ((counts.passedCases as number) + (counts.failedCases as number) !== counts.cases) throw new Error(`${filePath}.totals cases must equal passedCases + failedCases`);
  const caseIds = validateCases(summary.cases, filePath);
  if (caseIds.size !== counts.cases) throw new Error(`${filePath}.cases length must equal totals.cases`);
  const cases = summary.cases as EvalRunSummary["cases"];
  if (cases.filter(entry => entry.status === "pass").length !== counts.passedCases) throw new Error(`${filePath}.cases statuses must match totals`);
  validateFocusIndex(summary.focusIndex, counts.cases as number, caseIds, filePath);
  return summary as unknown as EvalRunSummary;
}

function validateCases(value: unknown, filePath: string): Set<string> {
  if (!Array.isArray(value)) throw new Error(`${filePath}.cases must be an array for eval-run/v1`);
  const ids = new Set<string>();
  for (const [index, entry] of value.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`${filePath}.cases[${index}] must be an object`);
    const id = (entry as Record<string, unknown>).id;
    if (typeof id !== "string" || !id.trim()) throw new Error(`${filePath}.cases[${index}].id must be a non-empty string`);
    if (ids.has(id)) throw new Error(`${filePath}.cases contains duplicate id: ${id}`);
    const status = (entry as Record<string, unknown>).status;
    if (status !== "pass" && status !== "fail") throw new Error(`${filePath}.cases[${index}].status must be pass or fail`);
    ids.add(id);
  }
  return ids;
}

function validateFocusIndex(
  value: unknown,
  totalCases: number,
  caseIds: Set<string> | undefined,
  filePath: string,
): void {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${filePath}.focusIndex must be an object`);
  for (const [focus, rawEntry] of Object.entries(value as Record<string, unknown>)) {
    if (!focus.trim() || !rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
      throw new Error(`${filePath}.focusIndex.${focus} must be an object`);
    }
    const entry = rawEntry as Record<string, unknown>;
    for (const key of ["passed", "failed"]) {
      if (!Number.isInteger(entry[key]) || (entry[key] as number) < 0) throw new Error(`${filePath}.focusIndex.${focus}.${key} must be a non-negative integer`);
    }
    if (!Array.isArray(entry.cases) || entry.cases.some((id) => typeof id !== "string" || !id.trim())) throw new Error(`${filePath}.focusIndex.${focus}.cases must be an array of non-empty IDs`);
    const ids = entry.cases as string[];
    if (new Set(ids).size !== ids.length) throw new Error(`${filePath}.focusIndex.${focus}.cases must contain unique IDs`);
    if ((entry.passed as number) + (entry.failed as number) !== ids.length) throw new Error(`${filePath}.focusIndex.${focus} passed + failed must equal cases.length`);
    if (ids.length > totalCases) throw new Error(`${filePath}.focusIndex.${focus}.cases cannot exceed totals.cases`);
    if (caseIds && ids.some((id) => !caseIds.has(id))) throw new Error(`${filePath}.focusIndex.${focus} references an unknown case ID`);
  }
}

export function compareRunSummaries(
  baselinePath: string,
  candidatePath: string,
  holdoutPath?: string,
): EvalRunComparison {
  const baseline = loadSummary(baselinePath);
  const candidate = loadSummary(candidatePath);
  const holdout = holdoutPath ? loadSummary(holdoutPath) : undefined;
  if (baseline.suiteId !== candidate.suiteId) throw new Error(`baseline and candidate suites differ: ${baseline.suiteId} vs ${candidate.suiteId}`);
  if (holdout && holdout.suiteId !== baseline.suiteId) throw new Error(`holdout suite differs: ${holdout.suiteId} vs ${baseline.suiteId}`);
  {
    const baselineIds = baseline.cases.map((entry) => entry.id).sort();
    const candidateIds = candidate.cases.map((entry) => entry.id).sort();
    if (JSON.stringify(baselineIds) !== JSON.stringify(candidateIds)) throw new Error("baseline and candidate case universes differ");
  }
  const focusKeys = new Set<string>([
    ...Object.keys(baseline.focusIndex ?? {}),
    ...Object.keys(candidate.focusIndex ?? {}),
  ]);
  const focusDelta = Object.fromEntries(
    [...focusKeys].sort().map((focus) => {
      const baselineEntry = baseline.focusIndex?.[focus] ?? { passed: 0, failed: 0, cases: [] };
      const candidateEntry = candidate.focusIndex?.[focus] ?? { passed: 0, failed: 0, cases: [] };
      return [
        focus,
        {
          baselinePassed: baselineEntry.passed,
          candidatePassed: candidateEntry.passed,
          deltaPassed: candidateEntry.passed - baselineEntry.passed,
          baselineFailed: baselineEntry.failed,
          candidateFailed: candidateEntry.failed,
          deltaFailed: candidateEntry.failed - baselineEntry.failed,
        },
      ];
    }),
  );
  return {
    schema: "bagakit.eval-run-comparison/v1",
    baseline: {
      suiteId: baseline.suiteId,
      runId: baseline.runId,
      passedCases: baseline.totals.passedCases,
      failedCases: baseline.totals.failedCases,
    },
    candidate: {
      suiteId: candidate.suiteId,
      runId: candidate.runId,
      passedCases: candidate.totals.passedCases,
      failedCases: candidate.totals.failedCases,
    },
    holdout: holdout
      ? {
          suiteId: holdout.suiteId,
          runId: holdout.runId,
          passedCases: holdout.totals.passedCases,
          failedCases: holdout.totals.failedCases,
        }
      : undefined,
    delta: {
      passedCases: candidate.totals.passedCases - baseline.totals.passedCases,
      failedCases: candidate.totals.failedCases - baseline.totals.failedCases,
    },
    focusDelta,
  };
}
