import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runCommand, type CommandResult } from "../../../../dev/eval/src/lib/command.ts";
import type { EvalSuiteDefinition } from "../../../../dev/eval/src/lib/model.ts";
import { cleanupTempDir, createTempDir, registerTempRepo } from "../../../../dev/eval/src/lib/temp.ts";

const CLI_REL = "skills/swe/bagakit-daily-media-automation/scripts/bagakit-daily-media-automation-cli.sh";

function expectStatus(result: CommandResult, status: number, label: string): void {
  assert.equal(
    result.status,
    status,
    `${label} returned ${result.status}, expected ${status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
}

function runDir(tempRepo: string, runId: string): string {
  return path.join(tempRepo, ".bagakit", "daily-media-automation", "runs", runId);
}

function appendRows(runRoot: string, fileName: string, rows: string): void {
  fs.appendFileSync(path.join(runRoot, fileName), rows, "utf8");
}

function replaceInFile(filePath: string, replacements: Array<[string, string]>): void {
  let text = fs.readFileSync(filePath, "utf8");
  for (const [from, to] of replacements) {
    assert.ok(text.includes(from), `missing replacement target ${from} in ${filePath}`);
    text = text.replace(from, to);
  }
  fs.writeFileSync(filePath, text, "utf8");
}

function completePublishableRun(runRoot: string, runId: string): void {
  appendRows(
    runRoot,
    "collection-ledger.md",
    "\n| src-1 | official | https://example.invalid/release | configured | example | story-1 | official release note |\n| src-2 | repository | https://example.invalid/tag | configured | example | story-1 | release tag |\n| src-3 | package | https://example.invalid/package | configured | example | story-1 | package version |\n",
  );
  replaceInFile(path.join(runRoot, "evidence-review.md"), [
    [
      "\n## Gate Results",
      "\n| story-1 | src-1,src-2,src-3 | clear | high | migration impact | none found | source-backed | include |\n\n## Gate Results",
    ],
  ]);
  replaceInFile(path.join(runRoot, "evidence-review.md"), [
    ["| source-minimum | blocked | | not reviewed |", "| source-minimum | pass | collection-ledger.md | threshold met |"],
    ["| recency-window | blocked | | not reviewed |", "| recency-window | pass | collection-ledger.md | checked |"],
    ["| confidence-bar | blocked | | not reviewed |", "| confidence-bar | pass | evidence-review.md | source-backed |"],
    ["| counterevidence | blocked | | not reviewed |", "| counterevidence | pass | evidence-review.md | none found |"],
  ]);
  appendRows(
    runRoot,
    "asset-ledger.md",
    "\n| asset-1 | cover | png | src-1 | prompt-1 | artifacts/release-card.png | pass | project-local path |\n",
  );
  replaceInFile(path.join(runRoot, "deployment-ledger.md"), [
    ["- deployment_status: drafted", "- deployment_status: published"],
    ["- command_ref:", "- command_ref: static export fixture"],
    ["- environment:", "- environment: fixture"],
    ["- deploy_url:", "- deploy_url: https://example.invalid/release-radar"],
    ["| webpage-evidence | blocked | | not deployed |", "| webpage-evidence | pass | browser-check | checked |"],
    ["| deployment-url | blocked | | not deployed |", "| deployment-url | pass | deployment-ledger.md | URL recorded |"],
  ]);
  replaceInFile(path.join(runRoot, "archive.md"), [
    ["- publication_status: drafted", "- publication_status: published"],
    ["- final_url_or_artifact:", "- final_url_or_artifact: https://example.invalid/release-radar"],
  ]);
  appendRows(
    runRoot,
    "archive.md",
    "\n| source-minimum | pass | evidence-review.md | threshold met |\n| recency-window | pass | evidence-review.md | checked |\n| confidence-bar | pass | evidence-review.md | source-backed |\n| counterevidence | pass | evidence-review.md | none found |\n| webpage-evidence | pass | deployment-ledger.md | checked |\n| deployment-url | pass | deployment-ledger.md | URL recorded |\n",
  );
  assert.ok(fs.readFileSync(path.join(runRoot, "archive.md"), "utf8").includes(runId));
}

function completeNotificationFailureRun(runRoot: string, runId: string): void {
  completePublishableRun(runRoot, runId);
  appendRows(
    runRoot,
    "collection-ledger.md",
    "| src-4 | official | https://example.invalid/lab | configured | example | story-1 | primary source |\n| src-5 | research | https://example.invalid/paper | configured | example | story-1 | research source |\n",
  );
  replaceInFile(path.join(runRoot, "notification-ledger.md"), [
    ["- notify_adapter: none", "- notify_adapter: slack"],
    ["- notification_status: not_in_scope", "- notification_status: failed"],
    ["- recipient_class:", "- recipient_class: team channel"],
    ["- payload_ref:", "- payload_ref: archive.md"],
    ["- delivery_ref:", "- delivery_ref: fixture failure"],
    ["- redaction_note:", "- redaction_note: env names only"],
  ]);
  replaceInFile(path.join(runRoot, "archive.md"), [
    ["- publication_status: published", "- publication_status: published_with_notification_failure"],
    ["- notification_status: not_in_scope", "- notification_status: failed"],
  ]);
}

export const SUITE: EvalSuiteDefinition = {
  id: "bagakit-daily-media-automation-shared-runner-eval",
  owner: "gate_eval/skills/swe/bagakit-daily-media-automation",
  title: "Daily Media Automation Shared Runner Eval",
  summary: "Measure deterministic orchestration fixtures for domain packs, ledgers, no-publish blockers, and validation outcomes.",
  defaultOutputDir: "gate_eval/skills/swe/bagakit-daily-media-automation/results/runs",
  cases: [
    {
      id: "domain-pack-draft-stays-nonpublishable",
      title: "Domain Pack Draft Stays Nonpublishable",
      summary: "Built-in starter packs should prefill thresholds but still initialize as draft runs blocked from publish.",
      focus: ["domain-pack", "draft-gate", "no-publish"],
      run: (context) => {
        const { repoRoot } = context;
        const tempRepo = createTempDir("bagakit-daily-media-draft-eval-");
        const replacements = registerTempRepo(context, tempRepo);
        const script = path.join(repoRoot, CLI_REL);
        const runId = "paper-digest-00000000-main";
        try {
          const listResult = runCommand("bash", [script, "list-domain-packs"], { cwd: repoRoot, replacements });
          expectStatus(listResult, 0, "list-domain-packs");
          assert.ok(listResult.stdout.includes("paper-digest"));

          const initResult = runCommand("bash", [script, "init-run", "--root", tempRepo, "--run-id", runId, "--deploy", "none", "--notify", "none"], { cwd: repoRoot, replacements });
          expectStatus(initResult, 0, "init-run");
          const artifactDir = runDir(tempRepo, runId);
          const briefText = fs.readFileSync(path.join(artifactDir, "brief.md"), "utf8");
          assert.ok(briefText.includes("- domain_pack: paper-digest"));
          assert.ok(briefText.includes("- source_minimum: 4"));
          assert.ok(briefText.includes("- output_pack: web-brief"));

          const auditResult = runCommand("bash", [script, "validate-run", "--root", tempRepo, "--run-id", runId, "--intent", "audit"], { cwd: repoRoot, replacements });
          expectStatus(auditResult, 0, "validate-run audit");
          assert.ok(auditResult.stdout.includes("run validation result: not publishable"));
          assert.ok(auditResult.stdout.includes("archive publication_status is drafted"));

          const publishResult = runCommand("bash", [script, "validate-run", "--root", tempRepo, "--run-id", runId, "--intent", "publish"], { cwd: repoRoot, replacements });
          expectStatus(publishResult, 1, "validate-run publish");

          return {
            assertions: [
              "list-domain-packs exposes the built-in paper-digest starter pack",
              "init-run infers a built-in domain pack from the run id when no explicit pack is provided",
              "starter thresholds are written into brief.md",
              "a fresh starter run remains drafted and blocked from publish",
            ],
            commands: [
              `bash ${CLI_REL} list-domain-packs`,
              `bash ${CLI_REL} init-run --root <temp-repo> --run-id ${runId} --deploy none --notify none`,
              `bash ${CLI_REL} validate-run --root <temp-repo> --run-id ${runId} --intent audit`,
              `bash ${CLI_REL} validate-run --root <temp-repo> --run-id ${runId} --intent publish`,
            ],
            artifacts: [
              { label: "brief", path: path.join(artifactDir, "brief.md") },
              { label: "archive", path: path.join(artifactDir, "archive.md") },
            ],
            outputs: {
              run_id: runId,
              audit_result: "not publishable",
              publish_exit_status: publishResult.status,
            },
            replacements,
          };
        } finally {
          cleanupTempDir(tempRepo, context.keepTemp);
        }
      },
    },
    {
      id: "completed-ledgers-become-publishable",
      title: "Completed Ledgers Become Publishable",
      summary: "A fixture run with completed source, evidence, asset, deployment, and archive ledgers should pass publish validation.",
      focus: ["run-validation", "ledger-contract", "publishable"],
      run: (context) => {
        const { repoRoot } = context;
        const tempRepo = createTempDir("bagakit-daily-media-publish-eval-");
        const replacements = registerTempRepo(context, tempRepo);
        const script = path.join(repoRoot, CLI_REL);
        const runId = "release-radar-00000000-ship";
        try {
          expectStatus(runCommand("bash", [script, "init-run", "--root", tempRepo, "--run-id", runId, "--domain-pack", "release-radar", "--deploy", "static", "--notify", "none"], { cwd: repoRoot, replacements }), 0, "init-run");
          const artifactDir = runDir(tempRepo, runId);
          completePublishableRun(artifactDir, runId);

          const validateResult = runCommand("bash", [script, "validate-run", "--root", tempRepo, "--run-id", runId, "--intent", "publish"], { cwd: repoRoot, replacements });
          expectStatus(validateResult, 0, "validate-run publish");
          assert.ok(validateResult.stdout.includes("run validation result: publishable"));

          return {
            assertions: [
              "release-radar starter thresholds allow deterministic fixture completion",
              "completed source, evidence, asset, deployment, and archive ledgers validate as publishable",
              "notification none remains not_in_scope and separate from deployment status",
            ],
            commands: [
              `bash ${CLI_REL} init-run --root <temp-repo> --run-id ${runId} --domain-pack release-radar --deploy static --notify none`,
              `bash ${CLI_REL} validate-run --root <temp-repo> --run-id ${runId} --intent publish`,
            ],
            artifacts: [
              { label: "brief", path: path.join(artifactDir, "brief.md") },
              { label: "collection-ledger", path: path.join(artifactDir, "collection-ledger.md") },
              { label: "archive", path: path.join(artifactDir, "archive.md") },
            ],
            outputs: {
              run_id: runId,
              validation_result: "publishable",
            },
            replacements,
          };
        } finally {
          cleanupTempDir(tempRepo, context.keepTemp);
        }
      },
    },
    {
      id: "notification-failure-keeps-deploy-published",
      title: "Notification Failure Keeps Deploy Published",
      summary: "A successful deployment with failed notification should validate through the explicit published_with_notification_failure status.",
      focus: ["status-separation", "notification-failure", "archive-contract"],
      run: (context) => {
        const { repoRoot } = context;
        const tempRepo = createTempDir("bagakit-daily-media-notify-eval-");
        const replacements = registerTempRepo(context, tempRepo);
        const script = path.join(repoRoot, CLI_REL);
        const runId = "ai-news-00000000-notify";
        try {
          expectStatus(runCommand("bash", [script, "init-run", "--root", tempRepo, "--run-id", runId, "--domain-pack", "ai-news", "--deploy", "static", "--notify", "none"], { cwd: repoRoot, replacements }), 0, "init-run");
          const artifactDir = runDir(tempRepo, runId);
          completeNotificationFailureRun(artifactDir, runId);

          const validateResult = runCommand("bash", [script, "validate-run", "--root", tempRepo, "--run-id", runId, "--intent", "publish"], { cwd: repoRoot, replacements });
          expectStatus(validateResult, 0, "validate-run publish");
          assert.ok(validateResult.stdout.includes("run validation result: publishable"));
          assert.ok(fs.readFileSync(path.join(artifactDir, "archive.md"), "utf8").includes("published_with_notification_failure"));

          return {
            assertions: [
              "deployment_status stays published when notification fails after deployment",
              "archive records publication_status as published_with_notification_failure",
              "validate-run accepts the separated deployment and notification outcome",
            ],
            commands: [
              `bash ${CLI_REL} init-run --root <temp-repo> --run-id ${runId} --domain-pack ai-news --deploy static --notify none`,
              `bash ${CLI_REL} validate-run --root <temp-repo> --run-id ${runId} --intent publish`,
            ],
            artifacts: [
              { label: "deployment-ledger", path: path.join(artifactDir, "deployment-ledger.md") },
              { label: "notification-ledger", path: path.join(artifactDir, "notification-ledger.md") },
              { label: "archive", path: path.join(artifactDir, "archive.md") },
            ],
            outputs: {
              run_id: runId,
              publication_status: "published_with_notification_failure",
              notification_status: "failed",
            },
            replacements,
          };
        } finally {
          cleanupTempDir(tempRepo, context.keepTemp);
        }
      },
    },
  ],
};
