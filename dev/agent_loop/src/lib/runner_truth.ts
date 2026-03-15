import type { RunnerConfig } from "./model.ts";

export type RunnerTruthClass = "first_class_agent" | "generic_process";

function normalizedHead(config: RunnerConfig): string {
  return (config.argv[0] || config.runner_name || "").trim().toLowerCase();
}

export function runnerTruthClass(config: RunnerConfig): RunnerTruthClass {
  const head = normalizedHead(config);
  if (head === "codex" || head === "codexl" || head === "claude") {
    return "first_class_agent";
  }
  return "generic_process";
}

export function shouldUseHostTimeout(config: RunnerConfig): boolean {
  return runnerTruthClass(config) === "generic_process";
}
