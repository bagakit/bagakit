import path from "node:path";

export function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

export function repoRelative(repoRoot: string, absolutePath: string): string {
  const relative = path.relative(repoRoot, absolutePath);
  return relative === "" ? "." : toPosixPath(relative);
}

export function resolveRoot(rawRoot: string): string {
  return path.resolve(rawRoot);
}

export function isSafeRelativePath(value: string): boolean {
  if (!value || path.isAbsolute(value)) {
    return false;
  }
  const normalized = path.normalize(value);
  return normalized !== "." && !normalized.startsWith("..") && !path.isAbsolute(normalized);
}

export function isRepoRelativeRef(value: string): boolean {
  if (!value || path.isAbsolute(value)) {
    return false;
  }
  const normalized = path.normalize(value);
  return normalized === "." || (!normalized.startsWith("..") && !path.isAbsolute(normalized));
}

export function isRepoNavigationalRef(value: string): boolean {
  if (!isRepoRelativeRef(value)) {
    return false;
  }
  return path.normalize(value) !== ".";
}

export function relativePathWithin(root: string, relativePath: string): string | null {
  if (!isSafeRelativePath(relativePath)) {
    return null;
  }
  const absolutePath = path.resolve(root, relativePath);
  const relative = path.relative(root, absolutePath);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return absolutePath;
}
