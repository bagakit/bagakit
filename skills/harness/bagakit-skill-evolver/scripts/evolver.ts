import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ensureBaseLayout,
  listTopicSlugs,
  listSignalIds,
  readIndex,
  readRawIndex,
  readRawSignal,
  readSignal,
  readRawTopic,
  readTopic,
  signalExists,
  syncIndexEntry,
  syncIndexFromTopics,
  topicExists,
  writeIndex,
  writeMemInboxReadme,
  writeSignal,
  writeTopicArchive,
  writeTopicHandoff,
  writeTopic,
  writeTopicReadme,
  writeTopicReport,
} from "./lib/fs.ts";
import { parseArgs, readStringFlag } from "./lib/args.ts";
import {
  CANDIDATE_KINDS,
  CANDIDATE_STATUSES,
  FEEDBACK_SIGNALS,
  NOTE_KINDS,
  PREFLIGHT_DECISIONS,
  PROMOTION_STATUSES,
  PROMOTION_SURFACES,
  ROUTE_DECISIONS as _ROUTE_DECISIONS,
  SIGNAL_KINDS,
  SIGNAL_STATUSES,
  SOURCE_KINDS,
  TOPIC_STATUSES,
} from "./lib/model.ts";
import type {
  BenchmarkRecord,
  CandidateRecord,
  FeedbackRecord,
  IntakeSignalContract,
  IntakeSignalRecord,
  NoteRecord,
  PromotionRecord,
  PromotionStatus,
  SignalKind,
  SignalStatus,
  SourceRecord,
  TopicRecord,
  TopicStatus,
  CandidateKind,
  CandidateStatus,
  FeedbackSignal,
  NoteKind,
  PreflightDecision,
  RouteDecision,
  PromotionSurface,
  SourceKind,
} from "./lib/model.ts";
import { resolvePaths } from "./lib/paths.ts";
import { buildMemInboxReadme, buildTopicArchive, buildTopicHandoff, buildTopicReadme, buildTopicReport } from "./lib/render.ts";
import { evaluatePromotionReadiness } from "./lib/readiness.ts";
import { nowIso, toSlug } from "./lib/text.ts";
import {
  DURABLE_SURFACE_PREFIXES,
  normalizeRepoRelativeRef,
  validateIndexEntry,
  validateIndexShape,
  validatePromotionRefSurface,
  validateSignalContract,
  validateSignalShape,
  validateRoutingShape,
  validateTopicShape,
} from "./lib/validate.ts";

const defaultRoot = path.resolve(fileURLToPath(new URL("../../../..", import.meta.url)));

function earlierIso(left: string, right: string): string {
  return left <= right ? left : right;
}

function laterIso(left: string, right: string): string {
  return left >= right ? left : right;
}

function printHelp(): void {
  console.log(`bagakit evolver

Commands:
  init-topic --slug <slug> [--title <title>] [--root <repo-root>]
  capture-signal --signal <id> --kind <kind> --title <title> --summary <text> --producer <name> --channel <name> [--topic-hint <slug>] [--confidence <0..1>] [--evidence <text>] [--local-refs <repo-relative[,repo-relative...]>] [--root <repo-root>]
  validate-signals --contract <json> [--root <repo-root>]
  bridge-signals --contract <json> [--root <repo-root>]
  import-signals --contract <json> [--root <repo-root>]
  export-signals [--status <pending|adopted|dismissed|all>] [--output <json>] [--root <repo-root>]
  list-signals [--status <pending|adopted|dismissed|all>] [--json] [--root <repo-root>]
  adopt-signal --signal <id> --topic <slug> [--source-id <id>] [--source-kind <doc|note>] [--origin <text>] [--note <text>] [--note-kind <observation|decision>] [--candidate-ids <id[,id...]>] [--root <repo-root>]
  dismiss-signal --signal <id> --note <text> [--root <repo-root>]
  preflight --topic <slug> --decision <skip|note-only|track> --rationale <text> [--root <repo-root>]
  add-candidate --topic <slug> --candidate <id> --kind <kind> --source <source> --summary <text> [--status <status>] [--root <repo-root>]
  add-source --topic <slug> --source-id <id> --kind <kind> --title <title> --origin <value> [--local-ref <repo-relative>] [--summary-ref <repo-relative>] [--root <repo-root>]
  add-feedback --topic <slug> --channel <name> --signal <signal> --detail <text> [--root <repo-root>]
  add-benchmark --topic <slug> --benchmark <id> --metric <name> --result <value> [--baseline <value>] [--detail <text>] [--root <repo-root>]
  add-note --topic <slug> --kind <kind> --text <text> [--root <repo-root>]
  set-route --topic <slug> --decision <host|upstream|split> --rationale <text> [--host-target <repo-relative-path>] [--host-ref <repo-relative-path>] [--upstream-promotions <id[,id...]>] [--root <repo-root>]
  add-context-ref --topic <slug> --ref <repo-relative-path> [--note <text>] [--root <repo-root>]
  remove-context-ref --topic <slug> --ref <repo-relative-path> [--root <repo-root>]
  record-decision --topic <slug> --decision <title> --rationale <text> [--candidate <id>] [--status <topic-status>] [--root <repo-root>]
  record-promotion --topic <slug> --surface <spec|stewardship|skill> --target <target> --summary <text> [--promotion <id>] [--status <proposed|landed>] [--ref <repo-relative-path>] [--proof-refs <repo-relative[,repo-relative...]>] [--root <repo-root>]
  set-candidate-status --topic <slug> --candidate <id> --status <status> [--note <text>] [--root <repo-root>]
  promote-candidate --topic <slug> --candidate <id> [--note <text>] [--root <repo-root>]
  reject-candidate --topic <slug> --candidate <id> [--note <text>] [--root <repo-root>]
  revisit-candidate --topic <slug> --candidate <id> [--note <text>] [--root <repo-root>]
  set-topic-status --topic <slug> --status <status> [--root <repo-root>]
  close-topic --topic <slug> --summary <text> [--root <repo-root>]
  archive-topic --topic <slug> --summary <text> [--root <repo-root>]
  handoff --topic <slug> [--json] [--root <repo-root>]
  promotion-readiness --topic <slug> [--json] [--root <repo-root>]
  refresh-index [--root <repo-root>]
  status [--topic <slug>] [--root <repo-root>]
  check [--root <repo-root>]
`);
}

