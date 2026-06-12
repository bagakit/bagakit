import type { Replacement } from "./io.ts";

export type EvalStatus = "pass" | "fail";

export interface EvalArtifact {
  label: string;
  path: string;
  note?: string;
}

export interface EvalCaseResult {
  assertions?: string[];
  warnings?: string[];
  commands?: string[];
  artifacts?: EvalArtifact[];
  outputs?: Record<string, unknown>;
  replacements?: Replacement[];
}

export interface EvalCaseContext {
  repoRoot: string;
  runId: string;
  suiteId: string;
  keepTemp: boolean;
  signal: AbortSignal;
  addReplacement: (from: string, to: string) => void;
}

export interface EvalCaseDefinition {
  id: string;
  title: string;
  summary: string;
  focus: string[];
  timeoutMs?: number;
  run: (context: EvalCaseContext) => EvalCaseResult | Promise<EvalCaseResult>;
}

export interface EvalSuiteDefinition {
  id: string;
  owner: string;
  title: string;
  summary: string;
  defaultOutputDir: string;
  caseTimeoutMs?: number;
  cases: EvalCaseDefinition[];
}

export interface EvalCaseReport {
  schema: "bagakit.eval-case/v1";
  suiteId: string;
  runId: string;
  id: string;
  title: string;
  summary: string;
  status: EvalStatus;
  focus: string[];
  durationMs: number;
  assertions: string[];
  warnings: string[];
  commands: string[];
  artifacts: EvalArtifact[];
  outputs?: Record<string, unknown>;
  error?: string;
  trialExecution?: EvalTrialExecutionReport;
}

export interface EvalTrialRequest {
  count: number;
  min_pass_rate: number;
  reliability_metric?: string;
}

export interface EvalTrialExecutionReport {
  status: "not_requested" | "declared_not_executed";
  executedTrials: number;
  requestedTrials?: number;
  minPassRate?: number;
  reliabilityMetric?: string;
  note: string;
}

export function validateEvalSuite(value: unknown, label = "suite"): EvalSuiteDefinition {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const suite = value as Record<string, unknown>;
  for (const key of ["id", "owner", "title", "summary", "defaultOutputDir"]) {
    if (typeof suite[key] !== "string" || !(suite[key] as string).trim()) throw new Error(`${label}.${key} must be a non-empty string`);
  }
  const defaultOutputDir = suite.defaultOutputDir as string;
  if (defaultOutputDir.startsWith("/") || defaultOutputDir.split("/").includes("..")) {
    throw new Error(`${label}.defaultOutputDir must be repository-relative`);
  }
  if (suite.caseTimeoutMs !== undefined && (!Number.isInteger(suite.caseTimeoutMs) || (suite.caseTimeoutMs as number) <= 0)) {
    throw new Error(`${label}.caseTimeoutMs must be a positive integer`);
  }
  if (!Array.isArray(suite.cases) || suite.cases.length === 0) throw new Error(`${label}.cases must be a non-empty array`);
  const ids = new Set<string>();
  for (const [index, rawCase] of suite.cases.entries()) {
    if (!rawCase || typeof rawCase !== "object" || Array.isArray(rawCase)) throw new Error(`${label}.cases[${index}] must be an object`);
    const entry = rawCase as Record<string, unknown>;
    for (const key of ["id", "title", "summary"]) {
      if (typeof entry[key] !== "string" || !(entry[key] as string).trim()) throw new Error(`${label}.cases[${index}].${key} must be a non-empty string`);
    }
    if (ids.has(entry.id as string)) throw new Error(`${label}.cases contains duplicate id: ${entry.id}`);
    ids.add(entry.id as string);
    if (!Array.isArray(entry.focus) || entry.focus.some((focus) => typeof focus !== "string" || !focus.trim())) throw new Error(`${label}.cases[${index}].focus must be an array of non-empty strings`);
    if (typeof entry.run !== "function") throw new Error(`${label}.cases[${index}].run must be a function`);
    if (entry.timeoutMs !== undefined && (!Number.isInteger(entry.timeoutMs) || (entry.timeoutMs as number) <= 0)) throw new Error(`${label}.cases[${index}].timeoutMs must be a positive integer`);
  }
  return value as EvalSuiteDefinition;
}
