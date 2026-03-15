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
FAKE_NOTIFY="$ROOT/gate_validation/dev/agent_loop/testdata/fake_notification_delivery.py"
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
bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" add-item --root "$TMP_DIR" --item-id manual-session --title "Manual session" --source-kind manual --source-ref manual:session >/dev/null
bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" add-item --root "$TMP_DIR" --item-id manual-budget --title "Manual budget" --source-kind manual --source-ref manual:budget >/dev/null
bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" add-item --root "$TMP_DIR" --item-id manual-cancel --title "Manual cancel" --source-kind manual --source-ref manual:cancel >/dev/null
bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" add-item --root "$TMP_DIR" --item-id manual-exit --title "Manual exit" --source-kind manual --source-ref manual:exit >/dev/null
bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" add-item --root "$TMP_DIR" --item-id manual-recover --title "Manual recover" --source-kind manual --source-ref manual:recover >/dev/null
bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" add-item --root "$TMP_DIR" --item-id manual-launch --title "Manual launch" --source-kind manual --source-ref manual:launch >/dev/null
bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" add-item --root "$TMP_DIR" --item-id manual-timeout --title "Manual timeout" --source-kind manual --source-ref manual:timeout >/dev/null
bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" add-item --root "$TMP_DIR" --item-id manual-refresh --title "Manual refresh" --source-kind manual --source-ref manual:refresh >/dev/null
bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" add-item --root "$TMP_DIR" --item-id manual-missing --title "Manual missing" --source-kind manual --source-ref manual:missing >/dev/null
bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" add-item --root "$TMP_DIR" --item-id manual-invalid --title "Manual invalid" --source-kind manual --source-ref manual:invalid >/dev/null
bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" add-item --root "$TMP_DIR" --item-id manual-locked --title "Manual lock" --source-kind manual --source-ref manual:locked >/dev/null

bash "$AGENT_LOOP_DIR/agent-loop.sh" apply --root "$TMP_DIR" >/dev/null
bash "$AGENT_LOOP_DIR/agent-loop.sh" configure-runner --root "$TMP_DIR" --runner-name fake --argv-json "[\"python3\",\"$FAKE_RUNNER\",\"{repo_root}\",\"{session_brief}\",\"{runner_result}\"]" >/dev/null

CURRENT_JSON="$TMP_DIR/current.json"
bash "$AGENT_LOOP_DIR/agent-loop.sh" current --root "$TMP_DIR" --json > "$CURRENT_JSON"
python3 - "$CURRENT_JSON" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert payload["selection_status"] == "selected"
assert payload["item_id"]
PY

STATUS_JSON="$TMP_DIR/status.json"
bash "$AGENT_LOOP_DIR/agent-loop.sh" status --root "$TMP_DIR" --json > "$STATUS_JSON"
python3 - "$STATUS_JSON" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert payload["current"]["selection_status"] == "selected"
assert payload["watch"]["run_lock"]["status"] == "idle"
PY

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

SESSION_JSON="$TMP_DIR/session-run.json"
bash "$AGENT_LOOP_DIR/agent-loop.sh" configure-runner --root "$TMP_DIR" --runner-name fake --argv-json "[\"python3\",\"$FAKE_RUNNER\",\"{repo_root}\",\"{session_brief}\",\"{runner_result}\"]" >/dev/null
bash "$AGENT_LOOP_DIR/agent-loop.sh" session-run --root "$TMP_DIR" --item manual-session --json > "$SESSION_JSON"
python3 - "$SESSION_JSON" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert payload["command"] == "session-run"
assert payload["item_id"] == "manual-session"
assert payload["runner_session_id"]
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
assert payload["host_notification_request"]["reason"] == "closeout_pending"
PY

TRACKER_RUN_ID="$(python3 - "$TRACKER_JSON" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
print(Path(payload["run_record_path"]).stem)
PY
)"

