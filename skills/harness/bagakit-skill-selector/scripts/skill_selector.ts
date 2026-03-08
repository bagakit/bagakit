import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { parseCliArgs, readBooleanFlag, readNumberFlag, readStringFlag } from "./lib/args.ts";
import {
  appendBenchmarkLog,
  appendEvolverSignal,
  appendErrorPatternLog,
  appendFeedbackLog,
  appendRecipeLog,
  appendSearchLog,
  appendSkillPlan,
  appendUsageLog,
  buildEvolverSignalContract,
  buildValidationSummary,
  createSkillUsageDoc,
  loadSelectorDrivers,
  readSkillUsageDoc,
  renderDriverPack,
  updateEvolverSignalStatuses,
  updateEvaluation,
  updatePreflight,
  validateSkillUsage,
  writeSkillUsageDoc,
} from "./lib/skill_usage.ts";
import { buildSkillRankingReport } from "./lib/reports.ts";
import {
  ACTIVATION_MODES,
  COMPOSITION_ROLES,
  EVALUATION_OVERALL,
  EVOLVER_SCOPE_HINTS,
  EVOLVER_BRIDGEABLE_SIGNAL_STATUSES,
  EVOLVER_SIGNAL_KINDS,
  EVOLVER_SIGNAL_STATUSES,
  EVOLVER_SIGNAL_TRIGGERS,
  FALLBACK_STRATEGIES,
  FEEDBACK_CHANNELS,
  FEEDBACK_SIGNALS,
  PLAN_CONFIDENCE,
  PLAN_KINDS,
  PLAN_STATUSES,
  PREFLIGHT_ANSWERS,
  RECIPE_STATUSES,
  SEARCH_SOURCE_SCOPES,
  SEARCH_STATUSES,
  TASK_STATUSES,
  USAGE_PHASES,
  USAGE_RESULTS,
  normalizePreflightDecisionToken,
} from "./lib/model.ts";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const defaultEvolverCli = path.resolve(scriptRoot, "../../bagakit-skill-evolver/scripts/evolver.ts");

function printHelp(): void {
  console.log(`bagakit skill selector

Commands:
  init --file <path> --task-id <id> --objective <text> [--owner <name>] [--force]
  preflight --file <path> --answer <yes|no|partial|pending> --decision <direct_execute|compare_then_execute|compose_then_execute|review_loop|pending> [--gap-summary <text>] [--status <task-status>]
  plan --file <path> --skill-id <id> --kind <local|external|research|custom> --source <path-or-url> --why <text> --expected-impact <text> [--confidence <low|medium|high>] [--selected <true|false>] [--status <plan-status>] [--composition-role <role>] [--composition-id <id>] [--activation-mode <mode>] [--fallback-strategy <strategy>] [--notes <text>]
  recipe --file <path> --recipe-id <id> --source <selector-recipe-path> --why <text> [--status <considered|selected|used|skipped|rejected>] [--notes <text>]
  usage --file <path> --skill-id <id> --phase <phase> --action <text> --result <success|partial|failed|not_used> [--evidence <text>] [--metric-hint <text>] [--attempt-key <text>] [--notes <text>]
  feedback --file <path> --skill-id <id> --channel <user|metric|self_review> --signal <positive|neutral|negative> --detail <text> [--impact-scope <text>] [--confidence <low|medium|high>]
  search --file <path> --reason <text> --query <text> [--source-scope <local|external|hybrid>] [--status <open|done|discarded>] [--notes <text>]
  benchmark --file <path> --benchmark-id <id> --metric <name> --baseline <n> --candidate <n> [--higher-is-better | --no-higher-is-better] [--notes <text>]
  error-pattern --file <path> --error-type <id> --message-pattern <text> --skill-id <id> [--resolution <text>] [--notes <text>]
  evolver-signal --file <path> --signal-id <id> --kind <decision|preference|gotcha|howto|glossary> --trigger <retry_backoff|error_pattern|failed_benchmark|negative_feedback|manual_review> --skill-id <id> --title <text> --summary <text> [--scope-hint <unset|host|upstream|split>] [--confidence <0..1>] [--status <suggested|exported|imported|dismissed>] [--topic-hint <slug>] [--attempt-key <text>] [--error-type <text>] [--occurrence-index <n>] [--evidence-ref <path>] [--notes <text>]
  evolver-export --file <path> [--output <path>] [--status <suggested|exported>] [--mark-exported]
  evolver-bridge --file <path> --root <repo-root> [--output <path>] [--status <suggested|exported>] [--evolver-cli <path>]
  skill-ranking --file <path> [--output <path>]
  evaluate --file <path> --quality-score <n> --evidence-score <n> --feedback-score <n> --overall <pass|conditional_pass|fail|pending> --summary <text> [--status <task-status>] [--needs-feedback-confirmation <true|false>] [--needs-new-search <true|false>] [--next-search-query <text>] [--notes <text>]
  validate --file <path> [--strict]
  drivers --file <path> [--root <repo-root>] [--output <path>] [--include-unselected]
`);
}

