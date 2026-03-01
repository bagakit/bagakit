export const VALIDATION_CLASSES = [
  "structure",
  "policy",
  "tooling",
  "contract",
  "state",
  "smoke",
  "quality",
] as const;

export type ValidationClass = (typeof VALIDATION_CLASSES)[number];

export const PROCESS_RUNNER_KINDS = [
  "argv",
  "python_script",
  "bash_script",
  "executable",
] as const;

export type ProcessRunnerKind = (typeof PROCESS_RUNNER_KINDS)[number];

export const RUNNER_KINDS = ["fs", ...PROCESS_RUNNER_KINDS] as const;

export type RunnerKind = (typeof RUNNER_KINDS)[number];

export interface RootConfig {
  version: 2;
  configPath: string;
  discoveryRoots: string[];
  skipAliases: SkipAlias[];
}

export interface SkipAlias {
  id: string;
  selectors: string[];
  description: string;
  configPath: string;
}

interface SuiteBase {
  id: string;
  owner: string;
  description: string;
  configPath: string;
  defaultInGate: boolean;
  validationClass: ValidationClass;
  groups: string[];
  params: Record<string, string[]>;
  defaultParams: string[];
}

export interface FileSystemRunner {
  kind: "fs";
  requiredDirs: string[];
  requiredFiles: string[];
  forbiddenPaths: string[];
}

interface ProcessRunnerBase {
  cwd: string;
}

export interface ArgvRunner extends ProcessRunnerBase {
  kind: "argv";
  command: string[];
  defaultArgs: string[];
}

export interface PythonScriptRunner extends ProcessRunnerBase {
  kind: "python_script";
  script: string;
  args: string[];
}

export interface BashScriptRunner extends ProcessRunnerBase {
  kind: "bash_script";
  script: string;
  args: string[];
}

export interface ExecutableRunner extends ProcessRunnerBase {
  kind: "executable";
  command: string;
  args: string[];
}

export type ProcessRunner =
  | ArgvRunner
  | PythonScriptRunner
  | BashScriptRunner
  | ExecutableRunner;

export type RunnerConfig = FileSystemRunner | ProcessRunner;

export interface ValidationSuite extends SuiteBase {
  runner: RunnerConfig;
}

export type SuiteConfig = ValidationSuite;

export interface LoadedProject {
  repoRoot: string;
  rootConfigPath: string;
  discoveryRoots: string[];
  suites: SuiteConfig[];
  suitesById: Map<string, SuiteConfig>;
  suitesByGroup: Map<string, SuiteConfig[]>;
  defaultGate: SuiteConfig[];
  skipAliases: SkipAlias[];
  skipAliasesById: Map<string, SkipAlias>;
}
