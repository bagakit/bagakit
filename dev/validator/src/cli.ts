import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

import { loadProject } from "./lib/loader.ts";
import type { LoadedProject, SuiteConfig, ValidationClass } from "./lib/model.ts";
import { VALIDATION_CLASSES } from "./lib/model.ts";
import { describeProcessSuite, hasProcessRunner, runFileSystemSuite, runProcessSuite, validateProcessSuiteShape } from "./lib/runners.ts";
import { filterSuites, resolveSelectorList, validateSkipAliases } from "./lib/selection.ts";
import { elapsedMs, nowTick, renderTimingSummary, suiteTimingRecord, type SuiteRunOutcome } from "./lib/timing.ts";

const defaultRoot = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const defaultConfig = "gate_validation/validation.toml";
const auditFileExtensions = new Set([".cjs", ".js", ".mjs", ".mts", ".py", ".sh", ".toml", ".ts", ".tsx"]);
const auditSkipDirs = new Set([
  ".git",
  ".pytest_cache",
  "__pycache__",
  "dist",
  "node_modules",
  "results",
]);
const stringMatchSignals = [
  new RegExp(String.raw`\bgrep\b.*\s-q\b`),
  new RegExp(String.raw`\brg\b.*\s-q\b`),
  new RegExp(String.raw`\.includes\s*\(`),
  new RegExp(String.raw`\bcontains\b`),
  new RegExp(String.raw`\bnot_contains\b`),
];
const scenarioSignals = [
  new RegExp(String.raw`\bcase(s)?\b`, "i"),
  new RegExp(String.raw`\bexpected\b`, "i"),
  new RegExp(String.raw`\bfixture(s)?\b`, "i"),
  new RegExp(String.raw`\bgrader(s)?\b`, "i"),
  new RegExp(String.raw`\bscenario(s)?\b`, "i"),
  new RegExp(String.raw`\btrace(s)?\b`, "i"),
  new RegExp(String.raw`\btranscript(s)?\b`, "i"),
];

interface AuditFileSignal {
  relativePath: string;
  lines: number;
  stringMatches: number;
  scenarioTerms: number;
}

interface SuiteAuditSignal {
  suite: SuiteConfig;
  files: AuditFileSignal[];
  stringMatches: number;
  scenarioTerms: number;
}

function hasProofTriple(suite: SuiteConfig): boolean {
  return suite.protects.length > 0 && suite.oracle.length > 0 && suite.exercisedSurface.length > 0;
}

function hasGenericProofTriple(suite: SuiteConfig): boolean {
  const joined = [...suite.protects, ...suite.oracle, ...suite.exercisedSurface].join("\n").toLowerCase();
  return (
    joined.includes("configured runner exit status plus suite-owned assertions") ||
    joined.includes("registered validation suite and its runner inputs") ||
    joined.includes("protected boundary:")
  );
}

function printHelp(): void {
  console.log(`bagakit validator

Commands:
  check-config [--root <repo-root>] [--config <path>]
  list [--root <repo-root>] [--config <path>] [--default-only] [--group <name>] [--validation-class <label>]
  plan [--root <repo-root>] [--config <path>] [--group <name>] [--validation-class <label>] [--skip-suite <id>] [--skip-group <name>] [--skip-alias <id>]
  audit [--root <repo-root>] [--config <path>]
  run-default [--root <repo-root>] [--config <path>] [--group <name>] [--validation-class <label>] [--skip-suite <id>] [--skip-group <name>] [--skip-alias <id>] [--fail-fast]
  run-suite <suite-id> [--root <repo-root>] [--config <path>] [--param <name>]
`);
}

function commonOptions() {
  return {
    root: { type: "string" as const, default: defaultRoot },
    config: { type: "string" as const, default: defaultConfig },
  };
}

function filterOptions() {
  return {
    group: { type: "string" as const, multiple: true, default: [] },
    "validation-class": { type: "string" as const, multiple: true, default: [] },
  };
}

function loadFrom(values: { root: string; config: string }): LoadedProject {
  return loadProject(values.root, values.config);
}

