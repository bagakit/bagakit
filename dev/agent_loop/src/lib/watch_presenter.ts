import type { AgentLoopWatchPayload, RunRecord, WatchSessionSummary } from "./model.ts";

const RESET = "\u001b[0m";
const COLORS = {
  title: "\u001b[1;36m",
  muted: "\u001b[90m",
  ok: "\u001b[32m",
  warn: "\u001b[33m",
  critical: "\u001b[31m",
};

function colorize(text: string, color: keyof typeof COLORS, enabled: boolean): string {
  if (!enabled) {
    return text;
  }
  return `${COLORS[color]}${text}${RESET}`;
}

function clampLine(text: string, width: number): string {
  if (text.length <= width) {
    return text;
  }
  if (width <= 3) {
    return text.slice(0, width);
  }
  return `${text.slice(0, width - 3)}...`;
}

function panel(title: string, lines: string[], width: number): string[] {
  const inner = Math.max(8, width - 2);
  const border = `+ ${clampLine(title, inner - 2).padEnd(inner - 2, "-")} +`;
  const body = (lines.length > 0 ? lines : [""]).map((line) => `| ${clampLine(line, inner - 2).padEnd(inner - 2)} |`);
  return [border, ...body, `+${"-".repeat(inner)}+`];
}

function mergeColumns(left: string[], right: string[], leftWidth: number, rightWidth: number): string[] {
  const height = Math.max(left.length, right.length);
  const lines: string[] = [];
  for (let index = 0; index < height; index += 1) {
    lines.push(`${(left[index] || "").padEnd(leftWidth)}  ${(right[index] || "").padEnd(rightWidth)}`.trimEnd());
  }
  return lines;
}

function statusHeadline(payload: AgentLoopWatchPayload): { label: string; reason: string; next: string; message: string; color: keyof typeof COLORS } {
  if (payload.latest_run && payload.latest_run.run_status === "operator_action_required") {
    return {
      label: "ACTION REQUIRED",
      reason: payload.latest_run.stop_reason,
      next: payload.latest_run.next_safe_action,
      message: payload.latest_run.operator_message,
      color: payload.current_notification?.severity === "critical" ? "critical" : "warn",
    };
  }
  if (payload.decision.recommended_action === "run_session") {
    return {
      label: "READY",
      reason: payload.decision.action_reason,
      next: payload.decision.next_safe_action,
      message: "One bounded session can run now.",
      color: "ok",
    };
  }
  if (payload.decision.recommended_action === "archive_closeout") {
    return {
      label: "CLOSEOUT",
      reason: payload.decision.action_reason,
      next: payload.decision.next_safe_action,
      message: "The selected runner-owned item is ready for archive closeout.",
      color: "warn",
    };
  }
  return {
    label: "IDLE",
    reason: payload.decision.action_reason,
    next: payload.decision.next_safe_action,
    message: "No bounded session is ready right now.",
    color: "muted",
  };
}

function renderActionPanel(payload: AgentLoopWatchPayload, width: number, ansi: boolean): string[] {
  const headline = statusHeadline(payload);
  const focus = payload.focus_item;
  const itemSummary = focus
    ? `item=${focus.item_id} | stage=${focus.current_stage} | step=${focus.current_step_status} | runner=${payload.runner_name} | lock=${payload.run_lock.status}`
    : `runner=${payload.runner_name} | lock=${payload.run_lock.status} | config=${payload.runner_config_status}`;
  const notification = payload.current_notification
    ? `attention=${payload.current_notification.severity} | ${payload.current_notification.summary}`
    : "attention=none";
  return panel(
    colorize("Action", "title", ansi),
    [
      colorize(`${headline.label} | next=${headline.next} | reason=${headline.reason}`, headline.color, ansi),
      itemSummary,
      headline.message,
      notification,
    ],
    width,
  );
}

function renderFocusPanel(payload: AgentLoopWatchPayload, width: number, ansi: boolean): string[] {
  const focus = payload.focus_item;
  if (!focus) {
    return panel(colorize("Focus Item", "title", ansi), ["No active focus item."], width);
  }
  return panel(
    colorize("Focus Item", "title", ansi),
    [
      `${focus.item_id} | ${focus.status} | ${focus.resolution}`,
      focus.title,
      `source=${focus.source_kind}:${focus.source_ref}`,
      `stage=${focus.current_stage} | step=${focus.current_step_status} | session=${focus.session_number}`,
      focus.checkpoint_request
        ? `checkpoint=${focus.checkpoint_request.stage}:${focus.checkpoint_request.session_status}`
        : "checkpoint=none",
      focus.current_safe_anchor ? `safe_anchor=${focus.current_safe_anchor.kind}:${focus.current_safe_anchor.summary}` : "safe_anchor=none",
    ],
    width,
  );
}

