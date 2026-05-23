#!/usr/bin/env bash
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
SKILL_DIR="$ROOT/skills/harness/bagakit-feature-tracker"
LIB_DIR="$ROOT/gate_validation/skills/harness/bagakit-feature-tracker/lib"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

source "$LIB_DIR/feature-tracker-testlib.sh"
feature_tracker_init_temp_repo "$TMP_DIR"
bash "$SKILL_DIR/scripts/feature-tracker.sh" check-reference-readiness --root "$TMP_DIR" >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" initialize-tracker --root "$TMP_DIR" >/dev/null

PLAN="$TMP_DIR/reviewed-legacy-upgrade.json"
cat >"$PLAN" <<'JSON'
{
  "schema": "bagakit.feature-task-plan.v1",
  "review": {
    "status": "approved",
    "evidence_ref": "review/legacy-upgrade"
  },
  "source_refs": ["request/legacy-upgrade"],
  "tasks": [
    {
      "id": "T-001",
      "title": "Preserve completed work",
      "objective": "Attach reviewed semantics without rewriting completed execution evidence.",
      "outcome": "The completed task remains attributable in canonical v2 truth.",
      "acceptance": ["The task status and gate evidence remain unchanged."],
      "verification": [
        {
          "kind": "command",
          "ref": "gate_validation/skills/harness/bagakit-feature-tracker/check-feature-tracker-legacy-task-plan-upgrade.sh",
          "proves": "Legacy execution fields survive the public upgrade command."
        }
      ],
      "source_refs": ["request/legacy-upgrade"],
      "supersedes": []
    },
    {
      "id": "T-002",
      "title": "Continue current work",
      "objective": "Attach reviewed semantics while preserving ready or in-progress continuation.",
      "outcome": "The same task identity and lifecycle status continue after upgrade.",
      "acceptance": ["No current task identity or lifecycle status changes."],
      "verification": [
        {
          "kind": "artifact",
          "ref": ".bagakit/feature-tracker/index/features.json",
          "proves": "The tracker remains structurally valid after migration."
        }
      ],
      "source_refs": ["request/legacy-upgrade"],
      "supersedes": []
    }
  ]
}
JSON

downgrade_to_legacy() {
  local feature_id="$1"
  python3 - "$TMP_DIR" "$feature_id" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
feature_id = sys.argv[2]
feature_dir = root / ".bagakit" / "feature-tracker" / "features" / feature_id
tasks_path = feature_dir / "tasks.json"
tasks = json.loads(tasks_path.read_text(encoding="utf-8"))
legacy_tasks = []
for task in tasks["tasks"]:
    legacy_tasks.append(
        {
            "id": task["id"],
            "title": task["title"],
            "summary": task["objective"],
            "status": task["status"],
            "gate_result": task["gate_result"],
            "last_gate_commands": task["last_gate_commands"],
            "last_commit_hash": task["last_commit_hash"],
            "notes": task["notes"],
        }
    )
tasks_path.write_text(
    json.dumps({"version": 1, "feat_id": feature_id, "tasks": legacy_tasks}, indent=2) + "\n",
    encoding="utf-8",
)
(feature_dir / "owner-receipt.json").unlink()
PY
}

bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature \
  --root "$TMP_DIR" \
  --title "Ready legacy upgrade" \
  --goal "Preserve completed and pending legacy task state" \
  --workspace-mode current_tree \
  --tasks-file "$PLAN" >/dev/null
READY_ID="$(feature_tracker_feature_id_by_title "$TMP_DIR" "Ready legacy upgrade")"
feature_tracker_set_non_ui_gate "$TMP_DIR" "true"
bash "$SKILL_DIR/scripts/feature-tracker.sh" start-task \
  --root "$TMP_DIR" --feature "$READY_ID" --task T-001 >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" run-task-gate \
  --root "$TMP_DIR" --feature "$READY_ID" --task T-001 >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" finish-task \
  --root "$TMP_DIR" --feature "$READY_ID" --task T-001 --result done >/dev/null
downgrade_to_legacy "$READY_ID"

if bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" \
  >"$TMP_DIR/ready-before.out" 2>"$TMP_DIR/ready-before.err"; then
  echo "error: ready legacy fixture unexpectedly validated before upgrade" >&2
  exit 1
fi
grep -q "$READY_ID: active feature requires an explicit version 2 reviewed task plan" "$TMP_DIR/ready-before.err"
grep -q "run feature-tracker.sh upgrade-legacy-task-plan" "$TMP_DIR/ready-before.err"

bash "$SKILL_DIR/scripts/feature-tracker.sh" upgrade-legacy-task-plan \
  --root "$TMP_DIR" --feature "$READY_ID" --tasks-file "$PLAN" --expected-revision 0 >/dev/null
python3 - "$TMP_DIR" "$READY_ID" <<'PY'
import json
import sys
from pathlib import Path

