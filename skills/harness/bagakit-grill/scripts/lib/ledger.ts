import fs from "node:fs";
import path from "node:path";

import type { GrillNode, GrillRun, QAEvent } from "./model.ts";
import { utcNow } from "./model.ts";
import { repoRelative, runDir } from "./io.ts";

const LEDGER_SCHEMA = "bagakit/consensus-ledger/v1";

interface LedgerQuestion {
  id: string;
  question: string;
  status: string;
  dimension_refs: string[];
  decision_protected: string;
  answer_ref: string;
  evidence_requirement_refs: string[];
  created_at: string;
  updated_at: string;
}

interface EvidenceRequirement {
  id: string;
  subject_ref: string;
  evidence_kind: string;
  status: string;
  acceptance_criteria: string;
  dimension_refs: string[];
  evidence_refs: string[];
  note: string;
  created_at: string;
  updated_at: string;
}

interface ConsensusLedger {
  schema: typeof LEDGER_SCHEMA;
  ledger_id: string;
  status: string;
  owner: {
    mode: string;
    owner_skill: string;
    owner_ref: string;
    ledger_path: string;
  };
  goal_context: {
    goal: string;
    success_bar: string;
    non_goals: string[];
    protected_principle: string;
  };
  epistemic_items: Array<Record<string, unknown>>;
  goal_dimensions: Array<Record<string, unknown>>;
  questions: LedgerQuestion[];
  decision_items: Array<Record<string, unknown>>;
  skill_lenses: Array<Record<string, unknown>>;
  evidence_requirements: EvidenceRequirement[];
  evidence_refs: Array<Record<string, unknown>>;
  snapshots: Array<Record<string, unknown>>;
  promotion_state: { status: string; target: string; refs: string[] };
  render: { view_path: string; last_rendered_at: string };
  created_at: string;
  updated_at: string;
}

function ledgerPath(repoRoot: string, runId: string): string {
  return path.join(runDir(repoRoot, runId), "consensus-ledger.json");
}

function ledgerViewPath(repoRoot: string, runId: string): string {
  return path.join(runDir(repoRoot, runId), "consensus-ledger.md");
}

export function embeddedLedgerRef(repoRoot: string, runId: string): string {
  return repoRelative(repoRoot, ledgerPath(repoRoot, runId));
}

function dimension(id: string, name: string, why: string, now: string): Record<string, unknown> {
  return {
    id,
    name,
    why_it_matters: why,
    current_state: "",
    item_refs: [],
    question_refs: [],
    risk_if_ignored: "",
    next_probe: "",
    created_at: now,
    updated_at: now,
  };
}

function evidenceRequirementId(nodeId: string): string {
  return `evidence-${nodeId}`;
}

function evidenceKind(node: GrillNode): string {
  const kinds: Record<GrillNode["resolution_route"], string> = {
    user_answer: "user_confirmation",
    local_inspection: "local_artifact",
    external_research: "source_evidence",
    prototype_observation: "prototype_observation",
    runtime_experiment: "runtime_observation",
  };
  return kinds[node.resolution_route];
}

