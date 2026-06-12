import type { SkillUsageDoc } from "./model.ts";

interface SkillRankingRow {
  skillId: string;
  usageCount: number;
  executionScore: number;
  feedbackScore: number;
  errorPatternCount: number;
  compositeScore: number;
  status: "optimal" | "usable" | "at_risk";
}

export interface SkillRankingData {
  generated_at: string;
  task_id: string;
  objective: string;
  rows: SkillRankingRow[];
  evolver_review_signals: Array<{
    signal_id: string;
    status: string;
    trigger: string;
    scope_hint: string;
    confidence: number;
    summary: string;
  }>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeRows(doc: SkillUsageDoc): SkillRankingRow[] {
  const stats = new Map<
    string,
    {
      usageCount: number;
      successCount: number;
      partialCount: number;
      positiveFeedback: number;
      neutralFeedback: number;
      negativeFeedback: number;
      errorPatternCount: number;
    }
  >();
  const errorPatternClusterMax = new Map<string, Map<string, number>>();

  function ensure(skillId: string) {
    const existing = stats.get(skillId);
    if (existing) {
      return existing;
    }
    const fresh = {
      usageCount: 0,
      successCount: 0,
      partialCount: 0,
      positiveFeedback: 0,
      neutralFeedback: 0,
      negativeFeedback: 0,
      errorPatternCount: 0,
    };
    stats.set(skillId, fresh);
    return fresh;
  }

  for (const usage of doc.usage_log) {
    const entry = ensure(usage.skill_id);
    if (usage.result === "not_used") {
      continue;
    }
    entry.usageCount += 1;
    if (usage.result === "success") {
      entry.successCount += 1;
    } else if (usage.result === "partial") {
      entry.partialCount += 1;
    }
  }

  for (const feedback of doc.feedback_log) {
    const entry = ensure(feedback.skill_id);
    if (feedback.signal === "positive") {
      entry.positiveFeedback += 1;
    } else if (feedback.signal === "negative") {
      entry.negativeFeedback += 1;
    } else {
      entry.neutralFeedback += 1;
    }
  }

  for (const errorPattern of doc.error_pattern_log) {
    const skillClusters = errorPatternClusterMax.get(errorPattern.skill_id) ?? new Map<string, number>();
    errorPatternClusterMax.set(errorPattern.skill_id, skillClusters);
    const clusterKey = `${errorPattern.error_type}\u0000${errorPattern.message_pattern}`;
    const currentMax = skillClusters.get(clusterKey) ?? 0;
    skillClusters.set(clusterKey, Math.max(currentMax, errorPattern.occurrence_index));
  }

  for (const [skillId, clusters] of errorPatternClusterMax.entries()) {
    const entry = ensure(skillId);
    let total = 0;
    for (const value of clusters.values()) {
      total += value;
    }
    entry.errorPatternCount = total;
  }

  const rows: SkillRankingRow[] = [];
  for (const [skillId, entry] of stats.entries()) {
    const hasAttemptLikeSignal =
      entry.usageCount > 0 ||
      entry.errorPatternCount > 0;
    if (!hasAttemptLikeSignal) {
      continue;
    }

    const usageDenominator = Math.max(entry.usageCount, 1);
    const executionScore = (entry.successCount + 0.5 * entry.partialCount) / usageDenominator;

    const feedbackTotal = entry.positiveFeedback + entry.neutralFeedback + entry.negativeFeedback;
    const feedbackScore = feedbackTotal === 0
      ? 0.5
      : (entry.positiveFeedback + 0.5 * entry.neutralFeedback) / feedbackTotal;

    const errorPenalty = Math.min(entry.errorPatternCount / usageDenominator, 1);
    const compositeScore = 0.6 * executionScore + 0.3 * feedbackScore + 0.1 * (1 - errorPenalty);

    let status: SkillRankingRow["status"];
    if (compositeScore >= 0.8) {
      status = "optimal";
    } else if (compositeScore >= 0.6) {
      status = "usable";
    } else {
      status = "at_risk";
    }

    rows.push({
      skillId,
      usageCount: entry.usageCount,
      executionScore: round2(executionScore),
      feedbackScore: round2(feedbackScore),
      errorPatternCount: entry.errorPatternCount,
      compositeScore: round2(compositeScore),
      status,
    });
  }

  rows.sort((left, right) => {
    if (right.compositeScore !== left.compositeScore) {
      return right.compositeScore - left.compositeScore;
    }
    return left.skillId.localeCompare(right.skillId);
  });
  return rows;
}

export function buildSkillRankingData(doc: SkillUsageDoc): SkillRankingData {
  return {
    generated_at: nowIso(),
    task_id: doc.task_id || "<unset>",
    objective: doc.objective || "<unset>",
    rows: computeRows(doc),
    evolver_review_signals: doc.evolver_signal_log.map((signal) => ({
      signal_id: signal.signal_id,
      status: signal.status,
      trigger: signal.trigger,
      scope_hint: signal.scope_hint,
      confidence: round2(signal.confidence),
      summary: signal.summary,
    })),
  };
}

export function buildSkillRankingReport(doc: SkillUsageDoc): string {
  const data = buildSkillRankingData(doc);
  const rows = data.rows;
  const lines = [
    "# Skill Ranking Report",
    "",
    `Generated: ${data.generated_at}`,
    `Task: ${data.task_id}`,
    `Objective: ${data.objective}`,
    "",
    "| Rank | Skill ID | Usage | Execution | Feedback | Error Patterns | Composite | Status |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];

  rows.forEach((row, index) => {
    lines.push(
      `| ${index + 1} | ${row.skillId} | ${row.usageCount} | ${row.executionScore.toFixed(2)} | ${row.feedbackScore.toFixed(2)} | ${row.errorPatternCount} | ${row.compositeScore.toFixed(2)} | ${row.status} |`,
    );
  });

  if (rows.length === 0) {
    lines.push("| - | - | 0 | 0.00 | 0.50 | 0 | 0.00 | at_risk |");
  }

  lines.push("");
  lines.push("Scoring notes:");
  lines.push("- `Usage` counts actual execution attempts; `not_used` task logs stay visible but do not dilute attempt scoring.");
  lines.push("- `Execution` rewards success and gives partial credit to partial outcomes.");
  lines.push("- `Feedback` defaults to neutral when no explicit feedback exists.");
  lines.push("- `Error Patterns` sums the selector-counted repeat depth for each clustered failure signature.");
  lines.push("- `Composite` is a task-local comparison aid, not a repository-level promotion decision.");
  lines.push("");
  lines.push("## Evolver Review Signals");
  lines.push("");
  if (data.evolver_review_signals.length === 0) {
    lines.push("- none");
  } else {
    for (const signal of data.evolver_review_signals) {
      lines.push(
        `- ${signal.signal_id} | status=${signal.status} | trigger=${signal.trigger} | scope_hint=${signal.scope_hint} | confidence=${signal.confidence.toFixed(2)}`,
      );
      lines.push(`  - ${signal.summary}`);
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}
