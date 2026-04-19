export const GRILL_SCHEMA = "bagakit/grill-run/v1";

export const NODE_KINDS = ["question", "research_needed"] as const;
export const NODE_STATUSES = [
  "pending",
  "ready",
  "answered",
  "research_needed",
  "evidence_attached",
  "skipped",
] as const;
export const RUN_STATUSES = ["planning", "active", "research_blocked", "convergence_pending", "complete"] as const;
export const CONVERGENCE_STATUSES = ["not_needed", "pending", "resolved"] as const;
export const CONVERGENCE_DECISIONS = ["close", "switch", "correct"] as const;

export type NodeKind = (typeof NODE_KINDS)[number];
export type NodeStatus = (typeof NODE_STATUSES)[number];
export type RunStatus = (typeof RUN_STATUSES)[number];
export type ConvergenceStatus = (typeof CONVERGENCE_STATUSES)[number];
export type ConvergenceDecision = (typeof CONVERGENCE_DECISIONS)[number];

export interface EvidenceRef {
  ref: string;
  summary: string;
  attached_at: string;
}

export interface GrillNode {
  id: string;
  kind: NodeKind;
  status: NodeStatus;
  depends_on: string[];
  question: string;
  options_considered: string[];
  decision_protected: string;
  recommended_answer: string;
  rationale: string;
  risk_if_wrong: string;
  evidence_refs: EvidenceRef[];
  created_at: string;
  updated_at: string;
}

export interface QAEvent {
  event_id: string;
  node_id: string;
  question: string;
  options_considered: string[];
  recommended_answer: string;
  raw_answer: string;
  answered_at: string;
}

export interface ConvergenceCheck {
  status: ConvergenceStatus;
  answer_count: number;
  goal_or_principle: string;
  signal: string;
  adjacent_branch: string;
  decision: "" | ConvergenceDecision;
  note: string;
  resolved_at: string;
  updated_at: string;
}

export interface GrillRun {
  schema: typeof GRILL_SCHEMA;
  run_id: string;
  target_snapshot: string;
  target_ref: string;
  status: RunStatus;
  created_at: string;
  updated_at: string;
  question_nodes: GrillNode[];
  qa_events: QAEvent[];
  convergence_check: ConvergenceCheck;
  render: {
    brief_path: string;
    last_rendered_at: string;
  };
}

export function utcNow(): string {
  return new Date().toISOString().replace(new RegExp("\\.\\d{3}Z$"), "Z");
}

export function slugify(raw: string): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(new RegExp("[^a-z0-9]+", "g"), "-")
    .replace(new RegExp("-+", "g"), "-")
    .replace(new RegExp("^-|-$", "g"), "");
  if (!slug) {
    throw new Error("slug became empty");
  }
  return slug;
}

export function assertKnown<T extends readonly string[]>(values: T, raw: string, label: string): T[number] {
  if (values.includes(raw as T[number])) {
    return raw as T[number];
  }
  throw new Error(`invalid ${label}: ${raw}`);
}
