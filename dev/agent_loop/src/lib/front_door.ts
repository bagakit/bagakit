import { loadNextAction, loadResumeCandidates } from "../adapters/flow_runner.ts";
import type { AgentLoopCurrentPayload, FlowNextPayload, FlowResumeCandidatesPayload, RunStopReason } from "./model.ts";

function fallbackNextPayload(): FlowNextPayload {
  return {
    schema: "bagakit/flow-runner/next-action/v2",
    command: "next",
    recommended_action: "stop",
    action_reason: "no_actionable_item",
    session_contract: {
      launch_bounded_session: false,
      persist_state_before_stop: false,
      checkpoint_before_stop: false,
      snapshot_before_session: false,
      archive_only_closeout: false,
    },
  };
}

export function safeLoadNextAction(root: string, itemId?: string, fallback?: FlowNextPayload): {
  payload: FlowNextPayload;
  error: string;
} {
  try {
    return {
      payload: loadNextAction(root, itemId),
      error: "",
    };
  } catch (error) {
    return {
      payload: fallback ?? fallbackNextPayload(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function safeLoadResumeCandidates(root: string): { payload: FlowResumeCandidatesPayload; error: string } {
  try {
    return {
      payload: loadResumeCandidates(root),
      error: "",
    };
  } catch (error) {
    return {
      payload: {
        schema: "bagakit/flow-runner/resume-candidates/v1",
        command: "resume-candidates",
        live: [],
        closeout: [],
      },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function resolveCurrentSelection(root: string, explicitItem?: string): AgentLoopCurrentPayload {
  const nextAttempt = safeLoadNextAction(root, explicitItem);
  if (nextAttempt.error) {
    return {
      schema: "bagakit/agent-loop/current/v1",
      command: "current",
      selection_status: "degraded",
      selection_reason: nextAttempt.error,
      next_safe_action: "inspect_flow_runner_state",
      flow_next: nextAttempt.payload,
    };
  }
  if (nextAttempt.payload.item_id && nextAttempt.payload.action_reason !== "no_actionable_item") {
    return {
      schema: "bagakit/agent-loop/current/v1",
      command: "current",
      selection_status: "selected",
      selection_reason: explicitItem ? "explicit_item" : "flow_runner_next",
      next_safe_action: nextAttempt.payload.recommended_action === "run_session" ? "run" : nextAttempt.payload.action_reason === "closeout_pending" ? "close_item_upstream" : "idle",
      flow_next: nextAttempt.payload,
      item_id: nextAttempt.payload.item_id,
    };
  }
  const candidatesAttempt = safeLoadResumeCandidates(root);
  if (candidatesAttempt.error) {
    return {
      schema: "bagakit/agent-loop/current/v1",
      command: "current",
      selection_status: "degraded",
      selection_reason: candidatesAttempt.error,
      next_safe_action: "inspect_resume_candidates",
      flow_next: nextAttempt.payload,
    };
  }
  if (candidatesAttempt.payload.live.length === 1) {
    const candidate = candidatesAttempt.payload.live[0]!;
    return {
      schema: "bagakit/agent-loop/current/v1",
      command: "current",
      selection_status: "selected",
      selection_reason: "single_live_candidate",
      next_safe_action: "run",
      flow_next: nextAttempt.payload,
      item_id: candidate.item_id,
      resume_candidates: candidatesAttempt.payload,
    };
  }
  if (candidatesAttempt.payload.live.length === 0) {
    return {
      schema: "bagakit/agent-loop/current/v1",
      command: "current",
      selection_status: "none",
      selection_reason: "no_live_candidate",
      next_safe_action: "inspect_resume_candidates",
      flow_next: nextAttempt.payload,
      resume_candidates: candidatesAttempt.payload,
    };
  }
  return {
    schema: "bagakit/agent-loop/current/v1",
    command: "current",
    selection_status: "ambiguous",
    selection_reason: "multiple_live_candidates",
    next_safe_action: "inspect_resume_candidates",
    flow_next: nextAttempt.payload,
    resume_candidates: candidatesAttempt.payload,
  };
}

export function resolveResumeTarget(root: string, explicitItem?: string): {
  itemId: string | undefined;
  stop?: {
    stop_reason: RunStopReason;
    operator_message: string;
    next_safe_action: string;
    can_resume: boolean;
    resume_candidates?: FlowResumeCandidatesPayload;
    flow_next: FlowNextPayload;
  };
} {
  const current = resolveCurrentSelection(root, explicitItem);
  if (current.selection_status === "selected") {
    return {
      itemId: current.item_id,
    };
  }
  if (current.selection_status === "degraded") {
    return {
      itemId: undefined,
      stop: {
        stop_reason: "flow_runner_refresh_failed",
        operator_message: current.selection_reason,
        next_safe_action: current.next_safe_action,
        can_resume: false,
        resume_candidates: current.resume_candidates,
        flow_next: current.flow_next,
      },
    };
  }
  if (current.selection_status === "ambiguous") {
    return {
      itemId: undefined,
      stop: {
        stop_reason: "resume_target_ambiguous",
        operator_message: "multiple live resume candidates are available; choose one item explicitly before resuming",
        next_safe_action: current.next_safe_action,
        can_resume: false,
        resume_candidates: current.resume_candidates,
        flow_next: current.flow_next,
      },
    };
  }
  return {
    itemId: undefined,
    stop: {
      stop_reason: "resume_target_required",
      operator_message: "no live resume candidate is available; choose an item explicitly or use run",
      next_safe_action: current.next_safe_action,
      can_resume: false,
      resume_candidates: current.resume_candidates,
      flow_next: current.flow_next,
    },
  };
}
