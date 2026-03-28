import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runCommand, type CommandResult } from "../../../../dev/eval/src/lib/command.ts";
import type { EvalCaseContext, EvalCaseResult, EvalSuiteDefinition } from "../../../../dev/eval/src/lib/model.ts";
import { cleanupTempDir, createTempDir, registerTempRepo } from "../../../../dev/eval/src/lib/temp.ts";

const PYTHON = process.env.PYTHON3 ?? "python3";
const TOPIC_CLASS = "frontier";
const DISPLAY_SCRIPT = "skills/harness/bagakit-researcher/scripts/bagakit-researcher.py";

interface ResearchFixture {
  tempRepo: string;
  replacements: Array<{ from: string; to: string }>;
  script: string;
}

function expectOk(result: CommandResult, label: string): void {
  assert.equal(
    result.status,
    0,
    `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
}

function expectWarnOk(result: CommandResult, label: string, needles: string[]): void {
  expectOk(result, label);
  const combined = `${result.stdout}\n${result.stderr}`;
  assert.ok(combined.toLowerCase().includes("warning"), `${label} should emit warning output`);
  for (const needle of needles) {
    assert.ok(combined.includes(needle), `${label} should mention ${needle}\n${combined}`);
  }
}

function withFixture(context: EvalCaseContext): ResearchFixture {
  const tempRepo = createTempDir("bagakit-researcher-eval-");
  return {
    tempRepo,
    replacements: registerTempRepo(context, tempRepo),
    script: path.join(
      context.repoRoot,
      "skills",
      "harness",
      "bagakit-researcher",
      "scripts",
      "bagakit-researcher.py",
    ),
  };
}

function runResearcher(fixture: ResearchFixture, args: string[], repoRoot: string): CommandResult {
  return runCommand(PYTHON, [fixture.script, ...args], {
    cwd: repoRoot,
    replacements: fixture.replacements,
  });
}

function topicRoot(tempRepo: string, topic: string): string {
  return path.join(tempRepo, ".bagakit", "researcher", "topics", TOPIC_CLASS, topic);
}

function readTopicFile(tempRepo: string, topic: string, rel: string): string {
  return fs.readFileSync(path.join(topicRoot(tempRepo, topic), rel), "utf8");
}

function initTopic(fixture: ResearchFixture, repoRoot: string, topic: string, title: string): void {
  expectOk(
    runResearcher(
      fixture,
      [
        "init-topic",
        "--root",
        fixture.tempRepo,
        "--topic-class",
        TOPIC_CLASS,
        "--topic",
        topic,
        "--title",
        title,
      ],
      repoRoot,
    ),
    "init-topic",
  );
}

function addSource(
  fixture: ResearchFixture,
  repoRoot: string,
  topic: string,
  sourceId: string,
  title: string,
): void {
  expectOk(
    runResearcher(
      fixture,
      [
        "add-source-card",
        "--root",
        fixture.tempRepo,
        "--topic-class",
        TOPIC_CLASS,
        "--topic",
        topic,
        "--source-id",
        sourceId,
        "--title",
        title,
        "--url",
        `https://example.com/${sourceId}`,
        "--authority",
        "primary",
        "--published",
        "2026-04-19",
        "--source-role",
        "primary",
        "--scope-fit",
        "core",
        "--limitations",
        "example limitation",
        "--why",
        "sets the baseline",
      ],
      repoRoot,
    ),
    `add-source-card ${sourceId}`,
  );
}

function addSummary(
  fixture: ResearchFixture,
  repoRoot: string,
  topic: string,
  sourceId: string,
  title: string,
): void {
  expectOk(
    runResearcher(
      fixture,
      [
        "add-summary",
        "--root",
        fixture.tempRepo,
        "--topic-class",
        TOPIC_CLASS,
        "--topic",
        topic,
        "--source-id",
        sourceId,
        "--title",
        title,
        "--why-matters",
        "clarifies the baseline",
        "--borrow",
        "one reusable idea",
        "--avoid",
        "one wrong direction",
        "--implication",
        "one Bagakit implication",
      ],
      repoRoot,
    ),
    `add-summary ${sourceId}`,
  );
}

