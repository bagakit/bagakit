import {
  FLOW_PROTOCOL_SCHEMAS,
  type ActionReason,
  type ExecutionMode,
  type ItemState,
  type NextActionPayload,
  type RecommendedAction,
  type ResumeCandidate,
  type ResumeCandidatesPayload,
  type RunnerPolicy,
  type SessionContract,
  type SessionStatus,
} from "./model.ts";
import { isTerminalStatus } from "./mutation.ts";
import { validateItemState, validatePolicy } from "./validation.ts";

export type ProjectionOptions = Readonly<{
  source_owned_kinds?: readonly string[];
  source_closeout_stage_keys?: readonly string[];
  item_path_for?: (item: ItemState) => string;
  checkpoint_command_for?: (item: ItemState, sessionStatus: SessionStatus) => string;
}>;

export type NextActionProjectionInput = Readonly<{
  items: readonly ItemState[];
  policy: RunnerPolicy;
  explicit_item_id?: string;
}> & ProjectionOptions;

export function projectNextAction(input: NextActionProjectionInput): NextActionPayload {
  const policy = validatePolicy(input.policy);
  const state = selectNextItem(input.items.map((item) => validateItemState(item)), input.explicit_item_id);
  if (!state) {
    return {
      schema: FLOW_PROTOCOL_SCHEMAS.nextAction,
      command: "next",
      recommended_action: "stop",
      action_reason: "no_actionable_item",
      session_contract: buildSessionContract(policy, "stop"),
    };
  }
  const recommendation = recommendAction(state, input);
  const sessionStatus: SessionStatus =
    recommendation.action === "run_session" ? "progress" : recommendation.action === "clear_blocker" ? "blocked" : "terminal";
  return {
    schema: FLOW_PROTOCOL_SCHEMAS.nextAction,
    command: "next",
    item_id: state.item_id,
    item_path: input.item_path_for?.(state) ?? "",
    item_status: state.status,
    resolution: state.resolution,
    current_stage: state.current_stage,
    current_step_status: state.current_step_status,
    execution_mode: executionModeForState(state),
    active_plan_revision_id: state.runtime.active_plan_revision_id,
    active_action_id: state.runtime.active_action_id,
    session_number: state.runtime.session_count + 1,
    progress_log_path: state.paths.progress_log,
    current_safe_anchor: state.runtime.current_safe_anchor,
    recommended_action: recommendation.action,
    action_reason: recommendation.reason,
    session_contract: buildSessionContract(policy, recommendation.action),
    checkpoint_request: {
      stage: state.current_stage,
      session_status: sessionStatus,
      command_example: input.checkpoint_command_for?.(state, sessionStatus) ?? `flow-runner checkpoint --item ${state.item_id} --stage ${state.current_stage} --session-status ${sessionStatus}`,
    },
  };
}

export function projectResumeCandidates(
  itemsInput: readonly ItemState[],
  options: Pick<ProjectionOptions, "item_path_for"> = {},
): ResumeCandidatesPayload {
  const live: ResumeCandidate[] = [];
  const closeout: ResumeCandidate[] = [];
  for (const item of itemsInput.map((candidate) => validateItemState(candidate))) {
    const candidate = resumeCandidateFromItem(item, options.item_path_for?.(item) ?? "");
    if (isTerminalStatus(item.status)) {
      closeout.push(candidate);
    } else {
      live.push(candidate);
    }
  }
  return {
    schema: FLOW_PROTOCOL_SCHEMAS.resumeCandidates,
    command: "resume-candidates",
    live: sortCandidates(live),
    closeout: sortCandidates(closeout),
  };
}

export function selectNextItem(items: readonly ItemState[], explicitItemId?: string): ItemState | null {
  const activeItems = items
    .map((item) => validateItemState(item))
    .filter((item) => item.archive_status === "active");
  if (explicitItemId) {
    const found = activeItems.find((item) => item.item_id === explicitItemId);
    if (!found) {
      throw new Error(`unknown item: ${explicitItemId}`);
    }
    return found;
  }
  const inProgress = activeItems.filter((item) => item.status === "in_progress");
  if (inProgress.length > 1) {
    throw new Error("multiple in-progress items detected; choose one explicitly");
  }
  if (inProgress.length === 1) {
    return inProgress[0] ?? null;
  }
  activeItems.sort(compareSelectionRank);
  return activeItems[0] ?? null;
}

