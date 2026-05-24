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

git -C "$TMP_DIR" init -q -b main
git -C "$TMP_DIR" config user.name "Bagakit"
git -C "$TMP_DIR" config user.email "bagakit@example.com"
printf '# demo\n' > "$TMP_DIR/README.md"
git -C "$TMP_DIR" add README.md
git -C "$TMP_DIR" commit -q -m "init"


bash "$SKILL_DIR/scripts/feature-tracker.sh" initialize-tracker --root "$TMP_DIR" >/dev/null
TASK_PLAN_JSON="$TMP_DIR/.bagakit/feature-tracker/artifacts/reviewed-task-plan.json"
feature_tracker_write_reviewed_task_plan "$TASK_PLAN_JSON" "Exercise the regression scenario through reviewed task truth."
bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Dirty current tree archive" --slug "dirty-current-tree-archive" --goal "Archive should ignore unrelated dirty work" --workspace-mode proposal_only >/dev/null
DIRTY_ARCHIVE_ID="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
for item in payload.get("features", []):
    if item.get("title") == "Dirty current tree archive":
        print(item["feat_id"])
        break
else:
    raise SystemExit("dirty current_tree archive feature not found")
PY
)"
bash "$SKILL_DIR/scripts/feature-tracker.sh" set-task-plan --root "$TMP_DIR" --feature "$DIRTY_ARCHIVE_ID" --tasks-file "$TASK_PLAN_JSON" --expected-revision 0 >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" assign-feature-workspace --root "$TMP_DIR" --feature "$DIRTY_ARCHIVE_ID" --workspace-mode current_tree >/dev/null
feature_tracker_set_non_ui_gate "$TMP_DIR" "true"
bash "$SKILL_DIR/scripts/feature-tracker.sh" start-task --root "$TMP_DIR" --feature "$DIRTY_ARCHIVE_ID" --task T-001 >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" run-task-gate --root "$TMP_DIR" --feature "$DIRTY_ARCHIVE_ID" --task T-001 >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" finish-task --root "$TMP_DIR" --feature "$DIRTY_ARCHIVE_ID" --task T-001 --result done >/dev/null
cat > "$TMP_DIR/UNRELATED.md" <<'EOF'
unrelated dirty work
EOF
bash "$SKILL_DIR/scripts/feature-tracker.sh" archive-feature --root "$TMP_DIR" --feature "$DIRTY_ARCHIVE_ID" >/dev/null 2>&1
test -d "$TMP_DIR/.bagakit/feature-tracker/features-archived/$DIRTY_ARCHIVE_ID"
test -f "$TMP_DIR/UNRELATED.md"
rm -f "$TMP_DIR/UNRELATED.md"

bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Boundary feature" --slug "boundary-feature" --goal "Reject unsupported feature-root files" --workspace-mode proposal_only >/dev/null

BOUNDARY_FEATURE_ID="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
for item in payload.get("features", []):
    if item.get("title") == "Boundary feature":
        print(item["feat_id"])
        break
else:
    raise SystemExit("boundary feature not found")
PY
)"

BOUNDARY_DIR="$TMP_DIR/.bagakit/feature-tracker/features/$BOUNDARY_FEATURE_ID"
cat > "$BOUNDARY_DIR/PRD.md" <<'EOF'
shadow product doc
EOF
cat > "$BOUNDARY_DIR/Changelog.md" <<'EOF'
shadow change log
EOF

if bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/dev/null 2>&1; then
  echo "error: unsupported feature-root files unexpectedly accepted" >&2
  exit 1
fi
rm -f "$BOUNDARY_DIR/PRD.md" "$BOUNDARY_DIR/Changelog.md"

bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Archive blocked feature" --slug "archive-blocked-feature" --goal "Archive should preflight graph" --workspace-mode proposal_only >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Discard blocked feature" --slug "discard-blocked-feature" --goal "Discard should preflight graph" --workspace-mode proposal_only >/dev/null

BLOCKED_FEATURE_IDS="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
feature_ids = {}
for item in payload.get("features", []):
    title = item.get("title")
    if title == "Archive blocked feature":
        feature_ids["archive"] = item["feat_id"]
    elif title == "Discard blocked feature":
        feature_ids["discard"] = item["feat_id"]
if set(feature_ids) != {"archive", "discard"}:
    raise SystemExit("blocked features not found")
print(feature_ids["archive"])
print(feature_ids["discard"])
PY
)"

