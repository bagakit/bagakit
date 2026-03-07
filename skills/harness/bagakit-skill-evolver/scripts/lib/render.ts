import path from "node:path";

import type {
  CandidateRecord,
  IntakeSignalRecord,
  PromotionRecord,
  TopicRecord,
} from "./model.ts";
import type { EvolverPaths } from "./paths.ts";
import type { PromotionReadinessSummary } from "./readiness.ts";
import { evaluatePromotionReadiness } from "./readiness.ts";

function quote(value: string): string {
  return `\`${value}\``;
}

function formatRepoRef(ref?: string): string {
  if (!ref) {
    return "none";
  }
  return quote(ref);
}

function joinRepoRefs(topic: TopicRecord): string[] {
  const refs = new Set<string>();

  for (const ref of topic.local_context_refs) {
    refs.add(ref);
  }
  for (const source of topic.sources) {
    if (source.local_ref) {
      refs.add(source.local_ref);
    }
    if (source.summary_ref) {
      refs.add(source.summary_ref);
    }
  }
  return [...refs].sort((left, right) => left.localeCompare(right));
}

function isResearchWorkspaceRef(ref: string): boolean {
  return ref.startsWith(".bagakit/researcher/");
}

function formatCandidateLine(candidate: CandidateRecord): string {
  return `- ${quote(candidate.id)} | status: ${quote(candidate.status)} | kind: ${quote(candidate.kind)} | source: ${quote(candidate.source)}\n  - ${candidate.summary}`;
}

function formatPromotionLine(promotion: PromotionRecord): string {
  const refText = promotion.ref ? ` | ref: ${quote(promotion.ref)}` : "";
  const proofText =
    promotion.proof_refs.length > 0
      ? `\n  - proof: ${promotion.proof_refs.map((ref) => quote(ref)).join(", ")}`
      : "";
  return `- ${quote(promotion.id)} | surface: ${quote(promotion.surface)} | status: ${quote(promotion.status)} | target: ${quote(promotion.target)}${refText}\n  - ${promotion.summary}${proofText}`;
}

function buildDurableSurfaceLines(topic: TopicRecord): string[] {
  if (topic.promotions.length === 0) {
    return ["- none"];
  }
  return topic.promotions.map((promotion) => formatPromotionLine(promotion));
}

function buildDecisionLines(topic: TopicRecord, limit: number | null = 5): string[] {
  const decisions = topic.notes
    .filter((note) => note.kind === "decision")
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
  const bounded = limit === null ? decisions : decisions.slice(0, limit);

  if (bounded.length === 0) {
    return ["- none"];
  }

  return bounded.map((note) => {
    const title = note.title ? `${quote(note.title)} | ` : "";
    const candidates = note.related_candidates?.length
      ? ` | candidates: ${note.related_candidates.map((candidate) => quote(candidate)).join(", ")}`
      : "";
    const sources = note.related_source_ids?.length
      ? ` | sources: ${note.related_source_ids.map((sourceId) => quote(sourceId)).join(", ")}`
      : "";
    return `- ${title}${quote(note.created_at)}${candidates}${sources}\n  - ${note.text}`;
  });
}

function buildSourceLines(topic: TopicRecord): string[] {
  if (topic.sources.length === 0) {
    return ["- none"];
  }

  return topic.sources.map((source) => {
    return `- ${quote(source.id)} | kind: ${quote(source.kind)} | title: ${source.title}\n  - origin: ${quote(source.origin)} | original: ${formatRepoRef(source.local_ref)} | summary: ${formatRepoRef(source.summary_ref)}`;
  });
}

function buildFeedbackLines(topic: TopicRecord, limit: number | null = 5): string[] {
  if (topic.feedback.length === 0) {
    return ["- none"];
  }

  const records = (limit === null ? topic.feedback : topic.feedback.slice(-limit))
    .reverse()
  return records
    .map((feedback) => {
      return `- channel: ${quote(feedback.channel)} | signal: ${quote(feedback.signal)} | at: ${quote(feedback.created_at)}\n  - ${feedback.detail}`;
    });
}

