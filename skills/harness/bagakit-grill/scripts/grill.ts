import path from "node:path";
import { parseArgs } from "node:util";

import { briefPath, ensureGrillSurface, readRun, repoRelative, runPath, writeBrief, writeRun } from "./lib/io.ts";
import { slugify, utcNow } from "./lib/model.ts";
import { attachEvidence, createRun, nextNode, progressCounts, recordAnswer, recordConvergenceCheck, refreshRun, upsertNode } from "./lib/planner.ts";
import { renderBrief } from "./lib/render.ts";

function printHelp(): void {
  console.log(`bagakit grill

Commands:
  init --root <repo-root> [--run-id <id>] --target <text> [--target-ref <ref>] [--ledger-ref <ref>] [--force]
  plan --root <repo-root> --run <id> --node <id> --question <text> --decision <text> --recommended-answer <text> --rationale <text> [--risk <text>] [--kind <question|research_needed>] [--option <text> ...] [--depends-on <id> ...] [--ledger-ref <ref> ...]
  next --root <repo-root> --run <id> [--json]
  answer --root <repo-root> --run <id> --node <id> --answer <text>
  attach-evidence --root <repo-root> --run <id> --node <id> --evidence-ref <ref> --summary <text>
  convergence-check --root <repo-root> --run <id> --goal <text> --signal <text> --adjacent-branch <text> --decision <close|switch|correct> [--note <text>]
  render --root <repo-root> --run <id>
  status --root <repo-root> --run <id> [--json]
`);
}

function commonOptions() {
  return {
    root: { type: "string" as const, default: "." },
  };
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required`);
  }
  return value;
}

function commandInit(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      ...commonOptions(),
      "run-id": { type: "string" as const },
      target: { type: "string" as const },
      "target-ref": { type: "string" as const, default: "" },
      "ledger-ref": { type: "string" as const, default: "" },
      force: { type: "boolean" as const, default: false },
    },
    strict: true,
    allowPositionals: false,
  });
  const repoRoot = path.resolve(values.root);
  const target = requireString(values.target, "--target");
  const compactTime = new Date().toISOString().replace(new RegExp("[-:.TZ]", "g"), "").slice(0, 14);
  const runId = values["run-id"] ? slugify(values["run-id"]) : `${compactTime}-${slugify(target).slice(0, 32)}`;
  const file = runPath(repoRoot, runId);
  if (!values.force) {
    try {
      readRun(repoRoot, runId);
      throw new Error(`grill run already exists: ${repoRelative(repoRoot, file)} (use --force to replace)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.startsWith("missing grill run:")) {
        throw error;
      }
    }
  }
  ensureGrillSurface(repoRoot);
  const run = createRun({
    runId,
    target,
    targetRef: values["target-ref"],
    ledgerRef: values["ledger-ref"],
    briefPath: repoRelative(repoRoot, briefPath(repoRoot, runId)),
  });
  writeRun(repoRoot, run);
  console.log(`ok: initialized ${repoRelative(repoRoot, file)}`);
  return 0;
}

function commandPlan(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      ...commonOptions(),
      run: { type: "string" as const },
      node: { type: "string" as const },
      kind: { type: "string" as const, default: "question" },
      question: { type: "string" as const },
      decision: { type: "string" as const },
      "recommended-answer": { type: "string" as const },
      rationale: { type: "string" as const },
      risk: { type: "string" as const, default: "" },
      option: { type: "string" as const, multiple: true, default: [] },
      "ledger-ref": { type: "string" as const, multiple: true, default: [] },
      "depends-on": { type: "string" as const, multiple: true, default: [] },
    },
    strict: true,
    allowPositionals: false,
  });
  const repoRoot = path.resolve(values.root);
  const runId = requireString(values.run, "--run");
  const run = readRun(repoRoot, runId);
  const updated = upsertNode(run, {
    id: requireString(values.node, "--node"),
    kind: requireString(values.kind, "--kind"),
    question: requireString(values.question, "--question"),
    options: values.option ?? [],
    decision: requireString(values.decision, "--decision"),
    recommendedAnswer: requireString(values["recommended-answer"], "--recommended-answer"),
    rationale: requireString(values.rationale, "--rationale"),
    risk: values.risk ?? "",
    ledgerRefs: values["ledger-ref"] ?? [],
    dependsOn: values["depends-on"] ?? [],
  });
  writeRun(repoRoot, updated);
  console.log(`ok: planned node ${values.node}`);
  return 0;
}

function commandNext(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      ...commonOptions(),
      run: { type: "string" as const },
      json: { type: "boolean" as const, default: false },
    },
    strict: true,
    allowPositionals: false,
  });
  const repoRoot = path.resolve(values.root);
  const runId = requireString(values.run, "--run");
  const run = refreshRun(readRun(repoRoot, runId));
  writeRun(repoRoot, run);
  const node = nextNode(run);
  if (values.json) {
    console.log(JSON.stringify({ run_id: runId, status: run.status, next: node ?? null }, null, 2));
  } else if (node) {
    console.log(`next=${node.id}`);
    console.log(`kind=${node.kind}`);
    console.log(`status=${node.status}`);
    console.log(`question=${node.question}`);
    for (const option of node.options_considered) {
      console.log(`option=${option}`);
    }
    console.log(`recommended_answer=${node.recommended_answer}`);
    if (node.risk_if_wrong) {
      console.log(`risk_if_wrong=${node.risk_if_wrong}`);
    }
  } else {
    console.log(`next=none`);
    console.log(`status=${run.status}`);
  }
  return 0;
}

