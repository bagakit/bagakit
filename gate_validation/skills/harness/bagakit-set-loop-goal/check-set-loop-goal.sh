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

cli="skills/harness/bagakit-set-loop-goal/scripts/bagakit-set-loop-goal-cli.sh"
tmp="$(mktemp -d)"
concurrent_tmp=""
trap 'rm -rf "$tmp" "${concurrent_tmp:-}"' EXIT

sh "$cli" initialize-surface --root "$tmp"
sh "$cli" upsert-goal \
  --root "$tmp" \
  --goal-id demo-goal \
  --title "Demo Goal" \
  --prime-directive-text "Deliver the demo outcome and keep recovery crisp." \
  --current-state-line "Last known progress: none" \
  --current-state-line "Active branch: establish a baseline" \
  --current-state-line "Blockers: none" \
  --principle-line "Keep the Goal as a steering index." \
  --principle-line "Non-goals: do not turn it into a full plan dump." \
  --acceptance-line "Acceptance: a fresh executor can continue without the full chat." \
  --acceptance-line "Stop and ask when: an irreversible action is required." \
  --acceptance-line "Stop as complete when: completion evidence is written and archived." \
  --orchestration-line "Feature truth: none" \
  --orchestration-line "Research/evidence: none" \
  --next-instruction-text "Create the first owner-file pointer." \
  --decision-line "Initial creation from smoke test." \
  --question-line "None right now." \
  --foreground

wrapper_without_supervisor="$(sh "$cli" render-wrapper --root "$tmp")"
expected_wrapper_without_supervisor="$(cat <<'EOF'
@./.bagakit/goal/current.md
Read current.md first; it resolves state.yaml, foreground_goal, and the active Goal.

Context may be stale or wrong; recover from this file before trusting prior context.
EOF
)"
test "$wrapper_without_supervisor" = "$expected_wrapper_without_supervisor"

fresh_ok_output="$(sh "$cli" fresh-check --root "$tmp")"
test "$fresh_ok_output" = "fresh-executor check passed"

python3 - "$tmp/.bagakit/goal/demo-goal.md" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
path.write_text(text + "\n## Goal Delta Log\n- legacy checkpoint detail that must leave the control plane\n", encoding="utf-8")
PY

event_output="$(sh "$cli" append-goal-event \
  --root "$tmp" \
  --goal-id demo-goal \
  --kind supervisor_checkpoint \
  --owner goal-supervisor \
  --summary "The owner evidence changed the next recovery action." \
  --evidence-ref .bagakit/flow-runner/runs/demo/checkpoint.json \
  --control-effect replace_next_instruction)"
test "$event_output" = ".bagakit/goal/events/demo-goal.jsonl#2"

if sh "$cli" fresh-check --root "$tmp" >"$tmp/unreconciled.out" 2>&1; then
  printf 'fresh-check unexpectedly accepted an unreconciled control event\n' >&2
  exit 1
fi
grep -q 'unreconciled Goal control events require reconciliation' "$tmp/unreconciled.out"

reconcile_output="$(sh "$cli" reconcile-goal \
  --root "$tmp" \
  --goal-id demo-goal \
  --current-state-line "Last known progress: owner evidence inspected" \
  --current-state-line "Active branch: follow the corrected recovery path" \
  --current-state-line "Blockers: none" \
  --next-instruction-text "Run one bounded corrected recovery step." \
  --decision-line "Replaced the stale recovery action from owner evidence." \
  --owner goal-supervisor \
  --summary "Rebuilt current Goal truth after the supervisor checkpoint." \
  --evidence-ref .bagakit/flow-runner/runs/demo/checkpoint.json)"
expected_reconcile_output="$(cat <<'EOF'
.bagakit/goal/demo-goal.md
event: .bagakit/goal/events/demo-goal.jsonl#3
EOF
)"
test "$reconcile_output" = "$expected_reconcile_output"

python3 - "$tmp" <<'PY'
from pathlib import Path
import json
import sys

import yaml

root = Path(sys.argv[1])
goal_root = root / ".bagakit" / "goal"
goal = (goal_root / "demo-goal.md").read_text(encoding="utf-8")
events = [json.loads(line) for line in (goal_root / "events" / "demo-goal.jsonl").read_text(encoding="utf-8").splitlines()]
state = yaml.safe_load((goal_root / "state.yaml").read_text(encoding="utf-8"))

assert "Last known progress: none" not in goal
assert "Last known progress: owner evidence inspected" in goal
assert "Create the first owner-file pointer." not in goal
assert "Run one bounded corrected recovery step." in goal
assert "## Recent Decisions" in goal
assert "## Goal Delta Log" not in goal
assert "legacy checkpoint detail" not in goal
assert [event["seq"] for event in events] == [1, 2, 3]
assert events[1]["control_effect"] == "replace_next_instruction"
assert events[2]["kind"] == "goal_reconciled"
assert state["goals"]["demo-goal"]["event_log"] == ".bagakit/goal/events/demo-goal.jsonl"
assert state["goals"]["demo-goal"]["reconciled_through"] == 3
PY

