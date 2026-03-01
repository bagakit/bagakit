import { lstatSync, readlinkSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";

import type { SkillSource } from "./model.ts";
import { scanCanonicalSkillDirs } from "./discovery.ts";
import { toRepoRelative } from "./paths.ts";

function addGrouped<T>(map: Map<string, T[]>, key: string, value: T): void {
  const existing = map.get(key);
  if (existing) {
    existing.push(value);
    return;
  }
  map.set(key, [value]);
}

function duplicateSkillIdIssue(skillId: string, matches: SkillSource[]): string {
  return `skill id must be globally unique across families: ${skillId}. found ${matches.map((skill) => skill.selector).join(", ")}`;
}

function collectSymlinkIssues(repoRoot: string, skillDir: string): string[] {
  const issues: string[] = [];
  const canonicalSkillRoot = realpathSync(skillDir);
  const stack = [skillDir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        const rawTarget = readlinkSync(entryPath);
        if (path.isAbsolute(rawTarget)) {
          issues.push(`installable skill symlink target must be relative: ${toRepoRelative(repoRoot, entryPath)}`);
          continue;
        }
        const resolvedTarget = path.resolve(path.dirname(entryPath), rawTarget);
        try {
          const resolved = realpathSync(resolvedTarget);
          const relative = path.relative(canonicalSkillRoot, resolved);
          if (relative !== "" && (relative === ".." || relative.startsWith(`..${path.sep}`))) {
            issues.push(`installable skill symlink must stay inside the skill directory: ${toRepoRelative(repoRoot, entryPath)}`);
          }
        } catch {
          issues.push(`installable skill symlink must resolve inside the skill directory: ${toRepoRelative(repoRoot, entryPath)}`);
        }
        continue;
      }
      if (entry.isDirectory()) {
        stack.push(entryPath);
      }
    }
  }
  return issues;
}

function collectPayloadManifestIssues(repoRoot: string, skillDir: string): string[] {
  const issues: string[] = [];
  const stack = [skillDir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }
      if (entry.name === "SKILL_PAYLOAD.json") {
        issues.push(`installable skill must not ship SKILL_PAYLOAD.json: ${toRepoRelative(repoRoot, entryPath)}`);
      }
    }
  }
  return issues;
}

function collectLocalNoiseIssues(repoRoot: string, skillDir: string): string[] {
  const issues: string[] = [];
  const stack = [skillDir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "__pycache__") {
          issues.push(`installable skill must not contain local noise: ${toRepoRelative(repoRoot, entryPath)}`);
          continue;
        }
        stack.push(entryPath);
        continue;
      }
      if (entry.name === ".DS_Store" || entry.name.endsWith(".pyc")) {
        issues.push(`installable skill must not contain local noise: ${toRepoRelative(repoRoot, entryPath)}`);
      }
    }
  }
  return issues;
}

export function checkCanonicalSkillLayout(repoRootArg: string): string[] {
  const repoRoot = path.resolve(repoRootArg);
  const scan = scanCanonicalSkillDirs(repoRoot);
  const issues = [...scan.issues];

  const skillsById = new Map<string, SkillSource[]>();
  for (const skill of scan.skills) {
    addGrouped(skillsById, skill.skillId, skill);
  }

  for (const [skillId, matches] of skillsById.entries()) {
    if (matches.length > 1) {
      issues.push(duplicateSkillIdIssue(skillId, matches));
    }
  }

  for (const skill of scan.skills) {
    try {
      const rootStat = lstatSync(skill.absoluteDir);
      if (rootStat.isSymbolicLink()) {
        issues.push(`skill source root must not be a symlink: ${skill.relativeDir}`);
      }
    } catch {
      issues.push(`skill source directory disappeared during layout check: ${skill.relativeDir}`);
      continue;
    }

    issues.push(...collectPayloadManifestIssues(repoRoot, skill.absoluteDir));
    issues.push(...collectLocalNoiseIssues(repoRoot, skill.absoluteDir));
    issues.push(...collectSymlinkIssues(repoRoot, skill.absoluteDir));
  }

  return issues;
}
