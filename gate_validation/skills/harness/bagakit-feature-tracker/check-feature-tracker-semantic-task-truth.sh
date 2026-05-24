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
bash "$SKILL_DIR/scripts/feature-tracker.sh" initialize-tracker --root "$TMP_DIR" >/dev/null

bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature \
  --root "$TMP_DIR" \
  --title "Semantic task truth" \
  --goal "Execute only reviewed semantic task plans" \
  --workspace-mode proposal_only >/dev/null
FEATURE_ID="$(feature_tracker_feature_id_by_title "$TMP_DIR" "Semantic task truth")"

python3 - "$TMP_DIR" "$FEATURE_ID" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
feature_id = sys.argv[2]
feature_dir = root / ".bagakit" / "feature-tracker" / "features" / feature_id
tasks = json.loads((feature_dir / "tasks.json").read_text(encoding="utf-8"))
assert tasks["plan_status"] == "draft"
assert tasks["plan_revision"] == 0
assert tasks["tasks"] == []
assert not (feature_dir / "owner-receipt.json").exists()
PY

if bash "$SKILL_DIR/scripts/feature-tracker.sh" assign-feature-workspace \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --workspace-mode current_tree \
  >"$TMP_DIR/assign-before-plan.out" 2>"$TMP_DIR/assign-before-plan.err"; then
  echo "error: workspace assignment accepted a draft task plan" >&2
  exit 1
fi
grep -q "has no reviewed task plan" "$TMP_DIR/assign-before-plan.err"

if bash "$SKILL_DIR/scripts/feature-tracker.sh" start-task \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --task T-001 \
  >"$TMP_DIR/start-before-plan.out" 2>"$TMP_DIR/start-before-plan.err"; then
  echo "error: task start accepted a draft task plan" >&2
  exit 1
fi
grep -q "has no reviewed task plan" "$TMP_DIR/start-before-plan.err"

PLAN_ONE="$TMP_DIR/plan-one.json"
cat >"$PLAN_ONE" <<'JSON'
{
  "schema": "bagakit.feature-task-plan.v1",
  "review": {
    "status": "approved",
    "evidence_ref": "review/task-plan-one"
  },
  "source_refs": ["request/semantic-task-truth"],
  "tasks": [
    {
      "id": "T-001",
      "title": "Materialize semantic task truth",
      "objective": "Replace draft task state with one reviewed executable plan.",
      "outcome": "The feature exposes reviewable task meaning before execution.",
      "acceptance": ["The task plan is revisioned and contains no placeholder."],
      "verification": [
        {
          "kind": "command",
          "ref": "gate_validation/skills/harness/bagakit-feature-tracker/validation.toml",
          "proves": "Feature Tracker public lifecycle behavior remains valid."
        }
      ],
      "source_refs": ["request/semantic-task-truth"],
      "supersedes": []
    }
  ]
}
JSON

bash "$SKILL_DIR/scripts/feature-tracker.sh" set-task-plan \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --tasks-file "$PLAN_ONE" --expected-revision 0 >/dev/null

if bash "$SKILL_DIR/scripts/feature-tracker.sh" set-task-plan \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --tasks-file "$PLAN_ONE" --expected-revision 0 \
  >"$TMP_DIR/stale-plan.out" 2>"$TMP_DIR/stale-plan.err"; then
  echo "error: stale task plan revision unexpectedly succeeded" >&2
  exit 1
fi
grep -q "task plan revision conflict" "$TMP_DIR/stale-plan.err"

