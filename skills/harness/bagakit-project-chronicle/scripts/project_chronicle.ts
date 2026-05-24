#!/usr/bin/env -S node --experimental-strip-types

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type JsonObject = Record<string, unknown>;
type Args = Map<string, string[]>;

const RUN_SCHEMA = "bagakit.project-chronicle.run.v1";
const CENSUS_SCHEMA = "bagakit.project-chronicle.source-census.v1";
const CARD_SCHEMA = "bagakit.project-chronicle.session-card.v1";
const LINEAGE_SCHEMA = "bagakit.project-chronicle.lineage.v1";
const CAST_SCHEMA = "bagakit.project-chronicle.cast.v1";
const LEDGER_SCHEMA = "bagakit.project-chronicle.evolution-ledger.v1";
const REVIEW_SCHEMA = "bagakit.project-chronicle.review.v1";
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const DISPOSITIONS = new Set(["included", "excluded", "unreadable"]);
const SOURCE_KINDS = new Set(["host-session", "transcript", "runner-session", "log-bundle", "other"]);
const REF_KINDS = new Set(["repo-file", "host-session"]);
const COVERAGE_STATUSES = new Set(["complete", "partial"]);
const INSIGHT_KINDS = new Set([
  "success-principle",
  "corrected-belief",
  "quality-ratchet",
  "friction-lever",
  "cost-lever",
  "unresolved-tension",
]);
const EPISTEMIC_STATUSES = new Set(["observed", "inferred", "reviewed", "accepted"]);
const REVIEW_GATES = [
  "coverage_honesty",
  "evidence_fidelity",
  "contradiction_handling",
  "epic_without_fabrication",
  "generational_delta",
  "harness_value",
  "privacy_and_retention",
] as const;

function usage(code = 2): never {
  const output = `bagakit-project-chronicle

Commands:
  init --root <project-root> --run-id <id> --title <title> --scope <boundary> [--session-definition <text>]
  add-session --root <project-root> --run-id <id> --session-id <id> --title <title>
    --source-kind <host-session|transcript|runner-session|log-bundle|other>
    --ref-kind <repo-file|host-session> --source-ref <ref>
    --disposition <included|excluded|unreadable> [--reason <text>]
  seal-census --root <project-root> --run-id <id> --status <complete|partial>
    --adapter <id> [--adapter <id> ...] [--gap <text> ...]
  status --root <project-root> --run-id <id> [--json]
  validate --root <project-root> --run-id <id> [--final]
`;
  if (code === 0) console.log(output);
  else console.error(output);
  process.exit(code);
}

function parseArgs(raw: string[]): Args {
  const parsed: Args = new Map();
  for (let index = 0; index < raw.length; index += 1) {
    const token = raw[index];
    if (!token.startsWith("--")) {
      throw new Error(`unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    const next = raw[index + 1];
    const value = next && !next.startsWith("--") ? (index += 1, next) : "true";
    parsed.set(key, [...(parsed.get(key) ?? []), value]);
  }
  return parsed;
}

function one(args: Args, key: string, required = true): string {
  const values = args.get(key) ?? [];
  if (values.length === 0) {
    if (required) throw new Error(`missing --${key}`);
    return "";
  }
  if (values.length > 1) throw new Error(`--${key} may be supplied only once`);
  return values[0];
}

function many(args: Args, key: string): string[] {
  return args.get(key) ?? [];
}

function has(args: Args, key: string): boolean {
  return args.has(key);
}

function assertAllowed(args: Args, allowed: string[]): void {
  const allowedSet = new Set(allowed);
  for (const key of args.keys()) {
    if (!allowedSet.has(key)) throw new Error(`unsupported option: --${key}`);
  }
}

function assertSafeId(value: string, label: string): void {
  if (!SAFE_ID.test(value)) {
    throw new Error(`${label} must match ${SAFE_ID}`);
  }
}

function now(): string {
  return new Date().toISOString();
}

function rootFrom(args: Args): string {
  const root = path.resolve(one(args, "root"));
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`project root is not a directory: ${root}`);
  }
  return root;
}

function surfaceDir(root: string): string {
  return path.join(root, ".bagakit", "project-chronicle");
}

function runDir(root: string, runId: string): string {
  return path.join(surfaceDir(root), "runs", runId);
}

function runFile(root: string, runId: string, name: string): string {
  return path.join(runDir(root, runId), name);
}

function readJson(file: string): JsonObject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`cannot read JSON ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`expected JSON object: ${file}`);
  }
  return parsed as JsonObject;
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temp, file);
}

