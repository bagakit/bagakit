import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runCommand, type CommandResult } from "../../../../dev/eval/src/lib/command.ts";
import type { EvalSuiteDefinition } from "../../../../dev/eval/src/lib/model.ts";
import { createTempDir, writeTextFile } from "../../../../dev/eval/src/lib/temp.ts";

function expectOk(result: CommandResult, label: string): void {
  assert.equal(result.status, 0, `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

function initGitRepo(cwd: string, replacements: { from: string; to: string }[]): void {
  expectOk(runCommand("git", ["init", "-q", "-b", "main"], { cwd, replacements }), "git init");
  expectOk(runCommand("git", ["config", "user.name", "Bagakit"], { cwd, replacements }), "git config user.name");
  expectOk(runCommand("git", ["config", "user.email", "bagakit@example.com"], { cwd, replacements }), "git config user.email");
  writeTextFile(path.join(cwd, "README.md"), "# demo\n");
  expectOk(runCommand("git", ["add", "README.md"], { cwd, replacements }), "git add");
  expectOk(runCommand("git", ["commit", "-q", "-m", "init"], { cwd, replacements }), "git commit");
}

function featureId(tempRepo: string): string {
  const indexPath = path.join(tempRepo, ".bagakit", "feature-tracker", "index", "features.json");
  const payload = JSON.parse(fs.readFileSync(indexPath, "utf8")) as { features: Array<{ feat_id: string }> };
  return payload.features[0].feat_id;
}

export const SUITE: EvalSuiteDefinition = {
  id: "bagakit-feature-tracker-openspec-adapter-shared-runner-eval",
  owner: "gate_eval/skills/harness/bagakit-feature-tracker-openspec-adapter",
  title: "OpenSpec Adapter Shared Runner Eval",
  summary: "Measure deterministic round-trip bridge fidelity for the feature-tracker OpenSpec adapter.",
  defaultOutputDir: "gate_eval/skills/harness/bagakit-feature-tracker-openspec-adapter/results/runs",
  cases: [
    {
      id: "round-trip-preserves-export-and-import-shape",
      title: "Round Trip Preserves Export And Import Shape",
      summary: "Export should produce OpenSpec files and import should materialize a ready tracker feature with translated task states.",
      focus: ["bridge-fidelity", "state-translation", "spec-delta-projection"],
      run: ({ repoRoot, addReplacement }) => {
        const tempRepo = createTempDir("bagakit-openspec-adapter-eval-");
        const canonicalTempRepo = fs.realpathSync(tempRepo);
        const replacements = [
          { from: canonicalTempRepo, to: "<temp-repo>" },
          { from: tempRepo, to: "<temp-repo>" },
        ];
        for (const replacement of replacements) {
          addReplacement(replacement.from, replacement.to);
        }
        initGitRepo(tempRepo, replacements);

        const trackerScript = path.join(repoRoot, "skills", "harness", "bagakit-feature-tracker", "scripts", "feature-tracker.sh");
        const adapterScript = path.join(repoRoot, "skills", "harness", "bagakit-feature-tracker-openspec-adapter", "scripts", "openspec-feature-adapter.sh");
        expectOk(runCommand("bash", [trackerScript, "check-reference-readiness", "--root", tempRepo], { cwd: repoRoot, replacements }), "check-reference-readiness");
        expectOk(runCommand("bash", [trackerScript, "initialize-tracker", "--root", tempRepo], { cwd: repoRoot, replacements }), "initialize-tracker");
        expectOk(runCommand("bash", [trackerScript, "create-feature", "--root", tempRepo, "--title", "Exported feature", "--slug", "exported-feature", "--goal", "Bridge out", "--workspace-mode", "proposal_only"], { cwd: repoRoot, replacements }), "create-feature");
        const featId = featureId(tempRepo);
        const specDelta = path.join(tempRepo, ".bagakit", "feature-tracker", "features", featId, "spec-deltas", "bridge-capability.md");
        writeTextFile(specDelta, "# Spec Delta\n\nBridge capability.\n");
        expectOk(runCommand("bash", [adapterScript, "export-feature", "--root", tempRepo, "--feature", featId, "--change-name", "exported-change"], { cwd: repoRoot, replacements, env: { BAGAKIT_FEATURE_TRACKER_SKILL_DIR: path.join(repoRoot, "skills", "harness", "bagakit-feature-tracker") } }), "export-feature");

        const proposalPath = path.join(tempRepo, "openspec", "changes", "exported-change", "proposal.md");
        const tasksPath = path.join(tempRepo, "openspec", "changes", "exported-change", "tasks.md");
        const specPath = path.join(tempRepo, "openspec", "changes", "exported-change", "specs", "bridge-capability", "spec.md");
        assert.ok(fs.existsSync(proposalPath));
        assert.ok(fs.existsSync(tasksPath));
        assert.ok(fs.existsSync(specPath));

        writeTextFile(path.join(tempRepo, "openspec", "changes", "imported-change", "proposal.md"), "# Imported Proposal\n");
        writeTextFile(path.join(tempRepo, "openspec", "changes", "imported-change", "tasks.md"), "# Tasks\n\n- [ ] Draft implementation\n- [x] Capture review notes\n");
        writeTextFile(path.join(tempRepo, "openspec", "changes", "imported-change", "specs", "reader-capability", "spec.md"), "# Reader Capability\n");
        expectOk(runCommand("bash", [adapterScript, "import-change", "--root", tempRepo, "--change", "imported-change"], { cwd: repoRoot, replacements, env: { BAGAKIT_FEATURE_TRACKER_SKILL_DIR: path.join(repoRoot, "skills", "harness", "bagakit-feature-tracker") } }), "import-change");

        const indexPath = path.join(tempRepo, ".bagakit", "feature-tracker", "index", "features.json");
        const indexPayload = JSON.parse(fs.readFileSync(indexPath, "utf8")) as { features: Array<Record<string, unknown>> };
        const imported = indexPayload.features.find((entry) => entry.title === "Imported: imported-change") as { feat_id: string } | undefined;
        assert.ok(imported, "expected imported feature in index");
        const importedStatePath = path.join(tempRepo, ".bagakit", "feature-tracker", "features", imported!.feat_id, "state.json");
        const importedTasksPath = path.join(tempRepo, ".bagakit", "feature-tracker", "features", imported!.feat_id, "tasks.json");
        const importedState = JSON.parse(fs.readFileSync(importedStatePath, "utf8")) as Record<string, unknown>;
        const importedTasks = JSON.parse(fs.readFileSync(importedTasksPath, "utf8")) as { tasks: Array<Record<string, unknown>> };
        assert.equal(importedState.status, "ready");
        assert.equal(importedState.workspace_mode, "worktree");
        assert.equal(importedTasks.tasks.length, 2);
        assert.equal(importedTasks.tasks[1].status, "done");

        return {
          assertions: [
            "export writes proposal, task list, and spec files into OpenSpec layout",
            "import materializes a ready tracker feature with worktree workspace mode",
            "completed OpenSpec checklist items translate into done tracker tasks",
          ],
          commands: [
            `bash ${trackerScript} create-feature --root <temp-repo> --title "Exported feature" --slug "exported-feature" --goal "Bridge out" --workspace-mode proposal_only`,
            `bash ${adapterScript} export-feature --root <temp-repo> --feature ${featId} --change-name exported-change`,
            `bash ${adapterScript} import-change --root <temp-repo> --change imported-change`,
          ],
          artifacts: [
            { label: "exported-proposal", path: proposalPath },
            { label: "exported-spec", path: specPath },
            { label: "imported-state", path: importedStatePath },
            { label: "imported-tasks", path: importedTasksPath },
          ],
          outputs: {
            imported_feature_id: imported!.feat_id,
          },
          replacements,
        };
      },
    },
  ],
};
