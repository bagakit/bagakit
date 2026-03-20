import path from "node:path";

import { loadAgentRunnerConfig } from "../../../agent_runner/src/lib/config.ts";
import { launchStdinRunnerSession } from "../../../agent_runner/src/lib/session.ts";
import type { AgentRunnerConfig, AgentRunnerLaunchResult } from "../../../agent_runner/src/lib/model.ts";
import type { EvalCaseContext } from "./model.ts";
import { ensureDir } from "./io.ts";

export interface EvalAgentSessionSpec {
  workspaceRoot: string;
  sessionId: string;
  workloadId: string;
  promptText: string;
  config?: AgentRunnerConfig;
  configFile?: string;
}

export interface EvalAgentSessionArtifacts {
  sessionDir: string;
  promptFile: string;
  stdoutFile: string;
  stderrFile: string;
  sessionMetaFile: string;
}

export interface EvalAgentSessionResult {
  artifacts: EvalAgentSessionArtifacts;
  launch: AgentRunnerLaunchResult;
}

export function runAgentEvalSession(
  context: EvalCaseContext,
  spec: EvalAgentSessionSpec,
): EvalAgentSessionResult {
  const config =
    spec.config ??
    (spec.configFile ? loadAgentRunnerConfig(spec.configFile) : null);
  if (!config) {
    throw new Error("runAgentEvalSession requires config or configFile");
  }
  const sessionDir = path.join(spec.workspaceRoot, ".bagakit", "eval-runner", "sessions", spec.sessionId);
  ensureDir(sessionDir);
  const artifacts: EvalAgentSessionArtifacts = {
    sessionDir,
    promptFile: path.join(sessionDir, "prompt.txt"),
    stdoutFile: path.join(sessionDir, "stdout.txt"),
    stderrFile: path.join(sessionDir, "stderr.txt"),
    sessionMetaFile: path.join(sessionDir, "session-meta.json"),
  };
  const launch = launchStdinRunnerSession({
    cwd: spec.workspaceRoot,
    session_id: spec.sessionId,
    workload_id: spec.workloadId,
    started_at: new Date().toISOString(),
    prompt_text: spec.promptText,
    template_context: {
      repo_root: spec.workspaceRoot,
      session_dir: artifacts.sessionDir,
    },
    config,
    paths: {
      session_dir: artifacts.sessionDir,
      prompt_file: artifacts.promptFile,
      stdout_file: artifacts.stdoutFile,
      stderr_file: artifacts.stderrFile,
      session_meta_file: artifacts.sessionMetaFile,
    },
  });
  context.addReplacement(spec.workspaceRoot, "<temp-repo>");
  return {
    artifacts,
    launch,
  };
}
