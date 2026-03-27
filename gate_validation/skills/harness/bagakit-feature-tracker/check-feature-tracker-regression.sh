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
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

git -C "$TMP_DIR" init -q -b main
git -C "$TMP_DIR" config user.name "Bagakit"
git -C "$TMP_DIR" config user.email "bagakit@example.com"
printf '# demo\n' > "$TMP_DIR/README.md"
git -C "$TMP_DIR" add README.md
git -C "$TMP_DIR" commit -q -m "init"

mkdir -p "$TMP_DIR/docs"
touch "$TMP_DIR/docs/must-guidebook.md"
touch "$TMP_DIR/docs/must-docs-taxonomy.md"
mkdir -p "$TMP_DIR/docs/.bagakit/inbox"

bash "$SKILL_DIR/scripts/feature-tracker.sh" check-reference-readiness --root "$TMP_DIR" >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" initialize-tracker --root "$TMP_DIR" >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Archive feature" --slug "archive-feature" --goal "Archive cleanly" --workspace-mode proposal_only >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Archive feature preexisting" --slug "archive-feature-preexisting" --goal "Archive without touching legacy inbox files" --workspace-mode proposal_only >/dev/null

ARCHIVE_FEATURE_IDS="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
items = payload.get("features")
if not isinstance(items, list) or len(items) < 2:
    raise SystemExit("missing archive features")
feature_ids = {}
for item in items:
    title = item.get("title")
    if title == "Archive feature":
        feature_ids["plain"] = item["feat_id"]
    elif title == "Archive feature preexisting":
        feature_ids["preexisting"] = item["feat_id"]
if set(feature_ids) != {"plain", "preexisting"}:
    raise SystemExit("archive features not found")
print(feature_ids["plain"])
print(feature_ids["preexisting"])
PY
)"

ARCHIVE_FEATURE_ID="$(printf '%s\n' "$ARCHIVE_FEATURE_IDS" | sed -n '1p')"
PREEXISTING_FEATURE_ID="$(printf '%s\n' "$ARCHIVE_FEATURE_IDS" | sed -n '2p')"

python3 - "$TMP_DIR" "$ARCHIVE_FEATURE_ID" "$PREEXISTING_FEATURE_ID" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
for feature_id in (sys.argv[2], sys.argv[3]):
    state_path = root / ".bagakit" / "feature-tracker" / "features" / feature_id / "state.json"
    state = json.loads(state_path.read_text(encoding="utf-8"))
    state["status"] = "done"
    state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
PY

bash "$SKILL_DIR/scripts/feature-tracker.sh" archive-feature --root "$TMP_DIR" --feature "$ARCHIVE_FEATURE_ID" >/dev/null
test ! -e "$TMP_DIR/docs/.bagakit/inbox/decision-$ARCHIVE_FEATURE_ID.md"
test ! -e "$TMP_DIR/docs/.bagakit/inbox/howto-$ARCHIVE_FEATURE_ID-result.md"
test ! -e "$TMP_DIR/docs/.bagakit/inbox/gotcha-$ARCHIVE_FEATURE_ID.md"

DECISION_FILE="$TMP_DIR/docs/.bagakit/inbox/decision-$PREEXISTING_FEATURE_ID.md"
HOWTO_FILE="$TMP_DIR/docs/.bagakit/inbox/howto-$PREEXISTING_FEATURE_ID-result.md"
GOTCHA_FILE="$TMP_DIR/docs/.bagakit/inbox/gotcha-$PREEXISTING_FEATURE_ID.md"

cat > "$DECISION_FILE" <<'EOF'
legacy decision sentinel
EOF
cat > "$HOWTO_FILE" <<'EOF'
legacy howto sentinel
EOF
cat > "$GOTCHA_FILE" <<'EOF'
legacy gotcha sentinel
EOF

before_decision="$(shasum "$DECISION_FILE" | awk '{print $1}')"
before_howto="$(shasum "$HOWTO_FILE" | awk '{print $1}')"
before_gotcha="$(shasum "$GOTCHA_FILE" | awk '{print $1}')"

bash "$SKILL_DIR/scripts/feature-tracker.sh" archive-feature --root "$TMP_DIR" --feature "$PREEXISTING_FEATURE_ID" >/dev/null

after_decision="$(shasum "$DECISION_FILE" | awk '{print $1}')"
after_howto="$(shasum "$HOWTO_FILE" | awk '{print $1}')"
after_gotcha="$(shasum "$GOTCHA_FILE" | awk '{print $1}')"

test "$before_decision" = "$after_decision"
test "$before_howto" = "$after_howto"
test "$before_gotcha" = "$after_gotcha"

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

if bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/tmp/bagakit-feature-tracker-boundary.out 2>/tmp/bagakit-feature-tracker-boundary.err; then
  echo "error: unsupported feature-root files unexpectedly accepted" >&2
  exit 1
fi
grep -q "unsupported feature-root file" /tmp/bagakit-feature-tracker-boundary.err
grep -q "proposal.md" /tmp/bagakit-feature-tracker-boundary.err
grep -q "repo/release surfaces" /tmp/bagakit-feature-tracker-boundary.err

rm -f /tmp/bagakit-feature-tracker-boundary.out /tmp/bagakit-feature-tracker-boundary.err
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

python3 - "$TMP_DIR" "$ARCHIVE_BLOCKED_ID" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
feature_id = sys.argv[2]
state_path = root / ".bagakit" / "feature-tracker" / "features" / feature_id / "state.json"
state = json.loads(state_path.read_text(encoding="utf-8"))
state["status"] = "done"
state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
index_path = root / ".bagakit" / "feature-tracker" / "index" / "features.json"
index_payload = json.loads(index_path.read_text(encoding="utf-8"))
for item in index_payload.get("features", []):
    if item.get("feat_id") == feature_id:
        item["status"] = "done"
        break
