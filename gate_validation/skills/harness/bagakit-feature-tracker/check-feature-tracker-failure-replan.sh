#!/usr/bin/env bash
set -euo pipefail
ROOT="."
if [[ "${1:-}" == "--root" ]]; then ROOT="${2:?--root requires a path}"; elif [[ -n "${1:-}" ]]; then ROOT="$1"; fi
ROOT="$(cd "$ROOT" && pwd)"
SKILL_DIR="$ROOT/skills/harness/bagakit-feature-tracker"
LIB_DIR="$ROOT/gate_validation/skills/harness/bagakit-feature-tracker/lib"
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
