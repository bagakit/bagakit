set -euo pipefail

root="."

while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      root="$2"
      shift 2
      ;;
    *)
      printf 'unknown argument: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

cd "$root"

cli="skills/harness/bagakit-grill/scripts/grill.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

help_text="$(bash "$cli" --help)"
for command in init plan next answer attach-evidence convergence-check render status; do
  if [[ "$help_text" != *"$command"* ]]; then
    printf 'missing command in help: %s\n' "$command" >&2
    exit 1
  fi
done

bash "$cli" init --root "$tmp" --run-id demo --target "Implement bagakit-grill as a compact L1 questioning skill" --target-ref "skills/harness/bagakit-grill/SKILL.md"
test -f "$tmp/.bagakit/grill/runs/demo/consensus-ledger.json"
if bash "$cli" plan --root "$tmp" --run demo --node bad001 --question "Can Grill ask without options?" --decision "option surface" --recommended-answer "No." --rationale "Questions need an option surface." 2> "$tmp/missing-options.err"; then
  printf 'plan unexpectedly accepted a question without options\n' >&2
  exit 1
fi
grep -q 'at least two --option values' "$tmp/missing-options.err"
bash "$cli" plan --root "$tmp" --run demo --node q001 --question "Should the first implementation use a structured SSOT?" --option "Use grill-run.json as the only run truth." --option "Let grill-brief.md become editable run truth." --decision "runtime state boundary" --recommended-answer "Use grill-run.json as the only run truth." --rationale "The generated brief must not become a second source of truth." --risk "Manual markdown edits would drift from the DAG." --ledger-ref success_criteria
bash "$cli" next --root "$tmp" --run demo > "$tmp/next-q001.txt"
grep -q '^next=q001$' "$tmp/next-q001.txt"
bash "$cli" answer --root "$tmp" --run demo --node q001 --answer "Yes, use grill-run.json plus a read-only brief."
bash "$cli" plan --root "$tmp" --run demo --node q002 --depends-on q001 --question "Should completion require a branch-width check after multi-round agreement?" --option "Record close/switch/correct before completing." --option "Complete automatically once all nodes are answered." --decision "convergence boundary" --recommended-answer "Yes, record close/switch/correct before completing." --rationale "Repeated agreement can hide a narrow question path." --risk "The run may complete while an adjacent branch remains untested." --ledger-ref convergence_conditions
bash "$cli" next --root "$tmp" --run demo > "$tmp/next-q002.txt"
grep -q '^next=q002$' "$tmp/next-q002.txt"
bash "$cli" answer --root "$tmp" --run demo --node q002 --answer "Yes, close only after checking adjacent branches."
bash "$cli" plan --root "$tmp" --run demo --node r001 --kind research_needed --depends-on q002 --question "Which prior art should shape the next grill question?" --decision "question quality evidence" --recommended-answer "Run bagakit-researcher through selector composition." --rationale "Grill should identify research gaps without owning research execution." --risk "The next question may copy shallow prior art."
bash "$cli" next --root "$tmp" --run demo > "$tmp/next-r001.txt"
grep -q '^next=r001$' "$tmp/next-r001.txt"
grep -q '^kind=research_needed$' "$tmp/next-r001.txt"
bash "$cli" attach-evidence --root "$tmp" --run demo --node r001 --evidence-ref ".bagakit/researcher/topics/frontier/grill/claims.md#c001" --summary "Prior art favors one question at a time with recommended answers."
bash "$cli" status --root "$tmp" --run demo --json > "$tmp/status-pending.json"
bash "$cli" convergence-check --root "$tmp" --run demo --goal "Protect the skill's plan-questioning boundary." --signal "Two accepted answers left no current DAG branch open." --adjacent-branch "Whether the target model itself needs correction before closure." --decision close --note "User chose to close the current branch."
bash "$cli" render --root "$tmp" --run demo
bash "$cli" status --root "$tmp" --run demo --json > "$tmp/status.json"

python3 - "$tmp" <<'PY'
import json
import pathlib
import sys

tmp = pathlib.Path(sys.argv[1])
run_path = tmp / ".bagakit" / "grill" / "runs" / "demo" / "grill-run.json"
brief_path = tmp / ".bagakit" / "grill" / "runs" / "demo" / "grill-brief.md"
ledger_path = tmp / ".bagakit" / "grill" / "runs" / "demo" / "consensus-ledger.json"
ledger_view_path = tmp / ".bagakit" / "grill" / "runs" / "demo" / "consensus-ledger.md"
surface_path = tmp / ".bagakit" / "grill" / "surface.toml"
pending_status = json.loads((tmp / "status-pending.json").read_text())
status = json.loads((tmp / "status.json").read_text())
run = json.loads(run_path.read_text())
ledger = json.loads(ledger_path.read_text())
brief = brief_path.read_text()
ledger_view = ledger_view_path.read_text()
surface = surface_path.read_text()

assert run["schema"] == "bagakit/grill-run/v1"
assert run["ledger_ref"] == ".bagakit/grill/runs/demo/consensus-ledger.json"
assert ledger["schema"] == "bagakit/consensus-ledger/v1"
assert ledger["owner"]["owner_skill"] == "bagakit-grill"
assert ledger["epistemic_items"][0]["epistemic_class"] == "known_known"
assert {item["epistemic_class"] for item in ledger["epistemic_items"]} == {
    "known_known",
    "known_unknown",
    "unknown_known",
    "unknown_unknown",
}
assert ledger["questions"][0]["id"] == "q001"
assert ledger["questions"][0]["answer_ref"] == "grill-run.json#qa-001"
assert "Known unknown" in ledger_view
assert "Unknown known" in ledger_view
assert pending_status["status"] == "convergence_pending"
assert run["status"] == "complete"
assert len(run["question_nodes"]) == 3
assert run["question_nodes"][0]["status"] == "answered"
assert run["question_nodes"][1]["status"] == "answered"
assert run["question_nodes"][2]["status"] == "evidence_attached"
assert len(run["question_nodes"][0]["options_considered"]) == 2
assert run["question_nodes"][0]["ledger_refs"] == ["success_criteria"]
assert len(run["qa_events"][0]["options_considered"]) == 2
assert len(run["qa_events"]) == 2
assert run["convergence_check"]["status"] == "resolved"
assert run["convergence_check"]["decision"] == "close"
assert run["convergence_check"]["answer_count"] == 2
assert status["status"] == "complete"
assert "Generated by bagakit-grill" in brief
assert "Options considered" in brief
assert "Ledger Coverage" in brief
assert "convergence_check: resolved" in brief
assert "question_nodes" not in brief
assert "qa_events" not in brief
assert 'owner_id = "bagakit-grill"' in surface
assert 'edit_policy = "generated_only"' in surface
PY

printf 'bagakit-grill smoke passed\n'
