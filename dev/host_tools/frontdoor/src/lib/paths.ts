import path from "node:path";

const WINDOWS_ABSOLUTE_RE = new RegExp(String.raw`^[A-Za-z]:[\\/]`);
const DURABLE_ABSOLUTE_SIGNAL_RE = new RegExp(String.raw`(?:^|[\s\`"'])/(?:Users|home|private|tmp|var|opt|etc)/`);

export function toRepoPath(value: string): string {
  return value.split(path.sep).join("/");
}

export function repoRelative(root: string, absolutePath: string): string {
  const rel = path.relative(root, absolutePath);
  return toRepoPath(rel || ".");
}

export function resolveRepoPath(root: string, repoPath: string): string {
  return path.resolve(root, repoPath);
}

export function isRepoRelativePath(value: string): boolean {
  if (!value.trim()) {
    return false;
  }
  if (path.isAbsolute(value)) {
    return false;
  }
  if (value.startsWith("/") || value.startsWith("~")) {
    return false;
  }
  if (WINDOWS_ABSOLUTE_RE.test(value)) {
    return false;
  }
  if (value.includes("\\") || value.includes("\0")) {
    return false;
  }
  const normalized = path.posix.normalize(value);
  return normalized !== "." && !normalized.startsWith("../") && normalized !== "..";
}

export function hasAbsolutePathSignal(value: string): boolean {
  return path.isAbsolute(value)
    || WINDOWS_ABSOLUTE_RE.test(value)
    || DURABLE_ABSOLUTE_SIGNAL_RE.test(value);
}
