import path from "node:path";

import type { ProjectPreferenceValue, ProjectPreferencesDoc, SkillPlanEntry, SkillUsageDoc } from "./model.ts";
import { listVisibleSkillCatalog, readSkillDescriptorAtRelativeDir, type SkillDescriptor } from "./skill_catalog.ts";

interface CandidateSurveyOptions {
  catalogRoot: string;
  query?: string;
  includeAll?: boolean;
  preferenceDoc?: ProjectPreferencesDoc;
  preferenceFilePath?: string;
}

export interface CandidateSurveyData {
  generated_at: string;
  task_id: string;
  objective: string;
  query: string;
  summary: {
    planned_candidates: number;
    selected_candidates: number;
    visible_catalog_candidates: number;
    project_preferences: number;
    omitted_visible_candidates: number;
  };
  planned_candidates: Array<{
    skill_id: string;
    kind: string;
    visibility: string;
    availability: string;
    selected: boolean;
    preference: string;
    signals: string[];
  }>;
  project_preference_hints: Array<{
    skill_id: string;
    preference: string;
    visible_in_catalog: boolean;
    planned: boolean;
    reason: string;
  }>;
  visible_candidate_shortlist: Array<{
    skill_id: string;
    family: string;
    availability: string;
    preference: string;
    signals: string[];
    description: string;
  }>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

function tokenize(raw: string): string[] {
  const tokens = raw
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  return [...new Set(tokens)];
}

function computeMatchedTokens(queryTokens: string[], ...haystacks: string[]): string[] {
  if (queryTokens.length === 0) {
    return [];
  }
  const candidateTokens = new Set(tokenize(haystacks.join(" ")));
  return queryTokens.filter((token) => candidateTokens.has(token));
}

function preferenceMap(doc?: ProjectPreferencesDoc): Map<string, ProjectPreferenceValue> {
  const map = new Map<string, ProjectPreferenceValue>();
  if (!doc) {
    return map;
  }
  for (const entry of doc.skill_preference) {
    map.set(entry.skill_id, entry.preference);
  }
  return map;
}

function preferenceLabel(value: ProjectPreferenceValue | undefined): string {
  return value ?? "neutral";
}

function preferenceWeight(value: ProjectPreferenceValue | undefined): number {
  if (value === "prefer") {
    return 2;
  }
  if (value === "avoid") {
    return -2;
  }
  return 0;
}

function buildPlanVisibility(plan: SkillPlanEntry, descriptor: SkillDescriptor | null): string {
  if (plan.kind === "local" && descriptor) {
    return "repo_visible";
  }
  return "task_declared";
}

function readPlannedLocalDescriptor(catalogRoot: string, plan: SkillPlanEntry): SkillDescriptor | null {
  if (plan.kind !== "local" || plan.source.trim() === "" || path.isAbsolute(plan.source)) {
    return null;
  }
  try {
    return readSkillDescriptorAtRelativeDir(catalogRoot, plan.source);
  } catch {
    return null;
  }
}

function formatSignals(signals: string[]): string {
  return signals.length > 0 ? signals.join(", ") : "-";
}

function buildVisibleCandidateSignals(
  descriptor: SkillDescriptor,
  preference: ProjectPreferenceValue | undefined,
  matchedTokens: string[],
): string[] {
  return [
    "catalog-visible",
    ...(preference ? [preference] : []),
    ...(matchedTokens.length > 0 ? [`objective-match:${matchedTokens.join("+")}`] : []),
    ...(descriptor.bagakit ? ["bagakit"] : []),
    ...(descriptor.bagakit_driver_file ? ["driver"] : []),
  ];
}

export function buildCandidateSurveyData(doc: SkillUsageDoc, options: CandidateSurveyOptions): CandidateSurveyData {
  const catalog = listVisibleSkillCatalog(options.catalogRoot);
  const bySkillId = new Map(catalog.map((entry) => [entry.skill_id, entry]));
  const prefMap = preferenceMap(options.preferenceDoc);
  const queryText = options.query?.trim() || doc.objective.trim();
  const queryTokens = tokenize(queryText);
  const plannedSkillIds = new Set(doc.skill_plan.map((plan) => plan.skill_id));
  const visibleCandidates = catalog
    .filter((entry) => !plannedSkillIds.has(entry.skill_id))
    .map((entry) => {
      const matchedTokens = computeMatchedTokens(queryTokens, entry.skill_id, entry.name, entry.description, entry.family ?? "");
      const preference = prefMap.get(entry.skill_id);
      const signals = buildVisibleCandidateSignals(entry, preference, matchedTokens);
      const score =
        preferenceWeight(preference) +
        matchedTokens.length * 10 +
        (entry.bagakit ? 3 : 0) +
        (entry.bagakit_driver_file ? 1 : 0);
      return {
        entry,
        preference,
        matchedTokens,
        signals,
        score,
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.entry.skill_id.localeCompare(right.entry.skill_id);
    });

  const shortlistLimit = options.includeAll ? visibleCandidates.length : Math.min(12, visibleCandidates.length);
  const shortlist = visibleCandidates.slice(0, shortlistLimit);
  const omittedCount = visibleCandidates.length - shortlist.length;

  return {
    generated_at: nowIso(),
    task_id: doc.task_id || "<unset>",
    objective: doc.objective || "<unset>",
    query: queryText || "<unset>",
    summary: {
      planned_candidates: doc.skill_plan.length,
      selected_candidates: doc.skill_plan.filter((plan) => plan.selected).length,
      visible_catalog_candidates: catalog.length,
      project_preferences: options.preferenceDoc?.skill_preference.length ?? 0,
      omitted_visible_candidates: omittedCount,
    },
    planned_candidates: doc.skill_plan.map((plan) => {
      const descriptor = readPlannedLocalDescriptor(options.catalogRoot, plan);
      return {
        skill_id: plan.skill_id,
        kind: plan.kind,
        visibility: buildPlanVisibility(plan, descriptor),
        availability: plan.availability,
        selected: plan.selected,
        preference: preferenceLabel(prefMap.get(plan.skill_id)),
        signals: [
          ...(descriptor?.bagakit ? ["bagakit"] : []),
          ...(descriptor?.bagakit_driver_file ? ["driver"] : []),
          ...computeMatchedTokens(
            queryTokens,
            plan.skill_id,
            plan.source,
            plan.why,
            plan.expected_impact,
            descriptor?.name ?? "",
            descriptor?.description ?? "",
          ).map((token) => `objective-match:${token}`),
        ],
      };
    }),
    project_preference_hints: !options.preferenceDoc || options.preferenceDoc.skill_preference.length === 0
      ? []
      : options.preferenceDoc.skill_preference.map((entry) => ({
          skill_id: entry.skill_id,
          preference: entry.preference,
          visible_in_catalog: bySkillId.has(entry.skill_id),
          planned: plannedSkillIds.has(entry.skill_id),
          reason: entry.reason,
        })),
    visible_candidate_shortlist: shortlist.map((item) => ({
      skill_id: item.entry.skill_id,
      family: item.entry.family ?? "-",
      availability: "unknown",
      preference: preferenceLabel(item.preference),
      signals: item.signals,
      description: item.entry.description || "-",
    })),
  };
}

export function buildCandidateSurveyReport(doc: SkillUsageDoc, options: CandidateSurveyOptions): string {
  const data = buildCandidateSurveyData(doc, options);
  const lines = [
    "# Candidate Survey",
    "",
    `Generated: ${data.generated_at}`,
    `Task: ${data.task_id}`,
    `Objective: ${data.objective}`,
    `Query: ${data.query}`,
    `Catalog Source: explicit selector catalog root`,
    `Preferences: ${options.preferenceFilePath ? "present" : "none"}`,
    "",
    "Summary:",
    `- planned_candidates = ${data.summary.planned_candidates}`,
    `- selected_candidates = ${data.summary.selected_candidates}`,
    `- visible_catalog_candidates = ${data.summary.visible_catalog_candidates}`,
    `- project_preferences = ${data.summary.project_preferences}`,
    "",
    "## Planned Candidates",
    "",
    "| Skill ID | Kind | Visibility | Availability | Selected | Preference | Signals |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];

  if (data.planned_candidates.length === 0) {
    lines.push("| - | - | - | - | - | - | - |");
  } else {
    for (const candidate of data.planned_candidates) {
      lines.push(
        `| ${candidate.skill_id} | ${candidate.kind} | ${candidate.visibility} | ${candidate.availability} | ${yesNo(candidate.selected)} | ${candidate.preference} | ${formatSignals(candidate.signals)} |`,
      );
    }
  }

  lines.push("");
  lines.push("## Project Preference Hints");
  lines.push("");
  lines.push("| Skill ID | Preference | Visible In Catalog | Planned | Reason |");
  lines.push("| --- | --- | --- | --- | --- |");
  if (data.project_preference_hints.length === 0) {
    lines.push("| - | neutral | no | no | none |");
  } else {
    for (const entry of data.project_preference_hints) {
      lines.push(
        `| ${entry.skill_id} | ${entry.preference} | ${yesNo(entry.visible_in_catalog)} | ${yesNo(entry.planned)} | ${entry.reason} |`,
      );
    }
  }

  lines.push("");
  lines.push("## Visible Candidate Shortlist");
  lines.push("");
  lines.push("| Skill ID | Family | Availability | Preference | Signals | Description |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  if (data.visible_candidate_shortlist.length === 0) {
    lines.push("| - | - | - | - | - | none |");
  } else {
    for (const item of data.visible_candidate_shortlist) {
      lines.push(
        `| ${item.skill_id} | ${item.family} | ${item.availability} | ${item.preference} | ${formatSignals(item.signals)} | ${item.description} |`,
      );
    }
  }
  if (data.summary.omitted_visible_candidates > 0) {
    lines.push("");
    lines.push(`Omitted visible candidates: ${data.summary.omitted_visible_candidates}. Re-run with --include-all to show the full catalog shortlist.`);
  }

  lines.push("");
  lines.push("Survey notes:");
  lines.push("- `Planned Candidates` are the task-local SSOT candidates already recorded in `[[skill_plan]]`.");
  lines.push("- `Visibility` distinguishes repo-visible canonical local skills from task-declared-only candidates.");
  lines.push("- `Availability` for planned candidates is the recorded task-local judgment in `[[skill_plan]]`, not an automatic repository policy.");
  lines.push("- `Project Preference Hints` are optional host-local hints; they do not change selector/evolver authority.");
  lines.push("- `Visible Candidate Shortlist` keeps catalog-only candidates at `Availability = unknown` until one task-local host check records availability explicitly.");
  lines.push("- `Visible Candidate Shortlist` is a deterministic comparison aid that lightly biases project hints, but still lets objective token overlap lead the shortlist.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}
