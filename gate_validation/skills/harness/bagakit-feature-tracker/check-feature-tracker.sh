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

bash "$SKILL_DIR/scripts/feature-tracker.sh" check-reference-readiness --root "$TMP_DIR" >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" initialize-tracker --root "$TMP_DIR"
ISSUER_NAMESPACE_BEFORE="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

issuer_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "local" / "issuer.json"
payload = json.loads(issuer_path.read_text(encoding="utf-8"))
print(payload["namespace"])
PY
)"
bash "$SKILL_DIR/scripts/feature-tracker.sh" rekey-local-issuer --root "$TMP_DIR" >/dev/null
ISSUER_NAMESPACE_AFTER="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

issuer_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "local" / "issuer.json"
payload = json.loads(issuer_path.read_text(encoding="utf-8"))
print(payload["namespace"])
PY
)"
test "$ISSUER_NAMESPACE_BEFORE" != "$ISSUER_NAMESPACE_AFTER"
bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Demo feature" --slug "demo-feature" --goal "Ship demo" --workspace-mode proposal_only

FEATURE_ID="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
items = payload.get("features")
if not isinstance(items, list):
    raise SystemExit("missing features array")
print(items[0]["feat_id"])
PY
)"

python3 - "$TMP_DIR" "$FEATURE_ID" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
feature_id = sys.argv[2]
dag_path = root / ".bagakit" / "feature-tracker" / "index" / "FEATURES_DAG.json"
dag_payload = json.loads(dag_path.read_text(encoding="utf-8"))
assert [item["feat_id"] for item in dag_payload["features"]] == [feature_id]
assert dag_payload["layers"] == [{"layer": 0, "feat_ids": [feature_id]}]
PY

bash "$SKILL_DIR/scripts/feature-tracker.sh" assign-feature-workspace --root "$TMP_DIR" --feature "$FEATURE_ID" --workspace-mode current_tree
bash "$SKILL_DIR/scripts/feature-tracker.sh" start-task --root "$TMP_DIR" --feature "$FEATURE_ID" --task T-001
bash "$SKILL_DIR/scripts/feature-tracker.sh" show-feature-status --root "$TMP_DIR" --feature "$FEATURE_ID" --json >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" list-features --root "$TMP_DIR" >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" replan-features --root "$TMP_DIR" --json >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/dev/null

python3 - "$TMP_DIR" "$FEATURE_ID" <<'PY'
import json
import re
import sys
from pathlib import Path
import subprocess

root = Path(sys.argv[1])
feature_id = sys.argv[2]

if not re.fullmatch(r"f-[23456789abcdefghjkmnpqrstuvwxyz]{9}", feature_id):
    raise SystemExit(f"unexpected feature id shape: {feature_id}")

index_path = root / ".bagakit" / "feature-tracker" / "index" / "features.json"
state_path = root / ".bagakit" / "feature-tracker" / "features" / feature_id / "state.json"
tasks_path = root / ".bagakit" / "feature-tracker" / "features" / feature_id / "tasks.json"
dag_path = root / ".bagakit" / "feature-tracker" / "index" / "FEATURES_DAG.json"
issuer_path = root / ".bagakit" / "feature-tracker" / "local" / "issuer.json"
feature_dir = root / ".bagakit" / "feature-tracker" / "features" / feature_id

index_payload = json.loads(index_path.read_text(encoding="utf-8"))
state_payload = json.loads(state_path.read_text(encoding="utf-8"))
tasks_payload = json.loads(tasks_path.read_text(encoding="utf-8"))
dag_payload = json.loads(dag_path.read_text(encoding="utf-8"))
issuer_payload = json.loads(issuer_path.read_text(encoding="utf-8"))

assert "updated_at" not in index_payload
assert index_payload["feature_id_issuance"]["scheme"] == "feature-tracker-id-v1-c3n2g4"
assert isinstance(index_payload["feature_id_issuance"]["next_cursor"], int)
assert "generated_at" not in dag_payload
assert sorted(dag_payload.keys()) == ["features", "generated_by", "layers", "notes", "version"]
assert "execution_mode" not in dag_payload
assert "max_parallel" not in dag_payload
assert "parallel_recommendation" not in dag_payload
assert "first_unfinished_layer" not in dag_payload
assert "created_at" not in state_payload
assert "updated_at" not in state_payload
assert "archived_at" not in state_payload
assert "discarded_at" not in state_payload
assert "last_checked_at" not in state_payload["gate"]
assert all("at" not in item for item in state_payload.get("history", []))
assert not (feature_dir / "tasks.md").exists()
assert not (feature_dir / "artifacts").exists()
assert not (feature_dir / "proposal.md").exists()
assert not (feature_dir / "spec-delta.md").exists()
assert not (feature_dir / "verification.md").exists()
task = tasks_payload["tasks"][0]
for key in ("last_gate_at", "started_at", "finished_at", "updated_at"):
    assert key not in task
assert issuer_payload["namespace"] == feature_id[5:7]
assert issuer_payload["guard_key_source"] == "git-config:bagakit.feature-tracker.guard-key"

guard_key = subprocess.run(
    ["git", "-C", str(root), "config", "--local", "--get", "bagakit.feature-tracker.guard-key"],
    check=True,
    text=True,
    capture_output=True,
).stdout.strip()
assert re.fullmatch(r"[23456789abcdefghjkmnpqrstuvwxyz]{12}", guard_key)

check_ignore = subprocess.run(
    ["git", "-C", str(root), "check-ignore", ".bagakit/feature-tracker/local/issuer.json"],
    check=False,
    text=True,
    capture_output=True,
)
assert check_ignore.returncode == 0
PY

bash "$SKILL_DIR/scripts/feature-tracker.sh" materialize-feature-artifact --root "$TMP_DIR" --feature "$FEATURE_ID" --kind proposal >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" materialize-feature-artifact --root "$TMP_DIR" --feature "$FEATURE_ID" --kind spec-delta >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" materialize-feature-artifact --root "$TMP_DIR" --feature "$FEATURE_ID" --kind verification >/dev/null
test -f "$TMP_DIR/.bagakit/feature-tracker/features/$FEATURE_ID/proposal.md"
test -f "$TMP_DIR/.bagakit/feature-tracker/features/$FEATURE_ID/spec-delta.md"
test -f "$TMP_DIR/.bagakit/feature-tracker/features/$FEATURE_ID/verification.md"

echo "ok: bagakit-feature-tracker canonical smoke passed"