else:
    raise SystemExit("archive blocked feature missing from index")
index_path.write_text(json.dumps(index_payload, indent=2) + "\n", encoding="utf-8")
PY

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

if bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Blocked create feature" --slug "blocked-create-feature" --goal "Create should preflight graph" --workspace-mode worktree >/tmp/bagakit-feature-tracker-create.out 2>/tmp/bagakit-feature-tracker-create.err; then
  echo "error: create-feature unexpectedly mutated state before graph validation" >&2
  exit 1
fi
grep -q "feat cannot depend on itself" /tmp/bagakit-feature-tracker-create.err
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
rm -f /tmp/bagakit-feature-tracker-create.out /tmp/bagakit-feature-tracker-create.err

if bash "$SKILL_DIR/scripts/feature-tracker.sh" archive-feature --root "$TMP_DIR" --feature "$ARCHIVE_BLOCKED_ID" >/tmp/bagakit-feature-tracker-archive.out 2>/tmp/bagakit-feature-tracker-archive.err; then
  echo "error: archive-feature unexpectedly cleaned up before graph preflight" >&2
  exit 1
fi
grep -q "feat cannot depend on itself" /tmp/bagakit-feature-tracker-archive.err
test -d "$TMP_DIR/.bagakit/feature-tracker/features/$ARCHIVE_BLOCKED_ID"
test ! -d "$TMP_DIR/.bagakit/feature-tracker/features-archived/$ARCHIVE_BLOCKED_ID"
rm -f /tmp/bagakit-feature-tracker-archive.out /tmp/bagakit-feature-tracker-archive.err

if bash "$SKILL_DIR/scripts/feature-tracker.sh" discard-feature --root "$TMP_DIR" --feature "$DISCARD_BLOCKED_ID" --reason superseded >/tmp/bagakit-feature-tracker-discard.out 2>/tmp/bagakit-feature-tracker-discard.err; then
  echo "error: discard-feature unexpectedly cleaned up before graph preflight" >&2
  exit 1
fi
grep -q "feat cannot depend on itself" /tmp/bagakit-feature-tracker-discard.err
test -d "$TMP_DIR/.bagakit/feature-tracker/features/$DISCARD_BLOCKED_ID"
test ! -d "$TMP_DIR/.bagakit/feature-tracker/features-discarded/$DISCARD_BLOCKED_ID"
rm -f /tmp/bagakit-feature-tracker-discard.out /tmp/bagakit-feature-tracker-discard.err

python3 - "$TMP_DIR" "$BOUNDARY_FEATURE_ID" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
feature_id = sys.argv[2]
state_path = root / ".bagakit" / "feature-tracker" / "features" / feature_id / "state.json"
state = json.loads(state_path.read_text(encoding="utf-8"))
state["depends_on"] = []
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
if bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Blocked create by branch collision" --slug "blocked-create-by-branch-collision" --goal "Reject existing branch before cursor persistence" --workspace-mode worktree >/tmp/bagakit-feature-tracker-worktree-branch.out 2>/tmp/bagakit-feature-tracker-worktree-branch.err; then
  echo "error: create-feature unexpectedly accepted colliding worktree branch" >&2
  exit 1
fi
grep -q "worktree branch already exists" /tmp/bagakit-feature-tracker-worktree-branch.err
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
rm -f /tmp/bagakit-feature-tracker-worktree-branch.out /tmp/bagakit-feature-tracker-worktree-branch.err

mkdir -p "$WORKTREE_COLLISION_PATH"
if bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Blocked create by worktree path collision" --slug "blocked-create-by-worktree-path-collision" --goal "Reject existing worktree path before cursor persistence" --workspace-mode worktree >/tmp/bagakit-feature-tracker-worktree-path.out 2>/tmp/bagakit-feature-tracker-worktree-path.err; then
  echo "error: create-feature unexpectedly accepted colliding worktree path" >&2
  exit 1
fi
grep -q "worktree path already exists" /tmp/bagakit-feature-tracker-worktree-path.err
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
rm -f /tmp/bagakit-feature-tracker-worktree-path.out /tmp/bagakit-feature-tracker-worktree-path.err

rm -f "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json"
FEATURE_COUNT_BEFORE_DAG_MISSING="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
print(len(payload.get("features", [])))
PY
)"
WORKTREE_COUNT_BEFORE_DAG_MISSING="$(git -C "$TMP_DIR" worktree list --porcelain | grep -c '^worktree ')"
if bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Blocked create by missing dag" --slug "blocked-create-by-missing-dag" --goal "Reject missing dag target" --workspace-mode worktree >/tmp/bagakit-feature-tracker-dag-missing-create.out 2>/tmp/bagakit-feature-tracker-dag-missing-create.err; then
  echo "error: create-feature unexpectedly accepted missing dag file" >&2
  exit 1
fi
grep -q "dag file missing" /tmp/bagakit-feature-tracker-dag-missing-create.err
FEATURE_COUNT_AFTER_DAG_MISSING="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
print(len(payload.get("features", [])))
PY
)"
WORKTREE_COUNT_AFTER_DAG_MISSING="$(git -C "$TMP_DIR" worktree list --porcelain | grep -c '^worktree ')"
test "$FEATURE_COUNT_BEFORE_DAG_MISSING" = "$FEATURE_COUNT_AFTER_DAG_MISSING"
test "$WORKTREE_COUNT_BEFORE_DAG_MISSING" = "$WORKTREE_COUNT_AFTER_DAG_MISSING"
rm -f /tmp/bagakit-feature-tracker-dag-missing-create.out /tmp/bagakit-feature-tracker-dag-missing-create.err

