import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import type { HostHarnessPackageResult, HostHarnessSource } from "./model.ts";
import { displayPath } from "../skill/paths.ts";

export type HostHarnessPackageOptions = Readonly<{
  repoRoot: string;
  distDir: string;
  clean: boolean;
}>;

function ensureZipAvailable(): void {
  const result = spawnSync("zip", ["-v"], { stdio: "ignore" });
  if (result.error) {
    const code = (result.error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error("zip command not found; install zip to use host-harness-distribute-package");
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
      `refusing to clean host harness dist directory outside the repository: ${displayPath(repoRootResolved, distDirResolved)}`,
    );
  }
  if (distDirResolved === repoRootResolved || distDirResolved === os.homedir() || distDirResolved === pathRoot) {
    throw new Error(
      `refusing to clean unsafe host harness dist directory: ${displayPath(repoRootResolved, distDirResolved)}`,
    );
  }
}

export function distributeHostHarnessPackages(
  harnesses: HostHarnessSource[],
  options: HostHarnessPackageOptions,
): HostHarnessPackageResult[] {
  ensureZipAvailable();

  if (options.clean) {
    assertSafeCleanTarget(options.repoRoot, options.distDir);
    rmSync(options.distDir, { recursive: true, force: true });
  }
  mkdirSync(options.distDir, { recursive: true });

  const stagingRoot = mkdtempSync(path.join(os.tmpdir(), "bagakit-host-harness-package-"));
  const results: HostHarnessPackageResult[] = [];
  try {
    for (const harness of harnesses) {
      const stagingParent = path.join(stagingRoot, harness.harnessId);
      const stagedHarnessDir = path.join(stagingParent, harness.harnessId);
      mkdirSync(stagingParent, { recursive: true });
      cpSync(harness.absoluteDir, stagedHarnessDir, {
        recursive: true,
        force: true,
        verbatimSymlinks: true,
      });

      const archivePath = path.join(options.distDir, `${harness.harnessId}.host-harness`);
      mkdirSync(options.distDir, { recursive: true });
      rmSync(archivePath, { force: true });
      runZipArchive(stagingParent, harness.harnessId, archivePath);

      results.push({
        harness,
        archivePath: displayPath(options.repoRoot, archivePath),
      });
    }
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }

  return results;
}