fresh_ok_output="$(sh "$cli" fresh-check --root "$tmp")"
test "$fresh_ok_output" = "fresh-executor check passed"

owner_dir="$tmp/.bagakit/feature-tracker/features/f-demo"
mkdir -p "$owner_dir"
printf '{"feat_id":"f-demo","status":"in_progress","current_task_id":"T-001"}\n' >"$owner_dir/state.json"
printf '{"feat_id":"f-demo","tasks":[{"id":"T-001","status":"in_progress"}]}\n' >"$owner_dir/tasks.json"
cat >"$owner_dir/owner-receipt.json" <<'EOF'
{
  "schema": "bagakit.execution-owner-receipt.v1",
  "owner_kind": "feature_tracker",
  "owner_id": "f-demo",
  "semantic_revision": "",
  "lifecycle_status": "in_progress",
  "continuation": "continue",
  "current_item_id": "T-001",
  "blocker": null,
  "replacement_ref": null,
  "evidence_refs": [
    ".bagakit/feature-tracker/features/f-demo/state.json",
    ".bagakit/feature-tracker/features/f-demo/tasks.json"
  ],
  "evidence_hashes": {}
}
EOF

refresh_owner_receipt() {
  receipt_path="${1:-$owner_dir/owner-receipt.json}"
  python3 - "$tmp" "$receipt_path" <<'PY'
import hashlib
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
path = Path(sys.argv[2])
receipt = json.loads(path.read_text(encoding="utf-8"))
receipt["evidence_hashes"] = {
    ref: hashlib.sha256((root / ref).read_bytes()).hexdigest()
    for ref in receipt["evidence_refs"]
}
projection = {
    key: receipt[key]
    for key in (
        "owner_kind",
        "owner_id",
        "lifecycle_status",
        "continuation",
        "current_item_id",
        "blocker",
        "replacement_ref",
        "evidence_hashes",
    )
}
receipt["semantic_revision"] = hashlib.sha256(
    json.dumps(projection, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
).hexdigest()
path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
PY
}
refresh_owner_receipt
owner_revision="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["semantic_revision"])' "$owner_dir/owner-receipt.json")"

bind_output="$(sh "$cli" bind-execution-owner \
  --root "$tmp" \
  --goal-id demo-goal \
  --owner-kind feature_tracker \
  --owner-id f-demo \
  --receipt-ref .bagakit/feature-tracker/features/f-demo/owner-receipt.json \
  --owner goal-supervisor \
  --summary "Bound execution to current Feature Tracker truth.")"
grep -q "^owner_revision: $owner_revision$" <<<"$bind_output"
test "$(sh "$cli" fresh-check --root "$tmp")" = "fresh-executor check passed"
fresh_json="$(sh "$cli" fresh-check --root "$tmp" --json)"
python3 - "$fresh_json" "$owner_revision" <<'PY'
import json
import sys

payload = json.loads(sys.argv[1])
assert payload["status"] == "pass"
assert payload["goal_id"] == "demo-goal"
assert payload["observed_owner"] == {
    "continuation": "continue",
    "owner_id": "f-demo",
    "owner_kind": "feature_tracker",
    "semantic_revision": sys.argv[2],
}
PY

# A self-consistent receipt cannot substitute unrelated repo-local evidence.
mkdir -p "$tmp/docs"
cp "$owner_dir/owner-receipt.json" "$owner_dir/owner-receipt.backup.json"
cp "$owner_dir/state.json" "$tmp/docs/decoy-state.json"
cp "$owner_dir/tasks.json" "$tmp/docs/decoy-tasks.json"
python3 - "$owner_dir/owner-receipt.json" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
receipt = json.loads(path.read_text(encoding="utf-8"))
receipt["evidence_refs"] = ["docs/decoy-state.json", "docs/decoy-tasks.json"]
path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
PY
refresh_owner_receipt
if sh "$cli" fresh-check --root "$tmp" >"$tmp/decoy-owner-evidence.out" 2>&1; then
  printf 'fresh-check unexpectedly accepted decoy owner evidence\n' >&2
  exit 1
fi
grep -q 'receipt evidence must be its own state.json and tasks.json' "$tmp/decoy-owner-evidence.out"
mv "$owner_dir/owner-receipt.backup.json" "$owner_dir/owner-receipt.json"

# Simulate a crash after canonical owner truth changes but before receipt refresh.
printf '{"feat_id":"f-demo","status":"blocked","current_task_id":"T-001"}\n' >"$owner_dir/state.json"
if sh "$cli" fresh-check --root "$tmp" >"$tmp/owner-hash-drift.out" 2>&1; then
  printf 'fresh-check unexpectedly accepted canonical owner drift behind an old receipt\n' >&2
  exit 1
fi
grep -q 'owner receipt evidence hash changed' "$tmp/owner-hash-drift.out"

# Even with refreshed hashes and revision, receipt decisions must match canonical state.
refresh_owner_receipt
if sh "$cli" fresh-check --root "$tmp" >"$tmp/owner-decision-drift.out" 2>&1; then
  printf 'fresh-check unexpectedly accepted receipt decisions that contradict canonical state\n' >&2
  exit 1
fi
grep -q 'state status does not match receipt lifecycle_status' "$tmp/owner-decision-drift.out"

python3 - "$owner_dir/owner-receipt.json" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
receipt = json.loads(path.read_text(encoding="utf-8"))
receipt["lifecycle_status"] = "blocked"
receipt["continuation"] = "blocked"
receipt["blocker"] = {"class": "dependency", "reason": "validation owner is not ready"}
path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
PY
refresh_owner_receipt

if sh "$cli" fresh-check --root "$tmp" >"$tmp/stale-owner.out" 2>&1; then
  printf 'fresh-check unexpectedly accepted a changed owner revision\n' >&2
  exit 1
fi
grep -q 'owner receipt revision changed' "$tmp/stale-owner.out"
if sh "$cli" render-wrapper --root "$tmp" >/dev/null 2>"$tmp/stale-wrapper.err"; then
  printf 'render-wrapper unexpectedly accepted stale owner truth\n' >&2
  exit 1
fi
grep -q 'owner truth requires reconciliation' "$tmp/stale-wrapper.err"

sh "$cli" reconcile-goal \
  --root "$tmp" \
  --goal-id demo-goal \
  --status blocked \
  --accept-owner-revision \
  --current-state-line "Owner feature is blocked on validation readiness." \
  --next-instruction-text "Resolve the Feature Tracker blocker before continuing implementation." \
  --decision-line "Suppressed the stale continue instruction after owner truth changed." \
  --owner goal-supervisor \
  --summary "Reconciled the Goal to blocked owner truth." \
  --evidence-ref .bagakit/feature-tracker/features/f-demo/owner-receipt.json >/dev/null
test "$(sh "$cli" fresh-check --root "$tmp")" = "fresh-executor check passed"

printf '{"feat_id":"f-demo","status":"in_progress","current_task_id":"T-001"}\n' >"$owner_dir/state.json"
python3 - "$owner_dir/owner-receipt.json" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
receipt = json.loads(path.read_text(encoding="utf-8"))
receipt["lifecycle_status"] = "in_progress"
receipt["continuation"] = "continue"
receipt["blocker"] = None
path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
PY
refresh_owner_receipt
if sh "$cli" fresh-check --root "$tmp" >/dev/null 2>&1; then
  printf 'fresh-check unexpectedly accepted owner recovery without reconciliation\n' >&2
  exit 1
fi
sh "$cli" reconcile-goal \
  --root "$tmp" \
  --goal-id demo-goal \
  --status active \
  --accept-owner-revision \
  --current-state-line "Owner feature is ready to continue." \
  --next-instruction-text "Continue one bounded owner task." \
  --decision-line "Accepted the recovered owner revision." \
  --owner goal-supervisor \
  --summary "Reconciled the Goal after owner recovery." \
  --evidence-ref .bagakit/feature-tracker/features/f-demo/owner-receipt.json >/dev/null
test "$(sh "$cli" fresh-check --root "$tmp")" = "fresh-executor check passed"

review_path="$(sh "$cli" request-evolver-review \
  --root "$tmp" \
  --goal-id demo-goal \
  --review-id demo-after-round \
  --trigger after_round \
  --evidence-ref .bagakit/flow-runner/runs/demo/checkpoint.json)"
test "$review_path" = ".bagakit/goal/reviews/demo-after-round.json"

review_output="$(sh "$cli" record-evolver-review \
  --root "$tmp" \
  --review-id demo-after-round \
  --status completed \
  --evidence-ref .bagakit/evolver/intake/demo-signal.json \
  --drift "retry drift" \
  --next-instruction "Let Evolver decide whether to adopt the candidate." \
  --approval approved \
  --evolver-disposition signal_candidate)"
expected_review_output="$(cat <<'EOF'
.bagakit/goal/reviews/demo-after-round.json
next_instruction: Ask bagakit-skill-evolver session-review intake to review .bagakit/goal/reviews/demo-after-round.json as evidence.
EOF
)"
test "$review_output" = "$expected_review_output"

