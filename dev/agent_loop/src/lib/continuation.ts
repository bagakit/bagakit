import type {
  AgentLoopPathsShape,
  FlowActionReason,
  FlowNextPayload,
  FlowRecommendedAction,
  RecoverySessionContext,
  RunStatus,
  RunStopReason,
} from "./model.ts";

export type SessionStopEnvelope = Readonly<{
  run_status: RunStatus;
  stop_reason: RunStopReason;
  operator_message: string;
  next_safe_action: string;
  can_resume: boolean;
  checkpoint_observed: boolean;
  runner_session_id: string;
  flow_next: FlowNextPayload;
}>;

export type CanonicalFlowStop = Readonly<{
  stop_reason: RunStopReason;
  operator_message: string;
  next_safe_action: string;
  can_resume: boolean;
  run_status: RunStatus;
  flow_next: FlowNextPayload;
}>;

export type ContinuationDecision =
  | Readonly<{ kind: "recover"; recovery: RecoverySessionContext }>
  | Readonly<{ kind: "stop"; stop: CanonicalFlowStop | SessionStopEnvelope }>;

function recoverableStopReason(stopReason: RunStopReason): boolean {
  return (
    stopReason === "runner_timeout" ||
    stopReason === "runner_exited_nonzero" ||
    stopReason === "runner_output_missing" ||
    stopReason === "runner_output_invalid" ||
    stopReason === "checkpoint_missing"
  );
}

export function canonicalFlowStop(flowNext: FlowNextPayload): CanonicalFlowStop {
  if (flowNext.recommended_action === "archive_closeout") {
    return {
      stop_reason: "item_archived",
      operator_message: "the selected runner-owned item is ready for archive closeout",
      next_safe_action: "archive_owned_item",
      can_resume: false,
      run_status: "terminal",
      flow_next: flowNext,
    };
  }
  if (flowNext.recommended_action === "clear_blocker") {
    return {
      stop_reason: "blocked_item",
      operator_message: "the selected item is blocked and needs maintainer action",
      next_safe_action: "resolve_blocker",
      can_resume: true,
      run_status: "operator_action_required",
      flow_next: flowNext,
    };
  }
  if (flowNext.recommended_action === "stop" && flowNext.action_reason === "closeout_pending") {
    return {
      stop_reason: "closeout_pending",
      operator_message: "the selected item is waiting for upstream closeout or manual review",
      next_safe_action: "close_item_upstream",
      can_resume: true,
      run_status: "operator_action_required",
      flow_next: flowNext,
    };
  }
  return {
    stop_reason: "no_actionable_item",
    operator_message: "no actionable item is available",
    next_safe_action: "idle",
    can_resume: false,
    run_status: "terminal",
    flow_next: flowNext,
  };
}

function flowStillRunnable(flowNext: FlowNextPayload): boolean {
  return flowNext.recommended_action === "run_session" && flowNext.action_reason === "active_work";
}

export function decideContinuationAfterSessionStop(
  stop: SessionStopEnvelope,
  currentHostPaths: AgentLoopPathsShape,
): ContinuationDecision {
  if (!stop.can_resume || stop.stop_reason === "operator_cancelled") {
    return { kind: "stop", stop };
  }
  if (!flowStillRunnable(stop.flow_next)) {
    return { kind: "stop", stop: canonicalFlowStop(stop.flow_next) };
  }
  if (!recoverableStopReason(stop.stop_reason)) {
    return { kind: "stop", stop };
  }
  return {
    kind: "recover",
    recovery: {
      previous_item_id: stop.flow_next.item_id || "",
      previous_session_id: stop.runner_session_id,
      previous_stop_reason: stop.stop_reason,
      previous_operator_message: stop.operator_message,
      previous_next_safe_action: stop.next_safe_action,
      previous_host_paths: currentHostPaths,
    },
  };
}

export function flowDecision(recommendedAction: FlowRecommendedAction, actionReason: FlowActionReason): string {
  if (recommendedAction === "run_session" && actionReason === "active_work") {
    return "flow_continue";
  }
  if (recommendedAction === "clear_blocker") {
    return "flow_stop_blocked";
  }
  if (recommendedAction === "archive_closeout" || actionReason === "closeout_pending") {
    return "flow_stop_closeout";
  }
  return "flow_stop_idle";
}
