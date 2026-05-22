set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_root="$(dirname "$script_dir")"

usage() {
  cat <<'EOF'
usage: bagakit-mastery-learning-cli <command>

Commands:
  describe          Print a short skill description.
  list-references   List reference files shipped by this skill.
  validate          Check required skill files and references.
EOF
}

case "${1:-}" in
  describe)
    printf '%s\n' "bagakit-mastery-learning: evidence-backed source closure, diagnostics, active practice, transfer, support fading, and retention."
    ;;
  list-references)
    find "$skill_root/references" -type f | sed "s#^$skill_root/##" | sort
    ;;
  validate)
    test -f "$skill_root/SKILL.md"
    test -f "$skill_root/agents/openai.yaml"
    test -f "$skill_root/references/mastery-learning-contract.toml"
    test -f "$skill_root/references/mastery-packet.md"
    test -f "$skill_root/references/learning-loop.md"
    test -f "$skill_root/references/evidence-and-adaptation.md"
    test -f "$skill_root/references/hitl-course-handoff.md"
    test -f "$skill_root/references/frontdoor-rule.toml"
    test -f "$skill_root/references/bagakit-driver.toml"
    test -f "$skill_root/references/skill-cli.toml"
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
