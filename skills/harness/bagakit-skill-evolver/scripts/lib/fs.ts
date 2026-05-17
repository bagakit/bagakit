import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

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

const LOCK_WAIT_MS = 10;
const DEFAULT_LOCK_TIMEOUT_MS = 15_000;
const ORPHAN_LOCK_GRACE_MS = 1_000;
const MAX_MUTATION_RECEIPTS = 256;

interface LockOwner {
  pid: number;
  acquired_at: string;
}

function sleep(milliseconds: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function fsyncDirectory(dir: string): void {
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(dir, "r");
    fs.fsyncSync(descriptor);
  } catch {
    return;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function atomicTempPrefix(file: string): string {
  return `.${path.basename(file)}.tmp-`;
}

function cleanupAtomicTemps(file: string): void {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) return;
  const prefix = atomicTempPrefix(file);
  for (const entry of fs.readdirSync(dir)) {
    if (entry.startsWith(prefix)) fs.rmSync(path.join(dir, entry), { force: true });
  }
}

function atomicWriteFile(file: string, content: string): void {
  ensureDir(path.dirname(file));
  const mode = fs.existsSync(file) ? fs.statSync(file).mode & 0o777 : 0o666;
  const tempFile = path.join(
    path.dirname(file),
    `${atomicTempPrefix(file)}${process.pid}-${crypto.randomBytes(6).toString("hex")}`,
  );
  const descriptor = fs.openSync(tempFile, "wx", mode);
  try {
    fs.writeFileSync(descriptor, content, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  if (process.env.BAGAKIT_EVOLVER_TEST_CRASH_AFTER_TEMP_WRITE === "1") {
    process.exit(86);
  }
  try {
    fs.renameSync(tempFile, file);
    fsyncDirectory(path.dirname(file));
  } catch (error) {
    fs.rmSync(tempFile, { force: true });
    throw error;
  }
  if (process.env.BAGAKIT_EVOLVER_TEST_CRASH_AFTER_RENAME === "1") {
    process.exit(87);
  }
}

function writeJson(file: string, value: unknown): void {
  atomicWriteFile(file, JSON.stringify(value, null, 2) + "\n");
}

function processIsAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function readLockOwner(lockPath: string): LockOwner | undefined {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(lockPath, "owner.json"), "utf8")) as Partial<LockOwner>;
    if (typeof raw.pid !== "number" || typeof raw.acquired_at !== "string") return undefined;
    return { pid: raw.pid, acquired_at: raw.acquired_at };
  } catch {
    return undefined;
  }
}

