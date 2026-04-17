import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { EvalCaseContext } from "./model.ts";

function usableTempParent(candidate: string): string | null {
  try {
    fs.mkdirSync(candidate, { recursive: true });
    fs.accessSync(candidate, fs.constants.W_OK);
    return candidate;
  } catch {
    return null;
  }
}

function resolveTempParent(): string {
  const candidates = [
    os.tmpdir(),
    path.resolve(process.cwd(), ".bagakit", "tmp"),
  ];
  for (const candidate of candidates) {
    const usable = usableTempParent(candidate);
    if (usable) {
      return usable;
    }
  }
  throw new Error("No writable temp directory available for eval execution.");
}

export function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(resolveTempParent(), prefix));
}

export function writeTextFile(filePath: string, contents: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
}

export function registerTempRepo(context: EvalCaseContext, tempRepo: string): Array<{ from: string; to: string }> {
  const canonicalTempRepo = fs.realpathSync(tempRepo);
  const replacements = [
    { from: canonicalTempRepo, to: "<temp-repo>" },
    { from: tempRepo, to: "<temp-repo>" },
  ];
  for (const replacement of replacements) {
    context.addReplacement(replacement.from, replacement.to);
  }
  return replacements;
}

export function cleanupTempDir(tempRepo: string, keepTemp: boolean): void {
  if (!keepTemp) {
    fs.rmSync(tempRepo, { recursive: true, force: true });
  }
}
