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
trap 'rm -rf "$tmp"' EXIT

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

sh "$cli" archive-goal \
  --root "$tmp" \
  --goal-id demo-goal \
  --status complete \
  --completion-evidence "smoke archive proof" \
  --replacement-foreground paused-goal

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
surface = (goal_root / "surface.toml").read_text(encoding="utf-8")
goal_root_text = "\n".join(
    path.read_text(encoding="utf-8")
    for path in sorted(goal_root.rglob("*"))
    if path.is_file()
)

assert state["schema"] == "bagakit.goal-state.v1"
assert state["protocol_version"] == "bagakit.goal.v.0.1"
assert state["foreground_goal"] == "paused-goal"
assert "demo-goal" not in state["goals"]
assert state["goals"]["paused-goal"]["role"] == "foreground"
assert state["goals"]["paused-goal"]["status"] == "active"
assert state["edges"] == []
assert "truth_surface: .bagakit/goal/archive/demo-goal.md" in archived
assert "protocol_version: bagakit.goal.v.0.1" in archived
assert "status: complete" in archived
assert "smoke archive proof" in archived
assert archived_events.exists()
assert not (goal_root / "events" / "demo-goal.jsonl").exists()
assert "status: active" in paused
assert "No foreground Goal is currently selected" not in current
assert 'owner_id = "bagakit-set-loop-goal"' in surface
assert 'protocol_version = "bagakit.goal.v.0.1"' in surface
assert str(tmp) not in goal_root_text
PY

printf 'bagakit-set-loop-goal smoke passed\n'
