import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export function utcNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function readText(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(`missing file: ${filePath}`);
  }
}

export function writeText(filePath: string, text: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, "utf8");
}

export function readJsonFile<T>(filePath: string): T {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    throw new Error(`missing file: ${filePath}`);
  }
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(`invalid json in ${filePath}: ${String(error)}`);
  }
}

function assertJsonSafe(value: unknown, location: string): void {
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error(`non-finite number is not allowed in json payload: ${location}`);
  }
  if (value === undefined) {
    throw new Error(`undefined is not allowed in json payload: ${location}`);
  }
  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") {
    throw new Error(`unsupported json value at ${location}`);
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonSafe(item, `${location}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      assertJsonSafe(item, `${location}.${key}`);
    }
  }
}

export function writeJsonFile(filePath: string, value: unknown): void {
  assertJsonSafe(value, filePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(tmpPath, filePath);
}

export function appendNdjson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

export function readNdjson<T>(filePath: string): T[] {
  const lines = readText(filePath)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.map((line, index) => {
    try {
      return JSON.parse(line) as T;
    } catch (error) {
      throw new Error(`invalid ndjson in ${filePath} at line ${index + 1}: ${String(error)}`);
    }
  });
}

export function ensureGitRepo(root: string): void {
  const result = spawnSync("git", ["-C", root, "rev-parse", "--is-inside-work-tree"], {
    encoding: "utf8",
  });
  if (result.status !== 0 || result.stdout.trim() !== "true") {
    throw new Error(`not a git repository: ${root}`);
  }
}

export function runGit(root: string, args: string[]): string {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "git command failed").trim());
  }
  return result.stdout;
}

export function copyTemplateIfMissing(skillDir: string, templateRelPath: string, destPath: string): void {
  if (fs.existsSync(destPath)) {
    return;
  }
  const srcPath = path.join(skillDir, "references", "tpl", templateRelPath);
  if (!fs.existsSync(srcPath)) {
    throw new Error(`missing template: ${srcPath}`);
  }
  writeText(destPath, readText(srcPath));
}

export function sanitizeSnapshotLabel(label: string): string {
  const cleaned = label.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[-._]+|[-._]+$/g, "");
  if (!cleaned) {
    throw new Error("snapshot label must contain at least one safe path character");
  }
  return cleaned;
}
