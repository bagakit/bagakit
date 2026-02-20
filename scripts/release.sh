#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

ROOT="$(repo_root)"
VERSION="${1:-}"

if [[ -z "$VERSION" ]]; then
  echo "Usage: scripts/release.sh <version-tag>" >&2
  exit 1
fi

cd "$ROOT"

if git rev-parse "$VERSION" >/dev/null 2>&1; then
  echo "Tag already exists: $VERSION" >&2
  exit 1
fi

"$ROOT/scripts/validate.sh"

# Ensure catalog reflects current submodule pointers before tagging.
"$ROOT/scripts/render_catalog.sh"

git add .gitmodules catalog/skills.json
while IFS= read -r path; do
  git add "$path"
done < <(submodule_paths)

if git diff --cached --quiet; then
  echo "No release changes to commit."
else
  git commit -m "chore(release): $VERSION"
fi

git tag -a "$VERSION" -m "skills release $VERSION"

echo "Release prepared: $VERSION"
echo "Next: git push origin main --follow-tags"
