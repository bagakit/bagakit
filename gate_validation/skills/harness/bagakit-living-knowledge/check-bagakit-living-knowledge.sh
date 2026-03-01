#!/usr/bin/env bash
set -euo pipefail

ROOT="."

while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      [[ $# -ge 2 ]] || { echo "missing value for --root" >&2; exit 2; }
      ROOT="$2"
      shift 2
      ;;
    -h|--help)
      cat <<'EOF'
usage: gate_validation/skills/harness/bagakit-living-knowledge/check-bagakit-living-knowledge.sh [--root <repo-root>]
EOF
      exit 0
      ;;
    *)
      echo "unexpected argument: $1" >&2
      exit 2
      ;;
  esac
done

ROOT="$(cd "$ROOT" && pwd)"
SKILL_DIR="$ROOT/skills/harness/bagakit-living-knowledge"
CMD="$SKILL_DIR/scripts/bagakit-living-knowledge.sh"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

cd "$TMP_DIR"
mkdir repo
cd repo
git init -q
git config user.email "test@example.com"
git config user.name "Test User"

printf '# placeholder\n' > README.md
git add README.md
git commit -q -m "chore: init"

sh "$CMD" apply --root . >/dev/null

test -f .bagakit/knowledge_conf.toml
test -f docs/must-guidebook.md
test -f docs/must-authority.md
test -f docs/must-recall.md
test -f .bagakit/living-knowledge/.generated/.gitignore
grep -q "BAGAKIT:LIVING-KNOWLEDGE:START" .git/info/exclude
grep -q "must-guidebook.md" AGENTS.md
grep -q "must-authority.md" AGENTS.md
grep -q "must-recall.md" AGENTS.md

PATHS_OUT="$("$CMD" paths --root .)"
grep -q "^shared_root: docs$" <<<"$PATHS_OUT"
grep -q "^researcher_root: .bagakit/researcher$" <<<"$PATHS_OUT"
grep -q "^selector_root: .bagakit/skill-selector$" <<<"$PATHS_OUT"
grep -q "^evolver_root: .bagakit/evolver$" <<<"$PATHS_OUT"

grep -q "docs" docs/must-guidebook.md
grep -q ".bagakit/researcher" docs/must-authority.md
grep -q "recall search" docs/must-recall.md

mkdir -p docs/notes
cat > docs/notes/decision-shared-root.md <<'EOF'
# Shared Root Decision

## Summary

- Keep the shared checked-in knowledge root under docs for this repository.
EOF

sh "$CMD" index --root . >/dev/null
test -f .bagakit/living-knowledge/.generated/guidebook-map.md
grep -q "docs/notes/decision-shared-root.md" .bagakit/living-knowledge/.generated/guidebook-map.md
grep -q "docs/notes" docs/must-guidebook.md

SEARCH_OUT="$("$CMD" recall search --root . "shared checked-in knowledge root")"
grep -q "docs/notes/decision-shared-root.md" <<<"$SEARCH_OUT"

GET_OUT="$("$CMD" recall get --root . docs/notes/decision-shared-root.md --from 1 --lines 6)"
grep -q "^# Shared Root Decision$" <<<"$GET_OUT"

AGENTS_OUT="$("$CMD" recall get --root . AGENTS.md --from 1 --lines 6)"
grep -q "managed block" <<<"$AGENTS_OUT"

mkdir -p app/subtree
cat > app/subtree/AGENTS.md <<'EOF'
Read `docs/must-guidebook.md` before relying on memory.
EOF
sh "$CMD" doctor --root . >/dev/null

cat > app/subtree/AGENTS.md <<'EOF'
Do not redefine the shared knowledge root. Read `docs/must-guidebook.md` before local work.
EOF
sh "$CMD" doctor --root . >/dev/null

cat > app/subtree/AGENTS.md <<'EOF'
Use docs/notes/ as the canonical knowledge root for this subtree.
EOF
if "$CMD" doctor --root . >"$TMP_DIR/path-agents-root.out" 2>"$TMP_DIR/path-agents-root.err"; then
  echo "doctor unexpectedly accepted a path-local AGENTS.md that redefined the shared root" >&2
  exit 1
fi
grep -q "must not redefine the shared knowledge root" "$TMP_DIR/path-agents-root.err"

