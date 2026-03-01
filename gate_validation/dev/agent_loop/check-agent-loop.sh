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
AGENT_LOOP_DIR="$ROOT/dev/agent_loop"
FAKE_RUNNER="$ROOT/gate_validation/dev/agent_loop/testdata/fake_runner.py"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

git -C "$TMP_DIR" init -q -b main
git -C "$TMP_DIR" config user.name "Bagakit"
git -C "$TMP_DIR" config user.email "bagakit@example.com"
printf '# demo\n' > "$TMP_DIR/README.md"
git -C "$TMP_DIR" add README.md
git -C "$TMP_DIR" commit -q -m "init"

mkdir -p "$TMP_DIR/skills/harness"
ln -s "$FLOW_RUNNER_DIR" "$TMP_DIR/skills/harness/bagakit-flow-runner"

bash "$FEATURE_TRACKER_DIR/scripts/feature-tracker.sh" check-reference-readiness --root "$TMP_DIR" >/dev/null
bash "$FEATURE_TRACKER_DIR/scripts/feature-tracker.sh" initialize-tracker --root "$TMP_DIR" >/dev/null
bash "$FEATURE_TRACKER_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Tracker source" --slug "tracker-source" --goal "Drive tracker-backed loop" --workspace-mode proposal_only >/dev/null

FEATURE_ID="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
print(payload["features"][0]["feat_id"])
PY
)"

bash "$FEATURE_TRACKER_DIR/scripts/feature-tracker.sh" assign-feature-workspace --root "$TMP_DIR" --feature "$FEATURE_ID" --workspace-mode worktree >/dev/null

bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" apply --root "$TMP_DIR" >/dev/null
bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" ingest-feature-tracker --root "$TMP_DIR" >/dev/null
bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" add-item --root "$TMP_DIR" --item-id manual-one --title "Manual item" --source-kind manual --source-ref manual:one >/dev/null

bash "$AGENT_LOOP_DIR/agent-loop.sh" apply --root "$TMP_DIR" >/dev/null
bash "$AGENT_LOOP_DIR/agent-loop.sh" configure-runner --root "$TMP_DIR" --runner-name fake --argv-json "[\"python3\",\"$FAKE_RUNNER\",\"{repo_root}\",\"{session_brief}\",\"{runner_result}\"]" >/dev/null

NEXT_JSON="$TMP_DIR/agent-next.json"
bash "$AGENT_LOOP_DIR/agent-loop.sh" next --root "$TMP_DIR" --item manual-one --json > "$NEXT_JSON"
python3 - "$NEXT_JSON" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert payload["runner_ready"] is True
assert payload["flow_next"]["item_id"] == "manual-one"
assert payload["flow_next"]["recommended_action"] == "run_session"
PY

MANUAL_JSON="$TMP_DIR/manual-run.json"
bash "$AGENT_LOOP_DIR/agent-loop.sh" run --root "$TMP_DIR" --item manual-one --max-sessions 2 --json > "$MANUAL_JSON"
python3 - "$MANUAL_JSON" "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
root = Path(sys.argv[2])
assert payload["run_status"] == "terminal"
assert payload["stop_reason"] == "item_archived"
assert payload["sessions_launched"] == 1
assert (root / ".bagakit" / "flow-runner" / "archive" / "manual-one").is_dir()
PY

TRACKER_JSON="$TMP_DIR/tracker-run.json"
set +e
bash "$AGENT_LOOP_DIR/agent-loop.sh" run --root "$TMP_DIR" --item "feature-$FEATURE_ID" --max-sessions 1 --json > "$TRACKER_JSON"
status=$?
set -e
if [[ "$status" -ne 1 ]]; then
  echo "error: tracker-backed run should stop with operator action required" >&2
  exit 1
fi
python3 - "$TRACKER_JSON" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert payload["run_status"] == "operator_action_required"
assert payload["stop_reason"] == "closeout_pending"
assert payload["sessions_launched"] == 1
assert payload["checkpoint_observed"] is True
PY

WATCH_JSON="$TMP_DIR/watch.json"
bash "$AGENT_LOOP_DIR/agent-loop.sh" watch --root "$TMP_DIR" --json > "$WATCH_JSON"
python3 - "$WATCH_JSON" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert len(payload["recent_runs"]) >= 2
assert len(payload["recent_sessions"]) >= 2
PY

bash "$AGENT_LOOP_DIR/agent-loop.sh" validate --root "$TMP_DIR" >/dev/null

echo "ok: agent-loop smoke passed"
