import path from "node:path";
import { spawnSync } from "node:child_process";

import type {
  LoadedProject,
  SuiteConfig,
  ValidationCostClass,
  ValidationDisposition,
} from "./model.ts";
import { resolveSelectorList } from "./selection.ts";

export const IMPACT_MODES = ["universal", "affected", "all"] as const;
export type ImpactMode = (typeof IMPACT_MODES)[number];

export interface ImpactPlanEntry {
  suiteId: string;
  owner: string;
  disposition: ValidationDisposition;
  costClass: ValidationCostClass;
  selected: boolean;
  reasons: string[];
  impactPaths: string[];
  protects: string[];
  proofSurface: string[];
  failureBoundary: string[];
}

export interface ImpactPlan {
  schema: "bagakit.validation-impact-plan/v1";
  mode: ImpactMode;
  baseRef?: string;
  changedPaths: string[];
  changedPathSource: "provided" | "git" | "none";
  fallback: "none" | "global_path" | "unknown_path" | "missing_policy" | "git_error";
  fallbackDetail: string;
  selectedSuiteIds: string[];
  skippedSuiteIds: string[];
  entries: ImpactPlanEntry[];
}

export interface ImpactPlanOptions {
  mode: ImpactMode;
  changedPaths?: string[];
  baseRef?: string;
}

interface GitChangedPathsResult {
  paths: string[];
  error?: string;
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function normalizeRepoPath(rawPath: string): string {
  return rawPath.trim().replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

function pathMatches(changedPath: string, candidatePath: string): boolean {
  const changed = normalizeRepoPath(changedPath);
  const candidate = normalizeRepoPath(candidatePath);
  if (!changed || !candidate) {
    return false;
  }
  return changed === candidate || changed.startsWith(`${candidate}/`) || candidate.startsWith(`${changed}/`);
}

function runGit(repoRoot: string, args: string[]): { stdout: string; error?: string } {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) {
    return {
      stdout: "",
      error: (result.stderr || result.stdout || `git ${args.join(" ")} failed`).trim(),
    };
  }
  return { stdout: result.stdout };
}

function outputPaths(stdout: string): string[] {
  return stdout
    .split(/\r?\n/)
    .map(normalizeRepoPath)
    .filter(Boolean);
}

export function collectGitChangedPaths(repoRoot: string, baseRef: string): GitChangedPathsResult {
  const baseDiff = runGit(repoRoot, ["diff", "--name-only", "--diff-filter=ACDMRTUXB", `${baseRef}...HEAD`, "--"]);
  if (baseDiff.error) {
    return { paths: [], error: `cannot diff base ref ${baseRef}: ${baseDiff.error}` };
  }
  const worktreeDiff = runGit(repoRoot, ["diff", "--name-only", "--diff-filter=ACDMRTUXB", "--"]);
  if (worktreeDiff.error) {
    return { paths: [], error: `cannot inspect worktree changes: ${worktreeDiff.error}` };
  }
  const stagedDiff = runGit(repoRoot, ["diff", "--cached", "--name-only", "--diff-filter=ACDMRTUXB", "--"]);
  if (stagedDiff.error) {
    return { paths: [], error: `cannot inspect staged changes: ${stagedDiff.error}` };
  }
  const untracked = runGit(repoRoot, ["ls-files", "--others", "--exclude-standard"]);
  if (untracked.error) {
    return { paths: [], error: `cannot inspect untracked changes: ${untracked.error}` };
  }
  return {
    paths: uniqueSorted([
      ...outputPaths(baseDiff.stdout),
      ...outputPaths(worktreeDiff.stdout),
      ...outputPaths(stagedDiff.stdout),
      ...outputPaths(untracked.stdout),
    ]),
  };
}

function tokenToRepoPath(project: LoadedProject, rawToken: string): string | undefined {
  let token = rawToken.trim().replace(/[,:;.)]+$/, "");
  if (!token || token.startsWith("-") || token.includes("<") || token.includes(">")) {
    return undefined;
  }
  token = token.replaceAll("{repo_root}", project.repoRoot);
  if (token.includes("{")) {
    return undefined;
  }
  const absolute = path.isAbsolute(token) ? token : path.resolve(project.repoRoot, token);
  const relative = path.relative(project.repoRoot, absolute).split(path.sep).join("/");
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return undefined;
  }
  return normalizeRepoPath(relative);
}