assert_rejected_ref() {
  local case_id="$1"
  local field="$2"
  local invalid_ref="$3"
  local candidate="$TMP_DIR/invalid-ref-$case_id.json"
  python3 - "$PLAN_ONE" "$candidate" "$field" "$invalid_ref" <<'PY'
import json
import sys
from pathlib import Path, PurePosixPath

source = Path(sys.argv[1])
target = Path(sys.argv[2])
field = sys.argv[3]
invalid_ref = sys.argv[4]
payload = json.loads(source.read_text(encoding="utf-8"))
if field == "review":
    payload["review"]["evidence_ref"] = invalid_ref
elif field == "plan_source":
    payload["source_refs"] = [invalid_ref]
elif field == "task_source":
    payload["tasks"][0]["source_refs"] = [invalid_ref]
elif field == "verification":
    payload["tasks"][0]["verification"][0]["ref"] = invalid_ref
else:
    raise SystemExit(f"unknown field: {field}")
target.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
PY
  if bash "$SKILL_DIR/scripts/feature-tracker.sh" set-task-plan \
    --root "$TMP_DIR" --feature "$FEATURE_ID" --tasks-file "$candidate" --expected-revision 1 \
    >"$TMP_DIR/invalid-ref-$case_id.out" 2>"$TMP_DIR/invalid-ref-$case_id.err"; then
    echo "error: invalid repo reference unexpectedly passed: $case_id" >&2
    exit 1
  fi
  grep -Eq "repo-relative|escape the repository root|URI or drive-qualified" "$TMP_DIR/invalid-ref-$case_id.err"
}

assert_rejected_ref "posix-absolute" "review" "/tmp/review.md"
assert_rejected_ref "parent-escape" "plan_source" "../request.md"
assert_rejected_ref "file-uri" "task_source" "file:///tmp/request.md"
assert_rejected_ref "windows-drive" "verification" 'C:\review\check.md'
assert_rejected_ref "unc" "review" '\\server\share\review.md'

PLAN_TWO="$TMP_DIR/plan-two.json"
cat >"$PLAN_TWO" <<'JSON'
{
  "schema": "bagakit.feature-task-plan.v1",
  "review": {
    "status": "approved",
    "evidence_ref": "review/task-plan-two"
  },
  "source_refs": ["request/semantic-task-truth", "decision/split-plan"],
  "tasks": [
    {
      "id": "T-002",
      "title": "Execute revised semantic task",
      "objective": "Prove revised task lineage and owner receipt freshness.",
      "outcome": "The current task supersedes the earlier reviewed task without erasing lineage.",
      "acceptance": ["Revision two records T-001 as superseded."],
      "verification": [
        {
          "kind": "owner_receipt",
          "ref": "owner-receipt.json",
          "proves": "The owner receipt reflects current lifecycle and task identity."
        }
      ],
      "source_refs": ["decision/split-plan"],
      "supersedes": ["T-001"]
    }
  ]
}
JSON

bash "$SKILL_DIR/scripts/feature-tracker.sh" set-task-plan \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --tasks-file "$PLAN_TWO" --expected-revision 1 >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" assign-feature-workspace \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --workspace-mode current_tree >/dev/null

READY_RECEIPT="$(bash "$SKILL_DIR/scripts/feature-tracker.sh" get-owner-receipt \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --json)"
python3 - "$TMP_DIR" "$FEATURE_ID" "$READY_RECEIPT" <<'PY'
import hashlib
import json
import sys
from pathlib import Path, PurePosixPath

root = Path(sys.argv[1])
feature_id = sys.argv[2]
receipt = json.loads(sys.argv[3])
feature_dir = root / ".bagakit" / "feature-tracker" / "features" / feature_id
tasks = json.loads((feature_dir / "tasks.json").read_text(encoding="utf-8"))
assert tasks["plan_status"] == "reviewed"
assert tasks["plan_revision"] == 2
assert tasks["supersedes_revision"] == 1
assert tasks["tasks"][0]["id"] == "T-002"
assert tasks["tasks"][0]["supersedes"] == ["T-001"]
assert tasks["plan_history"][-1]["superseded_task_ids"] == ["T-001"]
assert receipt["lifecycle_status"] == "ready"
assert receipt["continuation"] == "continue"
assert receipt["current_item_id"] is None
assert len(receipt["semantic_revision"]) == 64
feature_ref_root = PurePosixPath(".bagakit", "feature-tracker", "features", feature_id)
assert receipt["evidence_refs"] == [
    str(feature_ref_root / "state.json"),
    str(feature_ref_root / "tasks.json"),
]
assert receipt["evidence_hashes"] == {
    ref: hashlib.sha256((root / ref).read_bytes()).hexdigest()
    for ref in receipt["evidence_refs"]
}
PY

