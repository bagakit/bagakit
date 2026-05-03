set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_root="$(dirname "$script_dir")"

usage() {
  cat <<'EOF'
usage: bagakit-hitl-webutil-design-cli <command>

Commands:
  describe          Print a short skill description.
  list-references   List reference files shipped by this skill.
  validate          Check that required skill files and reference sets exist.
EOF
}

require_nonempty_dir() {
  local dir="$1"
  if [[ -z "$(find "$dir" -type f -name '*.md' -print -quit 2>/dev/null)" ]]; then
    printf 'missing reference set: %s\n' "$dir" >&2
    exit 1
  fi
}

case "${1:-}" in
  describe)
    printf '%s\n' "bagakit-hitl-webutil-design: purpose-first HITL web utility page design from mechanisms, style routes, artifacts, and scene crosswalks."
    ;;
  list-references)
    find "$skill_root/references" -type f | sed "s#^$skill_root/##" | sort
    ;;
  validate)
    test -f "$skill_root/SKILL.md"
    test -f "$skill_root/references/composition-crosswalk.md"
    test -f "$skill_root/references/workflow-contract.toml"
    test -f "$skill_root/references/bagakit-driver.toml"
    test -f "$skill_root/references/frontdoor-rule.toml"
    require_nonempty_dir "$skill_root/references/mechanisms"
    require_nonempty_dir "$skill_root/references/styles"
    require_nonempty_dir "$skill_root/references/artifacts"
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