function assertEnumValue<const T extends readonly string[]>(
  values: T,
  value: string,
  label: string,
): T[number] {
  if (values.includes(value)) {
    return value as T[number];
  }
  throw new Error(`invalid ${label}: ${value}`);
}

function assertCandidateKind(value: string): CandidateKind {
  return assertEnumValue(CANDIDATE_KINDS, value, "candidate kind");
}

function assertCandidateStatus(value: string): CandidateStatus {
  return assertEnumValue(CANDIDATE_STATUSES, value, "candidate status");
}

function assertNoteKind(value: string): NoteKind {
  return assertEnumValue(NOTE_KINDS, value, "note kind");
}

function assertSignalKind(value: string): SignalKind {
  return assertEnumValue(SIGNAL_KINDS, value, "signal kind");
}

function assertSignalStatus(value: string): SignalStatus {
  return assertEnumValue(SIGNAL_STATUSES, value, "signal status");
}

function assertPreflightDecision(value: string): PreflightDecision {
  return assertEnumValue(PREFLIGHT_DECISIONS, value, "preflight decision");
}

function assertRouteDecision(value: string): RouteDecision {
  return assertEnumValue(_ROUTE_DECISIONS, value, "route decision");
}

function assertSourceKind(value: string): SourceKind {
  return assertEnumValue(SOURCE_KINDS, value, "source kind");
}

function assertFeedbackSignal(value: string): FeedbackSignal {
  return assertEnumValue(FEEDBACK_SIGNALS, value, "feedback signal");
}

function assertTopicStatus(value: string): TopicStatus {
  return assertEnumValue(TOPIC_STATUSES, value, "topic status");
}

function assertPromotionSurface(value: string): PromotionSurface {
  return assertEnumValue(PROMOTION_SURFACES, value, "promotion surface");
}

function assertPromotionStatus(value: string): PromotionStatus {
  return assertEnumValue(PROMOTION_STATUSES, value, "promotion status");
}

function normalizeLocalContextRef(root: string, raw: string): string {
  return normalizeRepoRelativeRef(root, raw);
}

function normalizeOptionalRepoRef(root: string, raw?: string): string | undefined {
  if (!raw) {
    return undefined;
  }
  return normalizeLocalContextRef(root, raw);
}

function readCsvRepoRefs(root: string, raw?: string): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "")
    .map((item) => normalizeLocalContextRef(root, item));
}

function readCsvValues(raw?: string): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

function readConfidence(raw?: string): number {
  if (!raw) {
    return 0.5;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`confidence must be between 0 and 1: ${raw}`);
  }
  return parsed;
}

function readSignalContract(file: string, root: string): IntakeSignalContract {
  const contractPath = path.resolve(root, file);
  const raw = JSON.parse(fs.readFileSync(contractPath, "utf8")) as unknown;
  validateSignalContract(raw, root);
  return raw as IntakeSignalContract;
}

function buildSignalFileRecord(
  signal: IntakeSignalRecord,
  override: Partial<IntakeSignalRecord> = {},
): IntakeSignalRecord {
  return {
    ...signal,
    ...override,
    version: 1,
  };
}

function persistSignal(paths: ReturnType<typeof resolvePaths>, signal: IntakeSignalRecord): void {
  writeSignal(paths, signal);
  writeMemInboxReadme(paths);
}

function persistTopic(paths: ReturnType<typeof resolvePaths>, topic: TopicRecord): void {
  writeTopic(paths, topic);
  writeTopicReadme(paths, topic);
  writeTopicReport(paths, topic);
  writeTopicHandoff(paths, topic);
  writeTopicArchive(paths, topic);
  writeIndex(paths, syncIndexEntry(readIndex(paths), topic));
}

function requireCandidate(topic: TopicRecord, candidateId: string): CandidateRecord {
  const candidate = topic.candidates.find((item) => item.id === candidateId);
  if (!candidate) {
    throw new Error(`unknown candidate in topic ${topic.slug}: ${candidateId}`);
  }
  return candidate;
}

function cmdInitTopic(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const rawSlug = readStringFlag(flags, "slug", true)!;
  const title = readStringFlag(flags, "title") ?? rawSlug;
  const slug = toSlug(rawSlug);
  if (!slug) {
    throw new Error("slug normalizes to empty value");
  }

  const paths = resolvePaths(root);
  ensureBaseLayout(paths);

  const now = nowIso();
  let topic: TopicRecord;
  if (topicExists(paths, slug)) {
    topic = readTopic(paths, slug);
    topic.title = title;
    topic.updated_at = now;
  } else {
    topic = {
      version: 1,
      slug,
      title,
      status: "active",
      created_at: now,
      updated_at: now,
      preflight: undefined,
      local_context_refs: [],
      candidates: [],
      sources: [],
      feedback: [],
      benchmarks: [],
      promotions: [],
      notes: [],
    };
  }

  persistTopic(paths, topic);

  console.log(`initialized topic ${slug}`);
}

