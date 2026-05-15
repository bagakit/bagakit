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

write_legacy_goal() {
  local target="$1"
  local goal_id="$2"
  local title="$3"
  local status="$4"
  mkdir -p "$(dirname "$target")"
  cat >"$target" <<EOF
---
schema: bagakit.loop-goal.v1
goal_id: $goal_id
status: $status
truth_surface: .bagakit/goal/$goal_id.md
completion_evidence: []
---

# Goal: $title

## Prime Directive
Complete $title without losing unfinished work.

## Current State
- Last known progress: legacy state
- Active branch: recover the Goal surface
- Blockers: none

## Execution Principles
- Preserve user intent.

## Acceptance And Stop Rules
- Acceptance: the Goal is recoverable under the current protocol.

## Orchestration Index
- Feature truth: none

## Next Execution Instruction
Inspect the legacy Goal surface.

## Goal Delta Log
- old checkpoint detail
EOF
}

single="$tmp/single"
write_legacy_goal "$single/.bagakit/goal/legacy-goal.md" legacy-goal "Legacy Goal" active

single_report="$(sh "$cli" inspect-upgrade --root "$single")"
python3 - "$single_report" <<'PY'
import json
import sys

report = json.loads(sys.argv[1])
assert report["target_protocol"] == "bagakit.goal.v.0.1"
assert report["status"] == "upgrade_required"
assert report["conflicts"] == []
assert report["inventory"]["foreground_goal"] == "legacy-goal"
PY
if grep -q 'protocol_version' "$single/.bagakit/goal/legacy-goal.md"; then
  printf 'inspect-upgrade unexpectedly mutated the legacy Goal\n' >&2
  exit 1
fi

sh "$cli" upgrade-surface --root "$single" --apply >/dev/null

reconciliation_report="$(sh "$cli" inspect-upgrade --root "$single")"
python3 - "$reconciliation_report" <<'PY'
import json
import sys

report = json.loads(sys.argv[1])
assert report["status"] == "reconciliation_required"
assert report["reconciliation_required_goal_ids"] == ["legacy-goal"]
assert [action["kind"] for action in report["deterministic_actions"]] == ["require_reconciliation"]
PY

if sh "$cli" fresh-check --root "$single" >"$single-fresh.out" 2>&1; then
  printf 'fresh-check unexpectedly accepted upgraded but unreconciled Goal truth\n' >&2
  exit 1
fi
grep -q 'unreconciled Goal control events' "$single-fresh.out"

sh "$cli" reconcile-goal \
  --root "$single" \
  --goal-id legacy-goal \
  --current-state-line "Last known progress: legacy surface upgraded" \
  --current-state-line "Active branch: continue from current owner truth" \
  --current-state-line "Blockers: none" \
  --next-instruction-text "Continue one bounded execution round." \
  --decision-line "Legacy checkpoint history moved out of the Goal control plane." \
  --owner goal-upgrade \
  --summary "Reconciled current truth after protocol upgrade." >/dev/null

sh "$cli" upsert-goal \
  --root "$single" \
  --goal-id second-goal \
  --title "Second Goal" \
  --prime-directive-text "Preserve a second unfinished task." \
  --current-state-line "Last known progress: not started" \
  --current-state-line "Active branch: wait in backlog" \
  --current-state-line "Blockers: none" \
  --principle-line "Do not interfere with the foreground Goal." \
  --acceptance-line "Acceptance: the Goal can later become foreground." \
  --orchestration-line "Feature truth: none" \
  --next-instruction-text "Wait until selected as foreground." >/dev/null

python3 - "$single/.bagakit/goal/state.yaml" <<'PY'
from pathlib import Path
import sys

import yaml

