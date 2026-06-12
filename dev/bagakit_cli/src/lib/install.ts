import path from "node:path";

import { scanSkillInstallStatus } from "../../../../scripts/lib/skill/install_status.ts";
import {
  linkSkills as linkCanonicalSkills,
  ProtectedLinkConflictError,
  unlinkSkills as unlinkCanonicalSkills,
} from "../../../../scripts/lib/skill/linking.ts";
import { loadSkillInventory } from "../../../../scripts/lib/skill/discovery.ts";
import { resolveSkillSelector } from "../../../../scripts/lib/skill/selectors.ts";
import type { SkillInstallRecord, SkillInstallResult, SkillSource } from "./model.ts";
import { repoRelative } from "./paths.ts";

function targetLabel(targetRoot: string, targetPath: string): string {
  return repoRelative(targetRoot, targetPath);
}

function selectSkills(repoRoot: string, selector: string): SkillSource[] {
  return resolveSkillSelector(loadSkillInventory(repoRoot), selector).skills;
}

export function listInstallStatus(repoRoot: string, rawTargetRoot: string, selector = "all"): SkillInstallRecord[] {
  const targetRoot = path.resolve(rawTargetRoot);
  const skills = selectSkills(repoRoot, selector);
  return scanSkillInstallStatus(skills, targetRoot, repoRoot).map((record) => {
    const targetRelativePath = targetLabel(targetRoot, record.destinationPath);
    if (record.status === "missing") {
      return {
        skill: record.skill,
        targetPath: record.destinationPath,
        targetRelativePath,
        state: "missing",
      };
    }
    if (record.status === "conflict") {
      return {
        skill: record.skill,
        targetPath: record.destinationPath,
        targetRelativePath,
        state: "conflict",
        issue: record.detail,
      };
    }
    if (record.status === "stale") {
      return {
        skill: record.skill,
        targetPath: record.destinationPath,
        targetRelativePath,
        state: "wrong-link",
        issue: record.detail,
        canAutoReplace: record.detail.includes("previous canonical path") === true,
      };
    }
    return {
      skill: record.skill,
      targetPath: record.destinationPath,
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
  const skills = selectSkills(repoRoot, selector);
  const before = listInstallStatus(repoRoot, targetRoot, selector);
  const beforeById = new Map(before.map((record) => [record.skill.skillId, record]));
  try {
    const linked = linkCanonicalSkills(skills, {
      repoRoot,
      destDir: targetRoot,
      force: options.replace ?? false,
      dryRun: options.dryRun ?? false,
    });
    return linked.map((record) => ({
      skill: record.skill,
      targetPath: path.join(targetRoot, record.skill.skillId),
      targetRelativePath: targetLabel(targetRoot, path.join(targetRoot, record.skill.skillId)),
      action:
        record.status === "unchanged"
          ? "already-linked"
          : beforeById.get(record.skill.skillId)?.state === "wrong-link"
            ? "replace-link"
            : "link",
      changed: record.status !== "unchanged",
    }));
  } catch (error) {
    if (!(error instanceof ProtectedLinkConflictError)) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    const records = listInstallStatus(repoRoot, targetRoot, selector);
    return records.filter((record) => record.state !== "linked").map((record) => ({
      skill: record.skill,
      targetPath: record.targetPath,
      targetRelativePath: record.targetRelativePath,
      action: "skip-conflict",
      changed: false,
      issue: message,
    }));
  }
}

export function unlinkSkills(
  repoRoot: string,
  rawTargetRoot: string,
  selector: string,
  options: { dryRun?: boolean } = {},
): SkillInstallResult[] {
  const targetRoot = path.resolve(rawTargetRoot);
  const skills = selectSkills(repoRoot, selector);
  const before = listInstallStatus(repoRoot, targetRoot, selector);
  const linked = unlinkCanonicalSkills(skills, { repoRoot, destDir: targetRoot, force: false, dryRun: options.dryRun });
  const linkedById = new Map(linked.map((record) => [record.skill.skillId, record]));
  return before.map((record) => {
    const linkedRecord = linkedById.get(record.skill.skillId);
    if (linkedRecord) {
      return {
        skill: record.skill,
        targetPath: record.targetPath,
        targetRelativePath: record.targetRelativePath,
        action: "unlink",
        changed: true,
      };
    }
    if (record.state === "missing") {
      return {
        skill: record.skill,
        targetPath: record.targetPath,
        targetRelativePath: record.targetRelativePath,
        action: "missing",
        changed: false,
      };
    }
    return {
      skill: record.skill,
      targetPath: record.targetPath,
      targetRelativePath: record.targetRelativePath,
      action: "skip-conflict",
      changed: false,
      issue: record.issue ?? "target is not a link to this repository skill",
    };
  });
}