function commandLine(args: string[]): string {
  const displayArgs = args.map((arg) => (arg.startsWith("/") ? "<temp-repo>" : arg));
  return `python3 ${DISPLAY_SCRIPT} ${displayArgs.join(" ")}`;
}

function assertNoPathLeaks(root: string, paths: string[]): void {
  const forbidden = [root, "/" + "Users", "/" + path.join("var", "folders"), "file" + "://"];
  for (const target of paths) {
    const text = fs.readFileSync(target, "utf8");
    for (const marker of forbidden) {
      assert.equal(text.includes(marker), false, `${target} should not contain ${marker}`);
    }
  }
}

function countOccurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

function plannedPassArgs(tempRepo: string, topic: string): string[] {
  const firstTrack = topic === "clean-topic" ? "summaries:Build a complete clean chain:c001-c099" : "track-alpha:Topic extraction:a001-a099";
  const secondTrack = topic === "clean-topic" ? "originals:Preserve the source evidence:c001-c099" : "track-beta:Active mining:b001-b099";
  return [
    "plan-pass",
    "--root",
    tempRepo,
    "--topic-class",
    TOPIC_CLASS,
    "--topic",
    topic,
    "--pass-id",
    "pass-001",
    "--question",
    "How should researcher support parallel anti-drift research?",
    "--decision-use",
    "implement researcher workflow",
    "--output-shape",
    "validated local artifacts",
    "--in-scope",
    "parallel track contracts",
    "--in-scope",
    "drift warnings",
    "--out-of-scope",
    "subagent spawning",
    "--source-priority",
    "primary implementation references",
    "--evidence-threshold",
    "recommendations need evidence refs",
    "--stop-condition",
    "two useful tracks are specified",
    "--drift-sentinel",
    "track output must answer the charter question",
    "--source-class",
    "primary implementation reference",
    "--track",
    firstTrack,
    "--track",
    secondTrack,
    "--required-source-type",
    "source-card",
    "--source-id-range",
    "a001-b099",
    "--budget",
    "two tracks",
    "--merge-expectation",
    "merge through claims.md",
    "--synthesis-target",
    "summaries/pass-001-synthesis.md",
    "--lead-policy",
    "defer off-topic leads",
    "--drift-check",
    "must answer the charter question",
  ];
}

function addTrackArgs(tempRepo: string, topic: string): string[] {
  return [
    "add-track",
    "--root",
    tempRepo,
    "--topic-class",
    TOPIC_CLASS,
    "--topic",
    topic,
    "--track-id",
    "track-gamma",
    "--pass-id",
    "pass-001",
    "--question",
    "How should summaries preserve evidence parentage?",
    "--required-source-type",
    "source-card",
    "--preferred-source",
    "existing originals",
    "--disallowed-source",
    "unsourced recommendation",
    "--source-id-range",
    "c001-c099",
    "--owned-output",
    "summaries/summary-parentage.md",
    "--minimum-evidence",
    "one source card and one claim ref",
    "--lead-policy",
    "defer off-topic leads",
    "--drift-check",
    "must answer the charter question",
    "--merge-note",
    "merge through claims.md",
  ];
}

function addUngroundedArtifacts(fixture: ResearchFixture, repoRoot: string, topic: string): void {
  expectOk(
    runResearcher(
      fixture,
      [
        "add-claim",
        "--root",
        fixture.tempRepo,
        "--topic-class",
        TOPIC_CLASS,
        "--topic",
        topic,
        "--claim-id",
        "cl-ungrounded",
        "--kind",
        "recommendation",
        "--statement",
        "Researcher should adopt every discovered lead immediately.",
        "--confidence",
        "high",
      ],
      repoRoot,
    ),
    "add-claim ungrounded",
  );
  expectOk(
    runResearcher(
      fixture,
      [
        "add-lead",
        "--root",
        fixture.tempRepo,
        "--topic-class",
        TOPIC_CLASS,
        "--topic",
        topic,
        "--lead-id",
        "lead-loose",
        "--originating-artifact",
        "claims.md#cl-ungrounded",
        "--hypothesis",
        "a broad adjacent topic may matter",
        "--expected-value",
        "",
        "--stop-rule",
        "",
      ],
      repoRoot,
    ),
    "add-lead loose",
  );
  expectOk(
    runResearcher(
      fixture,
      [
        "add-insight",
        "--root",
        fixture.tempRepo,
        "--topic-class",
        TOPIC_CLASS,
        "--topic",
        topic,
        "--insight-id",
        "insight-one",
        "--insight",
        "One unsupported claim is not enough for a high confidence insight.",
        "--source-claim",
        "cl-ungrounded",
        "--confidence",
        "high",
      ],
      repoRoot,
    ),
    "add-insight high-confidence single-source",
  );
}

