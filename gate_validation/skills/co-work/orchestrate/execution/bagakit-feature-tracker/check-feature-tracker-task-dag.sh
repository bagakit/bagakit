set -euo pipefail

ROOT="."
while [[ $# -gt 0 ]]; do
  case "$1" in
    --root) ROOT="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$ROOT" && pwd)"
SKILL_DIR="$ROOT/skills/co-work/orchestrate/execution/bagakit-feature-tracker"
LIB_DIR="$ROOT/gate_validation/skills/co-work/orchestrate/execution/bagakit-feature-tracker/lib"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
source "$LIB_DIR/feature-tracker-testlib.sh"

feature_tracker_init_temp_repo "$TMP_DIR"
bash "$SKILL_DIR/scripts/feature-tracker.sh" initialize-tracker --root "$TMP_DIR" >/dev/null
PLAN="$TMP_DIR/task-dag-plan.json"
cat >"$PLAN" <<'JSON'
{
  "schema": "bagakit.feature-task-plan.v1",
  "review": {"status": "approved", "evidence_ref": "review/task-dag"},
  "source_refs": ["decision/task-dag"],
  "tasks": [
    {
      "id": "T-003",
      "depends_on": ["T-002", "T-001"],
      "title": "采集侧自适应 QPS:熔断 + 半开 + 爬升",
      "objective": "Integrate and verify the two independent outcomes.",
      "outcome": "The Feature closes over both branch results.",
      "acceptance": ["Both predecessor Tasks are done before integration starts."],
      "verification": [{"kind": "command", "ref": "true", "proves": "The integrated repository remains valid."}],
      "source_refs": ["decision/task-dag"],
      "supersedes": []
    },
    {
      "id": "T-002",
      "title": "Build branch two",
      "objective": "Close the second independent outcome.",
      "outcome": "Branch two is integrated and verified.",
      "acceptance": ["Branch two passes its Task gate."],
      "verification": [{"kind": "command", "ref": "true", "proves": "Branch two remains repository-valid."}],
      "source_refs": ["decision/task-dag"],
      "supersedes": []
    },
    {
      "id": "T-001",
      "depends_on": [],
      "title": "Build branch one",
      "objective": "Close the first independent outcome.",
      "outcome": "Branch one is integrated and verified.",
      "acceptance": ["Branch one passes its Task gate."],
      "verification": [{"kind": "command", "ref": "true", "proves": "Branch one remains repository-valid."}],
      "source_refs": ["decision/task-dag"],
      "supersedes": []
    }
  ]
}
JSON

bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature \
  --root "$TMP_DIR" --title "Task DAG feature" --slug "task-dag-feature" \
  --goal "Run independent Tasks in parallel and converge explicitly" \
  --workspace-mode current_tree --tasks-file "$PLAN" >/dev/null
FEATURE_ID="$(feature_tracker_feature_id_by_title "$TMP_DIR" "Task DAG feature")"
FEATURE_DIR="$TMP_DIR/.bagakit/feature-tracker/features/$FEATURE_ID"

# Ordinary dependency waiting remains visible without demanding replanning.
python3 - "$FEATURE_DIR" "$TMP_DIR/audit-before.json" <<'PY'
import hashlib, json, sys
from pathlib import Path
root = Path(sys.argv[1]).parents[1]
snapshot = {str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in root.rglob("*.json")}
Path(sys.argv[2]).write_text(json.dumps(snapshot))
PY
bash "$SKILL_DIR/scripts/feature-tracker.sh" review-task-plan \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --json >"$TMP_DIR/plan-audit.json"
bash "$SKILL_DIR/scripts/feature-tracker.sh" review-task-plan \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --json >"$TMP_DIR/plan-audit-repeat.json"
python3 - "$TMP_DIR/plan-audit.json" "$TMP_DIR/plan-audit-repeat.json" "$FEATURE_DIR" "$TMP_DIR/audit-before.json" <<'PY'
import hashlib, json, sys
from pathlib import Path
audit = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert audit == json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
root = Path(sys.argv[3]).parents[1]
assert json.loads(Path(sys.argv[4]).read_text()) == {
    str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest()
    for path in root.rglob("*.json")
}
assert audit["review_required"] is False
assert {(edge["from"], edge["to"], edge["decision"]) for edge in audit["waiting_edges"]} == {
    ("T-001", "T-003", "waiting"), ("T-002", "T-003", "waiting")
}
assert audit["parallelism_review"]["runnable_now"] == ["T-001", "T-002"]
assert audit["parallelism_review"]["wave_semantics"] == "dependency_depth_not_dispatch_barrier"
assert "split_early_evidence_and_final_join" in audit["parallelism_review"]["edge_dispositions"]
assert all(edge["target_verification"] for edge in audit["waiting_edges"])
assert audit["delivery_summary"]["goal"] == "Run independent Tasks in parallel and converge explicitly"
assert {item["task_id"]: item["outcome"] for item in audit["delivery_summary"]["remaining"]} == {
    "T-001": "Branch one is integrated and verified.",
    "T-002": "Branch two is integrated and verified.",
    "T-003": "The Feature closes over both branch results.",
}
assert all(item["acceptance"] for item in audit["delivery_summary"]["remaining"])
PY
echo "ok: repeated audit preserves planning truth and exposes normal waiting"