python3 - "$TMP_DIR" "$FEATURE_ID" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "features" / sys.argv[2] / "state.json"
payload = json.loads(path.read_text(encoding="utf-8"))
payload.setdefault("history", []).append({"action": "simulated_interrupted_write", "detail": "receipt not refreshed"})
path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
PY
if bash "$SKILL_DIR/scripts/feature-tracker.sh" get-owner-receipt \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --json \
  >"$TMP_DIR/interrupted-receipt.out" 2>"$TMP_DIR/interrupted-receipt.err"; then
  echo "error: receipt accepted state bytes written without a receipt refresh" >&2
  exit 1
fi
grep -q "owner receipt drift" "$TMP_DIR/interrupted-receipt.err"

bash "$SKILL_DIR/scripts/feature-tracker.sh" start-task \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --task T-002 >/dev/null
ACTIVE_RECEIPT="$(bash "$SKILL_DIR/scripts/feature-tracker.sh" get-owner-receipt \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --json)"
python3 - "$ACTIVE_RECEIPT" <<'PY'
import json
import sys

receipt = json.loads(sys.argv[1])
assert receipt["lifecycle_status"] == "in_progress"
assert receipt["continuation"] == "continue"
assert receipt["current_item_id"] == "T-002"
PY

python3 - "$TMP_DIR" "$FEATURE_ID" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "features" / sys.argv[2] / "owner-receipt.json"
payload = json.loads(path.read_text(encoding="utf-8"))
payload["semantic_revision"] = "stale"
path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
PY
if bash "$SKILL_DIR/scripts/feature-tracker.sh" get-owner-receipt \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --json \
  >"$TMP_DIR/stale-receipt.out" 2>"$TMP_DIR/stale-receipt.err"; then
  echo "error: stale persisted owner receipt unexpectedly passed" >&2
  exit 1
fi
grep -q "owner receipt drift" "$TMP_DIR/stale-receipt.err"

rm -f "$TMP_DIR/.bagakit/feature-tracker/features/$FEATURE_ID/owner-receipt.json"
if bash "$SKILL_DIR/scripts/feature-tracker.sh" get-owner-receipt \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --json \
  >"$TMP_DIR/missing-receipt.out" 2>"$TMP_DIR/missing-receipt.err"; then
  echo "error: missing persisted owner receipt unexpectedly passed" >&2
  exit 1
fi
grep -q "missing persisted owner receipt" "$TMP_DIR/missing-receipt.err"

bash "$SKILL_DIR/scripts/feature-tracker.sh" finish-task \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --task T-002 --result blocked >/dev/null
BLOCKED_RECEIPT="$(bash "$SKILL_DIR/scripts/feature-tracker.sh" get-owner-receipt \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --json)"
python3 - "$BLOCKED_RECEIPT" <<'PY'
import json
import sys

receipt = json.loads(sys.argv[1])
assert receipt["lifecycle_status"] == "blocked"
assert receipt["continuation"] == "blocked"
assert receipt["blocker"]["class"] == "internal_blocker"
PY

PLAN_THREE="$TMP_DIR/plan-three.json"
cat >"$PLAN_THREE" <<'JSON'
{
  "schema": "bagakit.feature-task-plan.v1",
  "review": {
    "status": "approved",
    "evidence_ref": "review/task-plan-three"
  },
  "source_refs": ["decision/recover-blocked-plan"],
  "tasks": [
    {
      "id": "T-003",
      "title": "Recover through a revised task",
      "objective": "Add a new task without rewriting the blocked task record.",
      "outcome": "The blocked task remains attributable while the reviewed plan provides a new route.",
      "acceptance": ["T-002 remains blocked and T-003 is the only new todo task."],
      "verification": [
        {
          "kind": "artifact",
          "ref": "tasks.json",
          "proves": "Prior task status and evidence survive plan revision."
        }
      ],
      "source_refs": ["decision/recover-blocked-plan"],
      "supersedes": ["T-002"]
    }
  ]
}
JSON
bash "$SKILL_DIR/scripts/feature-tracker.sh" set-task-plan \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --tasks-file "$PLAN_THREE" --expected-revision 2 >/dev/null
python3 - "$TMP_DIR" "$FEATURE_ID" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
feature_id = sys.argv[2]
feature_dir = root / ".bagakit" / "feature-tracker" / "features" / feature_id
state = json.loads((feature_dir / "state.json").read_text(encoding="utf-8"))
tasks = json.loads((feature_dir / "tasks.json").read_text(encoding="utf-8"))
by_id = {task["id"]: task for task in tasks["tasks"]}
assert tasks["plan_revision"] == 3
assert by_id["T-002"]["status"] == "blocked"
assert by_id["T-002"]["superseded_by"] == ["T-003"]
assert by_id["T-003"]["status"] == "todo"
assert state["status"] == "ready"
assert state["blocked_reason_class"] == "none"
PY

