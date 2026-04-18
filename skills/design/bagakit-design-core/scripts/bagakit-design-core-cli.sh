set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_root="$(dirname "$script_dir")"
repo_root="$(cd "$skill_root/../../.." && pwd)"

usage() {
  cat <<'EOF'
usage: bagakit-design-core-cli <command>

Commands:
  describe          Print a short skill description.
  list-references   List reference files shipped by this skill.
  validate          Check that required skill files and local surface markers exist.
EOF
}

case "${1:-}" in
  describe)
    printf '%s\n' "bagakit-design-core: medium-neutral brand tonality, design-rule coverage, and checkpoint review."
    ;;
  list-references)
    find "$skill_root/references" -type f | sed "s#^$skill_root/##" | sort
    ;;
  validate)
    test -f "$skill_root/SKILL.md"
    test -f "$skill_root/README.md"
    test -f "$skill_root/references/design-core-contract.toml"
    test -f "$skill_root/references/artifact-contract.md"
    test -f "$skill_root/references/brand-tonality.md"
    test -f "$skill_root/references/design-rule-system.md"
    test -f "$repo_root/.bagakit/design/surface.toml"
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