# A mid-run review may widen the frontier without stopping useful active work.
# The active Task set and its semantics must survive unchanged; only the
# not-yet-started join is redrawn as an independent root.
MIDRUN_PLAN="$TMP_DIR/midrun-task-dag-plan.json"
python3 - "$PLAN" "$MIDRUN_PLAN" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
payload["review"]["evidence_ref"] = "review/task-dag-midrun"
for task in payload["tasks"]:
    if task["id"] == "T-003":
        task["depends_on"] = []
Path(sys.argv[2]).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
PY
bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature \
  --root "$TMP_DIR" --title "Mid-run replan feature" --slug "mid-run-replan-feature" \
  --goal "Widen the runnable frontier while active Tasks continue" \
  --workspace-mode current_tree --tasks-file "$PLAN" >/dev/null
MIDRUN_ID="$(feature_tracker_feature_id_by_title "$TMP_DIR" "Mid-run replan feature")"
bash "$SKILL_DIR/scripts/feature-tracker.sh" start-task \
  --root "$TMP_DIR" --feature "$MIDRUN_ID" --task T-001 >/dev/null &
MIDRUN_START_ONE_PID=$!
bash "$SKILL_DIR/scripts/feature-tracker.sh" start-task \
  --root "$TMP_DIR" --feature "$MIDRUN_ID" --task T-002 >/dev/null &
MIDRUN_START_TWO_PID=$!
wait "$MIDRUN_START_ONE_PID"
wait "$MIDRUN_START_TWO_PID"
bash "$SKILL_DIR/scripts/feature-tracker.sh" review-task-plan \
  --root "$TMP_DIR" --feature "$MIDRUN_ID" --json >"$TMP_DIR/active-audit.json"
python3 - "$TMP_DIR/active-audit.json" <<'PY'
import json, sys
from pathlib import Path
audit = json.loads(Path(sys.argv[1]).read_text())
assert audit["review_required"] is False
assert len(audit["waiting_edges"]) == 2
assert all(edge["decision"] == "waiting" and edge["source_status"] == "in_progress"
           for edge in audit["waiting_edges"])
PY
# A revision of another Task must not invalidate either active Task's proof.
for task in T-001 T-002; do
  bash "$SKILL_DIR/scripts/feature-tracker.sh" run-task-gate \
    --root "$TMP_DIR" --feature "$MIDRUN_ID" --task "$task" >/dev/null
done
bash "$SKILL_DIR/scripts/feature-tracker.sh" set-task-plan \
  --root "$TMP_DIR" --feature "$MIDRUN_ID" --tasks-file "$MIDRUN_PLAN" \
  --expected-revision 1 >"$TMP_DIR/midrun-plan.out"
grep -F "dependency_removed: T-001 -> T-003" "$TMP_DIR/midrun-plan.out" >/dev/null
grep -F "dependency_removed: T-002 -> T-003" "$TMP_DIR/midrun-plan.out" >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" get-feature \
  --root "$TMP_DIR" --feature "$MIDRUN_ID" >"$TMP_DIR/midrun-replanned.json"
python3 - "$TMP_DIR/midrun-replanned.json" <<'PY'
import json
import sys
from pathlib import Path

feature = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert feature["state"]["status"] == "in_progress"
assert feature["state"]["status"] != "replanning"
assert feature["task_frontier"] == {
    "active": ["T-001", "T-002"], "runnable": ["T-003"], "blocked": [],
    "cancelled": [], "transferred": [], "failed": [], "waiting": [], "done": [],
}
assert feature["tasks"]["plan_revision"] == 2
by_id = {task["id"]: task for task in feature["tasks"]["tasks"]}
assert by_id["T-001"]["status"] == "in_progress"
assert by_id["T-002"]["status"] == "in_progress"
assert by_id["T-003"]["depends_on"] == []
PY
INVALID_MIDRUN_PLAN="$TMP_DIR/invalid-midrun-task-dag-plan.json"
python3 - "$MIDRUN_PLAN" "$INVALID_MIDRUN_PLAN" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
for task in payload["tasks"]:
    if task["id"] == "T-001":
        task["title"] = "Attempt to rewrite an active Task"
Path(sys.argv[2]).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
PY
if bash "$SKILL_DIR/scripts/feature-tracker.sh" set-task-plan \
  --root "$TMP_DIR" --feature "$MIDRUN_ID" --tasks-file "$INVALID_MIDRUN_PLAN" \
  --expected-revision 2 >"$TMP_DIR/invalid-midrun.out" 2>"$TMP_DIR/invalid-midrun.err"; then
  echo "error: mid-run revision rewrote an active Task" >&2
  exit 1