function cmdCaptureSignal(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const signalId = toSlug(readStringFlag(flags, "signal", true)!);
  const kind = assertSignalKind(readStringFlag(flags, "kind", true)!);
  const title = readStringFlag(flags, "title", true)!;
  const summary = readStringFlag(flags, "summary", true)!;
  const producer = readStringFlag(flags, "producer", true)!;
  const sourceChannel = readStringFlag(flags, "channel", true)!;
  const topicHint = readStringFlag(flags, "topic-hint");
  const confidence = readConfidence(readStringFlag(flags, "confidence"));
  const evidenceValue = readStringFlag(flags, "evidence");
  const localRefs = readCsvRepoRefs(root, readStringFlag(flags, "local-refs"));

  if (!signalId) {
    throw new Error("signal id normalizes to empty value");
  }

  const paths = resolvePaths(root);
  ensureBaseLayout(paths);
  if (signalExists(paths, signalId)) {
    const existing = readSignal(paths, signalId);
    if (existing.status !== "pending") {
      throw new Error(`signal already resolved: ${signalId}`);
    }
  }

  const now = nowIso();
  const signal: IntakeSignalRecord = {
    version: 1,
    id: signalId,
    kind,
    title,
    summary,
    producer,
    source_channel: sourceChannel,
    topic_hint: topicHint ? toSlug(topicHint) : undefined,
    confidence,
    evidence: evidenceValue ? [evidenceValue] : [],
    local_refs: localRefs,
    status: "pending",
    created_at: signalExists(paths, signalId) ? readSignal(paths, signalId).created_at : now,
    updated_at: now,
  };

  persistSignal(paths, signal);
  console.log(`captured signal ${signalId}`);
}

function cmdValidateSignals(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const contractFile = readStringFlag(flags, "contract", true)!;
  readSignalContract(contractFile, root);
  console.log("signal contract is valid");
}

function applySignalContract(
  paths: ReturnType<typeof resolvePaths>,
  contract: IntakeSignalContract,
  root: string,
): number {
  const pendingSignals: IntakeSignalRecord[] = [];
  const normalizedIds = new Set<string>();
  for (const input of contract.signals) {
    if (input.status !== "pending") {
      throw new Error(`import-signals only accepts pending signals: ${input.id}`);
    }
    const signalId = toSlug(input.id);
    if (!signalId) {
      throw new Error("signal id normalizes to empty value");
    }
    if (normalizedIds.has(signalId)) {
      throw new Error(`duplicate signal id after normalization: ${signalId}`);
    }
    normalizedIds.add(signalId);
    const existing = signalExists(paths, signalId) ? readSignal(paths, signalId) : undefined;
    if (existing) {
      if (existing.status !== "pending") {
        throw new Error(`signal already resolved: ${signalId}`);
      }
    }
    pendingSignals.push(buildSignalFileRecord(input, {
      id: signalId,
      topic_hint: input.topic_hint ? toSlug(input.topic_hint) : undefined,
      local_refs: input.local_refs.map((ref) => normalizeLocalContextRef(root, ref)),
      created_at: existing ? earlierIso(existing.created_at, input.created_at) : input.created_at,
      updated_at: existing ? laterIso(existing.updated_at, input.updated_at) : input.updated_at,
      status: "pending",
      adopted_topic: undefined,
      resolution_note: undefined,
      producer: input.producer || contract.producer,
    }));
  }
  for (const signal of pendingSignals) {
    persistSignal(paths, signal);
  }
  return pendingSignals.length;
}

function cmdBridgeSignals(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const contractFile = readStringFlag(flags, "contract", true)!;
  const contract = readSignalContract(contractFile, root);
  const paths = resolvePaths(root);
  ensureBaseLayout(paths);
  const imported = applySignalContract(paths, contract, root);
  console.log(`bridged ${imported} signal(s) into .mem_inbox`);
}

function cmdImportSignals(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const contractFile = readStringFlag(flags, "contract", true)!;
  const contract = readSignalContract(contractFile, root);
  const paths = resolvePaths(root);
  ensureBaseLayout(paths);
  const imported = applySignalContract(paths, contract, root);
  console.log(`imported ${imported} signal(s)`);
}

function cmdExportSignals(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const statusFilter = readStringFlag(flags, "status") ?? "pending";
  const normalizedStatus = statusFilter === "all" ? "all" : assertSignalStatus(statusFilter);
  const paths = resolvePaths(root);
  ensureBaseLayout(paths);
  const signals = listSignalIds(paths)
    .map((signalId) => readSignal(paths, signalId))
    .filter((signal) => normalizedStatus === "all" || signal.status === normalizedStatus);
  const payload: IntakeSignalContract = {
    schema: "bagakit.evolver.signal.v1",
    producer: "bagakit-skill-evolver",
    generated_at: nowIso(),
    signals,
  };
  const output = readStringFlag(flags, "output");
  if (output) {
    const outPath = path.resolve(root, output);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
    console.log(`exported signals to ${path.relative(root, outPath).split(path.sep).join("/")}`);
    return;
  }
  console.log(JSON.stringify(payload, null, 2));
}

function cmdListSignals(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const statusFilter = readStringFlag(flags, "status") ?? "all";
  const normalizedStatus = statusFilter === "all" ? "all" : assertSignalStatus(statusFilter);
  const jsonMode = flags.has("json");
  const paths = resolvePaths(root);
  ensureBaseLayout(paths);
  const signals = listSignalIds(paths)
    .map((signalId) => readSignal(paths, signalId))
    .filter((signal) => normalizedStatus === "all" || signal.status === normalizedStatus);
  if (jsonMode) {
    console.log(JSON.stringify(signals, null, 2));
    return;
  }
  if (signals.length === 0) {
    console.log("no signals");
    return;
  }
  for (const signal of signals) {
    const topicHint = signal.topic_hint ? ` | topic_hint=${signal.topic_hint}` : "";
    const adoptedTopic = signal.adopted_topic ? ` | adopted_topic=${signal.adopted_topic}` : "";
    console.log(`${signal.id} | status=${signal.status} | kind=${signal.kind}${topicHint}${adoptedTopic}`);
    console.log(`  ${signal.summary}`);
  }
}

