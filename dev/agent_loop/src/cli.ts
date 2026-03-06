import path from "node:path";
import { parseArgs } from "node:util";

import { normalizeRefreshCommands, parseArgvJson, presetArgv } from "./lib/config.ts";
import { applyAgentLoop, computeNext, configureRunner, validateAgentLoop, watchAgentLoop } from "./lib/core.ts";
import { runAgentLoop } from "./lib/run.ts";
import { runWatchLoop } from "./lib/watch_ui.ts";

const defaultToolDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function commonOptions() {
  return {
    root: { type: "string" as const, default: "." },
  };
}

function parsePositiveInteger(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return parsed;
}

function printHelp(): void {
  console.log(`bagakit agent loop

Commands:
  apply [--root <repo-root>]
  configure-runner [--root <repo-root>] [--runner-name <name>] (--preset <codex|claude> | --argv-json <json>) [--timeout-seconds <n>] [--refresh-command-json <json> ...]
  next [--root <repo-root>] [--item <item-id>] [--json]
  run [--root <repo-root>] [--item <item-id>] [--max-sessions <n>] [--json]
  resume --item <item-id> [--root <repo-root>] [--max-sessions <n>] [--json]
  watch [--root <repo-root>] [--item <item-id>] [--json] [--once] [--refresh-seconds <n>]
  validate [--root <repo-root>] [--json]`);
}

function cmdApply(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: commonOptions(),
    strict: true,
    allowPositionals: false,
  });
  const loopDir = applyAgentLoop(path.resolve(values.root), defaultToolDir);
  console.log(`ok: agent-loop initialized at ${loopDir}`);
  return 0;
}

function cmdConfigureRunner(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      ...commonOptions(),
      "runner-name": { type: "string" as const, default: "" },
      preset: { type: "string" as const, default: "" },
      "argv-json": { type: "string" as const, default: "" },
      "timeout-seconds": { type: "string" as const, default: "1800" },
      "refresh-command-json": { type: "string" as const, multiple: true },
    },
    strict: true,
    allowPositionals: false,
  });
  const preset = values.preset || "";
  const argvJson = values["argv-json"] || "";
  if (!!preset === !!argvJson) {
    throw new Error("configure-runner requires exactly one of --preset or --argv-json");
  }
  const presetConfig = preset ? presetArgv(preset) : null;
  const argvVector = presetConfig ? presetConfig.argv : parseArgvJson(argvJson);
  const runnerName = values["runner-name"] || presetConfig?.runner_name || "custom";
  const timeoutSeconds = parsePositiveInteger(values["timeout-seconds"], "--timeout-seconds");
  const refreshCommands = normalizeRefreshCommands(values["refresh-command-json"] || []);
  const config = configureRunner(path.resolve(values.root), runnerName, argvVector, timeoutSeconds, refreshCommands);
  console.log(`ok: runner configured ${config.runner_name}`);
  return 0;
}

function cmdNext(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      ...commonOptions(),
      item: { type: "string" as const },
      json: { type: "boolean" as const, default: false },
    },
    strict: true,
    allowPositionals: false,
  });
  const payload = computeNext(path.resolve(values.root), values.item || undefined);
  if (values.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`next: ${payload.flow_next.recommended_action} (${payload.flow_next.action_reason})`);
    console.log(`safe-action: ${payload.next_safe_action}`);
    if (payload.flow_next.item_id) {
      console.log(`item: ${payload.flow_next.item_id}`);
    }
    if (payload.flow_next.checkpoint_request) {
      console.log(
        `checkpoint: ${payload.flow_next.checkpoint_request.stage} / ${payload.flow_next.checkpoint_request.session_status}`,
      );
    }
  }
  return 0;
}

function cmdRun(argv: string[], forceItem?: string): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      ...commonOptions(),
      item: { type: "string" as const },
      "max-sessions": { type: "string" as const, default: "8" },
      json: { type: "boolean" as const, default: false },
    },
    strict: true,
    allowPositionals: false,
  });
  const payload = runAgentLoop(
    path.resolve(values.root),
    forceItem || values.item || undefined,
    parsePositiveInteger(values["max-sessions"], "--max-sessions"),
  );
  if (values.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`run: ${payload.run_status} / ${payload.stop_reason}`);
    console.log(`item: ${payload.item_id}`);
    console.log(`next-safe-action: ${payload.next_safe_action}`);
    console.log(`can-resume: ${payload.can_resume ? "yes" : "no"}`);
    console.log(`sessions: ${payload.sessions_launched} of ${payload.session_budget}`);
    console.log(`message: ${payload.operator_message}`);
    if (payload.next_command_example) {
      console.log(`continue-with: ${payload.next_command_example}`);
    }
    if (payload.host_notification_request) {
      console.log(
        `attention: ${payload.host_notification_request.severity} / ${payload.host_notification_request.summary}`,
      );
    }
  }
  return payload.run_status === "terminal" ? 0 : 1;
}

function cmdResume(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      ...commonOptions(),
      item: { type: "string" as const },
      "max-sessions": { type: "string" as const, default: "8" },
      json: { type: "boolean" as const, default: false },
    },
    strict: true,
    allowPositionals: false,
  });
  if (!values.item) {
    throw new Error("resume requires --item");
  }
  return cmdRun([
    "--root",
    values.root,
    "--item",
    values.item,
    "--max-sessions",
    values["max-sessions"],
    ...(values.json ? ["--json"] : []),
  ]);
}

async function cmdWatch(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      ...commonOptions(),
      item: { type: "string" as const },
      json: { type: "boolean" as const, default: false },
      once: { type: "boolean" as const, default: false },
      "refresh-seconds": { type: "string" as const, default: "1" },
    },
    strict: true,
    allowPositionals: false,
  });
  const root = path.resolve(values.root);
  const buildPayload = () => watchAgentLoop(root, values.item || undefined);
  const payload = buildPayload();
  if (values.json) {
    console.log(JSON.stringify(payload, null, 2));
    return 0;
  }
  return runWatchLoop(buildPayload, {
    once: values.once,
    refreshSeconds: Number(values["refresh-seconds"]) || 1,
  });
}

function cmdValidate(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      ...commonOptions(),
      json: { type: "boolean" as const, default: false },
    },
    strict: true,
    allowPositionals: false,
  });
  const issues = validateAgentLoop(path.resolve(values.root));
  if (values.json) {
    console.log(JSON.stringify({ issues }, null, 2));
  } else if (issues.length === 0) {
    console.log("ok: agent-loop validation passed");
  } else {
    for (const issue of issues) {
      console.error(`error: ${issue}`);
    }
  }
  return issues.length === 0 ? 0 : 1;
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (!command || command === "-h" || command === "--help") {
    printHelp();
    return 0;
  }
  switch (command) {
    case "apply":
      return cmdApply(rest);
    case "configure-runner":
      return cmdConfigureRunner(rest);
    case "next":
      return cmdNext(rest);
    case "run":
      return cmdRun(rest);
    case "resume":
      return cmdResume(rest);
    case "watch":
      return await cmdWatch(rest);
    case "validate":
      return cmdValidate(rest);
    default:
      throw new Error(`unknown command: ${command}`);
  }
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(`bagakit-agent-loop: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
