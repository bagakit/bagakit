import fs from "node:fs";
import path from "node:path";

import type { PromotionRecord, TopicRecord } from "./model.ts";

export type PromotionReadinessState =
  | "blocked"
  | "host-proposed"
  | "host-landed"
  | "upstream-proposed"
  | "upstream-landed"
  | "split-proposed"
  | "split-landed";

export interface PromotionReadinessSummary {
  state: PromotionReadinessState;
  route_decision: TopicRecord["routing"] extends infer T ? (T extends { decision: infer D } ? D : never) | "unset" : "unset";
  blockers: string[];
  evidence_counts: {
    sources: number;
    feedback: number;
    benchmarks: number;
    decisions: number;
  };
  referenced_promotions: PromotionRecord[];
  archive_ready: boolean;
  recommended_next_move: string;
  strongest_evidence: string[];
}

function latestDecisionTexts(topic: TopicRecord): string[] {
  return topic.notes
    .filter((note) => note.kind === "decision")
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, 2)
    .map((note) => note.title ? `${note.title}: ${note.text}` : note.text);
}

function strongestEvidence(topic: TopicRecord): string[] {
  const lines: string[] = [];
  for (const source of topic.sources.slice(-2).reverse()) {
    lines.push(`source:${source.id} ${source.title}`);
  }
  for (const benchmark of topic.benchmarks.slice(-2).reverse()) {
    lines.push(`benchmark:${benchmark.id} ${benchmark.metric}=${benchmark.result}`);
  }
  for (const feedback of topic.feedback.slice(-2).reverse()) {
    lines.push(`feedback:${feedback.channel} ${feedback.signal}`);
  }
  for (const decision of latestDecisionTexts(topic)) {
    lines.push(`decision:${decision}`);
  }
  return lines.slice(0, 5);
}

function routeDecision(topic: TopicRecord): PromotionReadinessSummary["route_decision"] {
  return topic.routing?.decision ?? "unset";
}

function currentRefExists(root: string, ref: string): boolean {
  return fs.existsSync(path.resolve(root, ref));
}