# Recording the same outcome is stable and does not duplicate evidence.
review_output_repeat="$(sh "$cli" record-evolver-review \
  --root "$tmp" \
  --review-id demo-after-round \
  --status completed \
  --evidence-ref .bagakit/evolver/intake/demo-signal.json \
  --drift "retry drift" \
  --next-instruction "Let Evolver decide whether to adopt the candidate." \
  --approval approved \
  --evolver-disposition signal_candidate)"
test "$review_output_repeat" = "$expected_review_output"

if sh "$cli" record-evolver-review \
  --root "$tmp" \
  --review-id demo-after-round \
  --status blocked \
  --next-instruction "Rewrite a finalized receipt." \
  --evolver-disposition deferred >/dev/null 2>"$tmp/finalized-review.err"; then
  printf 'record-evolver-review unexpectedly rewrote a finalized receipt\n' >&2
  exit 1
fi
grep -q 'review receipt is finalized' "$tmp/finalized-review.err"

sh "$cli" request-evolver-review \
  --root "$tmp" \
  --goal-id demo-goal \
  --review-id invalid-combination \
  --trigger risk >/dev/null
if sh "$cli" record-evolver-review \
  --root "$tmp" \
  --review-id invalid-combination \
  --status blocked \
  --approval rejected \
  --evolver-disposition signal_candidate >/dev/null 2>"$tmp/invalid-combination.err"; then
  printf 'record-evolver-review unexpectedly accepted blocked signal_candidate\n' >&2
  exit 1
