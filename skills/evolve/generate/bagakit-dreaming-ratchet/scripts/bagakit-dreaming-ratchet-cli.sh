#!/usr/bin/env bash
set -euo pipefail
skill_dir="$(cd "$(dirname "$0")/.." && pwd)"
case "${1:-}" in
  describe) cat "$skill_dir/SKILL.md" ;;
  ratchet|decide) shift; exec python3 "$skill_dir/scripts/ratchet.py" "$@" ;;
  *) echo "usage: sh scripts/bagakit-dreaming-ratchet-cli.sh {describe|ratchet} <candidate> <receipt> <output>" >&2; exit 2 ;;
esac