ARCHIVE_BLOCKED_ID="$(printf '%s\n' "$BLOCKED_FEATURE_IDS" | sed -n '1p')"
DISCARD_BLOCKED_ID="$(printf '%s\n' "$BLOCKED_FEATURE_IDS" | sed -n '2p')"

feature_tracker_complete_reviewed_feature "$TMP_DIR" "$SKILL_DIR" "$ARCHIVE_BLOCKED_ID" "$TASK_PLAN_JSON"

FEATURE_COUNT_BEFORE="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
print(len(payload.get("features", [])))
PY
)"
WORKTREE_COUNT_BEFORE="$(git -C "$TMP_DIR" worktree list --porcelain | grep -c '^worktree ')"

python3 - "$TMP_DIR" "$BOUNDARY_FEATURE_ID" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
feature_id = sys.argv[2]
state_path = root / ".bagakit" / "feature-tracker" / "features" / feature_id / "state.json"
state = json.loads(state_path.read_text(encoding="utf-8"))
state["depends_on"] = [feature_id]
state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
PY

if bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Blocked create feature" --slug "blocked-create-feature" --goal "Create should preflight graph" --workspace-mode worktree --tasks-file "$TASK_PLAN_JSON" >/dev/null 2>&1; then
  echo "error: create-feature unexpectedly mutated state before graph validation" >&2
  exit 1
fi
FEATURE_COUNT_AFTER="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
print(len(payload.get("features", [])))
PY
)"
WORKTREE_COUNT_AFTER="$(git -C "$TMP_DIR" worktree list --porcelain | grep -c '^worktree ')"
test "$FEATURE_COUNT_BEFORE" = "$FEATURE_COUNT_AFTER"
test "$WORKTREE_COUNT_BEFORE" = "$WORKTREE_COUNT_AFTER"

if bash "$SKILL_DIR/scripts/feature-tracker.sh" archive-feature --root "$TMP_DIR" --feature "$ARCHIVE_BLOCKED_ID" >/dev/null 2>&1; then
  echo "error: archive-feature unexpectedly cleaned up before graph preflight" >&2
  exit 1
fi
test -d "$TMP_DIR/.bagakit/feature-tracker/features/$ARCHIVE_BLOCKED_ID"
test ! -d "$TMP_DIR/.bagakit/feature-tracker/features-archived/$ARCHIVE_BLOCKED_ID"

if bash "$SKILL_DIR/scripts/feature-tracker.sh" discard-feature --root "$TMP_DIR" --feature "$DISCARD_BLOCKED_ID" --reason superseded >/dev/null 2>&1; then
  echo "error: discard-feature unexpectedly cleaned up before graph preflight" >&2
  exit 1
fi
test -d "$TMP_DIR/.bagakit/feature-tracker/features/$DISCARD_BLOCKED_ID"
test ! -d "$TMP_DIR/.bagakit/feature-tracker/features-discarded/$DISCARD_BLOCKED_ID"

python3 - "$TMP_DIR" "$BOUNDARY_FEATURE_ID" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
feature_id = sys.argv[2]
state_path = root / ".bagakit" / "feature-tracker" / "features" / feature_id / "state.json"
state = json.loads(state_path.read_text(encoding="utf-8"))
state.pop("depends_on", None)
state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
PY
bash "$SKILL_DIR/scripts/feature-tracker.sh" replan-features --root "$TMP_DIR" >/dev/null

WORKTREE_COLLISION_PREVIEW="$(python3 - "$ROOT" "$TMP_DIR" <<'PY'
import importlib.util
import sys
from pathlib import Path

