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

sh "$cli" upsert-goal \
  --root "$fixture" \
  --goal-id driver-goal \
  --title "Driver Goal" \
  --prime-directive-text "Prove event-driven Goal feedback." \
  --current-state-line "Last known progress: one acceptance gate passed" \
  --current-state-line "Active branch: validate the Driver projection" \
  --current-state-line "Blockers: none" \
  --principle-line "Use owner truth before rendering feedback." \
  --acceptance-line='- [x] Normal checkpoint report is deterministic.' \
  --acceptance-line='- [ ] Alert checkpoint report is deterministic.' \
  --orchestration-line "Validation truth: Goal Driver smoke fixture" \
  --next-instruction-text "Run the alert checkpoint fixture." >/dev/null

state_before="$(cksum "$fixture/.bagakit/goal/state.yaml")"
goal_before="$(cksum "$fixture/.bagakit/goal/driver-goal.md")"
events_before="$(cksum "$fixture/.bagakit/goal/events/driver-goal.jsonl")"

normal_json="$(sh "$cli" driver-report \
  --root "$fixture" \
  --previous-status draft \
  --event after_round \
  --elapsed-seconds 40 \
  --expected-seconds 100 \
  --tokens-used 200 \
  --token-budget 1000 \
  --discovery "The footer can be rendered without becoming task truth." \
  --evidence-ref .bagakit/goal/driver-goal.md \
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
  --evidence-ref .bagakit/goal/driver-goal.md)"

test "$(printf '%s\n' "$alert_text" | grep -c '👩🏻‍🚒 ALERTS !!')" -eq 1
printf '%s\n' "$alert_text" | grep -q 'P1\[Goal/budget_at_risk\]'
printf '%s\n' "$alert_text" | grep -q 'P1\[Goal/drift\]'

sh "$cli" upsert-goal \
  --root "$fixture" \
  --goal-id driver-goal \
  --status waiting \
  --wait-resume-on "authorization receipt is available" \
  --wait-loss-line "reassess after the expected authorization response window" >/dev/null

grace_json="$(sh "$cli" driver-report --root "$fixture" --event waiting --json)"
python3 - "$grace_json" <<'PY'
import json
import sys

report = json.loads(sys.argv[1])
assert report["status"] == "waiting"
assert report["alerts"] == []
PY

sh "$cli" upsert-goal \
  --root "$fixture" \
  --goal-id driver-goal \
  --status waiting \
  --wait-phase assessing \
  --wait-no-progress-rounds 2 >/dev/null

wait_alert_json="$(sh "$cli" driver-report --root "$fixture" --event wait_reassessment --json)"
python3 - "$wait_alert_json" <<'PY'
import json
import sys

report = json.loads(sys.argv[1])
assert report["status"] == "waiting"
assert [alert["id"] for alert in report["alerts"]] == ["wait_loss_line_crossed"]
assert "no-progress rounds=2" in report["alerts"][0]["signal"]
assert "P1[Goal/wait_loss_line_crossed]" in report["footer"]
PY

sh "$cli" upsert-goal \
  --root "$fixture" \
  --goal-id driver-goal \
  --status active >/dev/null

owner_dir="$fixture/.bagakit/feature-tracker/features/f-driver"
mkdir -p "$owner_dir"
printf '{"feat_id":"f-driver","status":"in_progress","current_task_id":"T-001"}\n' >"$owner_dir/state.json"
printf '{"feat_id":"f-driver","tasks":[{"id":"T-001","status":"in_progress"}]}\n' >"$owner_dir/tasks.json"
cat >"$owner_dir/owner-receipt.json" <<'EOF'
{
  "schema": "bagakit.execution-owner-receipt.v1",
  "owner_kind": "feature_tracker",
  "owner_id": "f-driver",
  "semantic_revision": "",
  "lifecycle_status": "in_progress",
  "continuation": "continue",
  "current_item_id": "T-001",
  "blocker": null,
  "replacement_ref": null,
  "evidence_refs": [
    ".bagakit/feature-tracker/features/f-driver/state.json",
    ".bagakit/feature-tracker/features/f-driver/tasks.json"
  ],
  "evidence_hashes": {}
}
EOF
python3 - "$fixture" "$owner_dir/owner-receipt.json" <<'PY'
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
sh "$cli" bind-execution-owner \
  --root "$fixture" \
  --goal-id driver-goal \
  --owner-kind feature_tracker \
  --owner-id f-driver \
  --receipt-ref .bagakit/feature-tracker/features/f-driver/owner-receipt.json \
  --owner goal-supervisor \
  --summary "Bound Driver fixture to owner truth." >/dev/null
printf '{"feat_id":"f-driver","status":"blocked","current_task_id":"T-001"}\n' >"$owner_dir/state.json"

stale_owner_json="$(sh "$cli" driver-report --root "$fixture" --json)"
python3 - "$stale_owner_json" <<'PY'
import json
import sys

report = json.loads(sys.argv[1])
owner_alert = next(alert for alert in report["alerts"] if alert["id"] == "owner_truth_stale")
assert owner_alert["severity"] == "P0"
assert "evidence hash changed" in owner_alert["signal"]
assert report["status"] == "active(needs_reconcile)"
assert report["next"] == "Reconcile the Goal against the current execution-owner receipt before continuing."
assert "P0[Goal/owner_truth_stale]" in report["footer"]
PY

sh "$cli" append-goal-event \
  --root "$fixture" \
  --goal-id driver-goal \
  --kind supervisor_checkpoint \
  --owner goal-supervisor \
  --summary "The next instruction may be stale." \
  --evidence-ref .bagakit/goal/driver-goal.md \
  --control-effect replace_next_instruction >/dev/null

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