if bash "$SKILL_DIR/scripts/feature-tracker.sh" start-task \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --task T-002 \
  >"$TMP_DIR/start-superseded.out" 2>"$TMP_DIR/start-superseded.err"; then
  echo "error: superseded blocked task unexpectedly restarted" >&2
  exit 1
fi
grep -q "not part of the current reviewed task plan" "$TMP_DIR/start-superseded.err"

PLAN_FOUR="$TMP_DIR/plan-four.json"
cat >"$PLAN_FOUR" <<'JSON'
{
  "schema": "bagakit.feature-task-plan.v1",
  "review": {
    "status": "approved",
    "evidence_ref": "review/task-plan-four"
  },
  "source_refs": ["decision/continue-revised-plan"],
  "tasks": [
    {
      "id": "T-004",
      "title": "Continue without repeating historical supersession",
      "objective": "Replace the current unexecuted task without superseding an older historical task again.",
      "outcome": "Revision four supersedes only revision three's current task.",
      "acceptance": ["T-002 remains preserved while only T-003 is newly superseded."],
      "verification": [
        {
          "kind": "artifact",
          "ref": "tasks.json",
          "proves": "Current-plan membership and historical lineage remain distinct."
        }
      ],
      "source_refs": ["decision/continue-revised-plan"],
      "supersedes": ["T-003"]
    }
  ]
}
JSON
bash "$SKILL_DIR/scripts/feature-tracker.sh" set-task-plan \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --tasks-file "$PLAN_FOUR" --expected-revision 3 >/dev/null
python3 - "$TMP_DIR" "$FEATURE_ID" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
feature_id = sys.argv[2]
tasks_path = root / ".bagakit" / "feature-tracker" / "features" / feature_id / "tasks.json"
tasks = json.loads(tasks_path.read_text(encoding="utf-8"))
by_id = {task["id"]: task for task in tasks["tasks"]}
assert tasks["plan_revision"] == 4
assert tasks["plan_history"][-1]["task_ids"] == ["T-004"]
assert tasks["plan_history"][-1]["superseded_task_ids"] == ["T-003"]
assert set(by_id) == {"T-002", "T-004"}
assert by_id["T-002"]["status"] == "blocked"
assert by_id["T-002"]["superseded_by"] == ["T-003"]
assert by_id["T-004"]["status"] == "todo"
PY

python3 - "$TMP_DIR" "$FEATURE_ID" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "features" / sys.argv[2] / "tasks.json"
payload = json.loads(path.read_text(encoding="utf-8"))
payload["version"] = 1
path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
PY
if bash "$SKILL_DIR/scripts/feature-tracker.sh" start-task \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --task T-004 \
  >"$TMP_DIR/start-non-v2.out" 2>"$TMP_DIR/start-non-v2.err"; then
  echo "error: non-v2 reviewed task payload unexpectedly passed execution gate" >&2
  exit 1
fi
grep -q "has no reviewed task plan" "$TMP_DIR/start-non-v2.err"
python3 - "$TMP_DIR" "$FEATURE_ID" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "features" / sys.argv[2] / "tasks.json"
payload = json.loads(path.read_text(encoding="utf-8"))
payload["version"] = 2
path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
PY

bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/dev/null
echo "ok: feature tracker semantic task truth passed"
