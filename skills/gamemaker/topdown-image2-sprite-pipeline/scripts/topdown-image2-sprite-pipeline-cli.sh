set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_root="$(dirname "$script_dir")"

usage() {
  cat <<'EOF'
usage: topdown-image2-sprite-pipeline-cli <command>

Commands:
  describe    Print a short skill description.
  list-files  List files shipped by this skill.
  validate    Check that required skill files exist.
EOF
}

case "${1:-}" in
  describe)
    printf '%s\n' "topdown-image2-sprite-pipeline: process and validate image2-derived top-down sprite packages."
    ;;
  list-files)
    find "$skill_root" -type f | sed "s#^$skill_root/##" | sort
    ;;
  validate)
    test -f "$skill_root/SKILL.md"
    test -f "$skill_root/agents/openai.yaml"
    test -f "$skill_root/references/skill-cli.toml"
    test -f "$skill_root/references/asset-contract-template.md"
    test -f "$skill_root/references/failure-modes.md"
    test -f "$skill_root/references/prompt-patterns.md"
    test -f "$skill_root/references/review-checklist.md"
    test -f "$skill_root/scripts/process_image2_sprite_package.py"
    test -f "$skill_root/scripts/analyze_sprite_motion.py"
    test -f "$skill_root/scripts/validate_image2_sprite_package.py"
    ;;
  ""|-h|--help|help)
    usage
    ;;
  *)
    printf 'unknown command: %s\n' "$1" >&2
    usage >&2
    exit 2
    ;;
esac
