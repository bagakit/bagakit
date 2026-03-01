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
usage: gate_validation/skills/swe/bagakit-git-message-craft/check-bagakit-git-message-craft.sh [--root <repo-root>]

Run canonical runtime smoke checks for bagakit-git-message-craft.
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
SKILL_DIR="$ROOT/skills/swe/bagakit-git-message-craft"
VALIDATION_DIR="$ROOT/gate_validation/skills/swe/bagakit-git-message-craft"
CMD="$SKILL_DIR/scripts/bagakit-git-message-craft.sh"

python3 "$VALIDATION_DIR/check-anti-patterns.py" \
  --skill-md "$SKILL_DIR/SKILL.md" \
  --rules "$VALIDATION_DIR/rules.toml" >/dev/null

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

cd "$TMP_DIR"
git init -q
git config user.email "test@example.com"
git config user.name "Test User"

echo "print(hello)" > app.py
git add app.py
git commit -q -m "chore: init"

echo "print(world)" >> app.py
mkdir -p docs
echo "# Notes" > docs/notes.md

INIT_OUT="$("$CMD" init --root "$TMP_DIR" --topic "commit clarity" --install-hooks yes)"
SESSION_DIR="$(printf "%s\n" "$INIT_OUT" | sed -n 's/^initialized: //p')"
if [[ -z "$SESSION_DIR" ]]; then
  echo "failed to capture session dir" >&2
  exit 1
fi

test -x "$TMP_DIR/.git/hooks/commit-msg"
grep -q "BAGAKIT_GIT_MESSAGE_CRAFT_HOOK" "$TMP_DIR/.git/hooks/commit-msg"
test -d "$SESSION_DIR"
if find "$SESSION_DIR" -mindepth 1 -maxdepth 1 | grep -q .; then
  echo "init unexpectedly created template files in session dir" >&2
  exit 1
fi

"$CMD" inventory --root "$TMP_DIR" --dir "$SESSION_DIR"
test -f "$SESSION_DIR/split-inventory.md"
test ! -f "$SESSION_DIR/split-inventory.json"
grep -q -- 'Repository root: `.`' "$SESSION_DIR/split-inventory.md"
if grep -q -- "$TMP_DIR" "$SESSION_DIR/split-inventory.md"; then
  echo "split inventory leaked an absolute repo path" >&2
  exit 1
fi
if grep -q -- ".bagakit/git-message-craft" "$SESSION_DIR/split-inventory.md"; then
  echo "split inventory unexpectedly included git-message-craft session artifacts" >&2
  exit 1
fi

MESSAGE_FILE="$SESSION_DIR/commit-refactor-split-planning-from-message-drafting.txt"
"$CMD" draft-message \
  --root "$TMP_DIR" \
  --dir "$SESSION_DIR" \
  --type refactor \
  --scope commit \
  --summary "split planning from message drafting" \
  --why-before "mixed intent commits made rollback boundary hard to infer from history" \
  --why-change "replace module-heavy commit records with a shorter context section and ranked facts" \
  --why-gain "reviewers can recover intent faster without reading redundant metadata" \
  --fact "p0|draft-message now writes one file per planned commit and normalizes repo-relative refs|$TMP_DIR/app.py:1" \
  --check "git diff --check" \
  --output "$MESSAGE_FILE"

grep -q -- "Key refs: app.py:1" "$MESSAGE_FILE"
if grep -q -- "$TMP_DIR/app.py:1" "$MESSAGE_FILE"; then
  echo "draft-message leaked absolute path into Key refs" >&2
  exit 1
fi
grep -q -- '^\[\[BAGAKIT\]\]$' "$MESSAGE_FILE"
grep -q -- '^- GitMessageCraft: Protocol=bagakit.git-message-craft/v1$' "$MESSAGE_FILE"
grep -q -- '^## Context$' "$MESSAGE_FILE"
grep -q -- '^## Key Facts$' "$MESSAGE_FILE"
if grep -q -- '^+++$' "$MESSAGE_FILE"; then
  echo "draft-message unexpectedly emitted legacy frontmatter fence" >&2
  exit 1
