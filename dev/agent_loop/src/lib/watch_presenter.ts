import type { AgentLoopWatchPayload, RunRecord, WatchFocusItem, WatchSessionSummary } from "./model.ts";

const RESET = "\u001b[0m";
const COLORS = {
  title: "\u001b[1;36m",
  muted: "\u001b[90m",
  ok: "\u001b[32m",
  warn: "\u001b[33m",
  critical: "\u001b[31m",
};

export type WatchRenderFrame = Readonly<{
  text: string;
  detailOffset: number;
  maxDetailOffset: number;
  detailVisibleCount: number;
  detailTotalCount: number;
}>;

type WatchRenderOptions = Readonly<{
  ansi: boolean;
  width: number;
  height?: number;
  paused?: boolean;
  detailOffset?: number;
  refreshSeconds?: number;
  notice?: string;
}>;

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

function hardWrap(text: string, width: number): string[] {
  if (text.length <= width) {
    return [text];
  }
  const lines: string[] = [];
  let rest = text;
  while (rest.length > width) {
    lines.push(rest.slice(0, width));
    rest = rest.slice(width);
  }
  if (rest.length > 0) {
    lines.push(rest);
  }
  return lines;
}

function wrapLine(text: string, width: number): string[] {
  if (width <= 0) {
    return [""];
  }
  if (text.trim() === "") {
    return [""];
  }
  const chunks = text.split(/\s+/).filter((chunk) => chunk.length > 0);
  if (chunks.length === 0) {
    return [""];
  }
  const lines: string[] = [];
  let current = "";
  for (const chunk of chunks) {
    if (chunk.length > width) {
      if (current) {
        lines.push(current);
        current = "";
      }
      lines.push(...hardWrap(chunk, width));
      continue;
    }
    const candidate = current ? `${current} ${chunk}` : chunk;
    if (candidate.length > width) {
      lines.push(current);
      current = chunk;
      continue;
    }
    current = candidate;
  }
  if (current) {
    lines.push(current);
  }
  return lines.length > 0 ? lines : [""];
}

function wrapLines(lines: string[], width: number): string[] {
  return lines.flatMap((line) => line.split("\n").flatMap((part) => wrapLine(part, width)));
}

function panel(title: string, lines: string[], width: number): string[] {
  const inner = Math.max(18, width - 2);
  const titleText = clampLine(title, inner - 2);
  const border = `+ ${titleText.padEnd(inner - 2, "-")} +`;
  const body = wrapLines(lines, inner - 2).map((line) => `| ${line.padEnd(inner - 2)} |`);
  return [border, ...(body.length > 0 ? body : [`| ${"".padEnd(inner - 2)} |`]), `+${"-".repeat(inner)}+`];
}

function scrollingPanel(title: string, lines: string[], width: number, bodyHeight: number, detailOffset: number): WatchRenderFrame {
  const inner = Math.max(18, width - 2);
  const wrapped = wrapLines(lines, inner - 2);
  const visibleCount = Math.max(1, bodyHeight);
  const maxOffset = Math.max(0, wrapped.length - visibleCount);
  const safeOffset = Math.max(0, Math.min(detailOffset, maxOffset));
  const end = Math.min(wrapped.length, safeOffset + visibleCount);
  const range = wrapped.length === 0 ? "0 of 0" : `${safeOffset + 1}-${end} of ${wrapped.length}`;
  const border = `+ ${clampLine(`${title} [${range}]`, inner - 2).padEnd(inner - 2, "-")} +`;
  const bodySource = wrapped.length > 0 ? wrapped.slice(safeOffset, end) : [""];
  const body = bodySource.map((line) => `| ${line.padEnd(inner - 2)} |`);
  const text = [border, ...body, `+${"-".repeat(inner)}+`].join("\n");
  return {
    text: `${text}\n`,
    detailOffset: safeOffset,
    maxDetailOffset: maxOffset,
    detailVisibleCount: visibleCount,
    detailTotalCount: wrapped.length,
  };
}

function mergeColumns(left: string[], right: string[], leftWidth: number, rightWidth: number): string[] {
  const height = Math.max(left.length, right.length);
  const lines: string[] = [];
  for (let index = 0; index < height; index += 1) {
    lines.push(`${(left[index] || "").padEnd(leftWidth)}  ${(right[index] || "").padEnd(rightWidth)}`.trimEnd());
  }
  return lines;
}

function displaySource(focus: WatchFocusItem): string {
  const prefixed = `${focus.source_kind}:`;
  return focus.source_ref.startsWith(prefixed) ? focus.source_ref : `${prefixed}${focus.source_ref}`;
}

