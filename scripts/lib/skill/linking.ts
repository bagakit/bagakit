import { lstatSync, mkdirSync, readdirSync, readlinkSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";

import type { LinkResult, SkillSource } from "./model.ts";
import { displayPath, isRepoSkillProjectionTarget } from "./paths.ts";

type PlannedAction = "create" | "replace" | "unchanged";
type ReplacementSafety = "automatic" | "force_required" | "blocked";

type ExistingLinkInspection = Readonly<{
  action: PlannedAction;
  replacementSafety: ReplacementSafety;
}>;

type PlannedLink = Readonly<{
  skill: SkillSource;
  linkPath: string;
  action: PlannedAction;
}>;

export type LinkOptions = Readonly<{
  repoRoot: string;
  destDir: string;
  force: boolean;
  dryRun?: boolean;
}>;

export type LinkDestinationsOptions = Readonly<{
  repoRoot: string;
  destDirs: string[];
  force: boolean;
  dryRun?: boolean;
}>;

export type LinkDestinationResult = Readonly<{
  destDir: string;
  results: LinkResult[];
}>;

export class ProtectedLinkConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtectedLinkConflictError";
  }
}

function destinationCollisionError(skills: SkillSource[]): Error {
  const grouped = new Map<string, string[]>();
  for (const skill of skills) {
    const selectors = grouped.get(skill.skillId);
    if (selectors) {
      selectors.push(skill.selector);
      continue;
    }
    grouped.set(skill.skillId, [skill.selector]);
  }

  const collisions = [...grouped.entries()]
    .filter(([, selectors]) => selectors.length > 1)
    .map(([skillId, selectors]) => `- ${skillId}: ${selectors.join(", ")}`);

  return new Error(
    `link selection would collide in the destination directory because these skill ids repeat:\n${collisions.join("\n")}`,
  );
}



function inspectExistingLink(
  linkPath: string,
  targetPath: string,
  repoRoot: string,
  skill: SkillSource,
): ExistingLinkInspection {
  try {
    const stat = lstatSync(linkPath);
    if (stat.isSymbolicLink()) {
      const rawTarget = readlinkSync(linkPath);
      const resolvedTarget = path.resolve(path.dirname(linkPath), rawTarget);
      const canonicalTarget = realpathSync.native(targetPath);
      try {
        const existingTarget = realpathSync.native(resolvedTarget);
        if (existingTarget === canonicalTarget) {
          return { action: "unchanged", replacementSafety: "automatic" };
        }
      } catch {
        return {
          action: "replace",
          replacementSafety: isRepoSkillProjectionTarget(repoRoot, resolvedTarget, skill.skillId)
            ? "automatic"
            : "force_required",
        };
      }

      return {
        action: "replace",
        replacementSafety: isRepoSkillProjectionTarget(repoRoot, resolvedTarget, skill.skillId)
          ? "automatic"
          : "force_required",
      };
    }
    return { action: "replace", replacementSafety: "blocked" };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { action: "create", replacementSafety: "automatic" };
    }
    throw error;
  }
}

function planLinkOperations(skills: SkillSource[], options: LinkOptions): PlannedLink[] {
  const bySkillId = new Set<string>();
  for (const skill of skills) {
    if (bySkillId.has(skill.skillId)) {
      throw destinationCollisionError(skills);
    }
    bySkillId.add(skill.skillId);
  }

  const plan: PlannedLink[] = [];
  const conflicts: string[] = [];
  for (const skill of skills) {
    const linkPath = path.join(options.destDir, skill.skillId);
    const inspection = inspectExistingLink(linkPath, skill.absoluteDir, options.repoRoot, skill);
    if (inspection.action === "replace" && inspection.replacementSafety === "blocked") {
      conflicts.push(`- ${displayPath(options.repoRoot, linkPath)} is not a symbolic link; refusing to replace it`);
      continue;
    }
    if (inspection.action === "replace" && inspection.replacementSafety === "force_required" && !options.force) {
      conflicts.push(
        `- ${displayPath(options.repoRoot, linkPath)} is a foreign symbolic link; rerun with --force to replace it`,
      );
      continue;
    }
    plan.push({ skill, linkPath, action: inspection.action });
  }

  if (conflicts.length > 0) {
    throw new ProtectedLinkConflictError(`link operation has protected path conflicts:\n${conflicts.join("\n")}`);
  }

  return plan;
}

