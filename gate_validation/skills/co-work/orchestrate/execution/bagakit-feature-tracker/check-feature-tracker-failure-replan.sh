#!/usr/bin/env bash
set -euo pipefail
ROOT="."
if [[ "${1:-}" == "--root" ]]; then ROOT="${2:?--root requires a path}"; elif [[ -n "${1:-}" ]]; then ROOT="$1"; fi
ROOT="$(cd "$ROOT" && pwd)"
SKILL_DIR="$ROOT/skills/co-work/orchestrate/execution/bagakit-feature-tracker"
LIB_DIR="$ROOT/gate_validation/skills/co-work/orchestrate/execution/bagakit-feature-tracker/lib"
TMP_DIR="$(mktemp -d)"
trap 'python3 -c "import shutil; shutil.rmtree(\"$TMP_DIR\", ignore_errors=True)"' EXIT
source "$LIB_DIR/feature-tracker-testlib.sh"
feature_tracker_init_temp_repo "$TMP_DIR" >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" initialize-tracker --root "$TMP_DIR" >/dev/null
PLAN="$TMP_DIR/plan.json"
feature_tracker_write_reviewed_task_plan "$PLAN" "Validate the old approach."
bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Failure replan" --slug failure-replan --goal "Replace a disproved approach" --workspace-mode current_tree --tasks-file "$PLAN" >/dev/null
ID="$(feature_tracker_feature_id_by_title "$TMP_DIR" "Failure replan")"
bash "$SKILL_DIR/scripts/feature-tracker.sh" start-task --root "$TMP_DIR" --feature "$ID" --task T-001 >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" finish-task --root "$TMP_DIR" --feature "$ID" --task T-001 --result failed --failure-assumption "old ordering is safe" --failure-reason "multi replica read drift" >"$TMP_DIR/failed.out"
grep -F 'feat_status: replanning' "$TMP_DIR/failed.out" >/dev/null
grep -F 'replan_required_from: T-001' "$TMP_DIR/failed.out" >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" get-owner-receipt --root "$TMP_DIR" --feature "$ID" --json >"$TMP_DIR/receipt.json"
bash "$SKILL_DIR/scripts/feature-tracker.sh" review-task-plan --root "$TMP_DIR" --feature "$ID" --json >"$TMP_DIR/audit.json"
bash "$SKILL_DIR/scripts/feature-tracker.sh" show-feature-status --root "$TMP_DIR" --feature "$ID" --format html >"$TMP_DIR/failed.html"
grep -F 'Failed assumption' "$TMP_DIR/failed.html" >/dev/null
grep -F '待重规划' "$TMP_DIR/failed.html" >/dev/null
grep -F '规划调整' "$TMP_DIR/failed.html" >/dev/null
python3 - "$TMP_DIR/receipt.json" <<'PY'
import json, sys
r=json.load(open(sys.argv[1]))
assert r["lifecycle_status"] == "replanning"
assert r["blockers"][0]["class"] == "replan_required"
PY
python3 - "$TMP_DIR/audit.json" <<'PY'
import json, sys
r=json.load(open(sys.argv[1]))
assert r["replan_required_from"] == ["T-001"]
assert r["review_required"] is True
PY
python3 - "$PLAN" "$TMP_DIR/successor.json" <<'PY'
import json,sys
from pathlib import Path
p=json.loads(Path(sys.argv[1]).read_text())
t=p["tasks"][0]
t.update(id="T-002", title="Use durable ordering", objective="Replace the disproved route.", outcome="The successor is verifiable.", supersedes=["T-001"])
p["review"]["evidence_ref"]="review/failure-successor"
Path(sys.argv[2]).write_text(json.dumps(p))
PY
bash "$SKILL_DIR/scripts/feature-tracker.sh" set-task-plan --root "$TMP_DIR" --feature "$ID" --tasks-file "$TMP_DIR/successor.json" --expected-revision 1 >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" review-task-plan --root "$TMP_DIR" --feature "$ID" --json >"$TMP_DIR/successor-audit.json"
python3 - "$TMP_DIR/successor-audit.json" <<'PY'
import json, sys
audit = json.load(open(sys.argv[1]))
assert audit["review_required"] is False
assert audit["replan_required_from"] == []
assert audit["installed_replacements"][0]["failed_task_id"] == "T-001"
assert audit["installed_replacements"][0]["successors"][0]["task_id"] == "T-002"
PY
bash "$SKILL_DIR/scripts/feature-tracker.sh" show-feature-status --root "$TMP_DIR" --feature "$ID" --format html >"$TMP_DIR/replanned.html"
grep -F '已安装后继计划' "$TMP_DIR/replanned.html" >/dev/null
python3 - "$TMP_DIR/.bagakit/feature-tracker/features/$ID/tasks.json" <<'PY'
import json,sys
x=json.load(open(sys.argv[1])); b={t["id"]:t for t in x["tasks"]}
assert b["T-001"]["status"] == "failed"
assert b["T-001"]["superseded_by"] == ["T-002"]
assert b["T-002"]["supersedes"] == ["T-001"]
PY
echo "ok: failed approach requires explicit reviewed successor"