function writeText(file: string, value: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temp, value, "utf8");
  fs.renameSync(temp, file);
}

function ensureSurface(root: string): void {
  const dir = surfaceDir(root);
  fs.mkdirSync(path.join(dir, "runs"), { recursive: true });
  const marker = path.join(dir, "surface.toml");
  if (!fs.existsSync(marker)) {
    writeText(marker, `schema_version = 1
surface_id = "project-chronicle-runtime"
surface_root = ".bagakit/project-chronicle"
owner_kind = "skill"
owner_id = "bagakit-project-chronicle"
lifecycle_class = "reviewable_projection"
edit_policy = "mixed"
cleanup_safe = false
source_of_truth = [
  "docs/specs/project-chronicle-contract.md",
  "skills/harness/bagakit-project-chronicle/SKILL.md",
]
reviewable_outputs = [
  "runs/<run-id>/chronicle.md",
  "runs/<run-id>/evolution-ledger.json",
  "runs/<run-id>/review.json",
]
adjacent_protocol_files = []
`);
  }
}

function requireRun(root: string, runId: string): string {
  assertSafeId(runId, "run id");
  const dir = runDir(root, runId);
  if (!fs.existsSync(dir)) throw new Error(`chronicle run does not exist: ${runId}`);
  return dir;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function isAbsoluteOrEscaping(value: string): boolean {
  return path.isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value) || value.split(/[\\/]+/).includes("..");
}

function commandInit(args: Args): void {
  assertAllowed(args, ["root", "run-id", "title", "scope", "session-definition"]);
  const root = rootFrom(args);
  const runId = one(args, "run-id");
  const title = one(args, "title").trim();
  const scope = one(args, "scope").trim();
  const sessionDefinition = one(args, "session-definition", false).trim()
    || "One bounded host conversation or project-owned runner session associated with this project.";
  assertSafeId(runId, "run id");
  if (!title || !scope) throw new Error("--title and --scope must not be empty");
  ensureSurface(root);
  const dir = runDir(root, runId);
  if (fs.existsSync(dir)) throw new Error(`chronicle run already exists: ${runId}`);
  fs.mkdirSync(path.join(dir, "session-cards"), { recursive: true });
  const timestamp = now();
  writeJson(path.join(dir, "run.json"), {
    schema: RUN_SCHEMA,
    run_id: runId,
    title,
    created_at: timestamp,
    updated_at: timestamp,
  });
  writeJson(path.join(dir, "source-census.json"), {
    schema: CENSUS_SCHEMA,
    run_id: runId,
    scope: { statement: scope, session_definition: sessionDefinition },
    coverage: {
      status: "open",
      adapters: [],
      gaps: [],
      sealed_at: null,
      counts: { discovered: 0, included: 0, excluded: 0, unreadable: 0 },
    },
    sessions: [],
  });
  writeJson(path.join(dir, "lineage.json"), {
    schema: LINEAGE_SCHEMA,
    run_id: runId,
    epochs: [],
    generation_links: [],
  });
  writeJson(path.join(dir, "cast.json"), {
    schema: CAST_SCHEMA,
    run_id: runId,
    roles: [],
  });
  writeJson(path.join(dir, "evolution-ledger.json"), {
    schema: LEDGER_SCHEMA,
    run_id: runId,
    entries: [],
  });
  writeJson(path.join(dir, "review.json"), {
    schema: REVIEW_SCHEMA,
    run_id: runId,
    status: "pending",
    reviewer: "",
    reviewed_at: null,
    rationale: "",
    gates: Object.fromEntries(REVIEW_GATES.map((gate) => [gate, { status: "pending", note: "" }])),
  });
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const template = fs.readFileSync(path.join(scriptDir, "..", "assets", "chronicle.template.md"), "utf8");
  writeText(path.join(dir, "chronicle.md"), template.replace("{{TITLE}}", title).replace("{{SCOPE}}", scope));
  console.log(`ok: initialized .bagakit/project-chronicle/runs/${runId}`);
}

function updateRun(root: string, runId: string): void {
  const file = runFile(root, runId, "run.json");
  const run = readJson(file);
  run.updated_at = now();
  writeJson(file, run);
}

