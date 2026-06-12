import path from "node:path";
import { spawnSync } from "node:child_process";

import type { HostHarnessInitResult, HostHarnessSource } from "./model.ts";

export type HostHarnessInitOptions = Readonly<{
  hostRoot: string;
  force: boolean;
}>;

function resolveInitScript(harness: HostHarnessSource): string {
  return path.join(harness.absoluteDir, harness.initEntrypoint);
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
