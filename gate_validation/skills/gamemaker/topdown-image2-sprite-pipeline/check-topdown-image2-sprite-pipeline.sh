set -euo pipefail

root="."

while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      root="$2"
      shift 2
      ;;
    *)
      printf 'unknown argument: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

cd "$root"

skill_dir="skills/gamemaker/topdown-image2-sprite-pipeline"
cli="$skill_dir/scripts/topdown-image2-sprite-pipeline-cli.sh"
manifest="$skill_dir/references/skill-cli.toml"

required_files=(
  "$skill_dir/SKILL.md"
  "$skill_dir/references/asset-contract-template.md"
  "$skill_dir/references/review-checklist.md"
  "$skill_dir/references/frontdoor-rule.toml"
  "$skill_dir/references/review-packet-template.md"
  "$manifest"
  "$cli"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    printf 'missing required file: %s\n' "$file" >&2
    exit 1
  fi
done

for command in \
  check-dependencies \
  process \
  validate-package \
  analyze-motion \
  check-handoff; do
  if ! grep -Fq "name = \"$command\"" "$manifest"; then
    printf 'skill CLI manifest missing command: %s\n' "$command" >&2
    exit 1
  fi
done

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/final" "$tmp/source"
check_stdout="$tmp/check-handoff.out"
check_stderr="$tmp/check-handoff.err"
if "$cli" check-handoff --root "$tmp" >"$check_stdout" 2>"$check_stderr"; then
  printf 'check-handoff unexpectedly passed for incomplete workspace\n' >&2
  exit 1
fi
if ! grep -Fq "missing handoff artifact: review-disposition.md" "$check_stderr"; then
  printf 'check-handoff did not report missing review disposition\n' >&2
  cat "$check_stderr" >&2
  exit 1
fi

touch \
  "$tmp/asset-contract.md" \
  "$tmp/generation-log.md" \
  "$tmp/README.md" \
  "$tmp/preview-contact-sheet.png" \
  "$tmp/validation-report.json" \
  "$tmp/independent-image2-validation-report.json" \
  "$tmp/visual-metrics-report.json" \
  "$tmp/final/hero-image2-idle-front.png" \
  "$tmp/final/hero-image2-idle-back.png" \
  "$tmp/final/hero-image2-walk-front.png" \
  "$tmp/final/hero-image2-walk-back.png" \
  "$tmp/final/hero-image2-shoot-front.png" \
  "$tmp/final/hero-image2-shoot-back.png" \
  "$tmp/final/hero-image2-hit-front.png" \
  "$tmp/final/hero-image2-hit-back.png"

printf '%s\n' "verdict: maybe" > "$tmp/review-disposition.md"
if "$cli" check-handoff --root "$tmp" >"$check_stdout" 2>"$check_stderr"; then
  printf 'check-handoff unexpectedly passed for invalid verdict\n' >&2
  exit 1
fi
if ! grep -Fq "review-disposition.md must include verdict" "$check_stderr"; then
  printf 'check-handoff did not report invalid verdict\n' >&2
  cat "$check_stderr" >&2
  exit 1
fi

printf '%s\n' "verdict: conditional" > "$tmp/review-disposition.md"
"$cli" check-handoff --root "$tmp" >"$check_stdout"
grep -Fq "handoff artifacts complete" "$check_stdout"

printf '%s\n' "topdown-image2-sprite-pipeline gate passed"