function cmdAdoptSignal(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const signalId = toSlug(readStringFlag(flags, "signal", true)!);
  const topicSlug = toSlug(readStringFlag(flags, "topic", true)!);
  const sourceId = readStringFlag(flags, "source-id") ?? `signal-${signalId}`;
  const sourceKind = assertSourceKind(readStringFlag(flags, "source-kind") ?? "note");
  const origin = readStringFlag(flags, "origin");
  const noteKind = assertNoteKind(readStringFlag(flags, "note-kind") ?? "observation");
  const extraNote = readStringFlag(flags, "note");
  const relatedCandidates = readCsvValues(readStringFlag(flags, "candidate-ids"));

  const paths = resolvePaths(root);
  const signal = readSignal(paths, signalId);
  if (signal.status !== "pending") {
    throw new Error(`signal is already resolved: ${signalId}`);
  }

  const topic = readTopic(paths, topicSlug);
  for (const candidateId of relatedCandidates) {
    requireCandidate(topic, candidateId);
  }
  if (topic.sources.some((source) => source.id === sourceId)) {
    throw new Error(`source already exists in topic ${topicSlug}: ${sourceId}`);
  }

  const primaryRef = signal.local_refs[0];
  const source: SourceRecord = {
    id: sourceId,
    kind: sourceKind,
    title: signal.title,
    origin: origin ?? `${signal.producer}:${signal.source_channel}`,
    local_ref: primaryRef,
    summary_ref: primaryRef,
    added_at: nowIso(),
  };
  topic.sources.push(source);

  for (const ref of signal.local_refs) {
    if (!topic.local_context_refs.includes(ref)) {
      topic.local_context_refs.push(ref);
    }
  }
  topic.local_context_refs.sort((left, right) => left.localeCompare(right));

  const noteLines = [
    `adopted intake signal ${signal.id} from ${signal.producer}/${signal.source_channel}`,
    `summary: ${signal.summary}`,
  ];
  for (const evidence of signal.evidence) {
    noteLines.push(`evidence: ${evidence}`);
  }
  if (extraNote) {
    noteLines.push(extraNote);
  }
  const note: NoteRecord = {
    kind: noteKind,
    title: `signal:${signal.id}`,
    text: noteLines.join("\n"),
    created_at: nowIso(),
    related_candidates: relatedCandidates.length > 0 ? relatedCandidates : undefined,
    related_source_ids: [sourceId],
  };
  topic.notes.push(note);
  topic.updated_at = nowIso();
  persistTopic(paths, topic);

  const adopted = buildSignalFileRecord(signal, {
    status: "adopted",
    adopted_topic: topicSlug,
    resolution_note: extraNote ?? `adopted into ${topicSlug}`,
    updated_at: nowIso(),
  });
  persistSignal(paths, adopted);
  console.log(`adopted signal ${signalId} into ${topicSlug}`);
}

function cmdDismissSignal(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const signalId = toSlug(readStringFlag(flags, "signal", true)!);
  const note = readStringFlag(flags, "note", true)!;
  const paths = resolvePaths(root);
  const signal = readSignal(paths, signalId);
  if (signal.status !== "pending") {
    throw new Error(`signal is already resolved: ${signalId}`);
  }
  const dismissed = buildSignalFileRecord(signal, {
    status: "dismissed",
    resolution_note: note,
    updated_at: nowIso(),
  });
  persistSignal(paths, dismissed);
  console.log(`dismissed signal ${signalId}`);
}

function cmdPreflight(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const topicSlug = toSlug(readStringFlag(flags, "topic", true)!);
  const decision = assertPreflightDecision(readStringFlag(flags, "decision", true)!);
  const rationale = readStringFlag(flags, "rationale", true)!;

  const paths = resolvePaths(root);
  const topic = readTopic(paths, topicSlug);
  const now = nowIso();
  topic.preflight = {
    decision,
    rationale,
    assessed_at: now,
  };
  topic.updated_at = now;

  persistTopic(paths, topic);
  console.log(`recorded preflight for ${topicSlug}`);
}

function cmdAddCandidate(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const topicSlug = toSlug(readStringFlag(flags, "topic", true)!);
  const candidateId = readStringFlag(flags, "candidate", true)!;
  const kind = assertCandidateKind(readStringFlag(flags, "kind", true)!);
  const source = readStringFlag(flags, "source", true)!;
  const summary = readStringFlag(flags, "summary", true)!;
  const status = assertCandidateStatus(
    readStringFlag(flags, "status") ?? "planned",
  );

  const paths = resolvePaths(root);
  const topic = readTopic(paths, topicSlug);
  if (topic.candidates.some((item) => item.id === candidateId)) {
    throw new Error(`candidate already exists in topic ${topicSlug}: ${candidateId}`);
  }

  const candidate: CandidateRecord = {
    id: candidateId,
    kind,
    source,
    summary,
    status,
    added_at: nowIso(),
  };
  topic.candidates.push(candidate);
  topic.updated_at = nowIso();

  persistTopic(paths, topic);
  console.log(`added candidate ${candidateId} to ${topicSlug}`);
}

function cmdAddSource(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const topicSlug = toSlug(readStringFlag(flags, "topic", true)!);
  const sourceId = readStringFlag(flags, "source-id", true)!;
  const kind = assertSourceKind(readStringFlag(flags, "kind", true)!);
  const title = readStringFlag(flags, "title", true)!;
  const origin = readStringFlag(flags, "origin", true)!;
  const localRef = normalizeOptionalRepoRef(root, readStringFlag(flags, "local-ref"));
  const summaryRef = normalizeOptionalRepoRef(root, readStringFlag(flags, "summary-ref"));

  const paths = resolvePaths(root);
  const topic = readTopic(paths, topicSlug);
  if (topic.sources.some((item) => item.id === sourceId)) {
    throw new Error(`source already exists in topic ${topicSlug}: ${sourceId}`);
  }

  const source: SourceRecord = {
    id: sourceId,
    kind,
    title,
    origin,
    local_ref: localRef,
    summary_ref: summaryRef,
    added_at: nowIso(),
  };
  topic.sources.push(source);
  topic.updated_at = nowIso();

  persistTopic(paths, topic);
  console.log(`added source ${sourceId} to ${topicSlug}`);
}

