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
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as EvalRunSummary;
}

export function compareRunSummaries(
  baselinePath: string,
  candidatePath: string,
  holdoutPath?: string,
): EvalRunComparison {
  const baseline = loadSummary(baselinePath);
  const candidate = loadSummary(candidatePath);
  const holdout = holdoutPath ? loadSummary(holdoutPath) : undefined;
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
