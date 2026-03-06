import path from "node:path";

import {
  ensureCleanOutputDir,
  ensureDir,
  environmentSnapshot,
  repoRelative,
  sanitizeError,
  sanitizeUnknown,
  utcRunId,
  writeJson,
  type Replacement,
} from "./io.ts";
import type { EvalCaseContext, EvalCaseDefinition, EvalCaseReport, EvalSuiteDefinition } from "./model.ts";

export interface RunOptions {
  repoRoot: string;
  outputDir?: string;
  selectedCaseIds: string[];
  keepTemp: boolean;
  commandSummary: string;
}

export function listCases(suite: EvalSuiteDefinition): string[] {
  return suite.cases.map((entry) => `${entry.id}\t${entry.title}`);
}

function focusIndex(caseReports: EvalCaseReport[]): Record<string, { passed: number; failed: number; cases: string[] }> {
  const index: Record<string, { passed: number; failed: number; cases: string[] }> = {};
  for (const report of caseReports) {
    for (const focus of report.focus) {
      if (!index[focus]) {
        index[focus] = { passed: 0, failed: 0, cases: [] };
      }
      index[focus].cases.push(report.id);
      if (report.status === "pass") {
        index[focus].passed += 1;
      } else {
        index[focus].failed += 1;
      }
    }
  }
  return index;
}

async function runCase(
  suite: EvalSuiteDefinition,
  runId: string,
  context: EvalCaseContext,
  caseDef: EvalCaseDefinition,
): Promise<EvalCaseReport> {
  const startedAt = Date.now();
  const contextReplacements: Replacement[] = [];
  try {
    const result = await caseDef.run({
      ...context,
      addReplacement: (from: string, to: string) => {
        contextReplacements.push({ from, to });
      },
    });
    const replacements = [...contextReplacements, ...(result.replacements ?? [])];
    const artifacts = (result.artifacts ?? []).map((entry) => ({
      ...entry,
      path: String(sanitizeUnknown(entry.path, replacements)),
      note: entry.note ? String(sanitizeUnknown(entry.note, replacements)) : undefined,
    }));
    return {
      schema: "bagakit.eval-case/v1",
      suiteId: suite.id,
      runId,
      id: caseDef.id,
      title: caseDef.title,
      summary: caseDef.summary,
      status: "pass",
      focus: [...caseDef.focus],
      durationMs: Date.now() - startedAt,
      assertions: (sanitizeUnknown(result.assertions ?? [], replacements) as string[]) ?? [],
      warnings: (sanitizeUnknown(result.warnings ?? [], replacements) as string[]) ?? [],
      commands: (sanitizeUnknown(result.commands ?? [], replacements) as string[]) ?? [],
      artifacts,
      outputs: sanitizeUnknown(result.outputs, replacements) as Record<string, unknown> | undefined,
    };
  } catch (error) {
    const replacements = [...contextReplacements];
    return {
      schema: "bagakit.eval-case/v1",
      suiteId: suite.id,
      runId,
      id: caseDef.id,
      title: caseDef.title,
      summary: caseDef.summary,
      status: "fail",
      focus: [...caseDef.focus],
      durationMs: Date.now() - startedAt,
      assertions: [],
      warnings: [],
      commands: [],
      artifacts: [],
      error: sanitizeError(error, replacements),
    };
  }
}

export async function runSuite(suite: EvalSuiteDefinition, options: RunOptions): Promise<number> {
  const selectedCases =
    options.selectedCaseIds.length === 0
      ? suite.cases
      : suite.cases.filter((entry) => options.selectedCaseIds.includes(entry.id));
  const missing = options.selectedCaseIds.filter((id) => !suite.cases.some((entry) => entry.id === id));
  if (missing.length > 0) {
    throw new Error(`unknown eval case id: ${missing.join(", ")}`);
  }

  const runId = utcRunId();
  const outputDir = options.outputDir
    ? path.resolve(options.repoRoot, options.outputDir)
    : path.resolve(options.repoRoot, suite.defaultOutputDir, runId);
  ensureCleanOutputDir(outputDir);

  const startedAt = Date.now();
  const caseReports: EvalCaseReport[] = [];
  const caseOutputDir = path.join(outputDir, "cases");
  ensureDir(caseOutputDir);

  for (const caseDef of selectedCases) {
    const report = await runCase(suite, runId, {
      repoRoot: options.repoRoot,
      runId,
      suiteId: suite.id,
      keepTemp: options.keepTemp,
      addReplacement: () => {},
    }, caseDef);
    caseReports.push(report);
    writeJson(path.join(caseOutputDir, `${caseDef.id}.json`), report);
  }

  const passedCases = caseReports.filter((entry) => entry.status === "pass").length;
  const failedCases = caseReports.length - passedCases;
  const summary = {
    schema: "bagakit.eval-run/v1",
    suiteId: suite.id,
    owner: suite.owner,
    title: suite.title,
    summary: suite.summary,
    nonGating: true,
    runId,
    generatedAtUtc: new Date().toISOString(),
    outputDir: repoRelative(options.repoRoot, outputDir),
    command: options.commandSummary,
    environment: environmentSnapshot(),
    totals: {
      cases: caseReports.length,
      passedCases,
      failedCases,
      durationMs: Date.now() - startedAt,
    },
    focusIndex: focusIndex(caseReports),
    cases: caseReports.map((entry) => ({
      id: entry.id,
      title: entry.title,
      status: entry.status,
      focus: entry.focus,
      reportPath: `cases/${entry.id}.json`,
    })),
  };
  writeJson(path.join(outputDir, "summary.json"), summary);

  console.log(`${suite.id} eval (non-gating)`);
  console.log(`results\t${repoRelative(options.repoRoot, outputDir)}`);
  console.log(`cases\t${passedCases} of ${caseReports.length} passed`);
  for (const report of caseReports) {
    console.log(`- ${report.id}\t${report.status}\t${report.focus.join(",")}`);
    if (report.status === "fail" && report.error) {
      console.log(`  ${report.error}`);
    }
  }

  return failedCases === 0 ? 0 : 1;
}
