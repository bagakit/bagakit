#!/usr/bin/env bash
set -euo pipefail

skill_dir="$(cd "$(dirname "$0")/.." && pwd)"
case "${1:-}" in
  -h|--help|help)
    cat <<'EOF'
usage: sh scripts/bagakit-auto-research-cli.sh {describe|contract}
EOF
    ;;
  describe) cat "$skill_dir/SKILL.md" ;;
  contract) cat "$skill_dir/references/auto-research-contract.md" ;;
  *)
    echo "usage: sh scripts/bagakit-auto-research-cli.sh {describe|contract}" >&2
    exit 2
    ;;
esac