state = yaml.safe_load(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert state["goals"]["second-goal"]["status"] == "paused"
assert state["goals"]["second-goal"]["role"] == "backlog"
PY

if sh "$cli" upsert-goal \
  --root "$single" \
  --goal-id invalid-active-goal \
  --title "Invalid Active Goal" \
  --status active \
  --prime-directive-text "Do not create two active Goals." \
  --current-state-line "Last known progress: none" \
  --principle-line "Keep one active foreground." \
  --acceptance-line "Acceptance: rejected before write." \
  --orchestration-line "Feature truth: none" \
  --next-instruction-text "Stop." >/dev/null 2>&1; then
  printf 'upsert unexpectedly created a non-foreground active Goal\n' >&2
  exit 1
fi
test "$(sh "$cli" fresh-check --root "$single")" = "fresh-executor check passed"

python3 - "$single" <<'PY'
from pathlib import Path
import json
import sys

import yaml

root = Path(sys.argv[1])
goal_root = root / ".bagakit" / "goal"
goal = (goal_root / "legacy-goal.md").read_text(encoding="utf-8")
state = yaml.safe_load((goal_root / "state.yaml").read_text(encoding="utf-8"))
events = [json.loads(line) for line in (goal_root / "events" / "legacy-goal.jsonl").read_text(encoding="utf-8").splitlines()]
surface = (goal_root / "surface.toml").read_text(encoding="utf-8")

assert "protocol_version: bagakit.goal.v.0.1" in goal
assert "## Goal Delta Log" not in goal
assert "Legacy checkpoint history moved out of the Goal control plane." in goal
assert "## Open Questions\n- none" in goal
assert state["protocol_version"] == "bagakit.goal.v.0.1"
assert state["foreground_goal"] == "legacy-goal"
assert state["goals"]["legacy-goal"]["reconciled_through"] == 2
assert events[0]["kind"] == "goal_upgraded"
assert events[0]["control_effect"] == "update_current_state"
assert events[1]["kind"] == "goal_reconciled"
assert 'protocol_version = "bagakit.goal.v.0.1"' in surface
assert (goal_root / "archive" / "legacy-goal.legacy-log.md").exists()
assert not (goal_root / "upgrade.json").exists()
PY

current_report="$(sh "$cli" inspect-upgrade --root "$single")"
python3 - "$current_report" <<'PY'
import json
import sys

report = json.loads(sys.argv[1])
assert report["status"] == "current"
assert report["deterministic_actions"] == []
assert report["conflicts"] == []
PY
sh "$cli" upgrade-surface --root "$single" --apply >/dev/null

auto="$tmp/auto"
write_legacy_goal "$auto/.bagakit/goal/auto-goal.md" auto-goal "Auto Upgrade Goal" active
python3 - "$auto/.bagakit/goal/auto-goal.md" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
text = text.replace("schema: bagakit.loop-goal.v1\n", "schema: bagakit.loop-goal.v1\nprotocol_version: bagakit.goal.v.0.0\n")
path.write_text(text, encoding="utf-8")
PY
if sh "$cli" set-supervision --root "$auto" --mode self >/dev/null 2>"$auto.err"; then
  printf 'normal mutation unexpectedly continued after upgrade required reconciliation\n' >&2
  exit 1
fi
grep -q 'reconciliation is required' "$auto.err"
sh "$cli" reconcile-goal \
  --root "$auto" \
  --goal-id auto-goal \
  --current-state-line "Last known progress: automatic upgrade complete" \
  --current-state-line "Active branch: resume normal execution" \
  --current-state-line "Blockers: none" \
  --next-instruction-text "Resume one bounded round." \
  --owner goal-upgrade \
  --summary "Reconciled the automatically upgraded Goal." >/dev/null
sh "$cli" set-supervision --root "$auto" --mode self >/dev/null
test "$(sh "$cli" fresh-check --root "$auto")" = "fresh-executor check passed"
grep -q 'protocol_version: bagakit.goal.v.0.1' "$auto/.bagakit/goal/auto-goal.md"

multi="$tmp/multi"
write_legacy_goal "$multi/.bagakit/goal/goal-a.md" goal-a "Goal A" active
write_legacy_goal "$multi/.bagakit/goal/goal-b.md" goal-b "Goal B" active
cat >"$multi/.bagakit/goal/state.yaml" <<'EOF'
schema: bagakit.goal-state.v1
foreground_goal: null
supervision:
  mode: off
  contract: .bagakit/goal/supervisor.md
  checkpoint: before_action_and_after_round
goals: {}
edges:
  - from: goal-a
    to: goal-b
    kind: raises_bar
archive:
  dir: .bagakit/goal/archive
EOF

if sh "$cli" set-supervision --root "$multi" --mode self >/dev/null 2>"$multi.err"; then
  printf 'normal mutation unexpectedly bypassed a blocked Goal upgrade\n' >&2
  exit 1
fi
grep -q 'upgrade is blocked' "$multi.err"

python3 - "$multi" <<'PY'
from pathlib import Path
import json
import sys

root = Path(sys.argv[1])
goal_root = root / ".bagakit" / "goal"
report = json.loads((goal_root / "upgrade.json").read_text(encoding="utf-8"))
kinds = {conflict["kind"] for conflict in report["conflicts"]}
assert report["status"] == "blocked"
assert "foreground_selection" in kinds
assert report["next_instruction"].startswith("Use bagakit-grill")
assert any(conflict["route"] == "bagakit-grill" for conflict in report["conflicts"])
assert "protocol_version" not in (goal_root / "goal-a.md").read_text(encoding="utf-8")
assert "protocol_version" not in (goal_root / "goal-b.md").read_text(encoding="utf-8")
PY

sh "$cli" upgrade-surface \
  --root "$multi" \
  --foreground-goal goal-a \
  --pause-goal goal-b \
  --apply >/dev/null
if sh "$cli" fresh-check --root "$multi" >/dev/null 2>&1; then
  printf 'fresh-check unexpectedly accepted unreconciled multi-Goal upgrade\n' >&2
  exit 1
fi
for goal_id in goal-a goal-b; do
  sh "$cli" reconcile-goal \
    --root "$multi" \
    --goal-id "$goal_id" \
    --current-state-line "Last known progress: protocol upgrade complete" \
    --current-state-line "Active branch: follow the resolved topology" \
    --current-state-line "Blockers: none" \
    --next-instruction-text "Follow the foreground and backlog roles in state.yaml." \
    --owner goal-upgrade \
    --summary "Reconciled Goal after multi-Goal protocol upgrade." >/dev/null
done
test "$(sh "$cli" fresh-check --root "$multi")" = "fresh-executor check passed"

python3 - "$multi/.bagakit/goal/state.yaml" <<'PY'
from pathlib import Path
import sys

import yaml

state = yaml.safe_load(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert state["foreground_goal"] == "goal-a"
assert state["goals"]["goal-a"]["status"] == "active"
assert state["goals"]["goal-a"]["role"] == "foreground"
assert state["goals"]["goal-b"]["status"] == "paused"
assert state["goals"]["goal-b"]["role"] == "backlog"
assert state["edges"] == [{"from": "goal-a", "to": "goal-b", "kind": "raises_bar"}]
PY

incomplete="$tmp/incomplete"
write_legacy_goal "$incomplete/.bagakit/goal/incomplete-goal.md" incomplete-goal "Incomplete Goal" active
python3 - "$incomplete/.bagakit/goal/incomplete-goal.md" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
text = text.replace("schema: bagakit.loop-goal.v1\n", "schema: bagakit.loop-goal.v1\nprotocol_version: bagakit.goal.v.0.1\n")
start = text.index("## Acceptance And Stop Rules")
end = text.index("## Orchestration Index")
path.write_text(text[:start] + text[end:], encoding="utf-8")
PY
if sh "$cli" upgrade-surface --root "$incomplete" --apply >/dev/null 2>&1; then
  printf 'upgrade unexpectedly repaired missing Goal meaning\n' >&2
  exit 1
fi
python3 - "$incomplete/.bagakit/goal/upgrade.json" <<'PY'
from pathlib import Path
import json
import sys

report = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
conflict = next(item for item in report["conflicts"] if item["kind"] == "incomplete_goal_content")
assert conflict["route"] == "bagakit-grill"
assert "Acceptance And Stop Rules" in conflict["risk_if_wrong"]
PY

future="$tmp/future"
write_legacy_goal "$future/.bagakit/goal/future-goal.md" future-goal "Future Goal" active
python3 - "$future/.bagakit/goal/future-goal.md" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
text = text.replace("schema: bagakit.loop-goal.v1\n", "schema: bagakit.loop-goal.v1\nprotocol_version: bagakit.goal.v.9.0\n")
path.write_text(text, encoding="utf-8")
PY
if sh "$cli" upgrade-surface --root "$future" --apply >/dev/null 2>&1; then
  printf 'upgrade unexpectedly downgraded a future Goal protocol\n' >&2
  exit 1
fi
python3 - "$future/.bagakit/goal/upgrade.json" <<'PY'
from pathlib import Path
import json
import sys

report = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
conflict = next(item for item in report["conflicts"] if item["kind"] == "unsupported_future_protocol")
assert conflict["route"] == "install_newer_skill"
PY

printf 'bagakit-set-loop-goal protocol upgrade passed\n'
