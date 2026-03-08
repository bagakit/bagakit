import path from "node:path";

import {
  CANDIDATE_KINDS,
  CANDIDATE_STATUSES,
  FEEDBACK_SIGNALS,
  NOTE_KINDS,
  PREFLIGHT_DECISIONS,
  SIGNAL_KINDS,
  SIGNAL_STATUSES,
  ROUTE_DECISIONS,
  PROMOTION_SURFACES,
  PROMOTION_STATUSES,
  SOURCE_KINDS,
  TOPIC_STATUSES,
  type PromotionSurface,
} from "./model.ts";

export const DURABLE_SURFACE_PREFIXES: Record<PromotionSurface, string> = {
  spec: "docs/specs/",
  stewardship: "docs/stewardship/",
  skill: "skills/",
};

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertEnumValue<const T extends readonly string[]>(
  values: T,
  value: unknown,
  label: string,
): asserts value is T[number] {
  if (typeof value !== "string" || !values.includes(value)) {
    throw new Error(`invalid ${label}: ${String(value)}`);
  }
}

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertArray(value: unknown, label: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
}

function assertNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${label} must be a number`);
  }
}

export function validateIndexShape(index: unknown): void {
  assertRecord(index, "evolver index");
  if (index.version !== 1 || !Array.isArray(index.topics)) {
    throw new Error("invalid evolver index structure");
  }
}

export function validateIndexEntry(entry: unknown): void {
  assertRecord(entry, "index entry");
  assertNonEmptyString(entry.slug, "index slug");
  assertNonEmptyString(entry.title, "index title");
  assertNonEmptyString(entry.updated_at, "index updated_at");
  assertEnumValue(TOPIC_STATUSES, entry.status, "index topic status");
  assertNumber(entry.local_context_ref_count, "index local_context_ref_count");
  assertNumber(entry.candidate_count, "index candidate_count");
  assertNumber(entry.source_count, "index source_count");
  assertNumber(entry.feedback_count, "index feedback_count");
  assertNumber(entry.benchmark_count, "index benchmark_count");
  assertNumber(entry.promotion_count, "index promotion_count");
  assertNumber(entry.note_count, "index note_count");

  if (entry.preflight_decision !== undefined) {
    assertEnumValue(PREFLIGHT_DECISIONS, entry.preflight_decision, "index preflight decision");
  }
}

export function validateTopicShape(topic: unknown): void {
  assertRecord(topic, "topic");
  if (topic.version !== 1) {
    throw new Error(`unsupported topic version for ${topic.slug}: ${topic.version}`);
  }

  assertNonEmptyString(topic.slug, "topic slug");
  assertNonEmptyString(topic.title, "topic title");
  assertNonEmptyString(topic.created_at, "topic created_at");
  assertNonEmptyString(topic.updated_at, "topic updated_at");
  assertEnumValue(TOPIC_STATUSES, topic.status, "topic status");

  if (!Array.isArray(topic.local_context_refs)) {
    throw new Error(`local_context_refs must be an array for ${topic.slug}`);
  }
  for (const ref of topic.local_context_refs) {
    assertNonEmptyString(ref, "local context ref");
  }

  if (topic.preflight) {
    assertRecord(topic.preflight, "preflight");
    assertEnumValue(PREFLIGHT_DECISIONS, topic.preflight.decision, "preflight decision");
    assertNonEmptyString(topic.preflight.rationale, "preflight rationale");
    assertNonEmptyString(topic.preflight.assessed_at, "preflight assessed_at");
  }

  if (topic.routing !== undefined) {
    assertRecord(topic.routing, "routing");
    assertEnumValue(ROUTE_DECISIONS, topic.routing.decision, "routing decision");
    assertNonEmptyString(topic.routing.rationale, "routing rationale");
    assertNonEmptyString(topic.routing.decided_at, "routing decided_at");
    if (topic.routing.host_target !== undefined) {
      assertNonEmptyString(topic.routing.host_target, "routing host_target");
    }
    if (topic.routing.host_ref !== undefined) {
      assertNonEmptyString(topic.routing.host_ref, "routing host_ref");
    }
    assertArray(topic.routing.upstream_promotion_ids, "routing upstream_promotion_ids");
    for (const promotionId of topic.routing.upstream_promotion_ids) {
      assertNonEmptyString(promotionId, "routing upstream promotion id");
    }
  }

  assertArray(topic.candidates, "candidates");
  const candidateIds = new Set<string>();
  for (const candidate of topic.candidates) {
    assertRecord(candidate, "candidate");
    assertNonEmptyString(candidate.id, "candidate id");
    assertEnumValue(CANDIDATE_KINDS, candidate.kind, "candidate kind");
    assertEnumValue(CANDIDATE_STATUSES, candidate.status, "candidate status");
    assertNonEmptyString(candidate.source, "candidate source");
    assertNonEmptyString(candidate.summary, "candidate summary");
    assertNonEmptyString(candidate.added_at, "candidate added_at");
    if (candidateIds.has(candidate.id)) {
      throw new Error(`duplicate candidate id in ${topic.slug}: ${candidate.id}`);
    }
    candidateIds.add(candidate.id);
  }

  assertArray(topic.sources, "sources");
  const sourceIds = new Set<string>();
  for (const source of topic.sources) {
    assertRecord(source, "source");
    assertNonEmptyString(source.id, "source id");
    assertEnumValue(SOURCE_KINDS, source.kind, "source kind");
    assertNonEmptyString(source.title, "source title");
    assertNonEmptyString(source.origin, "source origin");
    assertNonEmptyString(source.added_at, "source added_at");
    if (source.local_ref !== undefined) {
      assertNonEmptyString(source.local_ref, "source local_ref");
    }
    if (source.summary_ref !== undefined) {
      assertNonEmptyString(source.summary_ref, "source summary_ref");
    }
    if (sourceIds.has(source.id)) {
      throw new Error(`duplicate source id in ${topic.slug}: ${source.id}`);
    }
    sourceIds.add(source.id);
  }

  assertArray(topic.feedback, "feedback");
  for (const feedback of topic.feedback) {
    assertRecord(feedback, "feedback");
    assertNonEmptyString(feedback.channel, "feedback channel");
    assertEnumValue(FEEDBACK_SIGNALS, feedback.signal, "feedback signal");
    assertNonEmptyString(feedback.detail, "feedback detail");
    assertNonEmptyString(feedback.created_at, "feedback created_at");
  }

  assertArray(topic.benchmarks, "benchmarks");
  for (const benchmark of topic.benchmarks) {
    assertRecord(benchmark, "benchmark");
    assertNonEmptyString(benchmark.id, "benchmark id");
    assertNonEmptyString(benchmark.metric, "benchmark metric");
    assertNonEmptyString(benchmark.result, "benchmark result");
    assertNonEmptyString(benchmark.created_at, "benchmark created_at");
  }

  assertArray(topic.promotions, "promotions");
  const promotionIds = new Set<string>();
  for (const promotion of topic.promotions) {
    assertRecord(promotion, "promotion");
    assertNonEmptyString(promotion.id, "promotion id");
    assertEnumValue(PROMOTION_SURFACES, promotion.surface, "promotion surface");
    assertEnumValue(PROMOTION_STATUSES, promotion.status, "promotion status");
    assertNonEmptyString(promotion.target, "promotion target");
    assertNonEmptyString(promotion.summary, "promotion summary");
    assertNonEmptyString(promotion.created_at, "promotion created_at");
    assertNonEmptyString(promotion.updated_at, "promotion updated_at");
    if (promotion.status === "landed" && promotion.ref === undefined) {
      throw new Error(`landed promotion must include ref in ${topic.slug}: ${promotion.id}`);
    }
    if (promotion.ref !== undefined) {
      assertNonEmptyString(promotion.ref, "promotion ref");
    }
    assertArray(promotion.proof_refs, "promotion proof_refs");
    for (const proofRef of promotion.proof_refs) {
      assertNonEmptyString(proofRef, "promotion proof_ref");
    }
    if (promotion.status === "landed" && promotion.proof_refs.length === 0) {
      throw new Error(`landed promotion must include proof_refs in ${topic.slug}: ${promotion.id}`);
    }
    if (promotionIds.has(promotion.id)) {
      throw new Error(`duplicate promotion id in ${topic.slug}: ${promotion.id}`);
    }
    promotionIds.add(promotion.id);
  }

  if (topic.routing) {
    for (const promotionId of topic.routing.upstream_promotion_ids) {
      if (!promotionIds.has(promotionId)) {
        throw new Error(`routing references unknown promotion in ${topic.slug}: ${promotionId}`);
      }
    }
  }

  assertArray(topic.notes, "notes");
  for (const note of topic.notes) {
    assertRecord(note, "note");
    assertEnumValue(NOTE_KINDS, note.kind, "note kind");
    assertNonEmptyString(note.text, "note text");
    assertNonEmptyString(note.created_at, "note created_at");
    if (!note.related_candidates) {
      if (!note.related_source_ids) {
        continue;
      }
    }
    if (note.related_candidates) {
      assertArray(note.related_candidates, "related_candidates");
      for (const candidateId of note.related_candidates) {
        assertNonEmptyString(candidateId, "related candidate id");
        if (!candidateIds.has(candidateId)) {
          throw new Error(`note references unknown candidate in ${topic.slug}: ${candidateId}`);
        }
      }
    }
    if (note.related_source_ids) {
      assertArray(note.related_source_ids, "related_source_ids");
      for (const sourceId of note.related_source_ids) {
        assertNonEmptyString(sourceId, "related source id");
        if (!sourceIds.has(sourceId)) {
          throw new Error(`note references unknown source in ${topic.slug}: ${sourceId}`);
        }
      }
    }
  }
}

export function validateSignalShape(signal: unknown, root: string): void {
  assertRecord(signal, "signal");
  if (signal.version !== 1) {
    throw new Error(`unsupported signal version: ${String(signal.version)}`);
  }
  assertNonEmptyString(signal.id, "signal id");
  assertEnumValue(SIGNAL_KINDS, signal.kind, "signal kind");
  assertNonEmptyString(signal.title, "signal title");
  assertNonEmptyString(signal.summary, "signal summary");
  assertNonEmptyString(signal.producer, "signal producer");
  assertNonEmptyString(signal.source_channel, "signal source_channel");
  assertNumber(signal.confidence, "signal confidence");
  if (signal.confidence < 0 || signal.confidence > 1) {
    throw new Error(`signal confidence must be between 0 and 1: ${String(signal.id)}`);
  }
  assertArray(signal.evidence, "signal evidence");
  for (const evidence of signal.evidence) {
    assertNonEmptyString(evidence, "signal evidence item");
  }
  assertArray(signal.local_refs, "signal local_refs");
  for (const ref of signal.local_refs) {
    assertNonEmptyString(ref, "signal local_ref");
    normalizeRepoRelativeRef(root, ref);
  }
  assertEnumValue(SIGNAL_STATUSES, signal.status, "signal status");
  assertNonEmptyString(signal.created_at, "signal created_at");
  assertNonEmptyString(signal.updated_at, "signal updated_at");
  if (signal.topic_hint !== undefined) {
    assertNonEmptyString(signal.topic_hint, "signal topic_hint");
  }
  if (signal.adopted_topic !== undefined) {
    assertNonEmptyString(signal.adopted_topic, "signal adopted_topic");
  }
  if (signal.resolution_note !== undefined) {
    assertNonEmptyString(signal.resolution_note, "signal resolution_note");
  }
}

export function validateSignalContract(contract: unknown, root: string): void {
  assertRecord(contract, "signal contract");
  if (contract.schema !== "bagakit.evolver.signal.v1") {
    throw new Error(`invalid signal contract schema: ${String(contract.schema)}`);
  }
  assertNonEmptyString(contract.producer, "signal contract producer");
  assertNonEmptyString(contract.generated_at, "signal contract generated_at");
  assertArray(contract.signals, "signal contract signals");
  for (const signal of contract.signals) {
    validateSignalShape(signal, root);
  }
}

export function validatePromotionRefSurface(topic: unknown): void {
  assertRecord(topic, "topic");
  if (!Array.isArray(topic.promotions)) {
    throw new Error(`promotions must be an array for ${String(topic.slug ?? "unknown-topic")}`);
  }
  for (const promotion of topic.promotions) {
    assertRecord(promotion, "promotion");
    if (!promotion.ref) {
      if (promotion.proof_refs !== undefined && !Array.isArray(promotion.proof_refs)) {
        throw new Error(`promotion proof_refs must be an array for ${topic.slug}`);
      }
      continue;
    }
    assertEnumValue(PROMOTION_SURFACES, promotion.surface, "promotion surface");
    assertNonEmptyString(promotion.ref, "promotion ref");
    const expectedPrefix = DURABLE_SURFACE_PREFIXES[promotion.surface];
    if (!promotion.ref.startsWith(expectedPrefix)) {
      throw new Error(
        `promotion ref does not match surface in ${topic.slug}: ${promotion.ref} vs ${promotion.surface}`,
      );
    }
  }
}

export function validateRoutingShape(topic: unknown, root: string): void {
  assertRecord(topic, "topic");
  if (!topic.routing) {
    return;
  }
  assertRecord(topic.routing, "routing");
  assertEnumValue(ROUTE_DECISIONS, topic.routing.decision, "routing decision");
  if (topic.routing.host_ref !== undefined) {
    assertNonEmptyString(topic.routing.host_ref, "routing host_ref");
    normalizeRepoRelativeRef(root, topic.routing.host_ref);
  }
  if (topic.routing.host_target !== undefined) {
    assertNonEmptyString(topic.routing.host_target, "routing host_target");
    normalizeRepoRelativeRef(root, topic.routing.host_target);
  }
  assertArray(topic.routing.upstream_promotion_ids, "routing upstream_promotion_ids");
}

export function normalizeRepoRelativeRef(root: string, ref: string): string {
  const trimmed = ref.trim();
  if (!trimmed) {
    throw new Error("repo-relative ref cannot be empty");
  }
  if (path.isAbsolute(trimmed)) {
    throw new Error(`repo-relative ref must not be absolute: ${trimmed}`);
  }

  const resolved = path.resolve(root, trimmed);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith("..")) {
    throw new Error(`repo-relative ref escapes repo root: ${trimmed}`);
  }

  return relative.split(path.sep).join("/");
}
