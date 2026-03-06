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
}

export interface EvalCaseDefinition {
  id: string;
  title: string;
  summary: string;
  focus: string[];
  run: (context: EvalCaseContext) => EvalCaseResult | Promise<EvalCaseResult>;
}

export interface EvalSuiteDefinition {
  id: string;
  owner: string;
  title: string;
  summary: string;
  defaultOutputDir: string;
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
}