fi
grep -F "executed task semantics are immutable across plan revisions: T-001 changed title" \
  "$TMP_DIR/invalid-midrun.err" >/dev/null
echo "ok: mid-run revision rejects active Task semantic drift"
bash "$SKILL_DIR/scripts/feature-tracker.sh" finish-task \
  --root "$TMP_DIR" --feature "$MIDRUN_ID" --task T-001 --result done >/dev/null
python3 - "$MIDRUN_PLAN" "$TMP_DIR/second-midrun-plan.json" <<'PY'
import json, sys
from pathlib import Path
payload = json.loads(Path(sys.argv[1]).read_text())
payload["review"]["evidence_ref"] = "review/task-dag-second-midrun"
for task in payload["tasks"]:
    if task["id"] == "T-003":
        task["title"] = "Deliver independent branch three"
Path(sys.argv[2]).write_text(json.dumps(payload))
PY
bash "$SKILL_DIR/scripts/feature-tracker.sh" set-task-plan \
  --root "$TMP_DIR" --feature "$MIDRUN_ID" --tasks-file "$TMP_DIR/second-midrun-plan.json" \
  --expected-revision 2 >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" get-feature \
  --root "$TMP_DIR" --feature "$MIDRUN_ID" >"$TMP_DIR/before-gate-reuse.json"
bash "$SKILL_DIR/scripts/feature-tracker.sh" run-task-gate \
  --root "$TMP_DIR" --feature "$MIDRUN_ID" --task T-002 >"$TMP_DIR/gate-reuse.out"
grep -F "ok: gate reused" "$TMP_DIR/gate-reuse.out" >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" get-feature \
  --root "$TMP_DIR" --feature "$MIDRUN_ID" >"$TMP_DIR/after-gate-reuse.json"
python3 - "$TMP_DIR/before-gate-reuse.json" "$TMP_DIR/after-gate-reuse.json" <<'PY'
import json, sys
from pathlib import Path
before, after = [json.loads(Path(path).read_text()) for path in sys.argv[1:]]
assert before == after
assert after["tasks"]["plan_revision"] == 3
assert {item["task_id"] for item in after["plan_audit"]["delivery_summary"]["remaining"]} == {"T-002", "T-003"}
PY
bash "$SKILL_DIR/scripts/feature-tracker.sh" finish-task \
  --root "$TMP_DIR" --feature "$MIDRUN_ID" --task T-002 --result done >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/dev/null
echo "ok: unrelated plan revisions preserve direct finish and passing gate reuse"

SERVER_OUT="$TMP_DIR/status-server.out"
bash "$SKILL_DIR/scripts/feature-tracker.sh" serve-feature-status \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --port 0 --refresh-ms 1000 \
  >"$SERVER_OUT" 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 30); do
  grep -q '^status_server: http://' "$SERVER_OUT" && break
  sleep 0.1
done
SERVER_URL="$(sed -n '1s/^status_server: //p' "$SERVER_OUT")"
test -n "$SERVER_URL"
python3 - "$SERVER_URL" <<'PY'
import sys
from urllib.request import urlopen

with urlopen(sys.argv[1], timeout=5) as response:
    body = response.read().decode("utf-8")
    assert response.status == 200
    assert "Live read-only view" in body
    assert "fetch(window.location.pathname + window.location.search" in body
    assert 'id="refresh-indicator"' in body
    assert 'window.__bagakitBindTopologyControls' in body
    # UI-build changes reload once; ordinary polling preserves the same build.
    import re
    ui_revision = re.search(r'data-ui-revision="([^"]+)"', body).group(1)
    with urlopen(sys.argv[1], timeout=5) as unchanged:
        next_body = unchanged.read().decode("utf-8")
    assert re.search(r'data-ui-revision="([^"]+)"', next_body).group(1) == ui_revision
    assert "Task topology" in body
    assert "captureTopologyViews" in body
    assert "restoreTopologyViews" in body
    assert "captureBoardScroll" in body
    assert "restoreBoardScroll" in body
    assert "captureTaskDisclosure" in body
    assert "restoreTaskDisclosure" in body
    assert "window.__bagakitFocusFeature(nextContent, false)" in body
    assert "scrollLeft" in body
print("ok: live status server")
PY
kill "$SERVER_PID"
wait "$SERVER_PID" 2>/dev/null || true

bash "$SKILL_DIR/scripts/feature-tracker.sh" show-feature-status \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --format html >"$TMP_DIR/task-topology.html"
python3 - "$TMP_DIR/task-topology.html" "$FEATURE_ID" <<'PY'
import sys
from pathlib import Path

html = Path(sys.argv[1]).read_text(encoding="utf-8")
feature_id = sys.argv[2]
assert "Task topology" in html
assert "data-topology-model" in html
assert 'data-task-id="T-001"' in html
assert 'data-task-id="T-002"' in html
assert 'data-task-id="T-003"' in html
import html as html_lib
import re
import json
model = json.loads(html_lib.unescape(re.search(r'<template data-topology-model>(.*?)</template>', html, re.S).group(1)))
assert {("T-001", "T-003"), ("T-002", "T-003")} <= {(e["from"], e["to"]) for e in model["edges"]}

