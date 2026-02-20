#!/usr/bin/env bash
set -euo pipefail

ORG="${BAGAKIT_ORG:-bagakit}"
REF="${BAGAKIT_REF:-main}"
DEST=""
LIST_ONLY=0
INSTALL_ALL=0
FORCE=0

CORE_SKILLS=(
  "bagakit-living-docs"
  "bagakit-feat-task-harness"
  "bagakit-long-run"
)

REQUESTED_SKILLS=()
SELECTED_SKILLS=()
TMP_ROOT=""

log() {
  printf '[bagakit-installer] %s\n' "$*" >&2
}

die() {
  printf '[bagakit-installer] ERROR: %s\n' "$*" >&2
  exit 1
}

cleanup_tmp_root() {
  if [ -n "${TMP_ROOT:-}" ] && [ -d "${TMP_ROOT:-}" ]; then
    rm -rf "${TMP_ROOT}"
  fi
}

usage() {
  cat <<'EOF'
Install bagakit skills into a target directory.

Usage:
  install-bagakit-skills.sh --dest <dir> [options]
  install-bagakit-skills.sh --list [options]

Options:
  --dest <dir>      Destination directory for installed skills.
  --org <name>      GitHub org/user to query. Default: bagakit.
  --ref <ref>       Git ref to install. Default: main.
  --skill <repo>    Install one skill repo (repeatable, supports comma list).
  --all             Install all discovered skill repos (with SKILL.md).
  --list            List discovered skill repos and exit.
  --force           Overwrite destination if a skill folder already exists.
  -h, --help        Show this help message.

Behavior:
  - With no --skill/--all, installs core trio:
      bagakit-living-docs, bagakit-feat-task-harness, bagakit-long-run
  - Discovery checks repositories that contain SKILL.md at repo root.
  - If a repo provides SKILL_PAYLOAD.json at repo root, installs exactly those declared paths.
  - Otherwise, falls back to a safe default payload (SKILL.md + scripts/references/agents/assets + optional README.md).
  - Never installs repo development/dogfooding files (docs/, Makefile, dist/, .codex/, etc.) unless explicitly declared.

Examples:
  install-bagakit-skills.sh --list
  install-bagakit-skills.sh --dest ~/.codex/skills
  install-bagakit-skills.sh --dest ~/.codex/skills --all
  install-bagakit-skills.sh --dest ~/.codex/skills --skill bagakit-long-run
EOF
}

need_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || die "Missing required command: ${cmd}"
}

is_in_list() {
  local needle="$1"
  shift
  local item
  for item in "$@"; do
    if [ "$item" = "$needle" ]; then
      return 0
    fi
  done
  return 1
}

add_unique_selected() {
  local repo="$1"
  if [ -z "$repo" ]; then
    return
  fi
  if ! is_in_list "$repo" "${SELECTED_SKILLS[@]-}"; then
    SELECTED_SKILLS+=("$repo")
  fi
}

add_requested_skill_arg() {
  local raw="$1"
  local old_ifs="$IFS"
  local part=""
  IFS=','
  for part in $raw; do
    part="$(printf '%s' "$part" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    if [ -n "$part" ] && ! is_in_list "$part" "${REQUESTED_SKILLS[@]-}"; then
      REQUESTED_SKILLS+=("$part")
    fi
  done
  IFS="$old_ifs"
}

api_get() {
  local url="$1"
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    curl -fsSL -H "Accept: application/vnd.github+json" -H "Authorization: Bearer ${GITHUB_TOKEN}" "$url"
  elif [ -n "${GH_TOKEN:-}" ]; then
    curl -fsSL -H "Accept: application/vnd.github+json" -H "Authorization: Bearer ${GH_TOKEN}" "$url"
  else
    curl -fsSL -H "Accept: application/vnd.github+json" "$url"
  fi
}

fetch_org_repos_tsv() {
  local page=1
  local url=""
  local body=""
  local count=0
  while :; do
    url="https://api.github.com/orgs/${ORG}/repos?type=all&per_page=100&page=${page}&sort=full_name"
    body="$(api_get "$url")" || return 1
    count="$(printf '%s' "$body" | python3 -c 'import json,sys; data=json.load(sys.stdin); print(len(data) if isinstance(data, list) else 0)')"
    if [ "$count" -eq 0 ]; then
      break
    fi
    printf '%s' "$body" | python3 -c 'import json,sys
for repo in json.load(sys.stdin):
    name = (repo.get("name") or "").strip()
    if not name:
        continue
    desc = (repo.get("description") or "").replace("\t", " ").replace("\n", " ").strip()
    print(f"{name}\t{desc}")'
    if [ "$count" -lt 100 ]; then
      break
    fi
    page=$((page + 1))
  done
}

repo_has_skill() {
  local repo="$1"
  local url="https://raw.githubusercontent.com/${ORG}/${repo}/${REF}/SKILL.md"
  curl -fsSL -o /dev/null "$url" >/dev/null 2>&1
}