if bash "$SKILL_DIR/scripts/feature-tracker.sh" archive-feature --root "$TMP_DIR" --feature "$ARCHIVE_BLOCKED_ID" >/tmp/bagakit-feature-tracker-dag-missing-archive.out 2>/tmp/bagakit-feature-tracker-dag-missing-archive.err; then
  echo "error: archive-feature unexpectedly accepted missing dag file" >&2
  exit 1
fi
grep -q "dag file missing" /tmp/bagakit-feature-tracker-dag-missing-archive.err
test -d "$TMP_DIR/.bagakit/feature-tracker/features/$ARCHIVE_BLOCKED_ID"
test ! -d "$TMP_DIR/.bagakit/feature-tracker/features-archived/$ARCHIVE_BLOCKED_ID"
rm -f /tmp/bagakit-feature-tracker-dag-missing-archive.out /tmp/bagakit-feature-tracker-dag-missing-archive.err

if bash "$SKILL_DIR/scripts/feature-tracker.sh" discard-feature --root "$TMP_DIR" --feature "$DISCARD_BLOCKED_ID" --reason superseded >/tmp/bagakit-feature-tracker-dag-missing-discard.out 2>/tmp/bagakit-feature-tracker-dag-missing-discard.err; then
  echo "error: discard-feature unexpectedly accepted missing dag file" >&2
  exit 1
fi
grep -q "dag file missing" /tmp/bagakit-feature-tracker-dag-missing-discard.err
test -d "$TMP_DIR/.bagakit/feature-tracker/features/$DISCARD_BLOCKED_ID"
test ! -d "$TMP_DIR/.bagakit/feature-tracker/features-discarded/$DISCARD_BLOCKED_ID"
rm -f /tmp/bagakit-feature-tracker-dag-missing-archive.out /tmp/bagakit-feature-tracker-dag-missing-archive.err
rm -f /tmp/bagakit-feature-tracker-dag-missing-discard.out /tmp/bagakit-feature-tracker-dag-missing-discard.err

bash "$SKILL_DIR/scripts/feature-tracker.sh" replan-features --root "$TMP_DIR" >/dev/null

rm -f "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json"
mkdir "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json"
cat > "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json/README.txt" <<'EOF'
directory sentinel before direct-write commands
EOF
FEATURE_COUNT_BEFORE_DAG_SHAPE="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
print(len(payload.get("features", [])))
PY
)"
WORKTREE_COUNT_BEFORE_DAG_SHAPE="$(git -C "$TMP_DIR" worktree list --porcelain | grep -c '^worktree ')"
if bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Blocked create by dag shape" --slug "blocked-create-by-dag-shape" --goal "Reject directory-valued dag target" --workspace-mode worktree >/tmp/bagakit-feature-tracker-dag-shape-create.out 2>/tmp/bagakit-feature-tracker-dag-shape-create.err; then
  echo "error: create-feature unexpectedly accepted directory-valued dag target" >&2
  exit 1
fi
grep -q "dag target is not a regular file" /tmp/bagakit-feature-tracker-dag-shape-create.err
FEATURE_COUNT_AFTER_DAG_SHAPE="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
print(len(payload.get("features", [])))
PY
)"
WORKTREE_COUNT_AFTER_DAG_SHAPE="$(git -C "$TMP_DIR" worktree list --porcelain | grep -c '^worktree ')"
test "$FEATURE_COUNT_BEFORE_DAG_SHAPE" = "$FEATURE_COUNT_AFTER_DAG_SHAPE"
test "$WORKTREE_COUNT_BEFORE_DAG_SHAPE" = "$WORKTREE_COUNT_AFTER_DAG_SHAPE"
rm -f /tmp/bagakit-feature-tracker-dag-shape-create.out /tmp/bagakit-feature-tracker-dag-shape-create.err

if bash "$SKILL_DIR/scripts/feature-tracker.sh" archive-feature --root "$TMP_DIR" --feature "$ARCHIVE_BLOCKED_ID" >/tmp/bagakit-feature-tracker-dag-shape-archive.out 2>/tmp/bagakit-feature-tracker-dag-shape-archive.err; then
  echo "error: archive-feature unexpectedly accepted directory-valued dag target" >&2
  exit 1
fi
grep -q "dag target is not a regular file" /tmp/bagakit-feature-tracker-dag-shape-archive.err
test -d "$TMP_DIR/.bagakit/feature-tracker/features/$ARCHIVE_BLOCKED_ID"
test ! -d "$TMP_DIR/.bagakit/feature-tracker/features-archived/$ARCHIVE_BLOCKED_ID"
rm -f /tmp/bagakit-feature-tracker-dag-shape-archive.out /tmp/bagakit-feature-tracker-dag-shape-archive.err

if bash "$SKILL_DIR/scripts/feature-tracker.sh" discard-feature --root "$TMP_DIR" --feature "$DISCARD_BLOCKED_ID" --reason superseded >/tmp/bagakit-feature-tracker-dag-shape-discard.out 2>/tmp/bagakit-feature-tracker-dag-shape-discard.err; then
  echo "error: discard-feature unexpectedly accepted directory-valued dag target" >&2
  exit 1
fi
grep -q "dag target is not a regular file" /tmp/bagakit-feature-tracker-dag-shape-discard.err
test -d "$TMP_DIR/.bagakit/feature-tracker/features/$DISCARD_BLOCKED_ID"
test ! -d "$TMP_DIR/.bagakit/feature-tracker/features-discarded/$DISCARD_BLOCKED_ID"
rm -f /tmp/bagakit-feature-tracker-dag-shape-discard.out /tmp/bagakit-feature-tracker-dag-shape-discard.err

