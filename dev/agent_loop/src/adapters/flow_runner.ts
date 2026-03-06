import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import type { FlowItemState, FlowNextPayload, FlowResumeCandidatesPayload } from "../lib/model.ts";
import { readJsonFile, readText } from "../lib/io.ts";

function flowRunnerScript(root: string): string {
  return path.join(root, "skills", "harness", "bagakit-flow-runner", "scripts", "flow-runner.sh");
}

export function flowRunnerCommand(root: string): string[] {
  const script = flowRunnerScript(root);
  if (!fs.existsSync(script)) {
    throw new Error(`bagakit-flow-runner script is missing: ${path.relative(root, script)}`);
  }
  return ["bash", path.relative(root, script).split(path.sep).join("/")];
}

function runFlowRunner(root: string, args: string[], options: { input?: string; allowFailure?: boolean } = {}): any {
  const command = flowRunnerCommand(root);
  const result = spawnSync(command[0], [...command.slice(1), ...args], {
    cwd: root,
    encoding: "utf8",
    input: options.input,
  });
  if (!options.allowFailure && result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "flow-runner command failed").trim());
  }
  return result;
}

export function loadNextAction(root: string, itemId?: string): FlowNextPayload {
  const args = ["next", "--root", ".", "--json"];
  if (itemId) {
    args.push("--item", itemId);
  }
  const result = runFlowRunner(root, args);
  return JSON.parse(result.stdout) as FlowNextPayload;
}

export function loadResumeCandidates(root: string): FlowResumeCandidatesPayload {
  const result = runFlowRunner(root, ["resume-candidates", "--root", ".", "--json"]);
  return JSON.parse(result.stdout) as FlowResumeCandidatesPayload;
}

export function validateFlowRunner(root: string): void {
  runFlowRunner(root, ["validate", "--root", "."]);
}

export function captureSnapshot(root: string, itemId: string, label: string): void {
  runFlowRunner(root, ["snapshot", "--root", ".", "--item", itemId, "--label", label, "--json"]);
}

export function appendCheckpoint(
  root: string,
  itemId: string,
  stage: string,
  sessionStatus: string,
  objective: string,
  attempted: string,
  resultText: string,
  nextAction: string,
  cleanState: string,
  itemStatus?: string,
): void {
  const args = [
    "checkpoint",
    "--root",
    ".",
    "--item",
    itemId,
    "--stage",
    stage,
    "--session-status",
    sessionStatus,
    "--objective",
    objective,
    "--attempted",
    attempted,
    "--result",
    resultText,
    "--next-action",
    nextAction,
    "--clean-state",
    cleanState,
    "--json",
  ];
  if (itemStatus) {
    args.push("--item-status", itemStatus);
  }
  runFlowRunner(root, args);
}

export function archiveItem(root: string, itemId: string): void {
  runFlowRunner(root, ["archive-item", "--root", ".", "--item", itemId]);
}

export function readItemState(root: string, itemId: string): FlowItemState {
  const statePath = path.join(root, ".bagakit", "flow-runner", "items", itemId, "state.json");
  return readJsonFile<FlowItemState>(statePath);
}

export function readHandoff(root: string, handoffPath: string): string {
  return readText(path.join(root, handoffPath));
}

export function itemExists(root: string, itemId: string): boolean {
  return fs.existsSync(path.join(root, ".bagakit", "flow-runner", "items", itemId, "state.json"));
}
