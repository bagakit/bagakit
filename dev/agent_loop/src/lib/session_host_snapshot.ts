import fs from "node:fs";
import path from "node:path";

import type { RunnerResult } from "./model.ts";
import { loadJsonIfExists, readJsonFile } from "./io.ts";
import { AgentLoopPaths } from "./paths.ts";

export type SessionHostIssue = Readonly<{
  code: string;
  message: string;
}>;

export type SessionHostSnapshot = Readonly<{
  session_id: string;
  item_id: string;
  runner_name: string;
  started_at: string;
  exit_code: number | null;
  signal: string | null;
  runner_result: RunnerResult | null;
  paths: {
    session_dir: string;
    session_brief: string;
    session_meta: string;
    runner_result: string;
    prompt: string;
    stdout: string;
    stderr: string;
  };
  issues: SessionHostIssue[];
}>;

function loadSessionMeta(filePath: string): { item_id?: string; runner_name?: string; started_at?: string; exit_code: number | null; signal?: string } | null {
  try {
    return loadJsonIfExists<{ item_id?: string; runner_name?: string; started_at?: string; exit_code: number | null; signal?: string }>(filePath);
  } catch {
    return null;
  }
}

function issue(code: string, message: string): SessionHostIssue {
  return { code, message };
}

export function readSessionHostSnapshot(root: string, sessionId: string): SessionHostSnapshot {
  const paths = new AgentLoopPaths(root);
  const sessionDir = paths.sessionDir(sessionId);
  const briefPath = paths.sessionBrief(sessionId);
  const metaPath = path.join(sessionDir, "session-meta.json");
  const resultPath = paths.runnerResultFile(sessionId);
  const issues: SessionHostIssue[] = [];

  let itemId = "";
  let runnerName = "";
  let startedAt = "";
  try {
    const brief = readJsonFile<{ session_id: string; runner_name: string; started_at: string; item: { item_id: string } }>(briefPath);
    itemId = brief.item.item_id;
    runnerName = brief.runner_name;
    startedAt = brief.started_at;
  } catch (error) {
    issues.push(issue("brief_unreadable", error instanceof Error ? error.message : String(error)));
  }

  const meta = loadSessionMeta(metaPath);
  if (!itemId && meta?.item_id) {
    itemId = meta.item_id;
  }
  if (!runnerName && meta?.runner_name) {
    runnerName = meta.runner_name;
  }
  if (!startedAt && meta?.started_at) {
    startedAt = meta.started_at;
  }
  if (!meta && fs.existsSync(metaPath)) {
    issues.push(issue("meta_unreadable", "session-meta.json is unreadable"));
  }

  let runnerResult: RunnerResult | null = null;
  try {
    runnerResult = loadJsonIfExists<RunnerResult>(resultPath);
  } catch (error) {
    issues.push(issue("result_unreadable", error instanceof Error ? error.message : String(error)));
  }

  for (const required of ["prompt.txt", "stdout.txt", "stderr.txt"]) {
    if (!fs.existsSync(path.join(sessionDir, required))) {
      issues.push(issue("artifact_missing", `${required} is missing`));
    }
  }

  return {
    session_id: sessionId,
    item_id: itemId,
    runner_name: runnerName,
    started_at: startedAt,
    exit_code: meta?.exit_code ?? null,
    signal: meta?.signal ?? null,
    runner_result: runnerResult,
    paths: {
      session_dir: sessionDir,
      session_brief: briefPath,
      session_meta: metaPath,
      runner_result: resultPath,
      prompt: path.join(sessionDir, "prompt.txt"),
      stdout: path.join(sessionDir, "stdout.txt"),
      stderr: path.join(sessionDir, "stderr.txt"),
    },
    issues,
  };
}

export function listSessionHostSnapshots(root: string): SessionHostSnapshot[] {
  const paths = new AgentLoopPaths(root);
  if (!fs.existsSync(paths.sessionsDir)) {
    return [];
  }
  const entries = fs.readdirSync(paths.sessionsDir, { withFileTypes: true }) as Array<{ name: string; isDirectory(): boolean }>;
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => readSessionHostSnapshot(root, entry.name))
    .sort((left, right) => right.started_at.localeCompare(left.started_at));
}
