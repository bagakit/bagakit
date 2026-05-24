#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: gate_validation/skills/harness/bagakit-project-chronicle/check-project-chronicle.sh [--root <repo-root>]" >&2
  exit 2
}

ROOT="."
while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      [[ $# -ge 2 ]] || usage
      ROOT="$2"
      shift 2
      ;;
    *)
      usage
      ;;
  esac
done

ROOT="$(cd "$ROOT" && pwd)"
CLI="$ROOT/skills/harness/bagakit-project-chronicle/scripts/project_chronicle.ts"
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/bagakit-project-chronicle.XXXXXX")"
trap 'rm -rf "$TMP_ROOT"' EXIT

run_cli() {
  node --experimental-strip-types "$CLI" "$@"
}

run_cli init \
  --root "$TMP_ROOT" \
  --run-id founding-age \
  --title "The Founding Age" \
  --scope "all sessions exposed by the fixture adapter" >/dev/null

test -f "$TMP_ROOT/.bagakit/project-chronicle/surface.toml"
grep -q 'owner_id = "bagakit-project-chronicle"' "$TMP_ROOT/.bagakit/project-chronicle/surface.toml"

run_cli add-session \
  --root "$TMP_ROOT" \
  --run-id founding-age \
  --session-id pathfinder \
  --title "First path" \
  --source-kind host-session \
  --ref-kind host-session \
  --source-ref host-session:pathfinder \
  --disposition included >/dev/null

run_cli add-session \
  --root "$TMP_ROOT" \
  --run-id founding-age \
  --session-id duplicate-export \
  --title "Duplicate export" \
  --source-kind transcript \
  --ref-kind repo-file \
  --source-ref fixtures/duplicate.md \
  --disposition excluded \
  --reason "duplicate of the included host session" >/dev/null

if run_cli add-session \
  --root "$TMP_ROOT" \
  --run-id founding-age \
  --session-id bad-ref \
  --title "Bad ref" \
  --source-kind transcript \
  --ref-kind repo-file \
  --source-ref "$TMP_ROOT/session.md" \
  --disposition included >/dev/null 2>&1; then
  echo "absolute repo-file ref unexpectedly succeeded" >&2
  exit 1
fi

if run_cli seal-census \
  --root "$TMP_ROOT" \
  --run-id founding-age \
  --status partial \
  --adapter fixture >/dev/null 2>&1; then
  echo "partial census without a gap unexpectedly succeeded" >&2
  exit 1
fi

run_cli seal-census \
  --root "$TMP_ROOT" \
  --run-id founding-age \
  --status partial \
  --adapter fixture \
  --gap "archived sessions are unavailable in the fixture" >/dev/null

run_cli validate --root "$TMP_ROOT" --run-id founding-age >/dev/null

if run_cli validate --root "$TMP_ROOT" --run-id founding-age --final >/dev/null 2>&1; then
  echo "incomplete final chronicle unexpectedly passed" >&2
  exit 1
fi

STATUS_JSON="$(run_cli status --root "$TMP_ROOT" --run-id founding-age --json)"
node -e 'const value = JSON.parse(process.argv[1]); if (value.coverage !== "partial" || value.counts.discovered !== 2 || value.counts.included !== 1 || value.cards !== 1) process.exit(1)' "$STATUS_JSON"

RUN_DIR="$TMP_ROOT/.bagakit/project-chronicle/runs/founding-age"
node --input-type=module - "$RUN_DIR" <<'NODE'
import fs from "node:fs";
import path from "node:path";

const runDir = process.argv[2];
const write = (name, value) => fs.writeFileSync(path.join(runDir, name), `${JSON.stringify(value, null, 2)}\n`);
const read = (name) => JSON.parse(fs.readFileSync(path.join(runDir, name), "utf8"));

const card = read("session-cards/pathfinder.json");
card.summary = "The first session exposed a route but also showed that informal memory could not preserve it.";
card.intent = "Find a repeatable way to carry project learning across sessions.";
card.observed_outcomes = ["A bounded evidence artifact replaced an implicit handoff."];
card.turning_points = [{ statement: "The team stopped treating chat memory as durable state.", locator: "turn-12" }];
card.belief_updates = [{ before: "The next session can reconstruct context.", after: "The next session needs a source-bound handoff.", trigger: "handoff loss", locator: "turn-12" }];
card.leverage_points = [{ kind: "friction", statement: "One explicit handoff removes repeated explanation.", mechanism: "artifact reuse", locator: "turn-14" }];
card.counterevidence = [];
card.evidence_spans = [{ locator: "turn-12", claim: "An explicit handoff became necessary." }];
write("session-cards/pathfinder.json", card);

write("lineage.json", {
  schema: "bagakit.project-chronicle.lineage.v1",
  run_id: "founding-age",
  epochs: [{
    epoch_id: "age-of-memory",
    name: "The Age of Memory",
    thesis: "The project replaced implicit reconstruction with explicit inheritance.",
    baseline_before: "Continuation depended on chat memory.",
    pressure: "A later session could not recover the decision path.",
    intervention: "The session created a bounded evidence handoff.",
    observed_delta: "Later work could start from an owned artifact.",
    baseline_after: "Continuation had a reviewable source of truth.",
    session_ids: ["pathfinder"],
    evidence_refs: ["session:pathfinder#turn-12"],
    remaining_tensions: ["Archived-session coverage remains partial."],
  }],
  generation_links: [],
});

write("cast.json", {
  schema: "bagakit.project-chronicle.cast.v1",
  run_id: "founding-age",
  roles: [{
    role_id: "pathfinder-role",
    epithet: "The Pathfinder",
    function: "Exposed the first reusable route and its limits.",
    fit_rationale: "The session discovered both a path and the need to preserve it.",
    session_ids: ["pathfinder"],
    evidence_refs: ["session:pathfinder#turn-12"],
  }],
});

write("evolution-ledger.json", {
  schema: "bagakit.project-chronicle.evolution-ledger.v1",
  run_id: "founding-age",
  entries: [{
    insight_id: "explicit-inheritance",
    kind: "friction-lever",
    epistemic_status: "accepted",
    what: "Carry decision context through a bounded evidence artifact.",
    why: "Implicit session memory forces later agents to reconstruct intent and increases drift.",
    intended_generalization: "Use for multi-session work where decisions constrain later execution.",
    failure_boundary: "Do not add a durable artifact for trivial one-turn tasks.",
    behavior_examples: ["Write a source-bound handoff before ending a session."],
    transfer_checks: ["A one-turn formatting edit should not create a project handoff."],
    evidence_refs: ["session:pathfinder#turn-12"],
    counterevidence_refs: [],
    confidence: 0.86,
  }],
});

write("review.json", {
  schema: "bagakit.project-chronicle.review.v1",
  run_id: "founding-age",
  status: "accepted",
  reviewer: "fixture-reviewer",
  reviewed_at: "2001-01-02T00:00:00Z",
  rationale: "The fixture keeps partial coverage explicit and grounds every material claim.",
  gates: Object.fromEntries([
    "coverage_honesty",
    "evidence_fidelity",
    "contradiction_handling",
    "epic_without_fabrication",
    "generational_delta",
    "harness_value",
    "privacy_and_retention",
  ].map((gate) => [gate, { status: "pass", note: `${gate} checked against the fixture artifacts.` }])),
});

fs.writeFileSync(path.join(runDir, "chronicle.md"), `# The Founding Age

The project began in an age when continuation depended on memory. The Pathfinder exposed a route, then revealed its price: what lived only in one conversation did not reliably pass to the next.

The first inheritance was therefore not a grand machine but a bounded artifact. From that point, later work could begin from evidence instead of reconstruction. The archived lands remain outside this edition, so the victory is deliberately incomplete.

Evidence: session:pathfinder#turn-12
`);
NODE

run_cli validate --root "$TMP_ROOT" --run-id founding-age --final >/dev/null

node --input-type=module - "$RUN_DIR/cast.json" <<'NODE'
import fs from "node:fs";
const file = process.argv[2];
const cast = JSON.parse(fs.readFileSync(file, "utf8"));
cast.roles = [];
fs.writeFileSync(file, `${JSON.stringify(cast, null, 2)}\n`);
NODE

if run_cli validate --root "$TMP_ROOT" --run-id founding-age --final >/dev/null 2>&1; then
  echo "final validation unexpectedly ignored missing cast coverage" >&2
  exit 1
fi

echo "ok: bagakit-project-chronicle CLI smoke passed"