export function ensureEmbeddedLedger(repoRoot: string, run: GrillRun, force = false): void {
  const file = ledgerPath(repoRoot, run.run_id);
  if (fs.existsSync(file) && !force) {
    return;
  }
  const now = utcNow();
  const relPath = repoRelative(repoRoot, file);
  const ownerRef = repoRelative(repoRoot, runDir(repoRoot, run.run_id));
  const targetItem = {
    id: "target-snapshot",
    epistemic_class: "known_known",
    status: "confirmed",
    statement: run.target_snapshot,
    source: run.target_ref ? "artifact" : "user",
    confidence: "high",
    dimension_refs: ["target_goal"],
    evidence_refs: run.target_ref ? [run.target_ref] : [],
    next_action: "Plan dependency-ordered Grill questions.",
    created_at: now,
    updated_at: now,
  };
  const successGap = {
    id: "success-criteria-gap",
    epistemic_class: "known_unknown",
    status: "proposed",
    statement: "The concrete success criteria still need confirmation.",
    source: "agent_inference",
    confidence: "medium",
    dimension_refs: ["success_criteria"],
    evidence_refs: [],
    next_action: "Ask which success bar the plan must satisfy.",
    created_at: now,
    updated_at: now,
  };
  const implicitAssumption = {
    id: "implicit-target-assumptions",
    epistemic_class: "unknown_known",
    status: "inferred",
    statement: "The target may contain implicit assumptions that need confirmation.",
    source: "agent_inference",
    confidence: "low",
    dimension_refs: ["dependency_chain"],
    evidence_refs: ["grill-run.json#target_snapshot"],
    next_action: "Map dependency-bearing questions before execution.",
    created_at: now,
    updated_at: now,
  };
  const skippedBranchRisk = {
    id: "skipped-branch-risk",
    epistemic_class: "unknown_unknown",
    status: "proposed",
    statement: "There may be an adjacent risk branch not yet represented in the decision DAG.",
    source: "agent_inference",
    confidence: "low",
    dimension_refs: ["risk_branches"],
    evidence_refs: [],
    next_action: "Check branch width before convergence.",
    created_at: now,
    updated_at: now,
  };
  const data: ConsensusLedger = {
    schema: LEDGER_SCHEMA,
    ledger_id: run.run_id,
    status: "active",
    owner: {
      mode: "embedded",
      owner_skill: "bagakit-grill",
      owner_ref: ownerRef,
      ledger_path: relPath,
    },
    goal_context: {
      goal: run.target_snapshot,
      success_bar: "Resolve dependency-bearing questions before execution.",
      non_goals: [],
      protected_principle: run.target_ref,
    },
    epistemic_items: [targetItem, successGap, implicitAssumption, skippedBranchRisk],
    goal_dimensions: [
      dimension("target_goal", "Target Goal", "Grill questions must protect the target goal or principle.", now),
      dimension("success_criteria", "Success Criteria", "Completion needs a shared success bar.", now),
      dimension("dependency_chain", "Dependency Chain", "Questions should resolve upstream dependencies first.", now),
      dimension("risk_branches", "Risk Branches", "Skipped branches can create false convergence.", now),
      dimension("evidence_gaps", "Evidence Gaps", "Unresolved evidence requirements must stay visible.", now),
      dimension("convergence_conditions", "Convergence Conditions", "Multi-round no-branch still needs close/switch/correct.", now),
    ],
    questions: [],
    decision_items: [],
    skill_lenses: [
      {
        skill: "bagakit-grill",
        dimension_refs: [
          "target_goal",
          "success_criteria",
          "dependency_chain",
          "risk_branches",
          "evidence_gaps",
          "convergence_conditions",
        ],
      },
    ],
    evidence_requirements: [],
    evidence_refs: run.target_ref ? [{ id: "target-ref", ref: run.target_ref, summary: "Grill target reference." }] : [],
    snapshots: [],
    promotion_state: { status: "none", target: "none", refs: [] },
    render: {
      view_path: repoRelative(repoRoot, ledgerViewPath(repoRoot, run.run_id)),
      last_rendered_at: "",
    },
    created_at: now,
    updated_at: now,
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function readLedger(repoRoot: string, run: GrillRun): ConsensusLedger | undefined {
  if (!run.ledger_ref) {
    return undefined;
  }
  const file = path.resolve(repoRoot, run.ledger_ref);
  if (!fs.existsSync(file)) {
    return undefined;
  }
  const data = JSON.parse(fs.readFileSync(file, "utf8")) as ConsensusLedger;
  if (data.schema !== LEDGER_SCHEMA) {
    return undefined;
  }
  return data;
}

function writeLedger(repoRoot: string, run: GrillRun, data: ConsensusLedger): void {
  data.updated_at = utcNow();
  fs.writeFileSync(path.resolve(repoRoot, run.ledger_ref), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function linkQuestionToDimensions(data: ConsensusLedger, questionId: string, refs: string[]): void {
  for (const dim of data.goal_dimensions) {
    if (!refs.includes(String(dim.id))) {
      continue;
    }
    const questionRefs = Array.isArray(dim.question_refs) ? dim.question_refs as string[] : [];
    if (!questionRefs.includes(questionId)) {
      questionRefs.push(questionId);
    }
    dim.question_refs = questionRefs;
    dim.updated_at = utcNow();
  }
}

export function syncQuestionToLedger(repoRoot: string, run: GrillRun, node: GrillNode): void {
  const data = readLedger(repoRoot, run);
  if (!data) {
    return;
  }
  const now = utcNow();
  const existing = data.questions.find((item) => item.id === node.id);
  const question: LedgerQuestion = existing ?? {
    id: node.id,
    question: "",
    status: "pending",
    dimension_refs: [],
    decision_protected: "",
    answer_ref: "",
    evidence_requirement_refs: [],
    created_at: now,
    updated_at: now,
  };
  question.question = node.question;
  question.status = node.status === "answered" ? "answered" : node.status;
  question.dimension_refs = node.ledger_refs;
  question.decision_protected = node.decision_protected;
  question.evidence_requirement_refs = [evidenceRequirementId(node.id)];
  question.updated_at = now;
  if (!existing) {
    data.questions.push(question);
  }
  linkQuestionToDimensions(data, node.id, node.ledger_refs);
  const requirements = data.evidence_requirements ?? (data.evidence_requirements = []);
  const requirementId = evidenceRequirementId(node.id);
  const existingRequirement = requirements.find((item) => item.id === requirementId);
  const requirement: EvidenceRequirement = existingRequirement ?? {
    id: requirementId,
    subject_ref: `question:${node.id}`,
    evidence_kind: evidenceKind(node),
    status: "required",
    acceptance_criteria: node.acceptance_criteria,
    dimension_refs: node.ledger_refs,
    evidence_refs: [],
    note: "",
    created_at: now,
    updated_at: now,
  };
  requirement.subject_ref = `question:${node.id}`;
  requirement.evidence_kind = evidenceKind(node);
  requirement.status = node.status === "answered" || node.status === "evidence_attached" ? "satisfied" : "required";
  requirement.acceptance_criteria = node.acceptance_criteria;
  requirement.dimension_refs = node.ledger_refs;
  requirement.evidence_refs = node.evidence_refs.map((item) => item.ref);
  requirement.updated_at = now;
  if (!existingRequirement) {
    requirements.push(requirement);
  }
  writeLedger(repoRoot, run, data);
}

export function syncAnswerToLedger(repoRoot: string, run: GrillRun, event: QAEvent): void {
  const data = readLedger(repoRoot, run);
  if (!data) {
    return;
  }
  const question = data.questions.find((item) => item.id === event.node_id);
  if (question) {
    question.status = "answered";
    question.answer_ref = `grill-run.json#${event.event_id}`;
    question.updated_at = utcNow();
  }
  const requirement = data.evidence_requirements?.find((item) => item.id === evidenceRequirementId(event.node_id));
  if (requirement) {
    requirement.status = "satisfied";
    const ref = `grill-run.json#${event.event_id}`;
    if (!requirement.evidence_refs.includes(ref)) {
      requirement.evidence_refs.push(ref);
    }
    requirement.updated_at = utcNow();
  }
  data.evidence_refs.push({
    id: event.event_id,
    ref: `grill-run.json#${event.event_id}`,
    summary: `User answered ${event.node_id}.`,
  });
  writeLedger(repoRoot, run, data);
}

export function syncEvidenceToLedger(repoRoot: string, run: GrillRun, node: GrillNode): void {
  const data = readLedger(repoRoot, run);
  if (!data) {
    return;
  }
  const now = utcNow();
  const question = data.questions.find((item) => item.id === node.id);
  if (question) {
    question.status = "evidence_attached";
    question.updated_at = now;
  }
  const requirement = data.evidence_requirements?.find((item) => item.id === evidenceRequirementId(node.id));
  if (requirement) {
    requirement.status = "satisfied";
    requirement.evidence_refs = node.evidence_refs.map((item) => item.ref);
    requirement.updated_at = now;
  }
  for (const evidence of node.evidence_refs) {
    if (!data.evidence_refs.some((item) => item.id === `${node.id}:${evidence.ref}`)) {
      data.evidence_refs.push({
        id: `${node.id}:${evidence.ref}`,
        ref: evidence.ref,
        summary: evidence.summary,
      });
    }
  }
  writeLedger(repoRoot, run, data);
}

export function renderLedgerSummary(repoRoot: string, run: GrillRun): void {
  const data = readLedger(repoRoot, run);
  if (!data) {
    return;
  }
  const lines = [
    "# Consensus Ledger",
    "",
    "<!-- Generated by bagakit-grill. Do not edit directly. -->",
    "",
    "## Shared Understanding",
    "",
  ];
  const groups = [
    ["known_known", "Known known"],
    ["known_unknown", "Known unknown"],
    ["unknown_known", "Unknown known"],
    ["unknown_unknown", "Unknown unknown"],
  ];
  for (const [epClass, title] of groups) {
    lines.push(`### ${title}`, "");
    const items = data.epistemic_items.filter((item) => item.epistemic_class === epClass);
    if (items.length === 0) {
      lines.push("- none");
    } else {
      for (const item of items) {
        lines.push(`- \`${String(item.id)}\` ${String(item.status)}: ${String(item.statement)}`);
      }
    }
    lines.push("");
  }
  lines.push("## Questions", "");
  if (data.questions.length === 0) {
    lines.push("- none");
  } else {
    for (const question of data.questions) {
      lines.push(`- \`${question.id}\` ${question.status}: ${question.question}`);
    }
  }
  lines.push("", "## Evidence Requirements", "");
  if (!data.evidence_requirements || data.evidence_requirements.length === 0) {
    lines.push("- none");
  } else {
    for (const requirement of data.evidence_requirements) {
      lines.push(
        `- \`${requirement.id}\` kind=${requirement.evidence_kind} status=${requirement.status}: ${requirement.acceptance_criteria}`,
      );
    }
  }
  data.render.last_rendered_at = utcNow();
  fs.writeFileSync(ledgerViewPath(repoRoot, run.run_id), `${lines.join("\n")}\n`, "utf8");
  writeLedger(repoRoot, run, data);
}