rm -rf "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json"
bash "$SKILL_DIR/scripts/feature-tracker.sh" replan-features --root "$TMP_DIR" >/dev/null
chmod 0444 "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json"
FEATURE_COUNT_BEFORE_DAG_NOWRITE="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
print(len(payload.get("features", [])))
PY
)"
WORKTREE_COUNT_BEFORE_DAG_NOWRITE="$(git -C "$TMP_DIR" worktree list --porcelain | grep -c '^worktree ')"
if bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Blocked create by unwritable dag" --slug "blocked-create-by-unwritable-dag" --goal "Reject unwritable dag target" --workspace-mode worktree >/tmp/bagakit-feature-tracker-dag-nowrite-create.out 2>/tmp/bagakit-feature-tracker-dag-nowrite-create.err; then
  echo "error: create-feature unexpectedly accepted unwritable dag file" >&2
  exit 1
fi
grep -q "dag target is not writable" /tmp/bagakit-feature-tracker-dag-nowrite-create.err
FEATURE_COUNT_AFTER_DAG_NOWRITE="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
print(len(payload.get("features", [])))
PY
)"
WORKTREE_COUNT_AFTER_DAG_NOWRITE="$(git -C "$TMP_DIR" worktree list --porcelain | grep -c '^worktree ')"
test "$FEATURE_COUNT_BEFORE_DAG_NOWRITE" = "$FEATURE_COUNT_AFTER_DAG_NOWRITE"
test "$WORKTREE_COUNT_BEFORE_DAG_NOWRITE" = "$WORKTREE_COUNT_AFTER_DAG_NOWRITE"
rm -f /tmp/bagakit-feature-tracker-dag-nowrite-create.out /tmp/bagakit-feature-tracker-dag-nowrite-create.err

if bash "$SKILL_DIR/scripts/feature-tracker.sh" archive-feature --root "$TMP_DIR" --feature "$ARCHIVE_BLOCKED_ID" >/tmp/bagakit-feature-tracker-dag-nowrite-archive.out 2>/tmp/bagakit-feature-tracker-dag-nowrite-archive.err; then
  echo "error: archive-feature unexpectedly accepted unwritable dag file" >&2
  exit 1
fi
grep -q "dag target is not writable" /tmp/bagakit-feature-tracker-dag-nowrite-archive.err
test -d "$TMP_DIR/.bagakit/feature-tracker/features/$ARCHIVE_BLOCKED_ID"
test ! -d "$TMP_DIR/.bagakit/feature-tracker/features-archived/$ARCHIVE_BLOCKED_ID"
rm -f /tmp/bagakit-feature-tracker-dag-nowrite-archive.out /tmp/bagakit-feature-tracker-dag-nowrite-archive.err

if bash "$SKILL_DIR/scripts/feature-tracker.sh" discard-feature --root "$TMP_DIR" --feature "$DISCARD_BLOCKED_ID" --reason superseded >/tmp/bagakit-feature-tracker-dag-nowrite-discard.out 2>/tmp/bagakit-feature-tracker-dag-nowrite-discard.err; then
  echo "error: discard-feature unexpectedly accepted unwritable dag file" >&2
  exit 1
fi
grep -q "dag target is not writable" /tmp/bagakit-feature-tracker-dag-nowrite-discard.err
test -d "$TMP_DIR/.bagakit/feature-tracker/features/$DISCARD_BLOCKED_ID"
test ! -d "$TMP_DIR/.bagakit/feature-tracker/features-discarded/$DISCARD_BLOCKED_ID"
rm -f /tmp/bagakit-feature-tracker-dag-nowrite-discard.out /tmp/bagakit-feature-tracker-dag-nowrite-discard.err
chmod 0644 "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json"
rm -rf "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json"
mkdir "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json"
cat > "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json/README.txt" <<'EOF'
directory sentinel before show-feature-dag
EOF

if bash "$SKILL_DIR/scripts/feature-tracker.sh" show-feature-dag --root "$TMP_DIR" >/tmp/bagakit-feature-tracker-show-dag-dir.out 2>/tmp/bagakit-feature-tracker-show-dag-dir.err; then
  echo "error: show-feature-dag unexpectedly accepted directory-valued dag path" >&2
  exit 1
fi
grep -q "dag file is not a regular file" /tmp/bagakit-feature-tracker-show-dag-dir.err
grep -q "run feature-tracker.sh replan-features to regenerate FEATURES_DAG.json" /tmp/bagakit-feature-tracker-show-dag-dir.err
rm -f /tmp/bagakit-feature-tracker-show-dag-dir.out /tmp/bagakit-feature-tracker-show-dag-dir.err

bash "$SKILL_DIR/scripts/feature-tracker.sh" replan-features --root "$TMP_DIR" >/dev/null

DAG_PATH="$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json"
DAG_SYMLINK_TARGET="$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.symlink-target.json"
mv "$DAG_PATH" "$DAG_SYMLINK_TARGET"
ln -s "$(basename "$DAG_SYMLINK_TARGET")" "$DAG_PATH"
FEATURE_COUNT_BEFORE_DAG_SYMLINK="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
print(len(payload.get("features", [])))
PY
)"
WORKTREE_COUNT_BEFORE_DAG_SYMLINK="$(git -C "$TMP_DIR" worktree list --porcelain | grep -c '^worktree ')"
if bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Blocked create by dag symlink" --slug "blocked-create-by-dag-symlink" --goal "Reject symlink dag target" --workspace-mode worktree >/tmp/bagakit-feature-tracker-dag-symlink-create.out 2>/tmp/bagakit-feature-tracker-dag-symlink-create.err; then
  echo "error: create-feature unexpectedly accepted symlink dag target" >&2
  exit 1
