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

export function templatePath(toolDir: string): string {
  return path.join(toolDir, "references", "tpl", "runner-config-template.json");
}

export function initializeRunnerConfig(paths: AgentLoopPaths, toolDir: string): void {
  copyFileIfMissing(templatePath(toolDir), paths.runnerConfigFile);
}

function validateRunnerConfigPayload(payload: unknown, filePath: string): RunnerConfig {
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
  return {
    schema: RUNNER_CONFIG_SCHEMA,
    runner_name: assertString(record.runner_name, `${filePath}.runner_name`),
    transport: transport as RunnerTransport,
    argv: assertStringArray(record.argv, `${filePath}.argv`),
    env,
    timeout_seconds: assertNumber(record.timeout_seconds, `${filePath}.timeout_seconds`),
    refresh_commands: assertStringMatrix(record.refresh_commands ?? [], `${filePath}.refresh_commands`),
  };
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
    if (config.argv.length === 0) {
      return {
        status: "invalid",
        message: "runner argv must not be empty",
        config,
      };
    }
    if (config.timeout_seconds <= 0) {
      return {
        status: "invalid",
        message: "timeout_seconds must be positive",
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
