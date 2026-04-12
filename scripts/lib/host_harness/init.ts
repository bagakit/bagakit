import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import type { HostHarnessInitResult, HostHarnessSource } from "./model.ts";

export type HostHarnessInitOptions = Readonly<{
  hostRoot: string;
  force: boolean;
}>;

function candidateInitScripts(harness: HostHarnessSource): string[] {
  const unprefixed = harness.harnessId.startsWith("bagakit-")
    ? harness.harnessId.slice("bagakit-".length)
    : harness.harnessId;
  return [
    path.join(harness.absoluteDir, "scripts", `${unprefixed}.sh`),
    path.join(harness.absoluteDir, "scripts", `${harness.harnessId}.sh`),
  ];
}

function resolveInitScript(harness: HostHarnessSource): string {
  for (const candidate of candidateInitScripts(harness)) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(`host harness ${harness.harnessId} has no conventional init script under scripts/`);
}

export function initializeHostHarness(
  harness: HostHarnessSource,
  options: HostHarnessInitOptions,
): HostHarnessInitResult {
  const initScript = resolveInitScript(harness);
  const args = [initScript, "init", "--root", options.hostRoot];
  if (options.force) {
    args.push("--force");
  }

  const result = spawnSync("sh", args, {
    cwd: harness.absoluteDir,
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const details = `${result.stderr ?? ""}${result.stdout ?? ""}`.trim();
    throw new Error(`host harness init failed for ${harness.harnessId}: ${details || "unknown error"}`);
  }

  return {
    harness,
    hostRoot: options.hostRoot,
  };
}