fi
grep -q "dag target is not a regular file" /tmp/bagakit-feature-tracker-dag-symlink-create.err
FEATURE_COUNT_AFTER_DAG_SYMLINK="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
print(len(payload.get("features", [])))
PY
)"
WORKTREE_COUNT_AFTER_DAG_SYMLINK="$(git -C "$TMP_DIR" worktree list --porcelain | grep -c '^worktree ')"
test "$FEATURE_COUNT_BEFORE_DAG_SYMLINK" = "$FEATURE_COUNT_AFTER_DAG_SYMLINK"
test "$WORKTREE_COUNT_BEFORE_DAG_SYMLINK" = "$WORKTREE_COUNT_AFTER_DAG_SYMLINK"
rm -f /tmp/bagakit-feature-tracker-dag-symlink-create.out /tmp/bagakit-feature-tracker-dag-symlink-create.err

if bash "$SKILL_DIR/scripts/feature-tracker.sh" archive-feature --root "$TMP_DIR" --feature "$ARCHIVE_BLOCKED_ID" >/tmp/bagakit-feature-tracker-dag-symlink-archive.out 2>/tmp/bagakit-feature-tracker-dag-symlink-archive.err; then
  echo "error: archive-feature unexpectedly accepted symlink dag target" >&2
  exit 1
fi
grep -q "dag target is not a regular file" /tmp/bagakit-feature-tracker-dag-symlink-archive.err
test -d "$TMP_DIR/.bagakit/feature-tracker/features/$ARCHIVE_BLOCKED_ID"
test ! -d "$TMP_DIR/.bagakit/feature-tracker/features-archived/$ARCHIVE_BLOCKED_ID"
rm -f /tmp/bagakit-feature-tracker-dag-symlink-archive.out /tmp/bagakit-feature-tracker-dag-symlink-archive.err

if bash "$SKILL_DIR/scripts/feature-tracker.sh" discard-feature --root "$TMP_DIR" --feature "$DISCARD_BLOCKED_ID" --reason superseded >/tmp/bagakit-feature-tracker-dag-symlink-discard.out 2>/tmp/bagakit-feature-tracker-dag-symlink-discard.err; then
  echo "error: discard-feature unexpectedly accepted symlink dag target" >&2
  exit 1
fi
grep -q "dag target is not a regular file" /tmp/bagakit-feature-tracker-dag-symlink-discard.err
test -d "$TMP_DIR/.bagakit/feature-tracker/features/$DISCARD_BLOCKED_ID"
test ! -d "$TMP_DIR/.bagakit/feature-tracker/features-discarded/$DISCARD_BLOCKED_ID"
rm -f /tmp/bagakit-feature-tracker-dag-symlink-discard.out /tmp/bagakit-feature-tracker-dag-symlink-discard.err

if bash "$SKILL_DIR/scripts/feature-tracker.sh" show-feature-dag --root "$TMP_DIR" >/tmp/bagakit-feature-tracker-show-dag-symlink.out 2>/tmp/bagakit-feature-tracker-show-dag-symlink.err; then
  echo "error: show-feature-dag unexpectedly accepted symlink dag path" >&2
  exit 1
fi
grep -q "dag file is not a regular file" /tmp/bagakit-feature-tracker-show-dag-symlink.err
grep -q "run feature-tracker.sh replan-features to regenerate FEATURES_DAG.json" /tmp/bagakit-feature-tracker-show-dag-symlink.err
rm -f /tmp/bagakit-feature-tracker-show-dag-symlink.out /tmp/bagakit-feature-tracker-show-dag-symlink.err

if bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/tmp/bagakit-feature-tracker-validate-dag-symlink.out 2>/tmp/bagakit-feature-tracker-validate-dag-symlink.err; then
  echo "error: validate-tracker unexpectedly accepted symlink dag path" >&2
  exit 1
fi
grep -q "dag file is not a regular file" /tmp/bagakit-feature-tracker-validate-dag-symlink.err
grep -q "run feature-tracker.sh replan-features to regenerate FEATURES_DAG.json" /tmp/bagakit-feature-tracker-validate-dag-symlink.err
rm -f /tmp/bagakit-feature-tracker-validate-dag-symlink.out /tmp/bagakit-feature-tracker-validate-dag-symlink.err

rm -f "$DAG_PATH"
mv "$DAG_SYMLINK_TARGET" "$DAG_PATH"

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
bash "$SKILL_DIR/scripts/feature-tracker.sh" assign-feature-workspace --root "$TMP_DIR" --feature "$DIRTY_DISCARD_ID" --workspace-mode current_tree >/dev/null
cat > "$TMP_DIR/DIRTY.md" <<'EOF'
root dirty change
EOF
if bash "$SKILL_DIR/scripts/feature-tracker.sh" discard-feature --root "$TMP_DIR" --feature "$DIRTY_DISCARD_ID" --reason superseded >/tmp/bagakit-feature-tracker-dirty-discard.out 2>/tmp/bagakit-feature-tracker-dirty-discard.err; then
  echo "error: dirty current_tree discard unexpectedly succeeded" >&2
  exit 1
fi
grep -q "current_tree feature has non-harness changes" /tmp/bagakit-feature-tracker-dirty-discard.err
test ! -d "$TMP_DIR/.bagakit/feature-tracker/features/$DIRTY_DISCARD_ID/artifacts"
rm -f "$TMP_DIR/DIRTY.md" /tmp/bagakit-feature-tracker-dirty-discard.out /tmp/bagakit-feature-tracker-dirty-discard.err

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

if bash "$SKILL_DIR/scripts/feature-tracker.sh" replan-features --root "$TMP_DIR" --dependency "$CYCLE_A_ID:$CYCLE_B_ID" --dependency "$CYCLE_B_ID:$CYCLE_A_ID" >/tmp/bagakit-feature-tracker-replan.out 2>/tmp/bagakit-feature-tracker-replan.err; then
  echo "error: cyclic replan unexpectedly succeeded" >&2
  exit 1
