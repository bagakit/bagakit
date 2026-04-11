import fs from "node:fs";
import path from "node:path";

import type { RuntimeSurfaceRecord } from "./model.ts";
import { isRepoNavigationalRef, repoRelative } from "./paths.ts";
import { parseTomlFile } from "./toml.ts";

const OWNER_KINDS = ["skill", "tool", "shared_system"] as const;
const LIFECYCLE_CLASSES = ["config", "durable_state", "generated_state", "cache", "runtime", "reviewable_projection"] as const;
const EDIT_POLICIES = ["generated_only", "mixed", "manual_only"] as const;
const SURFACE_ROOT_PATTERN = new RegExp("^[.]bagakit/[^/]+$", "u");

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a TOML table`);
  }
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label}.${key} must be a non-empty string`);
  }
  return value;
}

function readBoolean(record: Record<string, unknown>, key: string, label: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new Error(`${label}.${key} must be a boolean`);
  }
  return value;
}

function readNumber(record: Record<string, unknown>, key: string, label: string): number {
  const value = record[key];
  if (typeof value !== "number") {
    throw new Error(`${label}.${key} must be a number`);
  }
  return value;
}

function readRequiredStringArray(record: Record<string, unknown>, key: string, label: string): string[] {
  const value = record[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label}.${key} must be an array of non-empty strings`);
  }
  return [...value];
}

function readOptionalStringArray(record: Record<string, unknown>, key: string, label: string): string[] {
  const value = record[key];
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label}.${key} must be an array of non-empty strings`);
  }
  return [...value];
}

function requireAllowed(value: string, allowed: readonly string[], key: string): string | null {
  return allowed.includes(value) ? null : `${key} must be one of ${allowed.join(", ")}: ${value}`;
}

function refLabel(ref: string): string {
  return path.isAbsolute(ref) ? "<absolute path>" : ref;
}

function validateRefs(refs: string[], fieldName: string, issues: string[]): void {
  for (const ref of refs) {
    if (!isRepoNavigationalRef(ref)) {
      issues.push(`${fieldName} entries must be repo-relative navigational refs without parent escape: ${refLabel(ref)}`);
    }
  }
}

function blankSurfaceRecord(repoRoot: string, manifestPath: string, issues: string[]): RuntimeSurfaceRecord {
  return {
    surfaceRoot: repoRelative(repoRoot, path.dirname(manifestPath)),
    surfaceId: "",
    ownerKind: "",
    ownerId: "",
    lifecycleClass: "",
    editPolicy: "",
    cleanupSafe: false,
    sourceOfTruth: [],
    reviewableOutputs: [],
    adjacentProtocolFiles: [],
    manifestPath: repoRelative(repoRoot, manifestPath),
    issues,
  };
}

function missingSurfaceRecord(repoRoot: string, surfaceDir: string): RuntimeSurfaceRecord {
  const manifestPath = path.join(surfaceDir, "surface.toml");
  const manifestLabel = repoRelative(repoRoot, manifestPath);
  return blankSurfaceRecord(repoRoot, manifestPath, [`missing required surface marker: ${manifestLabel}`]);
}

function parseSurface(repoRoot: string, manifestPath: string): RuntimeSurfaceRecord {
  const issues: string[] = [];
  let payload: Record<string, unknown>;
  const manifestLabel = repoRelative(repoRoot, manifestPath);
  try {
    payload = assertRecord(parseTomlFile(manifestPath, manifestLabel), manifestLabel);
  } catch (error) {
    return blankSurfaceRecord(repoRoot, manifestPath, [error instanceof Error ? error.message : String(error)]);
  }

  try {
    const actualSurfaceRoot = repoRelative(repoRoot, path.dirname(manifestPath));
    const schemaVersion = readNumber(payload, "schema_version", manifestLabel);
    if (schemaVersion !== 1) {
      issues.push(`schema_version must be 1: ${schemaVersion}`);
    }

    const surfaceRoot = readString(payload, "surface_root", manifestLabel);
    if (!isRepoNavigationalRef(surfaceRoot)) {
      issues.push(`surface_root must be a repo-relative .bagakit/<surface> directory: ${refLabel(surfaceRoot)}`);
    } else if (!SURFACE_ROOT_PATTERN.test(surfaceRoot)) {
      issues.push(`surface_root must be a top-level .bagakit/<surface> directory: ${surfaceRoot}`);
    } else if (surfaceRoot !== actualSurfaceRoot) {
      issues.push(`surface_root must equal actual surface directory ${actualSurfaceRoot}: ${surfaceRoot}`);
    }

    const ownerKind = readString(payload, "owner_kind", manifestLabel);
    const invalidOwnerKind = requireAllowed(ownerKind, OWNER_KINDS, "owner_kind");
    if (invalidOwnerKind) {
      issues.push(invalidOwnerKind);
    }

    const lifecycleClass = readString(payload, "lifecycle_class", manifestLabel);
    const invalidLifecycleClass = requireAllowed(lifecycleClass, LIFECYCLE_CLASSES, "lifecycle_class");
    if (invalidLifecycleClass) {
      issues.push(invalidLifecycleClass);
    }

    const editPolicy = readString(payload, "edit_policy", manifestLabel);
    const invalidEditPolicy = requireAllowed(editPolicy, EDIT_POLICIES, "edit_policy");
    if (invalidEditPolicy) {
      issues.push(invalidEditPolicy);
    }

    const sourceOfTruth = readRequiredStringArray(payload, "source_of_truth", manifestLabel);
    if (sourceOfTruth.length === 0) {
      issues.push("source_of_truth must contain at least one repo-relative navigational ref");
    }
    const reviewableOutputs = readRequiredStringArray(payload, "reviewable_outputs", manifestLabel);
    const adjacentProtocolFiles = readOptionalStringArray(payload, "adjacent_protocol_files", manifestLabel);
    validateRefs(sourceOfTruth, "source_of_truth", issues);
    validateRefs(reviewableOutputs, "reviewable_outputs", issues);
    validateRefs(adjacentProtocolFiles, "adjacent_protocol_files", issues);
    return {
      surfaceRoot: actualSurfaceRoot,
      surfaceId: readString(payload, "surface_id", manifestLabel),
      ownerKind,
      ownerId: readString(payload, "owner_id", manifestLabel),
      lifecycleClass,
      editPolicy,
      cleanupSafe: readBoolean(payload, "cleanup_safe", manifestLabel),
      sourceOfTruth,
      reviewableOutputs,
      adjacentProtocolFiles,
      manifestPath: repoRelative(repoRoot, manifestPath),
      issues,
    };
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
    return blankSurfaceRecord(repoRoot, manifestPath, issues);
  }
}

export function listRuntimeSurfaces(repoRoot: string): RuntimeSurfaceRecord[] {
  const bagakitRoot = path.join(repoRoot, ".bagakit");
  if (!fs.existsSync(bagakitRoot)) {
    return [];
  }

  const surfaces: RuntimeSurfaceRecord[] = [];
  for (const entry of fs.readdirSync(bagakitRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      continue;
    }
    const manifestPath = path.join(bagakitRoot, entry.name, "surface.toml");
    if (fs.existsSync(manifestPath)) {
      surfaces.push(parseSurface(repoRoot, manifestPath));
    } else {
      surfaces.push(missingSurfaceRecord(repoRoot, path.join(bagakitRoot, entry.name)));
    }
  }
  return surfaces.sort((left, right) => left.surfaceRoot.localeCompare(right.surfaceRoot));
}