function renderLoopPanel(payload: AgentLoopWatchPayload, width: number, ansi: boolean): string[] {
  const latestRun = payload.latest_run;
  const latestSession = payload.latest_session;
  const lines = [
    `runner=${payload.runner_name} | config=${payload.runner_config_status}`,
    payload.run_lock.status === "idle"
      ? "run_lock=idle"
      : `run_lock=${payload.run_lock.status} | pid=${payload.run_lock.pid ?? "-"} | since=${payload.run_lock.created_at ?? "-"}`,
    latestRun
      ? `latest_run=${latestRun.stop_reason} | can_resume=${latestRun.can_resume ? "yes" : "no"} | budget=${latestRun.sessions_launched} of ${latestRun.session_budget}`
      : "latest_run=none",
    latestRun ? latestRun.operator_message : "operator_message=none",
    latestRun?.next_command_example ? `continue_with=${latestRun.next_command_example}` : "continue_with=none",
    latestSession
      ? `latest_session=${latestSession.session_id} | result=${latestSession.result_status || "-"} | exit=${latestSession.exit_code ?? "-"} | checkpoint=${latestSession.checkpoint_written === null ? "-" : latestSession.checkpoint_written ? "yes" : "no"}`
      : "latest_session=none",
  ];
  if (latestSession?.issue) {
    lines.push(`session_issue=${latestSession.issue}`);
  }
  return panel(colorize("Loop Status", "title", ansi), lines, width);
}

function renderHistorySection(title: string, runs: string[], sessions: string[], width: number, ansi: boolean): string[] {
  return panel(colorize(title, "title", ansi), [...runs, "", ...sessions], width);
}

function formatRunLine(run: RunRecord): string {
  return `${run.recorded_at.slice(11, 19)} ${run.stop_reason} -> ${run.next_safe_action} (${run.sessions_launched} of ${run.session_budget})`;
}

function formatSessionLine(session: WatchSessionSummary): string {
  const issue = session.issue ? ` issue=${session.issue}` : "";
  return `${session.started_at ? session.started_at.slice(11, 19) : "--------"} ${session.session_id} result=${session.result_status || "-"} exit=${session.exit_code ?? "-"}${issue}`;
}

function renderDetailPanel(payload: AgentLoopWatchPayload, width: number, ansi: boolean): string[] {
  const lines: string[] = [];
  if (payload.detail.handoff_excerpt) {
    lines.push("[handoff]");
    lines.push(...payload.detail.handoff_excerpt.split("\n"));
  }
  if (payload.detail.progress_excerpt) {
    lines.push("[progress]");
    lines.push(...payload.detail.progress_excerpt.split("\n"));
  }
  if (payload.detail.stderr_excerpt) {
    lines.push("[stderr]");
    lines.push(...payload.detail.stderr_excerpt.split("\n"));
  }
  if (payload.detail.stdout_excerpt) {
    lines.push("[stdout]");
    lines.push(...payload.detail.stdout_excerpt.split("\n"));
  }
  return panel(colorize("Detail", "title", ansi), lines.slice(0, 18), width);
}

export function renderWatchScreen(payload: AgentLoopWatchPayload, options: { ansi: boolean; width: number }): string {
  const width = Math.max(80, options.width);
  const top = renderActionPanel(payload, width, options.ansi);
  const focus = renderFocusPanel(payload, width >= 120 ? Math.floor((width - 2) / 2) : width, options.ansi);
  const loop = renderLoopPanel(payload, width >= 120 ? Math.floor((width - 2) / 2) : width, options.ansi);
  const history = renderHistorySection(
    "History",
    payload.recent_runs.slice(0, width >= 120 ? 4 : 3).map(formatRunLine),
    payload.recent_sessions.slice(0, width >= 120 ? 4 : 3).map(formatSessionLine),
    width,
    options.ansi,
  );
  const detail = renderDetailPanel(payload, width, options.ansi);

  const lines = [...top, ""];
  if (width >= 120) {
    const panelWidth = Math.floor((width - 2) / 2);
    lines.push(...mergeColumns(focus, loop, panelWidth, panelWidth));
  } else {
    lines.push(...focus, "", ...loop);
  }
  lines.push("", ...history, "", ...detail);
  return `${lines.join("\n")}\n`;
}
