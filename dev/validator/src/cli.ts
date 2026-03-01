import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

import { loadProject } from "./lib/loader.ts";
import type { LoadedProject, SuiteConfig, ValidationClass } from "./lib/model.ts";
import { VALIDATION_CLASSES } from "./lib/model.ts";
import { describeProcessSuite, hasProcessRunner, runFileSystemSuite, runProcessSuite, validateProcessSuiteShape } from "./lib/runners.ts";
import { filterSuites, resolveSelectorList, validateSkipAliases } from "./lib/selection.ts";

const defaultRoot = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const defaultConfig = "gate_validation/validation.toml";

function printHelp(): void {
  console.log(`bagakit validator

Commands:
  check-config [--root <repo-root>] [--config <path>]
  list [--root <repo-root>] [--config <path>] [--default-only] [--group <name>] [--validation-class <label>]
  plan [--root <repo-root>] [--config <path>] [--group <name>] [--validation-class <label>] [--skip-suite <id>] [--skip-group <name>] [--skip-alias <id>]
  run-default [--root <repo-root>] [--config <path>] [--group <name>] [--validation-class <label>] [--skip-suite <id>] [--skip-group <name>] [--skip-alias <id>]
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
    console.log(`  groups: ${suite.groups.join(", ") || "-"}`);
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

function cmdRunDefault(argv: string[]): number {
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

  let passed = 0;
  let failed = 0;
  let skipped = 0;
  for (const suite of suites) {
    if (skipIds.has(suite.id)) {
      skipped += 1;
      console.log(
        `==> SKIP [${suite.runner.kind}] ${suite.id} (class=${suite.validationClass} owner=${suite.owner} reason=disabled)`,
      );
      continue;
    }
    const exitCode = runSuite(project, suite);
    if (exitCode === 0) {
      passed += 1;
    } else {
      failed += 1;
    }
  }
  console.log(`Summary: ${passed} passed, ${failed} failed, ${skipped} skipped`);
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
  return runSuite(project, suite, requestedParams);
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
