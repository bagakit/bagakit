set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_root="$(dirname "$script_dir")"

usage() {
  cat <<'EOF'
usage: bagakit-writing-intake-cli <command> [args...]

Commands:
  describe                                Print a short skill description.
  list-references                         List reference files shipped by this skill.
  validate                                Check that required skill files and declarations exist.
  print-packet-contract                   Print the intake_packet contract.
  print-profile-dimensions                Print profile dimension guidance.
  print-core-style-boundary               Print Intake, Core, and Style ownership boundaries.
  print-rewrite-feedback-rule-candidates  Print rewrite-feedback rule candidate guidance.
EOF
}

case "${1:-}" in
  describe)
    printf '%s\n' "bagakit-writing-intake: L1 paperwork Intake for evidence-bound writing diagnosis, language-profile distillation, and handoff packets before final prose."
    ;;
  list-references)
    find "$skill_root/references" -type f | sed "s#^$skill_root/##" | sort
    ;;
  validate)
    test -f "$skill_root/SKILL.md"
    test -f "$skill_root/agents/openai.yaml"
    test -f "$skill_root/references/intake-packet-contract.md"
    test -f "$skill_root/references/profile-dimensions.md"
    test -f "$skill_root/references/core-style-boundary.md"
    test -f "$skill_root/references/rewrite-feedback-intake-rule-candidates.md"
    test -f "$skill_root/references/frontdoor-rule.toml"
    test -f "$skill_root/references/skill-cli.toml"
    ;;
  print-packet-contract)
    cat "$skill_root/references/intake-packet-contract.md"
    ;;
  print-profile-dimensions)
    cat "$skill_root/references/profile-dimensions.md"
    ;;
  print-core-style-boundary)
    cat "$skill_root/references/core-style-boundary.md"
    ;;
  print-rewrite-feedback-rule-candidates)
    cat "$skill_root/references/rewrite-feedback-intake-rule-candidates.md"
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
