import type { ProjectPreferenceValue, ProjectPreferencesDoc, SkillPlanEntry, SkillUsageDoc } from "./model.ts";
import { listVisibleSkillCatalog, readSkillDescriptorAtRelativeDir, type SkillDescriptor } from "./skill_catalog.ts";

interface CandidateSurveyOptions {
  catalogRoot: string;
  query?: string;
  includeAll?: boolean;
  preferenceDoc?: ProjectPreferencesDoc;
  preferenceFilePath?: string;
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
    return 100;
  }
  if (value === "avoid") {
    return -100;
  }
  return 0;
}

function buildPlanVisibility(plan: SkillPlanEntry, descriptor: SkillDescriptor | null): string {
  if (plan.kind === "local" && descriptor) {
    return "repo_visible";
  }
  return "task_declared";
}

function formatSignals(signals: string[]): string {
  return signals.length > 0 ? signals.join(", ") : "-";
}

function buildPlannedCandidateRow(
  plan: SkillPlanEntry,
  descriptor: SkillDescriptor | null,
  preference: ProjectPreferenceValue | undefined,
  queryTokens: string[],
): string {
  const matchedTokens = computeMatchedTokens(
    queryTokens,
    plan.skill_id,
    plan.source,
    plan.why,
    plan.expected_impact,
    descriptor?.name ?? "",
    descriptor?.description ?? "",
  );
  const signals = [
    ...(descriptor?.bagakit ? ["bagakit"] : []),
    ...(descriptor?.selector_driver_file ? ["driver"] : []),
    ...(matchedTokens.length > 0 ? [`objective-match:${matchedTokens.join("+")}`] : []),
  ];

  return `| ${plan.skill_id} | ${plan.kind} | ${buildPlanVisibility(plan, descriptor)} | ${plan.availability} | ${yesNo(plan.selected)} | ${preferenceLabel(preference)} | ${formatSignals(signals)} |`;
}

function buildVisibleCandidateSignals(
  descriptor: SkillDescriptor,
  preference: ProjectPreferenceValue | undefined,
  matchedTokens: string[],
): string[] {
  return [
    ...(preference ? [preference] : []),
    ...(matchedTokens.length > 0 ? [`objective-match:${matchedTokens.join("+")}`] : []),
    ...(descriptor.bagakit ? ["bagakit"] : []),
    ...(descriptor.selector_driver_file ? ["driver"] : []),
  ];
}

export function buildCandidateSurveyReport(doc: SkillUsageDoc, options: CandidateSurveyOptions): string {
  const catalog = listVisibleSkillCatalog(options.catalogRoot);
  const bySkillId = new Map(catalog.map((entry) => [entry.skill_id, entry]));
  const prefMap = preferenceMap(options.preferenceDoc);
  const queryText = options.query?.trim() || doc.objective.trim();
  const queryTokens = tokenize(queryText);
  const plannedSkillIds = new Set(doc.skill_plan.map((plan) => plan.skill_id));
  const plannedRows = doc.skill_plan.map((plan) =>
    buildPlannedCandidateRow(plan, readSkillDescriptorAtRelativeDir(options.catalogRoot, plan.source), prefMap.get(plan.skill_id), queryTokens)
  );

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
        (entry.selector_driver_file ? 1 : 0);
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

  const lines = [
    "# Candidate Survey",
    "",
    `Generated: ${nowIso()}`,
    `Task: ${doc.task_id || "<unset>"}`,
    `Objective: ${doc.objective || "<unset>"}`,
    `Query: ${queryText || "<unset>"}`,
    `Catalog Root: ${options.catalogRoot}`,
    `Preferences: ${options.preferenceFilePath ?? "none"}`,
    "",
    "Summary:",
    `- planned_candidates = ${doc.skill_plan.length}`,
    `- selected_candidates = ${doc.skill_plan.filter((plan) => plan.selected).length}`,
    `- visible_catalog_candidates = ${catalog.length}`,
    `- project_preferences = ${options.preferenceDoc?.skill_preference.length ?? 0}`,
    "",
    "## Planned Candidates",
    "",
    "| Skill ID | Kind | Visibility | Availability | Selected | Preference | Signals |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];

  if (plannedRows.length === 0) {
    lines.push("| - | - | - | - | - | - | - |");
  } else {
    lines.push(...plannedRows);
  }

  lines.push("");
  lines.push("## Project Preference Hints");
  lines.push("");
  lines.push("| Skill ID | Preference | Visible In Catalog | Planned | Reason |");
  lines.push("| --- | --- | --- | --- | --- |");
  if (!options.preferenceDoc || options.preferenceDoc.skill_preference.length === 0) {
    lines.push("| - | neutral | no | no | none |");
  } else {
    for (const entry of options.preferenceDoc.skill_preference) {
      lines.push(
        `| ${entry.skill_id} | ${entry.preference} | ${yesNo(bySkillId.has(entry.skill_id))} | ${yesNo(plannedSkillIds.has(entry.skill_id))} | ${entry.reason} |`,
      );
    }
  }

  lines.push("");
  lines.push("## Visible Candidate Shortlist");
  lines.push("");
  lines.push("| Skill ID | Family | Availability | Preference | Signals | Description |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  if (shortlist.length === 0) {
    lines.push("| - | - | - | - | - | none |");
  } else {
    for (const item of shortlist) {
      lines.push(
        `| ${item.entry.skill_id} | ${item.entry.family ?? "-"} | available | ${preferenceLabel(item.preference)} | ${formatSignals(item.signals)} | ${item.entry.description || "-"} |`,
      );
    }
  }
  if (omittedCount > 0) {
    lines.push("");
    lines.push(`Omitted visible candidates: ${omittedCount}. Re-run with --include-all to show the full catalog shortlist.`);
  }

  lines.push("");
  lines.push("Survey notes:");
  lines.push("- `Planned Candidates` are the task-local SSOT candidates already recorded in `[[skill_plan]]`.");
  lines.push("- `Visibility` distinguishes repo-visible canonical local skills from task-declared-only candidates.");
  lines.push("- `Availability` for planned candidates is the recorded task-local judgment in `[[skill_plan]]`, not an automatic repository policy.");
  lines.push("- `Project Preference Hints` are optional host-local hints; they do not change selector/evolver authority.");
  lines.push("- `Visible Candidate Shortlist` is a deterministic comparison aid that prefers explicit project hints, objective token overlap, Bagakit namespace, and driver declaration.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}