function cmdAddFeedback(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const topicSlug = toSlug(readStringFlag(flags, "topic", true)!);
  const channel = readStringFlag(flags, "channel", true)!;
  const signal = assertFeedbackSignal(readStringFlag(flags, "signal", true)!);
  const detail = readStringFlag(flags, "detail", true)!;

  const paths = resolvePaths(root);
  const topic = readTopic(paths, topicSlug);
  const feedback: FeedbackRecord = {
    channel,
    signal,
    detail,
    created_at: nowIso(),
  };
  topic.feedback.push(feedback);
  topic.updated_at = nowIso();

  persistTopic(paths, topic);
  console.log(`added feedback to ${topicSlug}`);
}

function cmdAddBenchmark(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const topicSlug = toSlug(readStringFlag(flags, "topic", true)!);
  const benchmarkId = readStringFlag(flags, "benchmark", true)!;
  const metric = readStringFlag(flags, "metric", true)!;
  const result = readStringFlag(flags, "result", true)!;
  const baseline = readStringFlag(flags, "baseline");
  const detail = readStringFlag(flags, "detail");

  const paths = resolvePaths(root);
  const topic = readTopic(paths, topicSlug);
  const record: BenchmarkRecord = {
    id: benchmarkId,
    metric,
    result,
    baseline: baseline ?? undefined,
    detail: detail ?? undefined,
    created_at: nowIso(),
  };
  topic.benchmarks.push(record);
  topic.updated_at = nowIso();

  persistTopic(paths, topic);
  console.log(`added benchmark ${benchmarkId} to ${topicSlug}`);
}

function cmdAddNote(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const topicSlug = toSlug(readStringFlag(flags, "topic", true)!);
  const kind = assertNoteKind(readStringFlag(flags, "kind", true)!);
  const text = readStringFlag(flags, "text", true)!;

  const paths = resolvePaths(root);
  const topic = readTopic(paths, topicSlug);
  const note: NoteRecord = {
    kind,
    text,
    created_at: nowIso(),
  };
  topic.notes.push(note);
  topic.updated_at = nowIso();

  persistTopic(paths, topic);
  console.log(`added ${kind} note to ${topicSlug}`);
}

function cmdAddContextRef(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const topicSlug = toSlug(readStringFlag(flags, "topic", true)!);
  const rawRef = readStringFlag(flags, "ref", true)!;
  const noteText = readStringFlag(flags, "note");

  const paths = resolvePaths(root);
  const topic = readTopic(paths, topicSlug);
  const normalizedRef = normalizeLocalContextRef(paths.root, rawRef);

  if (!topic.local_context_refs.includes(normalizedRef)) {
    topic.local_context_refs.push(normalizedRef);
    topic.local_context_refs.sort((a, b) => a.localeCompare(b));
  }

  if (noteText) {
    topic.notes.push({
      kind: "observation",
      title: "local-context-ref",
      text: noteText,
      created_at: nowIso(),
    });
  }

  topic.updated_at = nowIso();
  persistTopic(paths, topic);

  const absoluteRef = path.join(paths.root, normalizedRef);
  if (!fs.existsSync(absoluteRef)) {
    console.warn(`bagakit-evolver: weak ref target does not currently exist: ${normalizedRef}`);
  }

  console.log(`added local context ref ${normalizedRef} to ${topicSlug}`);
}

function cmdSetRoute(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const topicSlug = toSlug(readStringFlag(flags, "topic", true)!);
  const decision = assertRouteDecision(readStringFlag(flags, "decision", true)!);
  const rationale = readStringFlag(flags, "rationale", true)!;
  const hostTarget = normalizeOptionalRepoRef(root, readStringFlag(flags, "host-target"));
  const hostRef = normalizeOptionalRepoRef(root, readStringFlag(flags, "host-ref"));
  const upstreamPromotionIds = readStringFlag(flags, "upstream-promotions")
    ?.split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "") ?? [];

  const paths = resolvePaths(root);
  const topic = readTopic(paths, topicSlug);
  topic.routing = {
    decision,
    rationale,
    decided_at: nowIso(),
    host_target: hostTarget,
    host_ref: hostRef,
    upstream_promotion_ids: upstreamPromotionIds,
  };
  topic.updated_at = nowIso();

  persistTopic(paths, topic);
  console.log(`recorded route ${decision} for ${topicSlug}`);
}

function cmdRemoveContextRef(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const topicSlug = toSlug(readStringFlag(flags, "topic", true)!);
  const rawRef = readStringFlag(flags, "ref", true)!;

  const paths = resolvePaths(root);
  const topic = readTopic(paths, topicSlug);
  const normalizedRef = normalizeLocalContextRef(paths.root, rawRef);
  const before = topic.local_context_refs.length;
  topic.local_context_refs = topic.local_context_refs.filter((item) => item !== normalizedRef);
  if (topic.local_context_refs.length === before) {
    throw new Error(`local context ref not found in ${topicSlug}: ${normalizedRef}`);
  }

  topic.updated_at = nowIso();
  persistTopic(paths, topic);
  console.log(`removed local context ref ${normalizedRef} from ${topicSlug}`);
}

function cmdRecordDecision(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const topicSlug = toSlug(readStringFlag(flags, "topic", true)!);
  const decision = readStringFlag(flags, "decision", true)!;
  const rationale = readStringFlag(flags, "rationale", true)!;
  const candidateId = readStringFlag(flags, "candidate");
  const nextStatus = readStringFlag(flags, "status");

  const paths = resolvePaths(root);
  const topic = readTopic(paths, topicSlug);
  if (candidateId) {
    requireCandidate(topic, candidateId);
  }

  const note: NoteRecord = {
    kind: "decision",
    title: decision,
    text: rationale,
    created_at: nowIso(),
    related_candidates: candidateId ? [candidateId] : undefined,
  };
  topic.notes.push(note);

  if (nextStatus) {
    topic.status = assertTopicStatus(nextStatus);
  }
  topic.updated_at = nowIso();

  persistTopic(paths, topic);
  console.log(`recorded decision in ${topicSlug}`);
}

