#!/usr/bin/env bash
set -euo pipefail

ROOT="."
while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      if [[ $# -lt 2 ]]; then
        echo "error: --root requires a path" >&2
        exit 2
      fi
      ROOT="$2"
      shift 2
      ;;
    *)
      echo "error: unexpected argument: $1" >&2
      exit 2
      ;;
  esac
done

if ! ROOT="$(cd "$ROOT" 2>/dev/null && pwd)"; then
  echo "error: repository root does not exist: $ROOT" >&2
  exit 1
fi

GUIDE="$ROOT/skills/harness/bagakit-feature-tracker/references/plan-shaping/GUIDE.md"
SKILL="$ROOT/skills/harness/bagakit-feature-tracker/SKILL.md"

require_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "error: missing required plan-shaping entry file: ${path#"$ROOT/"}" >&2
    exit 1
  fi
}

require_file "$GUIDE"
require_file "$SKILL"

if ! grep -Fq -- "## When to use" "$GUIDE"; then
  echo "error: GUIDE.md is missing the When to use section" >&2
  exit 1
fi

guide_when_to_use="$({
  awk '
    /^## When to use[[:space:]]*$/ { in_section = 1; next }
    in_section && /^## / { exit }
    in_section { print }
  ' "$GUIDE"
} )"
if [[ -z "$guide_when_to_use" ]] ||
   ! grep -Fq -- 'tasks.json' <<<"$guide_when_to_use" ||
   ! grep -Fq -- 'before' <<<"$guide_when_to_use" ||
   ! grep -Fq -- 'set-task-plan' <<<"$guide_when_to_use"; then
  echo "error: GUIDE.md When to use section must name tasks.json drafting before set-task-plan" >&2
  exit 1
fi

for child in node-kinds.md granularity.md isolation.md antipatterns.md preflight.md; do
  link="[$child]($child)"
  count="$(grep -Foc -- "$link" "$GUIDE" || true)"
  if [[ "$count" -ne 1 ]]; then
    echo "error: GUIDE.md must contain exactly one link stub for $child" >&2
    exit 1
  fi
done

task_section="$({
  awk '
    /^## Task Decomposition And Parallelism[[:space:]]*$/ { in_section = 1 }
    in_section { print }
    in_section && NR > 1 && /^## / && $0 !~ /^## Task Decomposition And Parallelism[[:space:]]*$/ { exit }
  ' "$SKILL"
} )"
pointer='references/plan-shaping/GUIDE.md'
pointer_count="$(grep -Foc -- "$pointer" "$SKILL" || true)"
if [[ "$pointer_count" -ne 1 ]] || ! grep -Fq -- "$pointer" <<<"$task_section"; then
  echo "error: SKILL.md must contain exactly one plan-shaping GUIDE pointer in Task Decomposition And Parallelism" >&2
  exit 1
fi

echo "feature-tracker plan-shaping entry passed"
