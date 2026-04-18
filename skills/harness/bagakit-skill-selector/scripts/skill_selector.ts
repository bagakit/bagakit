import fs from "node:fs";
import type { Dirent } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { parseCliArgs, readBooleanFlag, readNumberFlag, readStringFlag } from "./lib/args.ts";
import { buildCandidateSurveyData, buildCandidateSurveyReport } from "./lib/candidate_survey.ts";
import { currentLocalIsoDate, initSelectorDaily } from "./lib/daily.ts";
import {
  createProjectPreferencesDoc,
  readProjectPreferencesDoc,
  writeProjectPreferencesDoc,
} from "./lib/project_preferences.ts";
import {
  appendBenchmarkLog,
  appendCandidateResultLog,
  appendEvolverSignal,
  appendErrorPatternLog,
  appendFeedbackLog,
  appendLessonUpdateLog,
  appendRecipeLog,
  appendSearchLog,
  appendSelectionLessonLog,
  appendSkillPlan,
  appendTaskSignalLog,
  appendUsageLog,
  buildEvolverSignalContract,
  buildValidationSummary,
  createSkillUsageDoc,
  loadBagakitDrivers,
  readSkillUsageDoc,
  renderDriverPack,
  updateEvolverSignalStatuses,
  updateEvaluation,
  updateEpisodeRefs,
  updatePlanAvailability,
  updatePreflight,
  validateSkillUsage,
  writeSkillUsageDoc,
} from "./lib/skill_usage.ts";
import { buildSkillRankingData, buildSkillRankingReport } from "./lib/reports.ts";
import {
  ACTIVATION_MODES,
  CANDIDATE_RESULT_STATUSES,
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
  LESSON_UPDATE_ACTIONS,
  PLAN_CONFIDENCE,
  PLAN_AVAILABILITY,
  PLAN_KINDS,
  PLAN_STATUSES,
  PREFLIGHT_ANSWERS,
  RECIPE_STATUSES,
  SEARCH_SOURCE_SCOPES,
  SEARCH_STATUSES,
  TASK_SIGNAL_KINDS,
  TASK_STATUSES,
  USAGE_PHASES,
  USAGE_RESULTS,
  normalizePreflightDecisionToken,
  type SkillUsageDoc,
} from "./lib/model.ts";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const defaultEvolverCli = path.resolve(scriptRoot, "../../bagakit-skill-evolver/scripts/evolver.ts");

function existingFile(filePath: string): string | undefined {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : undefined;
}

function skillCliCandidates(skillId: string, relCli: string, repoRoot: string): string[] {
  return [
    path.resolve(scriptRoot, "..", "..", skillId, relCli),
    process.env.BAGAKIT_SKILLS_DIR ? path.join(process.env.BAGAKIT_SKILLS_DIR, skillId, relCli) : "",
    path.join(repoRoot, ".codex", "skills", skillId, relCli),
    process.env.CODEX_HOME ? path.join(process.env.CODEX_HOME, "skills", skillId, relCli) : "",
    process.env.HOME ? path.join(process.env.HOME, ".codex", "skills", skillId, relCli) : "",
    process.env.HOME ? path.join(process.env.HOME, ".agents", "skills", skillId, relCli) : "",
  ].filter((candidate) => candidate !== "");
}

function resolveEvolverCli(rawPath: string | undefined, repoRoot: string): string {
  if (rawPath) {
    return resolvePathFromCwd(rawPath);
  }
  for (const candidate of [defaultEvolverCli, ...skillCliCandidates("bagakit-skill-evolver", "scripts/evolver.ts", repoRoot)]) {
    const found = existingFile(candidate);
    if (found) {
      return found;
    }
  }
  throw new Error("bagakit-skill-evolver CLI is not available; install it or pass --evolver-cli");
}

