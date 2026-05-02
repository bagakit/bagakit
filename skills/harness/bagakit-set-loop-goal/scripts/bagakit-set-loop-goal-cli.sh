set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_root="$(dirname "$script_dir")"

usage() {
  cat <<'EOF'
usage: bagakit-set-loop-goal-cli <command>

Commands:
  describe          Print a short skill description.
  list-references   List reference files shipped by this skill.
  validate          Check that required skill files exist.
EOF
}

case "${1:-}" in
  describe)
    printf '%s\n' "bagakit-set-loop-goal: create recoverable Goal control planes with fixed invocation templates."
    ;;
  list-references)
    find "$skill_root/references" -type f | sed "s#^$skill_root/##" | sort
    ;;
  validate)
    test -f "$skill_root/SKILL.md"
    test -f "$skill_root/agents/openai.yaml"
    test -f "$skill_root/references/skill-cli.toml"
    test -f "$skill_root/references/frontdoor-rule.toml"
    test -f "$skill_root/references/goal-file-contract.md"
    test -f "$skill_root/references/tool-orchestration.md"
    test -f "$skill_root/references/loop-off-loop.md"
    test -f "$skill_root/references/design-origin.md"
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