repo_root = Path(sys.argv[1])
tmp_root = Path(sys.argv[2])
module_path = repo_root / "skills" / "harness" / "bagakit-feature-tracker" / "scripts" / "feature-tracker.py"
spec = importlib.util.spec_from_file_location("feature_tracker_module", module_path)
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules[spec.name] = module
spec.loader.exec_module(module)
paths = module.HarnessPaths(tmp_root)
policy = module.load_runtime_policy(paths)
branch_prefix = module.resolve_branch_prefix(policy, None)
feat_id, _ = module.allocate_feat_id(tmp_root, paths)
print(feat_id)
print(f"{branch_prefix}{feat_id}")
print((tmp_root / ".worktrees" / f"wt-{feat_id}").as_posix())
PY
)"
WORKTREE_COLLISION_ID="$(printf '%s\n' "$WORKTREE_COLLISION_PREVIEW" | sed -n '1p')"
WORKTREE_COLLISION_BRANCH="$(printf '%s\n' "$WORKTREE_COLLISION_PREVIEW" | sed -n '2p')"
WORKTREE_COLLISION_PATH="$(printf '%s\n' "$WORKTREE_COLLISION_PREVIEW" | sed -n '3p')"
FEATURE_COUNT_BEFORE_WORKTREE_COLLISION="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
print(len(payload.get("features", [])))
print(payload["feature_id_issuance"]["next_cursor"])
PY
)"
WORKTREE_COLLISION_FEATURE_COUNT="$(printf '%s\n' "$FEATURE_COUNT_BEFORE_WORKTREE_COLLISION" | sed -n '1p')"
WORKTREE_COLLISION_NEXT_CURSOR="$(printf '%s\n' "$FEATURE_COUNT_BEFORE_WORKTREE_COLLISION" | sed -n '2p')"
WORKTREE_COLLISION_WORKTREE_COUNT="$(git -C "$TMP_DIR" worktree list --porcelain | grep -c '^worktree ')"

git -C "$TMP_DIR" branch "$WORKTREE_COLLISION_BRANCH" >/dev/null
if bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Blocked create by branch collision" --slug "blocked-create-by-branch-collision" --goal "Reject existing branch before cursor persistence" --workspace-mode worktree --tasks-file "$TASK_PLAN_JSON" >/dev/null 2>&1; then
  echo "error: create-feature unexpectedly accepted colliding worktree branch" >&2
  exit 1
fi
WORKTREE_COLLISION_AFTER_BRANCH="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
print(len(payload.get("features", [])))
print(payload["feature_id_issuance"]["next_cursor"])
PY
)"
test "$WORKTREE_COLLISION_FEATURE_COUNT" = "$(printf '%s\n' "$WORKTREE_COLLISION_AFTER_BRANCH" | sed -n '1p')"
test "$WORKTREE_COLLISION_NEXT_CURSOR" = "$(printf '%s\n' "$WORKTREE_COLLISION_AFTER_BRANCH" | sed -n '2p')"
test "$WORKTREE_COLLISION_WORKTREE_COUNT" = "$(git -C "$TMP_DIR" worktree list --porcelain | grep -c '^worktree ')"
git -C "$TMP_DIR" branch -D "$WORKTREE_COLLISION_BRANCH" >/dev/null

mkdir -p "$WORKTREE_COLLISION_PATH"
if bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Blocked create by worktree path collision" --slug "blocked-create-by-worktree-path-collision" --goal "Reject existing worktree path before cursor persistence" --workspace-mode worktree --tasks-file "$TASK_PLAN_JSON" >/dev/null 2>&1; then
  echo "error: create-feature unexpectedly accepted colliding worktree path" >&2
  exit 1
fi
WORKTREE_COLLISION_AFTER_PATH="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
print(len(payload.get("features", [])))
print(payload["feature_id_issuance"]["next_cursor"])
PY
)"
test "$WORKTREE_COLLISION_FEATURE_COUNT" = "$(printf '%s\n' "$WORKTREE_COLLISION_AFTER_PATH" | sed -n '1p')"
test "$WORKTREE_COLLISION_NEXT_CURSOR" = "$(printf '%s\n' "$WORKTREE_COLLISION_AFTER_PATH" | sed -n '2p')"
test "$WORKTREE_COLLISION_WORKTREE_COUNT" = "$(git -C "$TMP_DIR" worktree list --porcelain | grep -c '^worktree ')"
rm -rf "$WORKTREE_COLLISION_PATH"


bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Dirty current tree discard" --slug "dirty-current-tree-discard" --goal "Discard should fail without artifacts side effects" --workspace-mode proposal_only >/dev/null
DIRTY_DISCARD_ID="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
for item in payload.get("features", []):
    if item.get("title") == "Dirty current tree discard":
        print(item["feat_id"])
        break
else:
    raise SystemExit("dirty current_tree discard feature not found")
