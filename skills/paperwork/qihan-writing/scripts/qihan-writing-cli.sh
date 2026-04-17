set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_root="$(dirname "$script_dir")"
sibling_root="$(dirname "$skill_root")"

usage() {
  cat <<'EOF'
usage: qihan-writing-cli <command> [args...]

Commands:
  describe          Print a short skill description.
  list-references   List reference files shipped by this skill.
  validate          Check that required skill files exist.
  lint              Run qihan-writing markdown lint checks.
  route             Run qihan-writing route foundation and route derivation tools.
  core              Run sibling bagakit-writing-core CLI when available.
  print-review-packet-template
                    Print the qihan-writing review packet template.
EOF
}

case "${1:-}" in
  describe)
    printf '%s\n' "qihan-writing: rigorous Chinese technical writing and rewriting workflow with routing, evidence, style, and review gates."
    ;;
  list-references)
    find "$skill_root/references" -type f | sed "s#^$skill_root/##" | sort
    ;;
  validate)
    test -f "$skill_root/SKILL.md"
    test -f "$skill_root/references/workflow/OPERATING_SURFACE_MATRIX.md"
    test -f "$skill_root/references/writing/VOICE.md"
    test -f "$skill_root/references/review/REVIEW_PACKET_TEMPLATE.md"
    test -f "$skill_root/scripts/qihan_write_lint.py"
    test -f "$skill_root/scripts/qihan_route_tools.py"
    ;;
  lint)
    shift
    exec python3 "$skill_root/scripts/qihan_write_lint.py" "$@"
    ;;
  route)
    shift
    exec python3 "$skill_root/scripts/qihan_route_tools.py" "$@"
    ;;
  core)
    shift
    core_cli="$sibling_root/bagakit-writing-core/scripts/bagakit-writing-core-cli.sh"
    if [[ ! -f "$core_cli" ]]; then
      printf 'bagakit-writing-core is not available next to qihan-writing; install or compose it explicitly\n' >&2
      exit 2
    fi
    exec bash "$core_cli" "$@"
    ;;
  print-review-packet-template)
    cat "$skill_root/references/review/REVIEW_PACKET_TEMPLATE.md"
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
