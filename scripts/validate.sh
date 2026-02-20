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
errors: list[str] = []

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

if errors:
    print("Catalog validation failed:")
    for err in errors:
        print(f"- {err}")
    sys.exit(1)

print(f"Catalog validation passed for {len(catalog.get('skills', []))} skills")
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