discover_skill_repos_tsv() {
  local all_repos_tsv="$1"
  local repo=""
  local desc=""
  while IFS=$'\t' read -r repo desc; do
    if [ -z "$repo" ]; then
      continue
    fi
    if repo_has_skill "$repo"; then
      printf '%s\t%s\n' "$repo" "$desc"
    fi
  done <<<"$all_repos_tsv"
}

print_discovered() {
  local discovered_tsv="$1"
  local idx=1
  local repo=""
  local desc=""

  if [ -z "$discovered_tsv" ]; then
    printf 'No skill repositories discovered in org "%s" at ref "%s".\n' "$ORG" "$REF"
    return
  fi

  printf 'Discovered skill repositories from "%s" (ref: %s):\n' "$ORG" "$REF"
  while IFS=$'\t' read -r repo desc; do
    if [ -z "$repo" ]; then
      continue
    fi
    if [ -n "$desc" ]; then
      printf '%2d. %s - %s\n' "$idx" "$repo" "$desc"
    else
      printf '%2d. %s\n' "$idx" "$repo"
    fi
    idx=$((idx + 1))
  done <<<"$discovered_tsv"
}

tsv_has_repo() {
  local needle="$1"
  local tsv="$2"
  local repo=""
  while IFS=$'\t' read -r repo _; do
    if [ "$repo" = "$needle" ]; then
      return 0
    fi
  done <<<"$tsv"
  return 1
}

append_core_skills_tsv() {
  local tsv="$1"
  local repo=""
  printf '%s' "$tsv"
  for repo in "${CORE_SKILLS[@]-}"; do
    if ! tsv_has_repo "$repo" "$tsv"; then
      if [ -n "$tsv" ]; then
        printf '\n'
      fi
      printf '%s\t%s' "$repo" "core bagakit skill"
      tsv="${tsv}"$'\n'"${repo}"$'\t'"core bagakit skill"
    fi
  done
}

clone_repo() {
  local repo="$1"
  local clone_dir="$2"
  local token="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
  local auth_https_url="https://x-access-token:${token}@github.com/${ORG}/${repo}.git"
  local plain_https_url="https://github.com/${ORG}/${repo}.git"
  local ssh_url="git@github.com:${ORG}/${repo}.git"

  if [ -n "$token" ]; then
    if git clone --quiet --depth 1 --branch "$REF" "$auth_https_url" "$clone_dir" >/dev/null 2>&1; then
      return 0
    fi
  fi

  if git clone --quiet --depth 1 --branch "$REF" "$plain_https_url" "$clone_dir" >/dev/null 2>&1; then
    return 0
  fi

  if git clone --quiet --depth 1 --branch "$REF" "$ssh_url" "$clone_dir" >/dev/null 2>&1; then
    return 0
  fi

  return 1
}

resolve_abs_path() {
  local raw="$1"
  python3 - "$raw" <<'PY'
import os
import sys
print(os.path.abspath(os.path.expanduser(sys.argv[1])))
PY
}

install_one_skill() {
  local repo="$1"
  local dest_dir="$2"
  local tmp_root="$3"
  local clone_dir="${tmp_root}/${repo}"
  local install_dir="${dest_dir}/${repo}"

  if [ -e "$install_dir" ]; then
    if [ "$FORCE" -eq 1 ]; then
      rm -rf "$install_dir"
    else
      log "Skip ${repo}: ${install_dir} already exists (use --force to overwrite)."
      return
    fi
  fi

  if ! clone_repo "$repo" "$clone_dir"; then
    die "Failed to clone ${ORG}/${repo} at ref ${REF} (tried token HTTPS, HTTPS, and SSH)."
  fi

  if [ ! -f "${clone_dir}/SKILL.md" ]; then
    die "Repository ${repo} does not contain SKILL.md at root."
  fi

  mkdir -p "$install_dir"
  local include_paths=()

  # Prefer explicit per-repo payload declaration when available.
  # This keeps installs minimal and prevents leaking repo dogfooding docs/Makefile/etc into skill dirs.
  if [ -f "${clone_dir}/SKILL_PAYLOAD.json" ]; then
    local payload_list=""
    payload_list="$(python3 - "${clone_dir}/SKILL_PAYLOAD.json" <<'PY'
import json
import os
import sys

path = sys.argv[1]
data = json.load(open(path, "r", encoding="utf-8"))
if int(data.get("version", 0)) != 1:
    raise SystemExit("SKILL_PAYLOAD.json version must be 1")
include = data.get("include")
if not isinstance(include, list) or not include:
    raise SystemExit("SKILL_PAYLOAD.json include must be a non-empty array")

out = []
for item in include:
    if not isinstance(item, str) or not item.strip():
        raise SystemExit("SKILL_PAYLOAD.json include entries must be non-empty strings")
    raw = item.strip()
    if os.path.isabs(raw):
        raise SystemExit(f"SKILL_PAYLOAD.json include path must be relative: {raw}")
    norm = os.path.normpath(raw)
    if norm in (".", "..") or norm.startswith(".." + os.sep):
        raise SystemExit(f"SKILL_PAYLOAD.json include path traversal is not allowed: {raw}")
    out.append(norm)

if "SKILL.md" not in out:
    raise SystemExit("SKILL_PAYLOAD.json include must contain SKILL.md")

seen = set()
for x in out:
    if x in seen:
        continue
    seen.add(x)
    print(x)
PY
)" || die "Invalid SKILL_PAYLOAD.json in ${repo}"

    while IFS= read -r line; do
      if [ -n "${line:-}" ]; then
        include_paths+=("$line")
      fi
    done <<<"$payload_list"
  else
    # Fallback: safe default payload (avoid copying repo dogfooding docs, Makefile, dist, .codex, etc).
    # Common skill structure: SKILL.md + scripts/ + references/ (+ optional agents/, assets/, README.md).
    include_paths+=("SKILL.md")
    if [ -f "${clone_dir}/README.md" ]; then
      include_paths+=("README.md")
    fi
    if [ -d "${clone_dir}/scripts" ]; then
      include_paths+=("scripts")
    fi
    if [ -d "${clone_dir}/references" ]; then
      include_paths+=("references")
    fi
    if [ -d "${clone_dir}/agents" ]; then
      include_paths+=("agents")
    fi
    if [ -d "${clone_dir}/assets" ]; then
      include_paths+=("assets")
    fi
  fi

  if [ "${#include_paths[@]}" -eq 0 ]; then
    die "No install payload paths resolved for ${repo}"
  fi

  local p=""
  for p in "${include_paths[@]}"; do
    if [ ! -e "${clone_dir}/${p}" ]; then
      die "Install payload path missing in ${repo}: ${p}"
    fi
  done

  (
    cd "$clone_dir"
    LC_ALL=C tar cf - --exclude='.git' "${include_paths[@]}"
  ) | (
    cd "$install_dir"
    LC_ALL=C tar xf -
  )

  log "Installed ${repo} -> ${install_dir}"
}