assert "采集侧自适应 QPS:熔断 + 半开 + 爬升" in html
assert '<text class="topology-node-title"' in html
assert html.count("<tspan") >= 2
assert 'data-topology-zoom="out"' in html
assert 'data-topology-zoom="in"' in html
assert 'data-topology-zoom="fit"' in html
assert 'data-topology-zoom="overview"' in html
assert 'data-task-dependency-summary=' in html
assert 'data-task-evidence-summary=' in html
assert 'data-topology-zoom-level' in html
assert "Task runtime status" in html
assert "Gate pending" in html
assert "deps 0/2" in html
assert "waiting on T-001, T-002" in html
assert "eligible W02" in html
assert f'id="{feature_id}-task-T-003"' in html
assert f'href="#{feature_id}-task-T-003"' in html
assert 'class="review-task-summary"' in html
assert 'class="review-task-toggle"' in html
assert 'class="review-task-fold-note"' in html
assert 'class="review-tasks-scroll"' in html
assert 'class="task-quick-prompts"' in html
assert '<section class="task-quick-prompts"' in html
assert '<section class="tracker-quick-prompts"' in html
assert 'class="prompt-copy-action"' in html
for label in ("复制 · 认领任务", "复制 · 检查状态", "复制 · Explain Task", "复制 · Goal 语句", "复制 · 设置 Goal", "复制 · 解释全计划"):
    assert label in html
for source in ('claim', 'status', 'explain', 'goal', 'set_goal', 'plan'):
    assert f'data-prompt-source="{source}"' in html
assert 'data-prompt-copy="claim"' in html
assert 'async function copyPromptAction' in html
assert 'navigator.clipboard.writeText(text)' in html
assert 'class="prompt-copy-status"' in html
assert 'class="file-preview-trigger"' in html
assert 'id="file-preview-dialog"' in html
assert 'data-preview-language="json"' in html
assert 'highlightPreview' in html
assert 'syntax-key' in html
assert 'window.__bagakitFocusHistoryFeature' in html
assert 'data-task-jump-status' in html
assert 'data-target-task-id' not in html
assert 'data-wave="W01"' in html
assert 'class="topology-wave-marker"' in html
assert 'class="topology-node-card"' in html
assert 'class="topology-node-status-bg"' in html
assert 'class="topology-node-stats"' in html
assert 'gate 0/1' in html
assert 'is-targeted' in html
PY

python3 - "$FEATURE_DIR/tasks.json" <<'PY'
import json, sys
from pathlib import Path
tasks = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
by_id = {task["id"]: task for task in tasks["tasks"]}
assert by_id["T-001"]["depends_on"] == []
assert by_id["T-002"]["depends_on"] == []
assert by_id["T-003"]["depends_on"] == ["T-001", "T-002"]
PY

if bash "$SKILL_DIR/scripts/feature-tracker.sh" start-task \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --task T-003 \
  >"$TMP_DIR/join-early.out" 2>"$TMP_DIR/join-early.err"; then
  echo "error: join Task started before its dependencies" >&2
  exit 1
fi
grep -F "unfinished dependencies: T-001, T-002" "$TMP_DIR/join-early.err" >/dev/null

bash "$SKILL_DIR/scripts/feature-tracker.sh" start-task \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --task T-001 >/dev/null &
START_ONE_PID=$!
bash "$SKILL_DIR/scripts/feature-tracker.sh" start-task \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --task T-002 >/dev/null &
START_TWO_PID=$!
wait "$START_ONE_PID"
wait "$START_TWO_PID"

# Flow Runner progress is an optional read-only overlay. Bind one receipt to
# the exact Task so the projection can show activity without changing Tracker
# state or inventing a second progress store.
FLOW_RUNNER_DIR="$ROOT/skills/co-work/orchestrate/execution/bagakit-flow-runner"
bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" apply --root "$TMP_DIR" >/dev/null
bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" activate-feature-tracker \
  --root "$TMP_DIR" --feature "$FEATURE_ID" >/dev/null
bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" checkpoint \
  --root "$TMP_DIR" --item "feature-$FEATURE_ID" --stage inspect \
  --session-status progress --objective "Inspect branch one" \
  --attempted "Read the current implementation" --result "Progress recorded" \
  --next-action "Continue Task T-001" --clean-state yes --task-ref T-001 >/dev/null
bash "$FLOW_RUNNER_DIR/scripts/flow-runner.sh" checkpoint \
  --root "$TMP_DIR" --item "feature-$FEATURE_ID" --stage inspect \
  --session-status progress --objective "Inspect branch two" \
  --attempted "Read the second implementation" --result "Second progress recorded" \
  --next-action "Continue Task T-002" --clean-state yes --task-ref T-002 >/dev/null

bash "$SKILL_DIR/scripts/feature-tracker.sh" show-feature-status \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --format html >"$TMP_DIR/progress-overlay.html"
python3 - "$TMP_DIR/progress-overlay.html" <<'PY'
import sys
from pathlib import Path

