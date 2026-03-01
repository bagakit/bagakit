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

  for (const familyEntry of readdirSync(skillsRoot, { withFileTypes: true })) {
    const familyDir = path.join(skillsRoot, familyEntry.name);
    const familyRelDir = toRepoRelative(repoRoot, familyDir);
    if (familyEntry.isSymbolicLink()) {
      issues.push(`skill family directory must not be a symlink: ${familyRelDir}`);
      continue;
    }
    if (!familyEntry.isDirectory()) {
      continue;
    }

    let family: string;
    try {
      family = assertSafeSegment(familyEntry.name, `family ${familyRelDir}`);
    } catch (error) {
      issues.push(error instanceof Error ? error.message : String(error));
      continue;
    }

    if (existsSync(path.join(familyDir, "SKILL.md"))) {
      issues.push(
        `flat installable skill root is forbidden: ${familyRelDir}. move it to skills/<family>/<skill-id>/`,
      );
      continue;
    }

    for (const skillEntry of readdirSync(familyDir, { withFileTypes: true })) {
      const skillDir = path.join(familyDir, skillEntry.name);
      const skillRelDir = toRepoRelative(repoRoot, skillDir);
      if (skillEntry.isSymbolicLink()) {
        if (existsSync(path.join(skillDir, "SKILL.md"))) {
          issues.push(`skill source root must not be a symlink: ${skillRelDir}`);
        }
        continue;
      }
      if (!skillEntry.isDirectory()) {
        continue;
      }
      if (!existsSync(path.join(skillDir, "SKILL.md"))) {
        continue;
      }

      let skillId: string;
      try {
        skillId = assertSafeSegment(skillEntry.name, `skill id ${skillRelDir}`);
      } catch (error) {
        issues.push(error instanceof Error ? error.message : String(error));
        continue;
      }

      skills.push(buildSkillSource(repoRoot, family, skillId));
    }
  }

  skills.sort(compareSkills);

  return {
    repoRoot,
    skillsRoot,
    skills,
    issues,
  };
}

export function loadSkillInventory(repoRoot: string): SkillInventory {
  const scan = scanCanonicalSkillDirs(repoRoot);
  if (scan.issues.length > 0) {
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
    addGrouped(skillsByFamily, skill.family, skill);
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