function addCleanArtifacts(fixture: ResearchFixture, repoRoot: string, topic: string): string[] {
  addSource(fixture, repoRoot, topic, "c001", "Clean Source");
  addSummary(fixture, repoRoot, topic, "c001", "Clean Source Summary");
  const commands = [
    [
      "add-claim",
      "--root",
      fixture.tempRepo,
      "--topic-class",
      TOPIC_CLASS,
      "--topic",
      topic,
      "--claim-id",
      "clean-claim",
      "--kind",
      "recommendation",
      "--statement",
      "Complete evidence chains should remain warning-free.",
      "--evidence-ref",
      "originals/c001.md",
      "--counterevidence-ref",
      "summaries/c001.md#avoid",
      "--confidence",
      "medium",
    ],
    [
      "add-insight",
      "--root",
      fixture.tempRepo,
      "--topic-class",
      TOPIC_CLASS,
      "--topic",
      topic,
      "--insight-id",
      "clean-insight",
      "--insight",
      "The clean chain has explicit evidence and counterevidence.",
      "--source-claim",
      "clean-claim",
      "--confidence",
      "low",
    ],
    [
      "add-lead",
      "--root",
      fixture.tempRepo,
      "--topic-class",
      TOPIC_CLASS,
      "--topic",
      topic,
      "--lead-id",
      "clean-lead",
      "--originating-artifact",
      "claims.md#clean-claim",
      "--hypothesis",
      "A deferred lead can preserve scope.",
      "--expected-value",
      "future comparison only",
      "--stop-rule",
      "defer until a new pass",
      "--status",
      "deferred",
      "--outcome",
      "deferred outside this pass",
    ],
    [
      "new-synthesis",
      "--root",
      fixture.tempRepo,
      "--topic-class",
      TOPIC_CLASS,
      "--topic",
      topic,
      "--synthesis-id",
      "pass-001-synthesis",
      "--what",
      "clean warning-free topic",
      "--claim-ref",
      "clean-claim",
      "--insight-ref",
      "clean-insight",
      "--finding",
      "evidence and counterevidence are explicit",
      "--next-action",
      "no action",
    ],
  ];
  for (const args of commands) {
    expectOk(runResearcher(fixture, args, repoRoot), args[0]);
  }
  const resolveLeadArgs = [
    "resolve-lead",
    "--root",
    fixture.tempRepo,
    "--topic-class",
    TOPIC_CLASS,
    "--topic",
    topic,
    "--lead-id",
    "clean-lead",
    "--status",
    "promoted",
    "--outcome",
    "promoted into clean synthesis",
  ];
  expectOk(runResearcher(fixture, resolveLeadArgs, repoRoot), "resolve-lead");
  return [...commands, resolveLeadArgs].map(commandLine);
}

