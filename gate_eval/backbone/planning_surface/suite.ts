import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runCommand, type CommandResult } from "../../../dev/eval/src/lib/command.ts";
import type { EvalCaseResult, EvalSuiteDefinition } from "../../../dev/eval/src/lib/model.ts";
import { cleanupTempDir, createTempDir, registerTempRepo, writeTextFile } from "../../../dev/eval/src/lib/temp.ts";

type PlanningProfile = {
  system: string;
  declared_host_auto_entry: boolean;
  generic_root_files: boolean;
  namespaced_runtime_observed: boolean;
  typed_planning_truth: boolean;
  execution_binding_observed: boolean;
  staged_analysis_surface: boolean;
  gate_validation_present: boolean;
  gate_eval_present: boolean;
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
  assert.ok(!fs.existsSync(path.join(tempRepo, ".bagakit", "task_plan.md")));
  const completionCheck = runCommand("bash", [checkScript, path.join(tempRepo, "task_plan.md")], { cwd: tempRepo, replacements });
  assert.equal(completionCheck.status, 1, "planning-with-files check-complete should report the fresh plan as incomplete");

  return {
    system: "planning-with-files",
    declared_host_auto_entry: skillText.includes("Auto-activates for complex tasks"),
    generic_root_files: true,
    namespaced_runtime_observed: false,
    typed_planning_truth: false,
    execution_binding_observed: false,
    staged_analysis_surface: false,
    gate_validation_present: false,
    gate_eval_present: false,
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
  expectOk(runCommand("bash", [script, "assign-feature-workspace", "--root", tempRepo, "--feature", featId, "--workspace-mode", "current_tree"], { cwd: repoRoot, replacements }), "feature-tracker assign-feature-workspace");
  expectOk(runCommand("bash", [script, "start-task", "--root", tempRepo, "--feature", featId, "--task", "T-001"], { cwd: repoRoot, replacements }), "feature-tracker start-task");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8")) as Record<string, unknown>;
  const tasks = JSON.parse(fs.readFileSync(tasksPath, "utf8")) as Record<string, unknown>;
  const taskRows = tasks.tasks as Array<Record<string, unknown>>;
  assert.equal(state.workspace_mode, "current_tree");
  assert.equal(state.current_task_id, "T-001");
  assert.ok(Array.isArray(taskRows));
  assert.equal(taskRows[0]?.status, "in_progress");
  assert.ok(statePath.includes(path.join(".bagakit", "feature-tracker")));
  assert.ok(fs.existsSync(gateValidation));
  assert.ok(fs.existsSync(gateEval));
  assert.ok(skillText.includes("feature and task planning truth"));

  return {
    system: "bagakit-feature-tracker",
    declared_host_auto_entry: false,
    generic_root_files: false,
    namespaced_runtime_observed: true,
    typed_planning_truth: true,
    execution_binding_observed: true,
    staged_analysis_surface: false,
    gate_validation_present: true,
    gate_eval_present: true,
    evidence: [
      "feature and task truth lives under namespaced JSON SSOT in .bagakit/feature-tracker/",
      "workspace mode assignment plus start-task make execution binding directly observable",
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
  assert.ok(artifactDir.includes(path.join(".bagakit", "brainstorm")));
  assert.ok(skillText.includes("expert_forum_review"));
  assert.ok(fs.existsSync(gateValidation));
  assert.ok(fs.existsSync(gateEval));

  return {
    system: "bagakit-brainstorm",
    declared_host_auto_entry: false,
    generic_root_files: false,
    namespaced_runtime_observed: true,
    typed_planning_truth: false,
    execution_binding_observed: false,
    staged_analysis_surface: true,
    gate_validation_present: true,
    gate_eval_present: true,
    evidence: [
      "artifact flow is namespaced under .bagakit/brainstorm/ instead of generic root files",
      "the workflow has explicit clarification, analysis, expert forum, and handoff stages",
      "it has both gate_validation and gate_eval slices, but core truth remains markdown-stage artifacts rather than typed planning state",
    ],
  };
}

function comparisonResult(profiles: PlanningProfile[]): EvalCaseResult {
  const bySystem = new Map(profiles.map((profile) => [profile.system, profile]));
  return {
    assertions: [
      "planning-with-files declares host-entry behavior and still uses generic root files instead of a namespaced runtime surface",
      "bagakit-feature-tracker exposes namespaced typed planning truth and direct execution-binding evidence",
      "bagakit-brainstorm exposes namespaced staged-analysis workflow evidence rather than generic notes logging",
      "the three systems are observably different surfaces, not interchangeable planning tools",
    ],
    warnings: [
      "this eval is a property comparison, not a weighted scorecard or one-global-winner benchmark",
      "planning-with-files is still useful as a host-entry pattern source, but a higher-level router is still needed if Bagakit wants selector to displace generic planning hooks by default",
    ],
    commands: [
      "bash <planning-with-files>/scripts/init-session.sh demo",
      "bash skills/harness/bagakit-feature-tracker/scripts/feature-tracker.sh check-reference-readiness --root <temp-repo>",
      "bash skills/harness/bagakit-feature-tracker/scripts/feature-tracker.sh initialize-tracker --root <temp-repo>",
      "bash skills/harness/bagakit-feature-tracker/scripts/feature-tracker.sh create-feature --root <temp-repo> --title \"Eval feature\" --slug \"eval-feature\" --goal \"Ship eval\" --workspace-mode proposal_only",
      "bash skills/harness/bagakit-feature-tracker/scripts/feature-tracker.sh assign-feature-workspace --root <temp-repo> --feature <id> --workspace-mode current_tree",
      "bash skills/harness/bagakit-feature-tracker/scripts/feature-tracker.sh start-task --root <temp-repo> --feature <id> --task T-001",
      "python3 skills/harness/bagakit-brainstorm/scripts/bagakit-brainstorm.py init --topic \"Eval topic\" --slug eval-topic --root <temp-repo>",
    ],
    outputs: {
      profiles,
      borrow: [
        "Borrow host-entry leverage and capture-discipline ideas from planning-with-files.",
        "Do not borrow generic root files or markdown-only planning truth as the canonical Bagakit planning surface.",
      ],
      observed_property_summary: {
        host_entry_pattern: bySystem.get("planning-with-files")?.declared_host_auto_entry ? "planning-with-files declares a host-entry pattern" : "no host-entry pattern declared",
        canonical_planning_truth: bySystem.get("bagakit-feature-tracker")?.typed_planning_truth ? "feature-tracker exposes a typed planning-truth surface" : "no typed planning-truth surface observed",
        ambiguity_reduction: bySystem.get("bagakit-brainstorm")?.staged_analysis_surface ? "brainstorm exposes a staged ambiguity-reduction surface" : "no staged analysis surface observed",
      },
    },
  };
}

export const SUITE: EvalSuiteDefinition = {
  id: "planning-surface-comparison-eval",
  owner: "gate_eval/backbone/planning_surface",
  title: "Planning Surface Comparison Eval",
  summary: "Compare observable planning-surface properties across planning-with-files, bagakit-feature-tracker, and bagakit-brainstorm instead of treating them as one interchangeable category.",
  defaultOutputDir: "gate_eval/backbone/planning_surface/results/runs",
  cases: [
    {
      id: "compare-planning-surface-fit",
      title: "Compare Planning Surface Fit",
      summary: "Compare which observable planning-surface properties are present for host entry, canonical planning truth, execution binding, and staged analysis.",
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

          assert.equal(planning.declared_host_auto_entry, true);
          assert.equal(planning.generic_root_files, true);
          assert.equal(featureTracker.namespaced_runtime_observed, true);
          assert.equal(featureTracker.typed_planning_truth, true);
          assert.equal(featureTracker.execution_binding_observed, true);
          assert.equal(brainstorm.namespaced_runtime_observed, true);
          assert.equal(brainstorm.staged_analysis_surface, true);
          assert.equal(featureTracker.gate_validation_present, true);
          assert.equal(brainstorm.gate_validation_present, true);

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