function commandAnswer(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      ...commonOptions(),
      run: { type: "string" as const },
      node: { type: "string" as const },
      answer: { type: "string" as const },
    },
    strict: true,
    allowPositionals: false,
  });
  const repoRoot = path.resolve(values.root);
  const runId = requireString(values.run, "--run");
  const run = recordAnswer(readRun(repoRoot, runId), requireString(values.node, "--node"), requireString(values.answer, "--answer"));
  writeRun(repoRoot, run);
  console.log(`ok: answered node ${values.node}`);
  return 0;
}

function commandAttachEvidence(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      ...commonOptions(),
      run: { type: "string" as const },
      node: { type: "string" as const },
      "evidence-ref": { type: "string" as const },
      summary: { type: "string" as const },
    },
    strict: true,
    allowPositionals: false,
  });
  const repoRoot = path.resolve(values.root);
  const runId = requireString(values.run, "--run");
  const run = attachEvidence(readRun(repoRoot, runId), requireString(values.node, "--node"), {
    ref: requireString(values["evidence-ref"], "--evidence-ref"),
    summary: requireString(values.summary, "--summary"),
    attached_at: utcNow(),
  });
  writeRun(repoRoot, run);
  console.log(`ok: attached evidence to ${values.node}`);
  return 0;
}

function commandConvergenceCheck(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      ...commonOptions(),
      run: { type: "string" as const },
      goal: { type: "string" as const },
      signal: { type: "string" as const },
      "adjacent-branch": { type: "string" as const },
      decision: { type: "string" as const },
      note: { type: "string" as const, default: "" },
    },
    strict: true,
    allowPositionals: false,
  });
  const repoRoot = path.resolve(values.root);
  const runId = requireString(values.run, "--run");
  const run = recordConvergenceCheck(readRun(repoRoot, runId), {
    goalOrPrinciple: requireString(values.goal, "--goal"),
    signal: requireString(values.signal, "--signal"),
    adjacentBranch: requireString(values["adjacent-branch"], "--adjacent-branch"),
    decision: requireString(values.decision, "--decision"),
    note: values.note ?? "",
  });
  writeRun(repoRoot, run);
  console.log(`ok: recorded convergence check (${run.convergence_check.decision})`);
  return 0;
}

function commandRender(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      ...commonOptions(),
      run: { type: "string" as const },
    },
    strict: true,
    allowPositionals: false,
  });
  const repoRoot = path.resolve(values.root);
  const runId = requireString(values.run, "--run");
  const run = refreshRun(readRun(repoRoot, runId));
  run.render.last_rendered_at = utcNow();
  const rel = writeBrief(repoRoot, runId, renderBrief(run));
  run.render.brief_path = rel;
  writeRun(repoRoot, run);
  console.log(`ok: rendered ${rel}`);
  return 0;
}

function commandStatus(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      ...commonOptions(),
      run: { type: "string" as const },
      json: { type: "boolean" as const, default: false },
    },
    strict: true,
    allowPositionals: false,
  });
  const repoRoot = path.resolve(values.root);
  const runId = requireString(values.run, "--run");
  const run = refreshRun(readRun(repoRoot, runId));
  writeRun(repoRoot, run);
  const node = nextNode(run);
  const payload = {
    run_id: runId,
    status: run.status,
    counts: progressCounts(run),
    next_node_id: node?.id ?? "",
    convergence_check: run.convergence_check,
    brief_path: run.render.brief_path,
  };
  if (values.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`run_id=${payload.run_id}`);
    console.log(`status=${payload.status}`);
    console.log(`next_node_id=${payload.next_node_id || "none"}`);
    console.log(`convergence_check=${payload.convergence_check.status}`);
    console.log(`brief_path=${payload.brief_path}`);
  }
  return 0;
}

function main(): number {
  const [command, ...argv] = process.argv.slice(2);
  try {
    if (!command || command === "-h" || command === "--help") {
      printHelp();
      return 0;
    }
    if (command === "init") return commandInit(argv);
    if (command === "plan") return commandPlan(argv);
    if (command === "next") return commandNext(argv);
    if (command === "answer") return commandAnswer(argv);
    if (command === "attach-evidence") return commandAttachEvidence(argv);
    if (command === "convergence-check") return commandConvergenceCheck(argv);
    if (command === "render") return commandRender(argv);
    if (command === "status") return commandStatus(argv);
    throw new Error(`unknown command: ${command}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`error: ${message}`);
    return 1;
  }
}

process.exitCode = main();
