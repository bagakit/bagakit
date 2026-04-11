if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_root="$(dirname "$script_dir")"

join_path() {
  local path_value="${1%/}"
  shift
  local part
  for part in "$@"; do
    part="${part#/}"
    path_value="$(printf '%s/%s' "${path_value%/}" "$part")"
  done
  printf '%s\n' "$path_value"
}

codex_home="${CODEX_HOME:-$(join_path "$HOME" ".codex")}"

usage() {
  cat <<'EOF'
usage: bagakit-daily-media-automation-cli <command>

Commands:
  describe          Print a short skill description.
  list-references   List reference files shipped by this skill.
  doctor            Check local commands and optional adapters for a daily media automation run.
EOF
}

status_line() {
  local label="$1"
  local status="$2"
  local detail="$3"
  printf '%-20s %-9s %s\n' "$label" "$status" "$detail"
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

command_status() {
  local label="$1"
  local command_name="$2"
  local required="$3"
  if command_exists "$command_name"; then
    status_line "$label" "ok" "$(command -v "$command_name")"
    return 0
  fi
  if [[ "$required" == "required" ]]; then
    status_line "$label" "missing" "required for selected route"
    return 1
  fi
  status_line "$label" "missing" "optional adapter"
  return 0
}

path_status() {
  local label="$1"
  local path_value="$2"
  local required="$3"
  if [[ -e "$path_value" ]]; then
    status_line "$label" "ok" "$path_value"
    return 0
  fi
  if [[ "$required" == "required" ]]; then
    status_line "$label" "missing" "$path_value"
    return 1
  fi
  status_line "$label" "missing" "$path_value (optional)"
  return 0
}

skill_path_exists() {
  local skill_id="$1"
  shift
  local found=1
  local candidate
  for candidate in "$@"; do
    if [[ -f "$candidate" ]]; then
      status_line "$skill_id skill" "ok" "$candidate"
      found=0
    else
      status_line "$skill_id skill" "missing" "$candidate (optional)"
    fi
  done
  return "$found"
}

agent_reach_capability_exists() {
  [[ -f "$(join_path "$HOME" ".agents" "skills" "agent-reach" "SKILL.md")" ]] \
    || [[ -f ".codex/skills/agent-reach/SKILL.md" ]] \
    || command_exists agent-reach \
    || command_exists mcporter \
    || command_exists xreach \
    || command_exists yt-dlp \
    || command_exists gh
}

webpage_design_capability_exists() {
  [[ -f "skills/swe/bagakit-codex-webpage-design/SKILL.md" ]] \
    || [[ -f ".codex/skills/bagakit-codex-webpage-design/SKILL.md" ]] \
    || [[ -f "$(join_path "$codex_home" "skills" "bagakit-codex-webpage-design" "SKILL.md")" ]] \
    || command_exists bagakit-codex-webpage-design
}

write_root_status() {
  local write_root="$1"
  if [[ -d "$write_root" && -w "$write_root" ]]; then
    status_line "write-root" "ok" "$write_root"
    return 0
  fi
  status_line "write-root" "missing" "$write_root must exist and be writable"
  return 1
}

env_status() {
  local label="$1"
  local env_name="$2"
  if [[ -n "${!env_name:-}" ]]; then
    status_line "$label" "ok" "\$$env_name is set"
  else
    status_line "$label" "unset" "\$$env_name is not set"
  fi
}

required_env_status() {
  local label="$1"
  local env_name="$2"
  if [[ -n "${!env_name:-}" ]]; then
    status_line "$label" "ok" "\$$env_name is set"
    return 0
  fi
  status_line "$label" "unset" "\$$env_name is required for selected route"
  return 1
}

run_doctor() {
  local failures=0
  local source_adapter="none"
  local image_adapter="none"
  local web_adapter="none"
  local deploy_adapter="none"
  local notify_adapter="none"
  local scheduler_adapter="manual"
  local write_root="."

  require_value() {
    local option="$1"
    local value="${2:-}"
    if [[ -z "$value" || "$value" == --* ]]; then
      printf 'missing value for %s\n' "$option" >&2
      return 1
    fi
    printf '%s\n' "$value"
  }

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --source)
        source_adapter="$(require_value "$1" "${2:-}")" || return 2
        shift 2
        ;;
      --image)
        image_adapter="$(require_value "$1" "${2:-}")" || return 2
        shift 2
        ;;
      --web)
        web_adapter="$(require_value "$1" "${2:-}")" || return 2
        shift 2
        ;;
      --deploy)
        deploy_adapter="$(require_value "$1" "${2:-}")" || return 2
        shift 2
        ;;
      --notify)
        notify_adapter="$(require_value "$1" "${2:-}")" || return 2
        shift 2
        ;;
      --scheduler)
        scheduler_adapter="$(require_value "$1" "${2:-}")" || return 2
        shift 2
        ;;
      --write-root)
        write_root="$(require_value "$1" "${2:-}")" || return 2
        shift 2
        ;;
      --require-vercel)
        deploy_adapter="vercel"
        shift
        ;;
      --require-agent-reach)
        source_adapter="agent-reach"
        shift
        ;;
      -h|--help)
        cat <<'EOF'