export const SUITE: EvalSuiteDefinition = {
  id: "bagakit-researcher-shared-runner-eval",
  owner: "gate_eval/skills/harness/bagakit-researcher",
  title: "Researcher Shared Runner Eval",
  summary: "Measure deterministic evidence-linkage, parallel planning, anti-drift, and handoff behavior for bagakit-researcher.",
  defaultOutputDir: "gate_eval/skills/harness/bagakit-researcher/results/runs",
  cases: [
    {
      id: "topic-index-links-source-and-summary",
      title: "Topic Index Links Source And Summary",
      summary: "A refreshed topic index should surface the source card and reusable summary produced for the same source id.",
      focus: ["evidence-linkage", "topic-index-coherence", "workspace-reporting"],
      run: (context): EvalCaseResult => {
        const { repoRoot } = context;
        const fixture = withFixture(context);
        const topic = "evidence-loop";
        try {
          initTopic(fixture, repoRoot, topic, "Evidence Loop");
          addSource(fixture, repoRoot, topic, "a01", "Example Source");
          addSummary(fixture, repoRoot, topic, "a01", "Example Source Summary");

          const refreshArgs = [
            "refresh-index",
            "--root",
            fixture.tempRepo,
            "--topic-class",
            TOPIC_CLASS,
            "--topic",
            topic,
            "--title",
            "Evidence Loop",
          ];
          expectOk(runResearcher(fixture, refreshArgs, repoRoot), "refresh-index");

          const listTopics = runResearcher(fixture, ["list-topics", "--root", fixture.tempRepo], repoRoot);
          expectOk(listTopics, "list-topics");
          const doctor = runResearcher(
            fixture,
            ["doctor", "--root", fixture.tempRepo, "--topic-class", TOPIC_CLASS, "--topic", topic],
            repoRoot,
          );
          expectOk(doctor, "doctor");

          const workspaceRoot = topicRoot(fixture.tempRepo, topic);
          const sourcePath = path.join(workspaceRoot, "originals", "a01.md");
          const summaryPath = path.join(workspaceRoot, "summaries", "a01.md");
          const indexPath = path.join(workspaceRoot, "index.md");
          assert.ok(fs.existsSync(sourcePath), "expected source card to exist");
          assert.ok(fs.existsSync(summaryPath), "expected summary card to exist");
          assert.ok(fs.existsSync(indexPath), "expected topic index to exist");

          const indexText = fs.readFileSync(indexPath, "utf8");
          const summaryText = fs.readFileSync(summaryPath, "utf8");
          assert.ok(
            listTopics.stdout
              .split("\n")
              .includes("frontier/evidence-loop\t.bagakit/researcher/topics/frontier/evidence-loop/index.md"),
          );
          assert.ok(indexText.includes("## Source Cards"));
          assert.ok(indexText.includes("- `originals/a01.md`"));
          assert.ok(indexText.includes("## Summaries"));
          assert.ok(indexText.includes("- `summaries/a01.md`"));
          assert.ok(summaryText.includes("## Borrow"));
          assert.ok(summaryText.includes("- one reusable idea"));
          assert.ok(summaryText.includes("## Bagakit Implication"));
          assert.ok(summaryText.includes("- one Bagakit implication"));

          return {
            assertions: [
              "topic listing surfaces the initialized workspace",
              "refreshed index links both the source card and its reusable summary",
              "summary retains the expected borrow and implication sections",
            ],
            commands: [
              commandLine(["init-topic", "--root", "<temp-repo>", "--topic-class", TOPIC_CLASS, "--topic", topic, "--title", '"Evidence Loop"']),
              commandLine(["add-source-card", "--root", "<temp-repo>", "--topic-class", TOPIC_CLASS, "--topic", topic, "--source-id", "a01", "--title", '"Example Source"']),
              commandLine(["add-summary", "--root", "<temp-repo>", "--topic-class", TOPIC_CLASS, "--topic", topic, "--source-id", "a01", "--title", '"Example Source Summary"']),
              commandLine(refreshArgs),
              commandLine(["list-topics", "--root", "<temp-repo>"]),
              commandLine(["doctor", "--root", "<temp-repo>", "--topic-class", TOPIC_CLASS, "--topic", topic]),
            ],
            artifacts: [
              { label: "topic-index", path: indexPath },
              { label: "source-card", path: sourcePath },
              { label: "summary-card", path: summaryPath },
            ],
            outputs: {
              listed_topics: listTopics.stdout.trim().split("\n"),
              index_entries: ["originals/a01.md", "summaries/a01.md"],
            },
            replacements: fixture.replacements,
          };
        } finally {
          cleanupTempDir(fixture.tempRepo, context.keepTemp);
        }
      },
    },
    {
      id: "plan-pass-and-track-contracts",
      title: "Plan Pass And Track Contracts",
      summary: "plan-pass should create pass, track, charter, claims, and leads surfaces; add-track and list-tracks should extend and report track contracts.",
      focus: ["parallel-research", "artifact-contracts", "topic-charter"],
      run: (context): EvalCaseResult => {
        const { repoRoot } = context;
        const fixture = withFixture(context);
        const topic = "parallel-plan";
        try {
          initTopic(fixture, repoRoot, topic, "Parallel Plan");

          const planArgs = plannedPassArgs(fixture.tempRepo, topic);
          expectOk(runResearcher(fixture, planArgs, repoRoot), "plan-pass");

          const addArgs = addTrackArgs(fixture.tempRepo, topic);
          expectOk(runResearcher(fixture, addArgs, repoRoot), "add-track");

          const listArgs = ["list-tracks", "--root", fixture.tempRepo, "--topic-class", TOPIC_CLASS, "--topic", topic];
          const listTracks = runResearcher(fixture, listArgs, repoRoot);
          expectOk(listTracks, "list-tracks");

          const workspace = topicRoot(fixture.tempRepo, topic);
          const expectedFiles = [
            "charter.md",
            "claims.md",
            "leads.md",
            "passes/pass-001.md",
            "tracks/track-alpha.md",
            "tracks/track-beta.md",
            "tracks/track-gamma.md",
          ];
          for (const rel of expectedFiles) {
            assert.ok(fs.existsSync(path.join(workspace, rel)), `expected ${rel}`);
          }
          assert.ok(readTopicFile(fixture.tempRepo, topic, "charter.md").includes("subagent spawning"));
          assert.ok(readTopicFile(fixture.tempRepo, topic, "passes/pass-001.md").includes("track-alpha"));
          assert.ok(readTopicFile(fixture.tempRepo, topic, "tracks/track-gamma.md").includes("source-card"));
          assert.ok(listTracks.stdout.includes("track-alpha"));
          assert.ok(listTracks.stdout.includes("track-gamma"));

          return {
            assertions: [
              "plan-pass creates optional charter, claims, and leads surfaces",
              "plan-pass creates pass and initial track contracts for parallel work",
              "add-track appends a deterministic track contract and list-tracks reports it",
            ],
            commands: [
              commandLine(planArgs),
              commandLine(addArgs),
              commandLine(listArgs),
            ],
            artifacts: expectedFiles.map((rel) => ({ label: rel, path: path.join(workspace, rel) })),
            outputs: {
              listed_tracks: listTracks.stdout.trim().split("\n"),
            },
            replacements: fixture.replacements,
          };
        } finally {
          cleanupTempDir(fixture.tempRepo, context.keepTemp);
        }
      },
    },
    {
      id: "quality-and-drift-doctor-warning-only",
      title: "Quality And Drift Doctor Warning Only",
      summary: "doctor --quality and doctor --drift should report incomplete or drifting research without failing the structural doctor contract.",
      focus: ["anti-drift", "warning-only-quality", "source-summary-coherence"],
      run: (context): EvalCaseResult => {
        const { repoRoot } = context;
        const fixture = withFixture(context);
        const topic = "drift-warning";
        try {
          initTopic(fixture, repoRoot, topic, "Drift Warning");
          expectOk(runResearcher(fixture, plannedPassArgs(fixture.tempRepo, topic), repoRoot), "plan-pass");
          addSource(fixture, repoRoot, topic, "a01", "Grounded Source");
          addSummary(fixture, repoRoot, topic, "z99", "Mismatched Summary");
          addUngroundedArtifacts(fixture, repoRoot, topic);

          const structuralArgs = ["doctor", "--root", fixture.tempRepo, "--topic-class", TOPIC_CLASS, "--topic", topic];
          const structuralDoctor = runResearcher(fixture, structuralArgs, repoRoot);
          expectOk(structuralDoctor, "structural doctor");

          const qualityArgs = ["doctor", "--root", fixture.tempRepo, "--topic-class", TOPIC_CLASS, "--topic", topic, "--quality"];
          const qualityDoctor = runResearcher(fixture, qualityArgs, repoRoot);
          expectWarnOk(qualityDoctor, "doctor --quality", ["z99"]);

          const driftArgs = ["doctor", "--root", fixture.tempRepo, "--topic-class", TOPIC_CLASS, "--topic", topic, "--drift"];
          const driftDoctor = runResearcher(fixture, driftArgs, repoRoot);
          expectWarnOk(driftDoctor, "doctor --drift", ["cl-ungrounded", "lead-loose", "insight-one"]);

          return {
            assertions: [
              "structural doctor remains green when research quality is incomplete",
              "quality doctor reports source-card/summary id mismatch as a warning",
              "drift doctor reports ungrounded claims and loose leads as warnings",
            ],
            commands: [
              commandLine(structuralArgs),
              commandLine(qualityArgs),
              commandLine(driftArgs),
            ],
            artifacts: [
              { label: "claims", path: path.join(topicRoot(fixture.tempRepo, topic), "claims.md") },
              { label: "leads", path: path.join(topicRoot(fixture.tempRepo, topic), "leads.md") },
            ],
            outputs: {
              quality_warning: `${qualityDoctor.stdout}\n${qualityDoctor.stderr}`.trim(),
              drift_warning: `${driftDoctor.stdout}\n${driftDoctor.stderr}`.trim(),
            },
            replacements: fixture.replacements,
          };
        } finally {
          cleanupTempDir(fixture.tempRepo, context.keepTemp);
        }
      },
    },
    {
      id: "managed-index-preserves-authored-content",
      title: "Managed Index Preserves Authored Content",
      summary: "refresh-index should add managed artifact sections without deleting hand-authored topic curation.",
      focus: ["managed-index", "curation-preservation", "artifact-discovery"],
      run: (context): EvalCaseResult => {
        const { repoRoot } = context;
        const fixture = withFixture(context);
        const topic = "managed-index";
        try {
          initTopic(fixture, repoRoot, topic, "Managed Index");
          const indexPath = path.join(topicRoot(fixture.tempRepo, topic), "index.md");
          fs.appendFileSync(
            indexPath,
            `
## Hand Authored Notes

Keep this curation intact.
`,
            "utf8",
          );
          expectOk(runResearcher(fixture, plannedPassArgs(fixture.tempRepo, topic), repoRoot), "plan-pass");
          expectOk(runResearcher(fixture, addTrackArgs(fixture.tempRepo, topic), repoRoot), "add-track");

          const refreshArgs = [
            "refresh-index",
            "--root",
            fixture.tempRepo,
            "--topic-class",
            TOPIC_CLASS,
            "--topic",
            topic,
            "--title",
            "Managed Index",
          ];
          expectOk(runResearcher(fixture, refreshArgs, repoRoot), "refresh-index");
          expectOk(runResearcher(fixture, refreshArgs, repoRoot), "refresh-index idempotence");

          const indexText = fs.readFileSync(indexPath, "utf8");
          assert.ok(indexText.includes("Keep this curation intact"));
          assert.ok(indexText.includes("pass-001.md"));
          assert.ok(indexText.includes("track-alpha.md"));
          assert.ok(indexText.includes("track-gamma.md"));
          assert.equal(countOccurrences(indexText, "<!-- BAGAKIT:RESEARCHER:SOURCE-CARDS:START -->"), 1);
          assert.equal(countOccurrences(indexText, "<!-- BAGAKIT:RESEARCHER:SOURCE-CARDS:END -->"), 1);
          assert.equal(countOccurrences(indexText, "<!-- BAGAKIT:RESEARCHER:SUMMARIES:START -->"), 1);
          assert.equal(countOccurrences(indexText, "<!-- BAGAKIT:RESEARCHER:SUMMARIES:END -->"), 1);
          assert.equal(countOccurrences(indexText, "<!-- BAGAKIT:RESEARCHER:PASSES:START -->"), 1);
          assert.equal(countOccurrences(indexText, "<!-- BAGAKIT:RESEARCHER:PASSES:END -->"), 1);
          assert.equal(countOccurrences(indexText, "<!-- BAGAKIT:RESEARCHER:TRACKS:START -->"), 1);
          assert.equal(countOccurrences(indexText, "<!-- BAGAKIT:RESEARCHER:TRACKS:END -->"), 1);
          assert.equal(countOccurrences(indexText, "<!-- BAGAKIT:RESEARCHER:CLAIMS:START -->"), 1);
          assert.equal(countOccurrences(indexText, "<!-- BAGAKIT:RESEARCHER:CLAIMS:END -->"), 1);
          assert.equal(countOccurrences(indexText, "<!-- BAGAKIT:RESEARCHER:INSIGHTS:START -->"), 1);
          assert.equal(countOccurrences(indexText, "<!-- BAGAKIT:RESEARCHER:INSIGHTS:END -->"), 1);
          assert.equal(countOccurrences(indexText, "<!-- BAGAKIT:RESEARCHER:LEADS:START -->"), 1);
          assert.equal(countOccurrences(indexText, "<!-- BAGAKIT:RESEARCHER:LEADS:END -->"), 1);
          assertNoPathLeaks(fixture.tempRepo, [indexPath]);

          return {
            assertions: [
              "refresh-index preserves hand-authored prose",
              "refresh-index surfaces pass artifacts",
              "refresh-index surfaces track artifacts",
            ],
            commands: [commandLine(refreshArgs)],
            artifacts: [{ label: "topic-index", path: indexPath }],
            outputs: {
              preserved_text: "Keep this curation intact",
              managed_entries: ["pass-001.md", "track-alpha.md", "track-gamma.md"],
            },
            replacements: fixture.replacements,
          };
        } finally {
          cleanupTempDir(fixture.tempRepo, context.keepTemp);
        }
      },
    },
    {
      id: "handoff-renderer-is-file-only",
      title: "Handoff Renderer Is File Only",
      summary: "render-handoff should write handoff artifacts under the researcher topic and avoid mutating living-knowledge or evolver systems.",
      focus: ["handoff-boundary", "system-isolation", "artifact-output"],
      run: (context): EvalCaseResult => {
        const { repoRoot } = context;
        const fixture = withFixture(context);
        const topic = "handoff-boundary";
        try {
          initTopic(fixture, repoRoot, topic, "Handoff Boundary");
          expectOk(runResearcher(fixture, plannedPassArgs(fixture.tempRepo, topic), repoRoot), "plan-pass");

          const handoffArgsByKind = ["selector", "evolver", "living-knowledge"].map((kind) => [
            "render-handoff",
            "--root",
            fixture.tempRepo,
            "--topic-class",
            TOPIC_CLASS,
            "--topic",
            topic,
            "--kind",
            kind,
          ]);
          for (const handoffArgs of handoffArgsByKind) {
            expectOk(runResearcher(fixture, handoffArgs, repoRoot), `render-handoff ${handoffArgs.at(-1)}`);
          }

          const workspace = topicRoot(fixture.tempRepo, topic);
          const handoffPath = path.join(workspace, "handoffs", "selector-evidence.md");
          const evolverHandoffPath = path.join(workspace, "handoffs", "evolver-context.md");
          const livingKnowledgeHandoffPath = path.join(workspace, "handoffs", "living-knowledge-intake.md");
          assert.ok(fs.existsSync(handoffPath), "expected selector handoff artifact");
          assert.ok(fs.existsSync(evolverHandoffPath), "expected evolver handoff artifact");
          assert.ok(fs.existsSync(livingKnowledgeHandoffPath), "expected living-knowledge handoff artifact");
          const forbiddenRoots = [
            path.join(fixture.tempRepo, ".bagakit", "living-knowledge"),
            path.join(fixture.tempRepo, ".bagakit", "evolver"),
          ];
          for (const forbiddenRoot of forbiddenRoots) {
            assert.equal(fs.existsSync(forbiddenRoot), false, `unexpected mutation: ${forbiddenRoot}`);
          }
          const handoffText = fs.readFileSync(handoffPath, "utf8");
          assert.ok(handoffText.toLowerCase().includes("selector"));
          assert.ok(handoffText.includes("pass-001"));
          assertNoPathLeaks(fixture.tempRepo, [handoffPath, evolverHandoffPath, livingKnowledgeHandoffPath]);

          return {
            assertions: [
              "render-handoff writes under topic-local handoffs",
              "render-handoff includes enough context for selector consumption",
              "render-handoff does not mutate living-knowledge or evolver runtime roots",
            ],
            commands: handoffArgsByKind.map(commandLine),
            artifacts: [{ label: "selector-handoff", path: handoffPath }],
            outputs: {
              forbidden_roots_checked: [".bagakit/living-knowledge", ".bagakit/evolver"],
            },
            replacements: fixture.replacements,
          };
        } finally {
          cleanupTempDir(fixture.tempRepo, context.keepTemp);
        }
      },
    },
    {
      id: "clean-extended-topic-has-no-warning",
      title: "Clean Extended Topic Has No Warning",
      summary: "A complete extended topic should not produce quality or drift warnings.",
      focus: ["false-positive-control", "claim-insight-lead-helpers", "synthesis"],
      run: (context): EvalCaseResult => {
        const { repoRoot } = context;
        const fixture = withFixture(context);
        const topic = "clean-topic";
        try {
          initTopic(fixture, repoRoot, topic, "Clean Topic");
          expectOk(runResearcher(fixture, plannedPassArgs(fixture.tempRepo, topic), repoRoot), "plan-pass");
          const helperCommands = addCleanArtifacts(fixture, repoRoot, topic);
          const refreshArgs = ["refresh-index", "--root", fixture.tempRepo, "--topic-class", TOPIC_CLASS, "--topic", topic, "--title", "Clean Topic"];
          expectOk(runResearcher(fixture, refreshArgs, repoRoot), "refresh-index");

          const qualityArgs = ["doctor", "--root", fixture.tempRepo, "--topic-class", TOPIC_CLASS, "--topic", topic, "--quality"];
          const quality = runResearcher(fixture, qualityArgs, repoRoot);
          expectOk(quality, "doctor --quality clean");
          assert.equal(`${quality.stdout}\n${quality.stderr}`.toLowerCase().includes("warning"), false);

          const driftArgs = ["doctor", "--root", fixture.tempRepo, "--topic-class", TOPIC_CLASS, "--topic", topic, "--drift"];
          const drift = runResearcher(fixture, driftArgs, repoRoot);
          expectOk(drift, "doctor --drift clean");
          assert.equal(`${drift.stdout}\n${drift.stderr}`.toLowerCase().includes("warning"), false);

          const workspace = topicRoot(fixture.tempRepo, topic);
          const generatedPaths = [
            path.join(workspace, "claims.md"),
            path.join(workspace, "leads.md"),
            path.join(workspace, "insights", "clean-insight.md"),
            path.join(workspace, "summaries", "pass-001-synthesis.md"),
            path.join(workspace, "index.md"),
          ];
          assert.ok(fs.readFileSync(path.join(workspace, "leads.md"), "utf8").includes("promoted into clean synthesis"));
          assertNoPathLeaks(fixture.tempRepo, generatedPaths);

          return {
            assertions: [
              "public helper commands create claim, insight, lead, and synthesis artifacts",
              "complete quality chain emits no quality warnings",
              "complete drift chain emits no drift warnings",
            ],
            commands: [
              commandLine(plannedPassArgs(fixture.tempRepo, topic)),
              ...helperCommands,
              commandLine(refreshArgs),
              commandLine(qualityArgs),
              commandLine(driftArgs),
            ],
            artifacts: generatedPaths.map((artifactPath) => ({ label: path.basename(artifactPath), path: artifactPath })),
            outputs: {
              quality: quality.stdout.trim(),
              drift: drift.stdout.trim(),
            },
            replacements: fixture.replacements,
          };
        } finally {
          cleanupTempDir(fixture.tempRepo, context.keepTemp);
        }
      },
    },
  ],
};
