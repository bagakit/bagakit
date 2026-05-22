import fs from "node:fs";
import path from "node:path";

import { parseTomlFile } from "../../../../dev/validator/src/lib/toml.ts";

const SKILL_ROOT = "skills/human-improvement/bagakit-mastery-learning";
const CONTRACT_REL = path.posix.join(
  SKILL_ROOT,
  "references",
  "mastery-learning-contract.toml",
);

const requiredIds = {
  stage: new Set([
    "learning-brief",
    "source-closure",
    "mastery-contract",
    "diagnostic-express-lane",
    "course-graph",
    "evidence-task-audit",
    "learner-copy-review",
    "active-learning-loop",
    "support-fade",
    "transfer-check",
    "retention-plan",
    "interactive-delivery-route",
  ]),
  artifact: new Set([
    "mastery-packet",
    "learner-event-stream",
    "mastery-report",
    "hitl-course-handoff",
    "learner-copy-review",
  ]),
  guard: new Set([
    "bounded-completeness",
    "evidence-before-content",
    "diagnostic-evidence-only",
    "diagnostic-no-leak",
    "anti-crutch",
    "transfer-distance-honesty",
    "retention-horizon-honesty",
    "feedback-correction-loop",
    "learner-event-privacy",
    "no-page-ownership",
    "learner-copy-semantic-preservation",
    "evidence-task-construct-validity",
    "prompt-defect-fairness",
  ]),
  eval_gate: new Set([
    "source-closure-proof",
    "false-mastery-proof",
    "transfer-proof",
    "retention-proof",
    "handoff-proof",
    "interactive-web-delivery-proof",
    "authoring-state-proof",
    "diagnostic-integrity-proof",
    "learner-copy-tone-proof",
    "evidence-task-quality-proof",
    "prompt-repair-attribution-proof",
  ]),
  composition_boundary: new Set([
    "mastery-vs-hitl-page-design",
    "mastery-vs-webpage-implementation",
    "mastery-vs-writing-review",
  ]),
  historical_case: new Set([
    "ambiguous-mnemonic-task",
  ]),
};

