set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_root="$(dirname "$script_dir")"

usage() {
  cat <<'EOF'
usage: bagakit-codex-webpage-design-cli <command>

Commands:
  describe          Print a short skill description.
  list-references   List reference files shipped by this skill.
  validate          Check that required skill files exist.
EOF
}

case "${1:-}" in
  describe)
    printf '%s\n' "bagakit-codex-webpage-design: reference-first webpage design implementation with browser and visual parity checks."
    ;;
  list-references)
    find "$skill_root/references" -type f | sed "s#^$skill_root/##" | sort
    ;;
  validate)
    test -f "$skill_root/SKILL.md"
    test -f "$skill_root/references/workflow-contract.toml"
    test -f "$skill_root/references/implementation-loop.md"
    test -f "$skill_root/references/visual-quality-rubric.md"
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
