set -euo pipefail

ROOT="."

while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      ROOT="$2"
      shift 2
      ;;
    *)
      echo "unexpected argument: $1" >&2
      exit 2
      ;;
  esac
done

ROOT="$(cd "$ROOT" && pwd)"
FEATURE_TRACKER_DIR="$ROOT/skills/harness/bagakit-feature-tracker"
FLOW_RUNNER_DIR="$ROOT/skills/harness/bagakit-flow-runner"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

git -C "$TMP_DIR" init -q -b main
git -C "$TMP_DIR" config user.name "Bagakit"
git -C "$TMP_DIR" config user.email "bagakit@example.com"
printf '# demo\n' > "$TMP_DIR/README.md"
git -C "$TMP_DIR" add README.md
git -C "$TMP_DIR" commit -q -m "init"

bash "$FEATURE_TRACKER_DIR/scripts/feature-tracker.sh" check-reference-readiness --root "$TMP_DIR" >/dev/null
bash "$FEATURE_TRACKER_DIR/scripts/feature-tracker.sh" initialize-tracker --root "$TMP_DIR"
bash "$FEATURE_TRACKER_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Flow source" --slug "flow-source" --goal "Drive flow" --workspace-mode proposal_only

FEATURE_ID="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
items = payload.get("features")
if not isinstance(items, list):
    raise SystemExit("missing features array")
print(items[0]["feat_id"])
PY
)"

bash "$FEATURE_TRACKER_DIR/scripts/feature-tracker.sh" assign-feature-workspace --root "$TMP_DIR" --feature "$FEATURE_ID" --workspace-mode worktree >/dev/null

bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" apply --root "$TMP_DIR"
bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" ingest-feature-tracker --root "$TMP_DIR"

ITEM_ID="feature-${FEATURE_ID}"
NEXT_JSON="$TMP_DIR/next.json"
bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" next --root "$TMP_DIR" --json > "$NEXT_JSON"
python3 - "$NEXT_JSON" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert payload["recommended_action"] == "run_session"
assert payload["session_contract"]["launch_bounded_session"] is True
assert payload["session_contract"]["archive_only_closeout"] is False
assert "BAGAKIT_FLOW_RUNNER_SKILL_DIR" in payload["checkpoint_request"]["command_example"]
PY

RESUME_JSON="$TMP_DIR/resume.json"
bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" resume-candidates --root "$TMP_DIR" --json > "$RESUME_JSON"
python3 - "$RESUME_JSON" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert len(payload["live"]) == 1
assert payload["live"][0]["item_id"].startswith("feature-")
PY

bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" snapshot --root "$TMP_DIR" --item "$ITEM_ID" --label "../../../escape" --json >/dev/null
test ! -d "$TMP_DIR/.bagakit/flow-runner/escape"
bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" checkpoint --root "$TMP_DIR" --item "$ITEM_ID" --stage inspect --session-status progress --objective "Inspect" --attempted "Read runtime" --result "Ready" --next-action "Run one bounded session" --clean-state yes --json >/dev/null

if bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" checkpoint --root "$TMP_DIR" --item "$ITEM_ID" --stage bogus --session-status progress --objective "Bad" --attempted "Bad" --result "Bad" --next-action "Bad" --clean-state yes >/dev/null 2>&1; then
  echo "error: bogus checkpoint stage unexpectedly passed" >&2
  exit 1
fi

bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" checkpoint --root "$TMP_DIR" --item "$ITEM_ID" --stage review --session-status gate_passed --objective "Review" --attempted "Check status" --result "Done" --next-action "Ask feature-tracker to close out" --clean-state yes --json >/dev/null

if bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" checkpoint --root "$TMP_DIR" --item "$ITEM_ID" --stage review --session-status gate_passed --objective "Bad" --attempted "Bad" --result "Bad" --next-action "Bad" --clean-state yes --item-status completed >/dev/null 2>&1; then
  echo "error: tracker-sourced item unexpectedly accepted --item-status override" >&2
  exit 1
fi

STOP_JSON="$TMP_DIR/next-stop.json"
bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" next --root "$TMP_DIR" --item "$ITEM_ID" --json > "$STOP_JSON"
python3 - "$STOP_JSON" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert payload["recommended_action"] == "stop"
assert payload["action_reason"] == "closeout_pending"
assert payload["session_contract"]["archive_only_closeout"] is False
PY

if bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" archive-item --root "$TMP_DIR" --item "$ITEM_ID" >/dev/null 2>&1; then
  echo "error: feature-tracker sourced item unexpectedly archived from flow-runner" >&2
  exit 1
fi

bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" open-incident --root "$TMP_DIR" --item "$ITEM_ID" --family review --summary "Need a decision" --recommended-resume stay_blocked >/dev/null
bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" resolve-incident --root "$TMP_DIR" --item "$ITEM_ID" --incident "inc-does-not-exist" --close-note "noop" >/dev/null 2>&1 && {
  echo "error: resolving missing incident unexpectedly passed" >&2
  exit 1
} || true

bash "$FEATURE_TRACKER_DIR/scripts/feature-tracker.sh" discard-feature --root "$TMP_DIR" --feature "$FEATURE_ID" --reason stale >/dev/null
bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" ingest-feature-tracker --root "$TMP_DIR" >/dev/null
test -d "$TMP_DIR/.bagakit/flow-runner/archive/$ITEM_ID"
test ! -d "$TMP_DIR/.bagakit/flow-runner/items/$ITEM_ID"

bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" validate --root "$TMP_DIR" >/dev/null

echo "ok: bagakit-flow-runner canonical smoke passed"
