import path from "node:path";

import type { FlowItemState, FlowNextPayload, SessionBrief } from "./model.ts";
import type { RecoverySessionContext } from "./continuation.ts";
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
  recovery?: RecoverySessionContext,
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
      session_meta_file: repoRelative(root, path.join(paths.sessionDir(sessionId), "session-meta.json")),
      runner_result_file: repoRelative(root, paths.runnerResultFile(sessionId)),
    },
    recovery_from: recovery
      ? {
          previous_session_id: recovery.previous_session_id,
          previous_stop_reason: recovery.previous_stop_reason,
          previous_operator_message: recovery.previous_operator_message,
          previous_host_paths: recovery.previous_host_paths,
        }
      : undefined,
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
  const recoverySection = brief.recovery_from
    ? [
        "",
        "Recovery context:",
        `- previous_session_id: ${brief.recovery_from.previous_session_id}`,
        `- previous_stop_reason: ${brief.recovery_from.previous_stop_reason}`,
        `- previous_operator_message: ${brief.recovery_from.previous_operator_message}`,
        `- inspect previous session meta first: ${brief.recovery_from.previous_host_paths.session_meta_file}`,
        `- inspect previous runner result: ${brief.recovery_from.previous_host_paths.runner_result_file}`,
        `- inspect previous stderr: ${brief.recovery_from.previous_host_paths.stderr_file}`,
        `- inspect previous stdout: ${brief.recovery_from.previous_host_paths.stdout_file}`,
        "- decide whether canonical progress already landed before continuing mutable work.",
      ]
    : [];
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
    ...recoverySection,
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
