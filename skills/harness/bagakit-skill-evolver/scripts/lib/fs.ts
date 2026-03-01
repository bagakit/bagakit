import fs from "node:fs";
import path from "node:path";

import type { EvolverIndex, TopicRecord, TopicIndexEntry } from "./model.ts";
import type { EvolverPaths } from "./paths.ts";
import { buildTopicReadme, buildTopicReport } from "./render.ts";

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

function normalizeTopicRecord(raw: Partial<TopicRecord>, fallbackSlug: string): TopicRecord {
  return {
    version: 1,
    slug: String(raw.slug ?? fallbackSlug),
    title: String(raw.title ?? fallbackSlug),
    status: (raw.status ?? "active") as TopicRecord["status"],
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
    preflight: raw.preflight,
    local_context_refs: Array.isArray(raw.local_context_refs) ? raw.local_context_refs : [],
    candidates: Array.isArray(raw.candidates) ? raw.candidates : [],
    sources: Array.isArray(raw.sources) ? raw.sources : [],
    feedback: Array.isArray(raw.feedback) ? raw.feedback : [],
    benchmarks: Array.isArray(raw.benchmarks) ? raw.benchmarks : [],
    promotions: Array.isArray(raw.promotions) ? raw.promotions : [],
    notes: Array.isArray(raw.notes) ? raw.notes : [],
  };
}

export function ensureBaseLayout(paths: EvolverPaths): void {
  ensureDir(paths.stateRoot);
  ensureDir(paths.topicsRoot);
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
