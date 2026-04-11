set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_root="$(dirname "$script_dir")"

usage() {
  cat <<'EOF'
usage: qihan-writing-cli <command> [args...]

Commands:
  describe          Print a short skill description.
  list-references   List reference files shipped by this skill.
  validate          Check that required skill files exist.
  lint              Run qihan-writing markdown lint checks.
  route             Run qihan-writing route foundation and route derivation tools.
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
  ""|-h|--help|help)
    usage
    ;;
  *)
    printf 'unknown command: %s\n' "$1" >&2
    usage >&2
    exit 2
    ;;
esac
