#!/usr/bin/env bash
set -euo pipefail
skill_dir="$(cd "$(dirname "$0")/.." && pwd)"
case "${1:-}" in
  -h|--help|help) cat <<'EOF'
usage: sh scripts/bagakit-replay-lab-cli.sh {describe|evaluate|replay} <results> <output> [--manifest path]
EOF
    ;;
  describe) cat "$skill_dir/SKILL.md" ;;
  evaluate|replay) shift; exec python3 "$skill_dir/scripts/replay_eval.py" "$@" ;;
  *) echo "usage: sh scripts/bagakit-replay-lab-cli.sh {describe|evaluate|replay} <results> <output> [--manifest path]" >&2; exit 2 ;;
esac
