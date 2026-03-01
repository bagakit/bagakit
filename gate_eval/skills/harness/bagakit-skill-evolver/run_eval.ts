import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

interface CaseReport {
  id: string;
  title: string;
  summary: string;
  status: "pass" | "fail";
  assertions: string[];
  outputs?: Record<string, unknown>;
  error?: string;
}

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRoot = path.resolve(scriptDir, "../../../..");
const evolverCli = path.join(
  repoRoot,
  "skills",
  "harness",
  "bagakit-skill-evolver",
  "scripts",
  "evolver.ts",
);
const resultsRoot = path.join(scriptDir, "results", "runs");

function ensureDir(target: string): void {
  fs.mkdirSync(target, { recursive: true });
}

function writeTextFile(filePath: string, contents: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, contents, "utf8");
}

function sanitize(value: string, tempRepo: string): string {
  return value.split(tempRepo).join("<temp-repo>");
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
}

function runEvolver(tempRepo: string, argv: string[]): CommandResult {
  const result = spawnSync(
    "node",
    ["--experimental-strip-types", evolverCli, ...argv, "--root", tempRepo],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );
  return {
    status: result.status ?? 1,
    stdout: sanitize(result.stdout ?? "", tempRepo),
    stderr: sanitize(result.stderr ?? "", tempRepo),
  };
}

function createTempRepo(): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "bagakit-evolver-eval-"));
  writeTextFile(path.join(repo, "README.md"), "# eval\n");
  ensureDir(path.join(repo, "docs", "specs"));
  return repo;
}

function assertContains(text: string, fragment: string, label: string, assertions: string[]): void {
  assert.ok(text.includes(fragment), `${label} missing fragment: ${fragment}`);
  assertions.push(`${label} contains ${JSON.stringify(fragment)}`);
}

