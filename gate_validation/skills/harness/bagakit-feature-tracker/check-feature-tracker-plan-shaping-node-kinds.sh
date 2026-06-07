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

DOC="$ROOT/skills/harness/bagakit-feature-tracker/references/plan-shaping/node-kinds.md"
if [[ ! -f "$DOC" ]]; then
  echo "error: missing node-kinds reference: ${DOC#"$ROOT/"}" >&2
  exit 1
fi

section() {
  local heading="$1"
  awk -v target="$heading" '
    $0 == target { found = 1; next }
    found && /^## / { exit }
    found { print }
  ' "$DOC"
}

require_heading() {
  local heading="$1"
  local count
  count="$(grep -Fxc -- "$heading" "$DOC" || true)"
  if [[ "$count" -ne 1 ]]; then
    echo "error: node-kinds.md must contain exactly one heading: $heading" >&2
    exit 1
  fi
}

require_section_terms() {
  local heading="$1"
  local label="$2"
  shift 2
  local body
  body="$(section "$heading")"
  if [[ -z "$body" ]]; then
    echo "error: empty node-kind section: $heading" >&2
    exit 1
  fi
  local term
  for term in "$@"; do
    if ! grep -Fqi -- "$term" <<<"$body"; then
      echo "error: $heading is missing $label: $term" >&2
      exit 1
    fi
  done
}

HEADINGS=(
  "## 1. Implementation slice"
  "## 2. Integration join"
  "## 3. Restore point"
  "## 4. Acceptance / regression node"
  "## 5. Independent-oracle proof node vs ceremony"
)

for heading in "${HEADINGS[@]}"; do
  require_heading "$heading"
done

top_level_count="$(grep -Ec '^## ' "$DOC" || true)"
if [[ "$top_level_count" -ne 5 ]]; then
  echo "error: node-kinds.md must keep exactly five top-level node-kind headings (found $top_level_count)" >&2
  exit 1
fi

if ! grep -Fqi -- "exactly five top-level node kinds" "$DOC" ||
   ! grep -Fqi -- "not a sixth top-level kind" "$DOC"; then
  echo "error: node-kinds.md must state that the typology has five kinds and SSOT is not a sixth" >&2
  exit 1
fi

require_section_terms "## 1. Implementation slice" "acceptance convention" \
  "Acceptance wording" "acceptance names only behavior owned by this slice"
require_section_terms "## 1. Implementation slice" "depends_on convention" \
  "\`depends_on\` shape" "real prerequisites" "minimal sufficient oracle"
require_section_terms "## 1. Implementation slice" "must-not boundary" \
  "Must-not boundary" "cross-slice regression" "undeclared shared hotspot" \
  "drive-by refactors" "sibling slices"

require_section_terms "## 2. Integration join" "acceptance convention" \
  "Acceptance wording" "integrated into the Feature workspace" "join gate passes"
require_section_terms "## 2. Integration join" "depends_on convention" \
  "\`depends_on\` shape" "every branch" "coexist in the candidate"
require_section_terms "## 2. Integration join" "must-not boundary" \
  "Must-not boundary" "new behavior or new content" "refactor opportunistically" \
  "hotspot surface"

require_section_terms "## 3. Restore point" "acceptance convention" \
  "Acceptance wording" "named Git tag or branch" "acceptance attribute on an integration join" \
  "independent node only when" \
  "delivery milestone"
require_section_terms "## 3. Restore point" "depends_on convention" \
  "\`depends_on\` shape" "complete batch" "Later work may depend"
require_section_terms "## 3. Restore point" "must-not boundary" \
  "Must-not boundary" "must not change any content" "No commit SHA may be recorded in Tracker truth"

require_section_terms "## 4. Acceptance / regression node" "acceptance convention" \
  "Acceptance wording" "independent oracle" "Cross-slice evidence belongs here"
require_section_terms "## 4. Acceptance / regression node" "depends_on convention" \
  "\`depends_on\` shape" "DAG sink" "implementation nodes never depend on it"
require_section_terms "## 4. Acceptance / regression node" "must-not boundary" \
  "Must-not boundary" "edit implementation code" "weaken or bypass existing gates" \
  "add implementation behavior"
require_section_terms "## 4. Acceptance / regression node" "test-split criterion" \
  "Test-split criterion" "test Task may split from an implementation Task only when" \
  "without reading the implementation diff" "slice's own minimal sufficient oracle" \
  "never splits out" "wording-contract checks stay co-owned" "self-gating"

require_section_terms "## 5. Independent-oracle proof node vs ceremony" "acceptance convention" \
  "Acceptance wording" "unique oracle" "executable command gate"
require_section_terms "## 5. Independent-oracle proof node vs ceremony" "depends_on convention" \
  "\`depends_on\` shape" "integration join" "no implementation node depends on it"
require_section_terms "## 5. Independent-oracle proof node vs ceremony" "must-not boundary" \
  "Must-not boundary" "SSOT drift audit must not edit the SSOT body" \
  "read-only review without leaving an executable detector"

SSOT_HEADING="### SSOT drift-audit variant (not a sixth top-level kind)"
ssot_body="$(section "## 5. Independent-oracle proof node vs ceremony")"
if ! grep -Fxc -- "$SSOT_HEADING" <<<"$ssot_body" >/dev/null; then
  echo "error: independent-oracle section is missing the SSOT drift-audit subsection" >&2
  exit 1
fi
require_section_terms "## 5. Independent-oracle proof node vs ceremony" "SSOT drift-audit trigger and detector obligation" \
  "trigger is a Feature touching any owning contract or doc surface" \
  "executable drift detector" "exits nonzero when the owning surfaces diverge" \
  "never a read-and-confirm ritual" "one audit node by default" \
  "Fan out only when detector oracle kinds differ"

echo "feature-tracker plan-shaping node-kinds passed"
