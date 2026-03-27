feature_tracker_init_temp_repo() {
  local repo_root="$1"
  git -C "$repo_root" init -q -b main
  git -C "$repo_root" config user.name "Bagakit"
  git -C "$repo_root" config user.email "bagakit@example.com"
  printf '# demo\n' > "$repo_root/README.md"
  git -C "$repo_root" add README.md
  git -C "$repo_root" commit -q -m "init"
}

feature_tracker_feature_id_by_title() {
  local repo_root="$1"
  local title="$2"
  python3 - "$repo_root" "$title" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
title = sys.argv[2]
index_path = root / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
for item in payload.get("features", []):
    if item.get("title") == title:
        print(item["feat_id"])
        break
else:
    raise SystemExit(f"feature not found by title: {title}")
PY
}

feature_tracker_worktree_path() {
  local repo_root="$1"
  local feature_id="$2"
  python3 - "$repo_root" "$feature_id" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
feature_id = sys.argv[2]
state_path = root / ".bagakit" / "feature-tracker" / "features" / feature_id / "state.json"
state = json.loads(state_path.read_text(encoding="utf-8"))
print(root / state["worktree_path"])
PY
}

feature_tracker_worktree_branch() {
  local repo_root="$1"
  local feature_id="$2"
  python3 - "$repo_root" "$feature_id" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
feature_id = sys.argv[2]
state_path = root / ".bagakit" / "feature-tracker" / "features" / feature_id / "state.json"
state = json.loads(state_path.read_text(encoding="utf-8"))
print(state["branch"])
PY
}

feature_tracker_set_non_ui_gate() {
  local repo_root="$1"
  local command="$2"
  python3 - "$repo_root" "$command" <<'PY'
import json
import sys
from pathlib import Path

policy_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "runtime-policy.json"
command = sys.argv[2]
policy = json.loads(policy_path.read_text(encoding="utf-8"))
policy.setdefault("gate", {})["project_type"] = "non_ui"
policy["gate"]["verification_policy"] = "never"
policy["gate"]["non_ui_commands"] = [command]
policy_path.write_text(json.dumps(policy, indent=2) + "\n", encoding="utf-8")
PY
}

feature_tracker_last_commit_hash() {
  local repo_root="$1"
  local feature_id="$2"
  python3 - "$repo_root" "$feature_id" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
feature_id = sys.argv[2]
tasks_path = root / ".bagakit" / "feature-tracker" / "features" / feature_id / "tasks.json"
tasks = json.loads(tasks_path.read_text(encoding="utf-8"))
commit_hash = tasks["tasks"][0].get("last_commit_hash")
if not isinstance(commit_hash, str) or not commit_hash:
    raise SystemExit("last_commit_hash missing after executed worktree commit")
print(commit_hash)
PY
}