function countSessions(sessions: unknown[]): JsonObject {
  const counts: JsonObject = { discovered: sessions.length, included: 0, excluded: 0, unreadable: 0 };
  for (const item of sessions) {
    const disposition = stringValue(objectValue(item).disposition);
    if (typeof counts[disposition] === "number") counts[disposition] = (counts[disposition] as number) + 1;
  }
  return counts;
}

function commandAddSession(args: Args): void {
  assertAllowed(args, ["root", "run-id", "session-id", "title", "source-kind", "ref-kind", "source-ref", "disposition", "reason"]);
  const root = rootFrom(args);
  const runId = one(args, "run-id");
  const sessionId = one(args, "session-id");
  const title = one(args, "title").trim();
  const sourceKind = one(args, "source-kind");
  const refKind = one(args, "ref-kind");
  const sourceRef = one(args, "source-ref").trim();
  const disposition = one(args, "disposition");
  const reason = one(args, "reason", false).trim();
  requireRun(root, runId);
  assertSafeId(sessionId, "session id");
  if (!title || !sourceRef) throw new Error("--title and --source-ref must not be empty");
  if (!SOURCE_KINDS.has(sourceKind)) throw new Error(`unsupported source kind: ${sourceKind}`);
  if (!REF_KINDS.has(refKind)) throw new Error(`unsupported ref kind: ${refKind}`);
  if (!DISPOSITIONS.has(disposition)) throw new Error(`unsupported disposition: ${disposition}`);
  if (refKind === "repo-file" && isAbsoluteOrEscaping(sourceRef)) {
    throw new Error("repo-file source refs must be repo-relative and may not escape the project root");
  }
  if (disposition !== "included" && !reason) {
    throw new Error("--reason is required for excluded or unreadable sessions");
  }
  const censusFile = runFile(root, runId, "source-census.json");
  const census = readJson(censusFile);
  const coverage = objectValue(census.coverage);
  if (coverage.status !== "open") throw new Error("cannot add a session after the census is sealed");
  const sessions = arrayValue(census.sessions);
  if (sessions.some((item) => stringValue(objectValue(item).session_id) === sessionId)) {
    throw new Error(`duplicate session id: ${sessionId}`);
  }
  if (sessions.some((item) => stringValue(objectValue(item).source_ref) === sourceRef)) {
    throw new Error(`duplicate source ref: ${sourceRef}`);
  }
  sessions.push({
    session_id: sessionId,
    title,
    source_kind: sourceKind,
    ref_kind: refKind,
    source_ref: sourceRef,
    disposition,
    disposition_reason: reason,
    discovered_order: sessions.length + 1,
  });
  coverage.counts = countSessions(sessions);
  census.sessions = sessions;
  census.coverage = coverage;
  writeJson(censusFile, census);
  if (disposition === "included") {
    writeJson(path.join(runDir(root, runId), "session-cards", `${sessionId}.json`), {
      schema: CARD_SCHEMA,
      run_id: runId,
      session_id: sessionId,
      source_ref: sourceRef,
      summary: "",
      intent: "",
      observed_outcomes: [],
      turning_points: [],
      belief_updates: [],
      leverage_points: [],
      counterevidence: [],
      evidence_spans: [],
    });
  }
  updateRun(root, runId);
  console.log(`ok: registered ${sessionId} as ${disposition}`);
}

function commandSealCensus(args: Args): void {
  assertAllowed(args, ["root", "run-id", "status", "adapter", "gap"]);
  const root = rootFrom(args);
  const runId = one(args, "run-id");
  const status = one(args, "status");
  const adapters = [...new Set(many(args, "adapter").map((value) => value.trim()).filter(Boolean))];
  const gaps = [...new Set(many(args, "gap").map((value) => value.trim()).filter(Boolean))];
  requireRun(root, runId);
  if (!COVERAGE_STATUSES.has(status)) throw new Error(`unsupported coverage status: ${status}`);
  if (adapters.length === 0) throw new Error("at least one --adapter is required");
  if (status === "partial" && gaps.length === 0) throw new Error("partial coverage requires at least one --gap");
  if (status === "complete" && gaps.length > 0) throw new Error("complete coverage may not declare gaps; use partial");
  const censusFile = runFile(root, runId, "source-census.json");
  const census = readJson(censusFile);
  const sessions = arrayValue(census.sessions);
  if (sessions.length === 0) throw new Error("cannot seal an empty session census");
  const coverage = objectValue(census.coverage);
  coverage.status = status;
  coverage.adapters = adapters;
  coverage.gaps = gaps;
  coverage.sealed_at = now();
  coverage.counts = countSessions(sessions);
  census.coverage = coverage;
  writeJson(censusFile, census);
  updateRun(root, runId);
  console.log(`ok: sealed census as ${status}`);
}