fi
grep -q 'inconsistent with evolver_disposition=signal_candidate' "$tmp/invalid-combination.err"

# Re-requesting the same identity is idempotent and must not reset its receipt.
sh "$cli" request-evolver-review \
  --root "$tmp" \
  --goal-id demo-goal \
  --review-id demo-after-round \
  --trigger after_round >/dev/null

sh "$cli" request-evolver-review \
  --root "$tmp" \
  --goal-id demo-goal \
  --review-id demo-stale \
  --trigger stale \
  --drift "expected validation receipt is missing" >/dev/null

sh "$cli" request-evolver-review \
  --root "$tmp" \
  --goal-id demo-goal \
  --review-id request-idempotency \
  --trigger after_round \
  --evidence-ref .bagakit/flow-runner/runs/demo/checkpoint.json >/dev/null
sh "$cli" request-evolver-review \
  --root "$tmp" \
  --goal-id demo-goal \
  --review-id request-idempotency \
  --trigger after_round \
  --evidence-ref .bagakit/flow-runner/runs/demo/checkpoint.json >/dev/null
if sh "$cli" request-evolver-review \
  --root "$tmp" \
  --goal-id demo-goal \
  --review-id request-idempotency \
  --trigger after_round \
  --evidence-ref docs/specs/different-evidence.md >/dev/null 2>"$tmp/request-collision.err"; then
  printf 'request-evolver-review unexpectedly ignored a different request payload\n' >&2
  exit 1
fi
grep -q 'different request payload' "$tmp/request-collision.err"

if sh "$cli" request-evolver-review \
  --root "$tmp" \
  --goal-id demo-goal \
  --review-id invalid-trigger \
  --trigger hourly >/dev/null 2>&1; then
  printf 'request-evolver-review unexpectedly accepted a timer-like trigger\n' >&2
  exit 1
fi

if sh "$cli" request-evolver-review \
  --root "$tmp" \
  --goal-id demo-goal \
  --review-id invalid-ref \
  --trigger after_round \
  --evidence-ref ../outside.json >/dev/null 2>"$tmp/invalid-ref.err"; then
  printf 'request-evolver-review unexpectedly accepted an escaping evidence ref\n' >&2
  exit 1
fi
grep -q 'escapes the repository root' "$tmp/invalid-ref.err"

python3 - "$tmp" <<'PY'
from pathlib import Path
import json
import sys

root = Path(sys.argv[1])
reviews = root / ".bagakit" / "goal" / "reviews"
completed = json.loads((reviews / "demo-after-round.json").read_text(encoding="utf-8"))
stale = json.loads((reviews / "demo-stale.json").read_text(encoding="utf-8"))

assert completed == {
    "approval": "approved",
    "drift": ["retry drift"],
    "evidence_refs": [
        ".bagakit/flow-runner/runs/demo/checkpoint.json",
        ".bagakit/evolver/intake/demo-signal.json",
    ],
    "evolver_disposition": "signal_candidate",
    "goal_id": "demo-goal",
    "next_instruction": "Let Evolver decide whether to adopt the candidate.",
    "review_id": "demo-after-round",
    "schema": "bagakit.goal-evolver-review.v1",
    "status": "completed",
    "trigger": "after_round",
}
assert stale["trigger"] == "stale"
assert stale["status"] == "requested"
assert stale["evidence_refs"] == []
assert stale["drift"] == ["expected validation receipt is missing"]
PY

python3 - "$tmp/.bagakit/goal/reviews/demo-stale.json" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
payload = json.loads(path.read_text(encoding="utf-8"))
payload["topic"] = "authority-smuggling"
path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
PY
if sh "$cli" fresh-check --root "$tmp" >"$tmp/unexpected-field.out" 2>&1; then
  printf 'fresh-check unexpectedly accepted an authority-smuggling receipt field\n' >&2
  exit 1
fi
grep -q 'unexpected fields: topic' "$tmp/unexpected-field.out"
python3 - "$tmp/.bagakit/goal/reviews/demo-stale.json" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
payload = json.loads(path.read_text(encoding="utf-8"))
payload.pop("topic")
path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
PY

fresh_ok_output="$(sh "$cli" fresh-check --root "$tmp")"
test "$fresh_ok_output" = "fresh-executor check passed"

