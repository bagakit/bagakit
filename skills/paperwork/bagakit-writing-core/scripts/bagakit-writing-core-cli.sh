set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_root="$(dirname "$script_dir")"
sibling_root="$(dirname "$skill_root")"

usage() {
  cat <<'EOF'
usage: bagakit-writing-core-cli <command> [args...]

Commands:
  describe          Print a short skill description.
  list-references   List reference files shipped by this skill.
  validate          Check that required skill files exist.
  lint              Run generic writing-core markdown lint checks.
  de-ai-tone        Run sibling bagakit-writing-de-ai-tone CLI when available.
  route             Run writing-core route foundation and derivation tools.
  print-review-packet-template
                    Print the writing-core review packet template.
  print-anti-rationalization-table
                    Print the anti-rationalization review table.
EOF
}

case "${1:-}" in
  describe)
    printf '%s\n' "bagakit-writing-core: generic writing route, foundation, structure, evidence, anti-AI, prose-mechanics, and review primitives."
    ;;
  list-references)
    find "$skill_root/references" -type f | sed "s#^$skill_root/##" | sort
    ;;
  validate)
    test -f "$skill_root/SKILL.md"
    test -f "$skill_root/references/README.md"
    test -f "$skill_root/references/workflow/OPERATING_SURFACE_MATRIX.md"
    test -f "$skill_root/references/knowledge/PRE_DRAFT_ROUTE_MEMO_TEMPLATE.md"
    test -f "$skill_root/references/writing/AI_SMELLS.md"
    test -f "$skill_root/references/writing/ai-smell-lexicon.json"
    test -f "$skill_root/references/review/QA_HARD_METRICS.md"
    test -f "$skill_root/references/review/ANTI_RATIONALIZATION_TABLE.md"
    test -f "$skill_root/references/review/REVIEW_PACKET_TEMPLATE.md"
    test -f "$skill_root/scripts/writing_core_lint.py"
    test -f "$skill_root/scripts/writing_core_route_tools.py"
    test -f "$sibling_root/bagakit-writing-de-ai-tone/scripts/bagakit-writing-de-ai-tone-cli.sh"
    ;;
  lint)
    shift
    exec python3 "$skill_root/scripts/writing_core_lint.py" "$@"
    ;;
  de-ai-tone)
    shift
    de_ai_cli="$sibling_root/bagakit-writing-de-ai-tone/scripts/bagakit-writing-de-ai-tone-cli.sh"
    if [[ ! -f "$de_ai_cli" ]]; then
      printf 'bagakit-writing-de-ai-tone is required for publishable prose review but is not available next to bagakit-writing-core\n' >&2
      exit 2
    fi
    exec bash "$de_ai_cli" "$@"
    ;;
  route)
    shift
    exec python3 "$skill_root/scripts/writing_core_route_tools.py" "$@"
    ;;
  print-review-packet-template)
    cat "$skill_root/references/review/REVIEW_PACKET_TEMPLATE.md"
    ;;
  print-anti-rationalization-table)
    cat "$skill_root/references/review/ANTI_RATIONALIZATION_TABLE.md"
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