function loadRunArtifacts(root: string, runId: string): Record<string, JsonObject> {
  requireRun(root, runId);
  return {
    run: readJson(runFile(root, runId, "run.json")),
    census: readJson(runFile(root, runId, "source-census.json")),
    lineage: readJson(runFile(root, runId, "lineage.json")),
    cast: readJson(runFile(root, runId, "cast.json")),
    ledger: readJson(runFile(root, runId, "evolution-ledger.json")),
    review: readJson(runFile(root, runId, "review.json")),
  };
}

function commandStatus(args: Args): void {
  assertAllowed(args, ["root", "run-id", "json"]);
  const root = rootFrom(args);
  const runId = one(args, "run-id");
  const artifacts = loadRunArtifacts(root, runId);
  const sessions = arrayValue(artifacts.census.sessions);
  const cardsDir = path.join(runDir(root, runId), "session-cards");
  const cards = fs.existsSync(cardsDir) ? fs.readdirSync(cardsDir).filter((name) => name.endsWith(".json")).length : 0;
  const epochs = arrayValue(artifacts.lineage.epochs).length;
  const roles = arrayValue(artifacts.cast.roles).length;
  const insights = arrayValue(artifacts.ledger.entries).length;
  const coverageStatus = stringValue(objectValue(artifacts.census.coverage).status);
  const derivedPhase = artifacts.review.status === "accepted"
    ? "complete"
    : epochs > 0 || roles > 0 || insights > 0
      ? "drafting"
      : coverageStatus === "open"
        ? "census"
        : "carding";
  const summary = {
    schema: "bagakit.project-chronicle.status.v1",
    run_id: runId,
    phase: derivedPhase,
    coverage: coverageStatus,
    counts: countSessions(sessions),
    cards,
    epochs,
    roles,
    insights,
    review: artifacts.review.status,
  };
  if (has(args, "json")) console.log(JSON.stringify(summary, null, 2));
  else console.log(`run=${runId} phase=${summary.phase} coverage=${summary.coverage} sessions=${JSON.stringify(summary.counts)} cards=${cards} epochs=${summary.epochs} roles=${summary.roles} insights=${summary.insights} review=${summary.review}`);
}

function validateSchema(value: JsonObject, expected: string, label: string, runId: string, issues: string[]): void {
  if (value.schema !== expected) issues.push(`${label}: expected schema ${expected}`);
  if (value.run_id !== runId) issues.push(`${label}: run_id does not match ${runId}`);
}

function requireText(value: JsonObject, key: string, label: string, issues: string[]): void {
  if (!stringValue(value[key])) issues.push(`${label}: ${key} must not be empty`);
}

function validateEvidenceRef(ref: unknown, includedIds: Set<string>, label: string, issues: string[]): void {
  const value = stringValue(ref);
  if (!value) {
    issues.push(`${label}: evidence ref must not be empty`);
    return;
  }
  if (value.startsWith("session:")) {
    const match = /^session:([a-z0-9][a-z0-9._-]{0,63})#(.+)$/.exec(value);
    if (!match) issues.push(`${label}: session evidence refs require session:<id>#<bounded-locator>`);
    else if (!includedIds.has(match[1])) issues.push(`${label}: unknown included session ${match[1]}`);
    return;
  }
  const pathPart = value.split("#", 1)[0];
  if (isAbsoluteOrEscaping(pathPart)) issues.push(`${label}: evidence refs must be repo-relative or session locators`);
}

function validateStringArray(value: unknown, label: string, issues: string[], requireNonEmpty = true): string[] {
  const values = arrayValue(value);
  if (requireNonEmpty && values.length === 0) issues.push(`${label}: requires at least one entry`);
  const strings = values.map(stringValue);
  if (strings.some((item) => !item)) issues.push(`${label}: entries must be non-empty strings`);
  return strings;
}