html = Path(sys.argv[1]).read_text(encoding="utf-8")
assert "Execution update" in html
assert "<strong>Task T-001</strong>" in html
assert "Progress recorded" in html
assert "Continue Task T-001" in html
assert "<strong>Task T-002</strong>" in html
assert "Second progress recorded" in html
assert "Continue Task T-002" in html
assert "informational only; it does not change Task state or gate evidence" in html
assert "flow-runner/items/feature-" in html
assert "runtime-activity-ref" in html
assert "file://" not in html
PY

bash "$SKILL_DIR/scripts/feature-tracker.sh" get-feature \
  --root "$TMP_DIR" --feature "$FEATURE_ID" >"$TMP_DIR/active.json"
bash "$SKILL_DIR/scripts/feature-tracker.sh" get-owner-receipt \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --json >"$TMP_DIR/active-receipt.json"
python3 - "$TMP_DIR/active.json" "$TMP_DIR/active-receipt.json" <<'PY'
import json, sys
from pathlib import Path
feature = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
receipt = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
state = feature["state"]
assert state["status"] == "in_progress"
assert "current_task_id" not in state
assert "blocked_reason_class" not in state
assert feature["task_frontier"] == {
    "active": ["T-001", "T-002"], "runnable": [], "blocked": [],
    "cancelled": [],
    "transferred": [],
    "failed": [],
    "waiting": ["T-003"], "done": [],
}
assert receipt["schema"] == "bagakit.execution-owner-receipt.v2"
assert receipt["active_item_ids"] == ["T-001", "T-002"]
assert receipt["blockers"] == []
PY

if bash "$SKILL_DIR/scripts/feature-tracker.sh" closeout-feature \
  --root "$TMP_DIR" --feature "$FEATURE_ID" \
  >"$TMP_DIR/ambiguous-closeout.out" 2>"$TMP_DIR/ambiguous-closeout.err"; then
  echo "error: closeout selected one of multiple active Tasks implicitly" >&2
  exit 1
fi
grep -F -- "--task is required when multiple Tasks are active" \
  "$TMP_DIR/ambiguous-closeout.err" >/dev/null
grep -F -- "--task T-001" "$TMP_DIR/ambiguous-closeout.out" >/dev/null
grep -F -- "--task T-002" "$TMP_DIR/ambiguous-closeout.out" >/dev/null

bash "$SKILL_DIR/scripts/feature-tracker.sh" run-task-gate \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --task T-001 >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" finish-task \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --task T-001 --result blocked \
  --blocked-reason-class external_blocker \
  --blocked-reason "branch one awaits an external input" >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" get-feature \
  --root "$TMP_DIR" --feature "$FEATURE_ID" >"$TMP_DIR/partially-blocked.json"
python3 - "$TMP_DIR/partially-blocked.json" <<'PY'
import json, sys
from pathlib import Path
feature = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert feature["state"]["status"] == "in_progress"
assert feature["task_frontier"]["active"] == ["T-002"]
assert feature["task_frontier"]["blocked"] == ["T-001"]
assert feature["task_frontier"]["waiting"] == ["T-003"]
audit = feature["plan_audit"]
assert audit["review_required"] is False
assert any(edge["from"] == "T-001" and edge["source_status"] == "blocked"
           and edge["decision"] == "waiting" for edge in audit["waiting_edges"])
assert audit["replan_required_from"] == []
PY

bash "$SKILL_DIR/scripts/feature-tracker.sh" run-task-gate \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --task T-002 >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" finish-task \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --task T-002 --result done >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" get-owner-receipt \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --json >"$TMP_DIR/stalled-receipt.json"
python3 - "$FEATURE_DIR/state.json" "$TMP_DIR/stalled-receipt.json" <<'PY'
import json, sys
from pathlib import Path
state = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
receipt = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
assert state["status"] == "blocked"
assert receipt["continuation"] == "blocked"
assert receipt["active_item_ids"] == []
assert receipt["blockers"] == [{
    "item_id": "T-001", "class": "external_blocker",
    "reason": "branch one awaits an external input",
}]
PY

bash "$SKILL_DIR/scripts/feature-tracker.sh" start-task \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --task T-001 >/dev/null
if bash "$SKILL_DIR/scripts/feature-tracker.sh" finish-task \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --task T-001 --result done \
  >"$TMP_DIR/stale-gate.out" 2>"$TMP_DIR/stale-gate.err"; then
  echo "error: restarted blocked Task reused a stale passing gate" >&2
  exit 1
fi
grep -F "cannot finish task as done without gate pass" "$TMP_DIR/stale-gate.err" >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" run-task-gate \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --task T-001 >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" finish-task \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --task T-001 --result done >/dev/null

bash "$SKILL_DIR/scripts/feature-tracker.sh" get-feature \
  --root "$TMP_DIR" --feature "$FEATURE_ID" >"$TMP_DIR/join-ready.json"