function cmdRecordPromotion(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const topicSlug = toSlug(readStringFlag(flags, "topic", true)!);
  const surface = assertPromotionSurface(readStringFlag(flags, "surface", true)!);
  const target = readStringFlag(flags, "target", true)!;
  const summary = readStringFlag(flags, "summary", true)!;
  const promotionId = toSlug(
    readStringFlag(flags, "promotion") ?? `${surface}-${target}`,
  );
  const status = assertPromotionStatus(readStringFlag(flags, "status") ?? "proposed");
  const ref = normalizeOptionalRepoRef(root, readStringFlag(flags, "ref"));
  const proofRefs = readCsvRepoRefs(root, readStringFlag(flags, "proof-refs"));
  if (!promotionId) {
    throw new Error("promotion id normalizes to empty value");
  }
  if (status === "landed" && !ref) {
    throw new Error("landed promotion requires --ref");
  }
  if (status === "landed" && proofRefs.length === 0) {
    throw new Error("landed promotion requires --proof-refs");
  }

  if (ref) {
    const expectedPrefix = DURABLE_SURFACE_PREFIXES[surface];
    if (!ref.startsWith(expectedPrefix)) {
      throw new Error(`promotion ref must stay under ${expectedPrefix} for surface ${surface}`);
    }
  }

  const paths = resolvePaths(root);
  const topic = readTopic(paths, topicSlug);
  const now = nowIso();
  const existing = topic.promotions.find((promotion) => promotion.id === promotionId);
  if (existing) {
    existing.surface = surface;
    existing.status = status;
    existing.target = target;
    existing.summary = summary;
    existing.ref = ref;
    existing.proof_refs = proofRefs;
    existing.updated_at = now;
  } else {
    const promotion: PromotionRecord = {
      id: promotionId,
      surface,
      status,
      target,
      summary,
      ref,
      proof_refs: proofRefs,
      created_at: now,
      updated_at: now,
    };
    topic.promotions.push(promotion);
  }
  topic.updated_at = nowIso();

  persistTopic(paths, topic);
  console.log(`recorded promotion in ${topicSlug}`);
}

function cmdSetCandidateStatus(
  flags: Map<string, string | boolean>,
  forcedStatus?: CandidateStatus,
): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const topicSlug = toSlug(readStringFlag(flags, "topic", true)!);
  const candidateId = readStringFlag(flags, "candidate", true)!;
  const nextStatus = forcedStatus ?? assertCandidateStatus(readStringFlag(flags, "status", true)!);
  const noteText = readStringFlag(flags, "note");

  const paths = resolvePaths(root);
  const topic = readTopic(paths, topicSlug);
  const candidate = requireCandidate(topic, candidateId);
  candidate.status = nextStatus;
  topic.updated_at = nowIso();

  if (noteText) {
    topic.notes.push({
      kind: "decision",
      title: `candidate:${candidateId}:${nextStatus}`,
      text: noteText,
      created_at: nowIso(),
      related_candidates: [candidateId],
    });
  }

  persistTopic(paths, topic);
  console.log(`set ${candidateId} to ${nextStatus} in ${topicSlug}`);
}

function cmdSetTopicStatus(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const topicSlug = toSlug(readStringFlag(flags, "topic", true)!);
  const nextStatus = assertTopicStatus(readStringFlag(flags, "status", true)!);

  const paths = resolvePaths(root);
  const topic = readTopic(paths, topicSlug);
  topic.status = nextStatus;
  topic.updated_at = nowIso();

  persistTopic(paths, topic);
  console.log(`set topic ${topicSlug} to ${nextStatus}`);
}

function cmdCloseTopic(flags: Map<string, string | boolean>, archived: boolean): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const topicSlug = toSlug(readStringFlag(flags, "topic", true)!);
  const summary = readStringFlag(flags, "summary", true)!;

  const paths = resolvePaths(root);
  const topic = readTopic(paths, topicSlug);
  topic.status = archived ? "archived" : "completed";
  topic.notes.push({
    kind: "decision",
    title: archived ? "archive-topic" : "close-topic",
    text: summary,
    created_at: nowIso(),
  });
  topic.updated_at = nowIso();

  persistTopic(paths, topic);
  console.log(`${archived ? "archived" : "closed"} topic ${topicSlug}`);
}

function cmdRefreshIndex(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const paths = resolvePaths(root);
  ensureBaseLayout(paths);

  for (const slug of listTopicSlugs(paths)) {
    const topic = readTopic(paths, slug);
    writeTopicReadme(paths, topic);
    writeTopicReport(paths, topic);
    writeTopicHandoff(paths, topic);
    writeTopicArchive(paths, topic);
  }

  const index = syncIndexFromTopics(paths);
  writeIndex(paths, index);
  writeMemInboxReadme(paths);
  console.log(`refreshed evolver index and topic artifacts for ${listTopicSlugs(paths).length} topic(s)`);
}

function cmdStatus(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const topicSlug = readStringFlag(flags, "topic");
  const paths = resolvePaths(root);

  if (topicSlug) {
    const topic = readTopic(paths, toSlug(topicSlug));
    console.log(JSON.stringify(topic, null, 2));
    return;
  }

  console.log(JSON.stringify(readIndex(paths), null, 2));
}