fi
grep -q "dependency cycle detected" /tmp/bagakit-feature-tracker-replan.err
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
rm -f /tmp/bagakit-feature-tracker-replan.out /tmp/bagakit-feature-tracker-replan.err

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
rm -f "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json"
if bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/tmp/bagakit-feature-tracker-validate.out 2>/tmp/bagakit-feature-tracker-validate.err; then
  echo "error: missing DAG unexpectedly bypassed canonical graph validation" >&2
  exit 1
fi
grep -q "missing dag file" /tmp/bagakit-feature-tracker-validate.err
grep -q "run feature-tracker.sh replan-features to regenerate FEATURES_DAG.json" /tmp/bagakit-feature-tracker-validate.err
grep -q "dependency cycle detected" /tmp/bagakit-feature-tracker-validate.err
rm -f /tmp/bagakit-feature-tracker-validate.out /tmp/bagakit-feature-tracker-validate.err

python3 - "$TMP_DIR" "$CYCLE_A_ID" "$CYCLE_B_ID" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
for feature_id in (sys.argv[2], sys.argv[3]):
    state_path = root / ".bagakit" / "feature-tracker" / "features" / feature_id / "state.json"
    state = json.loads(state_path.read_text(encoding="utf-8"))
    state["depends_on"] = []
    state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
PY
cat > "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json" <<'EOF'
{
  "version": 1,
  "generated_by": "bagakit-feature-tracker",
  "features": [[]],
  "layers": [],
  "notes": []
}
EOF
if bash "$SKILL_DIR/scripts/feature-tracker.sh" show-feature-dag --root "$TMP_DIR" >/tmp/bagakit-feature-tracker-show-dag-schema.out 2>/tmp/bagakit-feature-tracker-show-dag-schema.err; then
  echo "error: show-feature-dag unexpectedly accepted schema-invalid dag payload" >&2
  exit 1
fi
grep -q "invalid dag feature entry" /tmp/bagakit-feature-tracker-show-dag-schema.err
grep -q "run feature-tracker.sh replan-features to regenerate FEATURES_DAG.json" /tmp/bagakit-feature-tracker-show-dag-schema.err
rm -f /tmp/bagakit-feature-tracker-show-dag-schema.out /tmp/bagakit-feature-tracker-show-dag-schema.err
cat > "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json" <<EOF
{
  "version": 1,
  "generated_by": "bagakit-feature-tracker",
  "features": [
    {
      "feat_id": "$CYCLE_A_ID",
      "depends_on": [],
      "dependents": [],
      "layer": true
    }
  ],
  "layers": [
    {
      "layer": true,
      "feat_ids": ["$CYCLE_A_ID"]
    }
  ],
  "notes": []
}
EOF
if bash "$SKILL_DIR/scripts/feature-tracker.sh" show-feature-dag --root "$TMP_DIR" >/tmp/bagakit-feature-tracker-show-dag-bool-layer.out 2>/tmp/bagakit-feature-tracker-show-dag-bool-layer.err; then
  echo "error: show-feature-dag unexpectedly accepted boolean dag layers" >&2
  exit 1
fi
grep -q "invalid dag layer value for feature\\[0\\]" /tmp/bagakit-feature-tracker-show-dag-bool-layer.err
grep -q "run feature-tracker.sh replan-features to regenerate FEATURES_DAG.json" /tmp/bagakit-feature-tracker-show-dag-bool-layer.err
rm -f /tmp/bagakit-feature-tracker-show-dag-bool-layer.out /tmp/bagakit-feature-tracker-show-dag-bool-layer.err
if bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/tmp/bagakit-feature-tracker-validate-bool-layer.out 2>/tmp/bagakit-feature-tracker-validate-bool-layer.err; then
  echo "error: validate-tracker unexpectedly accepted boolean dag layers" >&2
  exit 1
fi
grep -q "invalid dag layer value for feature\\[0\\]" /tmp/bagakit-feature-tracker-validate-bool-layer.err
grep -q "invalid dag layer id\\[0\\]" /tmp/bagakit-feature-tracker-validate-bool-layer.err
rm -f /tmp/bagakit-feature-tracker-validate-bool-layer.out /tmp/bagakit-feature-tracker-validate-bool-layer.err
cat > "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json" <<EOF
{
  "features": [
    {
      "feat_id": "$CYCLE_A_ID",
      "depends_on": [],
      "dependents": []
    }
  ],
  "layers": [
    {
      "layer": 0,
      "feat_ids": ["$CYCLE_A_ID"]
    }
  ],
  "notes": []
}
EOF
if bash "$SKILL_DIR/scripts/feature-tracker.sh" show-feature-dag --root "$TMP_DIR" >/tmp/bagakit-feature-tracker-show-dag-missing-fields.out 2>/tmp/bagakit-feature-tracker-show-dag-missing-fields.err; then
  echo "error: show-feature-dag unexpectedly accepted dag payload missing stable contract fields" >&2
  exit 1
fi
grep -q "missing dag version field" /tmp/bagakit-feature-tracker-show-dag-missing-fields.err
grep -q "run feature-tracker.sh replan-features to regenerate FEATURES_DAG.json" /tmp/bagakit-feature-tracker-show-dag-missing-fields.err
rm -f /tmp/bagakit-feature-tracker-show-dag-missing-fields.out /tmp/bagakit-feature-tracker-show-dag-missing-fields.err
if bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/tmp/bagakit-feature-tracker-validate-missing-fields.out 2>/tmp/bagakit-feature-tracker-validate-missing-fields.err; then
  echo "error: validate-tracker unexpectedly accepted dag payload missing stable contract fields" >&2
  exit 1