function assertEnum<const T extends readonly string[]>(values: T, raw: string, label: string): T[number] {
  if (values.includes(raw)) {
    return raw as T[number];
  }
  throw new Error(`invalid ${label}: ${raw}`);
}

function resolvePathFromCwd(rawPath: string): string {
  return path.resolve(process.cwd(), rawPath);
}

function selectorRepoRootFromTaskFile(filePath: string): string {
  return path.resolve(path.dirname(filePath), "../../../../");
}

function normalizeTaskArtifactRef(filePath: string, rawPath: string): string {
  const repoRoot = selectorRepoRootFromTaskFile(filePath);
  const absolute = path.resolve(repoRoot, rawPath);
  const relative = path.relative(repoRoot, absolute);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return relative.split(path.sep).join("/");
  }
  throw new Error(`evidence ref escapes selector repo root: ${rawPath}`);
}

function requiredString(flags: Map<string, string | boolean>, key: string): string {
  return readStringFlag(flags, key, true)!;
}

function cmdInit(flags: Map<string, string | boolean>): number {
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const force = readBooleanFlag(flags, "force", false);
  if (fs.existsSync(filePath) && !force) {
    throw new Error(`file already exists: ${filePath}. use --force to overwrite`);
  }
  const doc = createSkillUsageDoc(
    requiredString(flags, "task-id"),
    requiredString(flags, "objective"),
    readStringFlag(flags, "owner") ?? "",
  );
  writeSkillUsageDoc(filePath, doc);
  console.log(`ok: initialized ${filePath}`);
  return 0;
}

function cmdPreflight(flags: Map<string, string | boolean>): number {
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const doc = readSkillUsageDoc(filePath);
  updatePreflight(doc, {
    answer: assertEnum(PREFLIGHT_ANSWERS, requiredString(flags, "answer"), "preflight.answer"),
    gap_summary: readStringFlag(flags, "gap-summary") ?? "",
    decision: normalizePreflightDecisionToken(requiredString(flags, "decision")),
    status: assertEnum(TASK_STATUSES, readStringFlag(flags, "status") ?? "in_progress", "status"),
  });
  writeSkillUsageDoc(filePath, doc);
  console.log(`ok: updated preflight in ${filePath}`);
  return 0;
}

function cmdPlan(flags: Map<string, string | boolean>): number {
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const doc = readSkillUsageDoc(filePath);
  appendSkillPlan(doc, {
    skill_id: requiredString(flags, "skill-id"),
    kind: assertEnum(PLAN_KINDS, requiredString(flags, "kind"), "skill_plan.kind"),
    source: requiredString(flags, "source"),
    why: requiredString(flags, "why"),
    expected_impact: requiredString(flags, "expected-impact"),
    confidence: assertEnum(PLAN_CONFIDENCE, readStringFlag(flags, "confidence") ?? "medium", "skill_plan.confidence"),
    selected: readBooleanFlag(flags, "selected", true),
    status: assertEnum(PLAN_STATUSES, readStringFlag(flags, "status") ?? "planned", "skill_plan.status"),
    composition_role: assertEnum(
      COMPOSITION_ROLES,
      readStringFlag(flags, "composition-role") ?? "standalone",
      "skill_plan.composition_role",
    ),
    composition_id: readStringFlag(flags, "composition-id") ?? "",
    activation_mode: assertEnum(
      ACTIVATION_MODES,
      readStringFlag(flags, "activation-mode") ?? "standalone",
      "skill_plan.activation_mode",
    ),
    fallback_strategy: readStringFlag(flags, "fallback-strategy") ?? "none",
    notes: readStringFlag(flags, "notes") ?? "",
  });
  writeSkillUsageDoc(filePath, doc);
  console.log(`ok: appended skill_plan to ${filePath}`);
  return 0;
}

function cmdRecipe(flags: Map<string, string | boolean>): number {
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const doc = readSkillUsageDoc(filePath);
  appendRecipeLog(doc, {
    recipe_id: requiredString(flags, "recipe-id"),
    source: requiredString(flags, "source"),
    why: requiredString(flags, "why"),
    status: assertEnum(RECIPE_STATUSES, readStringFlag(flags, "status") ?? "selected", "recipe_log.status"),
    synthesis_artifact: readStringFlag(flags, "synthesis-artifact"),
    notes: readStringFlag(flags, "notes") ?? "",
  });
  writeSkillUsageDoc(filePath, doc);
  console.log(`ok: appended recipe_log to ${filePath}`);
  return 0;
}

