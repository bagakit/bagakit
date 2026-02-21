#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/common.sh"

ROOT="$(repo_root)"
PROJECT=""
REPO_URL=""
SKILL_ID=""
SKILL_PATH=""
SUBMODULE_PATH=""
BRANCH="main"
LAYER="micro-pack"
GROUP=""
TIER="domain-pack"
REGISTER_ONLY=0

usage() {
  cat <<'USAGE'
Usage: scripts/add-project-skill-submodule.sh \
  --project <project-id> \
  --repo <git-url> \
  --skill-id <skill-id> \
  --skill-path <path-in-project-repo> \
  [--submodule-path <path>] [--branch <branch>] \
  [--layer <macro-process|macro-tool|micro-pack>] [--group <group>] [--tier <tier>] \
  [--register-only]

Examples:
  scripts/add-project-skill-submodule.sh \
    --project bagakit-paperwork \
    --repo git@github.com:bagakit/bagakit-paperwork.git \
    --skill-id bagakit-paperwork-technical-writing \
    --skill-path bagakit-paperwork-technical-writing

  scripts/add-project-skill-submodule.sh \
    --project bagakit-paperwork \
    --repo git@github.com:bagakit/bagakit-paperwork.git \
    --skill-id bagakit-paperwork-technical-writing \
    --skill-path bagakit-paperwork-technical-writing \
    --submodule-path projects/bagakit-paperwork \
    --register-only
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT="${2:-}"
      shift 2
      ;;
    --repo)
      REPO_URL="${2:-}"
      shift 2
      ;;
    --skill-id)
      SKILL_ID="${2:-}"
      shift 2
      ;;
    --skill-path)
      SKILL_PATH="${2:-}"
      shift 2
      ;;
    --submodule-path)
      SUBMODULE_PATH="${2:-}"
      shift 2
      ;;
    --branch)
      BRANCH="${2:-}"
      shift 2
      ;;
    --layer)
      LAYER="${2:-}"
      shift 2
      ;;
    --group)
      GROUP="${2:-}"
      shift 2
      ;;
    --tier)
      TIER="${2:-}"
      shift 2
      ;;
    --register-only)
      REGISTER_ONLY=1
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

if [[ -z "$PROJECT" || -z "$SKILL_ID" || -z "$SKILL_PATH" ]]; then
  echo "Missing required args: --project --skill-id --skill-path" >&2
  usage >&2
  exit 1
fi

if [[ -z "$SUBMODULE_PATH" ]]; then
  SUBMODULE_PATH="projects/$PROJECT"
fi

if [[ -z "$GROUP" ]]; then
  GROUP="project-$PROJECT"
fi

if [[ "$REGISTER_ONLY" -eq 0 && -z "$REPO_URL" ]]; then
  echo "Missing required arg: --repo (unless --register-only)" >&2
  usage >&2
  exit 1
fi

if [[ "$LAYER" != "macro-process" && "$LAYER" != "macro-tool" && "$LAYER" != "micro-pack" ]]; then
  echo "Invalid --layer: $LAYER" >&2
  exit 1
fi

cd "$ROOT"

submodule_exists=0
if git config -f .gitmodules --get-regexp '^submodule\..*\.path$' 2>/dev/null | awk '{print $2}' | grep -qx "$SUBMODULE_PATH"; then
  submodule_exists=1
fi

if [[ "$REGISTER_ONLY" -eq 0 ]]; then
  if [[ "$submodule_exists" -eq 0 ]]; then
    mkdir -p "$(dirname "$SUBMODULE_PATH")"
    git submodule add -b "$BRANCH" "$REPO_URL" "$SUBMODULE_PATH"
  else
    git submodule sync -- "$SUBMODULE_PATH"
    git submodule update --init --recursive "$SUBMODULE_PATH"
  fi
fi

skill_root="$ROOT/$SUBMODULE_PATH/$SKILL_PATH"
if [[ ! -d "$skill_root" ]]; then
  echo "Skill path not found: $SUBMODULE_PATH/$SKILL_PATH" >&2
  exit 1
fi

for required in SKILL.md SKILL_PAYLOAD.json Makefile; do
  if [[ ! -f "$skill_root/$required" ]]; then
    echo "Missing required file in project skill root: $SUBMODULE_PATH/$SKILL_PATH/$required" >&2
    exit 1
  fi
done

python3 - "$ROOT/catalog/project-skills.json" "$SKILL_ID" "$PROJECT" "$SUBMODULE_PATH" "$SKILL_PATH" "$LAYER" "$GROUP" "$TIER" <<'PY'
import json
import sys
from pathlib import Path

(
    catalog_path,
    skill_id,
    project,
    submodule_path,
    skill_path,
    layer,
    group,
    tier,
) = sys.argv[1:]

path = Path(catalog_path)
if path.exists():
    data = json.loads(path.read_text(encoding="utf-8"))
else:
    data = {"schema_version": "1.0.0", "project_skills": []}

if not isinstance(data.get("project_skills"), list):
    raise SystemExit("catalog/project-skills.json: project_skills must be a list")

entry = {
    "id": skill_id,
    "project": project,
    "submodule_path": submodule_path,
    "skill_path": skill_path,
    "layer": layer,
    "group": group,
    "tier": tier,
}

entries = data["project_skills"]
for i, existing in enumerate(entries):
    if isinstance(existing, dict) and existing.get("id") == skill_id:
        entries[i] = entry
        break
else:
    entries.append(entry)

entries.sort(key=lambda item: item.get("id", ""))
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(data, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
PY

echo "Registered project skill: $SKILL_ID"
echo "- submodule: $SUBMODULE_PATH"
echo "- skill root: $SUBMODULE_PATH/$SKILL_PATH"
echo "- layer/group/tier: $LAYER / $GROUP / $TIER"
echo ""
echo "Next steps:"
echo "1) ./scripts/package-all-skills.sh --skill $SKILL_ID"
echo "2) ./scripts/validate.sh --skip-tests"
