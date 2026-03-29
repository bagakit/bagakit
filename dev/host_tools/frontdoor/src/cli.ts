import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { loadProject, readTextFile, writeTextFile } from "./lib/io.ts";
import { AGENTS_PATH, type ValidationIssue } from "./lib/model.ts";
import { applyManagedBlock, renderManagedBlock } from "./lib/renderer.ts";
import { hasErrors, validateManagedRegionMatches, validateProject } from "./lib/validator.ts";

function printHelp(): void {
  console.log(`bagakit frontdoor

Commands:
  check [--root <repo-root>]
  render [--root <repo-root>]
  apply [--root <repo-root>]
`);
}

function commonOptions() {
  return {
    root: { type: "string" as const, default: "." },
  };
}

function printIssues(issues: ValidationIssue[]): void {
  for (const item of issues) {
    console.error(`${item.severity.toUpperCase()}: ${item.path}: ${item.message}`);
  }
}

function loadAndValidate(root: string, includeBootstrap: boolean): { root: string; issues: ValidationIssue[]; block: string } {
  const resolvedRoot = path.resolve(root);
  const project = loadProject(resolvedRoot);
  const issues = validateProject(project);
  const agentsPath = path.join(resolvedRoot, AGENTS_PATH);
  const projectHasErrors = hasErrors(issues);
  const block = projectHasErrors ? "" : renderManagedBlock(project.rules);

  if (includeBootstrap && !projectHasErrors) {
    if (fs.existsSync(agentsPath)) {
      issues.push(...validateManagedRegionMatches(readTextFile(agentsPath), AGENTS_PATH, block));
    } else {
      issues.push({ severity: "error", path: AGENTS_PATH, message: "missing AGENTS.md" });
    }
  }

  return {
    root: resolvedRoot,
    issues,
    block,
  };
}

function cmdCheck(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: commonOptions(),
    strict: true,
    allowPositionals: false,
  });
  const { issues } = loadAndValidate(values.root, true);
  printIssues(issues);
  if (hasErrors(issues)) {
    return 1;
  }
  console.log("ok: frontdoor declarations are valid");
  return 0;
}

function cmdRender(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: commonOptions(),
    strict: true,
    allowPositionals: false,
  });
  const { issues, block } = loadAndValidate(values.root, false);
  printIssues(issues);
  if (hasErrors(issues)) {
    return 1;
  }
  console.log(block.trimEnd());
  return 0;
}

function cmdApply(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: commonOptions(),
    strict: true,
    allowPositionals: false,
  });
  const { root, issues, block } = loadAndValidate(values.root, false);
  printIssues(issues);
  if (hasErrors(issues)) {
    return 1;
  }

  const agentsPath = path.join(root, AGENTS_PATH);
  const existing = fs.existsSync(agentsPath) ? readTextFile(agentsPath) : "";
  const updated = applyManagedBlock(existing, block);
  writeTextFile(agentsPath, updated);
  console.log(`ok: updated ${AGENTS_PATH}`);
  return 0;
}

function main(): number {
  const [command, ...argv] = process.argv.slice(2);
  try {
    if (!command || command === "-h" || command === "--help") {
      printHelp();
      return 0;
    }
    if (command === "check") {
      return cmdCheck(argv);
    }
    if (command === "render") {
      return cmdRender(argv);
    }
    if (command === "apply") {
      return cmdApply(argv);
    }
    throw new Error(`unknown command: ${command}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`error: ${message}`);
    return 1;
  }
}

process.exitCode = main();