bash "$AGENT_LOOP_DIR/agent-loop.sh" configure-notification --root "$TMP_DIR" --transport command --argv-json "[\"python3\",\"$FAKE_NOTIFY\",\"{request_file}\",\"{receipt_file}\"]" --payload-mode file_json >/dev/null
NOTIFY_JSON="$TMP_DIR/notify.json"
bash "$AGENT_LOOP_DIR/agent-loop.sh" deliver-notification --root "$TMP_DIR" --run "$TRACKER_RUN_ID" --json > "$NOTIFY_JSON"
python3 - "$NOTIFY_JSON" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert payload["status"] == "delivered"
assert payload["transport"] == "command"
PY

STATUS_AFTER_NOTIFY="$TMP_DIR/status-after-notify.json"
bash "$AGENT_LOOP_DIR/agent-loop.sh" status --root "$TMP_DIR" --item "feature-$FEATURE_ID" --json > "$STATUS_AFTER_NOTIFY"
python3 - "$STATUS_AFTER_NOTIFY" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert payload["watch"]["latest_notification_delivery"]["status"] == "delivered"
PY

CANCEL_JSON="$TMP_DIR/cancel-run.json"
bash "$AGENT_LOOP_DIR/agent-loop.sh" configure-runner --root "$TMP_DIR" --runner-name fake --argv-json "[\"python3\",\"$FAKE_RUNNER\",\"cancelled\",\"{repo_root}\",\"{session_brief}\",\"{runner_result}\"]" >/dev/null
set +e
bash "$AGENT_LOOP_DIR/agent-loop.sh" run --root "$TMP_DIR" --item manual-cancel --max-sessions 1 --json > "$CANCEL_JSON"
status=$?
set -e
if [[ "$status" -ne 1 ]]; then
  echo "error: cancelled runner should stop with operator action required" >&2
  exit 1
fi
python3 - "$CANCEL_JSON" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert payload["stop_reason"] == "operator_cancelled"
assert payload["sessions_launched"] == 1
assert payload["host_notification_request"]["severity"] == "warn"
PY

BUDGET_JSON="$TMP_DIR/budget-run.json"
bash "$AGENT_LOOP_DIR/agent-loop.sh" configure-runner --root "$TMP_DIR" --runner-name fake --argv-json "[\"python3\",\"$FAKE_RUNNER\",\"progress\",\"{repo_root}\",\"{session_brief}\",\"{runner_result}\"]" >/dev/null
set +e
bash "$AGENT_LOOP_DIR/agent-loop.sh" run --root "$TMP_DIR" --item manual-budget --max-sessions 1 --json > "$BUDGET_JSON"
status=$?
set -e
if [[ "$status" -ne 1 ]]; then
  echo "error: budget-limited run should stop with operator action required" >&2
  exit 1
fi
python3 - "$BUDGET_JSON" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert payload["stop_reason"] == "session_budget_exhausted"
assert payload["sessions_launched"] == 1
PY

INVALID_JSON="$TMP_DIR/invalid-run.json"
WATCH_JSON="$TMP_DIR/watch.json"
bash "$AGENT_LOOP_DIR/agent-loop.sh" watch --root "$TMP_DIR" --json > "$WATCH_JSON"
python3 - "$WATCH_JSON" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert payload["runner_config_status"] == "ready"
assert payload["run_lock"]["status"] == "idle"
assert payload["decision"]["next_safe_action"] in {"run", "resume_run", "close_item_upstream", "idle", "resolve_blocker", "archive_owned_item"}
assert payload["focus_item"]["item_id"]
assert len(payload["recent_runs"]) >= 1
assert len(payload["recent_sessions"]) >= 1
PY

WATCH_ONCE="$TMP_DIR/watch-once.txt"
bash "$AGENT_LOOP_DIR/agent-loop.sh" watch --root "$TMP_DIR" --once > "$WATCH_ONCE"
python3 - "$WATCH_ONCE" <<'PY'
import sys
from pathlib import Path

text = Path(sys.argv[1]).read_text(encoding="utf-8")
assert "Action" in text
assert "Focus Item" in text
assert "Loop Status" in text
PY

bash "$AGENT_LOOP_DIR/agent-loop.sh" validate --root "$TMP_DIR" >/dev/null