python3 - "$TMP_DIR/join-ready.json" <<'PY'
import json, sys
from pathlib import Path
feature = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert feature["state"]["status"] == "ready"
assert feature["task_frontier"]["runnable"] == ["T-003"]
assert feature["task_frontier"]["done"] == ["T-001", "T-002"]
PY

bash "$SKILL_DIR/scripts/feature-tracker.sh" start-task \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --task T-003 >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" run-task-gate \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --task T-003 >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" finish-task \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --task T-003 --result done >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/dev/null
python3 - "$FEATURE_DIR/state.json" <<'PY'
import json, sys
from pathlib import Path
assert json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))["status"] == "done"
PY

CYCLE_PLAN="$TMP_DIR/cycle-plan.json"
cat >"$CYCLE_PLAN" <<'JSON'
{
  "schema": "bagakit.feature-task-plan.v1",
  "review": {"status": "approved", "evidence_ref": "review/cycle"},
  "source_refs": ["decision/cycle"],
  "tasks": [
    {
      "id": "T-001", "depends_on": ["T-002"], "title": "Cycle one",
      "objective": "Prove cycle rejection.", "outcome": "The plan is rejected.",
      "acceptance": ["Cycle is rejected."],
      "verification": [{"kind": "command", "ref": "true", "proves": "The reviewed Task gate has an executable proof."}, {"kind": "artifact", "ref": "tasks.json", "proves": "No cyclic plan is stored."}],
      "source_refs": ["decision/cycle"], "supersedes": []
    },
    {
      "id": "T-002", "depends_on": ["T-001"], "title": "Cycle two",
      "objective": "Complete the invalid cycle.", "outcome": "The plan is rejected.",
      "acceptance": ["Cycle is rejected."],
      "verification": [{"kind": "command", "ref": "true", "proves": "The reviewed Task gate has an executable proof."}, {"kind": "artifact", "ref": "tasks.json", "proves": "No cyclic plan is stored."}],
      "source_refs": ["decision/cycle"], "supersedes": []
    }
  ]
}
JSON

bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature \
  --root "$TMP_DIR" --title "Cycle proposal" --slug "cycle-proposal" \
  --goal "Reject a cyclic Task plan" --workspace-mode proposal_only >/dev/null
CYCLE_ID="$(feature_tracker_feature_id_by_title "$TMP_DIR" "Cycle proposal")"
CYCLE_TASKS="$TMP_DIR/.bagakit/feature-tracker/features/$CYCLE_ID/tasks.json"
CYCLE_TASKS_SHA="$(shasum "$CYCLE_TASKS" | awk '{print $1}')"
UNKNOWN_PLAN="$TMP_DIR/unknown-dependency-plan.json"
python3 - "$CYCLE_PLAN" "$UNKNOWN_PLAN" <<'PY'
import json, sys
from pathlib import Path
payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
payload["tasks"][0]["depends_on"] = ["T-999"]
payload["tasks"][1]["depends_on"] = []
Path(sys.argv[2]).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
PY
if bash "$SKILL_DIR/scripts/feature-tracker.sh" set-task-plan \
  --root "$TMP_DIR" --feature "$CYCLE_ID" --tasks-file "$UNKNOWN_PLAN" \
  --expected-revision 0 >"$TMP_DIR/unknown.out" 2>"$TMP_DIR/unknown.err"; then
  echo "error: unknown Task dependency was accepted" >&2
  exit 1
fi
grep -F "T-999" "$TMP_DIR/unknown.err" >/dev/null
test "$CYCLE_TASKS_SHA" = "$(shasum "$CYCLE_TASKS" | awk '{print $1}')"

if bash "$SKILL_DIR/scripts/feature-tracker.sh" set-task-plan \
  --root "$TMP_DIR" --feature "$CYCLE_ID" --tasks-file "$CYCLE_PLAN" \
  --expected-revision 0 >"$TMP_DIR/cycle.out" 2>"$TMP_DIR/cycle.err"; then
  echo "error: cyclic Task plan was accepted" >&2
  exit 1
fi
grep -F "cycle" "$TMP_DIR/cycle.err" >/dev/null
test "$CYCLE_TASKS_SHA" = "$(shasum "$CYCLE_TASKS" | awk '{print $1}')"