# A missing execution input does not disprove the Task's outcome or plan.
RETRY_PLAN="$TMP_DIR/retry-plan.json"
python3 - "$PLAN" "$RETRY_PLAN" <<'PY'
import json, sys
from pathlib import Path
payload = json.loads(Path(sys.argv[1]).read_text())
payload["tasks"][0]["verification"][0]["ref"] = "test -f gate-input.txt"
Path(sys.argv[2]).write_text(json.dumps(payload))
PY
bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Execution input retry" --slug execution-input-retry --goal "Recover a missing execution input within the same Task" --workspace-mode current_tree --tasks-file "$RETRY_PLAN" >/dev/null
RETRY_ID="$(feature_tracker_feature_id_by_title "$TMP_DIR" "Execution input retry")"
bash "$SKILL_DIR/scripts/feature-tracker.sh" start-task --root "$TMP_DIR" --feature "$RETRY_ID" --task T-001 >/dev/null
if bash "$SKILL_DIR/scripts/feature-tracker.sh" run-task-gate --root "$TMP_DIR" --feature "$RETRY_ID" --task T-001 >"$TMP_DIR/input-failure.out" 2>"$TMP_DIR/input-failure.err"; then
  echo "error: gate passed without its required execution input" >&2
  exit 1
fi
grep -F 'next_action_kind: repair_task_execution' "$TMP_DIR/input-failure.out" >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" get-feature --root "$TMP_DIR" --feature "$RETRY_ID" >"$TMP_DIR/input-failure.json"
python3 - "$TMP_DIR/input-failure.json" <<'PY'
import json, sys
feature = json.load(open(sys.argv[1]))
task = feature["tasks"]["tasks"][0]
assert task["status"] == "in_progress"
assert task["gate_result"] == "fail"
assert feature["plan_audit"]["review_required"] is False
assert feature["plan_audit"]["replan_required_from"] == []
PY
printf 'ready\n' >"$TMP_DIR/gate-input.txt"
bash "$SKILL_DIR/scripts/feature-tracker.sh" run-task-gate --root "$TMP_DIR" --feature "$RETRY_ID" --task T-001 --rerun --rerun-reason "The missing execution input is now available." >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" finish-task --root "$TMP_DIR" --feature "$RETRY_ID" --task T-001 --result done >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" get-feature --root "$TMP_DIR" --feature "$RETRY_ID" >"$TMP_DIR/input-recovered.json"
python3 - "$TMP_DIR/input-recovered.json" <<'PY'
import json, sys
feature = json.load(open(sys.argv[1]))
assert feature["state"]["status"] == "done"
assert feature["tasks"]["plan_revision"] == 1
assert len(feature["tasks"]["tasks"]) == 1
task = feature["tasks"]["tasks"][0]
assert task["id"] == "T-001" and task["gate_result"] == "pass"
assert task["supersedes"] == []
assert feature["plan_audit"]["delivery_summary"]["remaining"] == []
PY
echo "ok: execution input recovery stays in the same Task and plan revision"