const requiredDimensions = new Set([
  "source_coverage",
  "unaided_recall",
  "explanation",
  "application",
  "near_transfer",
  "far_transfer",
  "calibration",
  "delayed_retention",
]);
const requiredStatuses = new Set([
  "not_assessed",
  "supported",
  "fragile",
  "demonstrated",
  "retest_due",
  "blocked",
]);
const requiredEvidenceFields = new Set([
  "evidence_id",
  "objective_id",
  "dimension",
  "status",
  "task_ref",
  "rubric_ref",
  "attempt_refs",
  "support_level",
  "transfer_distance",
  "retention_interval",
  "learner_confidence",
  "assessment_confidence",
  "provenance",
  "recorded_phase",
  "next_action",
]);
const requiredSourceFields = new Set([
  "requested_url",
  "canonical_url",
  "anchor",
  "stop_boundary",
  "included_sections",
  "dependency_dispositions",
  "claim_source_refs",
  "closure_status",
]);
const requiredEventFields = new Set([
  "event_id",
  "course_id",
  "objective_id",
  "event_kind",
  "context_ref",
  "attempt_ref",
  "support_level",
  "evidence_record_refs",
  "privacy_scope",
  "next_action",
]);
const requiredTaskBoundEventFields = new Set([
  "task_version",
  "attribution_disposition",
  "support_delta",
  "prompt_defect_ref",
]);
const requiredCopyRoles = new Set([
  "scope_receipt",
  "evidence_receipt",
  "diagnostic",
  "explanation",
  "task_prompt",
  "hint",
  "feedback",
  "transition",
  "status",
  "handoff_copy",
]);
const requiredProtectedMeaning = new Set([
  "source_and_quote",
  "evidence_status_literal",
  "numeric_claim_and_interval",
  "source_boundary",
  "capability_claim",
  "diagnostic_intent",
  "task_demand",
  "rubric_criterion",
  "support_level",
  "first_turn_no_leak",
]);
const requiredCopyReceiptFields = new Set([
  "copy_packet_ref",
  "writing_route",
  "scene",
  "protected_span_summary",
  "issues_found",
  "rewrite_refs",
  "meaning_regressions",
  "second_pass_status",
  "unreviewed_blocks",
]);
const requiredTaskFields = new Set([
  "task_id",
  "task_version",
  "objective_id",
  "capability_demand",
  "learner_role",
  "scenario",
  "decision_or_output",
  "available_evidence",
  "constraints",
  "rubric_ref",
  "support_ceiling",
  "prompt_defect_disposition",
]);
const requiredTaskQualityChecks = new Set([
  "capability_alignment",
  "answerable_without_hidden_ontology",
  "decision_relevant_requirements_only",
  "input_action_output_boundaries",
  "functional_not_nominal_specificity",
  "multiple_valid_solutions_preserved",
  "rubric_does_not_leak_the_answer",
]);
const requiredPromptDefectDispositions = new Set([
  "valid",
  "repair_without_scoring",
  "retire_and_replace",
]);
const requiredClarificationClasses = new Set([
  "task_repair_without_solution_cue",
  "learner_support_with_solution_structure",
]);
const requiredPromptDefectRecordFields = new Set([
  "replaces_task_ref",
  "affected_attempt_refs",
  "attempt_treatment",
  "support_delta",
]);
const requiredPromptDefectAttemptTreatments = new Set([
  "not_scored_preserve_interpretable_positive",
  "not_scored_no_interpretable_evidence",
]);
const requiredAdaptiveCompletionEvidence = new Set([
  "learner_attempt",
  "agent_feedback_projection",
  "next_page_task",
  "subsequent_learner_action",
  "restored_history",
  "canonical_export",
]);
const requiredContinuationTriggers = new Set([
  "course_id_with_resume_intent",
  "attempt_packet",
  "page_submission_receipt",
]);
const requiredPageLocatorFields = new Set([
  "page_id",
  "page_manifest_ref",
  "projection_target_ref",
]);

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a TOML table`);
  }
  return value as Record<string, unknown>;
}

function records(value: unknown, label: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array of tables`);
  }
  return value.map((item, index) => record(item, `${label}[${index}]`));
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new Error(`${label} must be a non-empty string array`);
  }
  return value as string[];
}

function byId(value: unknown, label: string): Map<string, Record<string, unknown>> {
  const result = new Map<string, Record<string, unknown>>();
  for (const item of records(value, label)) {
    const id = item.id;
    if (typeof id !== "string" || id.length === 0) {
      throw new Error(`${label} entry has no id`);
    }
    if (result.has(id)) {
      throw new Error(`${label} has duplicate id: ${id}`);
    }
    result.set(id, item);
  }
  return result;
}

function requireSet(actual: Iterable<string>, expected: Set<string>, label: string, failures: string[]): void {
  const values = new Set(actual);
  const missing = [...expected].filter((item) => !values.has(item));
  if (missing.length > 0) {
    failures.push(`${label} missing: ${missing.sort().join(", ")}`);
  }
}

function requireSequence(actual: string[], expected: string[], label: string, failures: string[]): void {
  if (actual.length !== expected.length || actual.some((item, index) => item !== expected[index])) {
    failures.push(`${label} must equal: ${expected.join(" -> ")}`);
  }
}

function parseRoot(): string {
  const rootIndex = process.argv.indexOf("--root");
  const value = rootIndex >= 0 ? process.argv[rootIndex + 1] : ".";
  if (!value) {
    throw new Error("--root requires a value");
  }
  return path.resolve(value);
}

const root = parseRoot();
const failures: string[] = [];
const requiredFiles = [
  "SKILL.md",
  "agents/openai.yaml",
  "references/mastery-learning-contract.toml",
  "references/first-course-turn.md",
  "references/mastery-packet.md",
  "references/learning-loop.md",
  "references/evidence-and-adaptation.md",
  "references/learner-copy-review.md",
  "references/hitl-course-handoff.md",
  "references/frontdoor-rule.toml",
  "references/bagakit-driver.toml",
  "references/skill-cli.toml",
  "scripts/bagakit-mastery-learning-cli.sh",
];
for (const rel of requiredFiles) {
  const requiredPath = path.posix.join(SKILL_ROOT, rel);
  if (!fs.existsSync(path.join(root, requiredPath))) {
    failures.push(`missing required file: ${requiredPath}`);
  }
}