demo_goal="$tmp/.bagakit/goal/demo-goal.md"
demo_backup="$tmp/.bagakit/goal/demo-goal.backup.md"
cp "$demo_goal" "$demo_backup"
python3 - "$demo_goal" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
start = text.index("## Next Execution Instruction")
end = text.index("## Recent Decisions")
path.write_text(text[:start] + text[end:], encoding="utf-8")
PY
if sh "$cli" fresh-check --root "$tmp" >/dev/null 2>&1; then
  printf 'fresh-check unexpectedly passed on a broken Goal file\n' >&2
  exit 1
fi
mv "$demo_backup" "$demo_goal"
fresh_ok_output="$(sh "$cli" fresh-check --root "$tmp")"
test "$fresh_ok_output" = "fresh-executor check passed"

sh "$cli" set-supervision --root "$tmp" --mode self
wrapper_output="$(sh "$cli" render-wrapper --root "$tmp")"
expected_wrapper="$(cat <<'EOF'
@./.bagakit/goal/current.md
Read current.md first; it resolves state.yaml, foreground_goal, and the active Goal.

@./.bagakit/goal/supervisor.md
Read supervisor.md when present; run checkpoint rules around bounded work.

Context may be stale or wrong; recover from these files before trusting prior context.
EOF
)"
test "$wrapper_output" = "$expected_wrapper"

sh "$cli" upsert-goal \
  --root "$tmp" \
  --goal-id paused-goal \
  --title "Paused Goal" \
  --status paused \
  --prime-directive-text "Hold a second branch without losing it." \
  --current-state-line "Last known progress: branch not started" \
  --current-state-line "Active branch: wait until foreground goal is done" \
  --current-state-line "Blockers: none" \
  --principle-line "Keep one foreground goal only." \
  --acceptance-line "Acceptance: the branch can later be resumed." \
  --orchestration-line "Feature truth: none" \
  --next-instruction-text "Wait for the foreground goal to complete." \
  --decision-line "Created as a backlog branch." \
  --question-line "None."

if sh "$cli" reconcile-goal \
  --root "$tmp" \
  --goal-id paused-goal \
  --status active \
  --current-state-line "Invalid activation attempt." \
  --next-instruction-text "Do not commit this state." \
  --owner goal-supervisor \
  --summary "Attempted invalid backlog activation." >/dev/null 2>"$tmp/non-foreground-active.err"; then
  printf 'reconcile-goal unexpectedly activated a non-foreground Goal\n' >&2
  exit 1
fi
grep -q 'cannot activate a non-foreground Goal' "$tmp/non-foreground-active.err"

if sh "$cli" reconcile-goal \
  --root "$tmp" \
  --goal-id demo-goal \
  --status complete \
  --current-state-line "Invalid completion attempt." \
  --next-instruction-text "Do not commit this state." \
  --owner goal-supervisor \
  --summary "Attempted completion without archive evidence." >/dev/null 2>"$tmp/reconcile-complete.err"; then
  printf 'reconcile-goal unexpectedly accepted status=complete\n' >&2
  exit 1
fi
grep -Eq 'invalid choice|cannot close a Goal' "$tmp/reconcile-complete.err"

sh "$cli" set-foreground --root "$tmp" --goal-id paused-goal
python3 - "$tmp/.bagakit/goal/state.yaml" <<'PY'
from pathlib import Path
import sys

import yaml