usage: bagakit-daily-media-automation-cli doctor [options]

Options:
  --source <agent-reach|rss|web|direct|existing-research|none>
  --image <imagegen|none>
  --web <bagakit-codex-webpage-design|static|none>
  --deploy <vercel|static|github-pages|internal|none>
  --notify <telegram|ntfy|pushover|slack|discord|email|none>
  --scheduler <codex-automation|codex-exec|github-actions|vercel-cron|system-cron|manual>
  --write-root <path>
  --require-vercel        Alias for --deploy vercel.
  --require-agent-reach   Alias for --source agent-reach.

Checks selected route dependencies without contacting live services or printing
secret values. Missing unselected adapters are reported as optional only.
EOF
        return 0
        ;;
      *)
        printf 'unknown doctor argument: %s\n' "$1" >&2
        return 2
        ;;
    esac
  done

  printf '%s\n' "Daily media automation preflight"
  printf '%s\n' "--------------------------------"

  write_root_status "$write_root" || failures=1

  case "$scheduler_adapter" in
    codex-automation)
      command_status "codex" "codex" "optional" || true
      status_line "scheduler" "manual" "Codex Automation availability is host-configured; verify outside this CLI."
      ;;
    codex-exec)
      command_status "codex" "codex" "required" || failures=1
      ;;
    github-actions)
      path_status "workflow-dir" ".github/workflows" "required" || failures=1
      ;;
    vercel-cron)
      command_status "vercel" "vercel" "required" || failures=1
      path_status "vercel config" "vercel.json" "optional" || true
      ;;
    system-cron|manual)
      status_line "scheduler" "ok" "$scheduler_adapter"
      ;;
    "")
      status_line "scheduler" "missing" "scheduler adapter value is empty"
      failures=1
      ;;
    *)
      status_line "scheduler" "unknown" "$scheduler_adapter"
      failures=1
      ;;
  esac

  case "$source_adapter" in
    agent-reach)
      skill_path_exists "agent-reach" \
        "$(join_path "$HOME" ".agents" "skills" "agent-reach" "SKILL.md")" \
        ".codex/skills/agent-reach/SKILL.md" || true
      command_status "agent-reach cli" "agent-reach" "optional" || true
      command_status "mcporter" "mcporter" "optional" || true
      command_status "xreach" "xreach" "optional" || true
      command_status "yt-dlp" "yt-dlp" "optional" || true
      command_status "gh" "gh" "optional" || true
      if ! agent_reach_capability_exists; then
        status_line "agent-reach route" "missing" "selected route needs Agent Reach skill or at least one supported channel command"
        failures=1
      fi
      ;;
    rss|web|direct|existing-research|none)
      status_line "source" "ok" "$source_adapter"
      ;;
    "")
      status_line "source" "missing" "source adapter value is empty"
      failures=1
      ;;
    *)
      status_line "source" "unknown" "$source_adapter"
      failures=1
      ;;
  esac

  case "$image_adapter" in
    imagegen)
      path_status "imagegen skill" ".codex/skills/.system/imagegen/SKILL.md" "optional" || true
      path_status "global imagegen" "$(join_path "$codex_home" "skills" ".system" "imagegen" "SKILL.md")" "optional" || true
      ;;
    none)
      status_line "image" "ok" "none"
      ;;
    "")
      status_line "image" "missing" "image adapter value is empty"
      failures=1
      ;;
    *)
      status_line "image" "unknown" "$image_adapter"
      failures=1
      ;;
  esac

  case "$web_adapter" in
    bagakit-codex-webpage-design)
      skill_path_exists "webpage-design" \
        "skills/swe/bagakit-codex-webpage-design/SKILL.md" \
        ".codex/skills/bagakit-codex-webpage-design/SKILL.md" \
        "$(join_path "$codex_home" "skills" "bagakit-codex-webpage-design" "SKILL.md")" || true
      command_status "webpage cli" "bagakit-codex-webpage-design" "optional" || true
      command_status "node" "node" "optional" || true
      if ! webpage_design_capability_exists; then
        status_line "webpage route" "missing" "selected route needs canonical, repo-local, global, or CLI webpage-design capability"
        failures=1
      fi
      ;;
    static|none)
      status_line "web" "ok" "$web_adapter"
      ;;
    "")
      status_line "web" "missing" "web adapter value is empty"
      failures=1
      ;;
    *)
      status_line "web" "unknown" "$web_adapter"
      failures=1
      ;;
  esac

  case "$deploy_adapter" in
    vercel)
      command_status "vercel" "vercel" "required" || failures=1
      ;;
    static)
      write_root_status "$write_root" || failures=1
      ;;
    github-pages|internal)
      status_line "deploy" "manual" "$deploy_adapter requires host-specific checks"
      ;;
    none)
      status_line "deploy" "ok" "none"
      ;;
    "")
      status_line "deploy" "missing" "deploy adapter value is empty"
      failures=1
      ;;
    *)
      status_line "deploy" "unknown" "$deploy_adapter"
      failures=1
      ;;
  esac

  printf '\n%s\n' "Notification environment hints"
  printf '%s\n' "------------------------------"
  case "$notify_adapter" in
    telegram)
      required_env_status "Telegram token" "TELEGRAM_BOT_TOKEN" || failures=1
      required_env_status "Telegram chat" "TELEGRAM_CHAT_ID" || failures=1
      ;;
    ntfy)
      required_env_status "ntfy topic" "NTFY_TOPIC" || failures=1
      env_status "ntfy server" "NTFY_SERVER"
      ;;
    pushover)
      required_env_status "Pushover token" "PUSHOVER_TOKEN" || failures=1
      required_env_status "Pushover user" "PUSHOVER_USER" || failures=1
      ;;
    slack)
      required_env_status "Slack webhook" "SLACK_WEBHOOK_URL" || failures=1
      ;;
    discord)
      required_env_status "Discord webhook" "DISCORD_WEBHOOK_URL" || failures=1
      ;;
    email)
      env_status "email command" "MAILER_COMMAND"
      status_line "email" "manual" "verify host mail delivery outside this CLI"
      ;;
    none)
      status_line "notification" "ok" "none"
      ;;
    "")
      status_line "notification" "missing" "notify adapter value is empty"
      failures=1
      ;;
    *)
      status_line "notification" "unknown" "$notify_adapter"
      failures=1
      ;;
  esac
  env_status "Vercel token" "VERCEL_TOKEN"
  command_status "git" "git" "optional" || true
  command_status "curl" "curl" "optional" || true

  if [[ "$failures" -ne 0 ]]; then
    printf '\n%s\n' "doctor result: blocked route dependency is missing"
    return 1
  fi
  printf '\n%s\n' "doctor result: no required route dependency is missing"
}

case "${1:-}" in
  describe)
    printf '%s\n' "bagakit-daily-media-automation: recurring research-to-publication orchestration with source, asset, webpage, deploy, notify, archive, and no-publish gates."
    ;;
  list-references)
    find "$skill_root/references" -type f | sed "s#^$skill_root/##" | sort
    ;;
  doctor)
    shift
    run_doctor "$@"
    ;;
  ""|-h|--help|help)
    usage
    ;;
  *)
    printf 'unknown command: %s\n' "$1" >&2
    usage >&2
    exit 2
    ;;
esac
