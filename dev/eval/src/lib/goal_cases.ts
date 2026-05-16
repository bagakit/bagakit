import fs from "node:fs";
import path from "node:path";

import { parseTomlFile } from "../../../validator/src/lib/toml.ts";
import { loadEvalDataset, validateGoalCaseContracts } from "./dataset.ts";

interface GoalGuard {
  id: string;
  polarity: "should" | "should_not";
  goal_dimension: string;
  behavior: string;
  failure_boundary: string;
  transfer_limit: string;
}

export interface GoalCasePilotResult {
  datasetId: string;
  cases: number;
  shouldCases: number;
  shouldNotCases: number;
  baseline: {
    coveredCases: number;
    coverage: number;
  };
  candidate: {
    coveredCases: number;
    coverage: number;
  };
  deltaCoverage: number;
  guardIds: string[];
  caseIds: string[];
  calibrationRefs: string[];
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function loadGoalGuards(filePath: string): GoalGuard[] {
  const payload = assertRecord(parseTomlFile(filePath), filePath);
  const rawGuards = payload.guard;
  if (!Array.isArray(rawGuards) || rawGuards.length === 0) {
    throw new Error(`${filePath} must declare at least one [[guard]]`);
  }
  const seen = new Set<string>();
  return rawGuards.map((rawGuard, index) => {
    const guard = assertRecord(rawGuard, `${filePath}.guard[${index}]`);
    const id = assertString(guard.id, `${filePath}.guard[${index}].id`);
    if (seen.has(id)) {
      throw new Error(`${filePath} has duplicate guard id ${id}`);
    }
    seen.add(id);
    const polarity = assertString(guard.polarity, `${filePath}.guard[${index}].polarity`);
    if (polarity !== "should" && polarity !== "should_not") {
      throw new Error(`${filePath}.guard[${index}].polarity must be should or should_not`);
    }
    return {
      id,
      polarity,
      goal_dimension: assertString(guard.goal_dimension, `${filePath}.guard[${index}].goal_dimension`),
      behavior: assertString(guard.behavior, `${filePath}.guard[${index}].behavior`),
      failure_boundary: assertString(guard.failure_boundary, `${filePath}.guard[${index}].failure_boundary`),
      transfer_limit: assertString(guard.transfer_limit, `${filePath}.guard[${index}].transfer_limit`),
    };
  });
}

export function evaluateGoalCasePilot(options: {
  repoRoot: string;
  datasetRel: string;
  contractRel: string;
  baselineGuardIds: string[];
}): GoalCasePilotResult {
  const dataset = loadEvalDataset(path.join(options.repoRoot, options.datasetRel));
  validateGoalCaseContracts(dataset);
  const guards = loadGoalGuards(path.join(options.repoRoot, options.contractRel));
  const guardsById = new Map(guards.map((guard) => [guard.id, guard]));
  const baselineIds = new Set(options.baselineGuardIds);
  const calibrationRefs = new Set<string>();
  let baselineCoveredCases = 0;
  let candidateCoveredCases = 0;

  for (const item of dataset.items) {
    const guardIds = item.guard_ids ?? [];
    const candidateCovered = guardIds.every((guardId) => {
      const guard = guardsById.get(guardId);
      return !!guard && guard.polarity === item.polarity && (item.goal_dimensions ?? []).includes(guard.goal_dimension);
    });
    if (!candidateCovered) {
      throw new Error(`${dataset.dataset_id}:${item.id} is not covered by matching structured guards`);
    }
    candidateCoveredCases += 1;
    if (guardIds.every((guardId) => baselineIds.has(guardId))) {
      baselineCoveredCases += 1;
    }
    for (const evidenceRef of item.grader?.calibration_evidence ?? []) {
      const absoluteRef = path.resolve(options.repoRoot, evidenceRef);
      if (!fs.existsSync(absoluteRef)) {
        throw new Error(`${dataset.dataset_id}:${item.id} calibration evidence is missing: ${evidenceRef}`);
      }
      calibrationRefs.add(evidenceRef);
    }
  }

  const total = dataset.items.length;
  const baselineCoverage = total === 0 ? 0 : baselineCoveredCases / total;
  const candidateCoverage = total === 0 ? 0 : candidateCoveredCases / total;
  return {
    datasetId: dataset.dataset_id,
    cases: total,
    shouldCases: dataset.items.filter((item) => item.polarity === "should").length,
    shouldNotCases: dataset.items.filter((item) => item.polarity === "should_not").length,
    baseline: {
      coveredCases: baselineCoveredCases,
      coverage: baselineCoverage,
    },
    candidate: {
      coveredCases: candidateCoveredCases,
      coverage: candidateCoverage,
    },
    deltaCoverage: candidateCoverage - baselineCoverage,
    guardIds: [...guardsById.keys()].sort(),
    caseIds: dataset.items.map((item) => item.id),
    calibrationRefs: [...calibrationRefs].sort(),
  };
}
