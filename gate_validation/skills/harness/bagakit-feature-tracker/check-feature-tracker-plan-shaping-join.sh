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

PLAN_DIR="$ROOT/skills/harness/bagakit-feature-tracker/references/plan-shaping"
GUIDE="$PLAN_DIR/GUIDE.md"
PREFLIGHT="$PLAN_DIR/preflight.md"
RESTORE_TAG="restore/plan-shaping-bootstrap-join"

require_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "error: missing required plan-shaping join file: ${path#"$ROOT/"}" >&2
    exit 1
  fi
}

require_file "$GUIDE"
require_file "$PREFLIGHT"

# The preflight is intentionally a short, falsifiable checklist.  Count the
# published numbered question sections and their Yes/No prompts rather than
# accepting free-form prose that merely mentions the required topics.
question_count="$(grep -Ec '^## [0-9]+[.)][[:space:]]+' "$PREFLIGHT" || true)"
if (( question_count < 8 || question_count > 10 )); then
  echo "error: preflight.md must contain eight to ten numbered questions (found $question_count)" >&2
  exit 1
fi

yes_no_count="$(grep -Eic '^[[:space:]]*-[[:space:]]+\*\*Yes/No:\*\*' "$PREFLIGHT" || true)"
if [[ "$yes_no_count" -ne "$question_count" ]]; then
  echo "error: every numbered preflight question must have one Yes/No prompt (found $yes_no_count for $question_count sections)" >&2
  exit 1
fi

# Only question bodies count toward coverage; introductory guidance cannot
# satisfy a required self-check by mentioning a term out of context.
question_body="$({
  awk '
    /^## [0-9]+[.)][[:space:]]+/ { in_questions = 1 }
    in_questions { print }
  ' "$PREFLIGHT"
} | tr '\n' ' ' | tr -s ' ')"

require_question_text() {
  local text="$1"
  if ! grep -Fq -- "$text" <<<"$question_body"; then
    echo "error: preflight.md is missing required question coverage: $text" >&2
    exit 1
  fi
}

require_question_text 'one independently verifiable result'
require_question_text 'two or more parallel branches'
require_question_text 'explicit integration join'
require_question_text 'terminal acceptance or regression node'
require_question_text 'DAG sink'
require_question_text 'shared-contract change'
require_question_text 'exactly one owning'
require_question_text 'restore-point placement'
require_question_text 'named Git tag or branch'
require_question_text 'commit SHAs out of Tracker truth'
require_question_text 'zero ceremony nodes'
require_question_text 'zero ceremony-only'
require_question_text 'independent executable oracle'
require_question_text 'owning contract or doc surface'
require_question_text 'executable drift detector'
require_question_text 'exits nonzero'
require_question_text 'surfaces diverge'
require_question_text 'every fan-out wave'
require_question_text 'earliest'
require_question_text 'runtime integration'
require_question_text 'Supervisor'

# Resolve the five GUIDE links against the directory that owns GUIDE.md.  The
# expected link label is part of the entry contract; extracting its target
# here also ensures the gate checks the path actually written in the link.
for child in node-kinds.md granularity.md isolation.md antipatterns.md preflight.md; do
  matches="$(grep -oE "\\[$child\\]\\([^)]*\\)" "$GUIDE" || true)"
  match_count="$(grep -c . <<<"$matches" || true)"
  if [[ "$match_count" -ne 1 ]]; then
    echo "error: GUIDE.md must contain exactly one link for $child" >&2
    exit 1
  fi

  link="$(head -n 1 <<<"$matches")"
  target="${link#*](}"
  target="${target%)}"
  target="${target%%#*}"
  if [[ -z "$target" || "$target" == /* || "$target" == *".."* || ! -f "$PLAN_DIR/$target" ]]; then
    echo "error: GUIDE.md link for $child does not resolve to a file: $target" >&2
    exit 1
  fi
done

if ! git -C "$ROOT" rev-parse --verify "refs/tags/$RESTORE_TAG" >/dev/null 2>&1; then
  echo "error: missing restore tag $RESTORE_TAG" >&2
  exit 1
fi

echo "feature-tracker plan-shaping join passed"
