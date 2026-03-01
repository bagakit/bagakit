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

ARCHIVE_FEATURE_ID="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
items = payload.get("features")
if not isinstance(items, list):
    raise SystemExit("missing archive feature")
for item in items:
    if item.get("title") == "Archive feature":
        print(item["feat_id"])
        break
else:
    raise SystemExit("archive feature not found")
PY
)"

python3 - "$TMP_DIR" "$ARCHIVE_FEATURE_ID" <<'PY'
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

bash "$SKILL_DIR/scripts/feature-tracker.sh" archive-feature --root "$TMP_DIR" --feature "$ARCHIVE_FEATURE_ID" >/dev/null
test ! -e "$TMP_DIR/docs/.bagakit/inbox/decision-$ARCHIVE_FEATURE_ID.md"
test ! -e "$TMP_DIR/docs/.bagakit/inbox/howto-$ARCHIVE_FEATURE_ID-result.md"
test ! -e "$TMP_DIR/docs/.bagakit/inbox/gotcha-$ARCHIVE_FEATURE_ID.md"

mkdir -p "$TMP_DIR/.bagakit/feature-tracker/feats/legacy-test"
if bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/dev/null 2>&1; then
  echo "error: legacy feats directory unexpectedly accepted" >&2
  exit 1
fi

echo "ok: bagakit-feature-tracker legacy regression passed"