PY
)"
bash "$SKILL_DIR/scripts/feature-tracker.sh" set-task-plan --root "$TMP_DIR" --feature "$DIRTY_DISCARD_ID" --tasks-file "$TASK_PLAN_JSON" --expected-revision 0 >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" assign-feature-workspace --root "$TMP_DIR" --feature "$DIRTY_DISCARD_ID" --workspace-mode current_tree >/dev/null
cat > "$TMP_DIR/DIRTY.md" <<'EOF'
root dirty change
EOF
if bash "$SKILL_DIR/scripts/feature-tracker.sh" discard-feature --root "$TMP_DIR" --feature "$DIRTY_DISCARD_ID" --reason superseded >/dev/null 2>&1; then
  echo "error: dirty current_tree discard unexpectedly succeeded" >&2
  exit 1
fi
test ! -d "$TMP_DIR/.bagakit/feature-tracker/features/$DIRTY_DISCARD_ID/artifacts"
rm -f "$TMP_DIR/DIRTY.md"

bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Cycle A" --slug "cycle-a" --goal "Check replan rollback" --workspace-mode proposal_only >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Cycle B" --slug "cycle-b" --goal "Check replan rollback" --workspace-mode proposal_only >/dev/null

CYCLE_FEATURE_IDS="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
feature_ids = {}
for item in payload.get("features", []):
    title = item.get("title")
    if title == "Cycle A":
        feature_ids["a"] = item["feat_id"]
    elif title == "Cycle B":
        feature_ids["b"] = item["feat_id"]
if set(feature_ids) != {"a", "b"}:
    raise SystemExit("cycle features not found")
print(feature_ids["a"])
print(feature_ids["b"])
PY
)"

CYCLE_A_ID="$(printf '%s\n' "$CYCLE_FEATURE_IDS" | sed -n '1p')"
CYCLE_B_ID="$(printf '%s\n' "$CYCLE_FEATURE_IDS" | sed -n '2p')"

if bash "$SKILL_DIR/scripts/feature-tracker.sh" replan-features --root "$TMP_DIR" --dependency "$CYCLE_A_ID:$CYCLE_B_ID" --dependency "$CYCLE_B_ID:$CYCLE_A_ID" >/dev/null 2>&1; then
  echo "error: cyclic replan unexpectedly succeeded" >&2
  exit 1
fi
python3 - "$TMP_DIR" "$CYCLE_A_ID" "$CYCLE_B_ID" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
for feature_id in (sys.argv[2], sys.argv[3]):
    state_path = root / ".bagakit" / "feature-tracker" / "features" / feature_id / "state.json"
    state = json.loads(state_path.read_text(encoding="utf-8"))
    assert state.get("depends_on", []) == []
PY

python3 - "$TMP_DIR" "$CYCLE_A_ID" "$CYCLE_B_ID" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
for feature_id, deps in ((sys.argv[2], [sys.argv[3]]), (sys.argv[3], [sys.argv[2]])):
    state_path = root / ".bagakit" / "feature-tracker" / "features" / feature_id / "state.json"
    state = json.loads(state_path.read_text(encoding="utf-8"))
    state["depends_on"] = deps
    state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
PY
if bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/dev/null 2>&1; then
  echo "error: canonical dependency cycle unexpectedly accepted" >&2
  exit 1
fi

python3 - "$TMP_DIR" "$CYCLE_A_ID" "$CYCLE_B_ID" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
for feature_id in (sys.argv[2], sys.argv[3]):
    state_path = root / ".bagakit" / "feature-tracker" / "features" / feature_id / "state.json"
    state = json.loads(state_path.read_text(encoding="utf-8"))
    state.pop("depends_on", None)
    state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
PY

python3 - "$TMP_DIR" "$CYCLE_A_ID" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
feature_id = sys.argv[2]
state_path = root / ".bagakit" / "feature-tracker" / "features" / feature_id / "state.json"
state = json.loads(state_path.read_text(encoding="utf-8"))
state["depends_on"] = feature_id
state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
PY
if bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/dev/null 2>&1; then
  echo "error: non-list/string depends_on unexpectedly accepted" >&2
  exit 1
fi
bash "$SKILL_DIR/scripts/feature-tracker.sh" replan-features --root "$TMP_DIR" --clear-dependencies "$CYCLE_A_ID" >/dev/null

bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Closeout preserve feature" --slug "closeout-preserve-feature" --goal "Preserve root files on archive" --workspace-mode proposal_only >/dev/null
CLOSEOUT_FEATURE_ID="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
for item in payload.get("features", []):
    if item.get("title") == "Closeout preserve feature":
        print(item["feat_id"])
        break