if (failures.length === 0) {
  try {
    const contract = record(parseTomlFile(path.join(root, CONTRACT_REL)), "contract");
    if (contract.version !== 1) failures.push("contract version must be 1");
    if (contract.skill_id !== "bagakit-mastery-learning") failures.push("contract skill_id mismatch");
    if (contract.contract_kind !== "skill_workflow_contract") failures.push("contract kind mismatch");
    if (contract.owner !== SKILL_ROOT) failures.push("contract owner mismatch");

    const collections = new Map<string, Map<string, Record<string, unknown>>>();
    for (const [label, expected] of Object.entries(requiredIds)) {
      const collection = byId(contract[label], label);
      collections.set(label, collection);
      requireSet(collection.keys(), expected, `${label} ids`, failures);
    }

    const artifacts = collections.get("artifact")!;
    for (const [stageId, stage] of collections.get("stage")!) {
      if (typeof stage.phase !== "string") failures.push(`stage ${stageId} missing phase`);
      if (typeof stage.artifact !== "string" || !artifacts.has(stage.artifact)) {
        failures.push(`stage ${stageId} references undeclared artifact: ${String(stage.artifact)}`);
      }
      if (stage.phase !== "authoring" && stage.blocks_completion === true) {
        failures.push(`non-authoring stage ${stageId} cannot block authoring completion`);
      }
    }
    for (const [artifactId, artifact] of artifacts) {
      const owner = artifact.owner;
      if (typeof owner !== "string" || !fs.existsSync(path.join(root, SKILL_ROOT, owner))) {
        failures.push(`artifact ${artifactId} has no existing owner`);
      }
    }

    const lifecycle = record(contract.lifecycle, "lifecycle");
    requireSet(strings(lifecycle.phases, "lifecycle.phases"), new Set(["authoring", "learning_session", "reentry"]), "lifecycle phases", failures);
    if (lifecycle.initial_evidence_status !== "not_assessed") {
      failures.push("new authoring evidence must start as not_assessed");
    }

    const delivery = record(contract.delivery_policy, "delivery_policy");
    if (delivery.default_for_interactive_intent !== "built_page") {
      failures.push("interactive intent must default to built_page");
    }
    requireSet(
      strings(delivery.downgrade_modes, "delivery_policy.downgrade_modes"),
      new Set(["dialogue_only", "design_only", "no_file_mutation"]),
      "delivery downgrade modes",
      failures,
    );
    requireSequence(
      strings(delivery.default_chain, "delivery_policy.default_chain"),
      [
        "bagakit-mastery-learning",
        "bagakit-writing-core",
        "bagakit-hitl-webutil-design",
        "bagakit-codex-webpage-design",
      ],
      "default delivery chain",
      failures,
    );
    requireSet(
      strings(delivery.completion_evidence, "delivery_policy.completion_evidence"),
      new Set([
        "learner_copy_review_receipt",
        "implementation_entrypoint",
        "running_page_location",
        "desktop_browser_evidence",
        "mobile_browser_evidence",
      ]),
      "built-page completion evidence",
      failures,
    );
    requireSet(
      strings(delivery.adaptive_completion_evidence, "delivery_policy.adaptive_completion_evidence"),
      requiredAdaptiveCompletionEvidence,
      "adaptive completion evidence",
      failures,
    );

    const continuation = record(contract.continuation_policy, "continuation_policy");
    requireSet(
      strings(continuation.trigger_inputs, "continuation_policy.trigger_inputs"),
      requiredContinuationTriggers,
      "continuation triggers",
      failures,
    );
    requireSet(
      strings(continuation.required_locator_fields, "continuation_policy.required_locator_fields"),
      requiredPageLocatorFields,
      "continuation page locator fields",
      failures,
    );
    requireSequence(
      strings(continuation.processing_order, "continuation_policy.processing_order"),
      ["load_course_state", "evaluate_attempt", "update_evidence", "emit_hitl_projection", "notify_in_chat"],
      "continuation processing order",
      failures,
    );
    if (continuation.primary_surface !== "existing_page") {
      failures.push("course continuation must target the existing page");
    }

    const copyPolicy = record(contract.learner_copy_policy, "learner_copy_policy");
    if (copyPolicy.default_route !== "bagakit-writing-core") {
      failures.push("learner copy must default through bagakit-writing-core");
    }
    if (copyPolicy.nested_de_ai_reviewer !== "bagakit-writing-de-ai-tone") {
      failures.push("learner copy must name bagakit-writing-de-ai-tone as the nested reviewer");
    }
    requireSet(strings(copyPolicy.applies_to, "learner_copy_policy.applies_to"), requiredCopyRoles, "learner copy roles", failures);
    requireSet(strings(copyPolicy.protected_meaning, "learner_copy_policy.protected_meaning"), requiredProtectedMeaning, "learner copy protected meaning", failures);
    requireSet(strings(copyPolicy.required_receipt_fields, "learner_copy_policy.required_receipt_fields"), requiredCopyReceiptFields, "learner copy receipt fields", failures);
    if (typeof copyPolicy.fallback_rule !== "string" || !copyPolicy.fallback_rule.includes("blocked")) {
      failures.push("learner copy fallback must preserve an explicit blocked review state");
    }

    const taskPolicy = record(contract.evidence_task_policy, "evidence_task_policy");
    requireSet(strings(taskPolicy.required_fields, "evidence_task_policy.required_fields"), requiredTaskFields, "evidence task fields", failures);
    requireSet(strings(taskPolicy.quality_checks, "evidence_task_policy.quality_checks"), requiredTaskQualityChecks, "evidence task quality checks", failures);
    requireSet(strings(taskPolicy.prompt_defect_dispositions, "evidence_task_policy.prompt_defect_dispositions"), requiredPromptDefectDispositions, "prompt defect dispositions", failures);
    requireSet(strings(taskPolicy.prompt_defect_record_fields, "evidence_task_policy.prompt_defect_record_fields"), requiredPromptDefectRecordFields, "prompt defect record fields", failures);
    requireSet(strings(taskPolicy.prompt_defect_attempt_treatments, "evidence_task_policy.prompt_defect_attempt_treatments"), requiredPromptDefectAttemptTreatments, "prompt defect attempt treatments", failures);
    if (taskPolicy.prompt_defect_support_rule !== "zero_without_solution_cue") {
      failures.push("prompt defects without solution cues must have zero support delta");
    }
    requireSet(strings(taskPolicy.clarification_classes, "evidence_task_policy.clarification_classes"), requiredClarificationClasses, "clarification classes", failures);
    if (typeof taskPolicy.mnemonic_rule !== "string" || typeof taskPolicy.attribution_rule !== "string") {
      failures.push("evidence task policy must declare mnemonic and attribution rules");
    }

    const evidence = record(contract.mastery_evidence, "mastery_evidence");
    requireSet(strings(evidence.dimensions, "mastery_evidence.dimensions"), requiredDimensions, "evidence dimensions", failures);
    requireSet(strings(evidence.statuses, "mastery_evidence.statuses"), requiredStatuses, "evidence statuses", failures);
    requireSet(strings(evidence.required_evidence_record_fields, "mastery_evidence.required_evidence_record_fields"), requiredEvidenceFields, "evidence record fields", failures);

    const sourceClosure = record(contract.source_closure, "source_closure");
    requireSet(strings(sourceClosure.required_fields, "source_closure.required_fields"), requiredSourceFields, "source closure fields", failures);
    const learnerEvent = record(contract.learner_event, "learner_event");
    requireSet(strings(learnerEvent.required_fields, "learner_event.required_fields"), requiredEventFields, "learner event fields", failures);
    requireSet(strings(learnerEvent.task_bound_required_fields, "learner_event.task_bound_required_fields"), requiredTaskBoundEventFields, "task-bound learner event fields", failures);

    for (const [gateId, gate] of collections.get("eval_gate")!) {
      if (typeof gate.decision !== "string" || gate.decision.length === 0) {
        failures.push(`eval gate ${gateId} has no decision`);
      }
    }
    const handoffBoundary = collections.get("composition_boundary")!.get("mastery-vs-hitl-page-design")!;
    if (typeof handoffBoundary.round_trip_contract !== "string") {
      failures.push("mastery/HITL boundary must declare a round-trip contract");
    }
    if (handoffBoundary.default_when !== "delivery mode is built_page") {
      failures.push("mastery/HITL boundary must default on built_page delivery");
    }
    const writingBoundary = collections.get("composition_boundary")!.get("mastery-vs-writing-review")!;
    if (writingBoundary.peer !== "bagakit-writing-core") {
      failures.push("mastery/writing boundary must name bagakit-writing-core as peer");
    }
    requireSet(
      strings(writingBoundary.skill_owns, "mastery-vs-writing-review.skill_owns"),
      new Set(["source_bounded_learning_semantics", "diagnostic_intent", "evidence_tasks", "rubrics", "support_policy", "mastery_states"]),
      "mastery-owned learning semantics",
      failures,
    );
    requireSet(
      strings(writingBoundary.peer_owns, "mastery-vs-writing-review.peer_owns"),
      new Set(["audience_fit", "prose_structure", "clarity", "no_regression_review", "de_ai_tone_orchestration"]),
      "writing-owned review semantics",
      failures,
    );
    requireSet(
      strings(writingBoundary.protected_semantics, "mastery-vs-writing-review.protected_semantics"),
      new Set(["source_claims", "diagnostic_intent", "task_demand", "rubric_criteria", "support_meaning", "mastery_status", "first_turn_no_leak"]),
      "writing-review protected semantics",
      failures,
    );
    for (const [boundaryId, boundary] of collections.get("composition_boundary")!) {
      if (typeof boundary.completion_evidence !== "string" || boundary.completion_evidence.length === 0) {
        failures.push(`composition boundary ${boundaryId} must declare completion evidence`);
      }
    }
    const ambiguousTaskCase = collections.get("historical_case")!.get("ambiguous-mnemonic-task")!;
    requireSet(
      strings(ambiguousTaskCase.guard_ids, "ambiguous-mnemonic-task.guard_ids"),
      new Set(["evidence-task-construct-validity", "prompt-defect-fairness"]),
      "ambiguous task historical guard refs",
      failures,
    );
    if (strings(ambiguousTaskCase.evidence_refs, "ambiguous-mnemonic-task.evidence_refs").length === 0) {
      failures.push("ambiguous task historical case must preserve evidence refs");
    }

    const entry = record(contract.entry, "entry");
    const skillText = fs.readFileSync(path.join(root, SKILL_ROOT, "SKILL.md"), "utf8");
    for (const rel of strings(entry.required_reference_links, "entry.required_reference_links")) {
      if (!fs.existsSync(path.join(root, SKILL_ROOT, rel))) failures.push(`entry reference missing: ${rel}`);
      if (!skillText.includes(rel)) failures.push(`SKILL.md does not route to ${rel}`);
    }
    requireSet(
      strings(entry.optional_peer_contracts, "entry.optional_peer_contracts"),
      new Set([
        "skills/paperwork/bagakit-writing-core/references/frontdoor-rule.toml",
        "skills/paperwork/bagakit-writing-de-ai-tone/references/frontdoor-rule.toml",
      ]),
      "learner-copy peer contracts",
      failures,
    );
    for (const peer of [
      "bagakit-writing-core",
      "bagakit-writing-de-ai-tone",
      "bagakit-hitl-webutil-design",
      "bagakit-codex-webpage-design",
    ]) {
      if (!skillText.includes(peer)) failures.push(`SKILL.md missing peer boundary: ${peer}`);
    }
  } catch (error) {
    failures.push(String(error));
  }
}

if (failures.length > 0) {
  console.error("mastery-learning contract check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("ok: mastery-learning contract is structurally aligned");