REPLAN_PLAN="$TMP_DIR/replan-plan.json"
cat >"$REPLAN_PLAN" <<'JSON'
{
  "schema": "bagakit.feature-task-plan.v1",
  "review": {"status": "approved", "evidence_ref": "review/replanning"},
  "source_refs": ["decision/replanning"],
  "tasks": [
    {
      "id": "T-001", "depends_on": [], "title": "Retire the old execution route",
      "objective": "Stop the obsolete route while preserving its execution history.",
      "outcome": "The obsolete route is cancelled without pretending it passed.",
      "acceptance": ["The old route is explicitly cancelled."],
      "verification": [{"kind": "command", "ref": "true", "proves": "The cancellation transition has an executable proof."}],
      "source_refs": ["decision/replanning"], "supersedes": []
    },
    {
      "id": "T-002", "depends_on": ["T-001"], "title": "Continue the downstream route",
      "objective": "Keep the downstream route waiting for a reviewed successor.",
      "outcome": "The downstream route is not released by cancellation alone.",
      "acceptance": ["The downstream route remains waiting."],
      "verification": [{"kind": "command", "ref": "true", "proves": "The downstream waiting state has an executable proof."}],
      "source_refs": ["decision/replanning"], "supersedes": []
    }
  ]
}
JSON
bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature \
  --root "$TMP_DIR" --title "Replanning fixture" --slug "replanning-fixture" \
  --goal "Separate cancellation from real blockers" --workspace-mode current_tree \
  --tasks-file "$REPLAN_PLAN" >/dev/null
REPLAN_ID="$(feature_tracker_feature_id_by_title "$TMP_DIR" "Replanning fixture")"
bash "$SKILL_DIR/scripts/feature-tracker.sh" start-task --root "$TMP_DIR" --feature "$REPLAN_ID" --task T-001 >/dev/null
if bash "$SKILL_DIR/scripts/feature-tracker.sh" finish-task --root "$TMP_DIR" --feature "$REPLAN_ID" --task T-001 --result cancelled >"$TMP_DIR/cancel-missing.out" 2>"$TMP_DIR/cancel-missing.err"; then
  echo "error: cancellation without a reason was accepted" >&2
  exit 1
fi
grep -F -- "--cancel-reason is required" "$TMP_DIR/cancel-missing.err" >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" finish-task --root "$TMP_DIR" --feature "$REPLAN_ID" --task T-001 --result cancelled --cancel-reason "superseded by reviewed successor" >"$TMP_DIR/cancel.out"
grep -F -- "feat_status: replanning" "$TMP_DIR/cancel.out" >/dev/null
grep -F -- "next_action_kind: revise_task_plan" "$TMP_DIR/cancel.out" >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" get-feature --root "$TMP_DIR" --feature "$REPLAN_ID" >"$TMP_DIR/replan-feature.json"
python3 - "$TMP_DIR/replan-feature.json" <<'PY'
import json, sys
from pathlib import Path
feature = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert feature["state"]["status"] == "replanning"
assert feature["task_frontier"]["cancelled"] == ["T-001"]
assert feature["task_frontier"]["waiting"] == ["T-002"]
assert feature["task_frontier"]["blocked"] == []
audit = feature["plan_audit"]
assert audit["review_required"] is True
assert audit["replan_required_from"] == ["T-001"]
assert [(edge["from"], edge["to"], edge["decision"]) for edge in audit["waiting_edges"]] == [
    ("T-001", "T-002", "replan_required")
]
PY
bash "$SKILL_DIR/scripts/feature-tracker.sh" get-owner-receipt --root "$TMP_DIR" --feature "$REPLAN_ID" --json >"$TMP_DIR/replan-receipt.json"
python3 - "$TMP_DIR/replan-receipt.json" <<'PY'
import json, sys
from pathlib import Path
receipt = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert receipt["continuation"] == "blocked"
assert receipt["blockers"] == [{"item_id": None, "class": "replan_required", "reason": "A current Task was cancelled; install the reviewed successor plan before continuing."}]
PY

echo "ok: cancellation is distinct from execution blocking"

python3 - "$REPLAN_PLAN" "$TMP_DIR/cancel-successor-plan.json" <<'PY'
import json, sys
from pathlib import Path
payload = json.loads(Path(sys.argv[1]).read_text())
payload["review"]["evidence_ref"] = "review/cancellation-successor"
payload["tasks"][0].update(id="T-003", title="Deliver the replacement route", supersedes=["T-001"])
payload["tasks"][1]["depends_on"] = ["T-003"]
Path(sys.argv[2]).write_text(json.dumps(payload))
PY
bash "$SKILL_DIR/scripts/feature-tracker.sh" set-task-plan \
  --root "$TMP_DIR" --feature "$REPLAN_ID" --tasks-file "$TMP_DIR/cancel-successor-plan.json" \
  --expected-revision 1 >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" review-task-plan \
  --root "$TMP_DIR" --feature "$REPLAN_ID" --json >"$TMP_DIR/cancel-successor-audit.json"
python3 - "$TMP_DIR/cancel-successor-audit.json" <<'PY'
import json, sys
from pathlib import Path
audit = json.loads(Path(sys.argv[1]).read_text())
assert audit["review_required"] is False
assert audit["replan_required_from"] == []
assert [(edge["from"], edge["to"], edge["decision"]) for edge in audit["waiting_edges"]] == [
    ("T-003", "T-002", "waiting")
]
PY
echo "ok: cancellation successor restores ordinary dependency waiting"

