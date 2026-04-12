import fs from "node:fs";
import path from "node:path";

import { GRILL_SCHEMA, type GrillRun } from "./model.ts";

export function grillRoot(repoRoot: string): string {
  return path.join(repoRoot, ".bagakit", "grill");
}

export function runDir(repoRoot: string, runId: string): string {
  return path.join(grillRoot(repoRoot), "runs", runId);
}

export function runPath(repoRoot: string, runId: string): string {
  return path.join(runDir(repoRoot, runId), "grill-run.json");
}

export function briefPath(repoRoot: string, runId: string): string {
  return path.join(runDir(repoRoot, runId), "grill-brief.md");
}

export function repoRelative(repoRoot: string, targetPath: string): string {
  return path.relative(repoRoot, targetPath).split(path.sep).join("/");
}

export function ensureGrillSurface(repoRoot: string): void {
  const root = grillRoot(repoRoot);
  fs.mkdirSync(path.join(root, "runs"), { recursive: true });
  const surfacePath = path.join(root, "surface.toml");
  if (!fs.existsSync(surfacePath)) {
    fs.writeFileSync(
      surfacePath,
      [
        "schema_version = 1",
        'surface_id = "grill-runtime"',
        'surface_root = ".bagakit/grill"',
        'owner_kind = "skill"',
        'owner_id = "bagakit-grill"',
        'lifecycle_class = "durable_state"',
        'edit_policy = "generated_only"',
        "cleanup_safe = false",
        "source_of_truth = [",
        '  "docs/specs/runtime-surface-contract.md",',
        '  "skills/harness/bagakit-grill/SKILL.md",',
        '  "skills/harness/bagakit-grill/references/grill-run-contract.md",',
        "]",
        "reviewable_outputs = [",
        '  "runs/<run-id>/grill-brief.md",',
        "]",
        "",
      ].join("\n"),
      "utf8",
    );
  }
}

export function readRun(repoRoot: string, runId: string): GrillRun {
  const file = runPath(repoRoot, runId);
  if (!fs.existsSync(file)) {
    throw new Error(`missing grill run: ${repoRelative(repoRoot, file)}`);
  }
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as GrillRun;
  if (parsed.schema !== GRILL_SCHEMA) {
    throw new Error(`unsupported grill run schema in ${repoRelative(repoRoot, file)}`);
  }
  return parsed;
}

export function writeRun(repoRoot: string, run: GrillRun): void {
  ensureGrillSurface(repoRoot);
  const dir = runDir(repoRoot, run.run_id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(runPath(repoRoot, run.run_id), `${JSON.stringify(run, null, 2)}\n`, "utf8");
}

export function writeBrief(repoRoot: string, runId: string, contents: string): string {
  const file = briefPath(repoRoot, runId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, "utf8");
  return repoRelative(repoRoot, file);
}
