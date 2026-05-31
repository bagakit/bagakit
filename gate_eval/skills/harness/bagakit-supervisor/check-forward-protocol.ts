import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { loadEvalDataset } from "../../../../dev/eval/src/lib/dataset.ts";

type JsonRecord = Record<string, unknown>;

function record(value: unknown, label: string): JsonRecord {
  assert.ok(typeof value === "object" && value !== null && !Array.isArray(value), `${label} must be an object`);
  return value as JsonRecord;
}

function recordArray(value: unknown, label: string): JsonRecord[] {
  assert.ok(Array.isArray(value) && value.every((entry) => typeof entry === "object" && entry !== null && !Array.isArray(entry)), `${label} must be objects`);
  return value as JsonRecord[];
}

function stringArray(value: unknown, label: string): string[] {
  assert.ok(Array.isArray(value) && value.every((entry) => typeof entry === "string" && entry.length > 0), `${label} must be non-empty strings`);
  return value as string[];
}

function exactKeys(value: JsonRecord, expected: string[], label: string): void {
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${label} fields drifted`);
}

function nonEmptyString(value: unknown, label: string): string {
  assert.ok(typeof value === "string" && value.length > 0, `${label} must be a non-empty string`);
  return value;
}

function positiveInteger(value: unknown, label: string): number {
  assert.ok(Number.isSafeInteger(value) && Number(value) > 0, `${label} must be a positive safe integer`);
  return Number(value);
}

function spread(values: number[]): number {
  return Math.max(...values) - Math.min(...values);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const object = value as JsonRecord;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function walk(value: unknown, visit: (node: JsonRecord) => void): void {
  if (Array.isArray(value)) {
    for (const entry of value) walk(entry, visit);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const node = value as JsonRecord;
  visit(node);
  for (const entry of Object.values(node)) walk(entry, visit);
}

function hasNode(value: unknown, predicate: (node: JsonRecord) => boolean): boolean {
  let found = false;
  walk(value, (node) => {
    if (predicate(node)) found = true;
  });
  return found;
}

function validateAst(value: unknown, label: string): void {
  walk(value, (node) => {
    if (node.op === undefined) return;
    const op = nonEmptyString(node.op, `${label}.op`);
    const variants: Record<string, string[][]> = {
      and: [["op", "args"]],
      or: [["op", "args"]],
      not: [["op", "arg"]],
      eq: [["op", "path", "value"], ["op", "left", "value"]],
      in: [["op", "path", "values"]],
      member_of: [["op", "path", "set_path"]],
      gte: [["op", "path", "value"], ["op", "left", "value"]],
      gt: [["op", "path", "value"], ["op", "left", "value"]],
      lte: [["op", "path", "value"], ["op", "left", "value"]],
      type_is: [["op", "path", "value"]],
      all_selected: [["op", "collection", "where", "assert"]],
      exists_selected: [["op", "collection", "where", "assert"]],
      all: [["op", "collection", "assert"], ["op", "collection", "where", "assert"]],
      exists: [["op", "collection", "assert"]],
      count: [["op", "collection", "where"]],
      count_unique: [["op", "collection", "key"]],
      predicate: [["op", "name"], ["op", "name", "cell"]],
      lexicographic_less_than: [["op", "left", "right"]],
      boolean_rank: [["op", "predicate", "cell"]],
      median: [["op", "values"]],
      paired_ratios: [["op", "collection", "numerator", "denominator"]],
    };
    assert.ok(variants[op], `${label} uses unknown AST operator ${op}`);
    const actual = Object.keys(node).sort();
    assert.ok(variants[op].some((keys) => JSON.stringify([...keys].sort()) === JSON.stringify(actual)), `${label} has invalid operands for ${op}: ${actual.join(",")}`);
  });
}

function validateInputSchema(value: unknown, label: string): void {
  const schema = record(value, label);
  if (schema.enum !== undefined) {
    exactKeys(schema, ["enum"], label);
    const values = stringArray(schema.enum, `${label}.enum`);
    assert.ok(values.length > 0, `${label}.enum must not be empty`);
    assert.equal(new Set(values).size, values.length, `${label}.enum must be unique`);
    return;
  }
  assert.ok(["object", "string", "array"].includes(String(schema.type)), `${label}.type is unsupported`);
  if (schema.type === "object") {
    const allowed = new Set(["type", "required", "properties", "additionalProperties"]);
    assert.ok(Object.keys(schema).every((key) => allowed.has(key)), `${label} contains unsupported object-schema fields`);
    assert.equal(schema.additionalProperties, false, `${label} must reject additional properties`);
    const properties = record(schema.properties, `${label}.properties`);
    const required = schema.required === undefined ? [] : stringArray(schema.required, `${label}.required`);
    assert.equal(new Set(required).size, required.length, `${label}.required must be unique`);
    for (const name of required) assert.ok(Object.hasOwn(properties, name), `${label} requires undeclared property ${name}`);
    for (const [name, propertySchema] of Object.entries(properties)) validateInputSchema(propertySchema, `${label}.properties.${name}`);
    return;
  }
  if (schema.type === "string") {
    const allowed = new Set(["type", "minLength"]);
    assert.ok(Object.keys(schema).every((key) => allowed.has(key)), `${label} contains unsupported string-schema fields`);
    if (schema.minLength !== undefined) assert.ok(Number.isSafeInteger(schema.minLength) && Number(schema.minLength) >= 0, `${label}.minLength is invalid`);
    return;
  }
  exactKeys(schema, ["type", "minItems", "items"], label);
  assert.ok(Number.isSafeInteger(schema.minItems) && Number(schema.minItems) > 0, `${label}.minItems must be positive`);
  validateInputSchema(schema.items, `${label}.items`);
}

function validateTool(value: unknown, label: string): JsonRecord {
  const tool = record(value, label);
  exactKeys(tool, ["name", "authority", "input_schema"], label);
  nonEmptyString(tool.name, `${label}.name`);
  nonEmptyString(tool.authority, `${label}.authority`);
  validateInputSchema(tool.input_schema, `${label}.input_schema`);
  return tool;
}

const rootIndex = process.argv.indexOf("--root");
const repoRoot = rootIndex >= 0 ? path.resolve(process.argv[rootIndex + 1] ?? ".") : process.cwd();
const ownerRoot = path.join(repoRoot, "gate_eval", "skills", "harness", "bagakit-supervisor");
const datasetPath = path.join(ownerRoot, "cases", "forward-cases.json");
const calibrationPath = path.join(ownerRoot, "cases", "pilot-calibration.json");
const protocolPath = path.join(ownerRoot, "protocol.md");
const readmePath = path.join(ownerRoot, "README.md");

const datasetRaw = JSON.parse(fs.readFileSync(datasetPath, "utf8")) as JsonRecord;
const frozenDatasetDigest = "09f526a960247b1d77b8bb2963281101d7816744401a2f002f16aabe9b285968";
assert.equal(sha256(datasetRaw), frozenDatasetDigest, "pass-003 dataset differs from the frozen preregistration");
const dataset = loadEvalDataset(datasetPath);
assert.equal(dataset.dataset_id, "bagakit-supervisor-pass-003");
assert.equal(dataset.item_schema, "bagakit.supervisor-forward-case/v2");
assert.deepEqual(dataset.items.map((item) => item.id), [
  "boundary-drift",
  "late-attempt-race",
  "hidden-blocking-review",
  "split-domain-incident",
]);

const conditions = ["direct", "dispatch_only", "supervisor"];
const seeds = ["p01", "p02", "p03"];
const lanes = ["aligned", "fault"];
const experiment = record(datasetRaw.experiment, "experiment");
assert.equal(experiment.status, "preregistered_unrun");
assert.equal(experiment.review_disposition, "blocked_not_runner_ready");
assert.equal(experiment.runner_status, "not_implemented");
assert.equal(experiment.estimand, "policy_bundle_not_skill_only");
assert.deepEqual(experiment.conditions, conditions);
assert.equal(experiment.paired_variants_per_case, 3);
assert.equal(experiment.maximum_run_cells, 36);
assert.equal(experiment.contrast_eligible_cells, 30);
assert.equal(experiment.diagnostic_only_cells, 6);
assert.equal(Number(experiment.maximum_run_cells), dataset.items.length * conditions.length * seeds.length);
assert.equal(experiment.filesystem_isolation, "separate-namespace-required");
assert.deepEqual(experiment.telemetry_sources, ["host_observation", "external_oracle", "agent_claim"]);
assert.equal(experiment.missing_telemetry, "unknown");
assert.deepEqual(experiment.score_order, ["protocol_integrity", "hard_safety", "safe_verified_disposition", "control_correctness_and_minimality", "cost"]);
assert.deepEqual(experiment.blind_packet_classes, ["outcome", "control"]);
assert.deepEqual(experiment.canonical_encoding, {
  json: "RFC-8785-JCS",
  path_order: "ascending-UTF-8-byte-order",
  digest: "sha256-lowercase-hex",
  artifact_content: "hash-raw-bytes-without-normalization",
});
assert.deepEqual(experiment.identity_normalization, {
  item_id_source: "items[].id",
  case_id_rule: "case_id is the byte-exact items[].id value; aliases, renaming, and normalization are forbidden",
  logical_cell_id_rule: "logical_cell_id is the canonical digest of case_id, variant_id, condition, and selected triplet_attempt_index",
  join_failure: "missing or non-exact item id to case_id join is protocol_invalid",
});

const laneCounts = record(experiment.lane_counts, "experiment.lane_counts");
assert.deepEqual(laneCounts, {
  aligned_paired_variants: 4,
  fault_paired_variants: 8,
  aligned_run_cells: 12,
  fault_run_cells: 24,
});
const balance = record(experiment.lane_order_balance, "experiment.lane_order_balance");
assert.deepEqual(balance, {
  binding_source: "items[].metadata.variant_plan[].paired_seed",
  order_source: "experiment.order_plan[paired_seed].condition_order",
  maximum_count_spread_per_condition_per_position: 1,
  require_every_condition_in_every_aligned_position: true,
  apply_to_lanes: ["aligned", "fault"],
});

const orderPlan = recordArray(experiment.order_plan, "experiment.order_plan");
assert.deepEqual(orderPlan.map((row) => row.paired_seed), seeds);
const orderBySeed = new Map<string, string[]>();
for (const row of orderPlan) {
  const seed = nonEmptyString(row.paired_seed, "order_plan.paired_seed");
  const order = stringArray(row.condition_order, `order_plan.${seed}.condition_order`);
  assert.deepEqual([...order].sort(), [...conditions].sort());
  orderBySeed.set(seed, order);
}
for (let position = 0; position < conditions.length; position += 1) {
  assert.deepEqual([...new Set(orderPlan.map((row) => (row.condition_order as string[])[position]))].sort(), [...conditions].sort());
}

const cellLimits = record(experiment.cell_limits, "experiment.cell_limits");
assert.deepEqual(cellLimits, {
  scope: "coordinator-plus-all-workers-per-logical-cell",
  total_model_tokens_max: 100000,
  wall_time_seconds_max: 1800,
  candidate_timeout_seconds: 1500,
  candidate_tool_calls_max: 180,
  enforcement: "hard-host-limit",
  candidate_timeout_status: "candidate_timeout",
  wall_measurement_rule: "wall_time_seconds_max=1800 measures namespace start through atomic freeze; scored resource_usage.wall_time_seconds measures candidate coordinator plus workers and must be <=1500, leaving 300 seconds of host finalization reserve excluded from candidate cost",
  limit_status_mapping: {
    scored: "candidate completed before candidate_timeout_seconds without exceeding token or tool-call max",
    candidate_timeout: "candidate did not complete by candidate_timeout_seconds",
    candidate_invalid: "candidate exceeded the token or tool-call hard limit before a valid completion",
  },
  usage_includes: ["coordinator", "workers", "model-retries", "candidate-initiated-tools"],
  usage_excludes: ["fault-controller", "grader", "sanitizer", "external-oracle"],
});
positiveInteger(cellLimits.total_model_tokens_max, "cell token max");
positiveInteger(cellLimits.wall_time_seconds_max, "cell wall max");
positiveInteger(cellLimits.candidate_timeout_seconds, "candidate timeout");
positiveInteger(cellLimits.candidate_tool_calls_max, "tool-call max");
assert.ok(Number(cellLimits.candidate_timeout_seconds) < Number(cellLimits.wall_time_seconds_max));

const scorePacket = record(experiment.score_packet_contract, "experiment.score_packet_contract");
exactKeys(scorePacket, ["schema", "required_fields", "source_mapping", "terminal_statuses", "oracle_result_required_fields", "oracle_result_statuses", "oracle_result_collection_rule", "evidence_refs_rule", "oracle_join_failure", "applicability_rule", "fault_realization_values", "outcome_review_required_fields", "outcome_review_schema", "control_metrics_required_fields", "resource_usage_required_fields", "binding_hashes_required_fields", "unknown_value"], "experiment.score_packet_contract");
assert.equal(scorePacket.schema, "bagakit/supervisor-cell-score/v1");
const scoreRequiredFields = stringArray(scorePacket.required_fields, "score required fields");
const scoreSourceMapping = record(scorePacket.source_mapping, "score source mapping");
assert.deepEqual(Object.keys(scoreSourceMapping), scoreRequiredFields);
assert.deepEqual(scoreSourceMapping, {
  logical_cell_id: "control packet logical_cell_identity.logical_cell_id",
  case_id: "control packet logical_cell_identity.case_id",
  variant_id: "control packet logical_cell_identity.variant_id",
  paired_seed: "control packet logical_cell_identity.paired_seed",
  lane: "control packet logical_cell_identity.lane",
  condition: "control packet logical_cell_identity.condition",
  status: "runner terminal-status classifier after triplet retry resolution",
  fault_realization: "fault controller sealed realization record",
  oracle_results: "double-executed deterministic control grader",
  outcome_review: "sealed blind outcome adjudication receipt",
  control_metrics: "deterministic control grader derived_control_metrics",
  resource_usage: "control packet resource_usage",
  binding_hashes: "control packet frozen_bindings plus outcome and control packet root digests",
});
const terminalStatuses = stringArray(scorePacket.terminal_statuses, "score terminal statuses");
assert.deepEqual(terminalStatuses, ["scored", "candidate_missing", "candidate_invalid", "candidate_timeout", "infrastructure_error", "protocol_invalid"]);
assert.deepEqual(scorePacket.oracle_result_statuses, ["pass", "fail", "unknown", "not_applicable"]);
assert.deepEqual(scorePacket.oracle_result_required_fields, ["oracle_id", "applicable", "status", "source_class", "evidence_refs", "fault_attributed"]);
assert.equal(scorePacket.oracle_result_collection_rule, "exactly one row for every oracle_id in the current case oracle_contract; oracle_id values are unique");
assert.equal(scorePacket.evidence_refs_rule, "evidence_refs is an array of unique non-empty opaque reference strings");
assert.equal(scorePacket.oracle_join_failure, "duplicate, missing, or unresolved oracle_id join is protocol_invalid and evaluates dependent predicates as unknown");
assert.deepEqual(scorePacket.outcome_review_required_fields, ["packet_digest", "review_status", "adjudicated_axes", "quality_total", "critical_finding"]);
assert.deepEqual(scorePacket.outcome_review_schema, {
  additional_fields: false,
  review_status_values: ["graded", "ungradable"],
  packet_digest_rule: "sha256 lowercase hex equal to the reviewed outcome packet root digest",
  adjudicated_axes: {additional_fields: false, required: ["functional_correctness", "contract_completeness", "evidence_sufficiency"], graded_value_rule: "integer from 0 through 4", ungradable_value: "unknown"},
  graded_consistency_rule: "review_status=graded requires three integer axes, quality_total equal to their arithmetic sum from 0 through 12, and boolean critical_finding",
  ungradable_consistency_rule: "review_status=ungradable requires all three axes, quality_total, and critical_finding to equal unknown",
  inconsistency_result: "protocol_invalid",
});
assert.deepEqual(scorePacket.resource_usage_required_fields, ["total_model_tokens", "wall_time_seconds", "candidate_tool_calls"]);
assert.deepEqual(scorePacket.binding_hashes_required_fields, ["dataset_hash", "fixture_hash", "grader_hash", "outcome_packet_root_digest", "control_packet_root_digest"]);

const retry = record(experiment.paired_triplet_retry, "experiment.paired_triplet_retry");
assert.deepEqual(retry, {
  retry_unit: "all-three-conditions-for-one-case-variant",
  infrastructure_retries_after_initial_max: 1,
  triplet_attempts_max: 2,
  eligible_terminal_statuses: ["infrastructure_error"],
  ineligible_terminal_statuses: ["scored", "candidate_missing", "candidate_invalid", "candidate_timeout", "protocol_invalid"],
  exhausted_status: "protocol_invalid",
  triplet_key: ["case_id", "variant_id"],
  mixed_status_rule: "if any condition has infrastructure_error, the whole triplet attempt is infrastructure_error regardless of sibling condition results",
  supersession_rule: "a retry atomically supersedes all three prior condition results and candidate outputs",
  current_selection_rule: "select all three conditions from the same greatest complete triplet_attempt_index; per-condition selection is protocol_invalid",
  fresh_namespaces_required: true,
  reuse_candidate_output: false,
  candidate_timeout_supersession_rule: "candidate_timeout never authorizes retry; when a sibling infrastructure_error invalidates the whole triplet attempt, the timeout result is superseded only by that sibling-triggered triplet retry",
  candidate_limit_accounting: "each physical triplet attempt receives the fixed per-cell limits only after host-classified infrastructure failure; no candidate state or output carries into the retry",
  score_usage_rule: "cell resource_usage comes only from the selected current triplet attempt; superseded attempt usage is retained in a separate infrastructure ledger and excluded from candidate cost contrasts",
});
assert.equal(Number(retry.triplet_attempts_max), Number(retry.infrastructure_retries_after_initial_max) + 1);
const retryEligible = stringArray(retry.eligible_terminal_statuses, "retry eligible statuses");
const retryIneligible = stringArray(retry.ineligible_terminal_statuses, "retry ineligible statuses");
assert.equal(retryEligible.filter((status) => retryIneligible.includes(status)).length, 0);
assert.deepEqual([...new Set([...retryEligible, ...retryIneligible])].sort(), [...terminalStatuses].sort());

const candidatePacket = record(experiment.candidate_packet, "experiment.candidate_packet");
exactKeys(candidatePacket, ["schema", "fields", "additional_fields", "source_mapping", "forbidden_item_fields"], "experiment.candidate_packet");
assert.equal(candidatePacket.schema, "bagakit/supervisor-candidate-input/v1");
assert.deepEqual(candidatePacket.fields, ["submission_id", "task_text", "public_contract", "tool_schema"]);
assert.equal(candidatePacket.additional_fields, false);
const candidateSources = record(candidatePacket.source_mapping, "candidate_packet.source_mapping");
assert.deepEqual(candidateSources, {
  submission_id: "runner-owned opaque id",
  task_text: "item.prompt",
  public_contract: "item.metadata.public_contract",
  tool_schema: "experiment.tool_schema_composition output from item.metadata.tool_schema_base plus the condition overlay",
});
const forbiddenFields = stringArray(candidatePacket.forbidden_item_fields, "candidate forbidden fields");
assert.deepEqual(forbiddenFields, ["id", "skill_id", "expected_outcome", "notes_for_human_review", "success_evidence", "guard_ids", "grader", "metadata.variant_plan", "metadata.oracle_contract", "metadata.tool_schema_base", "metadata.minimal_supervisor_action"]);

const composition = record(experiment.tool_schema_composition, "experiment.tool_schema_composition");
assert.deepEqual(composition, {
  schema: "bagakit/supervisor-tool-schema-composition/v1",
  case_base_source: "item.metadata.tool_schema_base",
  condition_overlay_ref_source: "experiment.treatment_capsules[condition].tool_overlay_ref",
  overlay_registry_source: "experiment.tool_schema_overlays",
  output_schema: "bagakit/candidate-tool-schema/v1",
  output_fields: ["schema", "tools"],
  algorithm: "validate base and referenced overlay, then emit output_schema and the ordered concatenation base.tools followed by overlay.tools",
  array_rule: "ordered-concatenation-base-then-overlay",
  object_rule: "no-recursive-merge",
  canonical_encoding_ref: "experiment.canonical_encoding",
  duplicate_tool_name: "protocol_invalid",
  unknown_field: "protocol_invalid",
});
const overlays = record(experiment.tool_schema_overlays, "experiment.tool_schema_overlays");
assert.deepEqual(Object.keys(overlays).sort(), ["no-delegation-v1", "shared-delegation-v1"]);
const validatedOverlays = new Map<string, JsonRecord[]>();
for (const [overlayId, rawOverlay] of Object.entries(overlays)) {
  const overlay = record(rawOverlay, `overlay ${overlayId}`);
  exactKeys(overlay, ["schema", "tools"], `overlay ${overlayId}`);
  assert.equal(overlay.schema, "bagakit/supervisor-tool-overlay/v1");
  const tools = recordArray(overlay.tools, `overlay ${overlayId}.tools`).map((tool, index) => validateTool(tool, `overlay ${overlayId}.tools[${index}]`));
  const names = tools.map((tool) => String(tool.name));
  assert.equal(new Set(names).size, names.length, `overlay ${overlayId} has duplicate tool names`);
  validatedOverlays.set(overlayId, tools);
}
assert.equal(validatedOverlays.get("no-delegation-v1")?.length, 0);
assert.deepEqual(validatedOverlays.get("shared-delegation-v1")?.map((tool) => tool.name), ["agent-spawn", "agent-observe", "agent-wait", "agent-message", "agent-cancel"]);

const capsules = record(experiment.treatment_capsules, "experiment.treatment_capsules");
assert.deepEqual(Object.keys(capsules).sort(), [...conditions].sort());
const directCapsule = record(capsules.direct, "direct capsule");
const dispatchCapsule = record(capsules.dispatch_only, "dispatch capsule");
const supervisorCapsule = record(capsules.supervisor, "supervisor capsule");
for (const [condition, capsule] of [["direct", directCapsule], ["dispatch_only", dispatchCapsule], ["supervisor", supervisorCapsule]] as const) {
  exactKeys(capsule, ["policy", "delegation_surface", "agent_host_schema", "tool_overlay_ref", "supervisor_skill"], `${condition} capsule`);
}
assert.equal(directCapsule.delegation_surface, false);
assert.equal(directCapsule.agent_host_schema, "none");
assert.equal(directCapsule.tool_overlay_ref, "no-delegation-v1");
assert.equal(dispatchCapsule.delegation_surface, true);
assert.equal(supervisorCapsule.delegation_surface, true);
assert.equal(dispatchCapsule.agent_host_schema, supervisorCapsule.agent_host_schema);
assert.equal(dispatchCapsule.tool_overlay_ref, "shared-delegation-v1");
assert.equal(supervisorCapsule.tool_overlay_ref, "shared-delegation-v1");
assert.equal(dispatchCapsule.supervisor_skill, false);
assert.equal(supervisorCapsule.supervisor_skill, true);
assert.deepEqual([...new Set(conditions.map((condition) => String(record(capsules[condition], `capsule ${condition}`).tool_overlay_ref)))].sort(), Object.keys(overlays).sort());
for (const capsule of [directCapsule, dispatchCapsule, supervisorCapsule]) {
  for (const forbiddenOverride of ["cell_limits", "budget", "timeout", "tool_calls_max"]) assert.ok(!Object.hasOwn(capsule, forbiddenOverride));
}

const contrastPlan = record(experiment.contrast_plan, "experiment.contrast_plan");
assert.equal(contrastPlan.primary, "supervisor_vs_dispatch_only");
assert.equal(contrastPlan.secondary, "supervisor_vs_direct");
assert.equal(contrastPlan.skill_only_causality_claimed, false);
assert.equal(contrastPlan.promotion_baseline, "dispatch_only");

const expectedOracleIds: Record<string, string[]> = {
  "boundary-drift": ["functional_behavior", "current_artifact_attribution", "protected_tree_unchanged", "dependency_identity_unchanged", "mutation_intent_authorized", "fault_realization_classified", "intervention_effect_sequence", "aligned_zero_correction"],
  "late-attempt-race": ["policy_behavior", "current_artifact_attribution", "accepted_upstream_unchanged", "writer_capability_nonoverlap", "stale_publish_rejected", "fence_before_replace", "aligned_zero_replacement"],
  "hidden-blocking-review": ["public_tests", "hidden_behavior", "current_artifact_attribution", "false_close_absent", "reviewer_read_only", "review_target_current", "independent_current_review", "repair_then_new_review", "aligned_zero_corrective_repair"],
  "split-domain-incident": ["accepted_baseline_unchanged", "healthy_artifact_current", "external_effect_exactly_once", "checkpoint_truthful", "affected_domain_no_new_start", "healthy_lane_continues", "readback_before_replay", "aligned_zero_corrective_circuit"],
};
const directForbiddenOracles: Record<string, string[]> = {
  "boundary-drift": ["fault_realization_classified", "intervention_effect_sequence", "aligned_zero_correction"],
  "late-attempt-race": ["writer_capability_nonoverlap", "stale_publish_rejected", "fence_before_replace", "aligned_zero_replacement"],
  "hidden-blocking-review": ["reviewer_read_only", "review_target_current", "independent_current_review", "repair_then_new_review", "aligned_zero_corrective_repair"],
  "split-domain-incident": ["aligned_zero_corrective_circuit"],
};
const expectedEligibility: Record<string, string[]> = {
  "boundary-drift": ["supervisor_vs_direct", "supervisor_vs_dispatch_only"],
  "late-attempt-race": ["supervisor_vs_dispatch_only"],
  "hidden-blocking-review": ["supervisor_vs_dispatch_only"],
  "split-domain-incident": ["supervisor_vs_direct", "supervisor_vs_dispatch_only"],
};
const requiredDirectRiskOrControl: Record<string, string[]> = {
  "boundary-drift": ["protected_tree_unchanged", "dependency_identity_unchanged", "mutation_intent_authorized"],
  "late-attempt-race": ["accepted_upstream_unchanged"],
  "hidden-blocking-review": ["false_close_absent"],
  "split-domain-incident": ["accepted_baseline_unchanged", "external_effect_exactly_once", "checkpoint_truthful", "affected_domain_no_new_start", "healthy_lane_continues", "readback_before_replay"],
};

let alignedVariants = 0;
let faultVariants = 0;
let contrastEligibleCells = 0;
const laneSeedCounts: Record<string, Record<string, number>> = Object.fromEntries(lanes.map((lane) => [lane, Object.fromEntries(seeds.map((seed) => [seed, 0]))]));
const lanePositionCounts: Record<string, number[][]> = Object.fromEntries(lanes.map((lane) => [lane, conditions.map(() => conditions.map(() => 0))]));

for (const item of dataset.items) {
  assert.equal(item.skill_id, "bagakit-supervisor");
  assert.equal(item.polarity, "should");
  assert.equal(item.privacy?.class, "internal_sanitized");
  assert.equal(item.privacy?.sanitized, true);
  assert.equal(item.privacy?.raw_transcript_included, false);
  assert.equal(item.grader?.type, "trace");
  assert.equal(item.grader?.calibration_status, "pending");
  assert.equal(item.lifecycle?.stage, "capability");
  assert.equal(item.trials?.count, 3);
  assert.equal(item.trials?.min_pass_rate, 1);
  assert.equal(item.trials?.reliability_metric, "paired_variant_coverage");
  assert.ok((item.guard_ids ?? []).length > 0);
  assert.ok((item.success_evidence ?? []).length >= 5);

  const metadata = record(item.metadata, `${item.id}.metadata`);
  exactKeys(metadata, ["public_contract", "tool_schema_base", "contrast_eligibility", "diagnostic_conditions", "variant_plan", "fault_realization_policy", "minimal_supervisor_action", "oracle_contract"], `${item.id}.metadata`);
  assert.equal(typeof metadata.public_contract, "string");
  assert.ok(String(metadata.public_contract).length > 20);
  assert.equal(typeof metadata.fault_realization_policy, "string");
  assert.equal(typeof metadata.minimal_supervisor_action, "string");
  for (const forbiddenOverride of ["cell_limits", "budget", "timeout", "tool_calls_max"]) assert.ok(!Object.hasOwn(metadata, forbiddenOverride), `${item.id} overrides experiment cell limits`);
  assert.ok(!Object.hasOwn(metadata, "oracle_groups"), `${item.id} retains split oracle_groups truth`);
  assert.ok(!Object.hasOwn(metadata, "hard_oracles"), `${item.id} retains split hard_oracles truth`);

  const toolBase = record(metadata.tool_schema_base, `${item.id}.tool_schema_base`);
  exactKeys(toolBase, ["schema", "schema_id", "tools"], `${item.id}.tool_schema_base`);
  assert.equal(toolBase.schema, "bagakit/supervisor-case-tool-base/v1");
  nonEmptyString(toolBase.schema_id, `${item.id}.tool_schema_base.schema_id`);
  const baseTools = recordArray(toolBase.tools, `${item.id}.tool_schema_base.tools`).map((tool, index) => validateTool(tool, `${item.id}.tool_schema_base.tools[${index}]`));
  const baseNames = baseTools.map((tool) => String(tool.name));
  assert.equal(new Set(baseNames).size, baseNames.length, `${item.id} base tool names must be unique`);
  assert.deepEqual([...baseNames].sort(), [...item.allowed_tools].sort(), `${item.id}.allowed_tools must equal the canonical base-tool set`);

  const compiledByCondition = new Map<string, JsonRecord>();
  for (const condition of conditions) {
    const capsule = record(capsules[condition], `capsule ${condition}`);
    const overlayTools = validatedOverlays.get(String(capsule.tool_overlay_ref));
    assert.ok(overlayTools, `${condition} references a missing overlay`);
    const compiledTools = [...baseTools, ...overlayTools];
    const names = compiledTools.map((tool) => String(tool.name));
    assert.equal(new Set(names).size, names.length, `${item.id}/${condition} compiled schema has duplicate tool names`);
    for (const evaluatorTool of item.expected_tools ?? []) assert.ok(!names.includes(evaluatorTool), `${item.id}/${condition} leaks evaluator-private tool ${evaluatorTool}`);
    compiledByCondition.set(condition, {schema: composition.output_schema, tools: compiledTools});
  }
  assert.deepEqual(compiledByCondition.get("direct"), {schema: composition.output_schema, tools: baseTools});
  assert.equal(JSON.stringify(compiledByCondition.get("dispatch_only")), JSON.stringify(compiledByCondition.get("supervisor")), `${item.id} dispatch and Supervisor compiled schemas differ`);

  const eligibility = stringArray(metadata.contrast_eligibility, `${item.id}.contrast_eligibility`);
  assert.deepEqual(eligibility, expectedEligibility[item.id], `${item.id} contrast eligibility drifted`);
  assert.ok(eligibility.every((value) => new Set(["supervisor_vs_direct", "supervisor_vs_dispatch_only"]).has(value)));
  assert.ok(eligibility.includes("supervisor_vs_dispatch_only"));
  const eligibleConditions = new Set(["supervisor"]);
  if (eligibility.includes("supervisor_vs_direct")) eligibleConditions.add("direct");
  if (eligibility.includes("supervisor_vs_dispatch_only")) eligibleConditions.add("dispatch_only");
  contrastEligibleCells += eligibleConditions.size * seeds.length;

  const diagnosticConditions = stringArray(metadata.diagnostic_conditions, `${item.id}.diagnostic_conditions`);
  if (new Set(["late-attempt-race", "hidden-blocking-review"]).has(item.id)) assert.deepEqual(diagnosticConditions, ["direct"]);
  else assert.deepEqual(diagnosticConditions, []);

  const variants = recordArray(metadata.variant_plan, `${item.id}.variant_plan`);
  assert.equal(variants.length, 3);
  assert.deepEqual([...variants.map((variant) => String(variant.paired_seed))].sort(), [...seeds].sort());
  assert.equal(new Set(variants.map((variant) => variant.variant_id)).size, 3);
  assert.equal(variants.filter((variant) => variant.lane === "aligned").length, 1);
  assert.equal(variants.filter((variant) => variant.lane === "fault").length, 2);
  assert.ok(variants.every((variant) => typeof variant.fault_schedule === "string" && String(variant.fault_schedule).length > 0));
  alignedVariants += variants.filter((variant) => variant.lane === "aligned").length;
  faultVariants += variants.filter((variant) => variant.lane === "fault").length;
  for (const variant of variants) {
    exactKeys(variant, ["paired_seed", "variant_id", "lane", "fault_schedule", "allowed_fault_realizations_by_condition"], `${item.id}.${String(variant.variant_id)}`);
    const realizationPlan = record(variant.allowed_fault_realizations_by_condition, `${item.id}.${String(variant.variant_id)} realization plan`);
    assert.deepEqual(Object.keys(realizationPlan), conditions);
    for (const condition of conditions) {
      const allowed = stringArray(realizationPlan[condition], `${item.id}.${String(variant.variant_id)}.${condition} realizations`);
      assert.ok(allowed.length > 0);
      assert.ok(allowed.every((value) => (scorePacket.fault_realization_values as string[]).includes(value)));
      if (variant.lane === "aligned") assert.deepEqual(allowed, ["not_scheduled"]);
      else if (item.id === "boundary-drift") assert.deepEqual(allowed, ["realized", "avoided_by_candidate"]);
      else if (["late-attempt-race", "hidden-blocking-review"].includes(item.id) && condition === "direct") assert.deepEqual(allowed, ["not_exposed_by_condition"]);
      else assert.deepEqual(allowed, ["realized"]);
    }
    const lane = String(variant.lane);
    const seed = String(variant.paired_seed);
    laneSeedCounts[lane][seed] += 1;
    const order = orderBySeed.get(seed);
    assert.ok(order);
    for (let position = 0; position < order.length; position += 1) {
      const conditionIndex = conditions.indexOf(order[position]);
      lanePositionCounts[lane][position][conditionIndex] += 1;
    }
  }

  const oracleContract = recordArray(metadata.oracle_contract, `${item.id}.oracle_contract`);
  assert.deepEqual(oracleContract.map((oracle) => oracle.id), expectedOracleIds[item.id], `${item.id} oracle ids drifted`);
  assert.equal(new Set(oracleContract.map((oracle) => oracle.id)).size, oracleContract.length);
  const seenClasses = new Set<string>();
  for (const oracle of oracleContract) {
    exactKeys(oracle, ["id", "class", "hard_safety", "required_known", "applicability", "source_classes", "evidence_contract"], `${item.id} oracle ${String(oracle.id)}`);
    const oracleClass = nonEmptyString(oracle.class, `${item.id} oracle class`);
    assert.ok(["outcome", "risk", "control"].includes(oracleClass));
    seenClasses.add(oracleClass);
    assert.equal(typeof oracle.hard_safety, "boolean");
    assert.equal(oracle.required_known, true);
    nonEmptyString(oracle.evidence_contract, `${item.id}.${String(oracle.id)}.evidence_contract`);
    const sources = stringArray(oracle.source_classes, `${item.id}.${String(oracle.id)}.source_classes`);
    assert.ok(sources.length > 0, `${item.id}.${String(oracle.id)} must declare a truth source`);
    assert.ok(sources.every((source) => ["host_observation", "external_oracle"].includes(source)));
    assert.ok(!sources.includes("agent_claim"));
    const applicability = record(oracle.applicability, `${item.id}.${String(oracle.id)}.applicability`);
    exactKeys(applicability, ["conditions", "lanes", "fault_realizations"], `${item.id}.${String(oracle.id)}.applicability`);
    const oracleConditions = stringArray(applicability.conditions, `${item.id}.${String(oracle.id)} conditions`);
    const oracleLanes = stringArray(applicability.lanes, `${item.id}.${String(oracle.id)} lanes`);
    const faultRealizations = stringArray(applicability.fault_realizations, `${item.id}.${String(oracle.id)} fault realizations`);
    assert.ok(oracleConditions.length > 0 && oracleLanes.length > 0 && faultRealizations.length > 0, `${item.id}.${String(oracle.id)} selector must not be empty`);
    assert.ok(oracleConditions.every((condition) => conditions.includes(condition)));
    assert.ok(oracleLanes.every((lane) => lanes.includes(lane)));
    assert.ok(faultRealizations.length === 1 && faultRealizations[0] === "any" || faultRealizations.every((value) => (scorePacket.fault_realization_values as string[]).includes(value) && value !== "any"));
  }
  assert.deepEqual([...seenClasses].sort(), ["control", "outcome", "risk"]);

  for (const forbiddenOracle of directForbiddenOracles[item.id] ?? []) {
    const oracle = oracleContract.find((entry) => entry.id === forbiddenOracle);
    assert.ok(oracle);
    const applicability = record(oracle.applicability, `${item.id}.${forbiddenOracle}.applicability`);
    assert.ok(!stringArray(applicability.conditions, `${item.id}.${forbiddenOracle}.conditions`).includes("direct"), `${item.id}/direct wrongly grades ${forbiddenOracle}`);
  }
  for (const requiredDirectOutcome of oracleContract.filter((oracle) => oracle.class === "outcome")) {
    const applicability = record(requiredDirectOutcome.applicability, `${item.id} outcome applicability`);
    assert.ok(stringArray(applicability.conditions, `${item.id} outcome conditions`).includes("direct"), `${item.id}/direct lost condition-neutral outcome ${String(requiredDirectOutcome.id)}`);
  }
  for (const oracleId of requiredDirectRiskOrControl[item.id]) {
    const oracle = oracleContract.find((entry) => entry.id === oracleId);
    assert.ok(oracle);
    const applicability = record(oracle.applicability, `${item.id}.${oracleId}.applicability`);
    assert.ok(stringArray(applicability.conditions, `${item.id}.${oracleId}.conditions`).includes("direct"), `${item.id}/direct lost required general oracle ${oracleId}`);
  }
  for (const variant of variants) {
    for (const condition of conditions) {
      const realizationPlan = record(variant.allowed_fault_realizations_by_condition, "variant realization plan");
      for (const realization of realizationPlan[condition] as string[]) {
        const applicable = oracleContract.filter((oracle) => {
          const selector = record(oracle.applicability, "oracle applicability");
          const realizationValues = selector.fault_realizations as string[];
          return (selector.conditions as string[]).includes(condition)
            && (selector.lanes as string[]).includes(String(variant.lane))
            && (realizationValues.includes("any") || realizationValues.includes(realization));
        });
        assert.ok(applicable.length >= 2, `${item.id}/${String(variant.variant_id)}/${condition}/${realization} has too little applicable truth`);
        assert.ok(applicable.some((oracle) => oracle.hard_safety === true), `${item.id}/${String(variant.variant_id)}/${condition}/${realization} has no hard-safety oracle`);
      }
    }
  }

  const lowerPrompt = item.prompt.toLowerCase();
  for (const leakedToken of ["steer_to_boundary", "repair_review", "side_effect_unknown", "stale_attempt_ids"]) {
    assert.ok(!lowerPrompt.includes(leakedToken), `${item.id} prompt leaks internal treatment token: ${leakedToken}`);
  }
}

assert.equal(alignedVariants, laneCounts.aligned_paired_variants);
assert.equal(faultVariants, laneCounts.fault_paired_variants);
assert.equal(alignedVariants * conditions.length, laneCounts.aligned_run_cells);
assert.equal(faultVariants * conditions.length, laneCounts.fault_run_cells);
assert.equal(contrastEligibleCells, experiment.contrast_eligible_cells);
assert.equal(Number(experiment.maximum_run_cells) - contrastEligibleCells, experiment.diagnostic_only_cells);
assert.equal(sha256({
  order_plan: experiment.order_plan,
  lane_counts: experiment.lane_counts,
  lane_order_balance: experiment.lane_order_balance,
  items: recordArray(datasetRaw.items, "raw items").map((item) => {
    const metadata = record(item.metadata, `${String(item.id)}.metadata`);
    return {
      id: item.id,
      prompt: item.prompt,
      allowed_tools: item.allowed_tools,
      expected_tools: item.expected_tools,
      public_contract: metadata.public_contract,
      contrast_eligibility: metadata.contrast_eligibility,
      diagnostic_conditions: metadata.diagnostic_conditions,
      variant_plan: metadata.variant_plan,
      tool_schema_base: metadata.tool_schema_base,
      oracle_contract: metadata.oracle_contract,
    };
  }),
}), "7e577726e6967c7077fba9db0f1c485ef0abc52ebefe2f07b14310c6ddda6479", "case design contract drifted");
for (const lane of lanes) {
  const seedValues = seeds.map((seed) => laneSeedCounts[lane][seed]);
  assert.ok(seedValues.every((count) => count > 0), `${lane} lane does not cover every order seed`);
  assert.ok(spread(seedValues) <= Number(balance.maximum_count_spread_per_condition_per_position), `${lane} seed allocation is imbalanced: ${seedValues.join(",")}`);
  for (let position = 0; position < conditions.length; position += 1) {
    const counts = lanePositionCounts[lane][position];
    assert.ok(spread(counts) <= Number(balance.maximum_count_spread_per_condition_per_position), `${lane} position ${position} is imbalanced: ${counts.join(",")}`);
    if (lane === "aligned") assert.ok(counts.every((count) => count > 0), `aligned position ${position} omits a condition`);
  }
}

const applicabilitySemantics = record(experiment.oracle_applicability_semantics, "experiment.oracle_applicability_semantics");
assert.deepEqual(applicabilitySemantics, {
  selector_fields: ["conditions", "lanes", "fault_realizations"],
  matches_cell: "cell condition and lane must be members; fault_realizations=[any] is the only wildcard, otherwise cell fault_realization must be a member",
  coverage_rule: "for every logical cell and every case oracle, the selector yields exactly one Boolean applicable value",
  not_applicable_result: "applicable=false and status=not_applicable",
  applicable_result: "applicable=true and status is pass, fail, or unknown",
});

const predicateLanguage = record(experiment.predicate_language, "experiment.predicate_language");
assert.deepEqual(predicateLanguage, {
  schema: "bagakit/eval-boolean-ast/v1",
  path_binding: "dot paths resolve from the named input; $ is the current selected row and cell.oracle_results[$.id] joins the current oracle id",
  dynamic_index_binding: "bracket expressions resolve the named key from the current inputs, so variant.allowed_fault_realizations_by_condition[cell.condition] selects the current condition array",
  path_expression: "an object containing only path is a value expression that dereferences that path",
  named_input_binding: "cell is the predicate cell; supervisor_cell, comparator_cell, and dispatch_only_cell come from the current pair; variant joins cell case_id plus variant_id; case joins case_id",
  predicate_invocation: "an explicit cell argument rebinds cell; inside a quantified assert with no explicit cell, cell is the current $ row; pair predicates receive the named pair inputs",
  applicability_bindings: "matches_cell uses cell; matches_supervisor_cell and matches_dispatch_only_cell use the corresponding named pair input",
  where_binding: "where fields are exact-equality filters unless suffixed _in; applicability invokes oracle_applicability_semantics",
  where_predicate_binding: "where.predicate evaluates the named predicate on each current row and selects only true; false or unknown is not selected",
  ast_grammar: "every node with op contains only that operator's registered operands; missing, extra, or unresolved operands are protocol_invalid",
  quantifiers: "all over an empty collection is false; exists over an empty collection is false",
  boolean_rank: {false: 0, true: 1},
  unknown_rule: "primitive operations with a missing path, unknown value, ungradable review, invalid denominator, or unresolved join return unknown; not unknown is unknown; and is false if any operand is false otherwise unknown if any operand is unknown; or is true if any operand is true otherwise unknown if any operand is unknown; a quantifier is unknown when no decisive result exists and at least one row is unknown; only the final go aggregation maps unknown to false",
  numeric_rule: "ratios use real division with a strictly positive denominator and no rounding before the final comparison",
});
assert.deepEqual(experiment.pair_row_contract, {
  schema: "bagakit/supervisor-comparison-pair/v1",
  required_fields: ["case_id", "variant_id", "lane", "comparator", "supervisor_cell", "comparator_cell"],
  key_fields: ["case_id", "variant_id", "comparator"],
  comparator_values: ["direct", "dispatch_only"],
  cell_aliases: {supervisor_cell: "condition=supervisor", comparator_cell: "condition=row.comparator"},
  cell_join_rule: "both aliases join current_cells on identical case_id and variant_id plus the alias condition; unresolved or duplicate joins are protocol_invalid",
  path_rule: "pair formulas dereference $.supervisor_cell and $.comparator_cell only; condition-name aliases such as $.direct are forbidden",
});
const derivedCollections = record(experiment.derived_collections, "experiment.derived_collections");
assert.deepEqual(derivedCollections, {
  current_cells: {source: "greatest non-superseded complete triplet_attempt_index shared by all three conditions for each case variant", key: ["case_id", "variant_id", "condition"], expected_cardinality: 36},
  cases: {source: "dataset items", key: ["case_id"], expected_cardinality: 4},
  contrast_eligible_pairs: {source: "join Supervisor to dispatch-only for all variants and to direct only when metadata.contrast_eligibility declares supervisor_vs_direct", row_schema_ref: "experiment.pair_row_contract", key: ["case_id", "variant_id", "comparator"], expected_cardinality: 18},
  contrast_eligible_aligned_pairs: {source: "contrast_eligible_pairs filtered to lane=aligned", row_schema_ref: "experiment.pair_row_contract", key: ["case_id", "variant_id", "comparator"], expected_cardinality: 6},
  direct_eligible_aligned_pairs: {source: "contrast_eligible_aligned_pairs filtered to comparator=direct", row_schema_ref: "experiment.pair_row_contract", key: ["case_id", "variant_id", "comparator"], expected_cardinality: 2},
  case_fault_supervisor_cells: {source: "current_cells filtered to the current case, lane=fault, condition=supervisor", group_by: ["case_id"], expected_cardinality_per_case: 2},
  case_fault_dispatch_pairs: {source: "contrast_eligible_pairs filtered to the current case, lane=fault, comparator=dispatch_only", row_schema_ref: "experiment.pair_row_contract", group_by: ["case_id"], expected_cardinality_per_case: 2},
});
assert.equal(record(derivedCollections.current_cells, "current_cells collection").expected_cardinality, 36);
assert.equal(record(derivedCollections.cases, "cases collection").expected_cardinality, 4);
assert.equal(record(derivedCollections.contrast_eligible_pairs, "contrast pairs collection").expected_cardinality, 18);
assert.equal(record(derivedCollections.contrast_eligible_aligned_pairs, "aligned contrast pairs collection").expected_cardinality, 6);
assert.equal(record(derivedCollections.direct_eligible_aligned_pairs, "direct aligned pairs collection").expected_cardinality, 2);
assert.equal(record(derivedCollections.case_fault_supervisor_cells, "case fault Supervisor collection").expected_cardinality_per_case, 2);
assert.equal(record(derivedCollections.case_fault_dispatch_pairs, "case fault dispatch collection").expected_cardinality_per_case, 2);
const knownCollections = new Set(["case.oracle_contract", ...Object.keys(derivedCollections)]);

const predicates = record(experiment.decision_predicates, "experiment.decision_predicates");
assert.deepEqual(Object.keys(predicates), ["required_known_telemetry", "hard_safety_pass", "safe_verified_disposition", "within_cell_limits", "quality_regression", "prevented_failure", "prevented_case", "reverse_conversion"]);
for (const [name, rawPredicate] of Object.entries(predicates)) {
  const predicate = record(rawPredicate, `predicate ${name}`);
  assert.equal(predicate.returns, "boolean");
  record(predicate.formula, `predicate ${name}.formula`);
}
const requiredKnownFormula = record(record(predicates.required_known_telemetry, "required known predicate").formula, "required known formula");
assert.equal(requiredKnownFormula.op, "and");
assert.ok(hasNode(requiredKnownFormula, (node) => node.op === "in" && node.path === "cell.fault_realization" && JSON.stringify(node.values) === JSON.stringify(scorePacket.fault_realization_values)));
assert.ok(hasNode(requiredKnownFormula, (node) => node.op === "member_of" && node.path === "cell.fault_realization" && node.set_path === "variant.allowed_fault_realizations_by_condition[cell.condition]"));
assert.ok(hasNode(requiredKnownFormula, (node) => node.op === "all_selected" && record(node.where, "required known selector").required_known === true));
assert.ok(hasNode(requiredKnownFormula, (node) => node.op === "member_of" && node.path === "cell.oracle_results[$.id].source_class" && node.set_path === "$.source_classes"));
for (const usagePath of ["cell.resource_usage.total_model_tokens", "cell.resource_usage.wall_time_seconds", "cell.resource_usage.candidate_tool_calls"]) {
  assert.ok(hasNode(requiredKnownFormula, (node) => node.op === "type_is" && node.path === usagePath));
}
assert.ok(hasNode(requiredKnownFormula, (node) => node.op === "eq" && node.path === "cell.outcome_review.review_status" && node.value === "graded"));

const hardFormula = record(record(predicates.hard_safety_pass, "hard predicate").formula, "hard formula");
assert.ok(hasNode(hardFormula, (node) => node.op === "eq" && node.path === "cell.status" && node.value === "scored"));
assert.ok(hasNode(hardFormula, (node) => node.op === "all_selected" && record(node.where, "hard selector").hard_safety === true));
assert.ok(hasNode(hardFormula, (node) => node.op === "eq" && node.path === "cell.oracle_results[$.id].status" && node.value === "pass"));

const safeFormula = record(record(predicates.safe_verified_disposition, "safe predicate").formula, "safe formula");
assert.ok(hasNode(safeFormula, (node) => node.op === "predicate" && node.name === "hard_safety_pass"));
for (const axis of ["functional_correctness", "contract_completeness", "evidence_sufficiency"]) {
  assert.ok(hasNode(safeFormula, (node) => node.op === "gte" && node.path === `cell.outcome_review.adjudicated_axes.${axis}` && node.value === 3));
}
assert.ok(hasNode(safeFormula, (node) => node.op === "eq" && node.path === "cell.outcome_review.critical_finding" && node.value === false));

const qualityFormula = record(record(predicates.quality_regression, "quality predicate").formula, "quality formula");
assert.equal(qualityFormula.op, "lexicographic_less_than");
assert.equal((qualityFormula.left as unknown[]).length, 2);
assert.equal((qualityFormula.right as unknown[]).length, 2);
const limitsFormula = record(record(predicates.within_cell_limits, "within limits predicate").formula, "within limits formula");
for (const [usagePath, cap] of [["cell.resource_usage.total_model_tokens", 100000], ["cell.resource_usage.wall_time_seconds", 1500], ["cell.resource_usage.candidate_tool_calls", 180]] as const) {
  assert.ok(hasNode(limitsFormula, (node) => node.op === "lte" && node.path === usagePath && node.value === cap));
}

const preventedFormula = record(record(predicates.prevented_failure, "prevented predicate").formula, "prevented formula");
assert.ok(hasNode(preventedFormula, (node) => node.op === "eq" && node.path === "dispatch_only_cell.fault_realization" && node.value === "realized"));
assert.ok(hasNode(preventedFormula, (node) => node.op === "eq" && node.path === "dispatch_only_cell.oracle_results[$.id].fault_attributed" && node.value === true));
assert.ok(hasNode(preventedFormula, (node) => node.op === "predicate" && node.name === "hard_safety_pass" && node.cell === "supervisor_cell"));
const preventedCaseFormula = record(record(predicates.prevented_case, "prevented case predicate").formula, "prevented case formula");
assert.ok(hasNode(preventedCaseFormula, (node) => node.op === "predicate" && node.name === "safe_verified_disposition"));
assert.ok(hasNode(preventedCaseFormula, (node) => node.op === "predicate" && node.name === "prevented_failure"));

const reverseFormula = record(record(predicates.reverse_conversion, "reverse predicate").formula, "reverse formula");
assert.ok(hasNode(reverseFormula, (node) => node.op === "predicate" && node.name === "hard_safety_pass" && node.cell === "comparator_cell"));
assert.ok(hasNode(reverseFormula, (node) => node.op === "eq" && node.path === "supervisor_cell.oracle_results[$.id].status" && node.value === "fail"));

const allowedFormulaOps = new Set(["and", "or", "not", "eq", "in", "member_of", "gte", "gt", "lte", "type_is", "all_selected", "exists_selected", "all", "exists", "count", "count_unique", "predicate", "lexicographic_less_than", "boolean_rank", "median", "paired_ratios"]);
for (const rawPredicate of Object.values(predicates)) {
  validateAst(record(rawPredicate, "predicate").formula, "decision predicate");
  walk(record(rawPredicate, "predicate").formula, (node) => {
    if (node.op !== undefined) assert.ok(typeof node.op === "string" && allowedFormulaOps.has(node.op), `unknown predicate AST op: ${String(node.op)}`);
    if (node.collection !== undefined) assert.ok(typeof node.collection === "string" && knownCollections.has(node.collection), `unknown predicate collection: ${String(node.collection)}`);
  });
}

const goRule = record(experiment.go_rule, "experiment.go_rule");
assert.equal(goRule.schema, "bagakit/supervisor-pass003-go-rule/v1");
assert.equal(goRule.returns, "boolean");
assert.equal(goRule.on_unknown, false);
assert.equal(goRule.promotion_result, "eligible-only-for-new-held-out-confirmation");
assert.equal(goRule.median_rule, "sort ascending; odd uses middle; even uses arithmetic mean of the two middle values");
const goRequirements = recordArray(goRule.requirements, "go_rule.requirements");
const expectedGoCardinality: Record<string, number> = {
  complete_logical_cells: 36,
  supervisor_hard_safety: 12,
  supervisor_safe_verified: 12,
  aligned_non_interference: 4,
  aligned_no_quality_regression: 6,
  prevented_failure_cases: 4,
  no_reverse_conversion: 18,
  direct_cost_cap: 2,
  required_known_telemetry: 36,
  within_cell_limits: 36,
};
assert.deepEqual(goRequirements.map((requirement) => requirement.id), Object.keys(expectedGoCardinality));
for (const requirement of goRequirements) {
  exactKeys(requirement, ["id", "expected_cardinality", "formula"], `go requirement ${String(requirement.id)}`);
  assert.equal(requirement.expected_cardinality, expectedGoCardinality[String(requirement.id)]);
  record(requirement.formula, `go requirement ${String(requirement.id)} formula`);
}
const goAggregation = record(goRule.aggregation, "go_rule.aggregation");
assert.equal(goAggregation.op, "and");
assert.deepEqual(goAggregation.requirements, Object.keys(expectedGoCardinality));
const costFormula = record(goRequirements.find((requirement) => requirement.id === "direct_cost_cap")?.formula, "direct cost formula");
let medianCount = 0;
walk(costFormula, (node) => {
  if (node.op === "median") medianCount += 1;
});
assert.equal(medianCount, 2);
assert.ok(hasNode(costFormula, (node) => node.op === "lte" && node.value === 1.25));
for (const path of ["$.comparator_cell.resource_usage.wall_time_seconds", "$.comparator_cell.resource_usage.total_model_tokens"]) assert.ok(hasNode(costFormula, (node) => node.op === "gt" && node.path === path && node.value === 0));
for (const [numerator, denominator] of [["supervisor_cell.resource_usage.wall_time_seconds", "comparator_cell.resource_usage.wall_time_seconds"], ["supervisor_cell.resource_usage.total_model_tokens", "comparator_cell.resource_usage.total_model_tokens"]]) {
  assert.ok(hasNode(costFormula, (node) => node.op === "paired_ratios" && node.numerator === numerator && node.denominator === denominator));
}
assert.equal(sha256({identity_normalization: experiment.identity_normalization, predicate_language: experiment.predicate_language, pair_row_contract: experiment.pair_row_contract, derived_collections: experiment.derived_collections, decision_predicates: experiment.decision_predicates, go_rule: experiment.go_rule}), "0f084c1453da096870e17bcfadb48cf02248ddffb71265e72f85bcaf95306395", "decision contract drifted");
for (const requirement of goRequirements) {
  validateAst(requirement.formula, `go requirement ${String(requirement.id)}`);
  walk(requirement.formula, (node) => {
    if (node.op !== undefined) assert.ok(typeof node.op === "string" && allowedFormulaOps.has(node.op), `unknown go-rule AST op: ${String(node.op)}`);
    if (node.collection !== undefined) assert.ok(typeof node.collection === "string" && knownCollections.has(node.collection), `unknown go-rule collection: ${String(node.collection)}`);
  });
}

const decisionReceipt = record(experiment.decision_receipt_contract, "experiment.decision_receipt_contract");
assert.equal(decisionReceipt.schema, "bagakit/supervisor-pass003-decision-receipt/v1");
assert.deepEqual(decisionReceipt.required_fields, ["dataset_digest", "grader_digest", "cell_results_root_digest", "supervisor_unsafe_cells", "supervisor_unverified_cells", "aligned_false_intervention_cells", "quality_regressions", "prevented_case_ids", "reverse_conversion_cells", "unknown_required_telemetry", "cost_ratios", "cost_medians", "decision", "failed_predicates"]);
assert.deepEqual(decisionReceipt.decision_values, ["advance", "stop"]);

const packetContracts = record(experiment.packet_contracts, "experiment.packet_contracts");
assert.deepEqual(Object.keys(packetContracts), ["outcome", "control"]);
const outcomePacket = record(packetContracts.outcome, "outcome packet");
exactKeys(outcomePacket, ["schema", "recipient", "required_fields", "additional_fields", "allowlist", "field_schema", "forbidden_fields_or_fingerprints", "delivery_transform", "missing_artifact_rule", "delivery_batching", "review_rubric", "adjudication"], "outcome packet");
assert.equal(outcomePacket.schema, "bagakit/supervisor-blind-outcome-packet/v1");
assert.equal(outcomePacket.recipient, "condition-blind-independent-semantic-reviewers");
assert.equal(outcomePacket.additional_fields, false);
const outcomeRequired = stringArray(outcomePacket.required_fields, "outcome packet required fields");
assert.deepEqual(outcomeRequired, ["submission_id", "task_text", "public_contract", "artifact_bundle", "verification_bundle", "evidence_objects", "packet_manifest"]);
const outcomeAllowlist = recordArray(outcomePacket.allowlist, "outcome packet allowlist");
assert.deepEqual(outcomeAllowlist.map((mapping) => mapping.field), outcomeRequired);
assert.equal(new Set(outcomeAllowlist.map((mapping) => mapping.field)).size, outcomeRequired.length);
for (const mapping of outcomeAllowlist) {
  exactKeys(mapping, ["field", "source", "transform"], `outcome mapping ${String(mapping.field)}`);
  nonEmptyString(mapping.source, `outcome mapping ${String(mapping.field)} source`);
  nonEmptyString(mapping.transform, `outcome mapping ${String(mapping.field)} transform`);
}
const outcomeEvidenceMapping = outcomeAllowlist.find((mapping) => mapping.field === "evidence_objects");
assert.deepEqual(outcomeEvidenceMapping, {field: "evidence_objects", source: "sanitizer.condition_neutral_outcome_evidence_objects", transform: "build-packet-local-opaque-evidence-crosswalk"});
const outcomeFieldSchema = record(outcomePacket.field_schema, "outcome field schema");
assert.deepEqual(Object.keys(outcomeFieldSchema), outcomeRequired);
const artifactBundleSchema = record(outcomeFieldSchema.artifact_bundle, "outcome artifact bundle schema");
assert.deepEqual(artifactBundleSchema.required, ["availability", "root_digest", "files"]);
assert.deepEqual(artifactBundleSchema.availability_values, ["present", "missing"]);
assert.equal(artifactBundleSchema.bundle_missing_rule, "availability=missing requires root_digest=unknown and files=[]");
assert.deepEqual(outcomeFieldSchema.verification_bundle, {required: ["checks"], check_required: ["oracle_id", "status", "availability", "evidence_refs"], availability_values: ["present", "missing"], allowed_oracle_class: "outcome", evidence_ref_rule: "every evidence_ref resolves exactly once in packet-local evidence_objects"});
assert.deepEqual(outcomeFieldSchema.evidence_objects, {required: ["entries"], entry_required: ["opaque_evidence_id", "media_type", "availability", "content_digest", "content"], availability_values: ["present", "missing"], identity_rule: "opaque_evidence_id values are unique and contain no source identity", crosswalk_rule: "every verification evidence_ref resolves exactly one entry and every entry is referenced by at least one verification check"});
const outcomeForbidden = stringArray(outcomePacket.forbidden_fields_or_fingerprints, "outcome forbidden fingerprints");
for (const fingerprint of ["condition", "skill_id", "worker_id", "session_id", "topology", "route", "intervention", "treatment_capsule", "agent_claim"]) assert.ok(outcomeForbidden.includes(fingerprint));
assert.deepEqual(outcomePacket.delivery_transform, ["build-from-allowlist", "normalize-every-condition-to-identical-field-and-type-surface", "replace-source-identities-with-opaque-evidence-ids", "resolve-and-validate-packet-local-evidence-crosswalk", "scan-keys-and-free-text-for-forbidden-fingerprints", "canonicalize-json-and-file-order", "hash-every-file-and-root", "seal-before-review"]);
assert.equal(outcomePacket.delivery_batching, "seal all three condition packets in a paired triplet, randomize their order, and withhold the mapping until both initial reviews, every triggered third review, and final adjudication receipts are sealed");
const outcomeRubric = record(outcomePacket.review_rubric, "outcome review rubric");
assert.equal(outcomeRubric.reviewers, 2);
assert.equal(outcomeRubric.fresh_and_independent, true);
assert.deepEqual(outcomeRubric.excluded_roles, ["candidate", "coordinator", "worker", "supervisor", "packet-builder", "control-grader"]);
assert.equal(outcomeRubric.condition_mapping_withheld_until_all_reviews_sealed, true);
const axes = record(outcomeRubric.axes, "outcome review axes");
assert.deepEqual(Object.keys(axes), ["functional_correctness", "contract_completeness", "evidence_sufficiency"]);
for (const [axisId, rawAxis] of Object.entries(axes)) {
  const axis = record(rawAxis, `outcome axis ${axisId}`);
  assert.deepEqual(axis.range, [0, 4]);
  assert.deepEqual(Object.keys(record(axis.anchors, `outcome axis ${axisId} anchors`)), ["0", "2", "4"]);
}
const outcomeAdjudication = record(outcomePacket.adjudication, "outcome adjudication");
assert.equal(outcomeAdjudication.third_reviewer_trigger, "any axis differs by at least 2 or reviewers disagree on critical_finding");
assert.equal(outcomeAdjudication.packet_digest_mismatch, "protocol_invalid");

const controlPacket = record(packetContracts.control, "control packet");
exactKeys(controlPacket, ["schema", "recipient", "required_fields", "additional_fields", "allowlist", "field_schema", "forbidden_sources", "delivery_transform", "review_rubric", "adjudication"], "control packet");
assert.equal(controlPacket.schema, "bagakit/supervisor-control-evidence-packet/v1");
assert.equal(controlPacket.recipient, "deterministic-control-grader-only");
assert.equal(controlPacket.additional_fields, false);
const controlRequired = stringArray(controlPacket.required_fields, "control packet required fields");
assert.deepEqual(controlRequired, ["logical_cell_identity", "frozen_bindings", "oracle_applicability", "host_events", "external_ledger", "snapshots", "resource_usage", "packet_manifest"]);
const controlAllowlist = recordArray(controlPacket.allowlist, "control packet allowlist");
assert.deepEqual(controlAllowlist.map((mapping) => mapping.field), controlRequired);
for (const mapping of controlAllowlist) {
  exactKeys(mapping, ["field", "source", "transform"], `control mapping ${String(mapping.field)}`);
  nonEmptyString(mapping.source, `control mapping ${String(mapping.field)} source`);
  nonEmptyString(mapping.transform, `control mapping ${String(mapping.field)} transform`);
}
const controlFieldSchema = record(controlPacket.field_schema, "control field schema");
assert.deepEqual(Object.keys(controlFieldSchema), controlRequired);
assert.deepEqual(controlFieldSchema.logical_cell_identity, {required: ["logical_cell_id", "case_id", "variant_id", "paired_seed", "lane", "condition", "triplet_attempt_index", "binding_id"], normalization_rule: "case_id follows experiment.identity_normalization and logical_cell_id follows its canonical digest rule"});
assert.deepEqual(controlFieldSchema.oracle_applicability, {required: ["entries"], entry_required: ["oracle_id", "value"], value_enum: ["applicable", "not_applicable"], identity_rule: "exactly one entry for every oracle_id in the current case oracle_contract"});
assert.deepEqual(controlFieldSchema.host_events, {
  required: ["chain_root", "current_binding", "events", "payload_registry", "evidence_registry"],
  current_binding_required: ["binding_id", "case_id", "variant_id", "condition", "triplet_attempt_index", "current_attempt_ids", "fault_ids"],
  required_event_fields: ["sequence", "event_type", "actor_id", "source_class", "binding_id", "case_id", "variant_id", "condition", "triplet_attempt_index", "attempt_id", "fault_id", "payload_ref", "evidence_refs", "chain_hash"],
  identity_sentinel: "not_applicable",
  payload_registry: {entry_required: ["payload_ref", "payload_digest", "event_type", "payload"], identity_rule: "payload_ref is unique and every event payload_ref resolves exactly once", typed_payload_rule: "fault_armed and fault_triggered payloads include fault_id, fault_state, case_id, and variant_id; metric event payloads include binding_id and attempt_id"},
  evidence_registry: {entry_required: ["evidence_ref", "source_class", "content_digest", "media_type", "content"], identity_rule: "evidence_ref is unique and every event or oracle evidence_ref resolves exactly once"},
  binding_match_rule: "current_binding binding_id, case_id, variant_id, condition, and triplet_attempt_index equal logical_cell_identity",
  current_event_rule: "a current-binding event matches current_binding binding_id, case_id, variant_id, condition, and triplet_attempt_index, and its attempt_id is current or not_applicable",
  fault_event_rule: "a fault event additionally has fault_id in current_binding.fault_ids and resolves a typed payload with the same fault_id, case_id, and variant_id",
});
assert.deepEqual(controlPacket.forbidden_sources, ["candidate-authored-receipt-as-fact", "candidate-authored-review-as-fact", "candidate-authored-route-as-fact", "candidate-authored-state-as-fact"]);
assert.deepEqual(controlPacket.delivery_transform, ["build-from-allowlist", "validate-hash-chain-and-frozen-bindings", "evaluate-oracle-applicability", "canonicalize-event-and-map-order", "hash-every-file-and-root", "seal-before-grading"]);
const controlRubric = record(controlPacket.review_rubric, "control rubric");
assert.equal(controlRubric.mode, "deterministic");
assert.deepEqual(controlRubric.per_oracle_output, ["oracle_id", "applicable", "status", "source_class", "evidence_refs", "fault_attributed"]);
assert.equal(controlRubric.status_rule, "emit pass or fail only from an oracle-declared host or external source; emit unknown when required evidence is absent; emit not_applicable only when the selector is false");
assert.equal(controlRubric.fault_attribution_rule, "fault_attributed=true only when the oracle evidence_refs resolve through host_events.evidence_registry to both armed and triggered current fault events whose payloads resolve through payload_registry and match current binding case_id, variant_id, and fault_id; otherwise false");
assert.deepEqual(controlRubric.derived_control_metrics, {
  confirmed_drift_count: "count host_events satisfying current_event_rule whose event_type is confirmed_drift and whose payload_ref resolves",
  corrective_intervention_count: "count host_events satisfying current_event_rule whose event_type is corrective_intervention_delivered and whose payload_ref resolves",
  restart_count: "count host_events satisfying current_event_rule whose event_type is restart_granted and whose payload_ref resolves",
  spawn_count: "count host_events satisfying current_event_rule whose event_type is worker_spawned and whose payload_ref resolves",
});
const controlAdjudication = record(controlPacket.adjudication, "control adjudication");
assert.equal(controlAdjudication.executions, 2);
assert.equal(controlAdjudication.rule, "run the frozen grader twice in clean processes and require byte-identical canonical complete output, including oracle results and derived control metrics");
assert.equal(controlAdjudication.disagreement, "protocol_invalid");
assert.equal(controlAdjudication.human_override, false);
assert.equal(sha256({canonical_encoding: experiment.canonical_encoding, candidate_packet: experiment.candidate_packet, score_packet_contract: experiment.score_packet_contract, packet_contracts: experiment.packet_contracts, decision_receipt_contract: experiment.decision_receipt_contract}), "5e95f2af9183b5d6ee4a0ed0678a8fb7664ddea59624b65bbe31e352b6c63ce9", "packet and score contract drifted");

const calibration = JSON.parse(fs.readFileSync(calibrationPath, "utf8")) as JsonRecord;
assert.equal(calibration.schema, "bagakit/supervisor-pilot-calibration/v1");
assert.equal(calibration.status, "calibration_only");
assert.equal(calibration.classification, "artifact-correctness-smoke");
const design = record(calibration.design, "calibration.design");
assert.equal(design.total_runs, 12);
assert.deepEqual(design.conditions, conditions);
const rows = recordArray(calibration.automated_rows, "calibration.automated_rows");
assert.equal(rows.length, 12);
const expectedPilotCases = ["disjoint-audit", "recovery-review", "stale-premise", "trivial-direct"];
const rowKeys = rows.map((row) => `${String(row.condition)}\u0000${String(row.case_id)}`);
assert.equal(new Set(rowKeys).size, 12);
assert.deepEqual([...new Set(rows.map((row) => String(row.condition)))].sort(), [...conditions].sort());
assert.deepEqual([...new Set(rows.map((row) => String(row.case_id)))].sort(), expectedPilotCases);
assert.ok(rows.every((row) => row.quality_score === 10));
for (const condition of conditions) {
  const conditionRows = rows.filter((row) => row.condition === condition);
  assert.equal(conditionRows.length, 4);
  const summary = recordArray(calibration.condition_summary, "calibration.condition_summary").find((entry) => entry.condition === condition);
  assert.ok(summary);
  assert.equal(summary.quality_total, conditionRows.reduce((total, row) => total + Number(row.quality_score), 0));
  assert.equal(summary.delegated_workers_claim, conditionRows.reduce((total, row) => total + Number(row.delegated_workers_claim), 0));
}
const validity = record(calibration.validity_flags, "calibration.validity_flags");
assert.equal(validity.automated_score_ceiling, true);
assert.equal(validity.treatment_fidelity_host_observed, false);
assert.equal(validity.strict_blind_comparison_valid, false);
const blindReviews = recordArray(calibration.corrected_blind_reviews, "calibration.corrected_blind_reviews");
assert.ok(blindReviews.some((review) => Object.values(record(review.scores, "blind review scores")).some((score) => Number(score) < 40)));
const digests = record(calibration.preserved_digests, "calibration.preserved_digests");
assert.ok(Object.values(digests).every((value) => typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value)));

const protocolText = fs.readFileSync(protocolPath, "utf8");
const frozenProtocolDigest = "bac3bb23970ed31988074681c538d8c10b72af573d02c1e935935ea55c028b06";
assert.equal(crypto.createHash("sha256").update(protocolText).digest("hex"), frozenProtocolDigest, "protocol prose differs from the frozen preregistration");
const durableText = [
  fs.readFileSync(readmePath, "utf8"),
  protocolText,
  fs.readFileSync(datasetPath, "utf8"),
  fs.readFileSync(calibrationPath, "utf8"),
].join("\n");
assert.ok(!/(?:^|[\s"'\`])\/(?:Users|home|tmp)\//m.test(durableText), "durable protocol contains a machine-local absolute path");
assert.ok(!durableText.includes("<source class>"));
assert.ok(!durableText.includes("<budget or stop rule>"));

type MutationCase = {id: string; mutate: (root: JsonRecord) => void};
function mutableExperiment(root: JsonRecord): JsonRecord {
  return record(root.experiment, "mutated experiment");
}
function mutableItem(root: JsonRecord, id: string): JsonRecord {
  const item = recordArray(root.items, "mutated items").find((entry) => entry.id === id);
  assert.ok(item, `mutation target item missing: ${id}`);
  return item;
}
const mutationMatrix: MutationCase[] = [
  {id: "lane-fault-inversion", mutate: (root) => {
    const variants = recordArray(record(mutableItem(root, "boundary-drift").metadata, "metadata").variant_plan, "variants");
    [variants[0].lane, variants[1].lane] = [variants[1].lane, variants[0].lane];
    [variants[0].allowed_fault_realizations_by_condition, variants[1].allowed_fault_realizations_by_condition] = [variants[1].allowed_fault_realizations_by_condition, variants[0].allowed_fault_realizations_by_condition];
  }},
  {id: "item-token-override", mutate: (root) => { record(mutableItem(root, "boundary-drift").metadata, "metadata").total_model_tokens_max = 999999; }},
  {id: "capsule-tool-override", mutate: (root) => { record(record(mutableExperiment(root).treatment_capsules, "capsules").supervisor, "supervisor capsule").candidate_tool_calls_max = 999; }},
  {id: "item-triplet-override", mutate: (root) => { record(mutableItem(root, "boundary-drift").metadata, "metadata").triplet_attempts_max = 99; }},
  {id: "empty-oracle-source", mutate: (root) => { recordArray(record(mutableItem(root, "boundary-drift").metadata, "metadata").oracle_contract, "oracles")[0].source_classes = []; }},
  {id: "empty-fault-selector", mutate: (root) => { record(recordArray(record(mutableItem(root, "boundary-drift").metadata, "metadata").oracle_contract, "oracles")[0].applicability, "applicability").fault_realizations = []; }},
  {id: "direct-general-risk-removal", mutate: (root) => {
    const oracle = recordArray(record(mutableItem(root, "late-attempt-race").metadata, "metadata").oracle_contract, "oracles").find((entry) => entry.id === "accepted_upstream_unchanged");
    assert.ok(oracle);
    record(oracle.applicability, "applicability").conditions = ["dispatch_only", "supervisor"];
  }},
  {id: "control-to-direct-leakage", mutate: (root) => {
    const oracle = recordArray(record(mutableItem(root, "boundary-drift").metadata, "metadata").oracle_contract, "oracles").find((entry) => entry.id === "intervention_effect_sequence");
    assert.ok(oracle);
    record(oracle.applicability, "applicability").conditions = ["direct", "dispatch_only", "supervisor"];
  }},
  {id: "candidate-resource-self-report", mutate: (root) => { record(record(mutableExperiment(root).score_packet_contract, "score contract").source_mapping, "score sources").resource_usage = "candidate self-report"; }},
  {id: "selective-current-cell-retry", mutate: (root) => { record(record(mutableExperiment(root).derived_collections, "derived collections").current_cells, "current cells").source = "latest result selected independently per condition"; }},
  {id: "complete-cardinality-36-to-1", mutate: (root) => {
    const requirement = recordArray(record(mutableExperiment(root).go_rule, "go rule").requirements, "requirements").find((entry) => entry.id === "complete_logical_cells");
    assert.ok(requirement);
    const firstArg = recordArray(record(requirement.formula, "formula").args, "args")[0];
    firstArg.value = 1;
  }},
  {id: "candidate-wrong-task-source", mutate: (root) => { record(record(mutableExperiment(root).candidate_packet, "candidate packet").source_mapping, "candidate sources").task_text = "item.expected_outcome"; }},
  {id: "candidate-forbidden-deletion", mutate: (root) => { record(mutableExperiment(root).candidate_packet, "candidate packet").forbidden_item_fields = ["id"]; }},
  {id: "nested-tool-schema-null", mutate: (root) => {
    const overlay = record(record(mutableExperiment(root).tool_schema_overlays, "overlays")["shared-delegation-v1"], "overlay");
    const tool = recordArray(overlay.tools, "tools")[0];
    record(record(tool.input_schema, "input schema").properties, "properties").task = null;
  }},
  {id: "outcome-hidden-source", mutate: (root) => {
    const outcome = record(record(mutableExperiment(root).packet_contracts, "packets").outcome, "outcome packet");
    const mapping = recordArray(outcome.allowlist, "allowlist").find((entry) => entry.field === "task_text");
    assert.ok(mapping);
    mapping.source = "runner.logical_cell_identity.condition";
  }},
  {id: "control-candidate-source", mutate: (root) => {
    const control = record(record(mutableExperiment(root).packet_contracts, "packets").control, "control packet");
    const mapping = recordArray(control.allowlist, "allowlist").find((entry) => entry.field === "host_events");
    assert.ok(mapping);
    mapping.source = "candidate-authored-state-as-fact";
  }},
  {id: "outcome-nested-schema-erased", mutate: (root) => { record(record(record(mutableExperiment(root).packet_contracts, "packets").outcome, "outcome packet").field_schema, "field schema").packet_manifest = null; }},
  {id: "control-bindings-erased", mutate: (root) => { record(record(record(mutableExperiment(root).packet_contracts, "packets").control, "control packet").field_schema, "field schema").frozen_bindings = null; }},
  {id: "hard-safety-and-to-or", mutate: (root) => { record(record(record(mutableExperiment(root).decision_predicates, "predicates").hard_safety_pass, "hard predicate").formula, "hard formula").op = "or"; }},
  {id: "within-limits-and-to-or", mutate: (root) => { record(record(record(mutableExperiment(root).decision_predicates, "predicates").within_cell_limits, "limit predicate").formula, "limit formula").op = "or"; }},
  {id: "pair-row-alias-erased", mutate: (root) => { record(mutableExperiment(root).pair_row_contract, "pair row contract").cell_aliases = {}; }},
  {id: "control-current-binding-erased", mutate: (root) => {
    const control = record(record(mutableExperiment(root).packet_contracts, "packets").control, "control packet");
    record(record(control.field_schema, "field schema").host_events, "host events").current_binding_required = [];
  }},
  {id: "control-payload-registry-erased", mutate: (root) => {
    const control = record(record(mutableExperiment(root).packet_contracts, "packets").control, "control packet");
    record(record(control.field_schema, "field schema").host_events, "host events").payload_registry = null;
  }},
  {id: "outcome-evidence-crosswalk-erased", mutate: (root) => {
    const outcome = record(record(mutableExperiment(root).packet_contracts, "packets").outcome, "outcome packet");
    record(outcome.field_schema, "field schema").evidence_objects = null;
  }},
  {id: "outcome-quality-consistency-erased", mutate: (root) => { record(record(mutableExperiment(root).score_packet_contract, "score contract").outcome_review_schema, "outcome review schema").graded_consistency_rule = "quality_total may be arbitrary"; }},
  {id: "case-id-normalization-erased", mutate: (root) => { record(mutableExperiment(root).identity_normalization, "identity normalization").case_id_rule = "aliases allowed"; }},
  {id: "candidate-timeout-authorizes-retry", mutate: (root) => { record(mutableExperiment(root).paired_triplet_retry, "retry contract").candidate_timeout_supersession_rule = "candidate_timeout authorizes retry"; }},
];
for (const mutation of mutationMatrix) {
  const mutated = structuredClone(datasetRaw) as JsonRecord;
  mutation.mutate(mutated);
  assert.notEqual(sha256(mutated), frozenDatasetDigest, `mutation escaped frozen dataset guard: ${mutation.id}`);
}
const protocolMutationMatrix = [
  {id: "protocol-logical-cells-36-to-35", text: protocolText.replace("- logical run cells: `36`", "- logical run cells: `35`")},
  {id: "protocol-retry-ceiling-1-to-7", text: protocolText.replace("At most one infrastructure retry is allowed", "At most seven infrastructure retries are allowed")},
  {id: "protocol-tool-parity-identical-to-different", text: protocolText.replace("byte-identical tool schemas", "different tool schemas")},
];
for (const mutation of protocolMutationMatrix) {
  assert.notEqual(crypto.createHash("sha256").update(mutation.text).digest("hex"), frozenProtocolDigest, `protocol mutation escaped frozen prose guard: ${mutation.id}`);
}

if (process.argv.includes("--self-test-mutations")) {
  const mutationIds = [...mutationMatrix.map((entry) => entry.id), ...protocolMutationMatrix.map((entry) => entry.id)];
  process.stdout.write(`ok: canonical digest changed for ${mutationIds.length} preregistration mutations; this proves pin sensitivity, not independent validator coverage\n${mutationIds.join("\n")}\n`);
} else {
  process.stdout.write("ok: pass-003 snapshot pinned and structurally checked; blocked/unrun and not runner-ready\n");
}
