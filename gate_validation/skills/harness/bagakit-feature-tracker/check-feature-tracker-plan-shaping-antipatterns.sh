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

CATALOG="$ROOT/skills/harness/bagakit-feature-tracker/references/plan-shaping/antipatterns.md"
if [[ ! -f "$CATALOG" ]]; then
  echo "error: missing antipattern catalog: ${CATALOG#"$ROOT/"}" >&2
  exit 1
fi

# Numbered level-2 headings are the published entry boundary.  Introductory
# headings deliberately do not match this shape, so an entry cannot be hidden
# in free-form prose.
ENTRY_LINES=()
while IFS=: read -r line _; do
  [[ -n "$line" ]] && ENTRY_LINES+=("$line")
done < <(grep -nE '^## [0-9]+[.)][[:space:]]+' "$CATALOG" || true)
ENTRY_COUNT="${#ENTRY_LINES[@]}"
if (( ENTRY_COUNT < 10 )); then
  echo "error: antipattern catalog must contain at least ten numbered entries (found $ENTRY_COUNT)" >&2
  exit 1
fi

TOTAL_LINES="$(wc -l < "$CATALOG" | tr -d '[:space:]')"
ritual_ssot_found=0
oracleless_decision_found=0

for ((i = 0; i < ENTRY_COUNT; i++)); do
  start="${ENTRY_LINES[$i]}"
  if (( i + 1 < ENTRY_COUNT )); then
    end="${ENTRY_LINES[$((i + 1))]}"
  else
    end=$((TOTAL_LINES + 1))
  fi
  section="$(sed -n "${start},$((end - 1))p" "$CATALOG")"
  heading="$(sed -n "${start}p" "$CATALOG")"

  if ! grep -Eq '^-[[:space:]]+\*\*Name:\*\*[[:space:]]+[^[:space:]]' <<<"$section"; then
    echo "error: $heading is missing a non-empty Name field" >&2
    exit 1
  fi
  if ! grep -Eq '^-[[:space:]]+\*\*Observable symptom:\*\*[[:space:]]+[^[:space:]]' <<<"$section"; then
    echo "error: $heading is missing a non-empty Observable symptom field" >&2
    exit 1
  fi
  if ! grep -Eq '^-[[:space:]]+\*\*Corrective plan shape:\*\*[[:space:]]+[^[:space:]]' <<<"$section"; then
    echo "error: $heading is missing a non-empty Corrective plan shape field" >&2
    exit 1
  fi

  if grep -Fq -- 'Ritual SSOT Audit Without Detector' <<<"$section"; then
    ritual_ssot_found=1
  fi
  if grep -Fq -- 'Oracle-less Decision Task' <<<"$section"; then
    oracleless_decision_found=1
  fi
done

if (( ritual_ssot_found == 0 )); then
  echo "error: missing required Ritual SSOT Audit Without Detector entry" >&2
  exit 1
fi
if (( oracleless_decision_found == 0 )); then
  echo "error: missing required Oracle-less Decision Task entry" >&2
  exit 1
fi

echo "feature-tracker plan-shaping antipatterns passed ($ENTRY_COUNT entries)"
