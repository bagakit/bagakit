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
SKILL_DIR="$ROOT/skills/harness/bagakit-researcher"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$TMP_DIR/.bagakit"

python3 "$SKILL_DIR/scripts/bagakit-researcher.py" init-topic \
  --root "$TMP_DIR" \
  --topic-class frontier \
  --topic smoke-test \
  --title "Smoke Test" >/dev/null

python3 "$SKILL_DIR/scripts/bagakit-researcher.py" add-source-card \
  --root "$TMP_DIR" \
  --topic-class frontier \
  --topic smoke-test \
  --source-id a01 \
  --title "Example Source" \
  --url "https://example.com" \
  --authority primary \
  --published 2026-04-19 \
  --why "sets the baseline" >/dev/null

python3 "$SKILL_DIR/scripts/bagakit-researcher.py" add-summary \
  --root "$TMP_DIR" \
  --topic-class frontier \
  --topic smoke-test \
  --source-id a01 \
  --title "Example Source Summary" \
  --why-matters "clarifies the baseline" \
  --borrow "one reusable idea" \
  --avoid "one wrong direction" \
  --implication "one Bagakit implication" >/dev/null

python3 "$SKILL_DIR/scripts/bagakit-researcher.py" refresh-index \
  --root "$TMP_DIR" \
  --topic-class frontier \
  --topic smoke-test \
  --title "Smoke Test" >/dev/null

python3 "$SKILL_DIR/scripts/bagakit-researcher.py" list-topics --root "$TMP_DIR" | grep -q 'frontier/smoke-test'
python3 "$SKILL_DIR/scripts/bagakit-researcher.py" doctor --root "$TMP_DIR" --topic-class frontier --topic smoke-test >/dev/null
test -f "$TMP_DIR/.bagakit/researcher/topics/frontier/smoke-test/originals/a01.md"
test -f "$TMP_DIR/.bagakit/researcher/topics/frontier/smoke-test/summaries/a01.md"
grep -q 'a01.md' "$TMP_DIR/.bagakit/researcher/topics/frontier/smoke-test/index.md"
grep -q 'summaries/a01.md' "$TMP_DIR/.bagakit/researcher/topics/frontier/smoke-test/index.md"

cat > "$TMP_DIR/.bagakit/knowledge_conf.toml" <<'EOF'
[paths]
researcher_root = ".bagakit/researcher"
EOF

python3 "$SKILL_DIR/scripts/bagakit-researcher.py" init-topic \
  --root "$TMP_DIR" \
  --topic-class configured \
  --topic topic-root \
  --title "Configured Root" >/dev/null

python3 "$SKILL_DIR/scripts/bagakit-researcher.py" list-topics --root "$TMP_DIR" | grep -q 'configured/topic-root'
python3 "$SKILL_DIR/scripts/bagakit-researcher.py" doctor --root "$TMP_DIR" --topic-class configured --topic topic-root >/dev/null
test -f "$TMP_DIR/.bagakit/researcher/topics/configured/topic-root/index.md"

echo "ok: bagakit-researcher canonical smoke passed"