function cmdHandoff(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const topicSlug = toSlug(readStringFlag(flags, "topic", true)!);
  const jsonMode = flags.has("json");
  const paths = resolvePaths(root);
  const topic = readTopic(paths, topicSlug);
  const readiness = evaluatePromotionReadiness(topic);

  if (jsonMode) {
    console.log(
      JSON.stringify(
        {
          topic: topic.slug,
          status: topic.status,
          readiness,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(buildTopicHandoff(paths, topic, readiness));
}

function cmdPromotionReadiness(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const topicSlug = toSlug(readStringFlag(flags, "topic", true)!);
  const jsonMode = flags.has("json");
  const paths = resolvePaths(root);
  const topic = readTopic(paths, topicSlug);
  const readiness = evaluatePromotionReadiness(topic);

  if (jsonMode) {
    console.log(JSON.stringify(readiness, null, 2));
    return;
  }

  console.log(`topic: ${topic.slug}`);
  console.log(`route: ${readiness.route_decision}`);
  console.log(`state: ${readiness.state}`);
  console.log(`archive_ready: ${readiness.archive_ready ? "yes" : "no"}`);
  if (readiness.blockers.length > 0) {
    console.log("blockers:");
    for (const blocker of readiness.blockers) {
      console.log(`- ${blocker}`);
    }
  } else {
    console.log("blockers: none");
  }
  console.log(`next: ${readiness.recommended_next_move}`);
}

function cmdCheck(flags: Map<string, string | boolean>): void {
  const root = readStringFlag(flags, "root") ?? defaultRoot;
  const paths = resolvePaths(root);
  const rawIndex = readRawIndex(paths, { createIfMissing: false });
  validateIndexShape(rawIndex);
  if (
    rawIndex &&
    typeof rawIndex === "object" &&
    !Array.isArray(rawIndex) &&
    Array.isArray(rawIndex.topics)
  ) {
    for (const rawEntry of rawIndex.topics) {
      validateIndexEntry(rawEntry);
    }
  }
  const index = readIndex(paths, { createIfMissing: false });
  const warnings: string[] = [];
  const signals = listSignalIds(paths).map((signalId) => {
    const rawSignal = readRawSignal(paths, signalId);
    validateSignalShape(rawSignal, paths.root);
    return readSignal(paths, signalId);
  });

  for (const signal of signals) {
    if (signal.status === "adopted" && !signal.adopted_topic) {
      throw new Error(`adopted signal must include adopted_topic: ${signal.id}`);
    }
    if (signal.adopted_topic && !topicExists(paths, signal.adopted_topic)) {
      warnings.push(`signal ${signal.id}: adopted topic does not currently exist: ${signal.adopted_topic}`);
    }
    for (const ref of signal.local_refs) {
      const absoluteRef = path.join(paths.root, ref);
      if (!fs.existsSync(absoluteRef)) {
        warnings.push(`signal ${signal.id}: missing local_ref target ${ref}`);
      }
    }
  }

  for (const entry of index.topics) {
    const rawTopic = readRawTopic(paths, entry.slug);
    validateTopicShape(rawTopic);
    validatePromotionRefSurface(rawTopic);
    validateRoutingShape(rawTopic, paths.root);
    const topic = readTopic(paths, entry.slug);
    if (topic.slug !== entry.slug) {
      throw new Error(`topic/index slug mismatch: ${entry.slug}`);
    }
    if (topic.candidates.length !== entry.candidate_count) {
      throw new Error(`candidate count mismatch for ${entry.slug}`);
    }
    if (topic.notes.length !== entry.note_count) {
      throw new Error(`note count mismatch for ${entry.slug}`);
    }
    if (topic.local_context_refs.length !== entry.local_context_ref_count) {
      throw new Error(`local context ref count mismatch for ${entry.slug}`);
    }
    if (topic.sources.length !== entry.source_count) {
      throw new Error(`source count mismatch for ${entry.slug}`);
    }
    if (topic.feedback.length !== entry.feedback_count) {
      throw new Error(`feedback count mismatch for ${entry.slug}`);
    }
    if (topic.benchmarks.length !== entry.benchmark_count) {
      throw new Error(`benchmark count mismatch for ${entry.slug}`);
    }
    if (topic.promotions.length !== entry.promotion_count) {
      throw new Error(`promotion count mismatch for ${entry.slug}`);
    }

    const seen = new Set<string>();
    for (const ref of topic.local_context_refs) {
      const normalizedRef = normalizeLocalContextRef(paths.root, ref);
      if (normalizedRef !== ref) {
        throw new Error(`local context ref is not normalized for ${entry.slug}: ${ref}`);
      }
      if (seen.has(ref)) {
        throw new Error(`duplicate local context ref in ${entry.slug}: ${ref}`);
      }
      seen.add(ref);
      const absoluteRef = path.join(paths.root, ref);
      if (!fs.existsSync(absoluteRef)) {
        warnings.push(`${entry.slug}: missing weak ref target ${ref}`);
      }
    }

    for (const source of topic.sources) {
      for (const ref of [source.local_ref, source.summary_ref]) {
        if (!ref) continue;
        const normalizedRef = normalizeLocalContextRef(paths.root, ref);
        if (normalizedRef !== ref) {
          throw new Error(`source ref is not normalized for ${entry.slug}: ${ref}`);
        }
        const absoluteRef = path.join(paths.root, ref);
        if (!fs.existsSync(absoluteRef)) {
          warnings.push(`${entry.slug}: missing source ref target ${ref}`);
        }
      }
    }

    for (const promotion of topic.promotions) {
      if (!promotion.ref) continue;
      const normalizedRef = normalizeLocalContextRef(paths.root, promotion.ref);
      if (normalizedRef !== promotion.ref) {
        throw new Error(`promotion ref is not normalized for ${entry.slug}: ${promotion.ref}`);
      }
      const absoluteRef = path.join(paths.root, promotion.ref);
      if (!fs.existsSync(absoluteRef)) {
        warnings.push(`${entry.slug}: missing promotion ref target ${promotion.ref}`);
      }
      for (const proofRef of promotion.proof_refs) {
        const normalizedProofRef = normalizeLocalContextRef(paths.root, proofRef);
        if (normalizedProofRef !== proofRef) {
          throw new Error(`promotion proof ref is not normalized for ${entry.slug}: ${proofRef}`);
        }
        const absoluteProofRef = path.join(paths.root, proofRef);
        if (!fs.existsSync(absoluteProofRef)) {
          throw new Error(`missing promotion proof ref target for ${entry.slug}: ${proofRef}`);
        }
      }
    }

    if (topic.routing?.host_ref) {
      const normalizedHostRef = normalizeLocalContextRef(paths.root, topic.routing.host_ref);
      if (normalizedHostRef !== topic.routing.host_ref) {
        throw new Error(`routing host_ref is not normalized for ${entry.slug}: ${topic.routing.host_ref}`);
      }
      const absoluteHostRef = path.join(paths.root, topic.routing.host_ref);
      if (!fs.existsSync(absoluteHostRef)) {
        warnings.push(`${entry.slug}: missing host route ref target ${topic.routing.host_ref}`);
      }
    }

    const expectedReadme = buildTopicReadme(paths, topic);
    if (!fs.existsSync(paths.topicReadme(entry.slug))) {
      throw new Error(`missing topic README for ${entry.slug}; run refresh-index`);
    }
    const actualReadme = fs.readFileSync(paths.topicReadme(entry.slug), "utf8");
    if (actualReadme !== expectedReadme) {
      throw new Error(`topic README is stale for ${entry.slug}; run refresh-index`);
    }

    const expectedReport = buildTopicReport(paths, topic);
    if (!fs.existsSync(paths.topicReport(entry.slug))) {
      throw new Error(`missing topic REPORT for ${entry.slug}; run refresh-index`);
    }
    const actualReport = fs.readFileSync(paths.topicReport(entry.slug), "utf8");
    if (actualReport !== expectedReport) {
      throw new Error(`topic REPORT is stale for ${entry.slug}; run refresh-index`);
    }

    const expectedHandoff = buildTopicHandoff(paths, topic);
    if (!fs.existsSync(paths.topicHandoff(entry.slug))) {
      throw new Error(`missing topic HANDOFF for ${entry.slug}; run refresh-index`);
    }
    const actualHandoff = fs.readFileSync(paths.topicHandoff(entry.slug), "utf8");
    if (actualHandoff !== expectedHandoff) {
      throw new Error(`topic HANDOFF is stale for ${entry.slug}; run refresh-index`);
    }

    const archivePath = paths.topicArchive(entry.slug);
    if (topic.status === "archived") {
      const expectedArchive = buildTopicArchive(paths, topic);
      if (!fs.existsSync(archivePath)) {
        throw new Error(`missing topic ARCHIVE for ${entry.slug}; run refresh-index`);
      }
      const actualArchive = fs.readFileSync(archivePath, "utf8");
      if (actualArchive !== expectedArchive) {
        throw new Error(`topic ARCHIVE is stale for ${entry.slug}; run refresh-index`);
      }
    } else if (fs.existsSync(archivePath)) {
      throw new Error(`topic ARCHIVE should not exist for non-archived topic ${entry.slug}`);
    }
  }

  const reconstructed = syncIndexFromTopics(paths);
  if (JSON.stringify(reconstructed) !== JSON.stringify(index)) {
    throw new Error("index.json is stale; run refresh-index");
  }
  const expectedMemInboxReadme = buildMemInboxReadme(paths, signals);
  if (!fs.existsSync(paths.memInboxReadme)) {
    if (signals.length === 0) {
      console.warn("warn: missing .mem_inbox/README.md for empty intake buffer");
    } else {
      throw new Error("missing .mem_inbox/README.md; run refresh-index");
    }
  } else {
    const actualMemInboxReadme = fs.readFileSync(paths.memInboxReadme, "utf8");
    if (actualMemInboxReadme !== expectedMemInboxReadme) {
      throw new Error(".mem_inbox/README.md is stale; run refresh-index");
    }
  }

  for (const warning of warnings) {
    console.warn(`warn: ${warning}`);
  }
  console.log("evolver memory check passed");
}

function main(): void {
  const { command, flags } = parseArgs(process.argv.slice(2));

  switch (command) {
    case "help":
    case "--help":
    case "-h":
      printHelp();
      return;
    case "init-topic":
      cmdInitTopic(flags);
      return;
    case "capture-signal":
      cmdCaptureSignal(flags);
      return;
    case "validate-signals":
      cmdValidateSignals(flags);
      return;
    case "bridge-signals":
      cmdBridgeSignals(flags);
      return;
    case "import-signals":
      cmdImportSignals(flags);
      return;
    case "export-signals":
      cmdExportSignals(flags);
      return;
    case "list-signals":
      cmdListSignals(flags);
      return;
    case "adopt-signal":
      cmdAdoptSignal(flags);
      return;
    case "dismiss-signal":
      cmdDismissSignal(flags);
      return;
    case "preflight":
      cmdPreflight(flags);
      return;
    case "add-candidate":
      cmdAddCandidate(flags);
      return;
    case "add-source":
      cmdAddSource(flags);
      return;
    case "add-feedback":
      cmdAddFeedback(flags);
      return;
    case "add-benchmark":
      cmdAddBenchmark(flags);
      return;
    case "add-note":
      cmdAddNote(flags);
      return;
    case "add-context-ref":
      cmdAddContextRef(flags);
      return;
    case "set-route":
      cmdSetRoute(flags);
      return;
    case "remove-context-ref":
      cmdRemoveContextRef(flags);
      return;
    case "record-decision":
      cmdRecordDecision(flags);
      return;
    case "record-promotion":
      cmdRecordPromotion(flags);
      return;
    case "set-candidate-status":
      cmdSetCandidateStatus(flags);
      return;
    case "promote-candidate":
      cmdSetCandidateStatus(flags, "promoted");
      return;
    case "reject-candidate":
      cmdSetCandidateStatus(flags, "rejected");
      return;
    case "revisit-candidate":
      cmdSetCandidateStatus(flags, "revisit");
      return;
    case "set-topic-status":
      cmdSetTopicStatus(flags);
      return;
    case "close-topic":
      cmdCloseTopic(flags, false);
      return;
    case "archive-topic":
      cmdCloseTopic(flags, true);
      return;
    case "handoff":
      cmdHandoff(flags);
      return;
    case "promotion-readiness":
      cmdPromotionReadiness(flags);
      return;
    case "refresh-index":
      cmdRefreshIndex(flags);
      return;
    case "status":
      cmdStatus(flags);
      return;
    case "check":
      cmdCheck(flags);
      return;
    default:
      throw new Error(`unknown command: ${command}`);
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`bagakit-evolver: ${message}`);
  process.exitCode = 1;
}
