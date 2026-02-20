#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

ROOT="$(repo_root)"
TARGET_PATH=""
USE_REMOTE=0

usage() {
  cat <<'USAGE'
Usage: scripts/update.sh [--remote] [--skill <skill-id-or-path>]

Options:
  --remote          Update tracked submodules to latest origin/<branch>.
  --skill <name>    Limit update to one skill (id or full submodule path).
  --help            Show this help message.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --remote)
      USE_REMOTE=1
      shift
      ;;
    --skill)
      [[ $# -ge 2 ]] || { echo "--skill requires a value" >&2; exit 1; }
      TARGET_PATH="$(resolve_skill_path "$2")"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

cd "$ROOT"
git submodule sync --recursive

if [[ -n "$TARGET_PATH" ]]; then
  if [[ "$USE_REMOTE" -eq 1 ]]; then
    git submodule update --init --recursive --remote "$TARGET_PATH"
  else
    git submodule update --init --recursive "$TARGET_PATH"
  fi
else
  if [[ "$USE_REMOTE" -eq 1 ]]; then
    git submodule update --init --recursive --remote
  else
    git submodule update --init --recursive
  fi
fi

"$ROOT/scripts/render_catalog.sh"

git submodule status
echo "Update complete."
