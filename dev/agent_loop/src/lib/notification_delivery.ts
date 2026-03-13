import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import type { HostNotificationRequest, NotificationConfig, NotificationDeliveryReceipt, RunRecord } from "./model.ts";
import { NOTIFICATION_CONFIG_SCHEMA, NOTIFICATION_RECEIPT_SCHEMA } from "./model.ts";
import { copyFileIfMissing, loadJsonIfExists, readJsonFile, repoRelative, writeJsonFile } from "./io.ts";
import { AgentLoopPaths } from "./paths.ts";

function templatePath(toolDir: string): string {
  return path.join(toolDir, "references", "tpl", "notification-config-template.json");
}

export function initializeNotificationConfig(root: string, toolDir: string): string {
  const paths = new AgentLoopPaths(root);
  copyFileIfMissing(templatePath(toolDir), paths.notificationConfigFile);
  return repoRelative(root, paths.notificationConfigFile);
}

export function loadNotificationConfig(root: string): NotificationConfig | null {
  const paths = new AgentLoopPaths(root);
  const relConfigPath = repoRelative(root, paths.notificationConfigFile);
  const payload = loadJsonIfExists<unknown>(paths.notificationConfigFile);
  if (payload === null) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (record.schema !== NOTIFICATION_CONFIG_SCHEMA) {
    throw new Error(`invalid notification config schema: ${relConfigPath}`);
  }
  const transport = String(record.transport || "").trim();
  if (transport !== "disabled" && transport !== "command") {
    throw new Error(`notification transport must be disabled or command: ${relConfigPath}`);
  }
  const command = (record.command || {}) as Record<string, unknown>;
  const payloadMode = String(command.payload_mode || "stdin_json").trim();
  if (payloadMode !== "stdin_json" && payloadMode !== "file_json") {
    throw new Error(`notification payload_mode must be stdin_json or file_json: ${relConfigPath}`);
  }
  const timeoutSeconds = Number(command.timeout_seconds || 30);
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    throw new Error(`notification timeout_seconds must be a positive finite number: ${relConfigPath}`);
  }
  return {
    schema: NOTIFICATION_CONFIG_SCHEMA,
    transport,
    command: {
      argv: Array.isArray(command.argv) ? command.argv.map((value) => String(value)) : [],
      env: typeof command.env === "object" && command.env ? Object.fromEntries(Object.entries(command.env as Record<string, unknown>).map(([key, value]) => [key, String(value)])) : {},
      timeout_seconds: timeoutSeconds,
      payload_mode: payloadMode,
    },
  };
}