fi
if grep -q -- '^schema =' "$MESSAGE_FILE"; then
  echo "draft-message unexpectedly emitted schema frontmatter" >&2
  exit 1
fi
if grep -q -- '^## Changes by Module$' "$MESSAGE_FILE"; then
  echo "draft-message unexpectedly emitted legacy Changes by Module section" >&2
  exit 1
fi
if grep -q -- '^## Follow-ups$' "$MESSAGE_FILE"; then
  echo "draft-message unexpectedly emitted Follow-ups section" >&2
  exit 1
fi

"$CMD" lint-message --root "$TMP_DIR" --message "$MESSAGE_FILE"

BAD_FRONTMATTER_MESSAGE="$TMP_DIR/bad-frontmatter.txt"
cp "$MESSAGE_FILE" "$BAD_FRONTMATTER_MESSAGE"
python3 - <<'PY' "$BAD_FRONTMATTER_MESSAGE"
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
text = text.replace("\n## Context\n", "\n+++\nschema = \"bagakit.git-message-craft/v1\"\n+++\n\n## Context\n", 1)
path.write_text(text, encoding="utf-8")
PY

if "$CMD" lint-message --root "$TMP_DIR" --message "$BAD_FRONTMATTER_MESSAGE" >"$TMP_DIR/meta.out" 2>"$TMP_DIR/meta.err"; then
  echo "lint-message unexpectedly accepted legacy frontmatter" >&2
  exit 1
fi
grep -q -- "frontmatter is no longer supported" "$TMP_DIR/meta.err"

BAD_PROTOCOL_MESSAGE="$TMP_DIR/bad-protocol.txt"
cp "$MESSAGE_FILE" "$BAD_PROTOCOL_MESSAGE"
python3 - <<'PY' "$BAD_PROTOCOL_MESSAGE"
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
text = text.replace(
    "- GitMessageCraft: Protocol=bagakit.git-message-craft/v1",
    "- GitMessageCraft: Protocol=bagakit.git-message-craft/v0",
    1,
)
path.write_text(text, encoding="utf-8")
PY

if "$CMD" lint-message --root "$TMP_DIR" --message "$BAD_PROTOCOL_MESSAGE" >"$TMP_DIR/protocol.out" 2>"$TMP_DIR/protocol.err"; then
  echo "lint-message unexpectedly accepted the wrong footer protocol" >&2
  exit 1
fi
grep -q -- "footer protocol must be bagakit.git-message-craft/v1" "$TMP_DIR/protocol.err"

BAD_MESSAGE="$TMP_DIR/bad-abs-path.txt"
cp "$MESSAGE_FILE" "$BAD_MESSAGE"
python3 - <<'PY' "$BAD_MESSAGE" "$TMP_DIR"
from pathlib import Path
import sys

path = Path(sys.argv[1])
repo = sys.argv[2]
text = path.read_text(encoding="utf-8")
text = text.replace("Key refs: app.py:1", f"Key refs: {repo}/app.py:1", 1)
path.write_text(text, encoding="utf-8")
PY

if "$CMD" lint-message --root "$TMP_DIR" --message "$BAD_MESSAGE" >"$TMP_DIR/lint.out" 2>"$TMP_DIR/lint.err"; then
  echo "lint-message unexpectedly accepted absolute path refs" >&2
  exit 1
fi
grep -q -- "absolute filesystem path literals" "$TMP_DIR/lint.err"
grep -q -- "Key refs must use normalized repo-relative 'path:line' items" "$TMP_DIR/lint.err"

git add app.py docs/notes.md
git commit -q -F "$MESSAGE_FILE"
COMMIT_SHA="$(git rev-parse --short HEAD)"
CURRENT_BRANCH="$(git branch --show-current)"

