#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_root="$(cd "${script_dir}/.." && pwd)"

export BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR="${BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR:-$skill_root}"
export PYTHONDONTWRITEBYTECODE=1

exec "${PYTHON3:-python3}" "$script_dir/bagakit-living-knowledge.py" "$@"
