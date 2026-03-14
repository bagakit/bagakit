import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runCommand, type CommandResult } from "../../../dev/eval/src/lib/command.ts";
import type { EvalCaseResult, EvalSuiteDefinition } from "../../../dev/eval/src/lib/model.ts";
import { cleanupTempDir, createTempDir, registerTempRepo, writeTextFile } from "../../../dev/eval/src/lib/temp.ts";

type PlanningProfile = {
  system: string;
  host_entry_leverage: number;
  canonical_planning_truth: number;
  execution_binding: number;
  analysis_depth: number;
  validation_depth: number;
  collision_safety: number;
  evidence: string[];
};

function expectOk(result: CommandResult, label: string): void {
  assert.equal(result.status, 0, `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

function initGitRepo(cwd: string, replacements: { from: string; to: string }[]): void {
  expectOk(runCommand("git", ["init", "-q"], { cwd, replacements }), "git init");
  expectOk(runCommand("git", ["config", "user.name", "Bagakit"], { cwd, replacements }), "git config user.name");
  expectOk(runCommand("git", ["config", "user.email", "bagakit@example.com"], { cwd, replacements }), "git config user.email");
  writeTextFile(path.join(cwd, "README.md"), "# demo\n");
  expectOk(runCommand("git", ["add", "README.md"], { cwd, replacements }), "git add");
  expectOk(runCommand("git", ["commit", "-q", "-m", "init"], { cwd, replacements }), "git commit");
}

function resolvePlanningWithFilesSkillDir(): string {
  const override = process.env.PLANNING_WITH_FILES_SKILL_DIR?.trim();
  const candidates = [
    override,
    process.env.HOME ? path.join(process.env.HOME, ".codex", "skills", "planning-with-files") : "",
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const skillFile = path.join(candidate, "SKILL.md");
    if (fs.existsSync(skillFile)) {
      return candidate;
    }
  }
  throw new Error(
    "planning-with-files skill not found; set PLANNING_WITH_FILES_SKILL_DIR or install it under ~/.codex/skills/planning-with-files",
  );
}

function extractCreatedDir(output: string): string {
  const line = output.split("\n").find((entry) => entry.startsWith("created="));
  assert.ok(line, `missing created= line in brainstorm init output\n${output}`);
  return line.slice("created=".length);
}

function resolveCreatedDir(createdDir: string, tempRepo: string): string {
  if (createdDir.startsWith("<temp-repo>")) {
    return path.join(tempRepo, createdDir.slice("<temp-repo>".length).replace(/^\/+/, ""));
  }
  return path.isAbsolute(createdDir) ? createdDir : path.join(tempRepo, createdDir);
}

function profilePlanningWithFiles(repoRoot: string, tempRepo: string, replacements: { from: string; to: string }[]): PlanningProfile {
  const skillDir = resolvePlanningWithFilesSkillDir();
  const skillText = fs.readFileSync(path.join(skillDir, "SKILL.md"), "utf8");
  const initScript = path.join(skillDir, "scripts", "init-session.sh");
  const checkScript = path.join(skillDir, "scripts", "check-complete.sh");

  expectOk(runCommand("bash", [initScript, "demo"], { cwd: tempRepo, replacements }), "planning-with-files init-session");
  assert.ok(fs.existsSync(path.join(tempRepo, "task_plan.md")));
  assert.ok(fs.existsSync(path.join(tempRepo, "findings.md")));
  assert.ok(fs.existsSync(path.join(tempRepo, "progress.md")));
  const completionCheck = runCommand("bash", [checkScript, path.join(tempRepo, "task_plan.md")], { cwd: tempRepo, replacements });
  assert.equal(completionCheck.status, 1, "planning-with-files check-complete should report the fresh plan as incomplete");

  return {
    system: "planning-with-files",
    host_entry_leverage: skillText.includes("Auto-activates for complex tasks") ? 5 : 1,
    canonical_planning_truth: 1,
    execution_binding: 1,
    analysis_depth: skillText.includes("2-Action Rule") ? 2 : 1,
    validation_depth: 1,
    collision_safety: 1,
    evidence: [
      "host hooks auto-activate the pattern for complex tasks",
      "runtime writes three generic markdown files directly into project root",
      "the stop-hook completeness check only counts markdown phase markers and intentionally starts in a failing state",
    ],
  };
}

function profileFeatureTracker(repoRoot: string, tempRepo: string, replacements: { from: string; to: string }[]): PlanningProfile {
  const skillText = fs.readFileSync(path.join(repoRoot, "skills", "harness", "bagakit-feature-tracker", "SKILL.md"), "utf8");
  const script = path.join(repoRoot, "skills", "harness", "bagakit-feature-tracker", "scripts", "feature-tracker.sh");
  const gateValidation = path.join(repoRoot, "gate_validation", "skills", "harness", "bagakit-feature-tracker", "validation.toml");
  const gateEval = path.join(repoRoot, "gate_eval", "skills", "harness", "bagakit-feature-tracker", "suite.ts");

  initGitRepo(tempRepo, replacements);
  expectOk(runCommand("bash", [script, "check-reference-readiness", "--root", tempRepo], { cwd: repoRoot, replacements }), "feature-tracker check-reference-readiness");
  expectOk(runCommand("bash", [script, "initialize-tracker", "--root", tempRepo], { cwd: repoRoot, replacements }), "feature-tracker initialize-tracker");
  expectOk(
    runCommand(
      "bash",
      [script, "create-feature", "--root", tempRepo, "--title", "Eval feature", "--slug", "eval-feature", "--goal", "Ship eval", "--workspace-mode", "proposal_only"],
      { cwd: repoRoot, replacements },
    ),
    "feature-tracker create-feature",
  );

  const indexPath = path.join(tempRepo, ".bagakit", "feature-tracker", "index", "features.json");
  const payload = JSON.parse(fs.readFileSync(indexPath, "utf8")) as { features: Array<{ feat_id: string }> };
  const featId = payload.features[0]?.feat_id;
  assert.ok(featId, "feature-tracker did not create a feature id");

  const statePath = path.join(tempRepo, ".bagakit", "feature-tracker", "features", featId, "state.json");
  const tasksPath = path.join(tempRepo, ".bagakit", "feature-tracker", "features", featId, "tasks.json");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8")) as Record<string, unknown>;
  const tasks = JSON.parse(fs.readFileSync(tasksPath, "utf8")) as Record<string, unknown>;
  assert.equal(state.workspace_mode, "proposal_only");
  assert.ok(Array.isArray(tasks.tasks));
  assert.ok(fs.existsSync(gateValidation));
  assert.ok(fs.existsSync(gateEval));

  return {
    system: "bagakit-feature-tracker",
    host_entry_leverage: 1,
    canonical_planning_truth: 5,
    execution_binding: 5,
    analysis_depth: 2,
    validation_depth: 5,
    collision_safety: 5,
    evidence: [
      "feature and task truth lives under namespaced JSON SSOT in .bagakit/feature-tracker/",
      "workspace mode, current task, and commit contract bind planning directly to execution",
      "the skill has both gate_validation and gate_eval coverage in-repo",
    ],
  };
}

function profileBrainstorm(repoRoot: string, tempRepo: string, replacements: { from: string; to: string }[]): PlanningProfile {
  const skillText = fs.readFileSync(path.join(repoRoot, "skills", "harness", "bagakit-brainstorm", "SKILL.md"), "utf8");
  const script = path.join(repoRoot, "skills", "harness", "bagakit-brainstorm", "scripts", "bagakit-brainstorm.py");
  const gateValidation = path.join(repoRoot, "gate_validation", "skills", "harness", "bagakit-brainstorm", "validation.toml");
  const gateEval = path.join(repoRoot, "gate_eval", "skills", "harness", "bagakit-brainstorm", "suite.ts");

  const initResult = runCommand("python3", [script, "init", "--topic", "Eval topic", "--slug", "eval-topic", "--root", tempRepo], { cwd: repoRoot, replacements });
  expectOk(initResult, "brainstorm init");
  const createdDir = extractCreatedDir(initResult.stdout);
  const artifactDir = resolveCreatedDir(createdDir, tempRepo);
  assert.ok(fs.existsSync(path.join(artifactDir, "input_and_qa.md")));
  assert.ok(fs.existsSync(path.join(artifactDir, "finding_and_analyze.md")));
  assert.ok(fs.existsSync(path.join(artifactDir, "expert_forum.md")));
  assert.ok(fs.existsSync(path.join(artifactDir, "outcome_and_handoff.md")));
  assert.ok(skillText.includes("expert_forum_review"));
  assert.ok(fs.existsSync(gateValidation));
  assert.ok(fs.existsSync(gateEval));

  return {
    system: "bagakit-brainstorm",
    host_entry_leverage: 1,
    canonical_planning_truth: 3,
    execution_binding: 2,
    analysis_depth: 5,
    validation_depth: 4,
    collision_safety: 5,
    evidence: [
      "artifact flow is namespaced under .bagakit/brainstorm/ instead of generic root files",
      "the workflow has explicit clarification, analysis, expert forum, and handoff stages",
      "it has both gate_validation and gate_eval slices, but core truth remains markdown-stage artifacts rather than JSON SSOT",
    ],
  };
}

function total(profile: PlanningProfile): number {
  return (
    profile.host_entry_leverage +
    profile.canonical_planning_truth +
    profile.execution_binding +
    profile.analysis_depth +
    profile.validation_depth +
    profile.collision_safety
  );
}

function rankProfiles(profiles: PlanningProfile[]): Record<string, string> {
  const bestBy = (key: keyof Omit<PlanningProfile, "system" | "evidence">): string =>
    profiles.slice().sort((left, right) => Number(right[key]) - Number(left[key]))[0]!.system;
  return {
    best_host_entry: bestBy("host_entry_leverage"),
    best_canonical_truth: bestBy("canonical_planning_truth"),
    best_execution_binding: bestBy("execution_binding"),
    best_analysis_depth: bestBy("analysis_depth"),
    best_validation_depth: bestBy("validation_depth"),
    best_collision_safety: bestBy("collision_safety"),
  };
}

function comparisonResult(profiles: PlanningProfile[]): EvalCaseResult {
  const ranking = rankProfiles(profiles);
  return {
    assertions: [
      "planning-with-files leads only on host-entry leverage, not on canonical planning truth",
      "bagakit-feature-tracker is the strongest canonical planning surface because it combines JSON SSOT, execution binding, and validation depth",
      "bagakit-brainstorm is the strongest analysis surface because it provides a staged option-review-handoff workflow rather than a generic notes log",
      "generic root planning files are materially weaker than namespaced Bagakit runtimes on collision safety and integration fitness",
    ],
    warnings: [
      "planning-with-files is still useful as a host-entry pattern, but not as the canonical planning state model for Bagakit-style repos",
      "feature-tracker currently lacks host auto-entry and therefore still needs a higher-level router if it should displace generic planning hooks",
    ],
    commands: [
      "bash <planning-with-files>/scripts/init-session.sh demo",
      "bash skills/harness/bagakit-feature-tracker/scripts/feature-tracker.sh initialize-tracker --root <temp-repo>",
      "python3 skills/harness/bagakit-brainstorm/scripts/bagakit-brainstorm.py init --topic \"Eval topic\" --slug eval-topic --root <temp-repo>",
    ],
    outputs: {
      profiles: profiles.map((profile) => ({
        ...profile,
        total: total(profile),
      })),
      ranking,
      borrow: [
        "Borrow host-entry leverage and capture-discipline ideas from planning-with-files.",
        "Do not borrow generic root files or markdown-only planning truth as the canonical Bagakit planning surface.",
      ],
      verdict: {
        planning_with_files: "Worth borrowing as a host interaction pattern, not as the canonical planning runtime.",
        feature_tracker: "Best fit for canonical planning truth and execution-bound delivery.",
        brainstorm: "Best fit for ambiguity reduction, option generation, and decision handoff from markdown context.",
      },
    },
  };
}

export const SUITE: EvalSuiteDefinition = {
  id: "planning-surface-comparison-eval",
  owner: "gate_eval/backbone/planning_surface",
  title: "Planning Surface Comparison Eval",
  summary: "Compare planning-with-files, bagakit-feature-tracker, and bagakit-brainstorm on planning-surface fit rather than treating them as one interchangeable category.",
  defaultOutputDir: "gate_eval/backbone/planning_surface/results/runs",
  cases: [
    {
      id: "compare-planning-surface-fit",
      title: "Compare Planning Surface Fit",
      summary: "Measure which current planning surface is strongest for host entry, canonical planning truth, execution binding, and analysis depth.",
      focus: ["planning-entry", "canonical-truth", "analysis-depth", "validation-depth"],
      run: (context) => {
        const tempPlanningRepo = createTempDir("planning-with-files-eval-");
        const tempFeatureRepo = createTempDir("feature-tracker-eval-");
        const tempBrainstormRepo = createTempDir("brainstorm-eval-");
        const planningReplacements = registerTempRepo(context, tempPlanningRepo);
        const featureReplacements = registerTempRepo(context, tempFeatureRepo);
        const brainstormReplacements = registerTempRepo(context, tempBrainstormRepo);
        try {
          const planning = profilePlanningWithFiles(context.repoRoot, tempPlanningRepo, planningReplacements);
          const featureTracker = profileFeatureTracker(context.repoRoot, tempFeatureRepo, featureReplacements);
          const brainstorm = profileBrainstorm(context.repoRoot, tempBrainstormRepo, brainstormReplacements);

          assert.ok(planning.host_entry_leverage > featureTracker.host_entry_leverage);
          assert.ok(planning.host_entry_leverage > brainstorm.host_entry_leverage);
          assert.ok(featureTracker.canonical_planning_truth > planning.canonical_planning_truth);
          assert.ok(featureTracker.execution_binding > planning.execution_binding);
          assert.ok(brainstorm.analysis_depth > planning.analysis_depth);
          assert.ok(brainstorm.analysis_depth > featureTracker.analysis_depth);
          assert.ok(featureTracker.collision_safety > planning.collision_safety);
          assert.ok(brainstorm.collision_safety > planning.collision_safety);

          return comparisonResult([planning, featureTracker, brainstorm]);
        } finally {
          cleanupTempDir(tempPlanningRepo, context.keepTemp);
          cleanupTempDir(tempFeatureRepo, context.keepTemp);
          cleanupTempDir(tempBrainstormRepo, context.keepTemp);
        }
      },
    },
  ],
};
