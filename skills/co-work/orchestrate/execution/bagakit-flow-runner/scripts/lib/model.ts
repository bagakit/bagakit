import { FLOW_PROTOCOL_SCHEMAS } from "./protocol/index.ts";
export {
  ACTION_REASONS,
  ARCHIVE_STATUSES,
  CLEAN_STATES,
  EXECUTION_MODES,
  FLOW_PROTOCOL_SCHEMAS,
  INCIDENT_RESUMES,
  INCIDENT_STATUSES,
  ITEM_STATUSES,
  RECOMMENDED_ACTIONS,
  RESOLUTION_KINDS,
  SESSION_STATUSES,
  STEP_STATUSES,
  type ActionReason,
  type ArchiveStatus,
  type CheckpointPayload,
  type CheckpointReceipt,
  type CleanState,
  type ExecutionMode,
  type FlowMutationReceipt,
  type IncidentRecord,
  type IncidentResume,
  type IncidentStatus,
  type ItemPaths,
  type ItemRuntime,
  type ItemState,
  type ItemStatus,
  type ItemStep,
  type LoopRecipe,
  type LoopStage,
  type NextActionPayload,
  type ProgressEntry,
  type RecommendedAction,
  type ResolutionKind,
  type ResumeCandidate,
  type ResumeCandidatesPayload,
  type RunnerPolicy,
  type SafeAnchor,
  type SessionContract,
  type SessionStatus,
  type StepStatus,
} from "./protocol/index.ts";

export const ITEM_SCHEMA = FLOW_PROTOCOL_SCHEMAS.item;
export const POLICY_SCHEMA = FLOW_PROTOCOL_SCHEMAS.policy;
export const RECIPE_SCHEMA = FLOW_PROTOCOL_SCHEMAS.recipe;
export const NEXT_SCHEMA = FLOW_PROTOCOL_SCHEMAS.nextAction;
export const ACTIVATION_SCHEMA = "bagakit/flow-runner/feature-activation/v1";
export const CHECKPOINT_SCHEMA = FLOW_PROTOCOL_SCHEMAS.checkpoint;
export const RESUME_SCHEMA = FLOW_PROTOCOL_SCHEMAS.resumeCandidates;
export const PLAN_REVISION_SCHEMA = "bagakit/flow-runner/plan-revision/v1";
export const INCIDENT_SCHEMA = FLOW_PROTOCOL_SCHEMAS.incident;
export const SNAPSHOT_SCHEMA = "bagakit/flow-runner/snapshot/v1";
export const PROGRESS_SCHEMA = FLOW_PROTOCOL_SCHEMAS.progress;
export const MUTATION_RECEIPT_SCHEMA = FLOW_PROTOCOL_SCHEMAS.mutationReceipt;

export type FeatureActivationPayload = Readonly<{
  schema: typeof ACTIVATION_SCHEMA;
  command: "activate-feature-tracker";
  feature_id: string;
  item_id: string;
  item_path: string;
  source_state_path: string;
  workspace_mode: string;
  source_status: string;
  flow_next: import("./protocol/index.ts").NextActionPayload;
}>;

export type PlanRevision = Readonly<{
  schema: typeof PLAN_REVISION_SCHEMA;
  revision_id: string;
  created_at: string;
  source_kind: string;
  source_ref: string;
  title_snapshot: string;
  current_task_snapshot: string;
  notes: string[];
}>;

export type SnapshotMetadata = Readonly<{
  schema: typeof SNAPSHOT_SCHEMA;
  snapshot_id: string;
  item_id: string;
  created_at: string;
  label: string;
  branch: string;
  head: string;
  has_untracked_archive: boolean;
}>;