TRANSFER_SOURCE_PLAN="$TMP_DIR/transfer-source-plan.json"
cat >"$TRANSFER_SOURCE_PLAN" <<'JSON'
{
  "schema": "bagakit.feature-task-plan.v1",
  "review": {"status": "approved", "evidence_ref": "review/transfer"},
  "source_refs": ["decision/transfer"],
  "tasks": [
    {
      "id": "T-001", "depends_on": [], "title": "Close the completed slice",
      "objective": "Deliver the first independent slice.",
      "outcome": "The completed slice is proven.",
      "acceptance": ["The completed slice passes its gate."],
      "verification": [{"kind": "command", "ref": "true", "proves": "The completed slice is executable."}],
      "source_refs": ["decision/transfer"], "supersedes": []
    },
    {
      "id": "T-002", "depends_on": [], "title": "Continue the remaining slice",
      "objective": "Carry the remaining work into a successor Feature.",
      "outcome": "The remaining slice is explicitly transferred.",
      "acceptance": ["The remaining slice is not reported as unfinished in the old Feature."],
      "verification": [{"kind": "command", "ref": "true", "proves": "The transfer transition is executable."}],
      "source_refs": ["decision/transfer"], "supersedes": []
    }
  ]
}
JSON
bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature \
  --root "$TMP_DIR" --title "Transfer source" --slug "transfer-source" \
  --goal "Preserve partial completion while moving remaining work" \
  --workspace-mode worktree --tasks-file "$TRANSFER_SOURCE_PLAN" >/dev/null
TRANSFER_SOURCE_ID="$(feature_tracker_feature_id_by_title "$TMP_DIR" "Transfer source")"
bash "$SKILL_DIR/scripts/feature-tracker.sh" start-task --root "$TMP_DIR" --feature "$TRANSFER_SOURCE_ID" --task T-001 >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" run-task-gate --root "$TMP_DIR" --feature "$TRANSFER_SOURCE_ID" --task T-001 >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" finish-task --root "$TMP_DIR" --feature "$TRANSFER_SOURCE_ID" --task T-001 --result done >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature \
  --root "$TMP_DIR" --title "Transfer successor" --slug "transfer-successor" \
  --goal "Continue the remaining transferred slice" --workspace-mode worktree \
  --tasks-file "$TRANSFER_SOURCE_PLAN" --transferred-from "$TRANSFER_SOURCE_ID" >/dev/null
TRANSFER_SUCCESSOR_ID="$(feature_tracker_feature_id_by_title "$TMP_DIR" "Transfer successor")"
bash "$SKILL_DIR/scripts/feature-tracker.sh" transfer-feature \
  --root "$TMP_DIR" --feature "$TRANSFER_SOURCE_ID" --replacement "$TRANSFER_SUCCESSOR_ID" \
  "${FEATURE_TRACKER_CLOSEOUT_REVIEW_ARGS[@]}" >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/dev/null
python3 - "$TMP_DIR" "$TRANSFER_SOURCE_ID" "$TRANSFER_SUCCESSOR_ID" <<'PY'
import json, sys
from pathlib import Path
root = Path(sys.argv[1])
source_id, successor_id = sys.argv[2:]
source_dir = root / ".bagakit" / "feature-tracker" / "features-transferred" / source_id
successor_dir = root / ".bagakit" / "feature-tracker" / "features" / successor_id
source_state = json.loads((source_dir / "state.json").read_text(encoding="utf-8"))
source_tasks = json.loads((source_dir / "tasks.json").read_text(encoding="utf-8"))
successor_state = json.loads((successor_dir / "state.json").read_text(encoding="utf-8"))
assert source_state["status"] == "transferred"
assert source_state["transferred_to"] == {"feature_id": successor_id}
assert [task["status"] for task in source_tasks["tasks"]] == ["done", "transferred"]
assert "transferred_to" not in source_tasks["tasks"][1]
assert successor_state["transferred_from"] == [{"feature_id": source_id}]
PY
FEATURE_TRANSFER_PAGE="$TMP_DIR/transfer-page.html"
bash "$SKILL_DIR/scripts/feature-tracker.sh" show-feature-status \
  --root "$TMP_DIR" --feature "$TRANSFER_SUCCESSOR_ID" --format html >"$FEATURE_TRANSFER_PAGE"
grep -F -- "Transferred from" "$FEATURE_TRANSFER_PAGE" >/dev/null
grep -F -- "Transferred from (1)" "$FEATURE_TRANSFER_PAGE" >/dev/null
grep -F -- "data-feature-history-open=\"$TRANSFER_SOURCE_ID\"" "$FEATURE_TRANSFER_PAGE" >/dev/null
grep -F -- "data-closed-feature-id=\"$TRANSFER_SOURCE_ID\"" "$FEATURE_TRANSFER_PAGE" >/dev/null
grep -F -- "id=\"file-preview-dialog\"" "$FEATURE_TRANSFER_PAGE" >/dev/null
grep -F -- "Transferred → $TRANSFER_SUCCESSOR_ID" "$FEATURE_TRANSFER_PAGE" >/dev/null
echo "ok: Feature transfer preserves completed and transferred Task truth"

echo "ok: bagakit-feature-tracker Task DAG"
