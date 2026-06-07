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

GRANULARITY="$ROOT/skills/harness/bagakit-feature-tracker/references/plan-shaping/granularity.md"
if [[ ! -f "$GRANULARITY" ]]; then
  echo "error: missing required plan-shaping granularity reference: ${GRANULARITY#"$ROOT/"}" >&2
  exit 1
fi

require_heading() {
  local heading="$1"
  if ! grep -Fqx -- "$heading" "$GRANULARITY"; then
    echo "error: granularity.md is missing required heading: $heading" >&2
    exit 1
  fi
}

require_text() {
  local text="$1"
  if ! grep -Fq -- "$text" "$GRANULARITY"; then
    echo "error: granularity.md is missing required contract text: $text" >&2
    exit 1
  fi
}

require_heading '### Signal 1: multiple independently verifiable results inside one acceptance'
require_heading '### Signal 2: verification commands spanning unrelated oracles'
require_heading '### Signal 3: expected diff crossing two owning boundaries'
require_heading '### Signal 4: a mid-Task state that is itself worth stopping at'
require_heading '### Parallel edits would target one artifact'
require_heading '### The intermediate state has no executable command gate'
require_heading '### Ceremony-only splitting'

require_text 'One Task closes as approximately one intent-coherent commit.'
require_text 'An oversized or mixed-intent'
require_text 'commit at close time is a drafting-granularity failure'
require_text 'splitting would force parallel edits of one artifact'
require_text 'intermediate state has no executable command gate'
require_text 'Ceremony-only splitting'
require_text 'spine first, fan-out second, every fan-out joined'

echo "feature-tracker plan-shaping granularity passed"
