import type { RunnerConfig } from "./model.ts";

export type RunnerTruthClass = "first_class_agent" | "generic_process";

function normalizedName(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  const segments = trimmed.split(/[\\/]/).filter((segment) => segment.length > 0);
  return segments[segments.length - 1] || trimmed;
}

export function runnerTruthClass(config: RunnerConfig): RunnerTruthClass {
  const configured = normalizedName(config.runner_name || "");
  const head = normalizedName(config.argv[0] || "");
  const next = normalizedName(config.argv[1] || "");
  if (
    configured === "codex" ||
    configured === "codexl" ||
    configured === "claude" ||
    head === "codex" ||
    head === "codexl" ||
    head === "claude" ||
    ((head === "npx" || head === "pnpm" || head === "pnpx" || head === "bunx" || head === "yarn") &&
      (next === "codex" || next === "codexl" || next === "claude"))
  ) {
    return "first_class_agent";
  }
  return "generic_process";
}

export function shouldUseHostTimeout(config: RunnerConfig): boolean {
  return runnerTruthClass(config) === "generic_process";
}
