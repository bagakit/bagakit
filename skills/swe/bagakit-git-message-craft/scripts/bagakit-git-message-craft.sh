#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec env PYTHONDONTWRITEBYTECODE=1 python3 "$SCRIPT_DIR/bagakit-git-message-craft.py" "$@"
