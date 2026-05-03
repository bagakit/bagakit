import { lstatSync, mkdirSync, readlinkSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";

import type { LinkResult, SkillSource } from "./model.ts";
import { displayPath } from "./paths.ts";

type PlannedAction = "create" | "replace" | "unchanged";

type ExistingLinkInspection = Readonly<{
  action: PlannedAction;
  replaceRequiresForce: boolean;
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

function isRepoSkillProjectionTarget(repoRoot: string, candidateTarget: string, skill: SkillSource): boolean {
  const skillsRoot = path.join(path.resolve(repoRoot), "skills");
  const relative = path.relative(skillsRoot, path.resolve(candidateTarget));
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    return false;
  }

  const parts = relative.split(path.sep);
  return parts.length === 2 && parts[0] !== "" && parts[1] === skill.skillId;
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
          return { action: "unchanged", replaceRequiresForce: false };
        }
      } catch {
        return {
          action: "replace",
          replaceRequiresForce: !isRepoSkillProjectionTarget(repoRoot, resolvedTarget, skill),
        };
      }

      return {
        action: "replace",
        replaceRequiresForce: !isRepoSkillProjectionTarget(repoRoot, resolvedTarget, skill),
      };
    }
    return { action: "replace", replaceRequiresForce: true };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { action: "create", replaceRequiresForce: false };
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
    if (inspection.action === "replace" && inspection.replaceRequiresForce && !options.force) {
      conflicts.push(`- ${displayPath(options.repoRoot, linkPath)} already exists and does not point to ${skill.selector}`);
      continue;
    }
    plan.push({ skill, linkPath, action: inspection.action });
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