cat > app/subtree/AGENTS.md <<'EOF'
Store durable notes in docs/notes/ for this subtree.
EOF
if "$CMD" doctor --root . >"$TMP_DIR/path-agents-store.out" 2>"$TMP_DIR/path-agents-store.err"; then
  echo "doctor unexpectedly accepted a path-local AGENTS.md that redirected subtree storage" >&2
  exit 1
fi
grep -q "must not redefine the shared knowledge root" "$TMP_DIR/path-agents-store.err"

cat > app/subtree/AGENTS.md <<'EOF'
- LivingKnowledge: Surface=none; Evidence=none; Next=none
EOF
if "$CMD" doctor --root . >"$TMP_DIR/path-agents-footer.out" 2>"$TMP_DIR/path-agents-footer.err"; then
  echo "doctor unexpectedly accepted a path-local AGENTS.md that imposed the reporting footer" >&2
  exit 1
fi
grep -q "must not impose the living-knowledge reporting footer" "$TMP_DIR/path-agents-footer.err"
rm app/subtree/AGENTS.md

sh "$CMD" doctor --root . >/dev/null

cat > docs/reviewed-note.md <<'EOF'
# Reviewed Note

## Summary

- This note was reviewed and is ready for shared ingestion.
EOF

sh "$CMD" ingest --root . --source docs/reviewed-note.md --dest notes/reviewed-note.md >/dev/null
test -f docs/notes/reviewed-note.md

cat > docs/bad-abs.md <<EOF
# Bad Note

- ${TMP_DIR}/repo/docs/local-path.md
EOF
if "$CMD" ingest --root . --source docs/bad-abs.md --dest notes/bad-abs.md >"$TMP_DIR/ingest-bad.out" 2>"$TMP_DIR/ingest-bad.err"; then
  echo "ingest unexpectedly accepted absolute filesystem paths in shared content" >&2
  exit 1
fi
grep -q "absolute filesystem path literals" "$TMP_DIR/ingest-bad.err"

mkdir -p ../escape
echo "bad" > ../escape/AGENTS.md
if "$CMD" recall get --root . ../escape/AGENTS.md --from 1 --lines 1 >"$TMP_DIR/escape.out" 2>"$TMP_DIR/escape.err"; then
  echo "recall get unexpectedly allowed AGENTS.md path traversal" >&2
  exit 1
fi
grep -q "unsafe path" "$TMP_DIR/escape.err"

echo "outside" > ../outside.md
ln -s ../../outside.md docs/linkout.md
if "$CMD" recall get --root . docs/linkout.md --from 1 --lines 1 >"$TMP_DIR/symlink.out" 2>"$TMP_DIR/symlink.err"; then
  echo "recall get unexpectedly followed a symlink outside the repo" >&2
  exit 1
fi
grep -q "escapes repo root\|uses symlinked component" "$TMP_DIR/symlink.err"
rm docs/linkout.md

if "$CMD" inspect-stack --root . --output AGENTS.md >"$TMP_DIR/stack-bad.out" 2>"$TMP_DIR/stack-bad.err"; then
  echo "inspect-stack unexpectedly allowed overwriting AGENTS.md" >&2
  exit 1
fi
grep -q "disallowed path" "$TMP_DIR/stack-bad.err"

ln -s ../../../../outside.md .bagakit/living-knowledge/.generated/stack-link.md
if "$CMD" inspect-stack --root . --output .bagakit/living-knowledge/.generated/stack-link.md >"$TMP_DIR/stack-link.out" 2>"$TMP_DIR/stack-link.err"; then
  echo "inspect-stack unexpectedly wrote through a symlink outside the repo" >&2
  exit 1
fi
grep -q "escapes repo root\|uses symlinked component" "$TMP_DIR/stack-link.err"
rm .bagakit/living-knowledge/.generated/stack-link.md

if git status --short | grep -q ".bagakit/living-knowledge/.generated"; then
  echo "generated helper outputs unexpectedly became visible in git status" >&2
  exit 1
fi

git add -f .bagakit/living-knowledge/.generated/.gitignore
if "$CMD" doctor --root . >"$TMP_DIR/tracked-generated.out" 2>"$TMP_DIR/tracked-generated.err"; then
  echo "doctor unexpectedly accepted tracked living-knowledge generated outputs" >&2
  exit 1
fi
grep -q "generated outputs are tracked by git" "$TMP_DIR/tracked-generated.err"

echo "ok: bagakit-living-knowledge substrate smoke passed"
