set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_root="$(dirname "$script_dir")"
sibling_root="$(dirname "$skill_root")"

usage() {
  cat <<'EOF'
usage: bagakit-paperwork-technical-writing-cli <command> [args...]

Commands:
  describe          Print a short skill description.
  list-references   List reference files shipped by this skill.
  validate          Check that required skill files exist.
  check-article     Run the bundled article quality checker directly.
  core              Run sibling bagakit-writing-core CLI when available.
  print-review-packet-template
                    Print the technical-writing review packet template.
EOF
}

case "${1:-}" in
  describe)
    printf '%s\n' "bagakit-paperwork-technical-writing: technical article drafting and rewriting with article, appendix, and review gates."
    ;;
  list-references)
    find "$skill_root/references" -type f | sed "s#^$skill_root/##" | sort
    ;;
  validate)
    test -f "$skill_root/SKILL.md"
    test -f "$skill_root/references/start-here.md"
    test -f "$skill_root/references/quality-gates.md"
    test -f "$skill_root/references/review-packet-template.md"
    test -f "$skill_root/scripts/check-article.py"
    ;;
  check-article)
    shift
    exec python3 "$skill_root/scripts/check-article.py" "$@"
    ;;
  core)
    shift
    core_cli="$sibling_root/bagakit-writing-core/scripts/bagakit-writing-core-cli.sh"
    if [[ ! -f "$core_cli" ]]; then
      printf 'bagakit-writing-core is not available next to technical-writing; install or compose it explicitly\n' >&2
      exit 2
    fi
    exec bash "$core_cli" "$@"
    ;;
  print-review-packet-template)
    cat "$skill_root/references/review-packet-template.md"
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