export function evaluatePromotionReadiness(topic: TopicRecord, root: string): PromotionReadinessSummary {
  const blockers: string[] = [];
  const decisionCount = topic.notes.filter((note) => note.kind === "decision").length;
  const evidenceCounts = {
    sources: topic.sources.length,
    feedback: topic.feedback.length,
    benchmarks: topic.benchmarks.length,
    decisions: decisionCount,
  };

  if (!topic.preflight) {
    blockers.push("record preflight before repository-level tracking grows further");
  }
  if (decisionCount === 0) {
    blockers.push("preserve at least one repository-level decision rationale");
  }
  if (topic.sources.length === 0 && topic.feedback.length === 0 && topic.benchmarks.length === 0) {
    blockers.push("record structured evidence before claiming repository-level learning");
  }

  const route = topic.routing;
  const decision = routeDecision(topic);
  const referencedPromotions = route?.upstream_promotion_ids.map((promotionId) => {
    const promotion = topic.promotions.find((item) => item.id === promotionId);
    return promotion ?? null;
  }) ?? [];
  const missingPromotionId = route?.upstream_promotion_ids.find((promotionId) => {
    return !topic.promotions.some((promotion) => promotion.id === promotionId);
  });

  if (!route) {
    blockers.push("set one repository-level route decision: host, upstream, or split");
  } else {
    if (!route.acceptance_authority) {
      blockers.push("record the authority that accepted the promotion route");
    }
    if (!route.acceptance_ref) {
      blockers.push("record an acceptance_ref for the promotion route");
    } else if (!currentRefExists(root, route.acceptance_ref)) {
      blockers.push(`acceptance_ref does not currently exist: ${route.acceptance_ref}`);
    }
    if (!route.counterevidence_disposition) {
      blockers.push("record how counterevidence was dispositioned");
    } else if (route.counterevidence_disposition === "open") {
      blockers.push("resolve or explicitly accept the open counterevidence before promotion");
    }
    if (!route.target_owner) {
      blockers.push("name the owner responsible for the promotion target");
    }
    if (!route.proof_plan) {
      blockers.push("name the proof plan that will verify the landing");
    }
    if (!route.proof_plan_ref) {
      blockers.push("record a proof_plan_ref for the named proof plan");
    } else if (!currentRefExists(root, route.proof_plan_ref)) {
      blockers.push(`proof_plan_ref does not currently exist: ${route.proof_plan_ref}`);
    }
    if ((route.decision === "host" || route.decision === "split") && !route.host_ref) {
      blockers.push(`route ${route.decision} requires a landed host_ref`);
    }
    if ((route.decision === "host" || route.decision === "split") && route.host_ref && !currentRefExists(root, route.host_ref)) {
      blockers.push(`host_ref does not currently exist: ${route.host_ref}`);
    }
    if (route.decision === "upstream" || route.decision === "split") {
      if (route.upstream_promotion_ids.length === 0) {
        blockers.push(`route ${route.decision} requires at least one upstream promotion id`);
      }
      if (missingPromotionId) {
        blockers.push(`route references unknown promotion id: ${missingPromotionId}`);
      }
    }
  }

  const materializedPromotions = referencedPromotions.filter(
    (promotion): promotion is PromotionRecord => promotion !== null,
  );
  const allReferencedPromotionsLanded =
    materializedPromotions.length > 0 &&
    materializedPromotions.every((promotion) => promotion.status === "landed_verified");

  for (const promotion of materializedPromotions) {
    if (promotion.status === "landed_verified" && !promotion.ref) {
      blockers.push(`landed promotion ${promotion.id} requires a landing ref`);
    }
    if (promotion.status === "landed_verified" && promotion.proof_refs.length === 0) {
      blockers.push(`landed promotion ${promotion.id} requires proof refs`);
    }
    if (promotion.status === "landed_verified" && promotion.ref && !currentRefExists(root, promotion.ref)) {
      blockers.push(`landed promotion ref does not currently exist: ${promotion.ref}`);
    }
    if (promotion.status === "landed_verified") {
      for (const proofRef of promotion.proof_refs) {
        if (!currentRefExists(root, proofRef)) {
          blockers.push(`landed promotion proof ref does not currently exist: ${proofRef}`);
        }
      }
    }
  }
  const unresolvedCandidates = topic.candidates.filter((candidate) =>
    ["planned", "trial", "revisit"].includes(candidate.status)
  );
  if (unresolvedCandidates.length > 0) {
    blockers.push(`resolve candidate disposition before archive: ${unresolvedCandidates.map((item) => item.id).join(", ")}`);
  }
  if (route && (route.decision === "upstream" || route.decision === "split")) {
    const routed = new Set(route.upstream_promotion_ids);
    const unrouted = topic.promotions.filter(
      (promotion) => !["rejected", "superseded"].includes(promotion.status) && !routed.has(promotion.id),
    );
    if (unrouted.length > 0) {
      blockers.push(`route or remove promotions not covered by the route decision: ${unrouted.map((item) => item.id).join(", ")}`);
    }
  } else if (route?.decision === "host") {
    const unresolved = topic.promotions.filter((promotion) =>
      ["proposed", "accepted_for_landing"].includes(promotion.status),
    );
    if (unresolved.length > 0) {
      blockers.push(`reject or supersede non-host promotions before archive: ${unresolved.map((item) => item.id).join(", ")}`);
    }
  }

  let state: PromotionReadinessState = "blocked";
  if (blockers.length === 0) {
    if (decision === "host") {
      state = route?.host_ref ? "host-landed" : "host-proposed";
    } else if (decision === "upstream") {
      state = allReferencedPromotionsLanded ? "upstream-landed" : "upstream-proposed";
    } else if (decision === "split") {
      state = route?.host_ref && allReferencedPromotionsLanded ? "split-landed" : "split-proposed";
    }
  }

  let recommendedNextMove = "Keep the topic current and review whether another repository-level increment is still needed.";
  if (blockers.length > 0) {
    recommendedNextMove = blockers[0];
  } else if (state === "host-proposed") {
    recommendedNextMove = "Materialize the host-side landing and record host_ref once the host artifact exists.";
  } else if (state === "upstream-proposed" || state === "split-proposed") {
    recommendedNextMove = "Land the referenced upstream promotions or explicitly retire the proposal state.";
  } else if (topic.status !== "archived") {
    recommendedNextMove = "Decide whether the topic should stay open for another iteration or move toward archival.";
  }

  return {
    state,
    route_decision: decision,
    blockers,
    evidence_counts: evidenceCounts,
    referenced_promotions: materializedPromotions,
    archive_ready: blockers.length === 0 && state.endsWith("landed"),
    recommended_next_move: recommendedNextMove,
    strongest_evidence: strongestEvidence(topic),
  };
}
