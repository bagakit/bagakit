import path from "node:path";

import type {
  CandidateRecord,
  PromotionRecord,
  TopicRecord,
} from "./model.ts";
import type { EvolverPaths } from "./paths.ts";

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

function isHiddenDocsRef(ref: string): boolean {
  return ref.startsWith("docs/.");
}

function formatCandidateLine(candidate: CandidateRecord): string {
  return `- ${quote(candidate.id)} | status: ${quote(candidate.status)} | kind: ${quote(candidate.kind)} | source: ${quote(candidate.source)}\n  - ${candidate.summary}`;
}

function formatPromotionLine(promotion: PromotionRecord): string {
  const refText = promotion.ref ? ` | ref: ${quote(promotion.ref)}` : "";
  return `- ${quote(promotion.id)} | surface: ${quote(promotion.surface)} | status: ${quote(promotion.status)} | target: ${quote(promotion.target)}${refText}\n  - ${promotion.summary}`;
}

function buildDurableSurfaceLines(topic: TopicRecord): string[] {
  if (topic.promotions.length === 0) {
    return ["- none"];
  }
  return topic.promotions.map((promotion) => formatPromotionLine(promotion));
}

function buildDecisionLines(topic: TopicRecord): string[] {
  const decisions = topic.notes
    .filter((note) => note.kind === "decision")
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, 5);

  if (decisions.length === 0) {
    return ["- none"];
  }

  return decisions.map((note) => {
    const title = note.title ? `${quote(note.title)} | ` : "";
    const candidates = note.related_candidates?.length
      ? ` | candidates: ${note.related_candidates.map((candidate) => quote(candidate)).join(", ")}`
      : "";
    return `- ${title}${quote(note.created_at)}${candidates}\n  - ${note.text}`;
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

function buildFeedbackLines(topic: TopicRecord): string[] {
  if (topic.feedback.length === 0) {
    return ["- none"];
  }

  return topic.feedback
    .slice(-5)
    .reverse()
    .map((feedback) => {
      return `- channel: ${quote(feedback.channel)} | signal: ${quote(feedback.signal)} | at: ${quote(feedback.created_at)}\n  - ${feedback.detail}`;
    });
}

function buildBenchmarkLines(topic: TopicRecord): string[] {
  if (topic.benchmarks.length === 0) {
    return ["- none"];
  }

  return topic.benchmarks
    .slice(-5)
    .reverse()
    .map((benchmark) => {
      const baseline = benchmark.baseline ? ` | baseline: ${quote(benchmark.baseline)}` : "";
      const detail = benchmark.detail ? `\n  - ${benchmark.detail}` : "";
      return `- ${quote(benchmark.id)} | metric: ${quote(benchmark.metric)} | result: ${quote(benchmark.result)}${baseline}${detail}`;
    });
}

function buildReadinessLines(topic: TopicRecord): string[] {
  const lines: string[] = [];

  if (!topic.preflight) {
    lines.push("- missing preflight decision");
  }
  if (topic.candidates.length === 0) {
    lines.push("- no candidate comparison recorded");
  }
  const decisionCount = topic.notes.filter((note) => note.kind === "decision").length;
  if (decisionCount === 0) {
    lines.push("- no preserved decision rationale");
  }
  if (
    topic.sources.length === 0 &&
    topic.feedback.length === 0 &&
    topic.benchmarks.length === 0
  ) {
    lines.push("- no structured evidence recorded yet");
  }
  if (topic.promotions.length === 0) {
    lines.push("- no durable promotion tracked yet");
  } else if (!topic.promotions.some((promotion) => promotion.status === "landed")) {
    lines.push("- promotion proposals exist, but none are landed yet");
  }

  return lines.length > 0 ? lines : ["- topic is evidence-bearing and has at least one landed or tracked durable promotion"];
}

function buildRecommendedMove(topic: TopicRecord): string {
  if (!topic.preflight) {
    return "Record a preflight decision before the topic grows further.";
  }
  if (
    topic.sources.length === 0 &&
    topic.feedback.length === 0 &&
    topic.benchmarks.length === 0
  ) {
    return "Add the strongest available evidence before promoting this topic upward.";
  }
  if (topic.promotions.length === 0) {
    return "Prepare the first durable promotion target once the evidence is strong enough.";
  }
  if (!topic.promotions.some((promotion) => promotion.status === "landed")) {
    return "Either land the open promotion proposal or explicitly retire it.";
  }
  return "Decide whether the topic should stay active for another increment or move toward archival.";
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
  const runtimeRoot = path.relative(paths.root, paths.topicDir(topic.slug)).split(path.sep).join("/");
  const researchRefs = joinRepoRefs(topic).filter((ref) => isHiddenDocsRef(ref));
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
    "### Hidden Research",
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
    "## Promotion Readiness",
    "",
    ...readinessLines,
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