function cmdUsage(flags: Map<string, string | boolean>): number {
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const doc = readSkillUsageDoc(filePath);
  const messages = appendUsageLog(doc, {
    skill_id: requiredString(flags, "skill-id"),
    phase: assertEnum(USAGE_PHASES, requiredString(flags, "phase"), "usage_log.phase"),
    action: requiredString(flags, "action"),
    result: assertEnum(USAGE_RESULTS, requiredString(flags, "result"), "usage_log.result"),
    evidence: readStringFlag(flags, "evidence") ?? "",
    metric_hint: readStringFlag(flags, "metric-hint") ?? "",
    attempt_key: readStringFlag(flags, "attempt-key") ?? "",
    notes: readStringFlag(flags, "notes") ?? "",
  });
  writeSkillUsageDoc(filePath, doc);
  for (const message of messages) {
    console.log(message);
  }
  console.log(`ok: appended usage_log to ${filePath}`);
  return 0;
}

function cmdFeedback(flags: Map<string, string | boolean>): number {
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const doc = readSkillUsageDoc(filePath);
  appendFeedbackLog(doc, {
    skill_id: requiredString(flags, "skill-id"),
    channel: assertEnum(FEEDBACK_CHANNELS, requiredString(flags, "channel"), "feedback_log.channel"),
    signal: assertEnum(FEEDBACK_SIGNALS, requiredString(flags, "signal"), "feedback_log.signal"),
    detail: requiredString(flags, "detail"),
    impact_scope: readStringFlag(flags, "impact-scope") ?? "",
    confidence: assertEnum(
      PLAN_CONFIDENCE,
      readStringFlag(flags, "confidence") ?? "medium",
      "feedback_log.confidence",
    ),
  });
  writeSkillUsageDoc(filePath, doc);
  console.log(`ok: appended feedback_log to ${filePath}`);
  return 0;
}

function cmdSearch(flags: Map<string, string | boolean>): number {
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const doc = readSkillUsageDoc(filePath);
  appendSearchLog(doc, {
    reason: requiredString(flags, "reason"),
    query: requiredString(flags, "query"),
    source_scope: assertEnum(
      SEARCH_SOURCE_SCOPES,
      readStringFlag(flags, "source-scope") ?? "hybrid",
      "search_log.source_scope",
    ),
    status: assertEnum(SEARCH_STATUSES, readStringFlag(flags, "status") ?? "open", "search_log.status"),
    notes: readStringFlag(flags, "notes") ?? "",
  });
  writeSkillUsageDoc(filePath, doc);
  console.log(`ok: appended search_log to ${filePath}`);
  return 0;
}

function cmdBenchmark(flags: Map<string, string | boolean>): number {
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const doc = readSkillUsageDoc(filePath);
  const { passed, delta } = appendBenchmarkLog(doc, {
    benchmark_id: requiredString(flags, "benchmark-id"),
    metric: requiredString(flags, "metric"),
    baseline: readNumberFlag(flags, "baseline", true)!,
    candidate: readNumberFlag(flags, "candidate", true)!,
    higher_is_better: readBooleanFlag(flags, "higher-is-better", true),
    notes: readStringFlag(flags, "notes") ?? "",
  });
  writeSkillUsageDoc(filePath, doc);
  console.log(`ok: appended benchmark_log to ${filePath} (${passed ? "pass" : "fail"}, delta=${delta})`);
  return 0;
}

function cmdErrorPattern(flags: Map<string, string | boolean>): number {
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const doc = readSkillUsageDoc(filePath);
  const { occurrenceIndex } = appendErrorPatternLog(doc, {
    error_type: requiredString(flags, "error-type"),
    message_pattern: requiredString(flags, "message-pattern"),
    skill_id: requiredString(flags, "skill-id"),
    resolution: readStringFlag(flags, "resolution") ?? "",
    notes: readStringFlag(flags, "notes") ?? "",
  });
  writeSkillUsageDoc(filePath, doc);
  console.log(`ok: appended error_pattern_log to ${filePath} (occurrence=${occurrenceIndex})`);
  return 0;
}

function resolveEvolverOutputPath(filePath: string, rawOutput?: string): string {
  return resolvePathFromCwd(rawOutput ?? path.join(path.dirname(filePath), "evolver-signals.json"));
}

