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
TRACKER_DIR="$ROOT/skills/harness/bagakit-feature-tracker"
ADAPTER_DIR="$ROOT/skills/harness/bagakit-feature-tracker-openspec-adapter"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

git -C "$TMP_DIR" init -q -b main
git -C "$TMP_DIR" config user.name "Bagakit"
git -C "$TMP_DIR" config user.email "bagakit@example.com"
printf '# demo\n' > "$TMP_DIR/README.md"
git -C "$TMP_DIR" add README.md
git -C "$TMP_DIR" commit -q -m "init"

export BAGAKIT_FEATURE_TRACKER_SKILL_DIR="$TRACKER_DIR"

bash "$TRACKER_DIR/scripts/feature-tracker.sh" check-reference-readiness --root "$TMP_DIR" >/dev/null
bash "$TRACKER_DIR/scripts/feature-tracker.sh" initialize-tracker --root "$TMP_DIR" >/dev/null
bash "$TRACKER_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Exported feature" --slug "exported-feature" --goal "Bridge out" --workspace-mode proposal_only >/dev/null

FEATURE_ID="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
items = payload.get("features")
if not isinstance(items, list) or not items:
    raise SystemExit("missing feature")
print(items[0]["feat_id"])
PY
)"

SPEC_DELTA="$TMP_DIR/.bagakit/feature-tracker/features/$FEATURE_ID/spec-deltas/bridge-capability.md"
mkdir -p "$(dirname "$SPEC_DELTA")"
cat > "$SPEC_DELTA" <<'EOF'
# Spec Delta

Bridge capability.
EOF

bash "$ADAPTER_DIR/scripts/openspec-feature-adapter.sh" export-feature --root "$TMP_DIR" --feature "$FEATURE_ID" --change-name exported-change
test -f "$TMP_DIR/openspec/changes/exported-change/proposal.md"
test -f "$TMP_DIR/openspec/changes/exported-change/tasks.md"
test -f "$TMP_DIR/openspec/changes/exported-change/specs/bridge-capability/spec.md"

mkdir -p "$TMP_DIR/openspec/changes/imported-change/specs/reader-capability"
cat > "$TMP_DIR/openspec/changes/imported-change/proposal.md" <<'EOF'
# Imported Proposal

Imported through adapter.
EOF
cat > "$TMP_DIR/openspec/changes/imported-change/tasks.md" <<'EOF'
# Tasks

- [ ] Draft implementation
- [x] Capture review notes
EOF
cat > "$TMP_DIR/openspec/changes/imported-change/specs/reader-capability/spec.md" <<'EOF'
# Reader Capability

Imported capability body.
EOF

bash "$ADAPTER_DIR/scripts/openspec-feature-adapter.sh" import-change --root "$TMP_DIR" --change imported-change

python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
index_path = root / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
items = payload.get("features")
if not isinstance(items, list) or len(items) < 2:
    raise SystemExit("imported feature missing")
imported = None
for item in items:
    if item.get("title") == "Imported: imported-change":
        imported = item
        break
if imported is None:
    raise SystemExit("imported feature not indexed")
state_path = root / ".bagakit" / "feature-tracker" / "features" / imported["feat_id"] / "state.json"
tasks_path = root / ".bagakit" / "feature-tracker" / "features" / imported["feat_id"] / "tasks.json"
state = json.loads(state_path.read_text(encoding="utf-8"))
tasks = json.loads(tasks_path.read_text(encoding="utf-8"))
assert state["status"] == "ready"
assert state["branch"].startswith("feat/")
assert len(tasks["tasks"]) == 2
assert tasks["tasks"][1]["status"] == "done"
PY

echo "ok: bagakit-feature-tracker-openspec-adapter smoke passed"
