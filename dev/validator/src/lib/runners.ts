import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import type { SuiteConfig } from "./model.ts";
import { resolveProcessCommand } from "./placeholders.ts";

function maybeCandidatePath(token: string, cwd: string): string {
  if (!token) {
    return "";
  }
  if (path.isAbsolute(token)) {
    return token;
  }
  if (token.includes("/") || path.extname(token)) {
    return path.resolve(cwd, token);
  }
  return "";
}

function validateExistingPath(candidatePath: string, message: string): void {
  if (!candidatePath) {
    return;
  }
  if (!fs.existsSync(candidatePath)) {
    throw new Error(message);
  }
}

function firstPositionalToken(argv: string[]): string {
  for (const token of argv.slice(1)) {
    if (!token || token.startsWith("-")) {
      continue;
    }
    return token;
  }
  return "";
}

function interpreterLikeCommand(commandPath: string): boolean {
  const base = path.basename(commandPath).toLowerCase();
  return base === "node" || base.startsWith("python") || base === "bash" || base === "sh";
}

export function runFileSystemSuite(suite: SuiteConfig, repoRoot: string): string[] {
  if (suite.runner.kind !== "fs") {
    throw new Error(`suite ${suite.id} does not use the fs runner`);
  }

  const issues: string[] = [];

  for (const relPath of suite.runner.requiredDirs) {
    const absolutePath = path.join(repoRoot, relPath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) {
      issues.push(`missing required directory: ${relPath}`);
    }
  }

  for (const relPath of suite.runner.requiredFiles) {
    const absolutePath = path.join(repoRoot, relPath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      issues.push(`missing required file: ${relPath}`);
    }
  }

  for (const relPath of suite.runner.forbiddenPaths) {
    const absolutePath = path.join(repoRoot, relPath);
    if (fs.existsSync(absolutePath)) {
      issues.push(`forbidden path still exists: ${relPath}`);
    }
  }

  return issues;
}

export function validateProcessSuiteShape(
  suite: SuiteConfig,
  repoRoot: string,
  requestedParams: string[] = [],
): void {
  if (suite.runner.kind === "fs") {
    return;
  }

  const resolved = resolveProcessCommand(suite, repoRoot, requestedParams, true);
  if (resolved.argv.length === 0) {
    throw new Error(`suite ${suite.id} resolved to an empty command`);
  }
  if (!fs.existsSync(resolved.cwd) || !fs.statSync(resolved.cwd).isDirectory()) {
    throw new Error(`suite ${suite.id} resolves to a missing cwd: ${resolved.cwd}`);
  }

  if (suite.runner.kind === "python_script" || suite.runner.kind === "bash_script") {
    const expandedScript = resolved.argv[1] ?? "";
    const candidatePath = maybeCandidatePath(expandedScript, resolved.cwd);
    validateExistingPath(candidatePath, `suite ${suite.id} references a missing script path: ${expandedScript}`);
  }

  const headCandidate = maybeCandidatePath(resolved.argv[0] ?? "", resolved.cwd);
  validateExistingPath(headCandidate, `suite ${suite.id} references a missing command path: ${resolved.argv[0]}`);

  if (suite.runner.kind === "argv" || (suite.runner.kind === "executable" && interpreterLikeCommand(resolved.argv[0] ?? ""))) {
    const scriptToken = firstPositionalToken(resolved.argv);
    const candidatePath = maybeCandidatePath(scriptToken, resolved.cwd);
    validateExistingPath(candidatePath, `suite ${suite.id} references a missing command path: ${scriptToken}`);
  }
}

export function runProcessSuite(
  suite: SuiteConfig,
  repoRoot: string,
  requestedParams: string[] = [],
): number {
  if (suite.runner.kind === "fs") {
    throw new Error(`suite ${suite.id} does not use a process runner`);
  }

  const resolved = resolveProcessCommand(suite, repoRoot, requestedParams, true);
  const result = spawnSync(resolved.argv[0], resolved.argv.slice(1), {
    cwd: resolved.cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      PYTHONDONTWRITEBYTECODE: "1",
    },
  });

  if (result.error) {
    console.error(`failed to launch suite ${suite.id}: ${result.error.message}`);
    return 1;
  }
  if (typeof result.status === "number") {
    return result.status;
  }
  if (result.signal) {
    console.error(`suite ${suite.id} terminated by signal ${result.signal}`);
  }
  return 1;
}

export function describeProcessSuite(
  suite: SuiteConfig,
  repoRoot: string,
  requestedParams: string[] = [],
): { argv: string[]; cwd: string } {
  if (suite.runner.kind === "fs") {
    throw new Error(`suite ${suite.id} does not use a process runner`);
  }
  return resolveProcessCommand(suite, repoRoot, requestedParams, true);
}

export function hasProcessRunner(suite: SuiteConfig): boolean {
  return suite.runner.kind !== "fs";
}