function applyLinkPlan(plan: PlannedLink[], repoRoot: string): LinkResult[] {
  const results: LinkResult[] = [];
  for (const item of plan) {
    if (item.action === "replace") {
      rmSync(item.linkPath, { force: true });
    }
    if (item.action === "create" || item.action === "replace") {
      symlinkSync(item.skill.absoluteDir, item.linkPath, "dir");
    }

    results.push({
      skill: item.skill,
      status: item.action === "unchanged" ? "unchanged" : "linked",
      destinationPath: displayPath(repoRoot, item.linkPath),
      sourcePath: item.skill.relativeDir,
    });
  }

  return results;
}

function renderLinkPlan(plan: PlannedLink[], repoRoot: string, dryRun: boolean): LinkResult[] {
  if (!dryRun) {
    return applyLinkPlan(plan, repoRoot);
  }
  return plan.map((item) => ({
    skill: item.skill,
    status: item.action === "unchanged" ? "unchanged" : "linked",
    destinationPath: displayPath(repoRoot, item.linkPath),
    sourcePath: item.skill.relativeDir,
  }));
}

export function linkSkillsToDestinations(
  skills: SkillSource[],
  options: LinkDestinationsOptions,
): LinkDestinationResult[] {
  const destDirs = [...new Set(options.destDirs.map((destDir) => path.resolve(destDir)))];
  const plannedDestinations = destDirs.map((destDir) => ({
    destDir,
    plan: planLinkOperations(skills, {
      repoRoot: options.repoRoot,
      destDir,
      force: options.force,
    }),
  }));

  return plannedDestinations.map(({ destDir, plan }) => {
    if (!options.dryRun) mkdirSync(destDir, { recursive: true });
    return {
      destDir,
      results: renderLinkPlan(plan, options.repoRoot, options.dryRun ?? false),
    };
  });
}

export function linkSkills(skills: SkillSource[], options: LinkOptions): LinkResult[] {
  return linkSkillsToDestinations(skills, {
    repoRoot: options.repoRoot,
    destDirs: [options.destDir],
    force: options.force,
    dryRun: options.dryRun,
  })[0]?.results ?? [];
}

export function unlinkSkills(skills: SkillSource[], options: LinkOptions): LinkResult[] {
  const results: LinkResult[] = [];
  for (const skill of skills) {
    const linkPath = path.join(options.destDir, skill.skillId);
    let stat;
    try {
      stat = lstatSync(linkPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    if (!stat.isSymbolicLink()) continue;
    const resolvedTarget = path.resolve(path.dirname(linkPath), readlinkSync(linkPath));
    let matches = false;
    try {
      matches = realpathSync.native(resolvedTarget) === realpathSync.native(skill.absoluteDir);
    } catch {
      matches = false;
    }
    if (!matches) continue;
    if (!options.dryRun) rmSync(linkPath);
    results.push({
      skill,
      status: "linked",
      destinationPath: displayPath(options.repoRoot, linkPath),
      sourcePath: skill.relativeDir,
    });
  }
  return results;
}

export function pruneSkillLinks(skills: SkillSource[], options: Omit<LinkOptions, "force">): { path: string; target: string }[] {
  const currentIds = new Set(skills.map((skill) => skill.skillId));
  let entries;
  try {
    entries = readdirSync(options.destDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const removed: { path: string; target: string }[] = [];
  for (const entry of entries) {
    if (!entry.isSymbolicLink()) continue;
    const linkPath = path.join(options.destDir, entry.name);
    const target = path.resolve(options.destDir, readlinkSync(linkPath));
    const skillId = path.basename(target);
    if (!isRepoSkillProjectionTarget(options.repoRoot, target, skillId)) continue;
    // Same-name live skills are refreshed by install/link. Remove only retired
    // skill projections and aliases owned by this repository.
    if (entry.name === skillId && currentIds.has(skillId)) continue;
    removed.push({ path: linkPath, target });
  }
  if (!options.dryRun) {
    for (const item of removed) rmSync(item.path);
  }
  return removed;
}
