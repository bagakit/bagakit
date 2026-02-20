#!/usr/bin/env bash

set -euo pipefail

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

resolve_skill_path() {
  local wanted="$1"
  local path
  while IFS= read -r path; do
    if [[ "$path" == "$wanted" ]] || [[ "$(basename "$path")" == "$wanted" ]]; then
      printf "%s\n" "$path"
      return 0
    fi
  done < <(submodule_paths)

  echo "Unknown skill: $wanted" >&2
  return 1
}