function statusHeadline(payload: AgentLoopWatchPayload): { label: string; reason: string; next: string; message: string; color: keyof typeof COLORS } {
  if (payload.watch_issue) {
    return {
      label: "WATCH DEGRADED",
      reason: "flow_runner_refresh_failed",
      next: "inspect_flow_runner_state",
      message: payload.watch_issue,
      color: "critical",
    };
  }
  if (payload.current_notification && payload.latest_run && payload.latest_run.run_status === "operator_action_required") {
    return {
      label: "ACTION REQUIRED",
      reason: payload.latest_run.stop_reason,
      next: payload.latest_run.next_safe_action,
      message: payload.current_notification.summary || payload.latest_run.operator_message,
      color: payload.current_notification.severity === "critical" ? "critical" : "warn",
    };
  }
  if (payload.decision.recommended_action === "run_session" && payload.decision.next_safe_action === "run") {
    return {
      label: "READY",
      reason: payload.decision.action_reason,
      next: payload.decision.next_safe_action,
      message: "One bounded session can run now.",
      color: "ok",
    };
  }
  if (payload.decision.recommended_action === "run_session") {
    return {
      label: "LAUNCH BLOCKED",
      reason: payload.decision.action_reason,
      next: payload.decision.next_safe_action,
      message: "The loop has work, but host-side launch conditions are not ready.",
      color: "warn",
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

function renderTopBand(payload: AgentLoopWatchPayload, width: number, ansi: boolean, paused: boolean, refreshSeconds: number, notice: string): string[] {
  const headline = statusHeadline(payload);
  const focus = payload.focus_item;
  const liveState = paused ? "PAUSED" : "LIVE";
  const refreshed = payload.refreshed_at.slice(11, 19);
  const lines = [
    colorize(clampLine(`Bagakit Agent Loop | ${liveState} | refresh=${refreshSeconds.toFixed(1)}s | runner=${payload.runner_name} | refreshed=${refreshed}`, width), "title", ansi),
    colorize(clampLine(`${headline.label} | next=${headline.next} | reason=${headline.reason}`, width), headline.color, ansi),
    clampLine(
      focus
        ? `${focus.item_id} | stage=${focus.current_stage} | step=${focus.current_step_status} | source=${displaySource(focus)}`
        : "No active focus item.",
      width,
    ),
  ];
  if (notice.trim()) {
    lines.push(colorize(clampLine(`notice: ${notice}`, width), "muted", ansi));
  }
  return lines;
}

function renderActionPanel(payload: AgentLoopWatchPayload, width: number, ansi: boolean): string[] {
  const headline = statusHeadline(payload);
  const focus = payload.focus_item;
  const latestRun = payload.latest_run;
  const nextCommand = latestRun?.next_command_example || "none";
  return panel(
    colorize("Action", "title", ansi),
    [
      colorize(`${headline.label} | next=${headline.next} | reason=${headline.reason}`, headline.color, ansi),
      focus
        ? `item=${focus.item_id} | stage=${focus.current_stage} | step=${focus.current_step_status} | runner=${payload.runner_name} | lock=${payload.run_lock.status}`
        : `runner=${payload.runner_name} | lock=${payload.run_lock.status}`,
      headline.message,
      nextCommand === "none" ? "continue_with=none" : `continue_with=${nextCommand}`,
      payload.current_notification
        ? `attention=${payload.current_notification.severity} | ${payload.current_notification.summary}`
        : "attention=none",
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
      `source=${displaySource(focus)}`,
      `stage=${focus.current_stage} | step=${focus.current_step_status} | session=${focus.session_number}`,
      focus.checkpoint_request ? `checkpoint=${focus.checkpoint_request.stage}:${focus.checkpoint_request.session_status}` : "checkpoint=none",
      focus.current_safe_anchor ? `safe_anchor=${focus.current_safe_anchor.kind}:${focus.current_safe_anchor.summary}` : "safe_anchor=none",
      `handoff=${focus.handoff_path}`,
    ],
    width,
  );
}

function sessionSummaryLine(session: WatchSessionSummary | undefined): string[] {
  if (!session) {
    return ["latest_session=none"];
  }
  const lines = [
    `latest_session=${session.session_id} | result=${session.result_status || "-"} | exit=${session.exit_code ?? "-"} | signal=${session.signal ?? "-"}`,
  ];
  if (session.launch_error) {
    lines.push(`launch_error=${session.launch_error}`);
  }
  if (session.issue) {
    lines.push(`session_issue=${session.issue}`);
  }
  return lines;
}

function renderLoopPanel(payload: AgentLoopWatchPayload, width: number, ansi: boolean): string[] {
  const latestRun = payload.latest_run;
  const lines = [
    `runner=${payload.runner_name} | config=${payload.runner_config_status}`,
    payload.run_lock.status === "idle"
      ? "run_lock=idle"
      : `run_lock=${payload.run_lock.status} | pid=${payload.run_lock.pid ?? "-"} | since=${payload.run_lock.created_at ?? "-"}`,
    latestRun
      ? `latest_run=${latestRun.stop_reason} | can_resume=${latestRun.can_resume ? "yes" : "no"} | budget=${latestRun.sessions_launched} of ${latestRun.session_budget}`
      : "latest_run=none",
    latestRun ? latestRun.operator_message : "operator_message=none",
    ...(latestRun?.next_command_example ? [`next_command=${latestRun.next_command_example}`] : []),
    ...sessionSummaryLine(payload.latest_session),
  ];
  return panel(colorize("Loop Status", "title", ansi), lines, width);
}

function formatRunLine(run: RunRecord): string {
  return `${run.recorded_at.slice(11, 19)} ${run.stop_reason} -> ${run.next_safe_action} (${run.sessions_launched} of ${run.session_budget})`;
}

function formatSessionLine(session: WatchSessionSummary): string {
  const issue = session.launch_error ? ` launch=${session.launch_error}` : session.issue ? ` issue=${session.issue}` : "";
  return `${session.started_at ? session.started_at.slice(11, 19) : "--------"} ${session.session_id} result=${session.result_status || "-"} exit=${session.exit_code ?? "-"}${issue}`;
}

function renderHistoryPanel(payload: AgentLoopWatchPayload, width: number, ansi: boolean): string[] {
  const lines = [
    ...payload.recent_runs.slice(0, width >= 120 ? 4 : 3).map(formatRunLine),
    "",
    ...payload.recent_sessions.slice(0, width >= 120 ? 4 : 3).map(formatSessionLine),
  ];
  return panel(colorize("History", "title", ansi), lines, width);
}

function buildDetailLines(payload: AgentLoopWatchPayload): string[] {
  const lines: string[] = [];
  if (payload.latest_session?.issue) {
    lines.push("[session]");
    lines.push(payload.latest_session.issue);
  }
  if (payload.latest_session?.launch_error) {
    lines.push("[launch]");
    lines.push(`launch_error=${payload.latest_session.launch_error}`);
  }
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
  return lines.length > 0 ? lines : ["No detail is available yet."];
}

function renderFooter(width: number, ansi: boolean, paused: boolean, detailOffset: number, maxDetailOffset: number): string[] {
  const controls = "Controls: q quit | space pause | j/k scroll | g/G top/bottom | r refresh";
  const scroll = `Detail: offset=${detailOffset} of ${maxDetailOffset} | mode=${paused ? "paused" : "live"}`;
  return [
    colorize(clampLine(controls, width), "muted", ansi),
    colorize(clampLine(scroll, width), "muted", ansi),
  ];
}

export function renderWatchFrame(payload: AgentLoopWatchPayload, options: WatchRenderOptions): WatchRenderFrame {
  const width = Math.max(96, options.width);
  const height = Math.max(24, options.height ?? 40);
  const ansi = options.ansi;
  const paused = options.paused ?? false;
  const refreshSeconds = options.refreshSeconds ?? 1;
  const notice = options.notice ?? "";

  const topBand = renderTopBand(payload, width, ansi, paused, refreshSeconds, notice);
  const action = renderActionPanel(payload, width, ansi);
  const wide = width >= 132;
  const panelWidth = wide ? Math.floor((width - 2) / 2) : width;
  const focus = renderFocusPanel(payload, panelWidth, ansi);
  const loop = renderLoopPanel(payload, panelWidth, ansi);
  const middle = wide ? mergeColumns(focus, loop, panelWidth, panelWidth) : [...focus, "", ...loop];
  const history = renderHistoryPanel(payload, width, ansi);
  const footer = renderFooter(width, ansi, false, 0, 0);

  const chromeHeight = topBand.length + 1 + action.length + 1 + middle.length + 1 + history.length + 1 + footer.length + 1;
  const detailBodyHeight = Math.max(6, height - chromeHeight - 2);
  const detailFrame = scrollingPanel("Detail", buildDetailLines(payload), width, detailBodyHeight, options.detailOffset ?? 0);
  const actualFooter = renderFooter(width, ansi, paused, detailFrame.detailOffset, detailFrame.maxDetailOffset);

  const lines = [
    ...topBand,
    "",
    ...action,
    "",
    ...middle,
    "",
    ...history,
    "",
    ...detailFrame.text.trimEnd().split("\n"),
    "",
    ...actualFooter,
  ];

  return {
    text: `${lines.join("\n")}\n`,
    detailOffset: detailFrame.detailOffset,
    maxDetailOffset: detailFrame.maxDetailOffset,
    detailVisibleCount: detailFrame.detailVisibleCount,
    detailTotalCount: detailFrame.detailTotalCount,
  };
}

export function renderWatchScreen(payload: AgentLoopWatchPayload, options: { ansi: boolean; width: number }): string {
  return renderWatchFrame(payload, {
    ansi: options.ansi,
    width: options.width,
  }).text;
}