export function recommendAction(
  stateInput: ItemState,
  options: Pick<ProjectionOptions, "source_owned_kinds" | "source_closeout_stage_keys"> = {},
): { action: RecommendedAction; reason: ActionReason } {
  const state = validateItemState(stateInput);
  if (isSourceOwned(state, options) && state.current_step_status === "done" && sourceCloseoutStages(options).includes(state.current_stage)) {
    return { action: "stop", reason: "closeout_pending" };
  }
  if (state.status === "blocked") {
    return { action: "clear_blocker", reason: "blocked_item" };
  }
  if (isTerminalStatus(state.status)) {
    if (isSourceOwned(state, options)) {
      return { action: "stop", reason: "closeout_pending" };
    }
    return { action: "archive_closeout", reason: "closeout_pending" };
  }
  return { action: "run_session", reason: "active_work" };
}

export function buildSessionContract(policyInput: RunnerPolicy, action: RecommendedAction): SessionContract {
  const policy = validatePolicy(policyInput);
  return {
    launch_bounded_session: action === "run_session",
    persist_state_before_stop: policy.safety.persist_state_before_stop,
    checkpoint_before_stop: policy.safety.checkpoint_before_stop,
    snapshot_before_session: action === "run_session" && policy.safety.snapshot_before_session,
    archive_only_closeout: action === "archive_closeout",
  };
}

export function executionModeForState(stateInput: ItemState): ExecutionMode {
  const state = validateItemState(stateInput);
  if (state.status === "blocked") {
    return "blocked_clearance";
  }
  if (isTerminalStatus(state.status)) {
    return "closeout";
  }
  return "normal_execution";
}

function resumeCandidateFromItem(item: ItemState, itemPath: string): ResumeCandidate {
  return {
    item_id: item.item_id,
    item_path: itemPath,
    title: item.title,
    source_kind: item.source_kind,
    source_ref: item.source_ref,
    item_status: item.status,
    resolution: item.resolution,
    current_stage: item.current_stage,
    current_step_status: item.current_step_status,
    active_plan_revision_id: item.runtime.active_plan_revision_id,
    active_action_id: item.runtime.active_action_id,
    session_number: item.runtime.session_count,
    progress_log_path: item.paths.progress_log,
    current_safe_anchor: item.runtime.current_safe_anchor,
    open_incident_ids: [...item.runtime.open_incident_ids],
  };
}

function compareSelectionRank(left: ItemState, right: ItemState): number {
  const leftRank = selectionRank(left);
  const rightRank = selectionRank(right);
  return leftRank[0] - rightRank[0]
    || leftRank[1] - rightRank[1]
    || leftRank[2] - rightRank[2]
    || leftRank[3].localeCompare(rightRank[3]);
}

function selectionRank(state: ItemState): [number, number, number, string] {
  const statusOrder = state.status === "in_progress" ? 0 : state.status === "todo" ? 1 : state.status === "blocked" ? 2 : 3;
  return [statusOrder, -state.priority, -state.confidence, state.item_id];
}

function sortCandidates(candidates: ResumeCandidate[]): ResumeCandidate[] {
  return [...candidates].sort((left, right) => left.item_id.localeCompare(right.item_id));
}

function isSourceOwned(state: ItemState, options: Pick<ProjectionOptions, "source_owned_kinds">): boolean {
  return (options.source_owned_kinds ?? ["feature-tracker"]).includes(state.source_kind);
}

function sourceCloseoutStages(options: Pick<ProjectionOptions, "source_closeout_stage_keys">): readonly string[] {
  return options.source_closeout_stage_keys ?? ["review", "closeout"];
}