function describedPaths(project: LoadedProject, values: string[]): string[] {
  const paths: string[] = [];
  for (const value of values) {
    const firstToken = value.trim().split(/\s+/)[0] ?? "";
    const direct = tokenToRepoPath(project, firstToken);
    if (direct && (firstToken.includes("/") || /\.[a-z0-9]+$/i.test(firstToken))) {
      paths.push(direct);
    }
    for (const match of value.matchAll(/(?:^|\s)([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+)/g)) {
      const candidate = tokenToRepoPath(project, match[1] ?? "");
      if (candidate) {
        paths.push(candidate);
      }
    }
  }
  return paths;
}

function runnerTokens(suite: SuiteConfig): string[] {
  const params = Object.values(suite.params).flat();
  if (suite.runner.kind === "fs") {
    return [
      ...suite.runner.requiredDirs,
      ...suite.runner.requiredFiles,
      ...suite.runner.forbiddenPaths,
    ];
  }
  if (suite.runner.kind === "argv") {
    return [...suite.runner.command, ...suite.runner.defaultArgs, ...params, suite.runner.cwd];
  }
  if (suite.runner.kind === "python_script" || suite.runner.kind === "bash_script") {
    return [suite.runner.script, ...suite.runner.args, ...params, suite.runner.cwd];
  }
  return [suite.runner.command, ...suite.runner.args, ...params, suite.runner.cwd];
}

export function deriveSuiteImpactPaths(project: LoadedProject, suite: SuiteConfig): string[] {
  const configDir = path.relative(project.repoRoot, path.dirname(suite.configPath)).split(path.sep).join("/");
  return uniqueSorted([
    normalizeRepoPath(suite.owner),
    normalizeRepoPath(configDir),
    ...runnerTokens(suite).flatMap((token) => tokenToRepoPath(project, token) ?? []),
    ...describedPaths(project, suite.exercisedSurface),
  ].filter(Boolean));
}

export function deriveCostClass(suite: SuiteConfig): ValidationCostClass {
  if (suite.runner.kind === "fs") {
    return "tiny";
  }
  const timeout = suite.timeoutSeconds ?? Number.POSITIVE_INFINITY;
  if (timeout <= 60) {
    return "small";
  }
  if (timeout <= 180) {
    return "medium";
  }
  return "large";
}

export function suiteDisposition(project: LoadedProject, suite: SuiteConfig): ValidationDisposition {
  if (project.rootConfigPath.includes(`${path.sep}gate_eval${path.sep}`)) {
    return "capability_eval";
  }
  const policy = project.executionPolicy;
  if (policy?.universalSuites.includes(suite.id)) {
    return "universal";
  }
  if (policy?.scheduledFullSweepSuites.includes(suite.id)) {
    return "scheduled_full_sweep";
  }
  return "affected_blocking";
}

export function validateExecutionPolicy(project: LoadedProject): void {
  const policy = project.executionPolicy;
  if (!policy) {
    return;
  }
  const seenRuleIds = new Set<string>();
  const universal = new Set(policy.universalSuites);
  for (const suiteId of [...policy.universalSuites, ...policy.scheduledFullSweepSuites]) {
    const suite = project.suitesById.get(suiteId);
    if (!suite || !suite.defaultInGate) {
      throw new Error(`execution policy references non-default or unknown suite: ${suiteId}`);
    }
  }
  for (const suiteId of policy.scheduledFullSweepSuites) {
    if (universal.has(suiteId)) {
      throw new Error(`execution policy suite cannot be both universal and scheduled_full_sweep: ${suiteId}`);
    }
  }
  for (const rule of policy.impactRules) {
    if (seenRuleIds.has(rule.id)) {
      throw new Error(`duplicate impact_rule id: ${rule.id}`);
    }
    seenRuleIds.add(rule.id);
    resolveSelectorList(project, rule.selectors);
  }
}

function baseEntry(project: LoadedProject, suite: SuiteConfig): ImpactPlanEntry {
  return {
    suiteId: suite.id,
    owner: suite.owner,
    disposition: suiteDisposition(project, suite),
    costClass: deriveCostClass(suite),
    selected: false,
    reasons: [],
    impactPaths: deriveSuiteImpactPaths(project, suite),
    protects: [...suite.protects],
    proofSurface: [...suite.oracle, ...suite.exercisedSurface],
    failureBoundary: [...suite.doesNotProve],
  };
}

export function buildImpactPlan(project: LoadedProject, options: ImpactPlanOptions): ImpactPlan {
  validateExecutionPolicy(project);
  const policy = project.executionPolicy;
  const baseRef = options.baseRef ?? policy?.defaultBaseRef;
  let changedPathSource: ImpactPlan["changedPathSource"] = "none";
  let changedPaths: string[] = [];
  let gitError = "";
  if (options.changedPaths !== undefined) {
    changedPathSource = "provided";
    changedPaths = uniqueSorted(options.changedPaths.map(normalizeRepoPath).filter(Boolean));
  } else if (options.mode === "affected" && baseRef) {
    changedPathSource = "git";
    const collected = collectGitChangedPaths(project.repoRoot, baseRef);
    changedPaths = collected.paths;
    gitError = collected.error ?? "";
  }

  const entries = project.defaultGate
    .map((suite) => baseEntry(project, suite))
    .sort((left, right) => left.suiteId.localeCompare(right.suiteId));
  let fallback: ImpactPlan["fallback"] = "none";
  let fallbackDetail = "";
  const selectAll = (reason: string) => {
    for (const entry of entries) {
      entry.selected = true;
      entry.reasons.push(reason);
    }
  };

  if (options.mode === "all") {
    selectAll("mode=all");
  } else if (!policy) {
    fallback = "missing_policy";
    fallbackDetail = "root config has no execution_policy";
    selectAll("fail-safe: missing execution policy");
  } else if (options.mode === "universal") {
    for (const entry of entries) {
      entry.selected = entry.disposition === "universal";
      entry.reasons.push(entry.selected ? "universal preflight" : `scope=${entry.disposition}`);
    }
  } else if (gitError) {
    fallback = "git_error";
    fallbackDetail = gitError;
    selectAll(`fail-safe: ${gitError}`);
  } else {
    const universalIds = new Set(policy.universalSuites);
    const explicitSuiteReasons = new Map<string, string[]>();
    const recognizedChangedPaths = new Set<string>();

    for (const changedPath of changedPaths) {
      if (policy.globalPaths.some((candidate) => pathMatches(changedPath, candidate))) {
        fallback = "global_path";
        fallbackDetail = changedPath;
        break;
      }
    }

    if (fallback === "global_path") {
      selectAll(`fail-safe global path: ${fallbackDetail}`);
    } else {
      for (const rule of policy.impactRules) {
        const matchedPaths = changedPaths.filter((changedPath) =>
          rule.paths.some((candidate) => pathMatches(changedPath, candidate))
        );
        if (matchedPaths.length === 0) {
          continue;
        }
        for (const changedPath of matchedPaths) {
          recognizedChangedPaths.add(changedPath);
        }
        for (const suite of resolveSelectorList(project, rule.selectors)) {
          const reasons = explicitSuiteReasons.get(suite.id) ?? [];
          reasons.push(`impact_rule=${rule.id}: ${matchedPaths.join(", ")}`);
          explicitSuiteReasons.set(suite.id, reasons);
        }
      }

      for (const entry of entries) {
        const matchedPaths = changedPaths.filter((changedPath) =>
          entry.impactPaths.some((candidate) => pathMatches(changedPath, candidate))
        );
        for (const changedPath of matchedPaths) {
          recognizedChangedPaths.add(changedPath);
        }
        const explicitReasons = explicitSuiteReasons.get(entry.suiteId) ?? [];
        const affected = matchedPaths.length > 0 || explicitReasons.length > 0;
        entry.selected = universalIds.has(entry.suiteId) ||
          (entry.disposition === "affected_blocking" && affected);
        if (universalIds.has(entry.suiteId)) {
          entry.reasons.push("universal preflight");
        }
        if (matchedPaths.length > 0) {
          entry.reasons.push(`derived impact: ${matchedPaths.join(", ")}`);
        }
        entry.reasons.push(...explicitReasons);
        if (!entry.selected) {
          entry.reasons.push(entry.disposition === "scheduled_full_sweep"
            ? "scheduled for full sweep"
            : "no affected path matched");
        }
      }

      const unknownPaths = changedPaths.filter((changedPath) => !recognizedChangedPaths.has(changedPath));
      if (unknownPaths.length > 0) {
        fallback = "unknown_path";
        fallbackDetail = unknownPaths.join(", ");
        for (const entry of entries) {
          entry.selected = true;
          entry.reasons.push(`fail-safe unknown path: ${fallbackDetail}`);
        }
      }
    }
  }

  const selectedSuiteIds = entries.filter((entry) => entry.selected).map((entry) => entry.suiteId);
  const skippedSuiteIds = entries.filter((entry) => !entry.selected).map((entry) => entry.suiteId);
  return {
    schema: "bagakit.validation-impact-plan/v1",
    mode: options.mode,
    baseRef,
    changedPaths,
    changedPathSource,
    fallback,
    fallbackDetail,
    selectedSuiteIds,
    skippedSuiteIds,
    entries,
  };
}
