import fs from "node:fs";

import {
  AGENT_RUNNER_CONFIG_SCHEMA,
  LEGACY_AGENT_LOOP_RUNNER_CONFIG_SCHEMA,
  type AgentRunnerConfig,
  type AgentRunnerTransport,
} from "./model.ts";

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function assertStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${label} must be an array of strings`);
  }
  return value;
}

function assertNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number`);
  }
  return value;
}

export function loadAgentRunnerConfig(filePath: string): AgentRunnerConfig {
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  const record = assertRecord(payload, filePath);
  const schema = assertString(record.schema, `${filePath}.schema`);
  if (schema !== AGENT_RUNNER_CONFIG_SCHEMA && schema !== LEGACY_AGENT_LOOP_RUNNER_CONFIG_SCHEMA) {
    throw new Error(`${filePath}.schema must be ${AGENT_RUNNER_CONFIG_SCHEMA} or ${LEGACY_AGENT_LOOP_RUNNER_CONFIG_SCHEMA}`);
  }
  const rawEnv = assertRecord(record.env ?? {}, `${filePath}.env`);
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawEnv)) {
    env[key] = assertString(value, `${filePath}.env.${key}`);
  }
  return {
    schema: schema as AgentRunnerConfig["schema"],
    runner_name: assertString(record.runner_name, `${filePath}.runner_name`),
    transport: assertString(record.transport, `${filePath}.transport`) as AgentRunnerTransport,
    argv: assertStringArray(record.argv, `${filePath}.argv`),
    env,
    timeout_seconds: assertNumber(record.timeout_seconds, `${filePath}.timeout_seconds`),
  };
}
