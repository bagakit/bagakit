set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_root="$(dirname "$script_dir")"

usage() {
  cat <<'EOF'
usage: bagakit-spark-cli <command>

Commands:
  describe          Print a short skill description.
  list-references   List reference files shipped by this skill.
  validate          Check that required skill files exist.
  print-review-packet-template
                    Print the Spark review packet template.
EOF
}

case "${1:-}" in
  describe)
    printf '%s\n' "bagakit-spark: structured deep discussion, questioning, synthesis, and optional evidence grounding."
    ;;
  list-references)
    find "$skill_root/references" -type f | sed "s#^$skill_root/##" | sort
    ;;
  validate)
    test -f "$skill_root/SKILL.md"
    test -f "$skill_root/references/session-protocol.md"
    test -f "$skill_root/references/workflow-contract.toml"
    test -f "$skill_root/references/review-packet-template.md"
    test -f "$skill_root/references/bagakit-driver.toml"
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