main() {
  need_cmd curl
  need_cmd git
  need_cmd python3
  need_cmd tar

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --dest)
        [ "$#" -ge 2 ] || die "Missing value for --dest"
        DEST="$2"
        shift 2
        ;;
      --org)
        [ "$#" -ge 2 ] || die "Missing value for --org"
        ORG="$2"
        shift 2
        ;;
      --ref)
        [ "$#" -ge 2 ] || die "Missing value for --ref"
        REF="$2"
        shift 2
        ;;
      --skill)
        [ "$#" -ge 2 ] || die "Missing value for --skill"
        add_requested_skill_arg "$2"
        shift 2
        ;;
      --all)
        INSTALL_ALL=1
        shift
        ;;
      --list)
        LIST_ONLY=1
        shift
        ;;
      --force)
        FORCE=1
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "Unknown argument: $1"
        ;;
    esac
  done

  if [ "$INSTALL_ALL" -eq 1 ] && [ "${#REQUESTED_SKILLS[@]}" -gt 0 ]; then
    die "Use either --all or --skill, not both."
  fi

  local all_repos_tsv=""
  local discovered_tsv=""
  if [ "$LIST_ONLY" -eq 1 ] || [ "$INSTALL_ALL" -eq 1 ]; then
    if all_repos_tsv="$(fetch_org_repos_tsv)"; then
      discovered_tsv="$(discover_skill_repos_tsv "$all_repos_tsv")"
    elif [ "$ORG" = "bagakit" ]; then
      log "Failed to query org repos from GitHub API; fallback to core bagakit skill catalog."
      discovered_tsv=""
    else
      die "Failed to query GitHub org repositories for ${ORG}."
    fi
    if [ "$ORG" = "bagakit" ]; then
      discovered_tsv="$(append_core_skills_tsv "$discovered_tsv")"
    fi
  fi

  if [ "$LIST_ONLY" -eq 1 ]; then
    print_discovered "$discovered_tsv"
    exit 0
  fi

  if [ -z "$DEST" ]; then
    die "--dest is required unless --list is used."
  fi

  DEST="$(resolve_abs_path "$DEST")"
  mkdir -p "$DEST"

  if [ "$INSTALL_ALL" -eq 1 ]; then
    while IFS=$'\t' read -r repo _; do
      [ -n "$repo" ] && add_unique_selected "$repo"
    done <<<"$discovered_tsv"
  elif [ "${#REQUESTED_SKILLS[@]}" -gt 0 ]; then
    local repo=""
    for repo in "${REQUESTED_SKILLS[@]-}"; do
      add_unique_selected "$repo"
    done
  else
    local repo=""
    for repo in "${CORE_SKILLS[@]-}"; do
      add_unique_selected "$repo"
    done
  fi

  if [ "${#SELECTED_SKILLS[@]}" -eq 0 ]; then
    die "No skills selected for installation."
  fi

  TMP_ROOT="$(mktemp -d)"

  log "Installing ${#SELECTED_SKILLS[@]} skill(s) to ${DEST}"
  for repo in "${SELECTED_SKILLS[@]-}"; do
    install_one_skill "$repo" "$DEST" "$TMP_ROOT"
  done
  log "Done."
}

trap cleanup_tmp_root EXIT
main "$@"
