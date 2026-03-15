import type { SessionHostSnapshot } from "./session_host_snapshot.ts";

export type SessionExecutionState = "pending" | "running" | "completed" | "cancelled" | "degraded";

export type SessionHostStatus = Readonly<{
  session_id: string;
  item_id: string;
  runner_name: string;
  started_at: string;
  execution_state: SessionExecutionState;
  summary: string;
  issue_count: number;
}>;

export function deriveSessionHostStatus(snapshot: SessionHostSnapshot): SessionHostStatus {
  const activeSessionArtifactsPending =
    snapshot.issues.length > 0 &&
    snapshot.issues.every(
      (entry) => entry.code === "meta_missing" || entry.code === "result_missing" || entry.code === "artifact_missing",
    );
  if (activeSessionArtifactsPending && snapshot.started_at && snapshot.runner_result === null) {
    return {
      session_id: snapshot.session_id,
      item_id: snapshot.item_id,
      runner_name: snapshot.runner_name,
      started_at: snapshot.started_at,
      execution_state: "running",
      summary: "runner session is still active or has not written host artifacts yet",
      issue_count: snapshot.issues.length,
    };
  }
  if (snapshot.issues.length > 0) {
    return {
      session_id: snapshot.session_id,
      item_id: snapshot.item_id,
      runner_name: snapshot.runner_name,
      started_at: snapshot.started_at,
      execution_state: "degraded",
      summary: snapshot.issues[0]?.message || "session artifacts are degraded",
      issue_count: snapshot.issues.length,
    };
  }
  if (snapshot.runner_result?.status === "completed") {
    return {
      session_id: snapshot.session_id,
      item_id: snapshot.item_id,
      runner_name: snapshot.runner_name,
      started_at: snapshot.started_at,
      execution_state: "completed",
      summary: snapshot.runner_result.note,
      issue_count: 0,
    };
  }
  if (snapshot.runner_result?.status === "operator_cancelled") {
    return {
      session_id: snapshot.session_id,
      item_id: snapshot.item_id,
      runner_name: snapshot.runner_name,
      started_at: snapshot.started_at,
      execution_state: "cancelled",
      summary: snapshot.runner_result.note,
      issue_count: 0,
    };
  }
  if (snapshot.exit_code === null && snapshot.started_at) {
    return {
      session_id: snapshot.session_id,
      item_id: snapshot.item_id,
      runner_name: snapshot.runner_name,
      started_at: snapshot.started_at,
      execution_state: "running",
      summary: "runner session is still active or did not write a result yet",
      issue_count: 0,
    };
  }
  return {
    session_id: snapshot.session_id,
    item_id: snapshot.item_id,
    runner_name: snapshot.runner_name,
    started_at: snapshot.started_at,
    execution_state: "pending",
    summary: "session artifacts exist but execution has not produced a terminal result",
    issue_count: 0,
  };
}
