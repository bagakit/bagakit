#!/usr/bin/env bash

set -euo pipefail

PROJECT_SKILLS_CATALOG="catalog/project-skills.json"

repo_root() {
  local here
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  printf "%s\n" "$here"
}

submodule_paths() {
  local root
  root="$(repo_root)"
  git -C "$root" config -f .gitmodules --get-regexp '^submodule\..*\.path$' \
    | awk '{print $2}' \
    | sort
}

submodule_skill_paths() {
  local root path
  root="$(repo_root)"
  while IFS= read -r path; do
    [[ -n "$path" ]] || continue
    if [[ -f "$root/$path/SKILL.md" && -f "$root/$path/SKILL_PAYLOAD.json" ]]; then
      printf "%s\n" "$path"
    fi
  done < <(submodule_paths)
}

project_skill_paths() {
  local root catalog
  root="$(repo_root)"
  catalog="$root/$PROJECT_SKILLS_CATALOG"
  if [[ ! -f "$catalog" ]]; then
    return 0
  fi

  python3 - "$catalog" <<'PY'
import json
import sys
from pathlib import PurePosixPath

catalog_path = sys.argv[1]
data = json.loads(open(catalog_path, "r", encoding="utf-8").read())
entries = data.get("project_skills", [])
if not isinstance(entries, list):
    raise SystemExit("catalog/project-skills.json: project_skills must be a list")

seen = set()
for item in entries:
    if not isinstance(item, dict):
        raise SystemExit("catalog/project-skills.json: each entry must be an object")
    submodule_path = item.get("submodule_path")
    skill_path = item.get("skill_path")
    if not isinstance(submodule_path, str) or not submodule_path.strip():
        raise SystemExit("catalog/project-skills.json: missing submodule_path")
    if not isinstance(skill_path, str) or not skill_path.strip():
        raise SystemExit("catalog/project-skills.json: missing skill_path")

    rel = (PurePosixPath(submodule_path.strip()) / PurePosixPath(skill_path.strip())).as_posix()
    if rel in seen:
        continue
    seen.add(rel)
    print(rel)
PY
}

skill_paths() {
  {
    submodule_skill_paths
    project_skill_paths
  } | awk 'NF' | sort -u
}

resolve_submodule_path() {
  local wanted="$1"
  local path
  while IFS= read -r path; do
    if [[ "$path" == "$wanted" ]] || [[ "$(basename "$path")" == "$wanted" ]]; then
      printf "%s\n" "$path"
      return 0
    fi
  done < <(submodule_paths)

  echo "Unknown submodule: $wanted" >&2
  return 1
}

resolve_skill_path() {
  local wanted="$1"
  local path
  local matches=()
  while IFS= read -r path; do
    if [[ "$path" == "$wanted" ]] || [[ "$(basename "$path")" == "$wanted" ]]; then
      matches+=("$path")
    fi
  done < <(skill_paths)

  if [[ "${#matches[@]}" -eq 1 ]]; then
    printf "%s\n" "${matches[0]}"
    return 0
  fi

  if [[ "${#matches[@]}" -gt 1 ]]; then
    {
      echo "Ambiguous skill identifier: $wanted"
      echo "Matches:"
      printf -- "- %s\n" "${matches[@]}"
      echo "Use full path (for example projects/<project>/<skill-dir>)."
    } >&2
    return 1
  fi

  echo "Unknown skill: $wanted" >&2
  return 1
}
