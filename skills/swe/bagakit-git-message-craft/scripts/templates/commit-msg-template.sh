#!/usr/bin/env bash
set -euo pipefail
# BAGAKIT_GIT_MESSAGE_CRAFT_HOOK

MESSAGE_FILE="${1:-}"
if [[ -z "$MESSAGE_FILE" || ! -f "$MESSAGE_FILE" ]]; then
  exit 0
fi

declare -a CANDIDATES=()
if [[ -n "${BAGAKIT_GIT_MESSAGE_CRAFT_SKILL_DIR:-}" ]]; then
  CANDIDATES+=("$BAGAKIT_GIT_MESSAGE_CRAFT_SKILL_DIR")
fi
CANDIDATES+=("__SKILL_DIR_HINT__")

for dir in "${CANDIDATES[@]}"; do
  if [[ -x "$dir/scripts/bagakit-git-message-craft.py" ]]; then
    REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
    if [[ -n "$REPO_ROOT" ]]; then
      exec python3 "$dir/scripts/bagakit-git-message-craft.py" lint-message --root "$REPO_ROOT" --message "$MESSAGE_FILE"
    fi
    exec python3 "$dir/scripts/bagakit-git-message-craft.py" lint-message --message "$MESSAGE_FILE"
  fi
done

echo "error: bagakit-git-message-craft script not found; set BAGAKIT_GIT_MESSAGE_CRAFT_SKILL_DIR or reinstall hooks" >&2
exit 1
