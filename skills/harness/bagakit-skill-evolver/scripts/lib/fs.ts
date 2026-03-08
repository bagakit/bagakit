import fs from "node:fs";
import path from "node:path";

import type {
  EvolverIndex,
  IntakeSignalRecord,
  PromotionRecord,
  RoutingRecord,
  TopicRecord,
  TopicIndexEntry,
} from "./model.ts";
import type { EvolverPaths } from "./paths.ts";
import { buildMemInboxReadme, buildTopicArchive, buildTopicHandoff, buildTopicReadme, buildTopicReport } from "./render.ts";
import { evaluatePromotionReadiness } from "./readiness.ts";

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file: string, value: unknown): void {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
}

function normalizeIndexEntry(raw: Partial<TopicIndexEntry>): TopicIndexEntry {
  return {
    slug: String(raw.slug ?? ""),
    title: String(raw.title ?? ""),
    status: (raw.status ?? "active") as TopicRecord["status"],
    updated_at: String(raw.updated_at ?? ""),
    preflight_decision: raw.preflight_decision,
    local_context_ref_count: Number(raw.local_context_ref_count ?? 0),
    candidate_count: Number(raw.candidate_count ?? 0),
    source_count: Number(raw.source_count ?? 0),
    feedback_count: Number(raw.feedback_count ?? 0),
    benchmark_count: Number(raw.benchmark_count ?? 0),
    promotion_count: Number(raw.promotion_count ?? 0),
    note_count: Number(raw.note_count ?? 0),
  };
}

function normalizeRoutingRecord(raw: unknown): RoutingRecord | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const record = raw as Partial<RoutingRecord>;
  return {
    decision: String(record.decision ?? "") as RoutingRecord["decision"],
    rationale: String(record.rationale ?? ""),
    decided_at: String(record.decided_at ?? ""),
    host_target: record.host_target === undefined ? undefined : String(record.host_target),
    host_ref: record.host_ref === undefined ? undefined : String(record.host_ref),
    upstream_promotion_ids: Array.isArray(record.upstream_promotion_ids)
      ? record.upstream_promotion_ids.map((value) => String(value))
      : [],
  };
}

function normalizePromotionRecord(raw: unknown): PromotionRecord {
  const record = (raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw
    : {}) as Partial<PromotionRecord>;
  return {
    id: String(record.id ?? ""),
    surface: String(record.surface ?? "spec") as PromotionRecord["surface"],
    status: String(record.status ?? "proposed") as PromotionRecord["status"],
    target: String(record.target ?? ""),
    summary: String(record.summary ?? ""),
    ref: record.ref === undefined ? undefined : String(record.ref),
    proof_refs: Array.isArray(record.proof_refs)
      ? record.proof_refs.map((value) => String(value))
      : [],
    created_at: String(record.created_at ?? ""),
    updated_at: String(record.updated_at ?? ""),
  };
}

function normalizeTopicRecord(raw: Partial<TopicRecord>, fallbackSlug: string): TopicRecord {
  return {
    version: 1,
    slug: String(raw.slug ?? fallbackSlug),
    title: String(raw.title ?? fallbackSlug),
    status: (raw.status ?? "active") as TopicRecord["status"],
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
    preflight: raw.preflight,
    routing: normalizeRoutingRecord(raw.routing),
    local_context_refs: Array.isArray(raw.local_context_refs) ? raw.local_context_refs : [],
    candidates: Array.isArray(raw.candidates) ? raw.candidates : [],
    sources: Array.isArray(raw.sources) ? raw.sources : [],
    feedback: Array.isArray(raw.feedback) ? raw.feedback : [],
    benchmarks: Array.isArray(raw.benchmarks) ? raw.benchmarks : [],
    promotions: Array.isArray(raw.promotions) ? raw.promotions.map((item) => normalizePromotionRecord(item)) : [],
    notes: Array.isArray(raw.notes) ? raw.notes : [],
  };
}

