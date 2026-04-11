set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_root="$(dirname "$script_dir")"

usage() {
  cat <<'EOF'
usage: topdown-image2-sprite-pipeline-cli <command> [args...]

Commands:
  describe           Print a short skill description.
  list-files         List files shipped by this skill.
  validate           Check required skill files and report dependency status.
  check-dependencies Check runtime dependencies needed by package commands.
  process            Process source strips into runtime sheets.
  validate-package   Run independent package validation.
  analyze-motion     Run visual-semantic motion analysis.
  check-handoff      Check package handoff artifacts after review.

Package commands require:
  --root <workspace>
EOF
}

require_root() {
  local root=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --root)
        if [[ $# -lt 2 ]]; then
          printf 'missing value for --root\n' >&2
          exit 2
        fi
        root="$2"
        shift 2
        ;;
      -h|--help|help)
        usage
        exit 0
        ;;
      *)
        printf 'unknown argument: %s\n' "$1" >&2
        usage >&2
        exit 2
        ;;
    esac
  done
  if [[ -z "$root" ]]; then
    printf 'missing required --root <workspace>\n' >&2
    usage >&2
    exit 2
  fi
  printf '%s\n' "$root"
}

check_pillow() {
  python3 - <<'PY'
import importlib.util
raise SystemExit(0 if importlib.util.find_spec("PIL") else 1)
PY
}

print_dependency_status() {
  if check_pillow; then
    printf '%s\n' "Pillow available"
    return 0
  fi
  printf '%s\n' "Missing dependency: Pillow. Install it with \`python -m pip install Pillow\`." >&2
  return 1
}

check_handoff() {
  local root="$1"
  local missing=0
  local required=(
    "asset-contract.md"
    "generation-log.md"
    "README.md"
    "preview-contact-sheet.png"
    "validation-report.json"
    "independent-image2-validation-report.json"
    "visual-metrics-report.json"
    "review-disposition.md"
    "final/hero-image2-idle-front.png"
    "final/hero-image2-idle-back.png"
    "final/hero-image2-walk-front.png"
    "final/hero-image2-walk-back.png"
    "final/hero-image2-shoot-front.png"
    "final/hero-image2-shoot-back.png"
    "final/hero-image2-hit-front.png"
    "final/hero-image2-hit-back.png"
  )

  for rel in "${required[@]}"; do
    if [[ ! -e "$root/$rel" ]]; then
      printf 'missing handoff artifact: %s\n' "$rel" >&2
      missing=1
    fi
  done

  if [[ -f "$root/review-disposition.md" ]] && ! grep -Eiq '^verdict:[[:space:]]*(pass|conditional|fail)\b' "$root/review-disposition.md"; then
    printf 'review-disposition.md must include verdict: pass|conditional|fail\n' >&2
    missing=1
  fi

  if [[ "$missing" -ne 0 ]]; then
    exit 1
  fi
  printf '%s\n' "handoff artifacts complete"
}

case "${1:-}" in
  describe)
    printf '%s\n' "topdown-image2-sprite-pipeline: process and validate image2-derived top-down sprite packages."
    ;;
  list-files)
    find "$skill_root" -type f | sed "s#^$skill_root/##" | sort
    ;;
  validate)
    test -f "$skill_root/SKILL.md"
    test -f "$skill_root/agents/openai.yaml"
    test -f "$skill_root/references/skill-cli.toml"
    test -f "$skill_root/references/asset-contract-template.md"
    test -f "$skill_root/references/failure-modes.md"
    test -f "$skill_root/references/prompt-patterns.md"
    test -f "$skill_root/references/review-checklist.md"
    test -f "$skill_root/scripts/process_image2_sprite_package.py"
    test -f "$skill_root/scripts/analyze_sprite_motion.py"
    test -f "$skill_root/scripts/validate_image2_sprite_package.py"
    if ! print_dependency_status >/dev/null; then
      printf '%s\n' "warning: process, validate-package, and analyze-motion require Pillow." >&2
    fi
    ;;
  check-dependencies)
    print_dependency_status
    ;;
  process)
    shift
    if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || "${1:-}" == "help" ]]; then
      usage
      exit 0
    fi
    root="$(require_root "$@")"
    exec python3 "$skill_root/scripts/process_image2_sprite_package.py" --root "$root"
    ;;
  validate-package)
    shift
    if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || "${1:-}" == "help" ]]; then
      usage
      exit 0
    fi
    root="$(require_root "$@")"
    exec python3 "$skill_root/scripts/validate_image2_sprite_package.py" --root "$root"
    ;;
  analyze-motion|analyze)
    shift
    if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || "${1:-}" == "help" ]]; then
      usage
      exit 0
    fi
    root="$(require_root "$@")"
    exec python3 "$skill_root/scripts/analyze_sprite_motion.py" --root "$root"
    ;;
  check-handoff)
    shift
    if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || "${1:-}" == "help" ]]; then
      usage
      exit 0
    fi
    root="$(require_root "$@")"
    check_handoff "$root"
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