EXIT_JSON="$TMP_DIR/exit-run.json"
bash "$AGENT_LOOP_DIR/agent-loop.sh" configure-runner --root "$TMP_DIR" --runner-name fake --argv-json "[\"python3\",\"-c\",\"import sys; sys.exit(9)\"]" >/dev/null
set +e
bash "$AGENT_LOOP_DIR/agent-loop.sh" run --root "$TMP_DIR" --item manual-exit --max-sessions 1 --json > "$EXIT_JSON"
status=$?
set -e
if [[ "$status" -ne 1 ]]; then
  echo "error: nonzero runner exit should stop with operator action required" >&2
  exit 1
fi
python3 - "$EXIT_JSON" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert payload["stop_reason"] == "session_budget_exhausted"
assert "recovery session" in payload["operator_message"]
PY

RECOVER_JSON="$TMP_DIR/recover-run.json"
bash "$AGENT_LOOP_DIR/agent-loop.sh" configure-runner --root "$TMP_DIR" --runner-name fake --argv-json "[\"python3\",\"$FAKE_RUNNER\",\"recover-once\",\"{repo_root}\",\"{session_brief}\",\"{runner_result}\"]" >/dev/null
bash "$AGENT_LOOP_DIR/agent-loop.sh" run --root "$TMP_DIR" --item manual-recover --max-sessions 2 --json > "$RECOVER_JSON"
python3 - "$RECOVER_JSON" "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
root = Path(sys.argv[2])
assert payload["run_status"] == "terminal"
assert payload["stop_reason"] == "item_archived"
assert payload["sessions_launched"] == 2
assert (root / ".bagakit" / "flow-runner" / "archive" / "manual-recover").is_dir()
PY
python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
sessions_root = root / ".bagakit" / "agent-loop" / "runner-sessions"
matched = []
for session_dir in sorted(sessions_root.iterdir()):
    brief_path = session_dir / "session-brief.json"
    if not brief_path.is_file():
        continue
    payload = json.loads(brief_path.read_text(encoding="utf-8"))
    if payload.get("item", {}).get("item_id") == "manual-recover":
        matched.append(payload)
assert len(matched) == 2
assert "recovery_from" not in matched[0]
assert matched[1]["recovery_from"]["previous_session_id"] == matched[0]["session_id"]
assert matched[1]["recovery_from"]["previous_stop_reason"] == "runner_exited_nonzero"
PY

LAUNCH_JSON="$TMP_DIR/launch-run.json"
bash "$AGENT_LOOP_DIR/agent-loop.sh" configure-runner --root "$TMP_DIR" --runner-name fake --argv-json "[\"definitely-not-a-command\"]" >/dev/null
set +e
bash "$AGENT_LOOP_DIR/agent-loop.sh" run --root "$TMP_DIR" --item manual-launch --max-sessions 1 --json > "$LAUNCH_JSON"
status=$?
set -e
if [[ "$status" -ne 1 ]]; then
  echo "error: launch failure should stop with operator action required" >&2
  exit 1
fi
python3 - "$LAUNCH_JSON" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert payload["stop_reason"] == "session_budget_exhausted"
assert "recovery session" in payload["operator_message"]
PY

TIMEOUT_JSON="$TMP_DIR/timeout-run.json"
bash "$AGENT_LOOP_DIR/agent-loop.sh" configure-runner --root "$TMP_DIR" --runner-name fake --timeout-seconds 1 --argv-json "[\"python3\",\"$FAKE_RUNNER\",\"timeout\",\"{repo_root}\",\"{session_brief}\",\"{runner_result}\"]" >/dev/null
set +e
bash "$AGENT_LOOP_DIR/agent-loop.sh" run --root "$TMP_DIR" --item manual-timeout --max-sessions 1 --json > "$TIMEOUT_JSON"
status=$?
set -e
if [[ "$status" -ne 1 ]]; then
  echo "error: timeout should stop with operator action required" >&2
  exit 1
fi
python3 - "$TIMEOUT_JSON" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert payload["stop_reason"] == "session_budget_exhausted"
assert "recovery session" in payload["operator_message"]
PY

