export const CANDIDATE_KINDS = ["local", "external", "research", "tool"] as const;
export type CandidateKind = (typeof CANDIDATE_KINDS)[number];

export const PREFLIGHT_DECISIONS = ["skip", "note-only", "track"] as const;
export type PreflightDecision = (typeof PREFLIGHT_DECISIONS)[number];

export const ROUTE_DECISIONS = ["host", "upstream", "split"] as const;
export type RouteDecision = (typeof ROUTE_DECISIONS)[number];

export const CANDIDATE_STATUSES = [
  "planned",
  "trial",
  "promoted",
  "accepted",
  "rejected",
  "revisit",
] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const NOTE_KINDS = ["observation", "decision"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export const SIGNAL_KINDS = ["decision", "preference", "gotcha", "howto", "glossary"] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

export const SIGNAL_STATUSES = ["pending", "adopted", "dismissed"] as const;
export type SignalStatus = (typeof SIGNAL_STATUSES)[number];

export const SESSION_REVIEW_CHANNELS = ["session-review", "goal-review"] as const;
export type SessionReviewChannel = (typeof SESSION_REVIEW_CHANNELS)[number];

export const SESSION_SENSITIVITIES = ["public", "internal", "confidential", "restricted"] as const;
export type SessionSensitivity = (typeof SESSION_SENSITIVITIES)[number];

export const SESSION_PRIVACY_DISPOSITIONS = [
  "metadata_only",
  "approved_slices",
  "redacted",
  "restricted",
] as const;
export type SessionPrivacyDisposition = (typeof SESSION_PRIVACY_DISPOSITIONS)[number];

export const SESSION_RETENTION_DISPOSITIONS = [
  "retained",
  "expires",
  "expired",
  "deleted",
  "external",
] as const;
export type SessionRetentionDisposition = (typeof SESSION_RETENTION_DISPOSITIONS)[number];

export const SESSION_SIGNAL_OPERATIONS = ["add", "revise", "retire", "noop"] as const;
export type SessionSignalOperation = (typeof SESSION_SIGNAL_OPERATIONS)[number];

export const SESSION_REVIEW_CHECKS = ["pass", "fail", "unclear"] as const;
export type SessionReviewCheck = (typeof SESSION_REVIEW_CHECKS)[number];

export const SESSION_REVIEW_DISPOSITIONS = [
  "accepted",
  "rejected",
  "needs_more_evidence",
  "conflict_open",
] as const;
export type SessionReviewDisposition = (typeof SESSION_REVIEW_DISPOSITIONS)[number];

export const SOURCE_KINDS = ["article", "paper", "repo", "doc", "note"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const FEEDBACK_SIGNALS = ["positive", "negative", "mixed", "unclear"] as const;
export type FeedbackSignal = (typeof FEEDBACK_SIGNALS)[number];

export const TOPIC_STATUSES = ["active", "paused", "completed", "archived"] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];

export const PROMOTION_SURFACES = ["spec", "stewardship", "skill"] as const;
export type PromotionSurface = (typeof PROMOTION_SURFACES)[number];

export const PROMOTION_STATUSES = ["proposed", "landed"] as const;
export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];

export interface CandidateRecord {
  id: string;
  kind: CandidateKind;
  source: string;
  summary: string;
  status: CandidateStatus;
  added_at: string;
}

export interface NoteRecord {
  kind: NoteKind;
  text: string;
  created_at: string;
  title?: string;
  related_candidates?: string[];
  related_source_ids?: string[];
}

export interface PreflightRecord {
  decision: PreflightDecision;
  rationale: string;
  assessed_at: string;
}

export interface RoutingRecord {
  decision: RouteDecision;
  rationale: string;
  decided_at: string;
  host_target?: string;
  host_ref?: string;
  upstream_promotion_ids: string[];
}

export interface SourceRecord {
  id: string;
  kind: SourceKind;
  title: string;
  origin: string;
  local_ref?: string;
  summary_ref?: string;
  added_at: string;
}

export interface FeedbackRecord {
  channel: string;
  signal: FeedbackSignal;
  detail: string;
  created_at: string;
}

export interface BenchmarkRecord {
  id: string;
  metric: string;
  result: string;
  baseline?: string;
  detail?: string;
  created_at: string;
}

export interface PromotionRecord {
  id: string;
  surface: PromotionSurface;
  status: PromotionStatus;
  target: string;
  summary: string;
  ref?: string;
  proof_refs: string[];
  created_at: string;
  updated_at: string;
}

export interface IntakeSignalRecord {
  version: 1;
  id: string;
  kind: SignalKind;
  title: string;
  summary: string;
  producer: string;
  source_channel: string;
  topic_hint?: string;
  confidence: number;
  evidence: string[];
  local_refs: string[];
  status: SignalStatus;
  adopted_topic?: string;
  resolution_note?: string;
  created_at: string;
  updated_at: string;
}

export interface IntakeSignalContract {
  schema: "bagakit.evolver.signal.v1";
  producer: string;
  generated_at: string;
  signals: IntakeSignalRecord[];
}

export interface SessionEvidenceRef {
  session_id: string;
  run_id: string;
  source_channel: SessionReviewChannel;
  source_refs: string[];
  captured_at: string;
  sensitivity: SessionSensitivity;
  privacy_disposition: SessionPrivacyDisposition;
  retention_disposition: SessionRetentionDisposition;
  retention_until?: string;
  redaction_policy: string;
}

export interface SessionSourceSpan {
  ref: string;
  locator: string;
}

export interface EvolverSessionSignalCandidate {
  signal_id: string;
  operation: SessionSignalOperation;
  kind: SignalKind;
  title: string;
  statement: string;
  observed_outcome: string;
  proposed_generalization: string;
  scope: string;
  confidence: number;
  source_refs: string[];
  source_spans: SessionSourceSpan[];
  counterevidence_refs: string[];
  supersedes: string[];
  conflicts_with: string[];
  limitations: string[];
  topic_hint?: string;
}

export interface SessionSignalReviewReceipt {
  signal_id: string;
  coverage: SessionReviewCheck;
  preservation: SessionReviewCheck;
  faithfulness: SessionReviewCheck;
  disposition: SessionReviewDisposition;
  reviewer: string;
  reviewed_at: string;
  rationale: string;
}

export interface EvolverSessionReviewContract {
  schema: "bagakit.evolver.session-review.v1";
  producer: string;
  generated_at: string;
  session_evidence: SessionEvidenceRef;
  candidates: EvolverSessionSignalCandidate[];
  reviews: SessionSignalReviewReceipt[];
}

export interface TopicRecord {
  version: 1;
  slug: string;
  title: string;
  status: TopicStatus;
  created_at: string;
  updated_at: string;
  preflight?: PreflightRecord;
  routing?: RoutingRecord;
  local_context_refs: string[];
  candidates: CandidateRecord[];
  sources: SourceRecord[];
  feedback: FeedbackRecord[];
  benchmarks: BenchmarkRecord[];
  promotions: PromotionRecord[];
  notes: NoteRecord[];
}

export interface TopicIndexEntry {
  slug: string;
  title: string;
  status: TopicStatus;
  updated_at: string;
  preflight_decision?: PreflightDecision;
  local_context_ref_count: number;
  candidate_count: number;
  source_count: number;
  feedback_count: number;
  benchmark_count: number;
  promotion_count: number;
  note_count: number;
}

export interface EvolverIndex {
  version: 1;
  topics: TopicIndexEntry[];
}
