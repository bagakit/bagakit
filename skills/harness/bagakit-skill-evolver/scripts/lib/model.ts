export const CANDIDATE_KINDS = ["local", "external", "research", "tool"] as const;
export type CandidateKind = (typeof CANDIDATE_KINDS)[number];

export const PREFLIGHT_DECISIONS = ["skip", "note-only", "track"] as const;
export type PreflightDecision = (typeof PREFLIGHT_DECISIONS)[number];

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
}

export interface PreflightRecord {
  decision: PreflightDecision;
  rationale: string;
  assessed_at: string;
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
  created_at: string;
  updated_at: string;
}

export interface TopicRecord {
  version: 1;
  slug: string;
  title: string;
  status: TopicStatus;
  created_at: string;
  updated_at: string;
  preflight?: PreflightRecord;
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
