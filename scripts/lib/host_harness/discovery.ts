import { existsSync, lstatSync, readdirSync } from "node:fs";
import path from "node:path";

import type { HostHarnessInventory, HostHarnessSource } from "./model.ts";
import { toRepoRelative } from "../skill/paths.ts";

function compareHarnesses(left: HostHarnessSource, right: HostHarnessSource): number {
  return left.selector.localeCompare(right.selector);
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

function buildHostHarnessSource(repoRoot: string, harnessId: string): HostHarnessSource {
  const relativeDir = `host-harnesses/${harnessId}`;
  return {
    harnessId,
    selector: harnessId,
    relativeDir,
    absoluteDir: path.join(repoRoot, relativeDir),
  };
}

export type HostHarnessDiscoveryScan = Readonly<{
  repoRoot: string;
  harnessesRoot: string;
  harnesses: HostHarnessSource[];
  issues: string[];
}>;

export function scanHostHarnessDirs(repoRootArg: string): HostHarnessDiscoveryScan {
  const repoRoot = path.resolve(repoRootArg);
  const harnessesRoot = path.join(repoRoot, "host-harnesses");
  const issues: string[] = [];
  const harnesses: HostHarnessSource[] = [];

  if (!existsSync(harnessesRoot)) {
    return {
      repoRoot,
      harnessesRoot,
      harnesses,
      issues: [`missing host harness root: ${toRepoRelative(repoRoot, harnessesRoot)}`],
    };
  }

  const rootStat = lstatSync(harnessesRoot);
  if (rootStat.isSymbolicLink()) {
    return {
      repoRoot,
      harnessesRoot,
      harnesses,
      issues: [`host harness root must not be a symlink: ${toRepoRelative(repoRoot, harnessesRoot)}`],
    };
  }
  if (!rootStat.isDirectory()) {
    return {
      repoRoot,
      harnessesRoot,
      harnesses,
      issues: [`host harness root is not a directory: ${toRepoRelative(repoRoot, harnessesRoot)}`],
    };
  }

  for (const harnessEntry of readdirSync(harnessesRoot, { withFileTypes: true })) {
    const harnessDir = path.join(harnessesRoot, harnessEntry.name);
    const harnessRelDir = toRepoRelative(repoRoot, harnessDir);
    if (harnessEntry.isSymbolicLink()) {
      issues.push(`host harness source root must not be a symlink: ${harnessRelDir}`);
      continue;
    }
    if (!harnessEntry.isDirectory()) {
      continue;
    }

    let harnessId: string;
    try {
      harnessId = assertSafeSegment(harnessEntry.name, `host harness id ${harnessRelDir}`);
    } catch (error) {
      issues.push(error instanceof Error ? error.message : String(error));
      continue;
    }

    const skillPath = path.join(harnessDir, "SKILL.md");
    const harnessTomlPath = path.join(harnessDir, "harness.toml");
    const templatePath = path.join(harnessDir, "host-template");
    if (!existsSync(skillPath)) {
      issues.push(`host harness source missing SKILL.md: ${harnessRelDir}`);
      continue;
    }
    if (!existsSync(harnessTomlPath)) {
      issues.push(`host harness source missing harness.toml: ${harnessRelDir}`);
      continue;
    }
    if (!existsSync(templatePath) || !lstatSync(templatePath).isDirectory()) {
      issues.push(`host harness source missing host-template directory: ${harnessRelDir}`);
      continue;
    }

    harnesses.push(buildHostHarnessSource(repoRoot, harnessId));
  }

  harnesses.sort(compareHarnesses);

  return {
    repoRoot,
    harnessesRoot,
    harnesses,
    issues,
  };
}

export function loadHostHarnessInventory(repoRoot: string): HostHarnessInventory {
  const scan = scanHostHarnessDirs(repoRoot);
  if (scan.issues.length > 0) {
    throw new Error(`host harness discovery failed:\n${scan.issues.join("\n")}`);
  }

  const harnessesById = new Map<string, HostHarnessSource>();
  for (const harness of scan.harnesses) {
    if (harnessesById.has(harness.harnessId)) {
      throw new Error(`duplicate host harness id in directory protocol: ${harness.harnessId}`);
    }
    harnessesById.set(harness.harnessId, harness);
  }

  return {
    repoRoot: scan.repoRoot,
    harnessesRoot: scan.harnessesRoot,
    harnesses: scan.harnesses,
    harnessesById,
  };
}