function suiteById(project: LoadedProject, suiteId: string): SuiteConfig {
  const suite = project.suitesById.get(suiteId);
  if (!suite) {
    throw new Error(`unknown suite id: ${suiteId}`);
  }
  return suite;
}

function normalizeValidationClasses(rawValues: string[]): ValidationClass[] {
  const labels = [...new Set(rawValues)];
  for (const label of labels) {
    if (!VALIDATION_CLASSES.includes(label as ValidationClass)) {
      throw new Error(
        `unknown validation class ${JSON.stringify(label)} (expected one of ${VALIDATION_CLASSES.join(", ")})`,
      );
    }
  }
  return labels as ValidationClass[];
}

function selectedSuites(
  project: LoadedProject,
  values: {
    group?: string[];
    "validation-class"?: string[];
  },
  defaultOnly = false,
): SuiteConfig[] {
  return filterSuites(project, {
    defaultOnly,
    groups: values.group ?? [],
    validationClasses: normalizeValidationClasses(values["validation-class"] ?? []),
  });
}

function checkConfig(project: LoadedProject, suites: SuiteConfig[] = project.suites): void {
  validateSkipAliases(project);
  for (const suite of suites) {
    if (hasProcessRunner(suite)) {
      validateProcessSuiteShape(suite, project.repoRoot);
    }
  }
}

function suiteSummary(suite: SuiteConfig): string {
  const groups = suite.groups.length > 0 ? suite.groups.join(",") : "-";
  const defaultMark = suite.defaultInGate ? "default" : "optional";
  return `${suite.id}\t[${suite.runner.kind}]\t${suite.validationClass}\t${defaultMark}\t${groups}\t${suite.owner}\t${suite.description}`;
}

function repoRelative(project: LoadedProject, absolutePath: string): string {
  return path.relative(project.repoRoot, absolutePath).split(path.sep).join("/") || ".";
}

function incrementCount(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function renderCounts(counts: Map<string, number>): string[] {
  return [...counts.entries()]
    .sort(([leftKey, leftCount], [rightKey, rightCount]) => rightCount - leftCount || leftKey.localeCompare(rightKey))
    .map(([key, count]) => `- ${key}: ${count}`);
}

function walkAuditFiles(dirPath: string): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
  const found: string[] = [];

  for (const fileName of files) {
    if (auditFileExtensions.has(path.extname(fileName))) {
      found.push(path.join(dirPath, fileName));
    }
  }
  for (const dirName of dirs) {
    if (auditSkipDirs.has(dirName)) {
      continue;
    }
    found.push(...walkAuditFiles(path.join(dirPath, dirName)));
  }
  return found;
}

function countLineSignals(lines: string[], patterns: RegExp[]): number {
  let count = 0;
  for (const line of lines) {
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        count += 1;
      }
    }
  }
  return count;
}

function auditFileSignals(project: LoadedProject): AuditFileSignal[] {
  const absoluteRoots = [...new Set(project.discoveryRoots.map((root) => path.resolve(project.repoRoot, root)))];
  const filePaths = [...new Set(absoluteRoots.flatMap((root) => walkAuditFiles(root)))].sort();
  return filePaths.map((filePath) => {
    const contents = fs.readFileSync(filePath, "utf8");
    const lines = contents.length === 0 ? [] : contents.replace(/\r\n/g, "\n").split("\n");
    return {
      relativePath: repoRelative(project, filePath),
      lines: lines.length,
      stringMatches: countLineSignals(lines, stringMatchSignals),
      scenarioTerms: countLineSignals(lines, scenarioSignals),
    };
  });
}

function suiteRunnerTokens(suite: SuiteConfig): string[] {
  const paramTokens = Object.values(suite.params).flat();
  if (suite.runner.kind === "fs") {
    return [];
  }
  if (suite.runner.kind === "argv") {
    return [...suite.runner.command, ...suite.runner.defaultArgs, ...paramTokens];
  }
  if (suite.runner.kind === "python_script" || suite.runner.kind === "bash_script") {
    return [suite.runner.script, ...suite.runner.args, ...paramTokens];
  }
  return [suite.runner.command, ...suite.runner.args, ...paramTokens];
}

