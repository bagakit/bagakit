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
  --delta-line "Initial creation from smoke test." \
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

demo_goal="$tmp/.bagakit/goal/demo-goal.md"
demo_backup="$tmp/.bagakit/goal/demo-goal.backup.md"
cp "$demo_goal" "$demo_backup"
python3 - "$demo_goal" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
start = text.index("## Next Execution Instruction")
end = text.index("## Goal Delta Log")
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
  --delta-line "Created as a backlog branch." \
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
paused = (goal_root / "paused-goal.md").read_text(encoding="utf-8")
surface = (goal_root / "surface.toml").read_text(encoding="utf-8")
goal_root_text = "\n".join(
    path.read_text(encoding="utf-8")
    for path in sorted(goal_root.rglob("*"))
    if path.is_file()
)

assert state["schema"] == "bagakit.goal-state.v1"
assert state["foreground_goal"] == "paused-goal"
assert "demo-goal" not in state["goals"]
assert state["goals"]["paused-goal"]["role"] == "foreground"
assert state["goals"]["paused-goal"]["status"] == "active"
assert state["edges"] == []
assert "truth_surface: .bagakit/goal/archive/demo-goal.md" in archived
assert "status: complete" in archived
assert "smoke archive proof" in archived
assert "status: active" in paused
assert "No foreground Goal is currently selected" not in current
assert 'owner_id = "bagakit-set-loop-goal"' in surface
assert str(tmp) not in goal_root_text
PY

printf 'bagakit-set-loop-goal smoke passed\n'