state = yaml.safe_load(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert state["foreground_goal"] == "paused-goal"
assert state["goals"]["paused-goal"]["role"] == "foreground"
assert state["goals"]["paused-goal"]["status"] == "active"
assert state["goals"]["demo-goal"]["role"] == "backlog"
PY

sh "$cli" set-foreground --root "$tmp" --goal-id demo-goal
sh "$cli" relate-goals --root "$tmp" --from-goal paused-goal --to-goal demo-goal --kind interrupts
python3 - "$tmp/.bagakit/goal/state.yaml" <<'PY'
from pathlib import Path
import sys

import yaml

state = yaml.safe_load(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert state["edges"] == [{"from": "paused-goal", "to": "demo-goal", "kind": "interrupts"}]
PY

# A bound owner that still says continue cannot support Goal completion.
if sh "$cli" archive-goal \
  --root "$tmp" \
  --goal-id demo-goal \
  --status complete \
  --completion-evidence "premature archive proof" \
  --replacement-foreground paused-goal >/dev/null 2>"$tmp/continue-owner-archive.err"; then
  printf 'archive-goal unexpectedly completed while owner continuation was continue\n' >&2
  exit 1
fi
grep -q 'completion is not supported by owner truth' "$tmp/continue-owner-archive.err"
test -f "$tmp/.bagakit/goal/demo-goal.md"
test ! -e "$tmp/.bagakit/goal/archive/demo-goal.md"

# Move canonical owner truth to complete and explicitly reconcile that revision.
printf '{"feat_id":"f-demo","status":"done","current_task_id":null}\n' >"$owner_dir/state.json"
printf '{"feat_id":"f-demo","tasks":[{"id":"T-001","status":"done"}]}\n' >"$owner_dir/tasks.json"
python3 - "$owner_dir/owner-receipt.json" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
receipt = json.loads(path.read_text(encoding="utf-8"))
receipt["lifecycle_status"] = "done"
receipt["continuation"] = "complete"
receipt["current_item_id"] = None
receipt["blocker"] = None
path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
PY
refresh_owner_receipt
sh "$cli" reconcile-goal \
  --root "$tmp" \
  --goal-id demo-goal \
  --status ready_for_review \
  --accept-owner-revision \
  --current-state-line "Owner feature is complete and ready for Goal archive." \
  --next-instruction-text "Archive the Goal with completion evidence." \
  --decision-line "Accepted the owner completion revision." \
  --owner goal-supervisor \
  --summary "Reconciled owner completion before archive." \
  --evidence-ref .bagakit/feature-tracker/features/f-demo/owner-receipt.json >/dev/null

# Supersession is a route transition, not completion evidence for the old Goal.
printf '{}\n' >"$tmp/docs/successor-owner.json"
printf '{"feat_id":"f-demo","status":"discarded","current_task_id":null}\n' >"$owner_dir/state.json"
python3 - "$owner_dir/owner-receipt.json" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
receipt = json.loads(path.read_text(encoding="utf-8"))
receipt["lifecycle_status"] = "discarded"
receipt["continuation"] = "superseded"
receipt["replacement_ref"] = "docs/successor-owner.json"
path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
PY
refresh_owner_receipt
sh "$cli" reconcile-goal \
  --root "$tmp" \
  --goal-id demo-goal \
  --status paused \
  --accept-owner-revision \
  --current-state-line "Owner feature was superseded by a replacement route." \
  --next-instruction-text "Route to the replacement instead of claiming completion." \
  --owner goal-supervisor \
  --summary "Reconciled owner supersession before archive." >/dev/null
if sh "$cli" archive-goal \
  --root "$tmp" \
  --goal-id demo-goal \
  --status complete \
  --completion-evidence "invalid superseded completion" \
  --replacement-foreground paused-goal >/dev/null 2>"$tmp/superseded-owner-archive.err"; then
  printf 'archive-goal unexpectedly treated owner supersession as completion\n' >&2
  exit 1
fi
grep -q 'completion requires owner continuation=complete' "$tmp/superseded-owner-archive.err"
test -f "$tmp/.bagakit/goal/demo-goal.md"
test ! -e "$tmp/.bagakit/goal/archive/demo-goal.md"

# Restore completed owner truth for the remaining archive checks.
printf '{"feat_id":"f-demo","status":"done","current_task_id":null}\n' >"$owner_dir/state.json"
python3 - "$owner_dir/owner-receipt.json" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
receipt = json.loads(path.read_text(encoding="utf-8"))
receipt["lifecycle_status"] = "done"
receipt["continuation"] = "complete"
receipt["replacement_ref"] = None
path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
PY
refresh_owner_receipt
sh "$cli" reconcile-goal \
  --root "$tmp" \
  --goal-id demo-goal \
  --status ready_for_review \
  --accept-owner-revision \
  --current-state-line "Owner feature is complete and ready for Goal archive." \
  --next-instruction-text "Archive the Goal with completion evidence." \
  --owner goal-supervisor \
  --summary "Restored owner completion after supersession regression." >/dev/null

# Invalid replacement must fail before moving any Goal or event file.
state_hash_before="$(shasum -a 256 "$tmp/.bagakit/goal/state.yaml" | awk '{print $1}')"
current_hash_before="$(shasum -a 256 "$tmp/.bagakit/goal/current.md" | awk '{print $1}')"
if sh "$cli" archive-goal \
  --root "$tmp" \
  --goal-id demo-goal \
  --status complete \
  --completion-evidence "smoke archive proof" \
  --replacement-foreground missing-goal >/dev/null 2>"$tmp/missing-replacement.err"; then
  printf 'archive-goal unexpectedly accepted a missing replacement\n' >&2
  exit 1
fi
grep -q 'replacement foreground goal is not registered' "$tmp/missing-replacement.err"
test -f "$tmp/.bagakit/goal/demo-goal.md"
test -f "$tmp/.bagakit/goal/events/demo-goal.jsonl"
test ! -e "$tmp/.bagakit/goal/archive/demo-goal.md"
test "$state_hash_before" = "$(shasum -a 256 "$tmp/.bagakit/goal/state.yaml" | awk '{print $1}')"
test "$current_hash_before" = "$(shasum -a 256 "$tmp/.bagakit/goal/current.md" | awk '{print $1}')"

# A prepare-phase filesystem failure must not publish a partial archive.
goal_root="$tmp/.bagakit/goal"
active_hash_before="$(shasum -a 256 "$goal_root/demo-goal.md" | awk '{print $1}')"
event_hash_before="$(shasum -a 256 "$goal_root/events/demo-goal.jsonl" | awk '{print $1}')"
chmod u-w "$goal_root"
set +e
sh "$cli" archive-goal \
  --root "$tmp" \
  --goal-id demo-goal \
  --status complete \
  --completion-evidence "filesystem failure archive proof" \
  --replacement-foreground paused-goal >/dev/null 2>"$tmp/archive-transaction.err"
archive_transaction_rc=$?
set -e
chmod u+w "$goal_root"
if [[ $archive_transaction_rc -eq 0 ]]; then
  printf 'archive-goal unexpectedly succeeded with an unwritable Goal root\n' >&2
  exit 1
fi
grep -q 'transaction failed without publishing partial state' "$tmp/archive-transaction.err"
test "$active_hash_before" = "$(shasum -a 256 "$goal_root/demo-goal.md" | awk '{print $1}')"
test "$event_hash_before" = "$(shasum -a 256 "$goal_root/events/demo-goal.jsonl" | awk '{print $1}')"
test "$state_hash_before" = "$(shasum -a 256 "$goal_root/state.yaml" | awk '{print $1}')"
test "$current_hash_before" = "$(shasum -a 256 "$goal_root/current.md" | awk '{print $1}')"
test ! -e "$goal_root/archive/demo-goal.md"
test -z "$(find "$goal_root/archive" -name '*.tmp-*' -print -quit)"

# Inject a failure after publication begins and prove the rollback helper
# restores updated, created, and deleted paths without leftover temp files.
python3 - \
  "$root/skills/harness/bagakit-set-loop-goal/scripts/bagakit-set-loop-goal.py" \
  "$tmp" <<'PY'
import importlib.util
import sys
from pathlib import Path

module_path = Path(sys.argv[1])
fixture = Path(sys.argv[2]) / "rollback-fixture"
fixture.mkdir()
first = fixture / "first.txt"
created = fixture / "created.txt"
deleted = fixture / "deleted.txt"
last = fixture / "last.txt"
first.write_text("first-before\n", encoding="utf-8")
deleted.write_text("deleted-before\n", encoding="utf-8")

spec = importlib.util.spec_from_file_location("bagakit_set_loop_goal", module_path)
assert spec is not None and spec.loader is not None
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

original_replace = module.os.replace
replace_count = 0

def injected_replace(source, destination):
    global replace_count
    original_replace(source, destination)
    replace_count += 1
    if replace_count == 2:
        raise OSError("injected post-publish failure")

module.os.replace = injected_replace
try:
    module.commit_file_transaction(
        [
            (first, b"first-after\n", 0o644),
            (created, b"created-after\n", 0o644),
            (last, b"last-after\n", 0o644),
        ],
        [deleted],
    )
except SystemExit as exc:
    assert "without publishing partial state" in str(exc)
else:
    raise AssertionError("injected transaction failure unexpectedly succeeded")
finally:
    module.os.replace = original_replace

assert first.read_text(encoding="utf-8") == "first-before\n"
assert not created.exists()
assert deleted.read_text(encoding="utf-8") == "deleted-before\n"
assert not last.exists()
assert not list(fixture.glob(".*.tmp-*"))
PY

# A paused replacement whose owner is blocked must not be activated implicitly.
paused_owner_dir="$tmp/.bagakit/feature-tracker/features/f-paused"
mkdir -p "$paused_owner_dir"
printf '{"feat_id":"f-paused","status":"blocked","current_task_id":null}\n' >"$paused_owner_dir/state.json"
printf '{"feat_id":"f-paused","tasks":[{"id":"T-010","status":"blocked"}]}\n' >"$paused_owner_dir/tasks.json"
cat >"$paused_owner_dir/owner-receipt.json" <<'EOF'
{
  "schema": "bagakit.execution-owner-receipt.v1",
  "owner_kind": "feature_tracker",
  "owner_id": "f-paused",
  "semantic_revision": "",
  "lifecycle_status": "blocked",
  "continuation": "blocked",
  "current_item_id": null,
  "blocker": {"class": "dependency", "reason": "replacement dependency is blocked"},
  "replacement_ref": null,
  "evidence_refs": [
    ".bagakit/feature-tracker/features/f-paused/state.json",
    ".bagakit/feature-tracker/features/f-paused/tasks.json"
  ],
  "evidence_hashes": {}
}
EOF
refresh_owner_receipt "$paused_owner_dir/owner-receipt.json"
sh "$cli" bind-execution-owner \
  --root "$tmp" \
  --goal-id paused-goal \
  --owner-kind feature_tracker \
  --owner-id f-paused \
  --receipt-ref .bagakit/feature-tracker/features/f-paused/owner-receipt.json \
  --owner goal-supervisor \
  --summary "Bound paused replacement to blocked owner truth." >/dev/null
if sh "$cli" archive-goal \
  --root "$tmp" \
  --goal-id demo-goal \
  --status complete \
  --completion-evidence "smoke archive proof" \
  --replacement-foreground paused-goal >/dev/null 2>"$tmp/blocked-replacement.err"; then
  printf 'archive-goal unexpectedly activated a blocked replacement\n' >&2
  exit 1
fi
grep -q 'replacement foreground activation is blocked by owner truth' "$tmp/blocked-replacement.err"
test -f "$tmp/.bagakit/goal/demo-goal.md"
test ! -e "$tmp/.bagakit/goal/archive/demo-goal.md"

sh "$cli" upsert-goal \
  --root "$tmp" \
  --goal-id replacement-goal \
  --title "Replacement Goal" \
  --status paused \
  --prime-directive-text "Continue after the demo Goal is archived." \
  --current-state-line "Waiting for foreground replacement." \
  --principle-line "Activate only after archive preflight succeeds." \
  --acceptance-line "Acceptance: replacement becomes foreground." \
  --orchestration-line "Feature truth: none" \
  --next-instruction-text "Continue the replacement branch." >/dev/null

sh "$cli" archive-goal \
  --root "$tmp" \
  --goal-id demo-goal \
  --status complete \
  --completion-evidence "smoke archive proof" \
  --replacement-foreground replacement-goal

python3 - "$tmp" <<'PY'
from __future__ import annotations

from pathlib import Path

import yaml

tmp = Path(__import__("sys").argv[1])
goal_root = tmp / ".bagakit" / "goal"
state = yaml.safe_load((goal_root / "state.yaml").read_text(encoding="utf-8"))
current = (goal_root / "current.md").read_text(encoding="utf-8")
archived = (goal_root / "archive" / "demo-goal.md").read_text(encoding="utf-8")
archived_events = goal_root / "archive" / "demo-goal.events.jsonl"
paused = (goal_root / "paused-goal.md").read_text(encoding="utf-8")
replacement = (goal_root / "replacement-goal.md").read_text(encoding="utf-8")
surface = (goal_root / "surface.toml").read_text(encoding="utf-8")
goal_root_text = "\n".join(
    path.read_text(encoding="utf-8")
    for path in sorted(goal_root.rglob("*"))
    if path.is_file()
)

assert state["schema"] == "bagakit.goal-state.v1"
assert state["protocol_version"] == "bagakit.goal.v.0.2"
assert state["foreground_goal"] == "replacement-goal"
assert "demo-goal" not in state["goals"]
assert state["goals"]["replacement-goal"]["role"] == "foreground"
assert state["goals"]["replacement-goal"]["status"] == "active"
assert state["goals"]["paused-goal"]["role"] == "backlog"
assert state["goals"]["paused-goal"]["status"] == "paused"
assert state["edges"] == []
assert "truth_surface: .bagakit/goal/archive/demo-goal.md" in archived
assert "protocol_version: bagakit.goal.v.0.2" in archived
assert "status: complete" in archived
assert "smoke archive proof" in archived
assert archived_events.exists()
assert not (goal_root / "events" / "demo-goal.jsonl").exists()
assert "status: paused" in paused
assert "status: active" in replacement
assert "No foreground Goal is currently selected" not in current
assert 'owner_id = "bagakit-set-loop-goal"' in surface
assert 'protocol_version = "bagakit.goal.v.0.2"' in surface
assert str(tmp) not in goal_root_text
PY

# Competing archive commands serialize and publish exactly one closed Goal.
concurrent_tmp="$(mktemp -d)"
sh "$cli" initialize-surface --root "$concurrent_tmp" >/dev/null
sh "$cli" upsert-goal \
  --root "$concurrent_tmp" \
  --goal-id concurrent-goal \
  --title "Concurrent Goal" \
  --status active \
  --prime-directive-text "Close exactly once under competing archive requests." \
  --current-state-line "Ready for archive concurrency proof." \
  --principle-line "Serialize Goal mutation." \
  --acceptance-line "Acceptance: one archive succeeds and one observes closed truth." \
  --orchestration-line "Feature truth: none" \
  --next-instruction-text "Archive once." >/dev/null
set +e
sh "$cli" archive-goal \
  --root "$concurrent_tmp" \
  --goal-id concurrent-goal \
  --status complete \
  --completion-evidence "concurrency proof one" >"$concurrent_tmp/archive-one.out" 2>"$concurrent_tmp/archive-one.err" &
archive_one_pid=$!
sh "$cli" archive-goal \
  --root "$concurrent_tmp" \
  --goal-id concurrent-goal \
  --status complete \
  --completion-evidence "concurrency proof two" >"$concurrent_tmp/archive-two.out" 2>"$concurrent_tmp/archive-two.err" &
archive_two_pid=$!
wait "$archive_one_pid"
archive_one_rc=$?
wait "$archive_two_pid"
archive_two_rc=$?
set -e
if [[ $archive_one_rc -eq 0 && $archive_two_rc -eq 0 ]] || [[ $archive_one_rc -ne 0 && $archive_two_rc -ne 0 ]]; then
  printf 'competing archive-goal commands did not produce exactly one success\n' >&2
  exit 1
fi
test -f "$concurrent_tmp/.bagakit/goal/archive/concurrent-goal.md"
test ! -e "$concurrent_tmp/.bagakit/goal/concurrent-goal.md"
test ! -e "$concurrent_tmp/.bagakit/goal/events/concurrent-goal.jsonl"
test -f "$concurrent_tmp/.bagakit/goal/archive/concurrent-goal.events.jsonl"
cat "$concurrent_tmp/archive-one.err" "$concurrent_tmp/archive-two.err" | grep -Eq 'active goal file not found|archived Goal already exists'

printf 'bagakit-set-loop-goal smoke passed\n'