feature_dir = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "features" / sys.argv[2]
state = json.loads((feature_dir / "state.json").read_text(encoding="utf-8"))
tasks = json.loads((feature_dir / "tasks.json").read_text(encoding="utf-8"))
by_id = {task["id"]: task for task in tasks["tasks"]}
assert state["status"] == "ready"
assert state["current_task_id"] is None
assert tasks["version"] == 2
assert tasks["plan_status"] == "reviewed"
assert tasks["plan_revision"] == 1
assert tasks["plan_history"][0]["task_ids"] == ["T-001", "T-002"]
assert by_id["T-001"]["status"] == "done"
assert by_id["T-001"]["gate_result"] == "pass"
assert by_id["T-001"]["last_gate_commands"]
assert by_id["T-002"]["status"] == "todo"
assert state["history"][-1]["action"] == "legacy_task_plan_upgraded"
assert (feature_dir / "owner-receipt.json").is_file()
PY
bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/dev/null

bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature \
  --root "$TMP_DIR" \
  --title "Active legacy upgrade" \
  --goal "Preserve one active legacy task without weakening replacement safety" \
  --workspace-mode current_tree \
  --tasks-file "$PLAN" >/dev/null
ACTIVE_ID="$(feature_tracker_feature_id_by_title "$TMP_DIR" "Active legacy upgrade")"
bash "$SKILL_DIR/scripts/feature-tracker.sh" start-task \
  --root "$TMP_DIR" --feature "$ACTIVE_ID" --task T-002 >/dev/null
downgrade_to_legacy "$ACTIVE_ID"

if bash "$SKILL_DIR/scripts/feature-tracker.sh" set-task-plan \
  --root "$TMP_DIR" --feature "$ACTIVE_ID" --tasks-file "$PLAN" --expected-revision 0 \
  >"$TMP_DIR/active-set.out" 2>"$TMP_DIR/active-set.err"; then
  echo "error: ordinary set-task-plan replaced active legacy task truth" >&2
  exit 1
fi
grep -q "task plan cannot be replaced while feature status is in_progress" "$TMP_DIR/active-set.err"

RENAMED_PLAN="$TMP_DIR/renamed-active-plan.json"
python3 - "$PLAN" "$RENAMED_PLAN" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
payload["tasks"][1]["title"] = "Renamed active work"
Path(sys.argv[2]).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
PY
BEFORE_HASH="$(shasum -a 256 "$TMP_DIR/.bagakit/feature-tracker/features/$ACTIVE_ID/state.json" "$TMP_DIR/.bagakit/feature-tracker/features/$ACTIVE_ID/tasks.json")"
if bash "$SKILL_DIR/scripts/feature-tracker.sh" upgrade-legacy-task-plan \
  --root "$TMP_DIR" --feature "$ACTIVE_ID" --tasks-file "$RENAMED_PLAN" --expected-revision 0 \
  >"$TMP_DIR/active-rename.out" 2>"$TMP_DIR/active-rename.err"; then
  echo "error: legacy upgrade accepted an active task rename" >&2
  exit 1
fi
grep -q "cannot rename existing task T-002" "$TMP_DIR/active-rename.err"
AFTER_HASH="$(shasum -a 256 "$TMP_DIR/.bagakit/feature-tracker/features/$ACTIVE_ID/state.json" "$TMP_DIR/.bagakit/feature-tracker/features/$ACTIVE_ID/tasks.json")"
test "$BEFORE_HASH" = "$AFTER_HASH"

bash "$SKILL_DIR/scripts/feature-tracker.sh" upgrade-legacy-task-plan \
  --root "$TMP_DIR" --feature "$ACTIVE_ID" --tasks-file "$PLAN" --expected-revision 0 >/dev/null
python3 - "$TMP_DIR" "$ACTIVE_ID" <<'PY'
import json
import sys
from pathlib import Path

feature_dir = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "features" / sys.argv[2]
state = json.loads((feature_dir / "state.json").read_text(encoding="utf-8"))
tasks = json.loads((feature_dir / "tasks.json").read_text(encoding="utf-8"))
by_id = {task["id"]: task for task in tasks["tasks"]}
assert state["status"] == "in_progress"
assert state["current_task_id"] == "T-002"
assert by_id["T-001"]["status"] == "todo"
assert by_id["T-002"]["status"] == "in_progress"
assert by_id["T-002"]["gate_result"] is None
assert tasks["plan_history"][0]["superseded_task_ids"] == []
PY
bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/dev/null

if bash "$SKILL_DIR/scripts/feature-tracker.sh" set-task-plan \
  --root "$TMP_DIR" --feature "$ACTIVE_ID" --tasks-file "$PLAN" --expected-revision 1 \
  >"$TMP_DIR/v2-active-set.out" 2>"$TMP_DIR/v2-active-set.err"; then
  echo "error: ordinary set-task-plan replaced an active v2 task plan" >&2
  exit 1
fi
grep -q "task plan cannot be replaced while feature status is in_progress" "$TMP_DIR/v2-active-set.err"

if bash "$SKILL_DIR/scripts/feature-tracker.sh" upgrade-legacy-task-plan \
  --root "$TMP_DIR" --feature "$ACTIVE_ID" --tasks-file "$PLAN" --expected-revision 0 \
  >"$TMP_DIR/reupgrade.out" 2>"$TMP_DIR/reupgrade.err"; then
  echo "error: legacy upgrade accepted canonical v2 state" >&2
  exit 1
fi
grep -q "requires otherwise valid pre-v2 feature state" "$TMP_DIR/reupgrade.err"

echo "ok: feature tracker legacy task-plan upgrade passed"
