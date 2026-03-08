set -euo pipefail

ROOT="."

while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      [[ $# -ge 2 ]] || { echo "missing value for --root" >&2; exit 2; }
      ROOT="$2"
      shift 2
      ;;
    -h|--help)
      cat <<'EOF'
usage: gate_validation/skills/harness/bagakit-skill-selector/check-selector-recipes.sh [--root <repo-root>]
EOF
      exit 0
      ;;
    *)
      echo "unexpected argument: $1" >&2
      exit 2
      ;;
  esac
done

ROOT="$(cd "$ROOT" && pwd)"
RECIPE_DIR="$ROOT/skills/harness/bagakit-skill-selector/recipes"

required_headings=(
  "## Fit Signals"
  "## Non-Fit Signals"
  "## Participants"
  "## Execution Order"
  "## Required Steps"
  "## Optional Steps"
  "## Skill Responsibilities"
  "## Inputs"
  "## Outputs"
  "## Synthesis Artifact"
  '## Evidence To Record In `skill-usage.toml`'
  "## Fallback And Degrade"
  "## When It Is Not Worth It"
)

while IFS= read -r recipe; do
  for heading in "${required_headings[@]}"; do
    escaped_heading="${heading//\`/\\\`}"
    if ! rg -q "^${escaped_heading}\$" "$recipe"; then
      echo "missing required heading in $(basename "$recipe"): $heading" >&2
      exit 1
    fi
  done
done < <(find "$RECIPE_DIR" -maxdepth 1 -type f -name '*.md' ! -name 'README.md' | sort)

echo "ok: selector recipes contain the required contract headings"
