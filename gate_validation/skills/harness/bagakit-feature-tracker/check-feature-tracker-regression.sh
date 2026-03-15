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

rm -f /tmp/bagakit-feature-tracker-boundary.out /tmp/bagakit-feature-tracker-boundary.err

mkdir -p "$TMP_DIR/.bagakit/feature-tracker/feats/legacy-test"
if bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/dev/null 2>&1; then
  echo "error: legacy feats directory unexpectedly accepted" >&2
  exit 1
fi

echo "ok: bagakit-feature-tracker legacy regression passed"
