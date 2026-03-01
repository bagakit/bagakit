export const RUNNER_CONFIG_SCHEMA = "bagakit/agent-loop/runner-config/v1";
export const SESSION_BRIEF_SCHEMA = "bagakit/agent-loop/session-brief/v1";
export const RUNNER_RESULT_SCHEMA = "bagakit/agent-loop/runner-result/v1";
export const NEXT_SCHEMA = "bagakit/agent-loop/next/v1";
export const RUN_SCHEMA = "bagakit/agent-loop/run/v1";
export const WATCH_SCHEMA = "bagakit/agent-loop/watch/v1";
export const RUN_RECORD_SCHEMA = "bagakit/agent-loop/run-record/v1";
export const RUN_LOCK_SCHEMA = "bagakit/agent-loop/run-lock/v1";

export const RUNNER_TRANSPORTS = ["stdin_prompt"] as const;
export type RunnerTransport = (typeof RUNNER_TRANSPORTS)[number];

export const RUNNER_CONFIG_STATUSES = ["missing", "invalid", "ready"] as const;
export type RunnerConfigStatusKind = (typeof RUNNER_CONFIG_STATUSES)[number];

export const RUN_STATUSES = ["terminal", "operator_action_required"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const RUN_STOP_REASONS = [
  "no_actionable_item",
  "item_archived",
  "blocked_item",
  "closeout_pending",
  "run_lock_conflict",
  "runner_config_required",
  "runner_config_invalid",
  "session_budget_exhausted",
  "runner_launch_failed",
  "runner_timeout",
  "runner_exited_nonzero",
  "runner_output_missing",
  "runner_output_invalid",
  "flow_runner_refresh_failed",
  "checkpoint_missing",
  "operator_cancelled",
] as const;
export type RunStopReason = (typeof RUN_STOP_REASONS)[number];

export const RUNNER_RESULT_STATUSES = ["completed", "operator_cancelled"] as const;
export type RunnerResultStatus = (typeof RUNNER_RESULT_STATUSES)[number];

export const FLOW_RECOMMENDED_ACTIONS = ["run_session", "clear_blocker", "archive_closeout", "stop"] as const;
export type FlowRecommendedAction = (typeof FLOW_RECOMMENDED_ACTIONS)[number];

export const FLOW_ACTION_REASONS = ["active_work", "blocked_item", "closeout_pending", "no_actionable_item"] as const;
export type FlowActionReason = (typeof FLOW_ACTION_REASONS)[number];

export const FLOW_SESSION_STATUSES = ["progress", "blocked", "gate_passed", "terminal"] as const;
export type FlowSessionStatus = (typeof FLOW_SESSION_STATUSES)[number];

export const FLOW_ITEM_STATUSES = ["todo", "in_progress", "blocked", "completed", "cancelled"] as const;
export type FlowItemStatus = (typeof FLOW_ITEM_STATUSES)[number];

export type RunnerConfig = Readonly<{
  schema: typeof RUNNER_CONFIG_SCHEMA;
  runner_name: string;
  transport: RunnerTransport;
  argv: string[];
  env: Record<string, string>;
  timeout_seconds: number;
  refresh_commands: string[][];
}>;

export type RunnerConfigStatus = Readonly<{
  status: RunnerConfigStatusKind;
  message: string;
  config: RunnerConfig | null;
}>;

export type FlowSessionContract = Readonly<{
  launch_bounded_session: boolean;
  persist_state_before_stop: boolean;
  checkpoint_before_stop: boolean;
  snapshot_before_session: boolean;
  archive_only_closeout: boolean;
}>;

export type FlowCheckpointRequest = Readonly<{
  stage: string;
  session_status: FlowSessionStatus;
  command_example: string;
}>;

export type FlowNextPayload = Readonly<{
  schema: string;
  command: "next";
  recommended_action: FlowRecommendedAction;
  action_reason: FlowActionReason;
  item_id?: string;
  item_path?: string;
  item_status?: FlowItemStatus;
  resolution?: string;
  current_stage?: string;
  current_step_status?: string;
  active_plan_revision_id?: string;
  active_action_id?: string;
  session_number?: number;
  progress_log_path?: string;
  current_safe_anchor?: {
    kind: string;
    ref: string;
    summary: string;
  } | null;
  session_contract: FlowSessionContract;
  checkpoint_request?: FlowCheckpointRequest;
}>;

export type FlowItemPaths = Readonly<{
  handoff: string;
  checkpoints: string;
  progress_log: string;
  plan_revisions_dir: string;
  incidents_dir: string;
}>;

export type FlowItemRuntime = Readonly<{
  active_plan_revision_id: string;
  active_action_id: string;
  open_incident_ids: string[];
  session_count: number;
  latest_checkpoint_at: string;
  latest_snapshot_id: string;
  current_safe_anchor: {
    kind: string;
    ref: string;
    summary: string;
  } | null;
}>;

export type FlowItemState = Readonly<{
  schema: string;
  item_id: string;
  title: string;
  source_kind: string;
  source_ref: string;
  status: FlowItemStatus;
  archive_status: string;
  resolution: string;
  current_stage: string;
  current_step_status: string;
  priority: number;
  confidence: number;
  created_at: string;
  updated_at: string;
  paths: FlowItemPaths;
  runtime: FlowItemRuntime;
}>;

export type AgentLoopPathsShape = Readonly<{
  session_dir: string;
  session_brief: string;
  prompt_file: string;
  stdout_file: string;
  stderr_file: string;
  runner_result_file: string;
}>;

export type SessionBrief = Readonly<{
  schema: typeof SESSION_BRIEF_SCHEMA;
  session_id: string;
  started_at: string;
  repo_root: string;
  runner_name: string;
  item: {
    item_id: string;
    title: string;
    source_kind: string;
    source_ref: string;
    status: string;
    resolution: string;
    current_stage: string;
    current_step_status: string;
    item_path: string;
    handoff_path: string;
    progress_log_path: string;
    session_number: number;
    open_incident_ids: string[];
  };
  flow_next: FlowNextPayload;
  flow_runner_command: string[];
  host_paths: AgentLoopPathsShape;
  boundaries: string[];
  required_steps: string[];
}>;

export type RunnerResult = Readonly<{
  schema: typeof RUNNER_RESULT_SCHEMA;
  session_id: string;
  status: RunnerResultStatus;
  checkpoint_written: boolean;
  note: string;
}>;

export type AgentLoopNextPayload = Readonly<{
  schema: typeof NEXT_SCHEMA;
  command: "next";
  runner_config_status: RunnerConfigStatusKind;
  runner_ready: boolean;
  next_safe_action: string;
  flow_next: FlowNextPayload;
}>;

export type RunRecord = Readonly<{
  schema: typeof RUN_RECORD_SCHEMA;
  run_id: string;
  recorded_at: string;
  run_status: RunStatus;
  stop_reason: RunStopReason;
  item_id: string;
  sessions_launched: number;
  session_budget: number;
  checkpoint_observed: boolean;
  runner_session_id: string;
}>;

export type AgentLoopRunPayload = Readonly<{
  schema: typeof RUN_SCHEMA;
  command: "run";
  run_status: RunStatus;
  stop_reason: RunStopReason;
  operator_message: string;
  next_safe_action: string;
  can_resume: boolean;
  item_id: string;
  sessions_launched: number;
  session_budget: number;
  checkpoint_observed: boolean;
  runner_session_id: string;
  run_record_path: string;
  flow_next: FlowNextPayload;
}>;

export type AgentLoopWatchPayload = Readonly<{
  schema: typeof WATCH_SCHEMA;
  command: "watch";
  runner_config_status: RunnerConfigStatusKind;
  flow_next: FlowNextPayload;
  recent_runs: RunRecord[];
  recent_sessions: Array<{
    session_id: string;
    item_id: string;
    runner_name: string;
    started_at: string;
    exit_code: number | null;
    result_status: RunnerResultStatus | "";
    checkpoint_written: boolean | null;
    issue?: string;
  }>;
}>;

export type RunLockPayload = Readonly<{
  schema: typeof RUN_LOCK_SCHEMA;
  pid: number;
  created_at: string;
  runner_name: string;
}>;
