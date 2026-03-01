import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import type { PackageResult, SkillSource } from "./model.ts";
import { displayPath } from "./paths.ts";

export type PackageOptions = Readonly<{
  repoRoot: string;
  distDir: string;
  clean: boolean;
}>;

function ensureZipAvailable(): void {
  const result = spawnSync("zip", ["-v"], { stdio: "ignore" });
  if (result.error) {
    const code = (result.error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error("zip command not found; install zip to use distribute-package");
    }
    throw result.error;
  }
}

function runZipArchive(stageParent: string, entryName: string, archivePath: string): void {
  const result = spawnSync("zip", ["-qyr", archivePath, entryName], {
    cwd: stageParent,
    encoding: "utf8",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const details = `${result.stderr ?? ""}${result.stdout ?? ""}`.trim();
    throw new Error(`zip failed for ${entryName}: ${details || "unknown error"}`);
  }
}

function assertSafeCleanTarget(repoRoot: string, distDir: string): void {
  const repoRootResolved = path.resolve(repoRoot);
  const distDirResolved = path.resolve(distDir);
  const pathRoot = path.parse(distDirResolved).root;
  const insideRepo =
    distDirResolved === repoRootResolved || distDirResolved.startsWith(`${repoRootResolved}${path.sep}`);
  if (!insideRepo) {
    throw new Error(
      `refusing to clean dist directory outside the repository: ${displayPath(repoRootResolved, distDirResolved)}`,
    );
  }
  if (distDirResolved === repoRootResolved || distDirResolved === os.homedir() || distDirResolved === pathRoot) {
    throw new Error(`refusing to clean unsafe dist directory: ${displayPath(repoRootResolved, distDirResolved)}`);
  }
}

export function distributePackages(skills: SkillSource[], options: PackageOptions): PackageResult[] {
  ensureZipAvailable();

  if (options.clean) {
    assertSafeCleanTarget(options.repoRoot, options.distDir);
    rmSync(options.distDir, { recursive: true, force: true });
  }
  mkdirSync(options.distDir, { recursive: true });

  const stagingRoot = mkdtempSync(path.join(os.tmpdir(), "bagakit-skill-package-"));
  const results: PackageResult[] = [];
  try {
    for (const skill of skills) {
      const stagingParent = path.join(stagingRoot, `${skill.family}-${skill.skillId}`);
      const stagedSkillDir = path.join(stagingParent, skill.skillId);
      mkdirSync(stagingParent, { recursive: true });
      cpSync(skill.absoluteDir, stagedSkillDir, {
        recursive: true,
        force: true,
        verbatimSymlinks: true,
      });

      const archiveDir = path.join(options.distDir, skill.family);
      const archivePath = path.join(archiveDir, `${skill.skillId}.skill`);
      mkdirSync(archiveDir, { recursive: true });
      rmSync(archivePath, { force: true });
      runZipArchive(stagingParent, skill.skillId, archivePath);

      results.push({
        skill,
        archivePath: displayPath(options.repoRoot, archivePath),
      });
    }
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }

  return results;
}
