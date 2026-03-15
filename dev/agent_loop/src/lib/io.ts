import fs from "node:fs";
import path from "node:path";

let uniqueCounter = 0;

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readText(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

export function writeText(filePath: string, value: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, value, "utf8");
}

export function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readText(filePath)) as T;
}

export function writeJsonFile(filePath: string, value: unknown): void {
  writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function loadJsonIfExists<T>(filePath: string): T | null {
  return fs.existsSync(filePath) ? readJsonFile<T>(filePath) : null;
}

export function repoRelative(root: string, targetPath: string): string {
  return path.relative(root, targetPath).split(path.sep).join("/");
}

export function utcNow(): string {
  return new Date().toISOString();
}

export function sanitizeSegment(value: string): string {
  const lowered = value.trim().toLowerCase();
  let mapped = "";
  for (const char of lowered) {
    const code = char.charCodeAt(0);
    const isLetter = code >= 97 && code <= 122;
    const isDigit = code >= 48 && code <= 57;
    if (isLetter || isDigit || char === "." || char === "_" || char === "-") {
      mapped += char;
    } else if (mapped.endsWith("-")) {
      continue;
    } else {
      mapped += "-";
    }
  }
  while (mapped.startsWith("-")) {
    mapped = mapped.slice(1);
  }
  while (mapped.endsWith("-")) {
    mapped = mapped.slice(0, -1);
  }
  const cleaned = mapped;
  return cleaned || "item";
}

export function uniqueStampedId(prefix: string, label: string): string {
  const iso = new Date().toISOString();
  const stamp = iso.split("-").join("").split(":").join("").split(".").join("");
  uniqueCounter += 1;
  const counter = String(uniqueCounter).padStart(4, "0");
  return `${prefix}${stamp}-${process.pid}-${counter}-${sanitizeSegment(label)}`;
}

export function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function assertString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

export function assertStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be an array of strings`);
  }
  return value;
}

export function assertStringMatrix(value: unknown, label: string): string[][] {
  if (!Array.isArray(value) || value.some((row) => !Array.isArray(row) || row.some((cell) => typeof cell !== "string"))) {
    throw new Error(`${label} must be an array of string arrays`);
  }
  return value as string[][];
}

export function assertNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

export function assertBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean`);
  }
  return value;
}

export function copyFileIfMissing(source: string, destination: string): void {
  if (fs.existsSync(destination)) {
    return;
  }
  ensureDir(path.dirname(destination));
  fs.copyFileSync(source, destination);
}

export function isPidLive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