function readEvolverBridgeableStatuses(
  flags: Map<string, string | boolean>,
): (typeof EVOLVER_BRIDGEABLE_SIGNAL_STATUSES)[number][] {
  return [
    assertEnum(
      EVOLVER_BRIDGEABLE_SIGNAL_STATUSES,
      readStringFlag(flags, "status") ?? "suggested",
      "evolver bridgeable signal status",
    ),
  ];
}

function ensureSignalsPresent(
  contract: ReturnType<typeof buildEvolverSignalContract>,
  sourceLabel: string,
): void {
  if (contract.signals.length === 0) {
    throw new Error(`no evolver review signals matched ${sourceLabel}`);
  }
}

function selectedEvolverSignalIds(
  doc: ReturnType<typeof readSkillUsageDoc>,
  statuses: readonly (typeof EVOLVER_SIGNAL_STATUSES)[number][],
): string[] {
  return doc.evolver_signal_log
    .filter((entry) => statuses.includes(entry.status))
    .map((entry) => entry.signal_id);
}

function cmdEvolverSignal(flags: Map<string, string | boolean>): number {
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const doc = readSkillUsageDoc(filePath);
  appendEvolverSignal(doc, {
    signal_id: requiredString(flags, "signal-id"),
    kind: assertEnum(EVOLVER_SIGNAL_KINDS, requiredString(flags, "kind"), "evolver_signal_log.kind"),
    trigger: assertEnum(EVOLVER_SIGNAL_TRIGGERS, requiredString(flags, "trigger"), "evolver_signal_log.trigger"),
    skill_id: requiredString(flags, "skill-id"),
    scope_hint: assertEnum(
      EVOLVER_SCOPE_HINTS,
      readStringFlag(flags, "scope-hint") ?? "unset",
      "evolver_signal_log.scope_hint",
    ),
    title: requiredString(flags, "title"),
    summary: requiredString(flags, "summary"),
    confidence: readNumberFlag(flags, "confidence") ?? 0.5,
    status: assertEnum(
      EVOLVER_SIGNAL_STATUSES,
      readStringFlag(flags, "status") ?? "suggested",
      "evolver_signal_log.status",
    ),
    topic_hint: readStringFlag(flags, "topic-hint") ?? undefined,
    attempt_key: readStringFlag(flags, "attempt-key") ?? undefined,
    error_type: readStringFlag(flags, "error-type") ?? undefined,
    occurrence_index: readNumberFlag(flags, "occurrence-index") ?? 1,
    evidence_ref: readStringFlag(flags, "evidence-ref")
      ? normalizeTaskArtifactRef(filePath, readStringFlag(flags, "evidence-ref")!)
      : undefined,
    notes: readStringFlag(flags, "notes") ?? "",
  });
  writeSkillUsageDoc(filePath, doc);
  console.log(`ok: upserted evolver_signal_log in ${filePath}`);
  return 0;
}

function cmdEvolverExport(flags: Map<string, string | boolean>): number {
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const doc = readSkillUsageDoc(filePath);
  const outputPath = resolveEvolverOutputPath(filePath, readStringFlag(flags, "output") ?? undefined);
  const statuses = readEvolverBridgeableStatuses(flags);
  const signalIds = selectedEvolverSignalIds(doc, statuses);
  const contract = buildEvolverSignalContract(doc, filePath, { statuses });
  ensureSignalsPresent(contract, `status=${statuses.join(",")}`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(contract, null, 2) + "\n", "utf-8");
  if (readBooleanFlag(flags, "mark-exported", false)) {
    updateEvolverSignalStatuses(doc, signalIds, "exported");
    writeSkillUsageDoc(filePath, doc);
  }
  console.log(`ok: exported evolver signals to ${outputPath}`);
  return 0;
}

function cmdEvolverBridge(flags: Map<string, string | boolean>): number {
  const repoRoot = resolvePathFromCwd(requiredString(flags, "root"));
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const outputPath = resolveEvolverOutputPath(filePath, readStringFlag(flags, "output") ?? undefined);
  const evolverCli = resolvePathFromCwd(readStringFlag(flags, "evolver-cli") ?? defaultEvolverCli);
  const doc = readSkillUsageDoc(filePath);
  const statuses = readEvolverBridgeableStatuses(flags);
  const signalIds = selectedEvolverSignalIds(doc, statuses);
  const contract = buildEvolverSignalContract(doc, filePath, { statuses });
  ensureSignalsPresent(contract, `status=${statuses.join(",")}`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(contract, null, 2) + "\n", "utf-8");

  const bridgeResult = spawnSync(
    "node",
    ["--experimental-strip-types", evolverCli, "bridge-signals", "--contract", outputPath, "--root", repoRoot],
    { encoding: "utf8" },
  );
  if ((bridgeResult.status ?? 1) !== 0) {
    throw new Error(bridgeResult.stderr.trim() || bridgeResult.stdout.trim() || "evolver bridge-signals failed");
  }

  updateEvolverSignalStatuses(doc, signalIds, "imported");
  writeSkillUsageDoc(filePath, doc);
  console.log("ok: bridged evolver signals into evolver intake (.mem_inbox)");
  return 0;
}

