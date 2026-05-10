import {
  CONVERGENCE_DECISIONS,
  GRILL_SCHEMA,
  RESOLUTION_ROUTES,
  type ConvergenceCheck,
  type ConvergenceDecision,
  type EvidenceRef,
  type GrillNode,
  type GrillRun,
  type ResolutionRoute,
  assertKnown,
  utcNow,
} from "./model.ts";

function emptyConvergenceCheck(now: string): ConvergenceCheck {
  return {
    status: "not_needed",
    answer_count: 0,
    goal_or_principle: "",
    signal: "",
    adjacent_branch: "",
    decision: "",
    note: "",
    resolved_at: "",
    updated_at: now,
  };
}

function ensureConvergenceCheck(run: GrillRun): ConvergenceCheck {
  if (!run.convergence_check) {
    run.convergence_check = emptyConvergenceCheck(utcNow());
  }
  return run.convergence_check;
}

function isNodeResolved(node: GrillNode): boolean {
  return node.status === "answered" || node.status === "evidence_attached" || node.status === "skipped";
}

export function createRun(input: {
  runId: string;
  target: string;
  targetRef?: string;
  ledgerRef?: string;
  briefPath: string;
}): GrillRun {
  const now = utcNow();
  return {
    schema: GRILL_SCHEMA,
    run_id: input.runId,
    target_snapshot: input.target,
    target_ref: input.targetRef ?? "",
    ledger_ref: input.ledgerRef ?? "",
    status: "planning",
    created_at: now,
    updated_at: now,
    question_nodes: [],
    qa_events: [],
    convergence_check: emptyConvergenceCheck(now),
    render: {
      brief_path: input.briefPath,
      last_rendered_at: "",
    },
  };
}

export function refreshRun(run: GrillRun): GrillRun {
  const convergence = ensureConvergenceCheck(run);
  const answered = new Set(
    run.question_nodes
      .filter(isNodeResolved)
      .map((node) => node.id),
  );

  for (const node of run.question_nodes) {
    if (isNodeResolved(node)) {
      continue;
    }
    const depsReady = node.depends_on.every((dep) => answered.has(dep));
    if (!depsReady) {
      node.status = "pending";
    } else if (node.resolution_route !== "user_answer") {
      node.status = "evidence_needed";
    } else {
      node.status = "ready";
    }
  }

  const allNodesResolved = run.question_nodes.length > 0 && run.question_nodes.every(isNodeResolved);
  const hasMultiRoundAnswers = run.qa_events.length >= 2;
  const convergenceCoversCurrentAnswers = convergence.answer_count === run.qa_events.length;

  if (run.question_nodes.some((node) => node.status === "evidence_needed")) {
    run.status = "evidence_blocked";
  } else if (allNodesResolved && hasMultiRoundAnswers) {
    if (convergence.status === "resolved" && convergence.decision === "close" && convergenceCoversCurrentAnswers) {
      run.status = "complete";
    } else if (convergence.status === "resolved" && convergence.decision !== "close" && convergenceCoversCurrentAnswers) {
      run.status = "planning";
    } else {
      convergence.status = "pending";
      convergence.answer_count = run.qa_events.length;
      convergence.decision = "";
      convergence.resolved_at = "";
      convergence.updated_at = utcNow();
      run.status = "convergence_pending";
    }
  } else if (allNodesResolved) {
    run.status = "complete";
  } else if (run.question_nodes.some((node) => node.status === "ready")) {
    run.status = "active";
  } else {
    run.status = "planning";
  }

  run.updated_at = utcNow();
  return run;
}

