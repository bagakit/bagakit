import { lstatSync, readlinkSync, realpathSync } from "node:fs";
import path from "node:path";

import type { SkillSource } from "./model.ts";

export type InstallStatus = "installed" | "missing" | "stale" | "conflict";

export type SkillInstallStatusResult = Readonly<{
  skill: SkillSource;
  status: InstallStatus;
  destinationPath: string;
  sourcePath: string;
  existingTargetPath: string | null;
  detail: string;
}>;

function missing(pathToCheck: string, skill: SkillSource): SkillInstallStatusResult {
  return {
    skill,
    status: "missing",
    destinationPath: pathToCheck,
    sourcePath: skill.absoluteDir,
    existingTargetPath: null,
    detail: "no installed skill path exists for this skill id",
  };
}

function stale(pathToCheck: string, skill: SkillSource, existingTargetPath: string, detail: string): SkillInstallStatusResult {
  return {
    skill,
    status: "stale",
    destinationPath: pathToCheck,
    sourcePath: skill.absoluteDir,
    existingTargetPath,
    detail,
  };
}

function conflict(pathToCheck: string, skill: SkillSource, detail: string): SkillInstallStatusResult {
  return {
    skill,
    status: "conflict",
    destinationPath: pathToCheck,
    sourcePath: skill.absoluteDir,
    existingTargetPath: null,
    detail,
  };
}

export function scanSkillInstallStatus(skills: SkillSource[], destDir: string): SkillInstallStatusResult[] {
  return skills.map((skill) => {
    const destinationPath = path.join(destDir, skill.skillId);
    let stat;
    try {
      stat = lstatSync(destinationPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return missing(destinationPath, skill);
      }
      throw error;
    }

    if (!stat.isSymbolicLink()) {
      return conflict(destinationPath, skill, "destination exists but is not a symlink installed from this repository");
    }

    const rawTarget = readlinkSync(destinationPath);
    const existingTargetPath = path.resolve(path.dirname(destinationPath), rawTarget);
    const sourceCanonicalPath = realpathSync.native(skill.absoluteDir);
    let existingCanonicalPath: string;
    try {
      existingCanonicalPath = realpathSync.native(existingTargetPath);
    } catch {
      return stale(destinationPath, skill, existingTargetPath, "destination symlink target cannot be resolved");
    }

    if (existingCanonicalPath !== sourceCanonicalPath) {
      return stale(destinationPath, skill, existingTargetPath, "destination symlink points to a different skill source");
    }

    return {
      skill,
      status: "installed",
      destinationPath,
      sourcePath: skill.absoluteDir,
      existingTargetPath,
      detail: "destination symlink resolves to the canonical skill source",
    };
  });
}
