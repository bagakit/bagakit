set -euo pipefail

root="."
while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      [[ $# -ge 2 ]] || { printf 'missing value for --root\n' >&2; exit 2; }
      root="$2"
      shift 2
      ;;
    *)
      printf 'unexpected argument: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

cd "$root"
cli="skills/harness/bagakit-set-loop-goal/scripts/bagakit-set-loop-goal-cli.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fixture="$tmp/repo"
mkdir -p "$fixture/.bagakit/feature-tracker/features/driver"
printf '{"passed":1,"total":2}\n' > "$fixture/.bagakit/feature-tracker/features/driver/tasks.json"

sh "$cli" upsert-goal \
  --root "$fixture" \
  --goal-id driver-goal \
  --title "Driver Goal" \
  --prime-directive-text "Prove event-driven Goal feedback." \
  --invariant-line "Use owner truth before rendering feedback." \
  --acceptance-line='Acceptance: both Driver checkpoint cases are deterministic.' \
  --acceptance-line='Insufficient: one passing case does not count.' \
  --execution-owner-kind bagakit-feature-tracker \
  --execution-owner-ref .bagakit/feature-tracker/features/driver >/dev/null

state_before="$(cksum "$fixture/.bagakit/goal/state.yaml")"
goal_before="$(cksum "$fixture/.bagakit/goal/driver-goal.md")"
events_before="$(cksum "$fixture/.bagakit/goal/events/driver-goal.jsonl")"

normal_json="$(sh "$cli" driver-report \
  --root "$fixture" \
  --previous-status draft \
  --event after_round \
  --progress-passed 1 \
  --progress-total 2 \
  --elapsed-seconds 40 \
  --expected-seconds 100 \
  --tokens-used 200 \
  --token-budget 1000 \
  --discovery "The footer can be rendered without becoming task truth." \
  --evidence-ref .bagakit/feature-tracker/features/driver/tasks.json \
  --json)"

python3 - "$normal_json" <<'PY'
import json
import sys

report = json.loads(sys.argv[1])
assert report["goal_id"] == "driver-goal"
assert report["status"] == "draft→active"
assert report["event"] == "after_round"
assert report["progress"] == "[#####-----] 1/2 gates"
assert report["drift"] == "none"
assert report["budget"] == "Time=40/100(on_track),Tokens=200/1000(on_track)"
assert report["alerts"] == []
assert report["footer"].count("[[BAGAKIT]]") == 1
assert "ALERTS" not in report["footer"]
PY

test "$state_before" = "$(cksum "$fixture/.bagakit/goal/state.yaml")"
test "$goal_before" = "$(cksum "$fixture/.bagakit/goal/driver-goal.md")"
test "$events_before" = "$(cksum "$fixture/.bagakit/goal/events/driver-goal.jsonl")"

alert_text="$(sh "$cli" driver-report \
  --root "$fixture" \
  --event after_round \
  --elapsed-seconds 90 \
  --expected-seconds 100 \
  --tokens-used 900 \
  --token-budget 1000 \
  --drift "The implementation changed the acceptance interpretation." \
  --evidence-ref .bagakit/feature-tracker/features/driver/tasks.json)"

test "$(printf '%s\n' "$alert_text" | grep -c '👩🏻‍🚒 ALERTS !!')" -eq 1
printf '%s\n' "$alert_text" | grep -q 'P1\[Goal/budget_at_risk\]'
printf '%s\n' "$alert_text" | grep -q 'P1\[Goal/drift\]'

sh "$cli" upsert-goal \
  --root "$fixture" \
  --goal-id driver-goal \
  --status waiting >/dev/null

grace_json="$(sh "$cli" driver-report --root "$fixture" --event waiting --json)"
python3 - "$grace_json" <<'PY'
import json
import sys

report = json.loads(sys.argv[1])
assert report["status"] == "waiting"
assert report["alerts"] == []
PY

sh "$cli" append-goal-event \
  --root "$fixture" \
  --goal-id driver-goal \
  --kind goal_updated \
  --owner goal-supervisor \
  --summary "Owner task truth requires reconciliation." \
  --evidence-ref .bagakit/feature-tracker/features/driver/tasks.json \
  --control-effect owner_update_required >/dev/null

reconcile_json="$(sh "$cli" driver-report --root "$fixture" --json)"
python3 - "$reconcile_json" <<'PY'
import json
import sys

report = json.loads(sys.argv[1])
assert report["status"] == "reconciliation_required"
assert report["alerts"][0]["id"] == "reconciliation_required"
assert report["footer"].count("👩🏻‍🚒 ALERTS !!") == 1
assert "P1[Goal/reconciliation_required]" in report["footer"]
PY

printf 'bagakit-set-loop-goal driver report passed\n'
