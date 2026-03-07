export const AGENT_RUNNER_TRANSPORTS = ["stdin_prompt"] as const;
export type AgentRunnerTransport = (typeof AGENT_RUNNER_TRANSPORTS)[number];

export const AGENT_RUNNER_SESSION_META_SCHEMA = "bagakit/agent-runner/session-meta/v1";

export interface AgentRunnerConfig {
  runner_name: string;
  transport: AgentRunnerTransport;
  argv: string[];
  env: Record<string, string>;
  timeout_seconds: number;
}

export interface AgentRunnerSessionPaths {
  session_dir: string;
  prompt_file: string;
  stdout_file: string;
  stderr_file: string;
  session_meta_file: string;
}

export interface AgentRunnerLaunchRequest {
  cwd: string;
  session_id: string;
  workload_id: string;
  started_at: string;
  prompt_text: string;
  template_context: Record<string, string>;
  config: AgentRunnerConfig;
  paths: AgentRunnerSessionPaths;
}

export interface AgentRunnerSessionMeta {
  schema: typeof AGENT_RUNNER_SESSION_META_SCHEMA;
  session_id: string;
  workload_id: string;
  runner_name: string;
  transport: AgentRunnerTransport;
  started_at: string;
  exit_code: number | null;
  signal: string | null;
  launch_error: string;
  argv: string[];
  env_keys: string[];
}

export interface AgentRunnerLaunchResult {
  exit_code: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  launch_error: string;
  argv: string[];
  env_keys: string[];
}