function tokenToRepoFile(project: LoadedProject, rawToken: string): string | undefined {
  const token = rawToken.replaceAll("{repo_root}", project.repoRoot).trim();
  if (!token || token.startsWith("-") || token.includes("{")) {
    return undefined;
  }
  const absolutePath = path.isAbsolute(token) ? token : path.resolve(project.repoRoot, token);
  const relative = path.relative(project.repoRoot, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return undefined;
  }
  if (!auditFileExtensions.has(path.extname(absolutePath))) {
    return undefined;
  }
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    return undefined;
  }
  return repoRelative(project, absolutePath);
}

function suiteAuditSignals(
  project: LoadedProject,
  suites: SuiteConfig[],
  filesByPath: Map<string, AuditFileSignal>,
): SuiteAuditSignal[] {
  return suites.map((suite) => {
    const referencedFiles = [
      ...new Set(suiteRunnerTokens(suite).flatMap((token) => tokenToRepoFile(project, token) ?? [])),
    ]
      .map((relativePath) => filesByPath.get(relativePath))
      .filter((file): file is AuditFileSignal => file !== undefined);
    return {
      suite,
      files: referencedFiles,
      stringMatches: referencedFiles.reduce((sum, file) => sum + file.stringMatches, 0),
      scenarioTerms: referencedFiles.reduce((sum, file) => sum + file.scenarioTerms, 0),
    };
  });
}

function renderAuditTopFiles(label: string, files: AuditFileSignal[], selector: (file: AuditFileSignal) => number): void {
  const ranked = files
    .filter((file) => selector(file) > 0)
    .sort((left, right) => selector(right) - selector(left) || left.relativePath.localeCompare(right.relativePath))
    .slice(0, 10);
  console.log(label);
  if (ranked.length === 0) {
    console.log("- none");
    return;
  }
  for (const file of ranked) {
    console.log(
      `- ${file.relativePath}: ${file.lines} lines, string_match=${file.stringMatches}, scenario_terms=${file.scenarioTerms}`,
    );
  }
}

function runSuite(project: LoadedProject, suite: SuiteConfig, requestedParams: string[] = []): number {
  console.log(
    `==> RUN  [${suite.runner.kind}] ${suite.id} (class=${suite.validationClass} owner=${suite.owner})`,
  );
  if (suite.runner.kind === "fs") {
    const issues = runFileSystemSuite(suite, project.repoRoot);
    if (issues.length === 0) {
      console.log(
        `OK   [${suite.runner.kind}] ${suite.id} (class=${suite.validationClass} owner=${suite.owner})`,
      );
      return 0;
    }
    for (const issue of issues) {
      console.error(issue);
    }
    console.error(
      `FAIL [${suite.runner.kind}] ${suite.id} (class=${suite.validationClass} owner=${suite.owner})`,
    );
    return 1;
  }

  const exitCode = runProcessSuite(suite, project.repoRoot, requestedParams);
  if (exitCode === 0) {
    console.log(
      `OK   [${suite.runner.kind}] ${suite.id} (class=${suite.validationClass} owner=${suite.owner})`,
    );
  } else {
    console.error(
      `FAIL [${suite.runner.kind}] ${suite.id} (class=${suite.validationClass} owner=${suite.owner})`,
    );
  }
  return exitCode;
}

function runSuiteWithTiming(
  project: LoadedProject,
  suite: SuiteConfig,
  requestedParams: string[] = [],
): { exitCode: number; outcome: SuiteRunOutcome; durationMs: number } {
  const startedAt = nowTick();
  const exitCode = runSuite(project, suite, requestedParams);
  const durationMs = elapsedMs(startedAt);
  return {
    exitCode,
    outcome: exitCode === 0 ? "passed" : "failed",
    durationMs,
  };
}

function cmdCheckConfig(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: commonOptions(),
    strict: true,
    allowPositionals: false,
  });
  const project = loadFrom(values as { root: string; config: string });
  checkConfig(project);
  console.log(
    `validator config check passed: ${project.suites.length} suite(s), ${project.defaultGate.length} default gate suite(s), ${project.skipAliases.length} skip alias(es)`,
  );
  return 0;
}

