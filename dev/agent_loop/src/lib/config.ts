import path from "node:path";

import {
  RUNNER_CONFIG_SCHEMA,
  RUNNER_CONFIG_STATUSES,
  RUNNER_TRANSPORTS,
  type RunnerConfig,
  type RunnerConfigStatus,
  type RunnerTransport,
} from "./model.ts";
import {
  assertNumber,
  assertRecord,
  assertString,
  assertStringArray,
  assertStringMatrix,
  copyFileIfMissing,
  loadJsonIfExists,
  writeJsonFile,
} from "./io.ts";
import { AgentLoopPaths } from "./paths.ts";

const runnerNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function templatePath(toolDir: string): string {
  return path.join(toolDir, "references", "tpl", "runner-config-template.json");
}

export function initializeRunnerConfig(paths: AgentLoopPaths, toolDir: string): void {
  copyFileIfMissing(templatePath(toolDir), paths.runnerConfigFile);
}

export function validateRunnerConfigPayload(payload: unknown, filePath: string): RunnerConfig {
  const record = assertRecord(payload, filePath);
  if (record.schema !== RUNNER_CONFIG_SCHEMA) {
    throw new Error(`${filePath} must declare schema ${RUNNER_CONFIG_SCHEMA}`);
  }
  const transport = assertString(record.transport, `${filePath}.transport`);
  if (!(RUNNER_TRANSPORTS as readonly string[]).includes(transport)) {
    throw new Error(`${filePath}.transport must be one of ${RUNNER_TRANSPORTS.join(", ")}`);
  }
  const rawEnv = record.env ?? {};
  const envRecord = assertRecord(rawEnv, `${filePath}.env`);
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(envRecord)) {
    env[key] = assertString(value, `${filePath}.env.${key}`);
  }
  const runnerName = assertSingleLineString(record.runner_name, `${filePath}.runner_name`);
  if (!runnerNamePattern.test(runnerName)) {
    throw new Error(`${filePath}.runner_name must match [A-Za-z0-9][A-Za-z0-9._-]*`);
  }
  const argv = assertSingleLineStringArray(record.argv, `${filePath}.argv`);
  const refreshCommands = assertStringMatrix(record.refresh_commands ?? [], `${filePath}.refresh_commands`).map((row, rowIndex) =>
    row.map((entry, entryIndex) => assertSingleLineString(entry, `${filePath}.refresh_commands[${rowIndex}][${entryIndex}]`)),
  );
  return {
    schema: RUNNER_CONFIG_SCHEMA,
    runner_name: runnerName,
    transport: transport as RunnerTransport,
    argv,
    env,
    timeout_seconds: assertNumber(record.timeout_seconds, `${filePath}.timeout_seconds`),
    refresh_commands: refreshCommands,
  };
}

export function validateRunnerConfigForWrite(payload: unknown, filePath: string): RunnerConfig {
  const config = validateRunnerConfigPayload(payload, filePath);
  const issue = runnerConfigExecutionIssue(config);
  if (issue) {
    throw new Error(issue);
  }
  return config;
}

export function loadRunnerConfig(paths: AgentLoopPaths): RunnerConfig | null {
  const payload = loadJsonIfExists<unknown>(paths.runnerConfigFile);
  return payload === null ? null : validateRunnerConfigPayload(payload, paths.runnerConfigFile);
}

export function writeRunnerConfig(paths: AgentLoopPaths, config: RunnerConfig): void {
  writeJsonFile(paths.runnerConfigFile, config);
}

export function runnerConfigStatus(paths: AgentLoopPaths): RunnerConfigStatus {
  const payload = loadJsonIfExists<unknown>(paths.runnerConfigFile);
  if (payload === null) {
    return {
      status: "missing",
      message: "runner config is missing; run configure-runner first",
      config: null,
    };
  }
  try {
    const config = validateRunnerConfigPayload(payload, paths.runnerConfigFile);
    const issue = runnerConfigExecutionIssue(config);
    if (issue) {
      return {
        status: "invalid",
        message: issue,
        config,
      };
    }
    return {
      status: "ready",
      message: "runner config is ready",
      config,
    };
  } catch (error) {
    return {
      status: "invalid",
      message: error instanceof Error ? error.message : String(error),
      config: null,
    };
  }
}

