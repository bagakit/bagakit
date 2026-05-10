import fs from "node:fs";
import path from "node:path";

import {
  CANDIDATE_KINDS,
  CANDIDATE_STATUSES,
  FEEDBACK_SIGNALS,
  NOTE_KINDS,
  PREFLIGHT_DECISIONS,
  SIGNAL_KINDS,
  SIGNAL_STATUSES,
  SESSION_PRIVACY_DISPOSITIONS,
  SESSION_RETENTION_DISPOSITIONS,
  SESSION_REVIEW_CHANNELS,
  SESSION_REVIEW_CHECKS,
  SESSION_REVIEW_DISPOSITIONS,
  SESSION_SENSITIVITIES,
  SESSION_SIGNAL_OPERATIONS,
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

function assertBoundedString(value: unknown, label: string, maxLength: number): asserts value is string {
  assertNonEmptyString(value, label);
  if (value.length > maxLength) {
    throw new Error(`${label} exceeds compressed field limit (${maxLength} characters)`);
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

function assertIsoTimestamp(value: unknown, label: string): asserts value is string {
  assertNonEmptyString(value, label);
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be an ISO-compatible timestamp`);
  }
}

function assertOnlyKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const allowedKeys = new Set(allowed);
  const unexpected = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unexpected.length > 0) {
    throw new Error(`${label} contains unsupported field(s): ${unexpected.join(", ")}`);
  }
}

function validateRepoRefList(value: unknown, root: string, label: string): string[] {
  assertArray(value, label);
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const rawRef of value) {
    assertNonEmptyString(rawRef, `${label} item`);
    const ref = normalizeRepoRelativeRef(root, rawRef);
    if (seen.has(ref)) {
      throw new Error(`${label} contains duplicate ref: ${ref}`);
    }
    seen.add(ref);
    normalized.push(ref);
  }
  return normalized;
}

function requireExistingRepoRefs(root: string, refs: Iterable<string>, label: string): void {
  for (const ref of refs) {
    const resolved = path.resolve(root, ref);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      throw new Error(`${label} does not resolve to a file: ${ref}`);
    }
  }
}

function validateGoalReviewReceipt(root: string, ref: string, sessionSourceRefs: Set<string>): void {
  if (!ref.startsWith(".bagakit/goal/reviews/") || !ref.endsWith(".json")) {
    throw new Error(`goal-review source ref must use .bagakit/goal/reviews/<review-id>.json: ${ref}`);
  }
  const raw = JSON.parse(fs.readFileSync(path.resolve(root, ref), "utf8")) as unknown;
  assertRecord(raw, `goal review receipt ${ref}`);
  assertOnlyKeys(
    raw,
    [
      "schema",
      "goal_id",
      "review_id",
      "trigger",
      "status",
      "evidence_refs",
      "drift",
      "next_instruction",
      "approval",
      "evolver_disposition",
    ],
    `goal review receipt ${ref}`,
  );
  if (raw.schema !== "bagakit.goal-evolver-review.v1") {
    throw new Error(`goal review receipt has invalid schema: ${ref}`);
  }
  assertNonEmptyString(raw.goal_id, `goal review receipt goal_id ${ref}`);
  assertNonEmptyString(raw.review_id, `goal review receipt review_id ${ref}`);
  const stableGoalToken = new RegExp("^[a-z0-9][a-z0-9-]{0,62}$");
  if (!stableGoalToken.test(raw.goal_id) || !stableGoalToken.test(raw.review_id)) {
    throw new Error(`goal review receipt has invalid goal_id or review_id: ${ref}`);
  }
  if (path.basename(ref, ".json") !== raw.review_id) {
    throw new Error(`goal review receipt review_id does not match filename: ${ref}`);
  }
  if (raw.status !== "completed" || raw.evolver_disposition !== "signal_candidate") {
    throw new Error(`goal review receipt is not ready for Evolver signal review: ${ref}`);
  }
  if (!["before_round", "after_round", "risk", "stale", "pre_closeout", "session_end"].includes(String(raw.trigger))) {
    throw new Error(`goal review receipt has invalid trigger: ${ref}`);
  }
  if (raw.approval !== "approved" && raw.approval !== "not_required") {
    throw new Error(`goal review receipt lacks compatible approval: ${ref}`);
  }
  const receiptEvidenceRefs = validateRepoRefList(raw.evidence_refs, root, `goal review receipt evidence_refs ${ref}`);
  validateBoundedStringList(raw.drift, `goal review receipt drift ${ref}`, 20, 500);
  if (typeof raw.next_instruction !== "string" || raw.next_instruction.length > 1200) {
    throw new Error(`goal review receipt next_instruction must be a bounded string: ${ref}`);
  }
  for (const evidenceRef of receiptEvidenceRefs) {
    if (!sessionSourceRefs.has(evidenceRef)) {
      throw new Error(`goal review evidence_ref is missing from session_evidence.source_refs: ${evidenceRef}`);
    }
  }
}

function validateStringList(value: unknown, label: string): string[] {
  assertArray(value, label);
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    assertNonEmptyString(item, `${label} item`);
    if (seen.has(item)) {
      throw new Error(`${label} contains duplicate item: ${item}`);
    }
    seen.add(item);
    result.push(item);
  }
  return result;
}

function validateBoundedStringList(value: unknown, label: string, maxItems: number, maxLength: number): string[] {
  const result = validateStringList(value, label);
  if (result.length > maxItems) {
    throw new Error(`${label} exceeds item limit (${maxItems})`);
  }
  for (const item of result) {
    if (item.length > maxLength) {
      throw new Error(`${label} item exceeds compressed field limit (${maxLength} characters)`);
    }
  }
  return result;
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

export function validateSessionReviewContract(contract: unknown, root: string): void {
  assertRecord(contract, "session review contract");
  assertOnlyKeys(
    contract,
    ["schema", "producer", "generated_at", "session_evidence", "candidates", "reviews"],
    "session review contract",
  );
  if (contract.schema !== "bagakit.evolver.session-review.v1") {
    throw new Error(`invalid session review schema: ${String(contract.schema)}`);
  }
  assertBoundedString(contract.producer, "session review producer", 200);
  assertIsoTimestamp(contract.generated_at, "session review generated_at");

  assertRecord(contract.session_evidence, "session_evidence");
  const evidence = contract.session_evidence;
  assertOnlyKeys(
    evidence,
    [
      "session_id",
      "run_id",
      "source_channel",
      "source_refs",
      "captured_at",
      "sensitivity",
      "privacy_disposition",
      "retention_disposition",
      "retention_until",
      "redaction_policy",
    ],
    "session_evidence",
  );
  assertBoundedString(evidence.session_id, "session_evidence session_id", 200);
  assertBoundedString(evidence.run_id, "session_evidence run_id", 200);
  assertEnumValue(SESSION_REVIEW_CHANNELS, evidence.source_channel, "session_evidence source_channel");
  const sessionSourceRefs = new Set(validateRepoRefList(evidence.source_refs, root, "session_evidence source_refs"));
  if (sessionSourceRefs.size > 100) {
    throw new Error("session_evidence source_refs exceeds item limit (100)");
  }
  assertIsoTimestamp(evidence.captured_at, "session_evidence captured_at");
  if (Date.parse(evidence.captured_at) > Date.parse(contract.generated_at)) {
    throw new Error("session_evidence captured_at must not be later than contract generated_at");
  }
  assertEnumValue(SESSION_SENSITIVITIES, evidence.sensitivity, "session_evidence sensitivity");
  assertEnumValue(
    SESSION_PRIVACY_DISPOSITIONS,
    evidence.privacy_disposition,
    "session_evidence privacy_disposition",
  );
  assertEnumValue(
    SESSION_RETENTION_DISPOSITIONS,
    evidence.retention_disposition,
    "session_evidence retention_disposition",
  );
  if (evidence.retention_disposition === "expires" && evidence.retention_until === undefined) {
    throw new Error("session_evidence retention_until is required when retention_disposition is expires");
  }
  if (evidence.retention_until !== undefined) {
    assertIsoTimestamp(evidence.retention_until, "session_evidence retention_until");
    if (Date.parse(evidence.retention_until) <= Date.parse(evidence.captured_at)) {
      throw new Error("session_evidence retention_until must be later than captured_at");
    }
  }
  assertBoundedString(evidence.redaction_policy, "session_evidence redaction_policy", 500);
  if (evidence.retention_disposition !== "expired" && evidence.retention_disposition !== "deleted") {
    requireExistingRepoRefs(root, sessionSourceRefs, "session_evidence source_ref");
  }
  if (
    evidence.retention_disposition === "expires" &&
    Date.parse(evidence.retention_until as string) <= Date.parse(contract.generated_at)
  ) {
    throw new Error("session_evidence is already expired at contract generation time");
  }
  if (evidence.source_channel === "goal-review") {
    const goalReviewRefs = [...sessionSourceRefs].filter((ref) => ref.startsWith(".bagakit/goal/reviews/"));
    if (goalReviewRefs.length === 0) {
      throw new Error("goal-review session evidence requires a Goal review receipt ref");
    }
    for (const ref of goalReviewRefs) {
      validateGoalReviewReceipt(root, ref, sessionSourceRefs);
    }
  }

  assertArray(contract.candidates, "session review candidates");
  assertArray(contract.reviews, "session review reviews");
  if (contract.candidates.length > 100 || contract.reviews.length > 100) {
    throw new Error("session review contract exceeds candidate or review limit (100)");
  }
  const candidateIds = new Set<string>();
  for (const rawCandidate of contract.candidates) {
    assertRecord(rawCandidate, "session review candidate");
    assertOnlyKeys(
      rawCandidate,
      [
        "signal_id",
        "operation",
        "kind",
        "title",
        "statement",
        "observed_outcome",
        "proposed_generalization",
        "scope",
        "confidence",
        "source_refs",
        "source_spans",
        "counterevidence_refs",
        "supersedes",
        "conflicts_with",
        "limitations",
        "topic_hint",
      ],
      "session review candidate",
    );
    assertBoundedString(rawCandidate.signal_id, "session review candidate signal_id", 200);
    if (candidateIds.has(rawCandidate.signal_id)) {
      throw new Error(`duplicate session review candidate signal_id: ${rawCandidate.signal_id}`);
    }
    candidateIds.add(rawCandidate.signal_id);
    assertEnumValue(SESSION_SIGNAL_OPERATIONS, rawCandidate.operation, "session review candidate operation");
    assertEnumValue(SIGNAL_KINDS, rawCandidate.kind, "session review candidate kind");
    assertBoundedString(rawCandidate.title, "session review candidate title", 200);
    assertBoundedString(rawCandidate.statement, "session review candidate statement", 1200);
    assertBoundedString(rawCandidate.observed_outcome, "session review candidate observed_outcome", 1200);
    assertBoundedString(
      rawCandidate.proposed_generalization,
      "session review candidate proposed_generalization",
      1200,
    );
    assertBoundedString(rawCandidate.scope, "session review candidate scope", 300);
    assertNumber(rawCandidate.confidence, "session review candidate confidence");
    if (rawCandidate.confidence < 0 || rawCandidate.confidence > 1) {
      throw new Error(`session review candidate confidence must be between 0 and 1: ${rawCandidate.signal_id}`);
    }
    const sourceRefs = validateRepoRefList(rawCandidate.source_refs, root, "session review candidate source_refs");
    assertArray(rawCandidate.source_spans, "session review candidate source_spans");
    if (rawCandidate.source_spans.length > 50) {
      throw new Error("session review candidate source_spans exceeds item limit (50)");
    }
    for (const rawSpan of rawCandidate.source_spans) {
      assertRecord(rawSpan, "session review candidate source_span");
      assertOnlyKeys(rawSpan, ["ref", "locator"], "session review candidate source_span");
      assertNonEmptyString(rawSpan.ref, "session review candidate source_span ref");
      const spanRef = normalizeRepoRelativeRef(root, rawSpan.ref);
      if (!sourceRefs.includes(spanRef)) {
        throw new Error(`session review candidate source_span ref is not declared in source_refs: ${spanRef}`);
      }
      assertBoundedString(rawSpan.locator, "session review candidate source_span locator", 300);
    }
    const counterevidenceRefs = validateRepoRefList(
      rawCandidate.counterevidence_refs,
      root,
      "session review candidate counterevidence_refs",
    );
    for (const ref of [...sourceRefs, ...counterevidenceRefs]) {
      if (!sessionSourceRefs.has(ref)) {
        throw new Error(`session review candidate ref is not declared by session_evidence: ${ref}`);
      }
    }
    validateBoundedStringList(rawCandidate.supersedes, "session review candidate supersedes", 20, 200);
    const conflicts = validateBoundedStringList(rawCandidate.conflicts_with, "session review candidate conflicts_with", 20, 200);
    if (conflicts.includes(rawCandidate.signal_id)) {
      throw new Error(`session review candidate cannot conflict with itself: ${rawCandidate.signal_id}`);
    }
    validateBoundedStringList(rawCandidate.limitations, "session review candidate limitations", 20, 500);
    if (rawCandidate.topic_hint !== undefined) {
      assertBoundedString(rawCandidate.topic_hint, "session review candidate topic_hint", 200);
    }
  }

  const reviewedIds = new Set<string>();
  for (const rawReview of contract.reviews) {
    assertRecord(rawReview, "session review receipt");
    assertOnlyKeys(
      rawReview,
      [
        "signal_id",
        "coverage",
        "preservation",
        "faithfulness",
        "disposition",
        "reviewer",
        "reviewed_at",
        "rationale",
      ],
      "session review receipt",
    );
    assertNonEmptyString(rawReview.signal_id, "session review receipt signal_id");
    if (!candidateIds.has(rawReview.signal_id)) {
      throw new Error(`session review receipt references unknown candidate: ${rawReview.signal_id}`);
    }
    if (reviewedIds.has(rawReview.signal_id)) {
      throw new Error(`duplicate session review receipt: ${rawReview.signal_id}`);
    }
    reviewedIds.add(rawReview.signal_id);
    assertEnumValue(SESSION_REVIEW_CHECKS, rawReview.coverage, "session review receipt coverage");
    assertEnumValue(SESSION_REVIEW_CHECKS, rawReview.preservation, "session review receipt preservation");
    assertEnumValue(SESSION_REVIEW_CHECKS, rawReview.faithfulness, "session review receipt faithfulness");
    assertEnumValue(SESSION_REVIEW_DISPOSITIONS, rawReview.disposition, "session review receipt disposition");
    assertBoundedString(rawReview.reviewer, "session review receipt reviewer", 200);
    assertIsoTimestamp(rawReview.reviewed_at, "session review receipt reviewed_at");
    assertBoundedString(rawReview.rationale, "session review receipt rationale", 1200);
    if (Date.parse(rawReview.reviewed_at) < Date.parse(evidence.captured_at)) {
      throw new Error(`session review receipt predates captured evidence: ${rawReview.signal_id}`);
    }
    if (Date.parse(rawReview.reviewed_at) > Date.parse(contract.generated_at)) {
      throw new Error(`session review receipt is later than contract generation: ${rawReview.signal_id}`);
    }
    if (
      rawReview.disposition === "accepted" &&
      [rawReview.coverage, rawReview.preservation, rawReview.faithfulness].some((check) => check !== "pass")
    ) {
      throw new Error(`accepted session review requires passing coverage, preservation, and faithfulness: ${rawReview.signal_id}`);
    }
    const candidate = contract.candidates.find(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object" && !Array.isArray(item) && item.signal_id === rawReview.signal_id,
    );
    if (rawReview.disposition === "accepted" && candidate?.operation !== "noop") {
      if (!Array.isArray(candidate?.source_refs) || candidate.source_refs.length === 0) {
        throw new Error(`accepted session review requires at least one source_ref: ${rawReview.signal_id}`);
      }
      if (!Array.isArray(candidate?.source_spans) || candidate.source_spans.length === 0) {
        throw new Error(`accepted session review requires at least one source_span: ${rawReview.signal_id}`);
      }
      if (evidence.privacy_disposition !== "approved_slices" && evidence.privacy_disposition !== "redacted") {
        throw new Error(
          `accepted session review requires approved_slices or redacted privacy disposition: ${rawReview.signal_id}`,
        );
      }
      if (evidence.retention_disposition === "expired" || evidence.retention_disposition === "deleted") {
        throw new Error(`accepted session review cannot rely on expired or deleted evidence: ${rawReview.signal_id}`);
      }
      if (
        evidence.retention_disposition === "expires" &&
        Date.parse(rawReview.reviewed_at) >= Date.parse(evidence.retention_until as string)
      ) {
        throw new Error(`accepted session review occurred after evidence expiry: ${rawReview.signal_id}`);
      }
    }
    if (rawReview.disposition === "conflict_open") {
      if (!Array.isArray(candidate?.conflicts_with) || candidate.conflicts_with.length === 0) {
        throw new Error(`conflict_open session review requires conflicts_with refs: ${rawReview.signal_id}`);
      }
    }
  }
  for (const candidateId of candidateIds) {
    if (!reviewedIds.has(candidateId)) {
      throw new Error(`session review candidate is missing a review receipt: ${candidateId}`);
    }
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