else:
    raise SystemExit("closeout feature not found")
PY
)"

feature_tracker_complete_reviewed_feature "$TMP_DIR" "$SKILL_DIR" "$CLOSEOUT_FEATURE_ID" "$TASK_PLAN_JSON"

bash "$SKILL_DIR/scripts/feature-tracker.sh" materialize-feature-artifact --root "$TMP_DIR" --feature "$CLOSEOUT_FEATURE_ID" --kind proposal >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" materialize-feature-artifact --root "$TMP_DIR" --feature "$CLOSEOUT_FEATURE_ID" --kind verification >/dev/null
CLOSEOUT_DIR="$TMP_DIR/.bagakit/feature-tracker/features/$CLOSEOUT_FEATURE_ID"
cat > "$CLOSEOUT_DIR/ui-verification.md" <<'EOF'
legacy ui verification
EOF
cat > "$CLOSEOUT_DIR/summary.md" <<'EOF'
operator-authored active summary
EOF
PRESERVED_SUMMARY_SHA="$(shasum "$CLOSEOUT_DIR/summary.md" | awk '{print $1}')"
cat > "$CLOSEOUT_DIR/PRD.md" <<'EOF'
legacy product doc
EOF
mkdir -p "$CLOSEOUT_DIR/notes-dir"
cat > "$CLOSEOUT_DIR/notes-dir/notes.txt" <<'EOF'
legacy notes
EOF
bash "$SKILL_DIR/scripts/feature-tracker.sh" archive-feature --root "$TMP_DIR" --feature "$CLOSEOUT_FEATURE_ID" >/dev/null
ARCHIVED_CLOSEOUT_DIR="$TMP_DIR/.bagakit/feature-tracker/features-archived/$CLOSEOUT_FEATURE_ID"
test -f "$ARCHIVED_CLOSEOUT_DIR/summary.md"
test ! -f "$ARCHIVED_CLOSEOUT_DIR/proposal.md"
test ! -f "$ARCHIVED_CLOSEOUT_DIR/verification.md"
test ! -f "$ARCHIVED_CLOSEOUT_DIR/ui-verification.md"
test ! -f "$ARCHIVED_CLOSEOUT_DIR/PRD.md"
test ! -d "$ARCHIVED_CLOSEOUT_DIR/notes-dir"
test -f "$ARCHIVED_CLOSEOUT_DIR/artifacts/closeout-preserved-root/proposal.md"
test -f "$ARCHIVED_CLOSEOUT_DIR/artifacts/closeout-preserved-root/verification.md"
test -f "$ARCHIVED_CLOSEOUT_DIR/artifacts/closeout-preserved-root/ui-verification.md"
test -f "$ARCHIVED_CLOSEOUT_DIR/artifacts/closeout-preserved-root/summary.md"
test -f "$ARCHIVED_CLOSEOUT_DIR/artifacts/closeout-preserved-root/PRD.md"
test -f "$ARCHIVED_CLOSEOUT_DIR/artifacts/closeout-preserved-root/notes-dir/notes.txt"
test "$PRESERVED_SUMMARY_SHA" = "$(shasum "$ARCHIVED_CLOSEOUT_DIR/artifacts/closeout-preserved-root/summary.md" | awk '{print $1}')"
SUMMARY_SHA_BEFORE="$(shasum "$ARCHIVED_CLOSEOUT_DIR/summary.md" | awk '{print $1}')"
bash "$SKILL_DIR/scripts/feature-tracker.sh" archive-feature --root "$TMP_DIR" --feature "$CLOSEOUT_FEATURE_ID" >/dev/null
SUMMARY_SHA_AFTER="$(shasum "$ARCHIVED_CLOSEOUT_DIR/summary.md" | awk '{print $1}')"
test "$SUMMARY_SHA_BEFORE" = "$SUMMARY_SHA_AFTER"
test -f "$ARCHIVED_CLOSEOUT_DIR/summary.md"
test "$PRESERVED_SUMMARY_SHA" = "$(shasum "$ARCHIVED_CLOSEOUT_DIR/artifacts/closeout-preserved-root/summary.md" | awk '{print $1}')"
if bash "$SKILL_DIR/scripts/feature-tracker.sh" materialize-feature-artifact --root "$TMP_DIR" --feature "$CLOSEOUT_FEATURE_ID" --kind verification >/dev/null 2>&1; then
  echo "error: closed feature unexpectedly allowed helper materialization" >&2
  exit 1