function cmdSkillRanking(flags: Map<string, string | boolean>): number {
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const doc = readSkillUsageDoc(filePath);
  const outputPath = resolvePathFromCwd(
    readStringFlag(flags, "output") ?? path.join(path.dirname(filePath), "skill-ranking.md"),
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buildSkillRankingReport(doc), "utf-8");
  console.log(`ok: wrote skill ranking report to ${outputPath}`);
  return 0;
}

function cmdEvaluate(flags: Map<string, string | boolean>): number {
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const doc = readSkillUsageDoc(filePath);
  updateEvaluation(doc, {
    quality_score: readNumberFlag(flags, "quality-score", true)!,
    evidence_score: readNumberFlag(flags, "evidence-score", true)!,
    feedback_score: readNumberFlag(flags, "feedback-score", true)!,
    overall: assertEnum(EVALUATION_OVERALL, requiredString(flags, "overall"), "evaluation.overall"),
    summary: requiredString(flags, "summary"),
    status: readStringFlag(flags, "status")
      ? assertEnum(TASK_STATUSES, readStringFlag(flags, "status")!, "status")
      : undefined,
    needs_feedback_confirmation: flags.has("needs-feedback-confirmation")
      ? readBooleanFlag(flags, "needs-feedback-confirmation")
      : undefined,
    needs_new_search: flags.has("needs-new-search") ? readBooleanFlag(flags, "needs-new-search") : undefined,
    next_search_query: readStringFlag(flags, "next-search-query"),
    notes: readStringFlag(flags, "notes"),
  });
  writeSkillUsageDoc(filePath, doc);
  console.log(`ok: updated evaluation in ${filePath}`);
  return 0;
}

function cmdValidate(flags: Map<string, string | boolean>): number {
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const doc = readSkillUsageDoc(filePath);
  const issues = validateSkillUsage(doc, readBooleanFlag(flags, "strict", false));
  console.log(buildValidationSummary(doc));
  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`issue: ${issue}`);
    }
    console.error(`fail: validation failed for ${filePath}`);
    return 1;
  }
  console.log(`ok: validation passed for ${filePath}`);
  return 0;
}

function cmdDrivers(flags: Map<string, string | boolean>): number {
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const repoRoot = resolvePathFromCwd(readStringFlag(flags, "root") ?? ".");
  const output = readStringFlag(flags, "output");
  const doc = readSkillUsageDoc(filePath);
  const drivers = loadSelectorDrivers(repoRoot, doc, readBooleanFlag(flags, "include-unselected", false));
  const rendered = renderDriverPack(requiredString(flags, "file"), drivers);
  if (output) {
    const outputPath = resolvePathFromCwd(output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${rendered}\n`, "utf-8");
    console.log(`ok: wrote selector driver pack to ${outputPath}`);
    return 0;
  }
  console.log(rendered);
  return 0;
}

function main(argv: string[]): number {
  const { command, flags } = parseCliArgs(argv);
  switch (command) {
    case "help":
    case "--help":
    case "-h":
      printHelp();
      return 0;
    case "init":
      return cmdInit(flags);
    case "preflight":
      return cmdPreflight(flags);
    case "plan":
      return cmdPlan(flags);
    case "recipe":
      return cmdRecipe(flags);
    case "usage":
      return cmdUsage(flags);
    case "feedback":
      return cmdFeedback(flags);
    case "search":
      return cmdSearch(flags);
    case "benchmark":
      return cmdBenchmark(flags);
    case "error-pattern":
      return cmdErrorPattern(flags);
    case "evolver-signal":
      return cmdEvolverSignal(flags);
    case "evolver-export":
      return cmdEvolverExport(flags);
    case "evolver-bridge":
      return cmdEvolverBridge(flags);
    case "skill-ranking":
      return cmdSkillRanking(flags);
    case "evaluate":
      return cmdEvaluate(flags);
    case "validate":
      return cmdValidate(flags);
    case "drivers":
      return cmdDrivers(flags);
    default:
      throw new Error(`unknown command: ${command}`);
  }
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