function runnerConfigExecutionIssue(config: RunnerConfig): string {
  if (config.argv.length === 0) {
    return "runner argv must not be empty";
  }
  const knownCliIssue = knownCliValidationIssue(config.argv);
  if (knownCliIssue) {
    return knownCliIssue;
  }
  if (config.timeout_seconds <= 0) {
    return "timeout_seconds must be positive";
  }
  return "";
}

function knownCliValidationIssue(argv: string[]): string {
  const head = normalizedCommandName(argv[0] || "");
  if ((head === "codex" || head === "codexl") && argv[1] !== "exec") {
    return "stdin_prompt transport requires non-interactive Codex; use `codex exec ...` instead of a bare Codex launcher";
  }
  if (isPackageRunner(head)) {
    const nested = firstNestedRunner(argv);
    if ((nested.name === "codex" || nested.name === "codexl") && argv[nested.index + 1] !== "exec") {
      return "stdin_prompt transport requires non-interactive Codex; use `codex exec ...` instead of a bare Codex launcher";
    }
    if (nested.name === "claude" && !argv.includes("-p") && !argv.includes("--print")) {
      return "stdin_prompt transport requires non-interactive Claude; include `-p` in the runner argv";
    }
  }
  if (head === "claude" && !argv.includes("-p") && !argv.includes("--print")) {
    return "stdin_prompt transport requires non-interactive Claude; include `-p` or `--print` in the runner argv";
  }
  return "";
}

function isPackageRunner(command: string): boolean {
  return command === "npx" || command === "pnpm" || command === "pnpx" || command === "bunx" || command === "yarn";
}

function firstNestedRunner(argv: string[]): { name: string; index: number } {
  for (let index = 1; index < argv.length; index += 1) {
    const name = normalizedCommandName(argv[index] || "");
    if (name === "codex" || name === "codexl" || name === "claude") {
      return { name, index };
    }
  }
  return { name: "", index: -1 };
}

function assertSingleLineString(value: unknown, label: string): string {
  const text = assertString(value, label);
  if (text.includes("\n") || text.includes("\r")) {
    throw new Error(`${label} must stay on one line`);
  }
  return text;
}

function assertSingleLineStringArray(value: unknown, label: string): string[] {
  return assertStringArray(value, label).map((entry, index) => assertSingleLineString(entry, `${label}[${index}]`));
}

function normalizedCommandName(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  const segments = trimmed.split(/[\\/]/).filter((segment) => segment.length > 0);
  return segments[segments.length - 1] || trimmed;
}

export function presetArgv(preset: string): { runner_name: string; argv: string[] } {
  switch (preset) {
    case "codex":
      return {
        runner_name: "codex",
        argv: ["codex", "exec", "--skip-git-repo-check", "-C", "{repo_root}", "-"],
      };
    case "claude":
      return {
        runner_name: "claude",
        argv: ["claude", "-p"],
      };
    default:
      throw new Error(`unsupported preset: ${preset}`);
  }
}

export function normalizeRefreshCommands(values: string[]): string[][] {
  return values.map((raw, index) => {
    const parsed = JSON.parse(raw) as unknown;
    const argv = assertStringArray(parsed, `refresh_commands[${index}]`);
    if (argv.length === 0) {
      throw new Error(`refresh_commands[${index}] must not be empty`);
    }
    return argv;
  });
}

export function parseArgvJson(raw: string): string[] {
  const parsed = JSON.parse(raw) as unknown;
  const argv = assertStringArray(parsed, "argv");
  if (argv.length === 0) {
    throw new Error("argv must not be empty");
  }
  return argv;
}

export function isKnownRunnerConfigStatus(value: string): value is RunnerConfigStatus["status"] {
  return (RUNNER_CONFIG_STATUSES as readonly string[]).includes(value);
}