REFRESH_JSON="$TMP_DIR/refresh-run.json"
bash "$AGENT_LOOP_DIR/agent-loop.sh" configure-runner --root "$TMP_DIR" --runner-name fake --argv-json "[\"python3\",\"$FAKE_RUNNER\",\"refresh-break\",\"{repo_root}\",\"{session_brief}\",\"{runner_result}\"]" >/dev/null
set +e
bash "$AGENT_LOOP_DIR/agent-loop.sh" run --root "$TMP_DIR" --item manual-refresh --max-sessions 1 --json > "$REFRESH_JSON"
status=$?
set -e
if [[ "$status" -ne 1 ]]; then
  echo "error: refresh failure should stop with operator action required" >&2
  exit 1
fi
python3 - "$REFRESH_JSON" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert payload["stop_reason"] == "flow_runner_refresh_failed"
PY
mv "$TMP_DIR/skills/harness/bagakit-flow-runner.broken" "$TMP_DIR/skills/harness/bagakit-flow-runner"

MISSING_JSON="$TMP_DIR/missing-run.json"
bash "$AGENT_LOOP_DIR/agent-loop.sh" configure-runner --root "$TMP_DIR" --runner-name fake --argv-json "[\"python3\",\"$FAKE_RUNNER\",\"missing\",\"{repo_root}\",\"{session_brief}\",\"{runner_result}\"]" >/dev/null
set +e
bash "$AGENT_LOOP_DIR/agent-loop.sh" run --root "$TMP_DIR" --item manual-missing --max-sessions 1 --json > "$MISSING_JSON"
status=$?
set -e
if [[ "$status" -ne 1 ]]; then
  echo "error: missing runner result should stop with operator action required" >&2
  exit 1
fi
python3 - "$MISSING_JSON" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert payload["stop_reason"] == "session_budget_exhausted"
assert payload["sessions_launched"] == 1
assert "recovery session" in payload["operator_message"]
PY

bash "$AGENT_LOOP_DIR/agent-loop.sh" configure-runner --root "$TMP_DIR" --runner-name fake --argv-json "[\"python3\",\"$FAKE_RUNNER\",\"invalid\",\"{repo_root}\",\"{session_brief}\",\"{runner_result}\"]" >/dev/null
set +e
bash "$AGENT_LOOP_DIR/agent-loop.sh" run --root "$TMP_DIR" --item manual-invalid --max-sessions 1 --json > "$INVALID_JSON"
status=$?
set -e
if [[ "$status" -ne 1 ]]; then
  echo "error: invalid runner result should stop with operator action required" >&2
  exit 1
fi
python3 - "$INVALID_JSON" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert payload["stop_reason"] == "session_budget_exhausted"
assert payload["sessions_launched"] == 1
assert "recovery session" in payload["operator_message"]
PY

POST_INVALID_WATCH="$TMP_DIR/post-invalid-watch.json"
bash "$AGENT_LOOP_DIR/agent-loop.sh" watch --root "$TMP_DIR" --item manual-invalid --json > "$POST_INVALID_WATCH"
python3 - "$POST_INVALID_WATCH" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert any(session.get("issue") for session in payload["recent_sessions"])
PY

python3 - "$TMP_DIR" <<'PY'
import json
import os
import sys
from pathlib import Path

