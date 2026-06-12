import { existsSync, lstatSync, readdirSync } from "node:fs";
import path from "node:path";

import type { SkillInventory, SkillSource } from "./model.ts";
import { toRepoRelative } from "./paths.ts";

function compareSkills(left: SkillSource, right: SkillSource): number {
  return left.selector.localeCompare(right.selector);
}

function addGrouped<T>(map: Map<string, T[]>, key: string, value: T): void {
  const existing = map.get(key);
  if (existing) {
    existing.push(value);
    return;
  }
  map.set(key, [value]);
}

function assertSafeSegment(raw: string, label: string): string {
  const value = raw.trim();
  if (value === "") {
    throw new Error(`${label} must not be empty`);
  }
  if (value === "." || value === ".." || value.includes("/") || value.includes("\\")) {
    throw new Error(`${label} must be a safe single path segment`);
  }
  return value;
}

function duplicateSkillIdError(skillId: string, matches: SkillSource[]): Error {
  return new Error(
    `skill id must be globally unique across families: ${skillId}. found ${matches.map((skill) => skill.selector).join(", ")}`,
  );
}

function buildSkillSource(repoRoot: string, family: string, skillId: string): SkillSource {
  const relativeDir = `skills/${family}/${skillId}`;
  return {
    family,
    skillId,
    selector: `${family}/${skillId}`,
    relativeDir,
    absoluteDir: path.join(repoRoot, relativeDir),
  };
}

export type SkillDiscoveryScan = Readonly<{
  repoRoot: string;
  skillsRoot: string;
  skills: SkillSource[];
  issues: string[];
}>;

export function scanCanonicalSkillDirs(repoRootArg: string): SkillDiscoveryScan {
  const repoRoot = path.resolve(repoRootArg);
  const skillsRoot = path.join(repoRoot, "skills");
  const issues: string[] = [];
  const skills: SkillSource[] = [];

  if (!existsSync(skillsRoot)) {
    return {
      repoRoot,
      skillsRoot,
      skills,
      issues: [`missing installable skills root: ${toRepoRelative(repoRoot, skillsRoot)}`],
    };
  }

  const skillsRootStat = lstatSync(skillsRoot);
  if (skillsRootStat.isSymbolicLink()) {
    return {
      repoRoot,
      skillsRoot,
      skills,
      issues: [`installable skills root must not be a symlink: ${toRepoRelative(repoRoot, skillsRoot)}`],
    };
  }
  if (!skillsRootStat.isDirectory()) {
    return {
      repoRoot,
      skillsRoot,
      skills,
      issues: [`installable skills root is not a directory: ${toRepoRelative(repoRoot, skillsRoot)}`],
    };
  }

  function visit(directory: string, segments: string[]): void {
    const entrypoint = path.join(directory, "SKILL.md");
    if (existsSync(entrypoint)) {
      if (segments.length < 2) {
        issues.push(`flat installable skill root is forbidden: ${toRepoRelative(repoRoot, directory)}. move it to skills/<group-path>/<skill-id>/`);
      } else if (!lstatSync(entrypoint).isFile()) {
        issues.push(`skill entrypoint must be a regular file: ${toRepoRelative(repoRoot, entrypoint)}`);
      } else {
        skills.push(buildSkillSource(repoRoot, segments.slice(0, -1).join("/"), segments.at(-1)!));
      }
      // The entire payload belongs to this install unit, including its templates.
      return;
    }
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const child = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        issues.push(`skill group or source directory must not be a symlink: ${toRepoRelative(repoRoot, child)}`);
        continue;
      }
      if (!entry.isDirectory()) continue;
      try {
        const segment = assertSafeSegment(entry.name, `group ${toRepoRelative(repoRoot, child)}`);
        visit(child, [...segments, segment]);
      } catch (error) {
        issues.push(error instanceof Error ? error.message : String(error));
      }
    }
  }
  visit(skillsRoot, []);

  skills.sort(compareSkills);

  return {
    repoRoot,
    skillsRoot,
    skills,
    issues,
  };
}

export function loadSkillInventory(repoRoot: string, options: { allowMissingRoot?: boolean } = {}): SkillInventory {
  const scan = scanCanonicalSkillDirs(repoRoot);
  const onlyMissingRoot =
    scan.issues.length === 1 && scan.issues[0] === `missing installable skills root: ${toRepoRelative(scan.repoRoot, scan.skillsRoot)}`;
  if (scan.issues.length > 0 && !(options.allowMissingRoot && onlyMissingRoot)) {
    throw new Error(`skill discovery failed:\n${scan.issues.join("\n")}`);
  }

  const skillsBySelector = new Map<string, SkillSource>();
  const skillsByFamily = new Map<string, SkillSource[]>();
  const skillsById = new Map<string, SkillSource[]>();
  for (const skill of scan.skills) {
    if (skillsBySelector.has(skill.selector)) {
      throw new Error(`duplicate skill selector in directory protocol: ${skill.selector}`);
    }
    skillsBySelector.set(skill.selector, skill);
    const groups = skill.family.split("/");
    for (let depth = 1; depth <= groups.length; depth++) {
      addGrouped(skillsByFamily, groups.slice(0, depth).join("/"), skill);
    }
    addGrouped(skillsById, skill.skillId, skill);
  }

  for (const [skillId, matches] of skillsById.entries()) {
    if (matches.length > 1) {
      throw duplicateSkillIdError(skillId, matches);
    }
  }

  return {
    repoRoot: scan.repoRoot,
    skillsRoot: scan.skillsRoot,
    skills: scan.skills,
    skillsBySelector,
    skillsByFamily,
    skillsById,
  };
}
