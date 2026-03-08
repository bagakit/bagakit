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

export function evaluatePromotionReadiness(topic: TopicRecord): PromotionReadinessSummary {
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
    if ((route.decision === "host" || route.decision === "split") && !route.host_target && !route.host_ref) {
      blockers.push(`route ${route.decision} requires host_target or host_ref`);
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
    materializedPromotions.every((promotion) => promotion.status === "landed");

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
