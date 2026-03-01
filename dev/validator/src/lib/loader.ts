import fs from "node:fs";
import path from "node:path";

import {
  PROCESS_RUNNER_KINDS,
  RUNNER_KINDS,
  VALIDATION_CLASSES,
} from "./model.ts";
import type {
  ArgvRunner,
  BashScriptRunner,
  ExecutableRunner,
  FileSystemRunner,
  LoadedProject,
  ProcessRunner,
  PythonScriptRunner,
  RootConfig,
  SkipAlias,
  SuiteConfig,
  ValidationClass,
} from "./model.ts";
import { parseTomlFile } from "./toml.ts";

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a TOML table`);
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function readBoolean(value: unknown, label: string, fallback = false): boolean {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean when present`);
  }
  return value;
}

function readStringArray(value: unknown, label: string, fallback: string[] = []): string[] {
  if (value === undefined) {
    return [...fallback];
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label} must be an array of non-empty strings`);
  }
  return [...value];
}

function uniqueStrings(values: string[], label: string): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    unique.push(value);
  }
  if (unique.some((value) => !value.trim())) {
    throw new Error(`${label} must not contain empty strings`);
  }
  return unique;
}

function readValidationClass(
  value: unknown,
  label: string,
  rawRunnerKind: unknown,
): ValidationClass {
  if (value === undefined) {
    return rawRunnerKind === "fs" ? "structure" : "tooling";
  }
  if (typeof value !== "string" || !VALIDATION_CLASSES.includes(value as ValidationClass)) {
    throw new Error(
      `${label} must be one of ${VALIDATION_CLASSES.map((item) => JSON.stringify(item)).join(", ")}`,
    );
  }
  return value as ValidationClass;
}

function readParams(value: unknown, label: string): Record<string, string[]> {
  if (value === undefined) {
    return {};
  }
  const table = assertRecord(value, label);
  const params: Record<string, string[]> = {};
  for (const [key, rawValue] of Object.entries(table).sort(([left], [right]) => left.localeCompare(right))) {
    if (!key.trim()) {
      throw new Error(`${label} contains an empty param key`);
    }
    params[key] = readStringArray(rawValue, `${label}.${key}`);
  }
  return params;
}

function loadRootSkipAliases(rawPayload: Record<string, unknown>, configPath: string): SkipAlias[] {
  const rawAliases = rawPayload.skip_alias ?? [];
  if (!Array.isArray(rawAliases)) {
    throw new Error(`${configPath}: [[skip_alias]] must decode to an array`);
  }

  return rawAliases.map((rawAlias, index) => {
    const alias = assertRecord(rawAlias, `${configPath} skip_alias[${index}]`);
    const selectors = uniqueStrings(
      readStringArray(alias.selectors, `${configPath} skip_alias.selectors`),
      `${configPath} skip_alias.selectors`,
    );
    if (selectors.length === 0) {
      throw new Error(`${configPath}: skip_alias ${index} must declare at least one selector`);
    }
    return {
      id: readString(alias.id, `${configPath} skip_alias.id`),
      selectors,
      description:
        alias.description === undefined
          ? ""
          : readString(alias.description, `${configPath} skip_alias.description`),
      configPath,
    };
  });
}

function loadRootConfig(configPath: string): RootConfig {
  const payload = assertRecord(parseTomlFile(configPath), configPath);
  const version = payload.version;
  if (version === undefined) {
    throw new Error(`${configPath}: config must declare version = 2`);
  }
  if (version !== 2) {
    throw new Error(`${configPath}: unsupported config version ${String(version)} (expected 2)`);
  }

  const project = assertRecord(payload.project ?? {}, `${configPath} [project]`);
  const discoveryRoots = readStringArray(project.discovery_roots, `${configPath} project.discovery_roots`);
  if (discoveryRoots.length === 0) {
    throw new Error(`${configPath}: project.discovery_roots must not be empty`);
  }

  return {
    version: 2,
    configPath: path.resolve(configPath),
    discoveryRoots,
    skipAliases: loadRootSkipAliases(payload, configPath),
  };
}

function walkValidationFiles(dirPath: string): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();

  const found: string[] = [];
  for (const fileName of files) {
    if (fileName === "validation.toml") {
      found.push(path.join(dirPath, fileName));
    }
  }
  for (const dirName of dirs) {
    found.push(...walkValidationFiles(path.join(dirPath, dirName)));
  }
  return found;
}

function discoverSuiteConfigPaths(repoRoot: string, discoveryRoots: string[]): string[] {
  const found: string[] = [];
  for (const relRoot of discoveryRoots) {
    const absoluteRoot = path.resolve(repoRoot, relRoot);
    if (!fs.existsSync(absoluteRoot) || !fs.statSync(absoluteRoot).isDirectory()) {
      throw new Error(`discovery root does not exist or is not a directory: ${relRoot}`);
    }
    found.push(...walkValidationFiles(absoluteRoot));
  }
  return found;
}

function loadV2FileSystemRunner(raw: Record<string, unknown>, configPath: string): FileSystemRunner {
  const requiredDirs = readStringArray(raw.required_dirs, `${configPath} suite.runner.required_dirs`);
  const requiredFiles = readStringArray(raw.required_files, `${configPath} suite.runner.required_files`);
  const forbiddenPaths = readStringArray(raw.forbidden_paths, `${configPath} suite.runner.forbidden_paths`);
  if (requiredDirs.length === 0 && requiredFiles.length === 0 && forbiddenPaths.length === 0) {
    throw new Error(`${configPath}: fs runner must declare at least one path rule`);
  }
  return {
    kind: "fs",
    requiredDirs,
    requiredFiles,
    forbiddenPaths,
  };
}

function loadV2ProcessRunner(
  rawRunner: Record<string, unknown>,
  configPath: string,
): ProcessRunner {
  const rawKind = readString(rawRunner.kind, `${configPath} suite.runner.kind`);
  if (!RUNNER_KINDS.includes(rawKind as (typeof RUNNER_KINDS)[number])) {
    throw new Error(
      `${configPath}: runner kind must be one of ${RUNNER_KINDS.map((item) => JSON.stringify(item)).join(", ")}`,
    );
  }
  if (!PROCESS_RUNNER_KINDS.includes(rawKind as (typeof PROCESS_RUNNER_KINDS)[number])) {
    throw new Error(`${configPath}: runner kind ${JSON.stringify(rawKind)} is not a process runner`);
  }

  const cwd = rawRunner.cwd === undefined ? "{repo_root}" : readString(rawRunner.cwd, `${configPath} suite.runner.cwd`);
  const args = readStringArray(rawRunner.args, `${configPath} suite.runner.args`);

  if (rawKind === "argv") {
    const command = readStringArray(rawRunner.command, `${configPath} suite.runner.command`);
    if (command.length === 0) {
      throw new Error(`${configPath}: argv runner must declare a non-empty command`);
    }
    return {
      kind: "argv",
      command,
      cwd,
      defaultArgs: readStringArray(rawRunner.default_args, `${configPath} suite.runner.default_args`),
    };
  }

  if (rawKind === "python_script") {
    const runner: PythonScriptRunner = {
      kind: "python_script",
      script: readString(rawRunner.script, `${configPath} suite.runner.script`),
      args,
      cwd,
    };
    return runner;
  }

  if (rawKind === "bash_script") {
    const runner: BashScriptRunner = {
      kind: "bash_script",
      script: readString(rawRunner.script, `${configPath} suite.runner.script`),
      args,
      cwd,
    };
    return runner;
  }

  const runner: ExecutableRunner = {
    kind: "executable",
    command: readString(rawRunner.command, `${configPath} suite.runner.command`),
    args,
    cwd,
  };
  return runner;
}

function loadV2Runner(rawSuite: Record<string, unknown>, configPath: string): FileSystemRunner | ProcessRunner {
  const rawRunner = assertRecord(rawSuite.runner, `${configPath} [suite.runner]`);
  const rawKind = readString(rawRunner.kind, `${configPath} suite.runner.kind`);
  if (rawKind === "fs") {
    return loadV2FileSystemRunner(rawRunner, configPath);
  }
  return loadV2ProcessRunner(rawRunner, configPath);
}

function loadSuiteMetadata(
  rawSuite: Record<string, unknown>,
  configPath: string,
  rawRunnerKind: unknown,
): Omit<SuiteConfig, "runner"> {
  const groups = uniqueStrings(
    readStringArray(rawSuite.groups, `${configPath} suite.groups`),
    `${configPath} suite.groups`,
  );
  const params = readParams(rawSuite.params, `${configPath} suite.params`);
  const defaultParams = uniqueStrings(
    readStringArray(rawSuite.default_params, `${configPath} suite.default_params`),
    `${configPath} suite.default_params`,
  );

  for (const paramName of defaultParams) {
    if (!params[paramName]) {
      throw new Error(
        `${configPath}: suite ${readString(rawSuite.id, `${configPath} suite.id`)} references missing default param ${JSON.stringify(paramName)}`,
      );
    }
  }

  return {
    id: readString(rawSuite.id, `${configPath} suite.id`),
    owner: readString(rawSuite.owner, `${configPath} suite.owner`),
    description: readString(rawSuite.description, `${configPath} suite.description`),
    configPath,
    defaultInGate: readBoolean(rawSuite.default, `${configPath} suite.default`, false),
    validationClass: readValidationClass(
      rawSuite.validation_class,
      `${configPath} suite.validation_class`,
      rawRunnerKind,
    ),
    groups,
    params,
    defaultParams,
  };
}

function validateSuiteShape(suite: SuiteConfig): void {
  if (suite.runner.kind === "fs" && (Object.keys(suite.params).length > 0 || suite.defaultParams.length > 0)) {
    throw new Error(`suite ${suite.id} uses the fs runner and cannot declare params or default_params`);
  }
}

function loadSuitesFromFile(configPath: string): SuiteConfig[] {
  const payload = assertRecord(parseTomlFile(configPath), configPath);
  const version = payload.version;
  if (version === undefined) {
    throw new Error(`${configPath}: config must declare version = 2`);
  }
  if (version !== 2) {
    throw new Error(`${configPath}: unsupported config version ${String(version)} (expected 2)`);
  }

  const rawSuites = payload.suite ?? [];
  if (!Array.isArray(rawSuites)) {
    throw new Error(`${configPath}: [[suite]] must decode to an array`);
  }

  return rawSuites.map((rawSuite, index) => {
    const suiteTable = assertRecord(rawSuite, `${configPath} suite[${index}]`);
    const runner = loadV2Runner(suiteTable, configPath);
    const suite: SuiteConfig = {
      ...loadSuiteMetadata(
        suiteTable,
        configPath,
        runner.kind,
      ),
      runner,
    };
    validateSuiteShape(suite);
    return suite;
  });
}

export function loadProject(repoRootArg: string, configPathArg: string): LoadedProject {
  const repoRoot = path.resolve(repoRootArg);
  const rootConfigPath = path.resolve(repoRoot, configPathArg);
  const rootConfig = loadRootConfig(rootConfigPath);

  const suitesById = new Map<string, SuiteConfig>();
  const suitesByGroup = new Map<string, SuiteConfig[]>();
  const skipAliasesById = new Map<string, SkipAlias>();
  const suites: SuiteConfig[] = [];
  const discoveredFiles = discoverSuiteConfigPaths(repoRoot, rootConfig.discoveryRoots);

  for (const discoveredFile of discoveredFiles) {
    for (const suite of loadSuitesFromFile(discoveredFile)) {
      if (suitesById.has(suite.id)) {
        const existing = suitesById.get(suite.id)!;
        throw new Error(
          `duplicate suite id ${suite.id} in ${suite.configPath} and ${existing.configPath}`,
        );
      }
      suitesById.set(suite.id, suite);
      suites.push(suite);
      for (const group of suite.groups) {
        const members = suitesByGroup.get(group) ?? [];
        members.push(suite);
        suitesByGroup.set(group, members);
      }
    }
  }

  for (const alias of rootConfig.skipAliases) {
    if (skipAliasesById.has(alias.id)) {
      const existing = skipAliasesById.get(alias.id)!;
      throw new Error(
        `duplicate skip alias ${alias.id} in ${alias.configPath} and ${existing.configPath}`,
      );
    }
    skipAliasesById.set(alias.id, alias);
  }

  const defaultGate = suites.filter((suite) => suite.defaultInGate);
  if (defaultGate.length === 0) {
    throw new Error(`no default validation suites discovered from ${rootConfigPath}`);
  }

  return {
    repoRoot,
    rootConfigPath,
    discoveryRoots: [...rootConfig.discoveryRoots],
    suites,
    suitesById,
    suitesByGroup,
    defaultGate,
    skipAliases: [...rootConfig.skipAliases],
    skipAliasesById,
  };
}
