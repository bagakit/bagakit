set -euo pipefail

ROOT="${2:-.}"
if [[ ${1:---root} != --root || $# -gt 2 ]]; then
  echo 'usage: check-feature-tracker-projection-repair.sh [--root path]' >&2
  exit 2
fi
ROOT="$(cd "$ROOT" && pwd)"
SKILL_DIR="${FEATURE_TRACKER_TEST_SKILL_DIR:-$ROOT/skills/co-work/orchestrate/execution/bagakit-feature-tracker}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
source "$ROOT/gate_validation/skills/co-work/orchestrate/execution/bagakit-feature-tracker/lib/feature-tracker-testlib.sh"
feature_tracker_init_temp_repo "$TMP_DIR"
tracker() { local command="$1"; shift; bash "$SKILL_DIR/scripts/feature-tracker.sh" "$command" --root "$TMP_DIR" "$@"; }
tracker initialize-tracker >/dev/null
TASK_PLAN="$TMP_DIR/.bagakit/feature-tracker/artifacts/reviewed-task-plan.json"
feature_tracker_write_reviewed_task_plan "$TASK_PLAN"
tracker create-feature --title 'Rebind live path' --goal 'Gates follow the new binding without modifying the former worktree.' \
  --workspace-mode worktree --tasks-file "$TASK_PLAN" >/dev/null
FEATURE_ID="$(feature_tracker_feature_id_by_title "$TMP_DIR" 'Rebind live path')"
WORKTREE_PATH="$(feature_tracker_worktree_path "$TMP_DIR" "$FEATURE_ID")"
WORKTREE_HEAD="$(git -C "$WORKTREE_PATH" rev-parse HEAD)"
printf 'former workspace user content\n' > "$WORKTREE_PATH/retained.txt"
tracker start-task --feature "$FEATURE_ID" --task T-001 >/dev/null
if tracker assign-feature-workspace --feature "$FEATURE_ID" --workspace-mode current_tree >"$TMP_DIR/.bagakit/feature-tracker/artifacts/active-rebind.log" 2>&1; then
  echo 'error: active Task allowed a workspace rebind' >&2
  exit 1
fi
tracker finish-task --feature "$FEATURE_ID" --task T-001 --result cancelled \
  --cancel-reason 'The fixture abandons the old execution binding before review.' >/dev/null
tracker assign-feature-workspace --feature "$FEATURE_ID" --workspace-mode current_tree >/dev/null
test "$(git -C "$WORKTREE_PATH" rev-parse HEAD)" = "$WORKTREE_HEAD"
test "$(cat "$WORKTREE_PATH/retained.txt")" = 'former workspace user content'
python3 - "$TMP_DIR" "$FEATURE_ID" <<'PY'
import json, sys
from pathlib import Path
r = Path(sys.argv[1]) / '.bagakit/feature-tracker/features' / sys.argv[2]
s = json.loads((r / 'state.json').read_text())
t = json.loads((r / 'tasks.json').read_text())
assert s['workspace_mode'] == 'current_tree'
assert [s[k] for k in ('branch','worktree_name','worktree_path')] == ['', '', '']
assert t['tasks'][0]['status'] == 'cancelled'
assert any('worktree:' in h['detail'] and '-> current_tree' in h['detail'] for h in s['history'])
PY

git -C "$TMP_DIR" add .gitignore
git -C "$TMP_DIR" commit -q -m 'record workspace ignore rule'

tracker create-feature --title 'Transferred source' --goal 'Preserve valid reciprocal lineage after the successor closes.' \
  --workspace-mode current_tree --tasks-file "$TASK_PLAN" >/dev/null
SOURCE_ID="$(feature_tracker_feature_id_by_title "$TMP_DIR" 'Transferred source')"
tracker create-feature --title 'Closed successor' --goal 'Deliver transferred work.' \
  --workspace-mode current_tree --tasks-file "$TASK_PLAN" --transferred-from "$SOURCE_ID" >/dev/null
SUCCESSOR_ID="$(feature_tracker_feature_id_by_title "$TMP_DIR" 'Closed successor')"
tracker transfer-feature --feature "$SOURCE_ID" --replacement "$SUCCESSOR_ID" \
  "${FEATURE_TRACKER_CLOSEOUT_REVIEW_ARGS[@]}" >/dev/null
tracker start-task --feature "$SUCCESSOR_ID" --task T-001 >/dev/null
tracker run-task-gate --feature "$SUCCESSOR_ID" --task T-001 >/dev/null
tracker finish-task --feature "$SUCCESSOR_ID" --task T-001 --result done >/dev/null
tracker archive-feature --feature "$SUCCESSOR_ID" "${FEATURE_TRACKER_CLOSEOUT_REVIEW_ARGS[@]}" >/dev/null
tracker validate-tracker >/dev/null

python3 - "$TMP_DIR" "$FEATURE_ID" "$SUCCESSOR_ID" <<'PY'
import hashlib, json, sys
from pathlib import Path
r = Path(sys.argv[1]) / '.bagakit/feature-tracker'
canonical = {str(p.relative_to(r)): hashlib.sha256(p.read_bytes()).hexdigest()
             for d in ('features','features-archived','features-transferred')
             for p in (r / d).glob('*/[st]*.json')}
(Path(sys.argv[1]) / 'canonical.json').write_text(json.dumps(canonical))
ip = r / 'index/features.json'
index = json.loads(ip.read_text())
index['features'] = [f for f in index['features'] if f['feat_id'] != sys.argv[3]]
next(f for f in index['features'] if f['feat_id'] == sys.argv[2])['title'] = 'Drifted title'
ip.write_text(json.dumps(index))
for p in r.glob('features*/*/owner-receipt.json'):
    p.write_text('{}')
PY
if tracker validate-tracker >"$TMP_DIR/drift.log" 2>&1; then
  echo 'error: damaged projections were accepted' >&2
  exit 1
fi
tracker repair-feature-projections >/dev/null
tracker validate-tracker >/dev/null
python3 - "$TMP_DIR" <<'PY'
import hashlib, json, sys
from pathlib import Path
root = Path(sys.argv[1]); r = root / '.bagakit/feature-tracker'
before = json.loads((root / 'canonical.json').read_text())
assert before
after = {name: hashlib.sha256((r / name).read_bytes()).hexdigest() for name in before}
assert after == before, 'projection repair changed canonical state or tasks'
index = json.loads((r / 'index/features.json').read_text())
assert len(index['features']) == 3
assert {f['status'] for f in index['features']} == {'replanning','transferred','archived'}
PY

# Reciprocal lineage remains mandatory even after both Features are closed.
python3 - "$TMP_DIR" "$SUCCESSOR_ID" <<'PY'
import json, sys
from pathlib import Path
p = Path(sys.argv[1]) / '.bagakit/feature-tracker/features-archived' / sys.argv[2] / 'state.json'
s = json.loads(p.read_text()); s.pop('transferred_from'); p.write_text(json.dumps(s))
PY
tracker repair-feature-projections >/dev/null
if tracker validate-tracker >"$TMP_DIR/backlink.log" 2>&1; then
  echo 'error: closed successor without reciprocal lineage was accepted' >&2
  exit 1
fi
grep -F 'missing transferred_from backlink' "$TMP_DIR/backlink.log" >/dev/null
echo 'ok: workspace rebind, closed successor lineage, and projection repair'
