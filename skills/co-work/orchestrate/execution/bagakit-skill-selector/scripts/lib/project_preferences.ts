import fs from "node:fs";
import path from "node:path";

import {
  PROJECT_PREFERENCE_VALUES,
  type ProjectPreferenceEntry,
  type ProjectPreferenceValue,
  type ProjectPreferencesDoc,
} from "./model.ts";
import { isRecord, parseTomlFile } from "./toml.ts";

function nowIso(): string {
  return new Date().toISOString();
}

function readString(record: Record<string, unknown>, key: string, fallback = ""): string {
  const value = record[key];
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  throw new Error(`expected string-compatible value for ${key}`);
}

function readRecordArray(record: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = record[key];
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`expected array table for ${key}`);
  }
  return value.map((entry) => {
    if (!isRecord(entry)) {
      throw new Error(`invalid entry in ${key}`);
    }
    return entry;
  });
}

function formatTomlValue(value: string | number | boolean): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return Number.isInteger(value) ? String(value) : String(value);
}

function pushKeyValue(lines: string[], key: string, value: string | number | boolean): void {
  lines.push(`${key} = ${formatTomlValue(value)}`);
}

function assertPreferenceValue(raw: string): ProjectPreferenceValue {
  if (PROJECT_PREFERENCE_VALUES.includes(raw as ProjectPreferenceValue)) {
    return raw as ProjectPreferenceValue;
  }
  throw new Error(`invalid project preference value: ${raw}`);
}

function parsePreferenceEntry(record: Record<string, unknown>): ProjectPreferenceEntry {
  return {
    timestamp: readString(record, "timestamp"),
    skill_id: readString(record, "skill_id"),
    preference: assertPreferenceValue(readString(record, "preference")),
    reason: readString(record, "reason"),
    notes: readString(record, "notes"),
  };
}

export function createProjectPreferencesDoc(): ProjectPreferencesDoc {
  return {
    schema_version: "1.0",
    updated_at: nowIso(),
    skill_preference: [],
  };
}

export function renderProjectPreferencesDoc(doc: ProjectPreferencesDoc): string {
  const lines: string[] = [];
  pushKeyValue(lines, "schema_version", doc.schema_version);
  pushKeyValue(lines, "updated_at", doc.updated_at);
  lines.push("");
  lines.push("# Optional host-local selector hints. Keep these coarse and explicit.");
  lines.push("# Append records below with [[skill_preference]].");

  for (const entry of doc.skill_preference) {
    lines.push("");
    lines.push("[[skill_preference]]");
    pushKeyValue(lines, "timestamp", entry.timestamp);
    pushKeyValue(lines, "skill_id", entry.skill_id);
    pushKeyValue(lines, "preference", entry.preference);
    pushKeyValue(lines, "reason", entry.reason);
    pushKeyValue(lines, "notes", entry.notes);
  }

  return `${lines.join("\n")}\n`;
}

export function writeProjectPreferencesDoc(filePath: string, doc: ProjectPreferencesDoc): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, renderProjectPreferencesDoc(doc), "utf-8");
}

export function readProjectPreferencesDoc(filePath: string): ProjectPreferencesDoc {
  const raw = parseTomlFile(filePath);
  if (!isRecord(raw)) {
    throw new Error(`invalid project preferences file: ${filePath}`);
  }

  const doc: ProjectPreferencesDoc = {
    schema_version: readString(raw, "schema_version", "1.0"),
    updated_at: readString(raw, "updated_at"),
    skill_preference: readRecordArray(raw, "skill_preference").map(parsePreferenceEntry),
  };

  const issues = validateProjectPreferences(doc);
  if (issues.length > 0) {
    throw new Error(`invalid project preferences file:\n${issues.join("\n")}`);
  }
  return doc;
}

export function validateProjectPreferences(doc: ProjectPreferencesDoc): string[] {
  const issues: string[] = [];
  const seenSkillIds = new Set<string>();

  if (doc.updated_at.trim() === "") {
    issues.push("updated_at must not be empty");
  }

  for (const entry of doc.skill_preference) {
    const skillId = entry.skill_id.trim();
    if (skillId === "") {
      issues.push("skill_preference.skill_id must not be empty");
      continue;
    }
    if (seenSkillIds.has(skillId)) {
      issues.push(`duplicate skill_preference.skill_id (${skillId})`);
    } else {
      seenSkillIds.add(skillId);
    }
    if (entry.reason.trim() === "") {
      issues.push(`skill_preference.reason must not be empty (${skillId})`);
    }
  }

  return issues;
}
