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

OWNER_REL="gate_validation/skills/co-work/orchestrate/execution/bagakit-feature-tracker"
PLAN_DIR="$ROOT/skills/co-work/orchestrate/execution/bagakit-feature-tracker/references/plan-shaping"
GUIDE="$PLAN_DIR/GUIDE.md"
SKILL="$ROOT/skills/co-work/orchestrate/execution/bagakit-feature-tracker/SKILL.md"
OWNER_DIR="$ROOT/$OWNER_REL"
VALIDATION="$OWNER_DIR/validation.toml"

failures=0
fail() {
  echo "error: $*" >&2
  failures=$((failures + 1))
}

for required in "$PLAN_DIR" "$GUIDE" "$SKILL" "$OWNER_DIR" "$VALIDATION"; do
  if [[ ! -e "$required" ]]; then
    fail "missing SSOT surface: ${required#"$ROOT/"}"
  fi
done

if (( failures > 0 )); then
  exit 1
fi

# Derive the child reference set from the live directory.  GUIDE.md is the
# index itself, not one of the child references it must link.
children=()
while IFS= read -r child; do
  [[ -z "$child" || "$child" == "GUIDE.md" ]] && continue
  children+=("${child#"$PLAN_DIR/"}")
done < <(
  find "$PLAN_DIR" -type f -name '*.md' ! -path "$GUIDE" |
    LC_ALL=C sort
)

# Resolve every local markdown link in GUIDE.md against its owning directory.
# External URLs and fragment-only links are not child references.  A local
# link must stay in this directory and point at a real file.
guide_children=()
while IFS= read -r link; do
  [[ -z "$link" ]] && continue
  target="${link#*](}"
  target="${target%)}"
  target="${target%%#*}"
  target="${target%%\?*}"

  case "$target" in
    ""|\#*)
      continue
      ;;
    *://*|mailto:*|tel:*)
      continue
      ;;
  esac

  if [[ "$target" == /* || "$target" == ".." || "$target" == ../* || "$target" == */../* ]]; then
    fail "GUIDE.md link escapes the plan-shaping directory: $target"
    continue
  fi

  target="${target#./}"
  target_path="$PLAN_DIR/$target"
  if [[ ! -f "$target_path" ]]; then
    fail "GUIDE.md link target does not exist: $target"
    continue
  fi

  if [[ "$target" == *.md && "$target" != "GUIDE.md" ]]; then
    guide_children+=("$target")
  fi
done < <(grep -oE '\[[^][]+\]\([^)]*\)' "$GUIDE" || true)

for child in "${children[@]}"; do
  found=0
  for linked in "${guide_children[@]}"; do
    if [[ "$linked" == "$child" ]]; then
      found=1
      break
    fi
  done
  if (( found == 0 )); then
    fail "GUIDE.md does not link live markdown child: $child"
  fi
done

# The routing pointer is an explicit singleton contract.  The entry wording
# gate owns its section placement; this audit owns cross-surface cardinality.
pointer='references/plan-shaping/GUIDE.md'
pointer_count="$(grep -Foc -- "$pointer" "$SKILL" || true)"
if [[ "$pointer_count" -ne 1 ]]; then
  fail "SKILL.md must contain exactly one plan-shaping GUIDE pointer (found $pointer_count)"
fi

# Derive the registered plan-shaping script set from suite and runner entries
# in validation.toml.  Comparing this set with live check scripts catches both
# unregistered files and registrations that point at removed files.  The suite
# id is included so a plan-shaping suite cannot hide a missing custom script
# behind a non-standard filename.
registered_scripts=()
current_suite_id=""
in_runner=0
while IFS= read -r line || [[ -n "$line" ]]; do
  case "$line" in
    '[[suite]]')
      current_suite_id=""
      in_runner=0
      continue
      ;;
    '[suite.runner]')
      in_runner=1
      continue
      ;;
    '[['*|'['*)
      in_runner=0
      continue
      ;;
  esac

  if [[ -z "$current_suite_id" ]]; then
    current_suite_id="$(sed -nE \
      -e 's/^[[:space:]]*id[[:space:]]*=[[:space:]]*"([^"]*)".*$/\1/p' \
      -e "s/^[[:space:]]*id[[:space:]]*=[[:space:]]*'([^']*)'.*$/\1/p" \
      <<<"$line")"
  fi

  if (( in_runner == 1 )); then
    runner_script="$(sed -nE \
      -e 's/^[[:space:]]*script[[:space:]]*=[[:space:]]*"([^"]*)".*$/\1/p' \
      -e "s/^[[:space:]]*script[[:space:]]*=[[:space:]]*'([^']*)'.*$/\1/p" \
      <<<"$line")"
    if [[ -n "$runner_script" ]]; then
      case "$current_suite_id:$runner_script" in
        bagakit-feature-tracker-plan-shaping-*:*|*:"$OWNER_REL"/check-feature-tracker-plan-shaping-*.sh)
          registered_scripts+=("$runner_script")
          ;;
      esac
    fi
  fi
done < "$VALIDATION"

live_scripts=()
for script in "$OWNER_DIR"/check-feature-tracker-plan-shaping-*.sh; do
  [[ -f "$script" ]] || continue
  live_scripts+=("$OWNER_REL/$(basename "$script")")
done

for script in "${live_scripts[@]}"; do
  found=0
  for registered in "${registered_scripts[@]}"; do
    if [[ "$registered" == "$script" ]]; then
      found=1
      break
    fi
  done
  if (( found == 0 )); then
    fail "plan-shaping check has no validation.toml suite: $script"
  fi
done

for registered in "${registered_scripts[@]}"; do
  if [[ ! -f "$ROOT/$registered" ]]; then
    fail "registered plan-shaping check script does not exist: $registered"
  fi
done

if (( failures > 0 )); then
  exit 1
fi

echo "feature-tracker plan-shaping SSOT drift check passed"