function cmdList(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      ...commonOptions(),
      ...filterOptions(),
      "default-only": { type: "boolean" as const, default: false },
    },
    strict: true,
    allowPositionals: false,
  });
  const project = loadFrom(values as { root: string; config: string });
  const suites = selectedSuites(project, values, values["default-only"]);
  for (const suite of suites) {
    console.log(suiteSummary(suite));
  }
  return 0;
}

function cmdPlan(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      ...commonOptions(),
      ...filterOptions(),
      "skip-suite": { type: "string" as const, multiple: true, default: [] },
      "skip-group": { type: "string" as const, multiple: true, default: [] },
      "skip-alias": { type: "string" as const, multiple: true, default: [] },
    },
    strict: true,
    allowPositionals: false,
  });
  const project = loadFrom(values as { root: string; config: string });
  const suites = selectedSuites(project, values, true);
  const skipSelectors = [
    ...(values["skip-suite"] ?? []).map((suiteId) => `suite:${suiteId}`),
    ...(values["skip-group"] ?? []).map((group) => `group:${group}`),
    ...(values["skip-alias"] ?? []),
  ];
  const skipIds = new Set(resolveSelectorList(project, skipSelectors).map((suite) => suite.id));
  const runnableSuites = suites.filter((suite) => !skipIds.has(suite.id));
  checkConfig(project, runnableSuites);
  console.log("Default validation plan:");
  for (const suite of runnableSuites) {
    console.log(`- [${suite.runner.kind}] ${suite.id}`);
    console.log(`  owner: ${suite.owner}`);
    console.log(`  class: ${suite.validationClass}`);
    console.log(`  proof: ${suite.proofMode ?? "unspecified"}`);
    if (suite.proves.length > 0) {
      console.log(`  proves: ${suite.proves.join("; ")}`);
    }
    if (hasProofTriple(suite)) {
      console.log(`  protects: ${suite.protects.join("; ")}`);
      console.log(`  oracle: ${suite.oracle.join("; ")}`);
      console.log(`  exercised surface: ${suite.exercisedSurface.join("; ")}`);
    }
    if (suite.doesNotProve.length > 0) {
      console.log(`  does not prove: ${suite.doesNotProve.join("; ")}`);
    }
    console.log(`  groups: ${suite.groups.join(", ") || "-"}`);
    if (suite.timeoutSeconds !== undefined) {
      console.log(`  timeout: ${suite.timeoutSeconds}s`);
    }
    if (suite.runner.kind === "fs") {
      console.log("  runs:  built-in fs runner");
      continue;
    }
    const resolved = describeProcessSuite(suite, project.repoRoot);
    console.log(`  cwd:   ${path.relative(project.repoRoot, resolved.cwd) || "."}`);
    console.log(`  runs:  ${resolved.argv.join(" ")}`);
    if (suite.defaultParams.length > 0) {
      console.log(`  default params: ${suite.defaultParams.join(", ")}`);
    }
  }
  return 0;
}