function evidenceIngestCase(): CaseReport {
  const assertions: string[] = [];
  const tempRepo = createTempRepo();
  try {
    writeTextFile(path.join(tempRepo, "docs", "specs", "signal.md"), "signal\n");
    assert.equal(runEvolver(tempRepo, ["init-topic", "--slug", "evidence-loop", "--title", "Evidence Loop"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["preflight", "--topic", "evidence-loop", "--decision", "track", "--rationale", "repo-scope"]).status, 0);
    assert.equal(
      runEvolver(
        tempRepo,
        [
          "add-source",
          "--topic",
          "evidence-loop",
          "--source-id",
          "s1",
          "--kind",
          "doc",
          "--title",
          "Signal",
          "--origin",
          "manual",
          "--local-ref",
          "docs/specs/signal.md",
        ],
      ).status,
      0,
    );
    assert.equal(runEvolver(tempRepo, ["add-feedback", "--topic", "evidence-loop", "--channel", "maintainer", "--signal", "positive", "--detail", "worth keeping"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["add-benchmark", "--topic", "evidence-loop", "--benchmark", "b1", "--metric", "report_quality", "--result", "pass"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["record-decision", "--topic", "evidence-loop", "--decision", "Capture evidence", "--rationale", "repo-scope lesson"]).status, 0);
    const readiness = runEvolver(tempRepo, ["promotion-readiness", "--topic", "evidence-loop", "--json"]);
    assert.equal(readiness.status, 0);
    const payload = JSON.parse(readiness.stdout) as Record<string, unknown>;
    assert.equal(payload.state, "blocked");
    assert.equal((payload.evidence_counts as Record<string, unknown>).sources, 1);
    assert.equal((payload.evidence_counts as Record<string, unknown>).feedback, 1);
    assert.equal((payload.evidence_counts as Record<string, unknown>).benchmarks, 1);
    assertions.push("promotion-readiness reports evidence counts before routing");
    return {
      id: "evidence-ingest",
      title: "Evidence Ingest",
      summary: "Structured evidence records should accumulate before routing is set.",
      status: "pass",
      assertions,
      outputs: { readiness: payload },
    };
  } finally {
    fs.rmSync(tempRepo, { recursive: true, force: true });
  }
}

function reportQualityCase(): CaseReport {
  const assertions: string[] = [];
  const tempRepo = createTempRepo();
  try {
    writeTextFile(path.join(tempRepo, "docs", "specs", "report-rule.md"), "rule\n");
    writeTextFile(path.join(tempRepo, "docs", "specs", "report-rule-proof.md"), "proof\n");
    assert.equal(runEvolver(tempRepo, ["init-topic", "--slug", "report-quality", "--title", "Report Quality"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["preflight", "--topic", "report-quality", "--decision", "track", "--rationale", "repo-scope"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["add-candidate", "--topic", "report-quality", "--candidate", "c1", "--kind", "local", "--source", "skills/demo", "--summary", "candidate"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["add-source", "--topic", "report-quality", "--source-id", "s1", "--kind", "doc", "--title", "Rule", "--origin", "manual", "--local-ref", "docs/specs/report-rule.md"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["record-decision", "--topic", "report-quality", "--decision", "Ship report rule", "--rationale", "durable"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["record-promotion", "--topic", "report-quality", "--surface", "spec", "--target", "docs/specs/report-rule.md", "--summary", "land rule", "--promotion", "report-rule", "--status", "landed", "--ref", "docs/specs/report-rule.md", "--proof-refs", "docs/specs/report-rule-proof.md"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["set-route", "--topic", "report-quality", "--decision", "upstream", "--rationale", "reusable", "--upstream-promotions", "report-rule"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["archive-topic", "--topic", "report-quality", "--summary", "archive report topic"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["check"]).status, 0);
    const report = fs.readFileSync(path.join(tempRepo, ".bagakit", "evolver", "topics", "report-quality", "REPORT.md"), "utf8");
    const handoff = fs.readFileSync(path.join(tempRepo, ".bagakit", "evolver", "topics", "report-quality", "HANDOFF.md"), "utf8");
    const archive = fs.readFileSync(path.join(tempRepo, ".bagakit", "evolver", "topics", "report-quality", "ARCHIVE.md"), "utf8");
    assertContains(report, "## Routing Decision", "REPORT.md", assertions);
    assertContains(report, "proof:", "REPORT.md", assertions);
    assertContains(handoff, "## Strongest Evidence", "HANDOFF.md", assertions);
    assertContains(handoff, "## Open Promotion Actions", "HANDOFF.md", assertions);
    assertContains(archive, "## Promotion Trail", "ARCHIVE.md", assertions);
    assertContains(archive, "docs/specs/report-rule-proof.md", "ARCHIVE.md", assertions);
    return {
      id: "report-quality",
      title: "Report Quality",
      summary: "Derived reports should expose routing, proof, handoff, and archive closure.",
      status: "pass",
      assertions,
    };
  } finally {
    fs.rmSync(tempRepo, { recursive: true, force: true });
  }
}

function promotionReadinessCase(): CaseReport {
  const assertions: string[] = [];
  const tempRepo = createTempRepo();
  try {
    writeTextFile(path.join(tempRepo, "docs", "specs", "promo.md"), "promo\n");
    writeTextFile(path.join(tempRepo, "docs", "specs", "promo-proof.md"), "proof\n");
    assert.equal(runEvolver(tempRepo, ["init-topic", "--slug", "promo-ready", "--title", "Promo Ready"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["preflight", "--topic", "promo-ready", "--decision", "track", "--rationale", "repo-scope"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["add-source", "--topic", "promo-ready", "--source-id", "s1", "--kind", "doc", "--title", "Promo", "--origin", "manual", "--local-ref", "docs/specs/promo.md"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["record-decision", "--topic", "promo-ready", "--decision", "Land promotion", "--rationale", "ready"]).status, 0);
    const badPromotion = runEvolver(tempRepo, ["record-promotion", "--topic", "promo-ready", "--surface", "spec", "--target", "docs/specs/promo.md", "--summary", "land promo", "--promotion", "promo", "--status", "landed", "--ref", "docs/specs/promo.md"]);
    assert.equal(badPromotion.status, 1);
    assertContains(badPromotion.stderr, "landed promotion requires --proof-refs", "record-promotion stderr", assertions);
    assert.equal(runEvolver(tempRepo, ["record-promotion", "--topic", "promo-ready", "--surface", "spec", "--target", "docs/specs/promo.md", "--summary", "land promo", "--promotion", "promo", "--status", "landed", "--ref", "docs/specs/promo.md", "--proof-refs", "docs/specs/promo-proof.md"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["set-route", "--topic", "promo-ready", "--decision", "upstream", "--rationale", "reusable", "--upstream-promotions", "promo"]).status, 0);
    const readiness = JSON.parse(runEvolver(tempRepo, ["promotion-readiness", "--topic", "promo-ready", "--json"]).stdout) as Record<string, unknown>;
    assert.equal(readiness.state, "upstream-landed");
    assert.equal(readiness.archive_ready, true);
    assertions.push("landed promotion requires explicit proof refs and becomes upstream-landed");
    return {
      id: "promotion-readiness",
      title: "Promotion Readiness",
      summary: "Landed promotions should require proof refs and produce a landed readiness state.",
      status: "pass",
      assertions,
      outputs: { readiness },
    };
  } finally {
    fs.rmSync(tempRepo, { recursive: true, force: true });
  }
}

function routingCase(): CaseReport {
  const assertions: string[] = [];
  const tempRepo = createTempRepo();
  try {
    writeTextFile(path.join(tempRepo, "docs", "host-note.md"), "host\n");
    writeTextFile(path.join(tempRepo, "docs", "specs", "split.md"), "split\n");
    writeTextFile(path.join(tempRepo, "docs", "specs", "split-proof.md"), "proof\n");

    assert.equal(runEvolver(tempRepo, ["init-topic", "--slug", "host-topic", "--title", "Host Topic"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["preflight", "--topic", "host-topic", "--decision", "track", "--rationale", "host case"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["add-source", "--topic", "host-topic", "--source-id", "s1", "--kind", "doc", "--title", "Host", "--origin", "manual", "--local-ref", "docs/host-note.md"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["record-decision", "--topic", "host-topic", "--decision", "Keep host-side", "--rationale", "host only"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["set-route", "--topic", "host-topic", "--decision", "host", "--rationale", "host adoption", "--host-target", "docs/host-note.md"]).status, 0);
    const hostReadiness = JSON.parse(runEvolver(tempRepo, ["promotion-readiness", "--topic", "host-topic", "--json"]).stdout) as Record<string, unknown>;
    assert.equal(hostReadiness.state, "host-proposed");
    assertions.push("host route stays separate from upstream promotions");

    assert.equal(runEvolver(tempRepo, ["init-topic", "--slug", "split-topic", "--title", "Split Topic"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["preflight", "--topic", "split-topic", "--decision", "track", "--rationale", "split case"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["add-source", "--topic", "split-topic", "--source-id", "s1", "--kind", "doc", "--title", "Split", "--origin", "manual", "--local-ref", "docs/specs/split.md"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["record-decision", "--topic", "split-topic", "--decision", "Split route", "--rationale", "mixed lesson"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["record-promotion", "--topic", "split-topic", "--surface", "spec", "--target", "docs/specs/split.md", "--summary", "land split spec", "--promotion", "split-spec", "--status", "proposed"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["set-route", "--topic", "split-topic", "--decision", "split", "--rationale", "host plus upstream", "--host-target", "docs/host-note.md", "--upstream-promotions", "split-spec"]).status, 0);
    const splitReadiness = JSON.parse(runEvolver(tempRepo, ["promotion-readiness", "--topic", "split-topic", "--json"]).stdout) as Record<string, unknown>;
    assert.equal(splitReadiness.state, "split-proposed");
    assertions.push("split route keeps host target and upstream promotion ids together without collapsing them");

    return {
      id: "routing",
      title: "Routing",
      summary: "Host, upstream, and split routes should remain explicit and repository-scoped.",
      status: "pass",
      assertions,
      outputs: { host: hostReadiness, split: splitReadiness },
    };
  } finally {
    fs.rmSync(tempRepo, { recursive: true, force: true });
  }
}

function weakLinkRefsCase(): CaseReport {
  const assertions: string[] = [];
  const tempRepo = createTempRepo();
  try {
    assert.equal(runEvolver(tempRepo, ["init-topic", "--slug", "weak-links", "--title", "Weak Links"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["preflight", "--topic", "weak-links", "--decision", "track", "--rationale", "weak-link warning"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["add-source", "--topic", "weak-links", "--source-id", "s1", "--kind", "doc", "--title", "Missing Summary", "--origin", "manual", "--summary-ref", "docs/specs/missing-summary.md"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["add-context-ref", "--topic", "weak-links", "--ref", "docs/.research/missing-topic/index.md"]).status, 0);
    assert.equal(runEvolver(tempRepo, ["record-decision", "--topic", "weak-links", "--decision", "Track weak refs", "--rationale", "warning only"]).status, 0);
    const checkResult = runEvolver(tempRepo, ["check"]);
    assert.equal(checkResult.status, 0);
    assertContains(checkResult.stderr, "warn: weak-links: missing source ref target docs/specs/missing-summary.md", "check stderr", assertions);
    assertContains(checkResult.stderr, "warn: weak-links: missing weak ref target docs/.research/missing-topic/index.md", "check stderr", assertions);
    assertions.push("missing weak-link refs stay warning-only");
    return {
      id: "weak-link-refs",
      title: "Weak-Link Refs",
      summary: "Weak refs should warn without invalidating the topic.",
      status: "pass",
      assertions,
      outputs: { stderr: checkResult.stderr },
    };
  } finally {
    fs.rmSync(tempRepo, { recursive: true, force: true });
  }
}

const CASES = [
  evidenceIngestCase,
  reportQualityCase,
  promotionReadinessCase,
  routingCase,
  weakLinkRefsCase,
];

function writeJson(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function main(): void {
  const runId = new Date().toISOString().replaceAll(":", "").replaceAll(".", "-");
  const runDir = path.join(resultsRoot, runId);
  const caseDir = path.join(runDir, "cases");
  ensureDir(caseDir);

  const reports: CaseReport[] = [];
  for (const runCase of CASES) {
    try {
      const report = runCase();
      reports.push(report);
      writeJson(path.join(caseDir, `${report.id}.json`), report);
    } catch (error) {
      const failed: CaseReport = {
        id: runCase.name,
        title: runCase.name,
        summary: "case execution failed",
        status: "fail",
        assertions: [],
        error: String(error),
      };
      reports.push(failed);
      writeJson(path.join(caseDir, `${failed.id}.json`), failed);
    }
  }

  const summary = {
    run_id: runId,
    status: reports.every((report) => report.status === "pass") ? "pass" : "fail",
    passed: reports.filter((report) => report.status === "pass").length,
    failed: reports.filter((report) => report.status === "fail").length,
    cases: reports.map((report) => ({
      id: report.id,
      title: report.title,
      status: report.status,
    })),
  };
  writeJson(path.join(runDir, "summary.json"), summary);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.status !== "pass") {
    process.exitCode = 1;
  }
}

main();
