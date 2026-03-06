import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { EvalCaseContext } from "./model.ts";

export function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
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
