#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

ROOT="$(repo_root)"
RUN_TESTS=1

usage() {
  cat <<'USAGE'
Usage: scripts/validate.sh [--skip-tests]

Options:
  --skip-tests   Skip running each submodule's scripts_dev/test.sh.
  --help         Show this help message.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
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
"$ROOT/scripts/render_catalog.sh"

python3 - <<'PY'
import json
import subprocess
import sys
from pathlib import Path

root = Path.cwd()
catalog = json.loads((root / "catalog" / "skills.json").read_text(encoding="utf-8"))
profiles_file = root / "catalog" / "delivery-profiles.json"
errors: list[str] = []
warnings: list[str] = []

if not profiles_file.is_file():
    errors.append(f"Missing delivery profiles file: {profiles_file.relative_to(root)}")
    profiles_payload = {}
else:
    profiles_payload = json.loads(profiles_file.read_text(encoding="utf-8"))

profiles = profiles_payload.get("profiles", [])
if not isinstance(profiles, list):
    errors.append("catalog/delivery-profiles.json: 'profiles' must be a list")
    profiles = []

profile_map: dict[str, dict] = {}
for item in profiles:
    if not isinstance(item, dict):
        errors.append("catalog/delivery-profiles.json: each profile must be an object")
        continue
    skill_id = item.get("id")
    if not isinstance(skill_id, str) or not skill_id.strip():
        errors.append("catalog/delivery-profiles.json: profile is missing non-empty 'id'")
        continue
    if skill_id in profile_map:
        errors.append(f"catalog/delivery-profiles.json: duplicated profile id: {skill_id}")
        continue
    profile_map[skill_id] = item

def non_empty_string(profile: dict, key: str, label: str, skill_id: str) -> None:
    value = profile.get(key)
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{skill_id}: delivery profile missing {label}")

def non_empty_list_of_strings(profile: dict, key: str, label: str, skill_id: str, min_len: int = 1) -> None:
    value = profile.get(key)
    if not isinstance(value, list) or len(value) < min_len or not all(isinstance(v, str) and v.strip() for v in value):
        errors.append(f"{skill_id}: delivery profile missing {label}")

for item in catalog.get("skills", []):
    path = root / item["path"]
    if not path.exists():
        errors.append(f"Missing submodule path: {item['path']}")
        continue

    commit = subprocess.check_output(
        ["git", "-C", str(path), "rev-parse", "HEAD"], text=True
    ).strip()
    if item.get("commit") != commit:
        errors.append(
            f"Catalog commit mismatch for {item['id']}: {item.get('commit')} != {commit}"
        )

    for rel, present in item.get("required_files", {}).items():
        actual = (path / rel).is_file()
        if present != actual:
            errors.append(f"Catalog required_files mismatch for {item['id']}::{rel}")
        if not actual:
            errors.append(f"Missing required file for {item['id']}: {rel}")

    profile = profile_map.get(item["id"])
    if profile is None:
        errors.append(f"Missing delivery profile for {item['id']}")
        continue

    non_empty_string(profile, "archetype", "archetype", item["id"])
    non_empty_string(profile, "default_mode", "default_mode", item["id"])
    non_empty_list_of_strings(profile, "system_routes", "system_routes (>=1)", item["id"], min_len=1)
    non_empty_list_of_strings(profile, "archive_gate", "archive_gate (>=2)", item["id"], min_len=2)

    classes = profile.get("deliverable_classes")
    if not isinstance(classes, dict):
        errors.append(f"{item['id']}: delivery profile missing deliverable_classes")
    else:
        for field in ("action_handoff", "memory_handoff", "archive"):
            value = classes.get(field)
            if not isinstance(value, str) or not value.strip():
                errors.append(f"{item['id']}: deliverable_classes.{field} is required")

catalog_ids = {item["id"] for item in catalog.get("skills", []) if isinstance(item, dict) and "id" in item}
for profile_id in profile_map:
    if profile_id not in catalog_ids:
        warnings.append(f"Delivery profile has unknown skill id: {profile_id}")

if errors:
    print("Catalog validation failed:")
    for err in errors:
        print(f"- {err}")
    sys.exit(1)

print(f"Catalog validation passed for {len(catalog.get('skills', []))} skills")
for warning in warnings:
    print(f"warn: {warning}")
PY

while IFS= read -r path; do
  echo "Validating $path"

  if compgen -G "$ROOT/$path/scripts/*.py" > /dev/null; then
    python3 -m py_compile "$ROOT/$path"/scripts/*.py
  fi

  if [[ "$RUN_TESTS" -eq 1 ]]; then
    if [[ -x "$ROOT/$path/scripts_dev/test.sh" ]]; then
      (cd "$ROOT/$path" && ./scripts_dev/test.sh)
    else
      echo "Missing executable test script: $path/scripts_dev/test.sh" >&2
      exit 1
    fi
  fi
done < <(submodule_paths)

echo "Validation complete."
