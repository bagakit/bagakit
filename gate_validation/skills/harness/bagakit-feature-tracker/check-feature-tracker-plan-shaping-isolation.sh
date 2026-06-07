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

DOC="$ROOT/skills/harness/bagakit-feature-tracker/references/plan-shaping/isolation.md"
if [[ ! -f "$DOC" ]]; then
  echo "error: missing required plan-shaping isolation reference: ${DOC#"$ROOT/"}" >&2
  exit 1
fi

require_heading() {
  local heading="$1"
  if ! grep -Fqx -- "$heading" "$DOC"; then
    echo "error: isolation.md is missing required heading: $heading" >&2
    exit 1
  fi
}

require_text() {
  local text="$1"
  if ! grep -Fq -- "$text" "$DOC"; then
    echo "error: isolation.md is missing required statement: $text" >&2
    exit 1
  fi
}

require_heading '## Device 1: One owning Task per shared-contract change'
require_heading '## Device 2: Owned change surface and known shared hotspots in every Task objective'
require_heading '## Device 3: Deliberate serialization edges for repeated shared-surface changes'
require_heading '## Three-condition true-parallelism test'
require_heading '## Host/Supervisor boundary: Task worktrees and merge order'

# These focused anchors keep the check a wording contract while ensuring that
# an empty heading cannot masquerade as the required guidance.
require_text 'Exactly one'
require_text 'Task owns each shared-contract change.'
require_text 'Every Task `objective` must name both its positive ownership and its known'
require_text 'add a deliberate `depends_on` edge'
require_text 'later change to the'
require_text 'There is no `depends_on` path between them in either direction.'
require_text 'Their declared change surfaces have no shared hotspot'
require_text "Neither Task's gate consumes the other Task's result."
require_text 'pseudo-parallel'
require_text 'Task-level worktrees and merge order stay with the **Host/Supervisor**.'
require_text 'integrated into the Feature workspace'
require_text 'passes there'

echo "feature-tracker plan-shaping isolation passed"