export function notificationConfigIssue(root: string): string {
  try {
    const config = loadNotificationConfig(root);
    if (config && config.transport === "command" && config.command.argv.length === 0) {
      return "notification command argv must not be empty";
    }
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function interpolate(value: string, replacements: Record<string, string>): string {
  let rendered = value;
  for (const [key, replacement] of Object.entries(replacements)) {
    rendered = rendered.split(`{${key}}`).join(replacement);
  }
  return rendered;
}

function loadRunRecord(root: string, runId: string): RunRecord {
  const paths = new AgentLoopPaths(root);
  return readJsonFile<RunRecord>(paths.runRecordFile(runId));
}

function latestRunRecord(root: string): RunRecord | null {
  const paths = new AgentLoopPaths(root);
  if (!fs.existsSync(paths.runsDir)) {
    return null;
  }
  const entries = (fs.readdirSync(paths.runsDir) as string[]).filter((entry) => entry.endsWith(".json")).sort().reverse();
  for (const entry of entries) {
    try {
      const record = readJsonFile<RunRecord>(path.join(paths.runsDir, entry));
      if (record.host_notification_request) {
        return record;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function receiptBase(runId: string, itemId: string, transport: NotificationConfig["transport"]): NotificationDeliveryReceipt {
  return {
    schema: NOTIFICATION_RECEIPT_SCHEMA,
    run_id: runId,
    item_id: itemId,
    recorded_at: new Date().toISOString(),
    transport,
    status: "skipped",
    command_summary: "",
    request_path: "",
    receipt_path: "",
    exit_code: null,
    signal: null,
    stdout_excerpt: "",
    stderr_excerpt: "",
    error_message: "",
  };
}

export function deliverNotification(root: string, runId?: string): NotificationDeliveryReceipt {
  const record = runId ? loadRunRecord(root, runId) : latestRunRecord(root);
  if (!record || !record.host_notification_request) {
    throw new Error("no host notification request is available");
  }
  const request: HostNotificationRequest = record.host_notification_request;
  const paths = new AgentLoopPaths(root);
  const requestPath = paths.notificationRequestFile(record.run_id);
  const receiptPath = paths.notificationReceiptFile(record.run_id);
  writeJsonFile(requestPath, request);

  let config: NotificationConfig | null = null;
  let configError = "";
  try {
    config = loadNotificationConfig(root);
  } catch (error) {
    configError = error instanceof Error ? error.message : String(error);
  }
  if (configError) {
    const receipt: NotificationDeliveryReceipt = {
      ...receiptBase(record.run_id, record.item_id, "command"),
      status: "failed",
      request_path: repoRelative(root, requestPath),
      receipt_path: repoRelative(root, receiptPath),
      error_message: configError,
    };
    writeJsonFile(receiptPath, receipt);
    return receipt;
  }
  if (!config || config.transport === "disabled") {
    const receipt: NotificationDeliveryReceipt = {
      ...receiptBase(record.run_id, record.item_id, "disabled"),
      status: "disabled",
      request_path: repoRelative(root, requestPath),
      receipt_path: repoRelative(root, receiptPath),
      error_message: "notification delivery is disabled",
    };
    writeJsonFile(receiptPath, receipt);
    return receipt;
  }

  const replacements = {
    repo_root: root,
    run_id: record.run_id,
    item_id: record.item_id,
    request_file: requestPath,
    receipt_file: receiptPath,
  };
  const argv = config.command.argv.map((part) => interpolate(part, replacements));
  if (argv.length === 0) {
    const receipt: NotificationDeliveryReceipt = {
      ...receiptBase(record.run_id, record.item_id, "command"),
      status: "failed",
      request_path: repoRelative(root, requestPath),
      receipt_path: repoRelative(root, receiptPath),
      error_message: "notification command argv must not be empty",
    };
    writeJsonFile(receiptPath, receipt);
    return receipt;
  }
  const env = Object.fromEntries(Object.entries(config.command.env).map(([key, value]) => [key, interpolate(value, replacements)]));
  const input = config.command.payload_mode === "stdin_json" ? `${JSON.stringify(request, null, 2)}\n` : undefined;
  const result = spawnSync(argv[0]!, argv.slice(1), {
    cwd: root,
    encoding: "utf8",
    input,
    timeout: config.command.timeout_seconds * 1000,
    env: {
      ...process.env,
      ...env,
    },
  });
  const receipt: NotificationDeliveryReceipt = {
    ...receiptBase(record.run_id, record.item_id, "command"),
    status: result.status === 0 && !result.error ? "delivered" : "failed",
    command_summary: argv.join(" "),
    request_path: repoRelative(root, requestPath),
    receipt_path: repoRelative(root, receiptPath),
    exit_code: result.status ?? null,
    signal: result.signal ?? null,
    stdout_excerpt: String(result.stdout || "").trim().slice(0, 400),
    stderr_excerpt: String(result.stderr || "").trim().slice(0, 400),
    error_message: result.error ? String(result.error.message || result.error) : "",
  };
  writeJsonFile(receiptPath, receipt);
  return receipt;
}

export function latestNotificationReceipt(root: string, runId?: string): NotificationDeliveryReceipt | null {
  const paths = new AgentLoopPaths(root);
  if (runId) {
    try {
      return loadJsonIfExists<NotificationDeliveryReceipt>(paths.notificationReceiptFile(runId));
    } catch {
      return null;
    }
  }
  const receiptsDir = path.join(paths.notificationDir, "receipts");
  if (!fs.existsSync(receiptsDir)) {
    return null;
  }
  const entries = (fs.readdirSync(receiptsDir) as string[]).filter((entry) => entry.endsWith(".json")).sort().reverse();
  for (const entry of entries) {
    try {
      const receipt = loadJsonIfExists<NotificationDeliveryReceipt>(path.join(receiptsDir, entry));
      if (receipt) {
        return receipt;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function notificationReceiptIssue(root: string): string {
  const paths = new AgentLoopPaths(root);
  const receiptsDir = path.join(paths.notificationDir, "receipts");
  if (!fs.existsSync(receiptsDir)) {
    return "";
  }
  const entries = (fs.readdirSync(receiptsDir) as string[]).filter((entry) => entry.endsWith(".json")).sort().reverse();
  for (const entry of entries) {
    try {
      readJsonFile<NotificationDeliveryReceipt>(path.join(receiptsDir, entry));
    } catch (error) {
      return `notification receipt ${entry} is unreadable: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  return "";
}