export function upsertNode(run: GrillRun, input: {
  id: string;
  resolutionRoute: string;
  question: string;
  options: string[];
  decision: string;
  recommendedResolution: string;
  acceptanceCriteria: string;
  rationale: string;
  risk: string;
  ledgerRefs: string[];
  dependsOn: string[];
}): GrillRun {
  const now = utcNow();
  const resolutionRoute = assertKnown(
    RESOLUTION_ROUTES,
    input.resolutionRoute,
    "resolution route",
  ) as ResolutionRoute;
  if (resolutionRoute === "user_answer" && input.options.length < 2) {
    throw new Error("user_answer nodes require at least two --option values");
  }
  const existing = run.question_nodes.find((node) => node.id === input.id);
  const base: GrillNode = existing ?? {
    id: input.id,
    resolution_route: resolutionRoute,
    status: "pending",
    depends_on: [],
    question: "",
    options_considered: [],
    decision_protected: "",
    recommended_resolution: "",
    acceptance_criteria: "",
    rationale: "",
    risk_if_wrong: "",
    evidence_refs: [],
    ledger_refs: [],
    created_at: now,
    updated_at: now,
  };
  base.resolution_route = resolutionRoute;
  base.question = input.question;
  base.options_considered = input.options;
  base.decision_protected = input.decision;
  base.recommended_resolution = input.recommendedResolution;
  base.acceptance_criteria = input.acceptanceCriteria;
  base.rationale = input.rationale;
  base.risk_if_wrong = input.risk;
  base.ledger_refs = input.ledgerRefs;
  base.depends_on = input.dependsOn;
  base.updated_at = now;

  if (!existing) {
    run.question_nodes.push(base);
  }
  return refreshRun(run);
}

export function nextNode(run: GrillRun): GrillNode | undefined {
  return run.question_nodes.find((node) => node.status === "ready")
    ?? run.question_nodes.find((node) => node.status === "evidence_needed");
}

export function recordAnswer(run: GrillRun, nodeId: string, answer: string): GrillRun {
  const node = run.question_nodes.find((item) => item.id === nodeId);
  if (!node) {
    throw new Error(`unknown node: ${nodeId}`);
  }
  if (node.resolution_route !== "user_answer") {
    throw new Error(`cannot answer node with route ${node.resolution_route}: ${nodeId}`);
  }
  if (node.status !== "ready" && node.status !== "answered") {
    throw new Error(`node is not ready to answer: ${nodeId} (${node.status})`);
  }
  const now = utcNow();
  node.status = "answered";
  node.updated_at = now;
  run.qa_events.push({
    event_id: `qa-${String(run.qa_events.length + 1).padStart(3, "0")}`,
    node_id: node.id,
    question: node.question,
    options_considered: node.options_considered,
    recommended_answer: node.recommended_resolution,
    raw_answer: answer,
    answered_at: now,
  });
  return refreshRun(run);
}

export function attachEvidence(run: GrillRun, nodeId: string, evidence: EvidenceRef): GrillRun {
  const node = run.question_nodes.find((item) => item.id === nodeId);
  if (!node) {
    throw new Error(`unknown node: ${nodeId}`);
  }
  if (node.resolution_route === "user_answer") {
    throw new Error(`cannot attach evidence to user_answer node: ${nodeId}`);
  }
  node.evidence_refs.push(evidence);
  node.status = "evidence_attached";
  node.updated_at = evidence.attached_at;
  return refreshRun(run);
}

export function recordConvergenceCheck(run: GrillRun, input: {
  goalOrPrinciple: string;
  signal: string;
  adjacentBranch: string;
  decision: string;
  note: string;
}): GrillRun {
  const decision = assertKnown(CONVERGENCE_DECISIONS, input.decision, "convergence decision") as ConvergenceDecision;
  const now = utcNow();
  run.convergence_check = {
    status: "resolved",
    answer_count: run.qa_events.length,
    goal_or_principle: input.goalOrPrinciple,
    signal: input.signal,
    adjacent_branch: input.adjacentBranch,
    decision,
    note: input.note,
    resolved_at: now,
    updated_at: now,
  };
  return refreshRun(run);
}

export function progressCounts(run: GrillRun): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const node of run.question_nodes) {
    counts[node.status] = (counts[node.status] ?? 0) + 1;
  }
  return counts;
}