"$CMD" archive \
  --root "$TMP_DIR" \
  --dir "$SESSION_DIR" \
  --commit "$COMMIT_SHA" \
  --check-evidence "lint-message passed for $MESSAGE_FILE" \
  --check-evidence "canonical runtime smoke completed"

ARCHIVE_FILE="$TMP_DIR/.git/bagakit/git-message-craft/archive/$(basename "$SESSION_DIR").md"
test ! -d "$SESSION_DIR"
test ! -e "$TMP_DIR/.bagakit"
test -f "$ARCHIVE_FILE"
test ! -e "$TMP_DIR/.git/bagakit/git-message-craft/memory/$(basename "$SESSION_DIR").md"
grep -q -- "## Commit Evidence" "$ARCHIVE_FILE"
grep -q -- "- $COMMIT_SHA" "$ARCHIVE_FILE"
grep -q -- "## Check Evidence" "$ARCHIVE_FILE"
grep -q -- "- action_handoff: git:$CURRENT_BRANCH" "$ARCHIVE_FILE"
grep -q -- "- memory_handoff: none (commit message and git history are the primary record)" "$ARCHIVE_FILE"
grep -q -- "lint-message passed for .bagakit/git-message-craft/" "$ARCHIVE_FILE"
if grep -q -- "$TMP_DIR" "$ARCHIVE_FILE"; then
  echo "archive leaked an absolute path" >&2
  exit 1
fi

echo "# legacy note" > legacy-note.md
git add legacy-note.md
git commit -q --no-verify -m "docs: add legacy note"
git mv legacy-note.md renamed-note.md

RENAME_INIT_OUT="$("$CMD" init --root "$TMP_DIR" --topic "rename inventory" --install-hooks no)"
RENAME_SESSION_DIR="$(printf "%s\n" "$RENAME_INIT_OUT" | sed -n 's/^initialized: //p')"
if [[ -z "$RENAME_SESSION_DIR" ]]; then
  echo "failed to capture rename session dir" >&2
  exit 1
fi

"$CMD" inventory --root "$TMP_DIR" --dir "$RENAME_SESSION_DIR" --staged-only
grep -q -- "renamed-note.md" "$RENAME_SESSION_DIR/split-inventory.md"
if grep -q $'legacy-note.md\trenamed-note.md' "$RENAME_SESSION_DIR/split-inventory.md"; then
  echo "staged-only inventory preserved a raw rename tuple instead of the destination path" >&2
  exit 1
fi

MR_TITLE_FILE="$RENAME_SESSION_DIR/mr-title.txt"
"$CMD" draft-mr-title \
  --template outcome-first \
  --type fix \
  --outcome "preserve reviewer notes" \
  --scope "MR refresh" \
  --output "$MR_TITLE_FILE"
grep -q -- '^fix: preserve reviewer notes for MR refresh$' "$MR_TITLE_FILE"

MR_BODY_FILE="$RENAME_SESSION_DIR/mr-body.md"
"$CMD" draft-mr-body \
  --template status-refresh \
  --summary-line "This MR keeps Git-facing message surfaces aligned with the landed diff." \
  --why "The current MR text drifts away from the current code changes." \
  --gate-revision "abc1234" \
  --mr-checks pending \
  --main-blocker "none" \
  --what-changed "added a reusable managed MR summary block" \
  --owner agent \
  --action "refresh the remote MR body from current evidence" \
  --output "$MR_BODY_FILE"
grep -q -- '^<!-- bagakit:git-message-craft:start -->$' "$MR_BODY_FILE"
grep -q -- '^## Current Status$' "$MR_BODY_FILE"
grep -q -- '^- MR checks: `pending`$' "$MR_BODY_FILE"
grep -q -- '^<!-- bagakit:git-message-craft:end -->$' "$MR_BODY_FILE"

echo "ok: bagakit-git-message-craft canonical smoke passed"
