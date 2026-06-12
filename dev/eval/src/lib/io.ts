import fs from "node:fs";
import path from "node:path";

export interface Replacement {
  from: string;
  to: string;
}

export function ensureDir(target: string): void {
  fs.mkdirSync(target, { recursive: true });
}

export function writeJson(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export function utcRunId(): string {
  return new Date().toISOString().replaceAll(":", "").replaceAll(".", "-");
}

export function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

export function repoRelative(repoRoot: string, targetPath: string): string {
  const rel = path.relative(repoRoot, targetPath);
  return rel ? toPosixPath(rel) : ".";
}

export function ensureWithinRoot(root: string, target: string, label = "output path"): string {
  const resolvedRoot = fs.realpathSync.native(path.resolve(root));
  const resolvedTarget = path.resolve(target);
  let probe = resolvedTarget;
  while (!fs.existsSync(probe)) probe = path.dirname(probe);
  const realProbe = fs.realpathSync.native(probe);
  const realTarget = path.join(realProbe, path.relative(probe, resolvedTarget));
  const relative = path.relative(resolvedRoot, realTarget);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay within repository root: ${toPosixPath(resolvedTarget)}`);
  }
  return resolvedTarget;
}

export function ensureCleanOutputDir(outputDir: string): void {
  if (fs.existsSync(outputDir)) {
    const entries = fs.readdirSync(outputDir);
    if (entries.length > 0) {
      throw new Error(`refusing to write eval results into a non-empty directory: ${toPosixPath(outputDir)}`);
    }
  }
  ensureDir(outputDir);
}

function sanitizeString(value: string, replacements: Replacement[]): string {
  let next = value;
  const ordered = [...replacements].sort((left, right) => right.from.length - left.from.length);
  for (const replacement of ordered) {
    if (!replacement.from) {
      continue;
    }
    next = next.split(replacement.from).join(replacement.to);
  }
  return next;
}

export function sanitizeUnknown(value: unknown, replacements: Replacement[]): unknown {
  if (typeof value === "string") {
    return sanitizeString(value, replacements);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeUnknown(entry, replacements));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        sanitizeUnknown(entry, replacements),
      ]),
    );
  }
  return value;
}

export function sanitizeError(error: unknown, replacements: Replacement[]): string {
  const raw = error instanceof Error ? error.message : String(error);
  return sanitizeString(raw, replacements);
}

export function environmentSnapshot(): Record<string, unknown> {
  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
  };
}