function commandValidate(args: Args): void {
  assertAllowed(args, ["root", "run-id", "final"]);
  const root = rootFrom(args);
  const runId = one(args, "run-id");
  const final = has(args, "final");
  const artifacts = loadRunArtifacts(root, runId);
  const issues: string[] = [];
  validateSchema(artifacts.run, RUN_SCHEMA, "run.json", runId, issues);
  validateSchema(artifacts.census, CENSUS_SCHEMA, "source-census.json", runId, issues);
  validateSchema(artifacts.lineage, LINEAGE_SCHEMA, "lineage.json", runId, issues);
  validateSchema(artifacts.cast, CAST_SCHEMA, "cast.json", runId, issues);
  validateSchema(artifacts.ledger, LEDGER_SCHEMA, "evolution-ledger.json", runId, issues);
  validateSchema(artifacts.review, REVIEW_SCHEMA, "review.json", runId, issues);

  const marker = path.join(surfaceDir(root), "surface.toml");
  if (!fs.existsSync(marker)) issues.push("surface.toml: missing runtime surface marker");
  else {
    const markerText = fs.readFileSync(marker, "utf8");
    if (!markerText.includes('owner_id = "bagakit-project-chronicle"')) issues.push("surface.toml: wrong owner_id");
    if (!markerText.includes('surface_root = ".bagakit/project-chronicle"')) issues.push("surface.toml: wrong surface_root");
  }

  const scope = objectValue(artifacts.census.scope);
  requireText(scope, "statement", "source-census.json scope", issues);
  requireText(scope, "session_definition", "source-census.json scope", issues);
  const coverage = objectValue(artifacts.census.coverage);
  const sessions = arrayValue(artifacts.census.sessions);
  const sessionIds = new Set<string>();
  const sourceRefs = new Set<string>();
  const includedIds = new Set<string>();
  for (const [index, item] of sessions.entries()) {
    const session = objectValue(item);
    const label = `source-census.json sessions[${index}]`;
    const sessionId = stringValue(session.session_id);
    const sourceRef = stringValue(session.source_ref);
    const disposition = stringValue(session.disposition);
    if (!SAFE_ID.test(sessionId)) issues.push(`${label}: invalid session_id`);
    if (sessionIds.has(sessionId)) issues.push(`${label}: duplicate session_id ${sessionId}`);
    sessionIds.add(sessionId);
    if (!stringValue(session.title)) issues.push(`${label}: title must not be empty`);
    if (!SOURCE_KINDS.has(stringValue(session.source_kind))) issues.push(`${label}: invalid source_kind`);
    if (!REF_KINDS.has(stringValue(session.ref_kind))) issues.push(`${label}: invalid ref_kind`);
    if (!sourceRef) issues.push(`${label}: source_ref must not be empty`);
    if (sourceRefs.has(sourceRef)) issues.push(`${label}: duplicate source_ref ${sourceRef}`);
    sourceRefs.add(sourceRef);
    if (stringValue(session.ref_kind) === "repo-file" && isAbsoluteOrEscaping(sourceRef)) issues.push(`${label}: repo-file source_ref is not repo-relative`);
    if (!DISPOSITIONS.has(disposition)) issues.push(`${label}: invalid disposition`);
    if (disposition !== "included" && !stringValue(session.disposition_reason)) issues.push(`${label}: disposition_reason is required`);
    if (disposition === "included") includedIds.add(sessionId);
  }
  const expectedCounts = countSessions(sessions);
  const actualCounts = objectValue(coverage.counts);
  for (const key of ["discovered", "included", "excluded", "unreadable"]) {
    if (actualCounts[key] !== expectedCounts[key]) issues.push(`source-census.json: coverage count ${key} does not match registrations`);
  }

  const cards = new Map<string, JsonObject>();
  for (const sessionId of includedIds) {
    const cardFile = path.join(runDir(root, runId), "session-cards", `${sessionId}.json`);
    if (!fs.existsSync(cardFile)) {
      issues.push(`session-cards/${sessionId}.json: missing included-session card`);
      continue;
    }
    const card = readJson(cardFile);
    cards.set(sessionId, card);
    validateSchema(card, CARD_SCHEMA, `session-cards/${sessionId}.json`, runId, issues);
    if (card.session_id !== sessionId) issues.push(`session-cards/${sessionId}.json: session_id mismatch`);
    const censusSession = sessions.map(objectValue).find((item) => item.session_id === sessionId);
    if (card.source_ref !== censusSession?.source_ref) issues.push(`session-cards/${sessionId}.json: source_ref does not match census`);
    for (const forbidden of ["transcript", "raw_transcript", "messages"]) {
      if (Object.hasOwn(card, forbidden)) issues.push(`session-cards/${sessionId}.json: raw session field ${forbidden} is forbidden`);
    }
  }

  if (final) {
    const coverageStatus = stringValue(coverage.status);
    if (!COVERAGE_STATUSES.has(coverageStatus)) issues.push("source-census.json: census must be sealed as complete or partial");
    validateStringArray(coverage.adapters, "source-census.json coverage.adapters", issues);
    const gaps = validateStringArray(coverage.gaps, "source-census.json coverage.gaps", issues, coverageStatus === "partial");
    if (coverageStatus === "complete" && gaps.length > 0) issues.push("source-census.json: complete coverage may not have gaps");
    if (includedIds.size === 0) issues.push("source-census.json: final chronicle requires at least one included session");

    for (const [sessionId, card] of cards) {
      const label = `session-cards/${sessionId}.json`;
      requireText(card, "summary", label, issues);
      requireText(card, "intent", label, issues);
      validateStringArray(card.observed_outcomes, `${label} observed_outcomes`, issues);
      const spans = arrayValue(card.evidence_spans);
      if (spans.length === 0) issues.push(`${label}: evidence_spans requires at least one bounded source span`);
      for (const [index, item] of spans.entries()) {
        const span = objectValue(item);
        requireText(span, "locator", `${label} evidence_spans[${index}]`, issues);
        requireText(span, "claim", `${label} evidence_spans[${index}]`, issues);
      }
    }

    const epochs = arrayValue(artifacts.lineage.epochs);
    if (epochs.length === 0) issues.push("lineage.json: final chronicle requires at least one epoch");
    const epochCoverage = new Set<string>();
    const epochIds = new Set<string>();
    for (const [index, item] of epochs.entries()) {
      const epoch = objectValue(item);
      const label = `lineage.json epochs[${index}]`;
      for (const key of ["epoch_id", "name", "thesis", "baseline_before", "pressure", "intervention", "observed_delta", "baseline_after"]) {
        requireText(epoch, key, label, issues);
      }
      const epochId = stringValue(epoch.epoch_id);
      if (epochIds.has(epochId)) issues.push(`${label}: duplicate epoch_id ${epochId}`);
      epochIds.add(epochId);
      const members = validateStringArray(epoch.session_ids, `${label} session_ids`, issues);
      for (const member of members) {
        if (!includedIds.has(member)) issues.push(`${label}: unknown included session ${member}`);
        epochCoverage.add(member);
      }
      const evidence = validateStringArray(epoch.evidence_refs, `${label} evidence_refs`, issues);
      for (const ref of evidence) validateEvidenceRef(ref, includedIds, `${label} evidence_refs`, issues);
      validateStringArray(epoch.remaining_tensions, `${label} remaining_tensions`, issues, false);
    }
    for (const sessionId of includedIds) {
      if (!epochCoverage.has(sessionId)) issues.push(`lineage.json: included session ${sessionId} is not assigned to an epoch`);
    }
    const generationLinks = arrayValue(artifacts.lineage.generation_links);
    if (epochs.length > 1 && generationLinks.length === 0) issues.push("lineage.json: multiple epochs require at least one generation link");
    for (const [index, item] of generationLinks.entries()) {
      const link = objectValue(item);
      const label = `lineage.json generation_links[${index}]`;
      for (const key of ["from_epoch", "to_epoch", "inheritance", "mutation", "ratchet"]) requireText(link, key, label, issues);
      if (!epochIds.has(stringValue(link.from_epoch))) issues.push(`${label}: unknown from_epoch`);
      if (!epochIds.has(stringValue(link.to_epoch))) issues.push(`${label}: unknown to_epoch`);
      const evidence = validateStringArray(link.evidence_refs, `${label} evidence_refs`, issues);
      for (const ref of evidence) validateEvidenceRef(ref, includedIds, `${label} evidence_refs`, issues);
    }

    const roles = arrayValue(artifacts.cast.roles);
    if (roles.length === 0) issues.push("cast.json: final chronicle requires at least one role");
    const castCoverage = new Set<string>();
    const roleIds = new Set<string>();
    for (const [index, item] of roles.entries()) {
      const role = objectValue(item);
      const label = `cast.json roles[${index}]`;
      for (const key of ["role_id", "epithet", "function", "fit_rationale"]) requireText(role, key, label, issues);
      const roleId = stringValue(role.role_id);
      if (roleIds.has(roleId)) issues.push(`${label}: duplicate role_id ${roleId}`);
      roleIds.add(roleId);
      const members = validateStringArray(role.session_ids, `${label} session_ids`, issues);
      for (const member of members) {
        if (!includedIds.has(member)) issues.push(`${label}: unknown included session ${member}`);
        castCoverage.add(member);
      }
      const evidence = validateStringArray(role.evidence_refs, `${label} evidence_refs`, issues);
      for (const ref of evidence) validateEvidenceRef(ref, includedIds, `${label} evidence_refs`, issues);
    }
    for (const sessionId of includedIds) {
      if (!castCoverage.has(sessionId)) issues.push(`cast.json: included session ${sessionId} has no dramatic role`);
    }

    const entries = arrayValue(artifacts.ledger.entries);
    if (entries.length === 0) issues.push("evolution-ledger.json: final chronicle requires at least one insight");
    const insightIds = new Set<string>();
    for (const [index, item] of entries.entries()) {
      const entry = objectValue(item);
      const label = `evolution-ledger.json entries[${index}]`;
      requireText(entry, "insight_id", label, issues);
      const insightId = stringValue(entry.insight_id);
      if (insightIds.has(insightId)) issues.push(`${label}: duplicate insight_id ${insightId}`);
      insightIds.add(insightId);
      if (!INSIGHT_KINDS.has(stringValue(entry.kind))) issues.push(`${label}: invalid kind`);
      if (!EPISTEMIC_STATUSES.has(stringValue(entry.epistemic_status))) issues.push(`${label}: invalid epistemic_status`);
      for (const key of ["what", "why", "intended_generalization", "failure_boundary"]) requireText(entry, key, label, issues);
      validateStringArray(entry.behavior_examples, `${label} behavior_examples`, issues);
      const checks = validateStringArray(entry.transfer_checks, `${label} transfer_checks`, issues, ["reviewed", "accepted"].includes(stringValue(entry.epistemic_status)));
      if (["reviewed", "accepted"].includes(stringValue(entry.epistemic_status)) && checks.length === 0) issues.push(`${label}: reviewed or accepted insights require transfer checks`);
      const evidence = validateStringArray(entry.evidence_refs, `${label} evidence_refs`, issues);
      for (const ref of evidence) validateEvidenceRef(ref, includedIds, `${label} evidence_refs`, issues);
      const counterevidence = validateStringArray(entry.counterevidence_refs, `${label} counterevidence_refs`, issues, false);
      for (const ref of counterevidence) validateEvidenceRef(ref, includedIds, `${label} counterevidence_refs`, issues);
      if (typeof entry.confidence !== "number" || entry.confidence < 0 || entry.confidence > 1) issues.push(`${label}: confidence must be between 0 and 1`);
    }

    const chronicleFile = runFile(root, runId, "chronicle.md");
    const chronicle = fs.readFileSync(chronicleFile, "utf8");
    if (!chronicle.trim()) issues.push("chronicle.md: must not be empty");
    if (/\{\{[^}]+\}\}/.test(chronicle)) issues.push("chronicle.md: unresolved template tokens remain");

    if (artifacts.review.status !== "accepted") issues.push("review.json: status must be accepted");
    requireText(artifacts.review, "reviewer", "review.json", issues);
    requireText(artifacts.review, "reviewed_at", "review.json", issues);
    requireText(artifacts.review, "rationale", "review.json", issues);
    const gates = objectValue(artifacts.review.gates);
    for (const gate of REVIEW_GATES) {
      const record = objectValue(gates[gate]);
      if (record.status !== "pass") issues.push(`review.json: gate ${gate} must pass`);
      requireText(record, "note", `review.json gate ${gate}`, issues);
    }
  }

  if (issues.length > 0) {
    for (const issue of issues) console.error(`error: ${issue}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok: ${final ? "final" : "draft"} chronicle validation passed for ${runId}`);
}

function main(): void {
  const [command, ...raw] = process.argv.slice(2);
  if (command === "help" || command === "--help") usage(0);
  if (!command) usage();
  const args = parseArgs(raw);
  switch (command) {
    case "init": commandInit(args); break;
    case "add-session": commandAddSession(args); break;
    case "seal-census": commandSealCensus(args); break;
    case "status": commandStatus(args); break;
    case "validate": commandValidate(args); break;
    default: throw new Error(`unknown command: ${command}`);
  }
}

try {
  main();
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
