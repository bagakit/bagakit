import { lstatSync, mkdirSync, readlinkSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";

import type { LinkResult, SkillSource } from "./model.ts";
import { displayPath } from "./paths.ts";

type PlannedAction = "create" | "replace" | "unchanged";

type PlannedLink = Readonly<{
  skill: SkillSource;
  linkPath: string;
  action: PlannedAction;
}>;

export type LinkOptions = Readonly<{
  repoRoot: string;
  destDir: string;
  force: boolean;
}>;

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

function inspectExistingLink(linkPath: string, targetPath: string): PlannedAction {
  try {
    const stat = lstatSync(linkPath);
    if (stat.isSymbolicLink()) {
      const rawTarget = readlinkSync(linkPath);
      const resolvedTarget = path.resolve(path.dirname(linkPath), rawTarget);
      const canonicalTarget = realpathSync.native(targetPath);
      try {
        const existingTarget = realpathSync.native(resolvedTarget);
        if (existingTarget === canonicalTarget) {
          return "unchanged";
        }
      } catch {
        return "replace";
      }
    }
    return "replace";
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return "create";
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
    const action = inspectExistingLink(linkPath, skill.absoluteDir);
    if (action === "replace" && !options.force) {
      conflicts.push(`- ${displayPath(options.repoRoot, linkPath)} already exists and does not point to ${skill.selector}`);
      continue;
    }
    plan.push({ skill, linkPath, action });
  }

  if (conflicts.length > 0) {
    throw new Error(`link would overwrite existing paths; rerun with --force to replace them:\n${conflicts.join("\n")}`);
  }

  return plan;
}

export function linkSkills(skills: SkillSource[], options: LinkOptions): LinkResult[] {
  const plan = planLinkOperations(skills, options);
  mkdirSync(options.destDir, { recursive: true });

  const results: LinkResult[] = [];
  for (const item of plan) {
    if (item.action === "replace") {
      rmSync(item.linkPath, { recursive: true, force: true });
    }
    if (item.action === "create" || item.action === "replace") {
      symlinkSync(item.skill.absoluteDir, item.linkPath, "dir");
    }

    results.push({
      skill: item.skill,
      status: item.action === "unchanged" ? "unchanged" : "linked",
      destinationPath: displayPath(options.repoRoot, item.linkPath),
      sourcePath: item.skill.relativeDir,
    });
  }

  return results;
}