# A reviewed correction to a failed gate command keeps the delivery Task.
COMMAND_PLAN="$TMP_DIR/command-plan.json"
python3 - "$RETRY_PLAN" "$COMMAND_PLAN" <<'PY'
import json, sys
from pathlib import Path
payload = json.loads(Path(sys.argv[1]).read_text())
payload["tasks"][0]["verification"][0]["ref"] = "test -f gate-inpt.txt"
Path(sys.argv[2]).write_text(json.dumps(payload))
PY
bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Command correction" --slug command-correction --goal "Correct an execution command without replacing the delivery Task" --workspace-mode current_tree --tasks-file "$COMMAND_PLAN" >/dev/null
COMMAND_ID="$(feature_tracker_feature_id_by_title "$TMP_DIR" "Command correction")"
bash "$SKILL_DIR/scripts/feature-tracker.sh" start-task --root "$TMP_DIR" --feature "$COMMAND_ID" --task T-001 >/dev/null
if bash "$SKILL_DIR/scripts/feature-tracker.sh" run-task-gate --root "$TMP_DIR" --feature "$COMMAND_ID" --task T-001 >"$TMP_DIR/command-failure.out" 2>"$TMP_DIR/command-failure.err"; then
  echo "error: gate passed with its incorrect input path" >&2
  exit 1
fi
grep -F 'next_action_kind: repair_task_execution' "$TMP_DIR/command-failure.out" >/dev/null
python3 - "$RETRY_PLAN" "$TMP_DIR/invalid-proof-correction.json" <<'PY'
import json, sys
from pathlib import Path
payload = json.loads(Path(sys.argv[1]).read_text())
payload["tasks"][0]["verification"][0]["proves"] = "A different outcome has been substituted."
Path(sys.argv[2]).write_text(json.dumps(payload))
PY
if bash "$SKILL_DIR/scripts/feature-tracker.sh" set-task-plan --root "$TMP_DIR" --feature "$COMMAND_ID" --tasks-file "$TMP_DIR/invalid-proof-correction.json" --expected-revision 1 >"$TMP_DIR/invalid-proof.out" 2>"$TMP_DIR/invalid-proof.err"; then
  echo "error: command correction changed the proof's meaning" >&2
  exit 1
fi
bash "$SKILL_DIR/scripts/feature-tracker.sh" set-task-plan --root "$TMP_DIR" --feature "$COMMAND_ID" --tasks-file "$RETRY_PLAN" --expected-revision 1 >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" get-feature --root "$TMP_DIR" --feature "$COMMAND_ID" >"$TMP_DIR/command-corrected.json"
python3 - "$TMP_DIR/command-corrected.json" <<'PY'
import json, sys
feature = json.load(open(sys.argv[1]))
task = feature["tasks"]["tasks"][0]
assert task["status"] == "in_progress"
assert task["gate_result"] == "fail"
assert task["last_gate_commands"][0]["command"] == "test -f gate-inpt.txt"
assert task["verification"][0]["ref"] == "test -f gate-input.txt"
assert feature["plan_audit"]["review_required"] is False
PY
if bash "$SKILL_DIR/scripts/feature-tracker.sh" finish-task --root "$TMP_DIR" --feature "$COMMAND_ID" --task T-001 --result done >"$TMP_DIR/command-finish-early.out" 2>"$TMP_DIR/command-finish-early.err"; then
  echo "error: corrected command reused a failed gate receipt" >&2
  exit 1
fi
bash "$SKILL_DIR/scripts/feature-tracker.sh" run-task-gate --root "$TMP_DIR" --feature "$COMMAND_ID" --task T-001 >/dev/null
if bash "$SKILL_DIR/scripts/feature-tracker.sh" set-task-plan --root "$TMP_DIR" --feature "$COMMAND_ID" --tasks-file "$COMMAND_PLAN" --expected-revision 2 >"$TMP_DIR/passing-command-rewrite.out" 2>"$TMP_DIR/passing-command-rewrite.err"; then
  echo "error: a passing Task gate allowed its command to be rewritten" >&2
  exit 1
fi
bash "$SKILL_DIR/scripts/feature-tracker.sh" finish-task --root "$TMP_DIR" --feature "$COMMAND_ID" --task T-001 --result done >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" get-feature --root "$TMP_DIR" --feature "$COMMAND_ID" >"$TMP_DIR/command-recovered.json"
python3 - "$TMP_DIR/command-recovered.json" <<'PY'
import json, sys
feature = json.load(open(sys.argv[1]))
assert feature["state"]["status"] == "done"
assert feature["tasks"]["plan_revision"] == 2
assert len(feature["tasks"]["tasks"]) == 1
task = feature["tasks"]["tasks"][0]
assert task["id"] == "T-001" and task["gate_result"] == "pass"
assert task["supersedes"] == []
PY
bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/dev/null
echo "ok: reviewed command correction preserves Task identity and requires fresh proof"