function cmdAudit(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: commonOptions(),
    strict: true,
    allowPositionals: false,
  });
  const project = loadFrom(values as { root: string; config: string });
  checkConfig(project);

  const defaultSuites = project.defaultGate;
  const defaultProcessSuites = defaultSuites.filter(hasProcessRunner);
  const proofModes = new Map<string, number>();
  const runnerKinds = new Map<string, number>();
  const validationClasses = new Map<string, number>();
  for (const suite of defaultSuites) {
    incrementCount(proofModes, suite.proofMode ?? "unspecified");
    incrementCount(runnerKinds, suite.runner.kind);
    incrementCount(validationClasses, suite.validationClass);
  }

  const defaultProcessSuitesWithoutTimeout = defaultProcessSuites.filter((suite) => suite.timeoutSeconds === undefined);
  const defaultSuitesWithoutProofTriple = defaultSuites.filter((suite) => !hasProofTriple(suite));
  const defaultSuitesWithGenericProofTriple = defaultSuites.filter(
    (suite) => hasProofTriple(suite) && hasGenericProofTriple(suite),
  );
  const wordingSuitesWithoutContractOracle = defaultSuites.filter(
    (suite) =>
      suite.proofMode === "wording_contract" &&
      ![...suite.oracle, ...suite.exercisedSurface].some((item) => /\b(contract|generated|template|skill|frontdoor|published)\b/i.test(item)),
  );
  const defaultProcessTimeouts = defaultProcessSuites
    .filter((suite) => suite.timeoutSeconds !== undefined)
    .sort((left, right) => (right.timeoutSeconds ?? 0) - (left.timeoutSeconds ?? 0) || left.id.localeCompare(right.id))
    .slice(0, 10);
  const fileSignals = auditFileSignals(project);
  const fileSignalsByPath = new Map(fileSignals.map((file) => [file.relativePath, file]));
  const suiteSignals = suiteAuditSignals(project, defaultSuites, fileSignalsByPath);
  const stringHeavySuitesWithoutProofTriple = suiteSignals
    .filter((entry) => entry.stringMatches > 0 && !hasProofTriple(entry.suite))
    .sort((left, right) => right.stringMatches - left.stringMatches || left.suite.id.localeCompare(right.suite.id));
  const totalStringMatches = fileSignals.reduce((sum, file) => sum + file.stringMatches, 0);
  const totalScenarioTerms = fileSignals.reduce((sum, file) => sum + file.scenarioTerms, 0);

  console.log("Validation audit (report-only)");
  console.log(`- config: ${repoRelative(project, project.rootConfigPath)}`);
  console.log(`- suites: ${project.suites.length} total, ${defaultSuites.length} default, ${defaultProcessSuites.length} default process`);
  console.log(`- scanned files: ${fileSignals.length}`);
  console.log("");

  console.log("Default proof modes:");
  for (const line of renderCounts(proofModes)) {
    console.log(line);
  }
  console.log("");

  console.log("Default runner kinds:");
  for (const line of renderCounts(runnerKinds)) {
    console.log(line);
  }
  console.log("");

  console.log("Default validation classes:");
  for (const line of renderCounts(validationClasses)) {
    console.log(line);
  }
  console.log("");

  console.log("Default timeout signal:");
  console.log(`- missing timeout on default process suites: ${defaultProcessSuitesWithoutTimeout.length}`);
  for (const suite of defaultProcessSuitesWithoutTimeout.slice(0, 10)) {
    console.log(`- missing: ${suite.id}`);
  }
  console.log("Top default process timeouts:");
  if (defaultProcessTimeouts.length === 0) {
    console.log("- none");
  } else {
    for (const suite of defaultProcessTimeouts) {
      console.log(`- ${suite.id}: ${suite.timeoutSeconds}s`);
    }
  }
  console.log("");

  console.log("Proof-triple signal:");
  console.log(`- missing proof triple on default suites: ${defaultSuitesWithoutProofTriple.length}`);
  for (const suite of defaultSuitesWithoutProofTriple.slice(0, 10)) {
    console.log(`- missing: ${suite.id}`);
  }
  console.log(`- weak or generic proof triple on default suites: ${defaultSuitesWithGenericProofTriple.length}`);
  for (const suite of defaultSuitesWithGenericProofTriple.slice(0, 10)) {
    console.log(`- weak: ${suite.id}`);
  }
  console.log(`- wording-contract suites without explicit contract oracle/surface: ${wordingSuitesWithoutContractOracle.length}`);
  for (const suite of wordingSuitesWithoutContractOracle.slice(0, 10)) {
    console.log(`- review: ${suite.id}`);
  }
  console.log("- interpretation: gate_validation defaults fail closed; other gaps are review prompts until promoted");
  console.log("");

  console.log("String-heavy suite proof signal:");
  console.log(`- string-match runner suites missing proof triple: ${stringHeavySuitesWithoutProofTriple.length}`);
  for (const entry of stringHeavySuitesWithoutProofTriple.slice(0, 10)) {
    const files = entry.files.map((file) => file.relativePath).join(", ");
    console.log(`- missing: ${entry.suite.id} string_match=${entry.stringMatches} files=${files}`);
  }
  console.log("");

  renderAuditTopFiles("Largest validation/eval files:", fileSignals, (file) => file.lines);
  console.log("");
  console.log("String-match signal:");
  console.log(`- total heuristic matches: ${totalStringMatches}`);
  renderAuditTopFiles("Top string-match files:", fileSignals, (file) => file.stringMatches);
  console.log("");
  console.log("Scenario/eval vocabulary signal:");
  console.log(`- total heuristic terms: ${totalScenarioTerms}`);
  console.log("- interpretation: vocabulary hits are review prompts, not proof");
  renderAuditTopFiles("Top scenario/eval files:", fileSignals, (file) => file.scenarioTerms);

  return 0;
}

