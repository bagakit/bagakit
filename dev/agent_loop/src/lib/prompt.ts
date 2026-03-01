import type { FlowItemState, FlowNextPayload, SessionBrief } from "./model.ts";
import { repoRelative, utcNow } from "./io.ts";
import { AgentLoopPaths } from "./paths.ts";

export function buildSessionBrief(
  root: string,
  sessionId: string,
  runnerName: string,
  paths: AgentLoopPaths,
  state: FlowItemState,
  nextPayload: FlowNextPayload,
  flowRunnerCommand: string[],
): SessionBrief {
  return {
    schema: "bagakit/agent-loop/session-brief/v1",
    session_id: sessionId,
    started_at: utcNow(),
    repo_root: ".",
    runner_name: runnerName,
    item: {
      item_id: state.item_id,
      title: state.title,
      source_kind: state.source_kind,
      source_ref: state.source_ref,
      status: state.status,
      resolution: state.resolution,
      current_stage: state.current_stage,
      current_step_status: state.current_step_status,
      item_path: nextPayload.item_path || state.paths.handoff.replace("handoff.md", "state.json"),
      handoff_path: state.paths.handoff,
      progress_log_path: state.paths.progress_log,
      session_number: state.runtime.session_count + 1,
      open_incident_ids: [...state.runtime.open_incident_ids],
    },
    flow_next: nextPayload,
    flow_runner_command: flowRunnerCommand,
    host_paths: {
      session_dir: repoRelative(root, paths.sessionDir(sessionId)),
      session_brief: repoRelative(root, paths.sessionBrief(sessionId)),
      prompt_file: repoRelative(root, paths.promptFile(sessionId)),
      stdout_file: repoRelative(root, paths.stdoutFile(sessionId)),
      stderr_file: repoRelative(root, paths.stderrFile(sessionId)),
      runner_result_file: repoRelative(root, paths.runnerResultFile(sessionId)),
    },
    boundaries: [
      "Treat bagakit-flow-runner as the only execution-truth surface.",
      "Do not archive the item from the runner session.",
      "Do not create a second planning or progress control plane.",
      "If source_kind is feature-tracker, do not override lifecycle ownership.",
    ],
    required_steps: [
      "Read the session brief and handoff before making changes.",
      "Operate on this one item only and keep the session bounded.",
      "Record a flow-runner checkpoint before exit.",
      "Write runner-result.json in the session directory before exit.",
    ],
  };
}

export function renderPrompt(brief: SessionBrief): string {
  return [
    "You are running one bounded Bagakit agent-loop session.",
    "",
    "Read these files first:",
    `- ${brief.host_paths.session_brief}`,
    `- ${brief.item.handoff_path}`,
    "",
    "Boundary rules:",
    ...brief.boundaries.map((line) => `- ${line}`),
    "",
    "Required before exit:",
    ...brief.required_steps.map((line) => `- ${line}`),
    "",
    "Finish by writing runner-result.json with this schema:",
    '{',
    '  "schema": "bagakit/agent-loop/runner-result/v1",',
    `  "session_id": "${brief.session_id}",`,
    '  "status": "completed",',
    '  "checkpoint_written": true,',
    '  "note": "one-line summary"',
    '}',
    "",
    "If you cannot finish normally, still write runner-result.json and set",
    '`status` to `operator_cancelled` or keep `checkpoint_written` false.',
  ].join("\n");
}
