import type { AgentLoopStatusPayload } from "./model.ts";
import { resolveCurrentSelection } from "./front_door.ts";
import { watchAgentLoop } from "./core.ts";
import { readSessionHostSnapshot } from "./session_host_snapshot.ts";
import { deriveSessionHostStatus } from "./session_host_status.ts";

export function buildStatusPayload(root: string, itemId?: string): AgentLoopStatusPayload {
  return {
    schema: "bagakit/agent-loop/status/v1",
    command: "status",
    current: resolveCurrentSelection(root, itemId),
    watch: watchAgentLoop(root, itemId),
  };
}

export function renderStatusText(payload: AgentLoopStatusPayload, root: string): string {
  const lines = [
    `current: ${payload.current.selection_status} / ${payload.current.selection_reason}`,
    `next-safe-action: ${payload.current.next_safe_action}`,
    `runner-config: ${payload.watch.runner_config_status}`,
    `run-lock: ${payload.watch.run_lock.status}`,
  ];
  if (payload.current.item_id) {
    lines.push(`item: ${payload.current.item_id}`);
  }
  if (payload.watch.latest_run) {
    lines.push(`latest-run: ${payload.watch.latest_run.stop_reason}`);
    lines.push(`message: ${payload.watch.latest_run.operator_message}`);
  }
  if (payload.watch.latest_session) {
    lines.push(`latest-session: ${payload.watch.latest_session.session_id} / ${payload.watch.latest_session.result_status || "-"}`);
    try {
      const snapshot = readSessionHostSnapshot(root, payload.watch.latest_session.session_id);
      const sessionStatus = deriveSessionHostStatus(snapshot);
      lines.push(`session-state: ${sessionStatus.execution_state} / ${sessionStatus.summary}`);
    } catch {
      // keep status rendering best-effort
    }
  }
  if (payload.watch.current_notification) {
    lines.push(`attention: ${payload.watch.current_notification.severity} / ${payload.watch.current_notification.summary}`);
  }
  if (payload.watch.watch_issue) {
    lines.push(`watch-issue: ${payload.watch.watch_issue}`);
  }
  return `${lines.join("\n")}\n`;
}