function cmdRunDefault(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      ...commonOptions(),
      ...filterOptions(),
      "skip-suite": { type: "string" as const, multiple: true, default: [] },
      "skip-group": { type: "string" as const, multiple: true, default: [] },
      "skip-alias": { type: "string" as const, multiple: true, default: [] },
      "fail-fast": { type: "boolean" as const, default: false },
    },
    strict: true,
    allowPositionals: false,
  });
  const project = loadFrom(values as { root: string; config: string });
  const suites = selectedSuites(project, values, true);
  const skipSelectors = [
    ...(values["skip-suite"] ?? []).map((suiteId) => `suite:${suiteId}`),
    ...(values["skip-group"] ?? []).map((group) => `group:${group}`),
    ...(values["skip-alias"] ?? []),
  ];
  const skipIds = new Set(resolveSelectorList(project, skipSelectors).map((suite) => suite.id));
  const runnableSuites = suites.filter((suite) => !skipIds.has(suite.id));
  checkConfig(project, runnableSuites);

  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const gateStartedAt = nowTick();
  const timingRecords = [];
  for (const suite of suites) {
    if (skipIds.has(suite.id)) {
      skipped += 1;
      console.log(
        `==> SKIP [${suite.runner.kind}] ${suite.id} (class=${suite.validationClass} owner=${suite.owner} reason=disabled)`,
      );
      continue;
    }
    const result = runSuiteWithTiming(project, suite);
    timingRecords.push(suiteTimingRecord(suite, result.outcome, result.durationMs));
    if (result.exitCode === 0) {
      passed += 1;
    } else {
      failed += 1;
      if (values["fail-fast"]) {
        console.error(`Fail-fast stopping after failed suite: ${suite.id}`);
        break;
      }
    }
  }
  console.log(`Summary: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  for (const line of renderTimingSummary(timingRecords, {
    totalWallMs: elapsedMs(gateStartedAt),
    executionModeLabel: "sequential suites",
  })) {
    console.log(line);
  }
  if (failed > 0) {
    console.error(`Repository validation failed: ${failed} suite(s)`);
    return 1;
  }
  console.log("Repository validation passed");
  return 0;
}

function cmdRunSuite(argv: string[]): number {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      ...commonOptions(),
      param: { type: "string" as const, multiple: true, default: [] },
    },
    strict: true,
    allowPositionals: true,
  });
  const suiteId = positionals[0];
  if (!suiteId) {
    throw new Error("run-suite requires <suite-id>");
  }
  const project = loadFrom(values as { root: string; config: string });
  const suite = suiteById(project, suiteId);
  const requestedParams = [...new Set(values.param ?? [])];
  if (hasProcessRunner(suite)) {
    validateProcessSuiteShape(suite, project.repoRoot, requestedParams);
  }
  const result = runSuiteWithTiming(project, suite, requestedParams);
  for (const line of renderTimingSummary([suiteTimingRecord(suite, result.outcome, result.durationMs)], {
    totalWallMs: result.durationMs,
  })) {
    console.log(line);
  }
  return result.exitCode;
}

function main(argv: string[]): number {
  const [command, ...rest] = argv;
  if (!command || command === "-h" || command === "--help") {
    printHelp();
    return 0;
  }

  switch (command) {
    case "check-config":
      return cmdCheckConfig(rest);
    case "list":
      return cmdList(rest);
    case "plan":
      return cmdPlan(rest);
    case "audit":
      return cmdAudit(rest);
    case "run-default":
      return cmdRunDefault(rest);
    case "run-suite":
      return cmdRunSuite(rest);
    default:
      throw new Error(`unknown command: ${command}`);
  }
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`bagakit-validator: ${message}`);
  process.exitCode = 1;
}