function reclaimDeadLock(lockPath: string): boolean {
  const owner = readLockOwner(lockPath);
  if (owner && processIsAlive(owner.pid)) return false;
  if (!owner) {
    try {
      if (Date.now() - fs.statSync(lockPath).mtimeMs < ORPHAN_LOCK_GRACE_MS) return false;
    } catch {
      return true;
    }
  }
  try {
    fs.rmSync(lockPath, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

function lockTimeoutMs(): number {
  const raw = Number(process.env.BAGAKIT_EVOLVER_LOCK_TIMEOUT_MS ?? DEFAULT_LOCK_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_LOCK_TIMEOUT_MS;
}

function withShortLock<T>(lockPath: string, label: string, callback: () => T): T {
  ensureDir(path.dirname(lockPath));
  const deadline = Date.now() + lockTimeoutMs();
  while (true) {
    try {
      fs.mkdirSync(lockPath);
      fs.writeFileSync(
        path.join(lockPath, "owner.json"),
        `${JSON.stringify({ pid: process.pid, acquired_at: new Date().toISOString() })}\n`,
        "utf8",
      );
      break;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") {
        throw error;
      }
      if (!reclaimDeadLock(lockPath) && Date.now() >= deadline) {
        const owner = readLockOwner(lockPath);
        throw new Error(`topic mutation conflict: timed out waiting for ${label}${owner ? ` (pid=${owner.pid})` : ""}`);
      }
      sleep(LOCK_WAIT_MS);
    }
  }
  try {
    return callback();
  } finally {
    fs.rmSync(lockPath, { recursive: true, force: true });
  }
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
    acceptance_authority: record.acceptance_authority === undefined ? undefined : String(record.acceptance_authority),
    acceptance_ref: record.acceptance_ref === undefined ? undefined : String(record.acceptance_ref),
    counterevidence_disposition: record.counterevidence_disposition,
    target_owner: record.target_owner === undefined ? undefined : String(record.target_owner),
    proof_plan: record.proof_plan === undefined ? undefined : String(record.proof_plan),
    proof_plan_ref: record.proof_plan_ref === undefined ? undefined : String(record.proof_plan_ref),
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
    revision: Number(raw.revision ?? 0),
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
    mutation_receipts: Array.isArray(raw.mutation_receipts) ? raw.mutation_receipts : [],
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

export interface TopicMutationOptions {
  operation: string;
  operationId?: string;
  payload: unknown;
  create?: () => TopicRecord;
}

export interface TopicMutationResult {
  topic: TopicRecord;
  idempotent: boolean;
}

export function mutateTopic(
  paths: EvolverPaths,
  slug: string,
  options: TopicMutationOptions,
  mutate: (topic: TopicRecord) => void,
): TopicMutationResult {
  return withShortLock(paths.topicLock(slug), `topic ${slug}`, () => {
    cleanupAtomicTemps(paths.topicFile(slug));
    const topic = topicExists(paths, slug)
      ? readTopic(paths, slug)
      : options.create?.();
    if (!topic) {
      throw new Error(`unknown topic: ${slug}`);
    }

    const payloadHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(options.payload))
      .digest("hex");
    if (options.operationId) {
      const prior = topic.mutation_receipts.find((receipt) => receipt.operation_id === options.operationId);
      if (prior) {
        if (prior.operation !== options.operation || prior.payload_hash !== payloadHash) {
          throw new Error(
            `conflict[operation_id_reused]: operation-id ${options.operationId} was already applied with different semantics`,
          );
        }
        return { topic, idempotent: true };
      }
    }

    mutate(topic);
    topic.revision += 1;
    if (options.operationId) {
      topic.mutation_receipts.push({
        operation_id: options.operationId,
        operation: options.operation,
        payload_hash: payloadHash,
        revision: topic.revision,
        committed_at: topic.updated_at,
      });
      topic.mutation_receipts = topic.mutation_receipts.slice(-MAX_MUTATION_RECEIPTS);
    }
    writeTopic(paths, topic);
    return { topic, idempotent: false };
  });
}

export function rebuildTopicProjections(paths: EvolverPaths, slug: string): TopicRecord {
  const projectionLock = path.join(paths.stateRoot, ".projections.lock");
  return withShortLock(projectionLock, "evolver projections", () => {
    const topic = readTopic(paths, slug);
    writeTopicReadme(paths, topic);
    writeTopicReport(paths, topic);
    writeTopicHandoff(paths, topic);
    writeTopicArchive(paths, topic);
    writeIndex(paths, syncIndexFromTopics(paths));
    return topic;
  });
}

export function writeTopicReadme(
  paths: EvolverPaths,
  topic: TopicRecord,
): void {
  ensureDir(paths.topicDir(topic.slug));
  atomicWriteFile(paths.topicReadme(topic.slug), buildTopicReadme(paths, topic));
}

export function writeTopicReport(paths: EvolverPaths, topic: TopicRecord): void {
  ensureDir(paths.topicDir(topic.slug));
  atomicWriteFile(paths.topicReport(topic.slug), buildTopicReport(paths, topic));
}

export function writeTopicHandoff(paths: EvolverPaths, topic: TopicRecord): void {
  ensureDir(paths.topicDir(topic.slug));
  const readiness = evaluatePromotionReadiness(topic, paths.root);
  atomicWriteFile(paths.topicHandoff(topic.slug), buildTopicHandoff(paths, topic, readiness));
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
  const readiness = evaluatePromotionReadiness(topic, paths.root);
  atomicWriteFile(archiveFile, buildTopicArchive(paths, topic, readiness));
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