function buildBenchmarkLines(topic: TopicRecord, limit: number | null = 5): string[] {
  if (topic.benchmarks.length === 0) {
    return ["- none"];
  }

  const records = (limit === null ? topic.benchmarks : topic.benchmarks.slice(-limit))
    .reverse()
  return records
    .map((benchmark) => {
      const baseline = benchmark.baseline ? ` | baseline: ${quote(benchmark.baseline)}` : "";
      const detail = benchmark.detail ? `\n  - ${benchmark.detail}` : "";
      return `- ${quote(benchmark.id)} | metric: ${quote(benchmark.metric)} | result: ${quote(benchmark.result)}${baseline}${detail}`;
    });
}

function buildReadinessLines(topic: TopicRecord): string[] {
  const readiness = evaluatePromotionReadiness(topic);
  const lines = [
    `- readiness state: ${quote(readiness.state)}`,
    `- route decision: ${quote(readiness.route_decision)}`,
    `- archive ready: ${quote(readiness.archive_ready ? "yes" : "no")}`,
  ];
  for (const blocker of readiness.blockers) {
    lines.push(`- blocker: ${blocker}`);
  }
  if (readiness.blockers.length === 0) {
    lines.push("- no blocking readiness issues");
  }
  return lines;
}

function buildRecommendedMove(topic: TopicRecord): string {
  return evaluatePromotionReadiness(topic).recommended_next_move;
}

function buildRoutingLines(topic: TopicRecord): string[] {
  if (!topic.routing) {
    return ["- none"];
  }
  const lines = [
    `- decision: ${quote(topic.routing.decision)}`,
    `- rationale: ${topic.routing.rationale}`,
    `- decided_at: ${quote(topic.routing.decided_at)}`,
  ];
  if (topic.routing.host_target) {
    lines.push(`- host_target: ${quote(topic.routing.host_target)}`);
  }
  if (topic.routing.host_ref) {
    lines.push(`- host_ref: ${quote(topic.routing.host_ref)}`);
  }
  if (topic.routing.upstream_promotion_ids.length > 0) {
    lines.push(
      `- upstream_promotions: ${topic.routing.upstream_promotion_ids
        .map((promotionId) => quote(promotionId))
        .join(", ")}`,
    );
  }
  return lines;
}

function buildStrongestEvidenceLines(readiness: PromotionReadinessSummary): string[] {
  if (readiness.strongest_evidence.length === 0) {
    return ["- none"];
  }
  return readiness.strongest_evidence.map((line) => `- ${line}`);
}