fi
bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/dev/null

mkdir -p "$TMP_DIR/.bagakit/feature-tracker/feats/legacy-test"
if bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/dev/null 2>&1; then
  echo "error: legacy feats directory unexpectedly accepted" >&2
  exit 1
fi
rmdir "$TMP_DIR/.bagakit/feature-tracker/feats/legacy-test"
rmdir "$TMP_DIR/.bagakit/feature-tracker/feats"

bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "False archived feature" --slug "false-archived-feature" --goal "Reject false archived fast path" --workspace-mode proposal_only >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "False discarded feature" --slug "false-discarded-feature" --goal "Reject false discarded fast path" --workspace-mode proposal_only >/dev/null
FALSE_CLOSEOUT_IDS="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
feature_ids = {}
for item in payload.get("features", []):
    title = item.get("title")
    if title == "False archived feature":
        feature_ids["archive"] = item["feat_id"]
    elif title == "False discarded feature":
        feature_ids["discard"] = item["feat_id"]
if set(feature_ids) != {"archive", "discard"}:
    raise SystemExit("false closeout features not found")
print(feature_ids["archive"])
print(feature_ids["discard"])
PY
)"
FALSE_ARCHIVE_ID="$(printf '%s\n' "$FALSE_CLOSEOUT_IDS" | sed -n '1p')"
FALSE_DISCARD_ID="$(printf '%s\n' "$FALSE_CLOSEOUT_IDS" | sed -n '2p')"

python3 - "$TMP_DIR" "$FALSE_ARCHIVE_ID" "$FALSE_DISCARD_ID" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
archive_id = sys.argv[2]
discard_id = sys.argv[3]
for feat_id, status in ((archive_id, "archived"), (discard_id, "discarded")):
    state_path = root / ".bagakit" / "feature-tracker" / "features" / feat_id / "state.json"
    state = json.loads(state_path.read_text(encoding="utf-8"))
    state["status"] = status
    state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
PY

if bash "$SKILL_DIR/scripts/feature-tracker.sh" archive-feature --root "$TMP_DIR" --feature "$FALSE_ARCHIVE_ID" >/dev/null 2>&1; then
  echo "error: archive-feature falsely accepted active-root archived state" >&2
  exit 1
fi
test -d "$TMP_DIR/.bagakit/feature-tracker/features/$FALSE_ARCHIVE_ID"
test ! -d "$TMP_DIR/.bagakit/feature-tracker/features-archived/$FALSE_ARCHIVE_ID"

if bash "$SKILL_DIR/scripts/feature-tracker.sh" discard-feature --root "$TMP_DIR" --feature "$FALSE_DISCARD_ID" --reason superseded >/dev/null 2>&1; then
  echo "error: discard-feature falsely accepted active-root discarded state" >&2
  exit 1
fi
test -d "$TMP_DIR/.bagakit/feature-tracker/features/$FALSE_DISCARD_ID"
test ! -d "$TMP_DIR/.bagakit/feature-tracker/features-discarded/$FALSE_DISCARD_ID"

bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Broken active feature" --slug "broken-active-feature" --goal "Break active graph without blocking closed rerun" --workspace-mode proposal_only >/dev/null
BROKEN_ACTIVE_ID="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
for item in payload.get("features", []):
    if item.get("title") == "Broken active feature":
        print(item["feat_id"])
        break
else:
    raise SystemExit("broken active feature not found")
PY
)"
python3 - "$TMP_DIR" "$BROKEN_ACTIVE_ID" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
feature_id = sys.argv[2]
state_path = root / ".bagakit" / "feature-tracker" / "features" / feature_id / "state.json"
state = json.loads(state_path.read_text(encoding="utf-8"))
state["depends_on"] = [feature_id]
state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
PY
if ! bash "$SKILL_DIR/scripts/feature-tracker.sh" archive-feature --root "$TMP_DIR" --feature "$CLOSEOUT_FEATURE_ID" >/dev/null 2>&1; then
  echo "error: already-closed archive-feature unexpectedly failed on unrelated active-graph breakage" >&2
  exit 1
fi
bash "$SKILL_DIR/scripts/feature-tracker.sh" replan-features --root "$TMP_DIR" --clear-dependencies "$BROKEN_ACTIVE_ID" >/dev/null

echo "ok: bagakit-feature-tracker state contract regression passed"
