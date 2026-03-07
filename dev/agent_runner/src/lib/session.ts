import { spawnSync } from "node:child_process";

import { writeJson, writeText } from "./io.ts";
import {
  AGENT_RUNNER_SESSION_META_SCHEMA,
  type AgentRunnerLaunchRequest,
  type AgentRunnerLaunchResult,
  type AgentRunnerSessionMeta,
} from "./model.ts";

function expandTemplate(value: string, replacements: Record<string, string>): string {
  let rendered = value;
  for (const [key, replacement] of Object.entries(replacements)) {
    rendered = rendered.split(`{${key}}`).join(replacement);
  }
  return rendered;
}

export function launchStdinRunnerSession(request: AgentRunnerLaunchRequest): AgentRunnerLaunchResult {
  if (request.config.transport !== "stdin_prompt") {
    throw new Error(`unsupported transport: ${request.config.transport}`);
  }

  const argv = request.config.argv.map((part) => expandTemplate(part, request.template_context));
  const env = Object.fromEntries(
    Object.entries(request.config.env).map(([key, value]) => [key, expandTemplate(value, request.template_context)]),
  );

  writeText(request.paths.prompt_file, request.prompt_text);

  const result = spawnSync(argv[0]!, argv.slice(1), {
    cwd: request.cwd,
    encoding: "utf8",
    input: request.prompt_text,
    timeout: request.config.timeout_seconds * 1000,
    env: {
      ...process.env,
      ...env,
    },
  });

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  writeText(request.paths.stdout_file, stdout);
  writeText(request.paths.stderr_file, stderr);

  const launchError =
    result.error && typeof (result.error as { code?: string }).code === "string"
      ? (result.error as { code: string }).code
      : result.error?.message ?? "";

  const meta: AgentRunnerSessionMeta = {
    schema: AGENT_RUNNER_SESSION_META_SCHEMA,
    session_id: request.session_id,
    workload_id: request.workload_id,
    runner_name: request.config.runner_name,
    transport: request.config.transport,
    started_at: request.started_at,
    exit_code: result.status ?? null,
    signal: result.signal ?? null,
    launch_error: launchError,
    argv,
    env_keys: Object.keys(env).sort(),
  };
  writeJson(request.paths.session_meta_file, meta);

  return {
    exit_code: result.status ?? null,
    signal: result.signal ?? null,
    stdout,
    stderr,
    launch_error: launchError,
    argv,
    env_keys: meta.env_keys,
  };
}