function printHelp(): void {
  console.log(`bagakit skill selector

Commands:
  init --file <path> --task-id <id> --objective <text> [--owner <name>] [--force]
  preflight --file <path> --answer <yes|no|partial|pending> --decision <direct_execute|compare_then_execute|compose_then_execute|review_loop|pending> [--gap-summary <text>] [--status <task-status>]
  episode-refs --file <path> [--source-prompt-ref <path>] [--final-artifact-ref <path>] [--verification-ref <path>]
  task-signal --file <path> --signal-id <id> --kind <error|capability_gap|workflow_friction|benchmark_gap|user_preference|opportunity|stale_lesson|abstention> --summary <text> --evidence-ref <path> [--task-cluster <id>] [--confidence <low|medium|high>] [--notes <text>]
  plan --file <path> --skill-id <id> --kind <local|external|research|custom> --source <path-or-url> --why <text> --expected-impact <text> [--confidence <low|medium|high>] [--availability <available|unknown|unavailable>] [--availability-detail <text>] [--selected <true|false>] [--status <plan-status>] [--composition-role <role>] [--composition-id <id>] [--activation-mode <mode>] [--fallback-strategy <strategy>] [--rejection-reason <text>] [--expected-failure-mode <text>] [--evidence-needed <text>] [--notes <text>]
  availability --file <path> --skill-id <id> --availability <available|unknown|unavailable> [--availability-detail <text>]
  recipe --file <path> --recipe-id <id> --source <selector-recipe-path> --why <text> [--status <considered|selected|used|skipped|rejected>] [--synthesis-artifact <path>] [--notes <text>]
  usage --file <path> --skill-id <id> --phase <phase> --action <text> --result <success|partial|failed|not_used> [--evidence <text>] [--metric-hint <text>] [--attempt-key <text>] [--notes <text>]
  candidate-result --file <path> --result-id <id> --candidate-id <id> --result-status <success|partial|failed|inconclusive> --verification-ref <path> [--task-signal-id <id>] [--action-ref <ref>] [--feedback-ref <ref>] [--score <0..1>] [--cost-hint <text>] [--latency-hint <text>] [--notes <text>]
  selection-lesson --file <path> --lesson-id <id> --task-signal-kind <kind> --task-cluster <id> --candidate-id <id> --recommendation <text> --support-ref <ref> [--confidence <low|medium|high>] [--limitation <text>] [--invalidates-ref <ref>] [--notes <text>]
  lesson-update --file <path> --lesson-id <id> --action <confirm|weaken|invalidate|supersede|abstain> --target-ref <ref> --reason <text> --evidence-ref <ref> [--notes <text>]
  feedback --file <path> --skill-id <id> --channel <user|metric|self_review> --signal <positive|neutral|negative> --detail <text> [--impact-scope <text>] [--confidence <low|medium|high>]
  search --file <path> --reason <text> --query <text> [--source-scope <local|external|hybrid>] [--status <open|done|discarded>] [--notes <text>]
  benchmark --file <path> --benchmark-id <id> --metric <name> --baseline <n> --candidate <n> [--higher-is-better | --no-higher-is-better] [--notes <text>]
  error-pattern --file <path> --error-type <id> --message-pattern <text> --skill-id <id> [--resolution <text>] [--notes <text>]
  evolver-signal --file <path> --signal-id <id> --kind <decision|preference|gotcha|howto|glossary> --trigger <retry_backoff|error_pattern|failed_benchmark|negative_feedback|manual_review> --skill-id <id> --title <text> --summary <text> [--scope-hint <unset|host|upstream|split>] [--confidence <0..1>] [--status <suggested|exported|imported|dismissed>] [--topic-hint <slug>] [--attempt-key <text>] [--error-type <text>] [--occurrence-index <n>] [--evidence-ref <path>] [--notes <text>]
  evolver-export --file <path> [--output <path>] [--status <suggested|exported>] [--mark-exported]
  evolver-bridge --file <path> --root <repo-root> [--output <path>] [--status <suggested|exported>] [--evolver-cli <path>]
  skill-ranking --file <path> [--output <path>] [--json]
  candidate-survey --file <path> [--root <catalog-root>] [--preferences-file <path>] [--query <text>] [--output <path>] [--include-all] [--json]
  preferences-init --file <path> [--force]
  daily --root <repo-root> [--date <yyyy-mm-dd>] [--force] [--print-path]
  evaluate --file <path> --quality-score <n> --evidence-score <n> --feedback-score <n> --overall <pass|conditional_pass|fail|pending> --summary <text> [--status <task-status>] [--needs-feedback-confirmation <true|false>] [--needs-new-search <true|false>] [--next-search-query <text>] [--notes <text>]
  validate --file <path> [--strict]
  drivers --file <path> [--root <repo-root>] [--output <path>] [--include-unselected]
  doctor --root <repo-root> [--tasks-dir <path>] [--json] [--strict]
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

function findNearestPreferenceFile(startDir: string): string | undefined {
  let currentDir = path.resolve(startDir);
  while (true) {
    const candidate = path.join(currentDir, ".bagakit", "skill-selector", "project-preferences.toml");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(currentDir);
    if (parent === currentDir) {
      return undefined;
    }
    currentDir = parent;
  }
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

type DoctorSeverity = "warning" | "error";

interface DoctorFinding {
  severity: DoctorSeverity;
  code: string;
  task_id: string;
  file: string;
  message: string;
}

interface DoctorReport {
  schema: "bagakit.selector.doctor.v1";
  tasks_dir: string;
  total_tasks: number;
  status_counts: Record<string, number>;
  selected_skill_counts: Record<string, number>;
  usage_skill_counts: Record<string, number>;
  evidence_task_counts: {
    candidate_result: number;
    evolver_signal: number;
  };
  finding_counts: Record<DoctorSeverity, number>;
  findings: DoctorFinding[];
}

const selectorTaskLogFile = "skill-usage.toml";

function repoRelativePath(repoRoot: string, filePath: string): string {
  const relative = path.relative(repoRoot, filePath);
  if (relative === "") {
    return ".";
  }
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return `outside-root/${path.basename(filePath)}`;
  }
  return relative.split(path.sep).join("/");
}

function resolveFromRepoRoot(repoRoot: string, rawPath: string): string {
  if (path.isAbsolute(rawPath)) {
    return rawPath;
  }
  return path.resolve(repoRoot, rawPath);
}

function incrementCount(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function sortedCounts(counts: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(counts).sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (rightValue !== leftValue) {
        return rightValue - leftValue;
      }
      return leftKey.localeCompare(rightKey);
    }),
  );
}

function findSelectorTaskLogs(tasksDir: string): string[] {
  if (!fs.existsSync(tasksDir)) {
    return [];
  }

  const files: string[] = [];
  const stack = [tasksDir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const nextPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".git" || entry.name === "node_modules") {
          continue;
        }
        stack.push(nextPath);
        continue;
      }
      if (entry.isFile() && entry.name === selectorTaskLogFile) {
        files.push(nextPath);
      }
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function addDoctorFinding(
  findings: DoctorFinding[],
  severity: DoctorSeverity,
  code: string,
  taskId: string,
  file: string,
  message: string,
): void {
  findings.push({ severity, code, task_id: taskId, file, message });
}

function inspectSelectorTaskDoc(doc: SkillUsageDoc, file: string, findings: DoctorFinding[]): void {
  const selectedSkillIds = new Set(doc.skill_plan.filter((plan) => plan.selected).map((plan) => plan.skill_id));
  const usedSkillIds = new Set(doc.usage_log.map((usage) => usage.skill_id));

  if (doc.status !== "completed") {
    addDoctorFinding(findings, "warning", "open-task", doc.task_id, file, `status is ${doc.status}`);
  }
  if (doc.preflight.answer === "pending" || doc.preflight.decision === "pending") {
    addDoctorFinding(findings, "warning", "pending-preflight", doc.task_id, file, "preflight is still pending");
  }
  if (doc.evaluation.overall === "pending") {
    addDoctorFinding(findings, "warning", "pending-evaluation", doc.task_id, file, "evaluation is still pending");
  }
  if (
    doc.evaluation.quality_score === 0 &&
    doc.evaluation.evidence_score === 0 &&
    doc.evaluation.feedback_score === 0
  ) {
    addDoctorFinding(findings, "warning", "zero-evaluation", doc.task_id, file, "evaluation scores are all zero");
  }
  if (doc.skill_plan.length > 0 && doc.usage_log.length === 0) {
    addDoctorFinding(findings, "warning", "missing-usage", doc.task_id, file, "planned skills have no usage log");
  }
  if (doc.status === "completed") {
    for (const skillId of selectedSkillIds) {
      if (!usedSkillIds.has(skillId)) {
        addDoctorFinding(
          findings,
          "warning",
          "selected-without-usage",
          doc.task_id,
          file,
          `selected skill has no usage log: ${skillId}`,
        );
      }
    }
  }
  if (doc.usage_log.length > 0 && doc.candidate_result_log.length === 0) {
    addDoctorFinding(
      findings,
      "warning",
      "missing-candidate-result",
      doc.task_id,
      file,
      "usage exists but no candidate result was recorded",
    );
  }

  const hasEvolverReviewTrigger =
    doc.usage_log.some((usage) => usage.backoff_required) ||
    doc.feedback_log.some((feedback) => feedback.signal === "negative") ||
    doc.benchmark_log.some((benchmark) => !benchmark.passed) ||
    doc.error_pattern_log.length > 0;
  if (doc.evolver_handoff_policy.enabled && hasEvolverReviewTrigger && doc.evolver_signal_log.length === 0) {
    addDoctorFinding(
      findings,
      "warning",
      "missing-evolver-signal",
      doc.task_id,
      file,
      "review trigger exists but no evolver signal was recorded",
    );
  }
}

function sanitizeDoctorError(repoRoot: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split(repoRoot).join(".");
}

function buildDoctorReport(repoRoot: string, tasksDir: string, strict: boolean): DoctorReport {
  const findings: DoctorFinding[] = [];
  const statusCounts: Record<string, number> = {};
  const selectedSkillCounts: Record<string, number> = {};
  const usageSkillCounts: Record<string, number> = {};
  let candidateResultTaskCount = 0;
  let evolverSignalTaskCount = 0;

  const taskFiles = findSelectorTaskLogs(tasksDir);
  for (const taskFile of taskFiles) {
    const file = repoRelativePath(repoRoot, taskFile);
    let doc: SkillUsageDoc;
    try {
      doc = readSkillUsageDoc(taskFile);
    } catch (error) {
      addDoctorFinding(
        findings,
        "error",
        "unreadable-task-log",
        path.basename(path.dirname(taskFile)),
        file,
        sanitizeDoctorError(repoRoot, error),
      );
      continue;
    }

    incrementCount(statusCounts, doc.status);
    for (const plan of doc.skill_plan) {
      if (plan.selected) {
        incrementCount(selectedSkillCounts, plan.skill_id);
      }
    }
    for (const usage of doc.usage_log) {
      incrementCount(usageSkillCounts, usage.skill_id);
    }
    if (doc.candidate_result_log.length > 0) {
      candidateResultTaskCount += 1;
    }
    if (doc.evolver_signal_log.length > 0) {
      evolverSignalTaskCount += 1;
    }

    inspectSelectorTaskDoc(doc, file, findings);
    if (strict) {
      for (const issue of validateSkillUsage(doc, true)) {
        addDoctorFinding(findings, "error", "strict-validation", doc.task_id, file, issue);
      }
    }
  }

  const findingCounts = { warning: 0, error: 0 };
  for (const finding of findings) {
    findingCounts[finding.severity] += 1;
  }

  return {
    schema: "bagakit.selector.doctor.v1",
    tasks_dir: repoRelativePath(repoRoot, tasksDir),
    total_tasks: taskFiles.length,
    status_counts: sortedCounts(statusCounts),
    selected_skill_counts: sortedCounts(selectedSkillCounts),
    usage_skill_counts: sortedCounts(usageSkillCounts),
    evidence_task_counts: {
      candidate_result: candidateResultTaskCount,
      evolver_signal: evolverSignalTaskCount,
    },
    finding_counts: findingCounts,
    findings,
  };
}

function renderCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return "none";
  }
  return entries.map(([key, count]) => `${key}=${count}`).join(", ");
}

function renderDoctorReport(report: DoctorReport): string {
  const lines = [
    "Selector Doctor",
    `tasks_dir: ${report.tasks_dir}`,
    `total_tasks: ${report.total_tasks}`,
    `statuses: ${renderCounts(report.status_counts)}`,
    `selected_skills: ${renderCounts(report.selected_skill_counts)}`,
    `usage_skills: ${renderCounts(report.usage_skill_counts)}`,
    `evidence_tasks: candidate_result=${report.evidence_task_counts.candidate_result}, evolver_signal=${report.evidence_task_counts.evolver_signal}`,
    `findings: warning=${report.finding_counts.warning}, error=${report.finding_counts.error}`,
  ];
  if (report.findings.length === 0) {
    lines.push("ok: no selector doctor findings");
    return lines.join("\n");
  }

  for (const finding of report.findings) {
    lines.push(`- ${finding.severity} ${finding.code} ${finding.file}: ${finding.message}`);
  }
  return lines.join("\n");
}

function requiredString(flags: Map<string, string | boolean>, key: string): string {
  return readStringFlag(flags, key, true)!;
}

function readUnitScoreFlag(flags: Map<string, string | boolean>, key: string): number {
  const value = readNumberFlag(flags, key, true)!;
  if (value < 0 || value > 1) {
    throw new Error(`flag must be within [0,1]: --${key}`);
  }
  return value;
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

function cmdEpisodeRefs(flags: Map<string, string | boolean>): number {
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const doc = readSkillUsageDoc(filePath);
  updateEpisodeRefs(doc, {
    source_prompt_ref: readStringFlag(flags, "source-prompt-ref") ?? undefined,
    final_artifact_ref: readStringFlag(flags, "final-artifact-ref") ?? undefined,
    verification_ref: readStringFlag(flags, "verification-ref") ?? undefined,
  });
  writeSkillUsageDoc(filePath, doc);
  console.log(`ok: updated episode_refs in ${filePath}`);
  return 0;
}

function cmdTaskSignal(flags: Map<string, string | boolean>): number {
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const doc = readSkillUsageDoc(filePath);
  appendTaskSignalLog(doc, {
    signal_id: requiredString(flags, "signal-id"),
    kind: assertEnum(TASK_SIGNAL_KINDS, requiredString(flags, "kind"), "task_signal_log.kind"),
    summary: requiredString(flags, "summary"),
    task_cluster: readStringFlag(flags, "task-cluster") ?? "",
    evidence_ref: requiredString(flags, "evidence-ref"),
    confidence: assertEnum(PLAN_CONFIDENCE, readStringFlag(flags, "confidence") ?? "medium", "task_signal_log.confidence"),
    notes: readStringFlag(flags, "notes") ?? "",
  });
  writeSkillUsageDoc(filePath, doc);
  console.log(`ok: appended task_signal_log to ${filePath}`);
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
    availability: assertEnum(
      PLAN_AVAILABILITY,
      readStringFlag(flags, "availability") ?? "unknown",
      "skill_plan.availability",
    ),
    availability_detail: readStringFlag(flags, "availability-detail") ?? "",
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
    rejection_reason: readStringFlag(flags, "rejection-reason") ?? "",
    expected_failure_mode: readStringFlag(flags, "expected-failure-mode") ?? "",
    evidence_needed: readStringFlag(flags, "evidence-needed") ?? "",
    notes: readStringFlag(flags, "notes") ?? "",
  });
  writeSkillUsageDoc(filePath, doc);
  console.log(`ok: appended skill_plan to ${filePath}`);
  return 0;
}

function cmdCandidateResult(flags: Map<string, string | boolean>): number {
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const doc = readSkillUsageDoc(filePath);
  appendCandidateResultLog(doc, {
    result_id: requiredString(flags, "result-id"),
    candidate_id: requiredString(flags, "candidate-id"),
    task_signal_id: readStringFlag(flags, "task-signal-id") ?? "",
    action_ref: readStringFlag(flags, "action-ref") ?? "",
    result_status: assertEnum(
      CANDIDATE_RESULT_STATUSES,
      requiredString(flags, "result-status"),
      "candidate_result_log.result_status",
    ),
    verification_ref: requiredString(flags, "verification-ref"),
    feedback_ref: readStringFlag(flags, "feedback-ref") ?? "",
    score: readNumberFlag(flags, "score"),
    cost_hint: readStringFlag(flags, "cost-hint") ?? "",
    latency_hint: readStringFlag(flags, "latency-hint") ?? "",
    notes: readStringFlag(flags, "notes") ?? "",
  });
  writeSkillUsageDoc(filePath, doc);
  console.log(`ok: appended candidate_result_log to ${filePath}`);
  return 0;
}

function cmdSelectionLesson(flags: Map<string, string | boolean>): number {
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const doc = readSkillUsageDoc(filePath);
  appendSelectionLessonLog(doc, {
    lesson_id: requiredString(flags, "lesson-id"),
    task_signal_kind: assertEnum(
      TASK_SIGNAL_KINDS,
      requiredString(flags, "task-signal-kind"),
      "selection_lesson_log.task_signal_kind",
    ),
    task_cluster: requiredString(flags, "task-cluster"),
    candidate_id: requiredString(flags, "candidate-id"),
    recommendation: requiredString(flags, "recommendation"),
    confidence: assertEnum(
      PLAN_CONFIDENCE,
      readStringFlag(flags, "confidence") ?? "medium",
      "selection_lesson_log.confidence",
    ),
    support_ref: requiredString(flags, "support-ref"),
    limitation: readStringFlag(flags, "limitation") ?? "",
    invalidates_ref: readStringFlag(flags, "invalidates-ref") ?? "",
    notes: readStringFlag(flags, "notes") ?? "",
  });
  writeSkillUsageDoc(filePath, doc);
  console.log(`ok: appended selection_lesson_log to ${filePath}`);
  return 0;
}

function cmdLessonUpdate(flags: Map<string, string | boolean>): number {
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const doc = readSkillUsageDoc(filePath);
  appendLessonUpdateLog(doc, {
    lesson_id: requiredString(flags, "lesson-id"),
    action: assertEnum(LESSON_UPDATE_ACTIONS, requiredString(flags, "action"), "lesson_update_log.action"),
    target_ref: requiredString(flags, "target-ref"),
    reason: requiredString(flags, "reason"),
    evidence_ref: requiredString(flags, "evidence-ref"),
    notes: readStringFlag(flags, "notes") ?? "",
  });
  writeSkillUsageDoc(filePath, doc);
  console.log(`ok: appended lesson_update_log to ${filePath}`);
  return 0;
}

function cmdAvailability(flags: Map<string, string | boolean>): number {
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const doc = readSkillUsageDoc(filePath);
  updatePlanAvailability(doc, {
    skill_id: requiredString(flags, "skill-id"),
    availability: assertEnum(
      PLAN_AVAILABILITY,
      requiredString(flags, "availability"),
      "skill_plan.availability",
    ),
    availability_detail: readStringFlag(flags, "availability-detail") ?? "",
  });
  writeSkillUsageDoc(filePath, doc);
  console.log(`ok: updated skill_plan availability in ${filePath}`);
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
  const evolverCli = resolveEvolverCli(readStringFlag(flags, "evolver-cli") ?? undefined, repoRoot);
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
  if (readBooleanFlag(flags, "json", false)) {
    console.log(JSON.stringify(buildSkillRankingData(doc), null, 2));
    return 0;
  }
  const outputPath = resolvePathFromCwd(
    readStringFlag(flags, "output") ?? path.join(path.dirname(filePath), "skill-ranking.md"),
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buildSkillRankingReport(doc), "utf-8");
  console.log(`ok: wrote skill ranking report to ${outputPath}`);
  return 0;
}

function resolvePreferenceFilePath(taskFilePath: string, rawPreferenceFile?: string): string | undefined {
  if (rawPreferenceFile) {
    const explicitPath = resolvePathFromCwd(rawPreferenceFile);
    return fs.existsSync(explicitPath) ? explicitPath : undefined;
  }
  return findNearestPreferenceFile(path.dirname(taskFilePath));
}

function cmdCandidateSurvey(flags: Map<string, string | boolean>): number {
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const catalogRoot = resolvePathFromCwd(readStringFlag(flags, "root") ?? ".");
  const preferenceFilePath = resolvePreferenceFilePath(filePath, readStringFlag(flags, "preferences-file") ?? undefined);
  const preferenceDoc = preferenceFilePath ? readProjectPreferencesDoc(preferenceFilePath) : undefined;
  const doc = readSkillUsageDoc(filePath);
  const options = {
    catalogRoot,
    query: readStringFlag(flags, "query") ?? undefined,
    includeAll: readBooleanFlag(flags, "include-all", false),
    preferenceDoc,
    preferenceFilePath,
  };
  if (readBooleanFlag(flags, "json", false)) {
    console.log(JSON.stringify(buildCandidateSurveyData(doc, options), null, 2));
    return 0;
  }
  const outputPath = resolvePathFromCwd(
    readStringFlag(flags, "output") ?? path.join(path.dirname(filePath), "candidate-survey.md"),
  );
  const rendered = buildCandidateSurveyReport(doc, options);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, rendered, "utf-8");
  console.log(`ok: wrote candidate survey report to ${outputPath}`);
  return 0;
}

function cmdPreferencesInit(flags: Map<string, string | boolean>): number {
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const force = readBooleanFlag(flags, "force", false);
  if (fs.existsSync(filePath) && !force) {
    throw new Error(`file already exists: ${filePath}. use --force to overwrite`);
  }
  writeProjectPreferencesDoc(filePath, createProjectPreferencesDoc());
  console.log(`ok: initialized ${filePath}`);
  return 0;
}

function cmdDaily(flags: Map<string, string | boolean>): number {
  const repoRoot = resolvePathFromCwd(requiredString(flags, "root"));
  const result = initSelectorDaily(
    repoRoot,
    readStringFlag(flags, "date") ?? currentLocalIsoDate(),
    readBooleanFlag(flags, "force", false),
  );
  const relativePath = path.relative(repoRoot, result.dailyPath).split(path.sep).join("/");
  if (readBooleanFlag(flags, "print-path", false)) {
    console.log(relativePath);
    return 0;
  }
  console.log(`ok: selector daily ready ${relativePath}`);
  if (result.updatedExclude) {
    console.log("ok: updated local git exclude for private selector daily notes");
  } else if (result.excludeSkipped) {
    console.log("warn: skipped local git exclude update because .git/info/exclude is unavailable");
  }
  return 0;
}

function cmdEvaluate(flags: Map<string, string | boolean>): number {
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const doc = readSkillUsageDoc(filePath);
  updateEvaluation(doc, {
    quality_score: readUnitScoreFlag(flags, "quality-score"),
    evidence_score: readUnitScoreFlag(flags, "evidence-score"),
    feedback_score: readUnitScoreFlag(flags, "feedback-score"),
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

function cmdDoctor(flags: Map<string, string | boolean>): number {
  const repoRoot = resolvePathFromCwd(requiredString(flags, "root"));
  const tasksDir = resolveFromRepoRoot(
    repoRoot,
    readStringFlag(flags, "tasks-dir") ?? ".bagakit/skill-selector/tasks",
  );
  const strict = readBooleanFlag(flags, "strict", false);
  const report = buildDoctorReport(repoRoot, tasksDir, strict);
  if (readBooleanFlag(flags, "json", false)) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderDoctorReport(report));
  }
  if (report.finding_counts.error > 0 || (strict && report.findings.length > 0)) {
    return 1;
  }
  return 0;
}

function cmdDrivers(flags: Map<string, string | boolean>): number {
  const filePath = resolvePathFromCwd(requiredString(flags, "file"));
  const repoRoot = resolvePathFromCwd(readStringFlag(flags, "root") ?? ".");
  const output = readStringFlag(flags, "output");
  const doc = readSkillUsageDoc(filePath);
  const drivers = loadBagakitDrivers(repoRoot, doc, readBooleanFlag(flags, "include-unselected", false));
  const rendered = renderDriverPack(requiredString(flags, "file"), drivers);
  if (output) {
    const outputPath = resolvePathFromCwd(output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${rendered}\n`, "utf-8");
    console.log(`ok: wrote Bagakit driver pack to ${outputPath}`);
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
    case "episode-refs":
      return cmdEpisodeRefs(flags);
    case "task-signal":
      return cmdTaskSignal(flags);
    case "plan":
      return cmdPlan(flags);
    case "availability":
      return cmdAvailability(flags);
    case "recipe":
      return cmdRecipe(flags);
    case "usage":
      return cmdUsage(flags);
    case "candidate-result":
      return cmdCandidateResult(flags);
    case "selection-lesson":
      return cmdSelectionLesson(flags);
    case "lesson-update":
      return cmdLessonUpdate(flags);
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
    case "candidate-survey":
      return cmdCandidateSurvey(flags);
    case "preferences-init":
      return cmdPreferencesInit(flags);
    case "daily":
      return cmdDaily(flags);
    case "evaluate":
      return cmdEvaluate(flags);
    case "validate":
      return cmdValidate(flags);
    case "drivers":
      return cmdDrivers(flags);
    case "doctor":
      return cmdDoctor(flags);
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
