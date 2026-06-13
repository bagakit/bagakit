#!/usr/bin/env bash
set -euo pipefail
skill_dir="$(cd "$(dirname "$0")/.." && pwd)"
case "${1:-}" in
  -h|--help|help) cat <<'EOF'
usage: sh scripts/bagakit-session-analysis-cli.sh {describe|analyze|validate} <input> <output>
EOF
    ;;
  describe) cat "$skill_dir/SKILL.md" ;;
  analyze|validate) shift; exec python3 "$skill_dir/scripts/analyze_session.py" "$@" ;;
  *) echo "usage: sh scripts/bagakit-session-analysis-cli.sh {describe|analyze|validate} <input> <output>" >&2; exit 2 ;;
esac