function normalizeIntakeSignalRecord(raw: Partial<IntakeSignalRecord>, fallbackId: string): IntakeSignalRecord {
  const localRefs = Array.isArray(raw.local_refs) ? raw.local_refs.map((value) => String(value)) : [];
  const evidence = Array.isArray(raw.evidence) ? raw.evidence.map((value) => String(value)) : [];
  return {
    version: 1,
    id: String(raw.id ?? fallbackId),
    kind: String(raw.kind ?? "decision") as IntakeSignalRecord["kind"],
    title: String(raw.title ?? fallbackId),
    summary: String(raw.summary ?? ""),
    producer: String(raw.producer ?? "unknown"),
    source_channel: String(raw.source_channel ?? "unknown"),
    topic_hint: raw.topic_hint === undefined ? undefined : String(raw.topic_hint),
    confidence: Number(raw.confidence ?? 0),
    evidence,
    local_refs: localRefs,
    status: String(raw.status ?? "pending") as IntakeSignalRecord["status"],
    adopted_topic: raw.adopted_topic === undefined ? undefined : String(raw.adopted_topic),
    resolution_note: raw.resolution_note === undefined ? undefined : String(raw.resolution_note),
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

export function ensureBaseLayout(paths: EvolverPaths): void {
  ensureDir(paths.memInboxRoot);
  ensureDir(paths.memInboxSignalsRoot);
  ensureDir(paths.stateRoot);
  ensureDir(paths.topicsRoot);
}

export function signalExists(paths: EvolverPaths, signalId: string): boolean {
  return fs.existsSync(paths.memInboxSignalFile(signalId));
}

export function listSignalIds(paths: EvolverPaths): string[] {
  ensureBaseLayout(paths);
  return fs
    .readdirSync(paths.memInboxSignalsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name.slice(0, -5))
    .sort((a, b) => a.localeCompare(b));
}

export function readSignal(paths: EvolverPaths, signalId: string): IntakeSignalRecord {
  if (!signalExists(paths, signalId)) {
    throw new Error(`unknown signal: ${signalId}`);
  }
  const raw = readJson(paths.memInboxSignalFile(signalId)) as Partial<IntakeSignalRecord>;
  return normalizeIntakeSignalRecord(raw, signalId);
}

export function readRawSignal(paths: EvolverPaths, signalId: string): unknown {
  if (!signalExists(paths, signalId)) {
    throw new Error(`unknown signal: ${signalId}`);
  }
  return readJson(paths.memInboxSignalFile(signalId));
}

export function writeSignal(paths: EvolverPaths, signal: IntakeSignalRecord): void {
  writeJson(paths.memInboxSignalFile(signal.id), signal);
}

export function writeMemInboxReadme(paths: EvolverPaths): void {
  const signals = listSignalIds(paths).map((signalId) => readSignal(paths, signalId));
  ensureDir(paths.memInboxRoot);
  fs.writeFileSync(paths.memInboxReadme, buildMemInboxReadme(paths, signals), "utf8");
}

export function readIndex(
  paths: EvolverPaths,
  options?: { createIfMissing?: boolean },
): EvolverIndex {
  ensureBaseLayout(paths);
  if (!fs.existsSync(paths.indexPath)) {
    if (options?.createIfMissing === false) {
      throw new Error("missing evolver index.json");
    }
    const empty: EvolverIndex = { version: 1, topics: [] };
    writeJson(paths.indexPath, empty);
    return empty;
  }
  const raw = readJson(paths.indexPath) as Partial<EvolverIndex>;
  const topics = Array.isArray(raw.topics) ? raw.topics.map((item) => normalizeIndexEntry(item)) : [];
  return {
    version: 1,
    topics,
  };
}

export function readRawIndex(
  paths: EvolverPaths,
  options?: { createIfMissing?: boolean },
): unknown {
  ensureBaseLayout(paths);
  if (!fs.existsSync(paths.indexPath)) {
    if (options?.createIfMissing === false) {
      throw new Error("missing evolver index.json");
    }
    const empty: EvolverIndex = { version: 1, topics: [] };
    writeJson(paths.indexPath, empty);
    return empty;
  }
  return readJson(paths.indexPath);
}

export function writeIndex(paths: EvolverPaths, index: EvolverIndex): void {
  writeJson(paths.indexPath, index);
}

export function topicExists(paths: EvolverPaths, slug: string): boolean {
  return fs.existsSync(paths.topicFile(slug));
}

export function listTopicSlugs(paths: EvolverPaths): string[] {
  ensureBaseLayout(paths);
  return fs
    .readdirSync(paths.topicsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

export function readTopic(paths: EvolverPaths, slug: string): TopicRecord {
  if (!topicExists(paths, slug)) {
    throw new Error(`unknown topic: ${slug}`);
  }
  const raw = readJson(paths.topicFile(slug)) as Partial<TopicRecord>;
  return normalizeTopicRecord(raw, slug);
}

export function readRawTopic(paths: EvolverPaths, slug: string): unknown {
  if (!topicExists(paths, slug)) {
    throw new Error(`unknown topic: ${slug}`);
  }
  return readJson(paths.topicFile(slug));
}

export function writeTopic(paths: EvolverPaths, topic: TopicRecord): void {
  writeJson(paths.topicFile(topic.slug), topic);
}

export function writeTopicReadme(
  paths: EvolverPaths,
  topic: TopicRecord,
): void {
  ensureDir(paths.topicDir(topic.slug));
  fs.writeFileSync(paths.topicReadme(topic.slug), buildTopicReadme(paths, topic), "utf8");
}

export function writeTopicReport(paths: EvolverPaths, topic: TopicRecord): void {
  ensureDir(paths.topicDir(topic.slug));
  fs.writeFileSync(paths.topicReport(topic.slug), buildTopicReport(paths, topic), "utf8");
}

export function writeTopicHandoff(paths: EvolverPaths, topic: TopicRecord): void {
  ensureDir(paths.topicDir(topic.slug));
  const readiness = evaluatePromotionReadiness(topic);
  fs.writeFileSync(paths.topicHandoff(topic.slug), buildTopicHandoff(paths, topic, readiness), "utf8");
}

export function writeTopicArchive(paths: EvolverPaths, topic: TopicRecord): void {
  const archiveFile = paths.topicArchive(topic.slug);
  if (topic.status !== "archived") {
    if (fs.existsSync(archiveFile)) {
      fs.rmSync(archiveFile, { force: true });
    }
    return;
  }
  ensureDir(paths.topicDir(topic.slug));
  const readiness = evaluatePromotionReadiness(topic);
  fs.writeFileSync(archiveFile, buildTopicArchive(paths, topic, readiness), "utf8");
}

export function syncIndexEntry(
  index: EvolverIndex,
  topic: TopicRecord,
): EvolverIndex {
  const entry: TopicIndexEntry = {
    slug: topic.slug,
    title: topic.title,
    status: topic.status,
    updated_at: topic.updated_at,
    preflight_decision: topic.preflight?.decision,
    local_context_ref_count: topic.local_context_refs.length,
    candidate_count: topic.candidates.length,
    source_count: topic.sources.length,
    feedback_count: topic.feedback.length,
    benchmark_count: topic.benchmarks.length,
    promotion_count: topic.promotions.length,
    note_count: topic.notes.length,
  };

  const nextTopics = index.topics.filter((item) => item.slug !== topic.slug);
  nextTopics.push(entry);
  nextTopics.sort((a, b) => a.slug.localeCompare(b.slug));

  return { version: 1, topics: nextTopics };
}

export function syncIndexFromTopics(paths: EvolverPaths): EvolverIndex {
  let index: EvolverIndex = { version: 1, topics: [] };
  for (const slug of listTopicSlugs(paths)) {
    index = syncIndexEntry(index, readTopic(paths, slug));
  }
  return index;
}
