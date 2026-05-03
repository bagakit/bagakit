set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_root="$(dirname "$script_dir")"

usage() {
  cat <<'EOF'
usage: bagakit-writing-de-ai-tone-cli <command> [args...]

Commands:
  describe                 Print a short skill description.
  list-references          List reference files shipped by this skill.
  validate                 Check that required skill files exist.
  lint                     Run de-AI-tone markdown lint checks.
  print-patterns           Print AI-tone pattern reference.
  print-rewrite-protocol   Print detect/rewrite protocol.
  print-protected-spans    Print protected-span and scene-pack protocol.
EOF
}

case "${1:-}" in
  describe)
    printf '%s\n' "bagakit-writing-de-ai-tone: L1 paperwork primitive for Chinese and English AI-tone detection, rewrite protocol, and prose polish gates."
    ;;
  list-references)
    find "$skill_root/references" -type f | sed "s#^$skill_root/##" | sort
    ;;
  validate)
    test -f "$skill_root/SKILL.md"
    test -f "$skill_root/references/patterns.md"
    test -f "$skill_root/references/rewrite-protocol.md"
    test -f "$skill_root/references/protected-spans.md"
    test -f "$skill_root/references/context-profiles.toml"
    test -f "$skill_root/references/lexicon.json"
    test -f "$skill_root/references/frontdoor-rule.toml"
    test -f "$skill_root/references/skill-cli.toml"
    test -f "$skill_root/scripts/de_ai_tone_lint.py"
    ;;
  lint)
    shift
    exec python3 "$skill_root/scripts/de_ai_tone_lint.py" "$@"
    ;;
  print-patterns)
    cat "$skill_root/references/patterns.md"
    ;;
  print-rewrite-protocol)
    cat "$skill_root/references/rewrite-protocol.md"
    ;;
  print-protected-spans)
    cat "$skill_root/references/protected-spans.md"
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
