#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

ROOT="$(repo_root)"
DIST_DIR="$ROOT/dist"
SKILL_FILTER=""
CLEAN_DIST=1

usage() {
  cat <<'USAGE'
Usage: scripts/package-all-skills.sh [--dist <dir>] [--skill <name-or-path>] [--no-clean]

Options:
  --dist <dir>   Output directory. Relative paths are resolved from repo root.
  --skill <id>   Package only one skill (submodule path or basename).
  --no-clean     Do not clear dist before packaging.
  --help         Show help.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dist)
      [[ $# -ge 2 ]] || {
        echo "Missing value for --dist" >&2
        exit 1
      }
      DIST_DIR="$2"
      shift 2
      ;;
    --skill)
      [[ $# -ge 2 ]] || {
        echo "Missing value for --skill" >&2
        exit 1
      }
      SKILL_FILTER="$2"
      shift 2
      ;;
    --no-clean)
      CLEAN_DIST=0
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

if [[ "$DIST_DIR" != /* ]]; then
  DIST_DIR="$ROOT/$DIST_DIR"
fi

if [[ "$CLEAN_DIST" -eq 1 ]]; then
  rm -rf "$DIST_DIR"
fi
mkdir -p "$DIST_DIR"

BUILD_ROOT="$(mktemp -d -t bagakit-skill-package.XXXXXX)"
trap 'rm -rf "$BUILD_ROOT"' EXIT

MANIFEST="$DIST_DIR/manifest.txt"
{
  printf "generated_at=%s\n" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  printf "repo_root=%s\n\n" "$ROOT"
} > "$MANIFEST"

resolve_targets() {
  if [[ -n "$SKILL_FILTER" ]]; then
    resolve_skill_path "$SKILL_FILTER"
  else
    skill_paths
  fi
}

packaged_count=0
skill_count=0
manual_dir_count=0

if ! command -v unzip >/dev/null 2>&1; then
  echo "Missing required command: unzip" >&2
  exit 1
fi

payload_entries() {
  local payload_file="$1"
  python3 - "$payload_file" <<'PY'
import json
import sys
from pathlib import PurePosixPath

payload_path = sys.argv[1]
with open(payload_path, "r", encoding="utf-8") as fh:
    data = json.load(fh)

if data.get("version") != 1:
    raise SystemExit("SKILL_PAYLOAD.json version must be 1")

include = data.get("include")
if not isinstance(include, list) or not include:
    raise SystemExit("SKILL_PAYLOAD.json include must be a non-empty array")

seen = set()
normalized = []
for raw in include:
    if not isinstance(raw, str) or not raw.strip():
        raise SystemExit("SKILL_PAYLOAD.json include entries must be non-empty strings")
    path = PurePosixPath(raw)
    if path.is_absolute():
        raise SystemExit(f"SKILL_PAYLOAD.json include path must be relative: {raw}")
    if ".." in path.parts:
        raise SystemExit(f"SKILL_PAYLOAD.json include path traversal is not allowed: {raw}")
    value = path.as_posix()
    if value in seen:
        continue
    seen.add(value)
    normalized.append(value)

if "SKILL.md" not in seen:
    raise SystemExit("SKILL_PAYLOAD.json include must contain SKILL.md")

for item in normalized:
    print(item)
PY
}

copy_runtime_payload() {
  local source="$1"
  local target="$2"
  local skill="$3"
  local payload_file="$source/SKILL_PAYLOAD.json"
  local entry

  if [[ ! -f "$payload_file" ]]; then
    echo "Missing SKILL_PAYLOAD.json in packaged archive for $skill" >&2
    return 1
  fi

  while IFS= read -r entry; do
    [[ -n "$entry" ]] || continue
    local src_path="$source/$entry"
    local dest_path="$target/$entry"

    if [[ ! -e "$src_path" ]]; then
      echo "Payload entry missing in archive for $skill: $entry" >&2
      return 1
    fi

    if [[ -d "$src_path" ]]; then
      mkdir -p "$dest_path"
      cp -R "$src_path"/. "$dest_path"/
    else
      mkdir -p "$(dirname "$dest_path")"
      cp -f "$src_path" "$dest_path"
    fi
  done < <(payload_entries "$payload_file")
}

prepare_manual_dir() {
  local archive="$1"
  local skill="$2"
  local target="$DIST_DIR/$skill"
  local unpack="$BUILD_ROOT/unpack-$skill"
  local source="$unpack"

  find "$unpack" -mindepth 1 -delete 2>/dev/null || true
  mkdir -p "$unpack"
  unzip -q "$archive" -d "$unpack"

  if [[ -d "$unpack/$skill" ]]; then
    source="$unpack/$skill"
  fi

  mkdir -p "$target"
  find "$target" -mindepth 1 -delete 2>/dev/null || true
  if [[ -z "$(find "$source" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
    echo "warn: expanded payload is empty for $skill ($archive)" >&2
    return
  fi
  copy_runtime_payload "$source" "$target" "$skill"
  manual_dir_count=$((manual_dir_count + 1))
}

while IFS= read -r rel_path; do
  [[ -n "$rel_path" ]] || continue
  skill_count=$((skill_count + 1))

  skill_dir="$ROOT/$rel_path"
  skill_name="$(basename "$rel_path")"
  skill_build_rel=".dist-build/$skill_name"
  skill_build_dir="$skill_dir/$skill_build_rel"
  echo "Packaging $skill_name ($rel_path)"

  if [[ ! -f "$skill_dir/Makefile" ]]; then
    echo "Missing Makefile: $rel_path/Makefile" >&2
    exit 1
  fi

  if [[ -d "$skill_dir/dist" ]]; then
    find "$skill_dir/dist" -maxdepth 1 -type f -name "${skill_name}*.skill" -delete
  fi
  if [[ -d "$skill_build_dir" ]]; then
    find "$skill_build_dir" -maxdepth 1 -type f -name "${skill_name}*.skill" -delete
  fi
  if [[ -d "$ROOT/dist" ]]; then
    find "$ROOT/dist" -maxdepth 1 -type f -name "${skill_name}*.skill" -delete
  fi

  stamp_file="$BUILD_ROOT/${skill_name}.stamp"
  : > "$stamp_file"
  mkdir -p "$skill_build_dir"
  PWD="$skill_dir" DIST_DIR="$skill_build_rel" make -C "$skill_dir" package-skill >/dev/null

  candidates_file="$BUILD_ROOT/${skill_name}.candidates"
  : > "$candidates_file"
  if [[ -d "$skill_build_dir" ]]; then
    find "$skill_build_dir" -maxdepth 1 -type f -name "*.skill" -newer "$stamp_file" | sort >> "$candidates_file"
  fi
  if [[ -d "$skill_dir/dist" ]]; then
    find "$skill_dir/dist" -maxdepth 1 -type f -name "*.skill" -newer "$stamp_file" | sort >> "$candidates_file"
  fi
  if [[ -d "$ROOT/dist" ]]; then
    find "$ROOT/dist" -maxdepth 1 -type f -name "*.skill" -newer "$stamp_file" | sort >> "$candidates_file"
  fi
  if [[ ! -s "$candidates_file" ]]; then
    if [[ -d "$skill_build_dir" ]]; then
      find "$skill_build_dir" -maxdepth 1 -type f -name "${skill_name}*.skill" | sort >> "$candidates_file"
    fi
    if [[ -d "$skill_dir/dist" ]]; then
      find "$skill_dir/dist" -maxdepth 1 -type f -name "${skill_name}*.skill" | sort >> "$candidates_file"
    fi
    if [[ -d "$ROOT/dist" ]]; then
      find "$ROOT/dist" -maxdepth 1 -type f -name "${skill_name}*.skill" | sort >> "$candidates_file"
    fi
  fi
  sort -u "$candidates_file" -o "$candidates_file"

  if [[ ! -s "$candidates_file" ]]; then
    echo "No .skill artifact produced for $rel_path" >&2
    exit 1
  fi

  while IFS= read -r artifact; do
    [[ -n "$artifact" ]] || continue
    dest="$DIST_DIR/$(basename "$artifact")"
    if [[ "$artifact" != "$dest" ]]; then
      cp -f "$artifact" "$dest"
    fi
    checksum="$(shasum -a 256 "$dest" | awk '{print $1}')"
    size="$(wc -c < "$dest" | tr -d '[:space:]')"
    printf "%s\t%s\t%s\t%s\n" "$skill_name" "$(basename "$dest")" "$size" "$checksum" >> "$MANIFEST"
    prepare_manual_dir "$dest" "$skill_name"
    packaged_count=$((packaged_count + 1))
    if [[ "$artifact" == "$skill_dir"/dist/* ]]; then
      rm -f "$artifact"
    fi
    if [[ "$artifact" == "$skill_build_dir"/* ]]; then
      rm -f "$artifact"
    fi
    if [[ "$artifact" == "$ROOT"/dist/* && "$DIST_DIR" != "$ROOT/dist" ]]; then
      rm -f "$artifact"
    fi
  done < "$candidates_file"

  if [[ -d "$skill_dir/dist" ]]; then
    find "$skill_dir/dist" -mindepth 1 -type d -empty -delete
  fi
  if [[ -d "$skill_build_dir" ]]; then
    find "$skill_build_dir" -mindepth 1 -type d -empty -delete
  fi
  if [[ -d "$skill_dir/.dist-build" ]]; then
    find "$skill_dir/.dist-build" -mindepth 1 -type d -empty -delete
    if [[ -z "$(find "$skill_dir/.dist-build" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
      rmdir "$skill_dir/.dist-build" 2>/dev/null || true
    fi
  fi
done < <(resolve_targets)

if [[ "$skill_count" -eq 0 ]]; then
  echo "No submodule skills found to package." >&2
  exit 1
fi

if [[ "$packaged_count" -eq 0 ]]; then
  echo "No artifacts packaged." >&2
  exit 1
fi

echo
echo "Packaged $packaged_count artifact(s) from $skill_count skill(s)."
echo "Prepared $manual_dir_count expanded skill directory(s)."
echo "Output: $DIST_DIR"
echo "Manifest: $MANIFEST"
