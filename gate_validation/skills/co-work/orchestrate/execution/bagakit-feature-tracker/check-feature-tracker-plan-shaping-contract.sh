#!/usr/bin/env bash
set -euo pipefail

ROOT="."
while [[ $# -gt 0 ]]; do
  case "$1" in
    --root) ROOT="$2"; shift 2 ;;
    *) echo "error: unexpected argument: $1" >&2; exit 2 ;;
  esac
done
ROOT="$(cd "$ROOT" && pwd)"
PLAN="$ROOT/skills/co-work/orchestrate/execution/bagakit-feature-tracker/references/plan-shaping"

require_file() {
  [[ -f "$1" ]] || { echo "error: missing ${1#"$ROOT/"}" >&2; exit 1; }
}
require_text() {
  local file="$1" text="$2"
  grep -Fq -- "$text" "$file" || {
    echo "error: ${file#"$ROOT/"} is missing: $text" >&2
    exit 1
  }
}
require_heading() {
  local file="$1" heading="$2"
  [[ "$(grep -Fxc -- "$heading" "$file" || true)" == 1 ]] || {
    echo "error: ${file#"$ROOT/"} must contain one heading: $heading" >&2
    exit 1
  }
}

for file in GUIDE.md preflight.md node-kinds.md granularity.md isolation.md antipatterns.md; do
  require_file "$PLAN/$file"
done

# GUIDE is the public entry index: every child reference is linked once and
# the skill routes to this index once from its task-decomposition section.
for child in node-kinds.md granularity.md isolation.md antipatterns.md preflight.md; do
  [[ "$(grep -Foc -- "[$child]($child)" "$PLAN/GUIDE.md" || true)" == 1 ]] || {
    echo "error: GUIDE.md must link $child exactly once" >&2
    exit 1
  }
done
skill="$ROOT/skills/co-work/orchestrate/execution/bagakit-feature-tracker/SKILL.md"
[[ "$(grep -Foc -- 'references/plan-shaping/GUIDE.md' "$skill" || true)" == 1 ]] || {
  echo "error: SKILL.md must route to plan-shaping GUIDE exactly once" >&2
  exit 1
}

# Preflight remains a falsifiable public checklist.
questions="$(grep -Ec '^## [0-9]+[.)][[:space:]]+' "$PLAN/preflight.md" || true)"
yes_no="$(grep -Eic '^[[:space:]]*-[[:space:]]+\*\*Yes/No:\*\*' "$PLAN/preflight.md" || true)"
(( questions >= 8 && questions <= 11 && questions == yes_no )) || {
  echo "error: preflight must contain one Yes/No prompt for each of 8-11 questions" >&2
  exit 1
}
for text in 'one independently verifiable result' 'explicit integration join' \
  'shared-contract change' \
  'exactly one owning' 'named Git tag or branch' 'zero ceremony-only' \
  'independent executable oracle' 'executable drift detector' 'runtime integration' \
  'Supervisor'; do
  require_text "$PLAN/preflight.md" "$text"
done

# Keep the published five-kind typology and its negative boundaries intact.
for heading in \
  '## 1. Implementation slice' '## 2. Integration join' '## 3. Restore point' \
  '## 4. Acceptance / regression node' \
  '## 5. Independent-oracle proof node vs ceremony'; do
  require_heading "$PLAN/node-kinds.md" "$heading"
done
[[ "$(grep -Ec '^## ' "$PLAN/node-kinds.md" || true)" == 5 ]] || {
  echo "error: node-kinds.md must keep exactly five top-level kinds" >&2
  exit 1
}
for text in 'exactly five top-level node kinds' 'not a sixth top-level kind' \
  'integrated into the Feature workspace' 'DAG sink' 'unique oracle' \
  'executable command gate' 'Wording-contract checks stay co-owned' \
  'SSOT drift audit must not edit the SSOT body'; do
  require_text "$PLAN/node-kinds.md" "$text"
done

for heading in \
  '### Signal 1: multiple independently verifiable results inside one acceptance' \
  '### Signal 2: verification commands spanning unrelated oracles' \
  '### Signal 3: expected diff crossing two owning boundaries' \
  '### Signal 4: a mid-Task state that is itself worth stopping at' \
  '### Parallel edits would target one artifact' \
  '### The intermediate state has no executable command gate' \
  '### Ceremony-only splitting'; do
  require_heading "$PLAN/granularity.md" "$heading"
done
# The public drafting contract must not turn Git packaging into Task identity.
require_text "$PLAN/granularity.md" 'Neither a commit nor an MR'

for heading in \
  '## Device 1: One owning Task per shared-contract change' \
  '## Device 2: Owned change surface and known shared hotspots in every Task objective' \
  '## Device 3: Deliberate serialization edges for repeated shared-surface changes' \
  '## Three-condition true-parallelism test' \
  '## Host/Supervisor boundary: Task worktrees and merge order'; do
  require_heading "$PLAN/isolation.md" "$heading"
done
for text in 'Task owns each shared-contract change.' \
  'Every Task `objective` must name both its positive ownership and its known' \
  'add a deliberate `depends_on` edge' \
  'There is no `depends_on` path between them in either direction.' \
  'Their declared change surfaces have no shared hotspot' \
  "Neither Task's gate consumes the other Task's result." \
  'Task-level worktrees and merge order stay with the **Host/Supervisor**.'; do
  require_text "$PLAN/isolation.md" "$text"
done

# The catalog is a public negative reference: validate its entry schema and
# the two entries that guard against ritual SSOT and oracle-less work.
entries="$(grep -Ec '^## [0-9]+[.)][[:space:]]+' "$PLAN/antipatterns.md" || true)"
(( entries >= 10 )) || { echo "error: antipattern catalog has fewer than 10 entries" >&2; exit 1; }
for text in '**Name:**' '**Observable symptom:**' '**Corrective plan shape:**' \
  'Ritual SSOT Audit Without Detector' 'Oracle-less Decision Task'; do
  require_text "$PLAN/antipatterns.md" "$text"
done

git -C "$ROOT" rev-parse --verify refs/tags/restore/plan-shaping-bootstrap-join >/dev/null 2>&1 || {
  echo "error: missing restore tag restore/plan-shaping-bootstrap-join" >&2
  exit 1
}
echo "feature-tracker plan-shaping contract passed"