export function buildMemInboxReadme(
  paths: EvolverPaths,
  signals: IntakeSignalRecord[],
): string {
  const signalRoot = path.relative(paths.root, paths.memInboxSignalsRoot).split(path.sep).join("/");
  const counts = {
    pending: signals.filter((signal) => signal.status === "pending").length,
    adopted: signals.filter((signal) => signal.status === "adopted").length,
    dismissed: signals.filter((signal) => signal.status === "dismissed").length,
  };
  const lines = [
    "# Evolver Intake Buffer",
    "",
    "This README is derived from the `.mem_inbox/` signal files.",
    "",
    `- signals root: ${quote(signalRoot)}`,
    `- pending: ${counts.pending}`,
    `- adopted: ${counts.adopted}`,
    `- dismissed: ${counts.dismissed}`,
    "",
    "## Pending Signals",
    "",
  ];
  const pending = signals
    .filter((signal) => signal.status === "pending")
    .sort((left, right) => left.id.localeCompare(right.id));
  if (pending.length === 0) {
    lines.push("- none");
  } else {
    for (const signal of pending) {
      const hint = signal.topic_hint ? ` | topic_hint: ${quote(signal.topic_hint)}` : "";
      const refs = signal.local_refs.length > 0
        ? ` | refs: ${signal.local_refs.map((ref) => quote(ref)).join(", ")}`
        : "";
      lines.push(`- ${quote(signal.id)} | kind: ${quote(signal.kind)}${hint}${refs}`);
      lines.push(`  - ${signal.summary}`);
    }
  }
  lines.push("");
  lines.push("## Resolved Signals");
  lines.push("");
  const resolved = signals
    .filter((signal) => signal.status !== "pending")
    .sort((left, right) => left.id.localeCompare(right.id));
  if (resolved.length === 0) {
    lines.push("- none");
  } else {
    for (const signal of resolved) {
      const adopted = signal.adopted_topic ? ` | adopted_topic: ${quote(signal.adopted_topic)}` : "";
      const resolution = signal.resolution_note ? `\n  - ${signal.resolution_note}` : "";
      lines.push(`- ${quote(signal.id)} | status: ${quote(signal.status)}${adopted}`);
      lines.push(`  - ${signal.summary}${resolution}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

export function buildTopicReadme(paths: EvolverPaths, topic: TopicRecord): string {
  const reportRelative = path.relative(paths.topicDir(topic.slug), paths.topicReport(topic.slug));
  const lines = [
    `# ${topic.title}`,
    "",
    `- slug: ${quote(topic.slug)}`,
    `- status: ${quote(topic.status)}`,
    `- preflight: ${quote(topic.preflight?.decision ?? "unset")}`,
    `- candidates: ${topic.candidates.length}`,
    `- sources: ${topic.sources.length}`,
    `- feedback: ${topic.feedback.length}`,
    `- benchmarks: ${topic.benchmarks.length}`,
    `- promotions: ${topic.promotions.length}`,
    `- notes: ${topic.notes.length}`,
    `- local_context_refs: ${topic.local_context_refs.length}`,
    `- updated_at: ${topic.updated_at}`,
    "",
    "Derived artifacts:",
    "",
    "- `topic.json`",
    `- ${quote(reportRelative.split(path.sep).join("/"))}`,
    "",
    "This README is a generated entry view. Use the report for steward-facing",
    "topic synthesis.",
    "",
    "Use the evolver CLI to update this topic instead of hand-editing the JSON file.",
  ];
  return lines.join("\n") + "\n";
}

export function buildTopicReport(paths: EvolverPaths, topic: TopicRecord): string {
  const readiness = evaluatePromotionReadiness(topic);
  const runtimeRoot = path.relative(paths.root, paths.topicDir(topic.slug)).split(path.sep).join("/");
  const researchRefs = joinRepoRefs(topic).filter((ref) => isResearchWorkspaceRef(ref));
  const durableSurfaceLines = buildDurableSurfaceLines(topic);
  const readinessLines = buildReadinessLines(topic);
  const lines = [
    `# ${topic.title} Report`,
    "",
    "## Current State",
    "",
    `- slug: ${quote(topic.slug)}`,
    `- status: ${quote(topic.status)}`,
    `- preflight: ${quote(topic.preflight?.decision ?? "unset")}`,
    `- updated_at: ${quote(topic.updated_at)}`,
    "",
    "## Layer Map",
    "",
    "### Research Workspace",
    "",
    ...(researchRefs.length > 0 ? researchRefs.map((ref) => `- ${quote(ref)}`) : ["- none"]),
    "",
    "### Structured Decision Memory",
    "",
    `- decision root: ${quote(runtimeRoot)}`,
    `- topic file: ${quote(`${runtimeRoot}/topic.json`)}`,
    `- entry view: ${quote(`${runtimeRoot}/README.md`)}`,
    `- steward report: ${quote(`${runtimeRoot}/REPORT.md`)}`,
    "",
    `- candidates: ${topic.candidates.length}`,
    `- sources: ${topic.sources.length}`,
    `- feedback: ${topic.feedback.length}`,
    `- benchmarks: ${topic.benchmarks.length}`,
    `- promotions: ${topic.promotions.length}`,
    `- notes: ${topic.notes.length}`,
    "",
    "### Project Runtime State",
    "",
    `- evolver root: ${quote(path.relative(paths.root, paths.stateRoot).split(path.sep).join("/"))}`,
    `- repository index: ${quote(path.relative(paths.root, paths.indexPath).split(path.sep).join("/"))}`,
    `- topics root: ${quote(path.relative(paths.root, paths.topicsRoot).split(path.sep).join("/"))}`,
    "",
    "### Durable Repository Surfaces",
    "",
    ...durableSurfaceLines,
    "",
    "## Routing Decision",
    "",
    ...buildRoutingLines(topic),
    "",
    "## Promotion Readiness",
    "",
    ...readinessLines,
    "",
    "## Strongest Evidence",
    "",
    ...buildStrongestEvidenceLines(readiness),
    "",
    "## Recommended Next Move",
    "",
    `- ${buildRecommendedMove(topic)}`,
    "",
    "## Candidates",
    "",
    ...(topic.candidates.length > 0
      ? topic.candidates.map((candidate) => formatCandidateLine(candidate))
      : ["- none"]),
    "",
    "## Sources",
    "",
    ...buildSourceLines(topic),
    "",
    "## Recent Feedback",
    "",
    ...buildFeedbackLines(topic),
    "",
    "## Recent Benchmarks",
    "",
    ...buildBenchmarkLines(topic),
    "",
    "## Recent Decisions",
    "",
    ...buildDecisionLines(topic),
  ];

  return lines.join("\n") + "\n";
}

export function buildTopicHandoff(
  paths: EvolverPaths,
  topic: TopicRecord,
  readiness: PromotionReadinessSummary = evaluatePromotionReadiness(topic),
): string {
  const runtimeRoot = path.relative(paths.root, paths.topicDir(topic.slug)).split(path.sep).join("/");
  const lines = [
    `# ${topic.title} Handoff`,
    "",
    `- slug: ${quote(topic.slug)}`,
    `- status: ${quote(topic.status)}`,
    `- route: ${quote(readiness.route_decision)}`,
    `- readiness: ${quote(readiness.state)}`,
    `- archive_ready: ${quote(readiness.archive_ready ? "yes" : "no")}`,
    "",
    "## Strongest Evidence",
    "",
    ...buildStrongestEvidenceLines(readiness),
    "",
    "## Open Blockers",
    "",
    ...(readiness.blockers.length > 0 ? readiness.blockers.map((line) => `- ${line}`) : ["- none"]),
    "",
    "## Open Promotion Actions",
    "",
    ...(readiness.referenced_promotions.length > 0
      ? readiness.referenced_promotions.map((promotion) => formatPromotionLine(promotion))
      : ["- none"]),
    "",
    "## Recommended Next Move",
    "",
    `- ${readiness.recommended_next_move}`,
    "",
    "## Next Commands",
    "",
    `- ${quote(`node --experimental-strip-types skills/harness/bagakit-skill-evolver/scripts/evolver.ts promotion-readiness --topic ${topic.slug} --root . --json`)}`,
    `- ${quote(`node --experimental-strip-types skills/harness/bagakit-skill-evolver/scripts/evolver.ts status --topic ${topic.slug} --root .`)}`,
    `- topic file under ${quote(runtimeRoot)}: ${quote("topic.json")}`,
  ];
  return lines.join("\n") + "\n";
}

export function buildTopicArchive(
  paths: EvolverPaths,
  topic: TopicRecord,
  readiness: PromotionReadinessSummary = evaluatePromotionReadiness(topic),
): string {
  const archiveNote = topic.notes
    .filter((note) => note.kind === "decision" && note.title === "archive-topic")
    .sort((left, right) => right.created_at.localeCompare(left.created_at))[0];
  const lines = [
    `# ${topic.title} Archive`,
    "",
    `- slug: ${quote(topic.slug)}`,
    `- status: ${quote(topic.status)}`,
    `- route: ${quote(readiness.route_decision)}`,
    `- final readiness: ${quote(readiness.state)}`,
    `- archived_at: ${quote(topic.updated_at)}`,
    "",
    "## Close Summary",
    "",
    ...(archiveNote ? [`- ${archiveNote.text}`] : ["- no archive-topic summary recorded"]),
    "",
    "## Decision Trail",
    "",
    ...buildDecisionLines(topic, null),
    "",
    "## Promotion Trail",
    "",
    ...buildDurableSurfaceLines(topic),
    "",
    "## Evidence Trail",
    "",
    "### Sources",
    "",
    ...buildSourceLines(topic),
    "",
    "### Feedback",
    "",
    ...buildFeedbackLines(topic, null),
    "",
    "### Benchmarks",
    "",
    ...buildBenchmarkLines(topic, null),
  ];
  return lines.join("\n") + "\n";
}