root = Path(sys.argv[1])
lock_path = root / ".bagakit" / "agent-loop" / "run.lock"
lock_path.write_text(
    json.dumps(
        {
            "schema": "bagakit/agent-loop/run-lock/v1",
            "pid": os.getppid(),
            "created_at": "2026-01-01T00:00:00Z",
            "runner_name": "fake",
        },
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)
PY

LOCK_JSON="$TMP_DIR/lock-run.json"
set +e
bash "$AGENT_LOOP_DIR/agent-loop.sh" run --root "$TMP_DIR" --item manual-locked --max-sessions 1 --json > "$LOCK_JSON"
status=$?
set -e
if [[ "$status" -ne 1 ]]; then
  echo "error: live lock should stop with operator action required" >&2
  exit 1
fi
python3 - "$LOCK_JSON" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert payload["stop_reason"] == "run_lock_conflict"
PY
rm -f "$TMP_DIR/.bagakit/agent-loop/run.lock"

python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
sessions_root = root / ".bagakit" / "agent-loop" / "runner-sessions"
target = None
for session_dir in sorted(sessions_root.iterdir()):
    brief_path = session_dir / "session-brief.json"
    if not brief_path.is_file():
        continue
    payload = json.loads(brief_path.read_text(encoding="utf-8"))
    if payload.get("item", {}).get("item_id") == "manual-invalid":
        target = brief_path
        break
if target is None:
    raise SystemExit("could not find manual-invalid session brief")
target.write_text("oops\n", encoding="utf-8")
PY

CORRUPT_WATCH="$TMP_DIR/corrupt-watch.json"
bash "$AGENT_LOOP_DIR/agent-loop.sh" watch --root "$TMP_DIR" --item manual-invalid --json > "$CORRUPT_WATCH"
python3 - "$CORRUPT_WATCH" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert any(session.get("issue") for session in payload["recent_sessions"])
PY

CORRUPT_VALIDATE="$TMP_DIR/corrupt-validate.json"
set +e
bash "$AGENT_LOOP_DIR/agent-loop.sh" validate --root "$TMP_DIR" --json > "$CORRUPT_VALIDATE"
status=$?
set -e
if [[ "$status" -ne 1 ]]; then
  echo "error: corrupt host exhaust should fail validation" >&2
  exit 1
fi
python3 - "$CORRUPT_VALIDATE" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert any("unreadable" in issue for issue in payload["issues"])
PY

RESUME_TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR" "$RESUME_TMP_DIR"' EXIT

git -C "$RESUME_TMP_DIR" init -q -b main
git -C "$RESUME_TMP_DIR" config user.name "Bagakit"
git -C "$RESUME_TMP_DIR" config user.email "bagakit@example.com"
printf '# resume\n' > "$RESUME_TMP_DIR/README.md"
git -C "$RESUME_TMP_DIR" add README.md
git -C "$RESUME_TMP_DIR" commit -q -m "init"
mkdir -p "$RESUME_TMP_DIR/skills/harness"
ln -s "$FLOW_RUNNER_DIR" "$RESUME_TMP_DIR/skills/harness/bagakit-flow-runner"

bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" apply --root "$RESUME_TMP_DIR" >/dev/null
bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" add-item --root "$RESUME_TMP_DIR" --item-id single-live --title "Single live" --source-kind manual --source-ref manual:single >/dev/null
bash "$AGENT_LOOP_DIR/agent-loop.sh" apply --root "$RESUME_TMP_DIR" >/dev/null
bash "$AGENT_LOOP_DIR/agent-loop.sh" configure-runner --root "$RESUME_TMP_DIR" --runner-name fake --argv-json "[\"python3\",\"$FAKE_RUNNER\",\"{repo_root}\",\"{session_brief}\",\"{runner_result}\"]" >/dev/null

SINGLE_RESUME="$RESUME_TMP_DIR/single-resume.json"
bash "$AGENT_LOOP_DIR/agent-loop.sh" resume --root "$RESUME_TMP_DIR" --max-sessions 1 --json > "$SINGLE_RESUME"
python3 - "$SINGLE_RESUME" "$RESUME_TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
root = Path(sys.argv[2])
assert payload["stop_reason"] == "item_archived"
assert (root / ".bagakit" / "flow-runner" / "archive" / "single-live").is_dir()
PY

EMPTY_RESUME="$RESUME_TMP_DIR/empty-resume.json"
set +e
bash "$AGENT_LOOP_DIR/agent-loop.sh" resume --root "$RESUME_TMP_DIR" --max-sessions 1 --json > "$EMPTY_RESUME"
status=$?
set -e
if [[ "$status" -ne 1 ]]; then
  echo "error: empty resume should stop with operator action required" >&2
  exit 1
fi
python3 - "$EMPTY_RESUME" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert payload["stop_reason"] == "resume_target_required"
assert payload["resume_candidates"]["live"] == []
PY

echo "ok: agent-loop smoke passed"
