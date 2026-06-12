import fs from "node:fs";
import path from "node:path";

import { type JsonValue } from "./model.ts";
import { assertJsonSafe } from "./validation.ts";

export type JsonValidator<T> = (value: unknown, label?: string) => T;

export type PersistJsonOptions = Readonly<{
  fsync?: boolean;
}>;

export type MutationSideEffect =
  | Readonly<{ kind: "json"; path: string; value: unknown }>
  | Readonly<{ kind: "ndjson"; path: string; value: unknown }>
  | Readonly<{ kind: "text"; path: string; value: string }>;

export function readJsonFile<T>(filePath: string, validator?: JsonValidator<T>): T {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    throw new Error(`missing file: ${filePath}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`invalid json in ${filePath}: ${String(error)}`);
  }
  return validator ? validator(parsed, filePath) : parsed as T;
}

export function readNdjsonFile<T>(filePath: string, validator?: JsonValidator<T>): T[] {
  const raw = fs.readFileSync(filePath, "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch (error) {
        throw new Error(`invalid ndjson in ${filePath} at line ${index + 1}: ${String(error)}`);
      }
      return validator ? validator(parsed, `${filePath}:${index + 1}`) : parsed as T;
    });
}

export function atomicWriteJson(filePath: string, value: unknown, options: PersistJsonOptions = {}): JsonValue {
  const safe = assertJsonSafe(value, filePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(safe, null, 2)}\n`, "utf8");
  if (options.fsync === true) {
    fsyncFile(tmpPath);
  }
  fs.renameSync(tmpPath, filePath);
  if (options.fsync === true) {
    fsyncDir(path.dirname(filePath));
  }
  return safe;
}

export function appendNdjson(filePath: string, value: unknown): JsonValue {
  const safe = assertJsonSafe(value, filePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(safe)}\n`, "utf8");
  return safe;
}

export function persistMutationSideEffects(sideEffects: readonly MutationSideEffect[], options: PersistJsonOptions = {}): void {
  for (const sideEffect of sideEffects) {
    if (sideEffect.kind === "json") {
      atomicWriteJson(sideEffect.path, sideEffect.value, options);
    } else if (sideEffect.kind === "ndjson") {
      appendNdjson(sideEffect.path, sideEffect.value);
    } else {
      fs.mkdirSync(path.dirname(sideEffect.path), { recursive: true });
      fs.writeFileSync(sideEffect.path, sideEffect.value, "utf8");
    }
  }
}

function fsyncFile(filePath: string): void {
  const fd = fs.openSync(filePath, "r");
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function fsyncDir(dirPath: string): void {
  let fd: number | null = null;
  try {
    fd = fs.openSync(dirPath, "r");
    fs.fsyncSync(fd);
  } catch {
    return;
  } finally {
    if (fd !== null) {
      fs.closeSync(fd);
    }
  }
}
