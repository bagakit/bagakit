#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

ROOT="$(repo_root)"
BASE_REF=""
RUN_TESTS=1

usage() {
  cat <<'USAGE'
Usage: scripts/validate-changed-skills.sh [--base-ref <git-ref>] [--skip-tests]

Options:
  --base-ref <git-ref>  Compare changed skill submodules against this ref (default: origin/main or HEAD~1).
  --skip-tests          Skip running each changed skill's scripts_dev/test.sh.
  --help                Show this help message.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-ref)
      BASE_REF="${2:-}"
      if [[ -z "$BASE_REF" ]]; then
        echo "--base-ref requires a value" >&2
        exit 1
      fi
      shift 2
      ;;
    --skip-tests)
      RUN_TESTS=0
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

cd "$ROOT"

if [[ -z "$BASE_REF" ]]; then
  if git rev-parse --verify -q origin/main >/dev/null; then
    BASE_REF="origin/main"
  elif git rev-parse --verify -q HEAD~1 >/dev/null; then
    BASE_REF="HEAD~1"
  else
    echo "Unable to determine base ref; pass --base-ref explicitly" >&2
    exit 1
  fi
fi

if ! git rev-parse --verify -q "$BASE_REF" >/dev/null; then
  echo "Base ref not found: $BASE_REF" >&2
  exit 1
fi

SKILL_PATHS=()
while IFS= read -r path; do
  SKILL_PATHS+=("$path")
done < <(skill_paths)
if [[ "${#SKILL_PATHS[@]}" -eq 0 ]]; then
  echo "No skill paths found"
  exit 0
fi

CHANGED_PATHS=()
while IFS= read -r path; do
  CHANGED_PATHS+=("$path")
done < <(git diff --name-only "$BASE_REF...HEAD")

tmp_changed_skills="$(mktemp -t bagakit-changed-skills.XXXXXX)"
trap 'rm -f "$tmp_changed_skills"' EXIT
for path in "${CHANGED_PATHS[@]}"; do
  for skill_path in "${SKILL_PATHS[@]}"; do
    if [[ "$path" == "$skill_path" ]] || [[ "$path" == "$skill_path/"* ]] || [[ "$skill_path" == "$path/"* ]]; then
      printf "%s\n" "$skill_path" >>"$tmp_changed_skills"
    fi
  done
done

if [[ ! -s "$tmp_changed_skills" ]]; then
  echo "No changed skill submodules detected between $BASE_REF and HEAD"
  exit 0
fi

CHANGED_SKILLS=()
while IFS= read -r path; do
  CHANGED_SKILLS+=("$path")
done < <(sort -u "$tmp_changed_skills")

echo "Changed skill paths (base=$BASE_REF):"
for path in "${CHANGED_SKILLS[@]}"; do
  echo "- $path"
done

for path in "${CHANGED_SKILLS[@]}"; do
  echo "Regressing $path"

  if compgen -G "$ROOT/$path/scripts/*.py" >/dev/null; then
    python3 -m py_compile "$ROOT/$path"/scripts/*.py
  fi

  if [[ "$RUN_TESTS" -eq 1 ]]; then
    if [[ -x "$ROOT/$path/scripts_dev/test.sh" ]]; then
      (cd "$ROOT/$path" && ./scripts_dev/test.sh)
    else
      if [[ "$path" == skills/* && "$path" != skills/*/* ]]; then
        echo "Missing executable test script: $path/scripts_dev/test.sh" >&2
        exit 1
      fi
      echo "warn: optional test script missing for project skill path: $path/scripts_dev/test.sh"
    fi
  fi
done

echo "Changed-skill regression complete."