fi
grep -q "missing dag version field" /tmp/bagakit-feature-tracker-validate-missing-fields.err
grep -q "missing dag generated_by field" /tmp/bagakit-feature-tracker-validate-missing-fields.err
grep -q "missing dag layer field for feature\\[0\\]" /tmp/bagakit-feature-tracker-validate-missing-fields.err
rm -f /tmp/bagakit-feature-tracker-validate-missing-fields.out /tmp/bagakit-feature-tracker-validate-missing-fields.err
printf 'not json\n' > "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json"
if bash "$SKILL_DIR/scripts/feature-tracker.sh" show-feature-dag --root "$TMP_DIR" >/tmp/bagakit-feature-tracker-show-dag-json.out 2>/tmp/bagakit-feature-tracker-show-dag-json.err; then
  echo "error: show-feature-dag unexpectedly accepted malformed dag json" >&2
  exit 1
fi
grep -q "failed to read dag file" /tmp/bagakit-feature-tracker-show-dag-json.err
grep -q "run feature-tracker.sh replan-features to regenerate FEATURES_DAG.json" /tmp/bagakit-feature-tracker-show-dag-json.err
rm -f /tmp/bagakit-feature-tracker-show-dag-json.out /tmp/bagakit-feature-tracker-show-dag-json.err
bash "$SKILL_DIR/scripts/feature-tracker.sh" replan-features --root "$TMP_DIR" --clear-dependencies "$CYCLE_A_ID" --clear-dependencies "$CYCLE_B_ID" >/dev/null
python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
archive_dir = root / ".bagakit" / "feature-tracker" / "index" / "archive"
archived = sorted(archive_dir.glob("dag-*.json"))
if not archived:
    raise SystemExit("missing archived dag after malformed replan")
assert archived[-1].read_text(encoding="utf-8") == "not json\n"
dag_path = root / ".bagakit" / "feature-tracker" / "index" / "FEATURES_DAG.json"
json.loads(dag_path.read_text(encoding="utf-8"))
PY

rm -f "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json"
mkdir "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json"
cat > "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json/README.txt" <<'EOF'
directory sentinel
EOF
bash "$SKILL_DIR/scripts/feature-tracker.sh" replan-features --root "$TMP_DIR" --clear-dependencies "$CYCLE_A_ID" --clear-dependencies "$CYCLE_B_ID" >/dev/null
python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
archive_dir = root / ".bagakit" / "feature-tracker" / "index" / "archive"
archived_dirs = sorted(path for path in archive_dir.glob("dag-*.json") if path.is_dir())
if not archived_dirs:
    raise SystemExit("missing archived non-regular dag path after replan")
assert (archived_dirs[-1] / "README.txt").read_text(encoding="utf-8") == "directory sentinel\n"
dag_path = root / ".bagakit" / "feature-tracker" / "index" / "FEATURES_DAG.json"
assert dag_path.is_file()
json.loads(dag_path.read_text(encoding="utf-8"))
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
if bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/tmp/bagakit-feature-tracker-deps.out 2>/tmp/bagakit-feature-tracker-deps.err; then
  echo "error: non-list/string depends_on unexpectedly accepted" >&2
  exit 1
fi
grep -q "depends_on must be a list of feature ids" /tmp/bagakit-feature-tracker-deps.err
rm -f /tmp/bagakit-feature-tracker-deps.out /tmp/bagakit-feature-tracker-deps.err
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

bash "$SKILL_DIR/scripts/feature-tracker.sh" materialize-feature-artifact --root "$TMP_DIR" --feature "$CLOSEOUT_FEATURE_ID" --kind proposal >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" materialize-feature-artifact --root "$TMP_DIR" --feature "$CLOSEOUT_FEATURE_ID" --kind verification >/dev/null
CLOSEOUT_DIR="$TMP_DIR/.bagakit/feature-tracker/features/$CLOSEOUT_FEATURE_ID"
cat > "$CLOSEOUT_DIR/ui-verification.md" <<'EOF'
legacy ui verification
EOF
cat > "$CLOSEOUT_DIR/summary.md" <<'EOF'
operator-authored active summary
EOF
cat > "$CLOSEOUT_DIR/PRD.md" <<'EOF'
legacy product doc
EOF
mkdir -p "$CLOSEOUT_DIR/notes-dir"
cat > "$CLOSEOUT_DIR/notes-dir/notes.txt" <<'EOF'
legacy notes
EOF
python3 - "$TMP_DIR" "$CLOSEOUT_FEATURE_ID" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
feature_id = sys.argv[2]
state_path = root / ".bagakit" / "feature-tracker" / "features" / feature_id / "state.json"
state = json.loads(state_path.read_text(encoding="utf-8"))
state["status"] = "done"
state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
PY
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
grep -q "operator-authored active summary" "$ARCHIVED_CLOSEOUT_DIR/artifacts/closeout-preserved-root/summary.md"
SUMMARY_SHA_BEFORE="$(shasum "$ARCHIVED_CLOSEOUT_DIR/summary.md" | awk '{print $1}')"
rm -f "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json"
bash "$SKILL_DIR/scripts/feature-tracker.sh" archive-feature --root "$TMP_DIR" --feature "$CLOSEOUT_FEATURE_ID" >/dev/null
SUMMARY_SHA_AFTER="$(shasum "$ARCHIVED_CLOSEOUT_DIR/summary.md" | awk '{print $1}')"
test "$SUMMARY_SHA_BEFORE" = "$SUMMARY_SHA_AFTER"
test -f "$ARCHIVED_CLOSEOUT_DIR/summary.md"
grep -q "operator-authored active summary" "$ARCHIVED_CLOSEOUT_DIR/artifacts/closeout-preserved-root/summary.md"
test -f "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json"
rm -rf "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json"
mkdir "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json"
bash "$SKILL_DIR/scripts/feature-tracker.sh" archive-feature --root "$TMP_DIR" --feature "$CLOSEOUT_FEATURE_ID" >/dev/null
SUMMARY_SHA_AFTER_DIR_HEAL="$(shasum "$ARCHIVED_CLOSEOUT_DIR/summary.md" | awk '{print $1}')"
test "$SUMMARY_SHA_BEFORE" = "$SUMMARY_SHA_AFTER_DIR_HEAL"
test -f "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json"
python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

