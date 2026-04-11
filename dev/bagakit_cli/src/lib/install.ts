import fs from "node:fs";
import path from "node:path";

import type { SkillInstallRecord, SkillInstallResult, SkillSource } from "./model.ts";
import { repoRelative } from "./paths.ts";
import { discoverSkills } from "./skills.ts";

function normalizeForCompare(value: string): string {
  return path.resolve(value);
}

function compareSkills(left: SkillSource, right: SkillSource): number {
  return left.selector.localeCompare(right.selector);
}

function targetPathFor(targetRoot: string, skill: SkillSource): string {
  return path.join(targetRoot, skill.skillId);
}

function targetLabel(targetRoot: string, targetPath: string): string {
  return repoRelative(targetRoot, targetPath);
}

function targetStats(targetPath: string) {
  try {
    return fs.lstatSync(targetPath);
  } catch (error) {
    const code = typeof error === "object" && error ? (error as { code?: string }).code : undefined;
    if (code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function selectSkills(repoRoot: string, selector: string): SkillSource[] {
  const skills = discoverSkills(repoRoot);
  if (selector === "all") {
    return skills;
  }
  const matches = skills.filter((skill) => skill.selector === selector || skill.skillId === selector);
  if (matches.length === 0) {
    throw new Error(`unknown skill selector: ${selector}`);
  }
  if (matches.length > 1) {
    throw new Error(`ambiguous skill selector ${selector}: ${matches.map((skill) => skill.selector).join(", ")}`);
  }
  return matches;
}

export function listInstallStatus(repoRoot: string, rawTargetRoot: string, selector = "all"): SkillInstallRecord[] {
  const targetRoot = path.resolve(rawTargetRoot);
  const skills = selectSkills(repoRoot, selector);
  return skills.sort(compareSkills).map((skill) => {
    const targetPath = targetPathFor(targetRoot, skill);
    const targetRelativePath = targetLabel(targetRoot, targetPath);
    const stats = targetStats(targetPath);
    if (!stats) {
      return {
        skill,
        targetPath,
        targetRelativePath,
        state: "missing",
      };
    }
    if (!stats.isSymbolicLink()) {
      return {
        skill,
        targetPath,
        targetRelativePath,
        state: "conflict",
        issue: "target exists and is not a symbolic link",
      };
    }
    const rawTarget = fs.readlinkSync(targetPath);
    const linkedTarget = path.resolve(path.dirname(targetPath), rawTarget);
    if (normalizeForCompare(linkedTarget) !== normalizeForCompare(skill.absoluteDir)) {
      return {
        skill,
        targetPath,
        targetRelativePath,
        state: "wrong-link",
        issue: "target symbolic link points somewhere else",
      };
    }
    return {
      skill,
      targetPath,
      targetRelativePath,
      state: "linked",
    };
  });
}

export function linkSkills(
  repoRoot: string,
  rawTargetRoot: string,
  selector: string,
  options: { dryRun?: boolean; replace?: boolean } = {},
): SkillInstallResult[] {
  const targetRoot = path.resolve(rawTargetRoot);
  const records = listInstallStatus(repoRoot, targetRoot, selector);
  const results: SkillInstallResult[] = [];
  if (!options.dryRun) {
    fs.mkdirSync(targetRoot, { recursive: true });
  }

  for (const record of records) {
    if (record.state === "linked") {
      results.push({
        skill: record.skill,
        targetPath: record.targetPath,
        targetRelativePath: record.targetRelativePath,
        action: "already-linked",
        changed: false,
      });
      continue;
    }

    if (record.state === "missing") {
      if (!options.dryRun) {
        fs.symlinkSync(record.skill.absoluteDir, record.targetPath, "dir");
      }
      results.push({
        skill: record.skill,
        targetPath: record.targetPath,
        targetRelativePath: record.targetRelativePath,
        action: "link",
        changed: true,
      });
      continue;
    }

    if (record.state === "wrong-link" && options.replace) {
      if (!options.dryRun) {
        fs.rmSync(record.targetPath);
        fs.symlinkSync(record.skill.absoluteDir, record.targetPath, "dir");
      }
      results.push({
        skill: record.skill,
        targetPath: record.targetPath,
        targetRelativePath: record.targetRelativePath,
        action: "replace-link",
        changed: true,
      });
      continue;
    }

    results.push({
      skill: record.skill,
      targetPath: record.targetPath,
      targetRelativePath: record.targetRelativePath,
      action: "skip-conflict",
      changed: false,
      issue: record.issue ?? "target cannot be linked safely",
    });
  }

  return results;
}

export function unlinkSkills(
  repoRoot: string,
  rawTargetRoot: string,
  selector: string,
  options: { dryRun?: boolean } = {},
): SkillInstallResult[] {
  const targetRoot = path.resolve(rawTargetRoot);
  const records = listInstallStatus(repoRoot, targetRoot, selector);
  const results: SkillInstallResult[] = [];

  for (const record of records) {
    if (record.state === "linked") {
      if (!options.dryRun) {
        fs.rmSync(record.targetPath);
      }
      results.push({
        skill: record.skill,
        targetPath: record.targetPath,
        targetRelativePath: record.targetRelativePath,
        action: "unlink",
        changed: true,
      });
      continue;
    }
    if (record.state === "missing") {
      results.push({
        skill: record.skill,
        targetPath: record.targetPath,
        targetRelativePath: record.targetRelativePath,
        action: "missing",
        changed: false,
      });
      continue;
    }
    results.push({
      skill: record.skill,
      targetPath: record.targetPath,
      targetRelativePath: record.targetRelativePath,
      action: "skip-conflict",
      changed: false,
      issue: record.issue ?? "target is not a link to this repository skill",
    });
  }

  return results;
}
