export const TASK_STATUSES = ["planning", "in_progress", "review", "completed", "blocked"] as const;
export const PREFLIGHT_ANSWERS = ["yes", "no", "partial", "pending"] as const;
export const PREFLIGHT_DECISIONS = [
  "direct_execute",
  "compare_then_execute",
  "compose_then_execute",
  "review_loop",
  "pending",
] as const;
export const PLAN_KINDS = ["local", "external", "research", "custom"] as const;
export const PLAN_CONFIDENCE = ["low", "medium", "high"] as const;
export const PLAN_STATUSES = ["planned", "used", "not_used", "replaced", "deprecated"] as const;
export const COMPOSITION_ROLES = ["standalone", "composition_entrypoint", "composition_peer"] as const;
export const ACTIVATION_MODES = ["standalone", "composed"] as const;
export const FALLBACK_STRATEGIES = ["none", "standalone_first"] as const;
export const USAGE_PHASES = ["planning", "execution", "review", "postmortem"] as const;
export const USAGE_RESULTS = ["success", "partial", "failed", "not_used"] as const;
export const FEEDBACK_CHANNELS = ["user", "metric", "self_review"] as const;
export const FEEDBACK_SIGNALS = ["positive", "neutral", "negative"] as const;
export const SEARCH_SOURCE_SCOPES = ["local", "external", "hybrid"] as const;
export const SEARCH_STATUSES = ["open", "done", "discarded"] as const;
export const EVALUATION_OVERALL = ["pass", "conditional_pass", "fail", "pending"] as const;
export const RECIPE_STATUSES = ["considered", "selected", "used", "skipped", "rejected"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type PreflightAnswer = (typeof PREFLIGHT_ANSWERS)[number];
export type PreflightDecision = (typeof PREFLIGHT_DECISIONS)[number];
export type PlanKind = (typeof PLAN_KINDS)[number];
export type PlanConfidence = (typeof PLAN_CONFIDENCE)[number];
export type PlanStatus = (typeof PLAN_STATUSES)[number];
export type CompositionRole = (typeof COMPOSITION_ROLES)[number];
export type ActivationMode = (typeof ACTIVATION_MODES)[number];
export type FallbackStrategy = (typeof FALLBACK_STRATEGIES)[number];
export type UsagePhase = (typeof USAGE_PHASES)[number];
export type UsageResult = (typeof USAGE_RESULTS)[number];
export type FeedbackChannel = (typeof FEEDBACK_CHANNELS)[number];
export type FeedbackSignal = (typeof FEEDBACK_SIGNALS)[number];
export type SearchSourceScope = (typeof SEARCH_SOURCE_SCOPES)[number];
export type SearchStatus = (typeof SEARCH_STATUSES)[number];
export type EvaluationOverall = (typeof EVALUATION_OVERALL)[number];
export type RecipeStatus = (typeof RECIPE_STATUSES)[number];

export function normalizePreflightDecisionToken(raw: string): PreflightDecision {
  const value = raw.trim();
  if (value === "search_then_execute") {
    return "compare_then_execute";
  }
  if (PREFLIGHT_DECISIONS.includes(value as PreflightDecision)) {
    return value as PreflightDecision;
  }
  throw new Error(`invalid preflight.decision: ${raw}`);
}

export interface PreflightSection {
  question: string;
  answer: PreflightAnswer;
  gap_summary: string;
  decision: PreflightDecision;
}

export interface EvaluationSection {
  quality_score: number;
  evidence_score: number;
  feedback_score: number;
  overall: EvaluationOverall;
  summary: string;
}

export interface NextActionsSection {
  needs_feedback_confirmation: boolean;
  needs_new_search: boolean;
  next_search_query: string;
  notes: string;
}

export interface AttemptPolicySection {
  retry_backoff_threshold: number;
}

export interface SkillPlanEntry {
  timestamp: string;
  skill_id: string;
  kind: PlanKind;
  source: string;
  why: string;
  expected_impact: string;
  confidence: PlanConfidence;
  selected: boolean;
  status: PlanStatus;
  composition_role: CompositionRole;
  composition_id: string;
  activation_mode: ActivationMode;
  fallback_strategy: FallbackStrategy;
  notes: string;
}

export interface UsageLogEntry {
  timestamp: string;
  skill_id: string;
  phase: UsagePhase;
  action: string;
  result: UsageResult;
  evidence: string;
  metric_hint: string;
  attempt_key: string;
  attempt_index: number;
  backoff_required: boolean;
  notes: string;
}

export interface FeedbackLogEntry {
  timestamp: string;
  skill_id: string;
  channel: FeedbackChannel;
  signal: FeedbackSignal;
  detail: string;
  impact_scope: string;
  confidence: PlanConfidence;
}

export interface SearchLogEntry {
  timestamp: string;
  reason: string;
  query: string;
  source_scope: SearchSourceScope;
  status: SearchStatus;
  notes: string;
}

export interface BenchmarkLogEntry {
  timestamp: string;
  benchmark_id: string;
  metric: string;
  baseline: number;
  candidate: number;
  delta: number;
  higher_is_better: boolean;
  passed: boolean;
  notes: string;
}

export interface ErrorPatternLogEntry {
  timestamp: string;
  error_type: string;
  message_pattern: string;
  skill_id: string;
  occurrence_index: number;
  resolution: string;
  notes: string;
}

export interface RecipeLogEntry {
  timestamp: string;
  recipe_id: string;
  source: string;
  why: string;
  status: RecipeStatus;
  notes: string;
}

export interface SkillUsageDoc {
  schema_version: string;
  task_id: string;
  objective: string;
  owner: string;
  created_at: string;
  updated_at: string;
  status: TaskStatus;
  preflight: PreflightSection;
  evaluation: EvaluationSection;
  next_actions: NextActionsSection;
  attempt_policy: AttemptPolicySection;
  skill_plan: SkillPlanEntry[];
  usage_log: UsageLogEntry[];
  feedback_log: FeedbackLogEntry[];
  search_log: SearchLogEntry[];
  benchmark_log: BenchmarkLogEntry[];
  error_pattern_log: ErrorPatternLogEntry[];
  recipe_log: RecipeLogEntry[];
}

export interface SelectorDriverDirective {
  id: string;
  when: string;
  instruction: string;
}

export interface SelectorDriverPayload {
  skill_name: string;
  skill_source: string;
  driver_ref: string;
  driver_path: string;
  summary_line: string;
  directives: SelectorDriverDirective[];
  retry_backoff_threshold?: number;
}