dag_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "FEATURES_DAG.json"
payload = json.loads(dag_path.read_text(encoding="utf-8"))
payload.setdefault("notes", []).append("manual drift sentinel")
dag_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
PY
DRIFTED_DAG_SHA_BEFORE="$(shasum "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json" | awk '{print $1}')"
bash "$SKILL_DIR/scripts/feature-tracker.sh" archive-feature --root "$TMP_DIR" --feature "$CLOSEOUT_FEATURE_ID" >/dev/null
DRIFTED_DAG_SHA_AFTER="$(shasum "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json" | awk '{print $1}')"
test "$DRIFTED_DAG_SHA_BEFORE" = "$DRIFTED_DAG_SHA_AFTER"
grep -q "manual drift sentinel" "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json"
bash "$SKILL_DIR/scripts/feature-tracker.sh" replan-features --root "$TMP_DIR" >/dev/null
if bash "$SKILL_DIR/scripts/feature-tracker.sh" materialize-feature-artifact --root "$TMP_DIR" --feature "$CLOSEOUT_FEATURE_ID" --kind verification >/tmp/bagakit-feature-tracker-closed.out 2>/tmp/bagakit-feature-tracker-closed.err; then
  echo "error: closed feature unexpectedly allowed helper materialization" >&2
  exit 1
fi
grep -q "live-feature helper files are not materializable after closeout" /tmp/bagakit-feature-tracker-closed.err
rm -f /tmp/bagakit-feature-tracker-closed.out /tmp/bagakit-feature-tracker-closed.err
bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/dev/null

mkdir -p "$TMP_DIR/.bagakit/feature-tracker/feats/legacy-test"
if bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/tmp/bagakit-feature-tracker-legacy.out 2>/tmp/bagakit-feature-tracker-legacy.err; then
  echo "error: legacy feats directory unexpectedly accepted" >&2
  exit 1
fi
grep -q "repair: move contents to .bagakit/feature-tracker/features/" /tmp/bagakit-feature-tracker-legacy.err
rm -f /tmp/bagakit-feature-tracker-legacy.out /tmp/bagakit-feature-tracker-legacy.err

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

if bash "$SKILL_DIR/scripts/feature-tracker.sh" archive-feature --root "$TMP_DIR" --feature "$FALSE_ARCHIVE_ID" >/tmp/bagakit-feature-tracker-false-archive.out 2>/tmp/bagakit-feature-tracker-false-archive.err; then
  echo "error: archive-feature falsely accepted active-root archived state" >&2
  exit 1
fi
grep -q "claims status=archived but still lives under features/" /tmp/bagakit-feature-tracker-false-archive.err
test -d "$TMP_DIR/.bagakit/feature-tracker/features/$FALSE_ARCHIVE_ID"
test ! -d "$TMP_DIR/.bagakit/feature-tracker/features-archived/$FALSE_ARCHIVE_ID"
rm -f /tmp/bagakit-feature-tracker-false-archive.out /tmp/bagakit-feature-tracker-false-archive.err

if bash "$SKILL_DIR/scripts/feature-tracker.sh" discard-feature --root "$TMP_DIR" --feature "$FALSE_DISCARD_ID" --reason superseded >/tmp/bagakit-feature-tracker-false-discard.out 2>/tmp/bagakit-feature-tracker-false-discard.err; then
  echo "error: discard-feature falsely accepted active-root discarded state" >&2
  exit 1
fi
grep -q "claims status=discarded but still lives under features/" /tmp/bagakit-feature-tracker-false-discard.err
test -d "$TMP_DIR/.bagakit/feature-tracker/features/$FALSE_DISCARD_ID"
test ! -d "$TMP_DIR/.bagakit/feature-tracker/features-discarded/$FALSE_DISCARD_ID"
rm -f /tmp/bagakit-feature-tracker-false-discard.out /tmp/bagakit-feature-tracker-false-discard.err

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
rm -f "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json"
if ! bash "$SKILL_DIR/scripts/feature-tracker.sh" archive-feature --root "$TMP_DIR" --feature "$CLOSEOUT_FEATURE_ID" >/tmp/bagakit-feature-tracker-closed-broken.out 2>/tmp/bagakit-feature-tracker-closed-broken.err; then
  echo "error: already-closed archive-feature unexpectedly failed on unrelated active-graph breakage" >&2
  exit 1
fi
grep -q "skipped FEATURES_DAG.json repair on already-closed rerun" /tmp/bagakit-feature-tracker-closed-broken.err
grep -q "feat cannot depend on itself" /tmp/bagakit-feature-tracker-closed-broken.err
test ! -e "$TMP_DIR/.bagakit/feature-tracker/index/FEATURES_DAG.json"
rm -f /tmp/bagakit-feature-tracker-closed-broken.out /tmp/bagakit-feature-tracker-closed-broken.err
bash "$SKILL_DIR/scripts/feature-tracker.sh" replan-features --root "$TMP_DIR" --clear-dependencies "$BROKEN_ACTIVE_ID" >/dev/null

echo "ok: bagakit-feature-tracker legacy regression passed"
