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
usage: bagakit-daily-media-production-cli <command>

Commands:
  describe          Print a short skill description.
  list-references   List reference files shipped by this skill.
  list-domain-packs List built-in starter domain packs.
  doctor            Check local commands and optional adapters for a daily media production run.
  init-run          Create a repo-local run ledger skeleton.
  validate-run      Validate run ledgers and no-publish gates.
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
  [[ -f "skills/design/bagakit-codex-webpage-design/SKILL.md" ]] \
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

validate_run_id() {
  local run_id="$1"
  [[ "$run_id" =~ ^[a-z0-9][a-z0-9-]*-[0-9]{8}-[a-z0-9][a-z0-9-]*$ ]]
}

infer_domain_pack_from_run_id() {
  local run_id="$1"
  if [[ "$run_id" =~ ^(.+)-[0-9]{8}-[a-z0-9][a-z0-9-]*$ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
  fi
}

is_builtin_domain_pack() {
  case "$1" in
    ai-news|release-radar|paper-digest)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

domain_pack_field() {
  local pack="$1"
  local field="$2"
  case "$pack:$field" in
    ai-news:source_pack)
      printf '%s\n' "official AI lab blogs; research feeds; GitHub releases; curated social and RSS sources"
      ;;
    ai-news:source_minimum)
      printf '%s\n' "5"
      ;;
    ai-news:recency_window)
      printf '%s\n' "last 36 hours unless brief overrides"
      ;;
    ai-news:credibility_rubric)
      printf '%s\n' "primary lab, maintainer, paper, release note, or two independent reputable sources"
      ;;
    ai-news:confidence_bar)
      printf '%s\n' "top claims carry source refs and uncertainty notes when sources disagree"
      ;;
    ai-news:fallback_behavior)
      printf '%s\n' "draft only when source minimum or primary-source backing is missing"
      ;;
    ai-news:editorial_rubric)
      printf '%s\n' "novelty; credibility; developer impact; risk; audience fit"
      ;;
    ai-news:asset_pack)
      printf '%s\n' "web hero; social card; optional carousel"
      ;;
    ai-news:output_pack)
      printf '%s\n' "web-brief"
      ;;
    release-radar:source_pack)
      printf '%s\n' "official changelogs; GitHub releases; package registries; vendor blogs"
      ;;
    release-radar:source_minimum)
      printf '%s\n' "3"
      ;;
    release-radar:recency_window)
      printf '%s\n' "last 14 days unless brief overrides"
      ;;
    release-radar:credibility_rubric)
      printf '%s\n' "official changelog, release notes, repository tags, or vendor announcement"
      ;;
    release-radar:confidence_bar)
      printf '%s\n' "each included release records version, date or channel, source ref, and impact"
      ;;
    release-radar:fallback_behavior)
      printf '%s\n' "draft only when official release evidence is unavailable"
      ;;
    release-radar:editorial_rubric)
      printf '%s\n' "version significance; migration impact; security; adoption relevance"
      ;;
    release-radar:asset_pack)
      printf '%s\n' "release summary card; comparison table image"
      ;;
    release-radar:output_pack)
      printf '%s\n' "web-brief"
      ;;
    paper-digest:source_pack)
      printf '%s\n' "arXiv or venue feeds; lab publication pages; code repositories; citation and context search"
      ;;
    paper-digest:source_minimum)
      printf '%s\n' "4"
      ;;
    paper-digest:recency_window)
      printf '%s\n' "last 14 days unless brief overrides"
      ;;
    paper-digest:credibility_rubric)
      printf '%s\n' "paper metadata, author or institution, venue or preprint source, and code or data links when available"
      ;;
    paper-digest:confidence_bar)
      printf '%s\n' "claims distinguish paper claims from independent verification and avoid unsupported SOTA claims"
      ;;
    paper-digest:fallback_behavior)
      printf '%s\n' "draft only when papers lack enough metadata or claim support"
      ;;
    paper-digest:editorial_rubric)
      printf '%s\n' "research novelty; method clarity; evidence strength; practical relevance; limitation clarity"
      ;;
    paper-digest:asset_pack)
      printf '%s\n' "paper digest cover; method diagram brief; optional carousel"
      ;;
    paper-digest:output_pack)
      printf '%s\n' "web-brief"
      ;;
    *)
      return 1
      ;;
  esac
}

run_list_domain_packs() {
  printf '%s\n' "Built-in domain packs"
  printf '%s\n' "---------------------"
  printf '%-16s %-15s %-36s %s\n' "pack" "source_minimum" "recency_window" "output_pack"
  local pack
  for pack in ai-news release-radar paper-digest; do
    printf '%-16s %-15s %-36s %s\n' \
      "$pack" \
      "$(domain_pack_field "$pack" source_minimum)" \
      "$(domain_pack_field "$pack" recency_window)" \
      "$(domain_pack_field "$pack" output_pack)"
  done
  printf '\n%s\n' "Use these as starter thresholds, then override in the run brief when the domain requires stricter rules."
  printf '%s\n' "See references/domain-packs.md for source, editorial, asset, fallback, and no-publish guidance."
}

write_file_once() {
  local path_value="$1"
  local content="$2"
  if [[ -e "$path_value" ]]; then
    printf 'refusing to overwrite existing file: %s\n' "$path_value" >&2
    return 1
  fi
  printf '%s\n' "$content" >"$path_value"
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s\n' "$value"
}

field_value() {
  local file="$1"
  local key="$2"
  awk -v key="$key" '
    BEGIN { prefix = "- " key ":" }
    index($0, prefix) == 1 {
      value = substr($0, length(prefix) + 1)
      sub("^[ \t]*", "", value)
      sub("[ \t\r]*$", "", value)
      print value
      exit
    }
  ' "$file"
}

first_field_value() {
  local file="$1"
  shift
  local key
  local value
  for key in "$@"; do
    value="$(field_value "$file" "$key")"
    if [[ -n "$value" ]]; then
      printf '%s\n' "$value"
      return 0
    fi
  done
  return 0
}

value_present() {
  local value
  local lower_value
  value="$(trim "$1")"
  lower_value="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"
  case "$lower_value" in
    ""|todo|tbd|pending|unset)
      return 1
      ;;
    *)
      return 0
      ;;
  esac
}

table_data_count() {
  local file="$1"
  local header_token="$2"
  awk -v header_token="$header_token" '
    substr($0, 1, 1) == "|" {
      compact = tolower($0)
      gsub("[ \t]", "", compact)
      if (compact ~ "^\\|[-:]+\\|") next
      if (index(compact, "|" header_token "|") == 1) next
      count += 1
    }
    END { print count + 0 }
  ' "$file"
}

is_allowed_gate_status() {
  case "$1" in
    pass|blocked|not_applicable|waived)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_publish_pass_gate_status() {
  case "$1" in
    pass|not_applicable|waived)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_allowed_publication_status() {
  case "$1" in
    drafted|published|published_with_notification_failure|blocked|failed)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_allowed_notification_status() {
  case "$1" in
    not_in_scope|pending|sent|failed|skipped_for_blocked_publish)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_allowed_deployment_status() {
  case "$1" in
    not_in_scope|drafted|published|blocked|failed)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

run_validate_run() {
  local run_id=""
  local root="."
  local run_dir=""
  local intent="publish"
  local display_run_dir=""
  local structural_failures=0
  local publish_blockers=0

  require_value() {
    local option="$1"
    local value="${2:-}"
    if [[ -z "$value" || "$value" == --* ]]; then
      printf 'missing value for %s\n' "$option" >&2
      return 1
    fi
    printf '%s\n' "$value"
  }

  structural_issue() {
    status_line "artifact issue" "invalid" "$1"
    structural_failures=1
  }

  publish_blocker() {
    status_line "publish gate" "blocked" "$1"
    publish_blockers=1
  }

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --run-id)
        run_id="$(require_value "$1" "${2:-}")" || return 2
        shift 2
        ;;
      --root)
        root="$(require_value "$1" "${2:-}")" || return 2
        shift 2
        ;;
      --run-dir)
        run_dir="$(require_value "$1" "${2:-}")" || return 2
        shift 2
        ;;
      --intent)
        intent="$(require_value "$1" "${2:-}")" || return 2
        shift 2
        ;;
      -h|--help)
        cat <<'EOF'
usage: bagakit-daily-media-production-cli validate-run --run-id <domain-YYYYMMDD-slug> [options]

Options:
  --root <path>          Repository or host root that owns the runtime surface.
  --run-dir <path>       Validate an explicit run directory instead of --run-id.
  --intent <publish|audit>

Validates required ledgers, allowed status values, no-publish gates, deployment
and notification status separation, and obvious path or secret leakage. With
--intent publish, exits 0 only when the run is publishable. With --intent audit,
structurally valid drafted or blocked runs may exit 0 while still reporting
publish blockers.
EOF
        return 0
        ;;
      *)
        printf 'unknown validate-run argument: %s\n' "$1" >&2
        return 2
        ;;
    esac
  done

  case "$intent" in
    publish|audit)
      ;;
    *)
      printf 'invalid validate-run intent: %s\n' "$intent" >&2
      return 2
      ;;
  esac

  if [[ -n "$run_id" && -n "$run_dir" ]]; then
    printf 'use either --run-id or --run-dir, not both\n' >&2
    return 2
  fi
  if [[ -z "$run_id" && -z "$run_dir" ]]; then
    printf 'missing required --run-id or --run-dir\n' >&2
    return 2
  fi
  if [[ -n "$run_id" ]] && ! validate_run_id "$run_id"; then
    printf 'invalid run id: %s\n' "$run_id" >&2
    return 2
  fi

  if [[ -n "$run_id" ]]; then
    run_dir="$(join_path "$root" ".bagakit" "daily-media-production" "runs" "$run_id")"
    display_run_dir=".bagakit/daily-media-production/runs/$run_id"
  else
    run_id="$(basename "$run_dir")"
    display_run_dir="explicit-run-dir:$run_id"
  fi

  printf '%s\n' "Daily media automation run validation"
  printf '%s\n' "-------------------------------------"

  if [[ ! -d "$run_dir" ]]; then
    status_line "run" "missing" "$display_run_dir"
    printf '\n%s\n' "run validation result: invalid run artifact"
    return 2
  fi
  status_line "run" "ok" "$display_run_dir"

  local brief="$run_dir/brief.md"
  local collection="$run_dir/collection-ledger.md"
  local evidence="$run_dir/evidence-review.md"
  local asset="$run_dir/asset-ledger.md"
  local deployment="$run_dir/deployment-ledger.md"
  local notification="$run_dir/notification-ledger.md"
  local archive="$run_dir/archive.md"
  local required_file

  for required_file in \
    "$brief" \
    "$collection" \
    "$evidence" \
    "$asset" \
    "$deployment" \
    "$notification" \
    "$archive"; do
    if [[ -f "$required_file" ]]; then
      status_line "$(basename "$required_file")" "ok" "present"
    else
      structural_issue "missing $(basename "$required_file")"
    fi
  done

  if [[ "$structural_failures" -ne 0 ]]; then
    printf '\n%s\n' "run validation result: invalid run artifact"
    return 2
  fi

  local brief_run_id
  local archive_run_id
  brief_run_id="$(field_value "$brief" "run_id")"
  archive_run_id="$(field_value "$archive" "run_id")"
  if [[ "$brief_run_id" != "$run_id" ]]; then
    structural_issue "brief run_id does not match selected run"
  fi
  if [[ "$archive_run_id" != "$run_id" ]]; then
    structural_issue "archive run_id does not match selected run"
  fi

  local requirement
  local requirement_value
  for requirement in \
    "source_pack|source pack" \
    "source_minimum|source minimum" \
    "recency_window|recency window" \
    "credibility rubric|credibility rubric" \
    "confidence_bar|confidence bar" \
    "fallback behavior|fallback behavior" \
    "editorial_rubric|editorial rubric" \
    "asset_pack|asset pack" \
    "output_pack|output pack"; do
    IFS='|' read -r primary_key fallback_key <<<"$requirement"
    requirement_value="$(first_field_value "$brief" "$primary_key" "$fallback_key")"
    if value_present "$requirement_value"; then
      status_line "$primary_key" "ok" "declared"
    else
      publish_blocker "domain requirement missing: $primary_key"
    fi
  done

  local source_minimum
  local source_count
  local asset_count
  source_minimum="$(first_field_value "$brief" "source_minimum" "source minimum")"
  source_count="$(table_data_count "$collection" "source_id")"
  if [[ "$source_count" -gt 0 ]]; then
    status_line "source rows" "ok" "$source_count recorded"
  else
    publish_blocker "collection ledger has no source rows"
  fi
  if [[ "$source_minimum" =~ ^([0-9]+) ]] && [[ "$source_count" -lt "${BASH_REMATCH[1]}" ]]; then
    publish_blocker "collection source count is below declared source_minimum"
  fi
  asset_count="$(table_data_count "$asset" "asset_id")"
  if [[ "$asset_count" -gt 0 ]]; then
    status_line "asset rows" "ok" "$asset_count recorded"
  else
    publish_blocker "asset ledger has no asset rows"
  fi

  local gate_file
  local gate_line
  local gate
  local gate_status
  local gate_note
  local any_gate=0
  local in_gate_table
  for gate_file in "$evidence" "$deployment" "$archive"; do
    in_gate_table=0
    while IFS= read -r gate_line; do
      if [[ "$gate_line" == "## Gate Results" || "$gate_line" == "## Gate Summary" ]]; then
        in_gate_table=1
        continue
      fi
      if [[ "$in_gate_table" -eq 0 ]]; then
        continue
      fi
      if [[ "$gate_line" == \#\#* ]]; then
        in_gate_table=0
        continue
      fi
      [[ "$gate_line" == \|* ]] || continue
      gate="$(trim "$(printf '%s\n' "$gate_line" | cut -d '|' -f 2)")"
      gate_status="$(trim "$(printf '%s\n' "$gate_line" | cut -d '|' -f 3)")"
      gate_note="$(trim "$(printf '%s\n' "$gate_line" | cut -d '|' -f 5)")"
      [[ -n "$gate" ]] || continue
      [[ "$gate" == "gate" ]] && continue
      [[ "$gate" =~ ^-+$ ]] && continue
      any_gate=1
      if ! is_allowed_gate_status "$gate_status"; then
        structural_issue "$(basename "$gate_file") gate '$gate' has invalid or empty status"
        continue
      fi
      if [[ "$gate_status" == "waived" ]] && ! value_present "$gate_note"; then
        structural_issue "$(basename "$gate_file") gate '$gate' is waived without a note"
      fi
      if ! is_publish_pass_gate_status "$gate_status"; then
        publish_blocker "$(basename "$gate_file") gate '$gate' is $gate_status"
      fi
    done <"$gate_file"
  done
  if [[ "$any_gate" -eq 0 ]]; then
    publish_blocker "no gate rows were recorded"
  fi

  local publication_status
  local archive_notification_status
  local ledger_notification_status
  local deploy_adapter
  local deployment_status
  local notify_adapter
  local final_url
  local deploy_url
  local blocked_stage
  local next_action

  publication_status="$(field_value "$archive" "publication_status")"
  archive_notification_status="$(field_value "$archive" "notification_status")"
  ledger_notification_status="$(field_value "$notification" "notification_status")"
  deploy_adapter="$(first_field_value "$deployment" "deploy_adapter")"
  [[ -n "$deploy_adapter" ]] || deploy_adapter="$(first_field_value "$brief" "deploy_adapter")"
  deployment_status="$(field_value "$deployment" "deployment_status")"
  notify_adapter="$(first_field_value "$notification" "notify_adapter")"
  [[ -n "$notify_adapter" ]] || notify_adapter="$(first_field_value "$brief" "notify_adapter")"
  final_url="$(field_value "$archive" "final_url_or_artifact")"
  deploy_url="$(field_value "$deployment" "deploy_url")"
  blocked_stage="$(field_value "$archive" "blocked_stage")"
  next_action="$(field_value "$archive" "next_action")"

  if is_allowed_publication_status "$publication_status"; then
    status_line "publication" "ok" "$publication_status"
  else
    structural_issue "archive publication_status is invalid or empty"
  fi

  if is_allowed_notification_status "$archive_notification_status"; then
    status_line "notification" "ok" "$archive_notification_status"
  else
    structural_issue "archive notification_status is invalid or empty"
  fi

  if [[ "$ledger_notification_status" != "$archive_notification_status" ]]; then
    structural_issue "notification ledger status does not match archive"
  fi

  if ! is_allowed_deployment_status "$deployment_status"; then
    structural_issue "deployment_status is invalid or empty"
  fi

  case "$deploy_adapter" in
    none)
      if [[ "$deployment_status" != "not_in_scope" && "$deployment_status" != "drafted" ]]; then
        structural_issue "deploy_adapter none must use deployment_status not_in_scope or drafted"
      fi
      ;;
    "")
      publish_blocker "deployment adapter is missing"
      ;;
    *)
      if [[ "$deployment_status" != "published" ]]; then
        publish_blocker "deployment_status is not published"
      fi
      if ! value_present "$deploy_url" && ! value_present "$final_url"; then
        publish_blocker "deployment is in scope but no deploy URL or artifact is recorded"
      fi
      ;;
  esac

  case "$notify_adapter" in
    none)
      if [[ "$archive_notification_status" != "not_in_scope" ]]; then
        structural_issue "notify_adapter none must use notification_status not_in_scope"
      fi
      ;;
    "")
      publish_blocker "notification adapter is missing"
      ;;
    *)
      case "$archive_notification_status" in
        sent)
          ;;
        failed)
          if [[ "$publication_status" != "published_with_notification_failure" ]]; then
            structural_issue "failed notification must archive publication_status published_with_notification_failure"
          fi
          ;;
        *)
          publish_blocker "notification_status is not sent or failed"
          ;;
      esac
      ;;
  esac

  case "$publication_status" in
    published)
      [[ "$deployment_status" == "published" || "$deploy_adapter" == "none" ]] || publish_blocker "published archive lacks published deployment status"
      [[ "$archive_notification_status" != "failed" ]] || structural_issue "published archive cannot also have failed notification"
      value_present "$final_url" || publish_blocker "published archive needs final_url_or_artifact"
      ;;
    published_with_notification_failure)
      [[ "$deployment_status" == "published" ]] || publish_blocker "notification-failure publication lacks published deployment status"
      [[ "$archive_notification_status" == "failed" ]] || structural_issue "published_with_notification_failure requires failed notification status"
      value_present "$final_url" || publish_blocker "notification-failure publication needs final_url_or_artifact"
      ;;
    drafted|blocked|failed)
      publish_blocker "archive publication_status is $publication_status"
      if ! value_present "$next_action"; then
        publish_blocker "drafted, blocked, or failed archive needs next_action"
      fi
      if [[ "$publication_status" != "drafted" ]] && ! value_present "$blocked_stage"; then
        publish_blocker "blocked or failed archive needs blocked_stage"
      fi
      ;;
  esac

  if grep -RIEq '(^|[[:space:]("'\'':=])/(Users|home|private|var/folders)/' "$run_dir"; then
    structural_issue "run artifacts contain a machine-local absolute path"
  fi
  if grep -RIEq 'file:///' "$run_dir"; then
    structural_issue "run artifacts contain file URI paths"
  fi
  if grep -RIEq '(sk-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|https://hooks\.slack\.com/services/|discord(app)?\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+|[0-9]{8,10}:[A-Za-z0-9_-]{25,})' "$run_dir"; then
    structural_issue "run artifacts contain a token, webhook, or bot credential pattern"
  fi

  if [[ "$structural_failures" -ne 0 ]]; then
    printf '\n%s\n' "run validation result: invalid run artifact"
    return 2
  fi
  if [[ "$publish_blockers" -ne 0 ]]; then
    printf '\n%s\n' "run validation result: not publishable"
    if [[ "$intent" == "audit" ]]; then
      return 0
    fi
    return 1
  fi
  printf '\n%s\n' "run validation result: publishable"
}

run_init_run() {
  local run_id=""
  local root="."
  local domain_pack=""
  local deploy_adapter="none"
  local notify_adapter="none"
  local scheduler_adapter="manual"

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
      --run-id)
        run_id="$(require_value "$1" "${2:-}")" || return 2
        shift 2
        ;;
      --root)
        root="$(require_value "$1" "${2:-}")" || return 2
        shift 2
        ;;
      --domain-pack)
        domain_pack="$(require_value "$1" "${2:-}")" || return 2
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
      -h|--help)
        cat <<'EOF'
usage: bagakit-daily-media-production-cli init-run --run-id <domain-YYYYMMDD-slug> [options]

Options:
  --root <path>            Repository or host root to write into.
  --domain-pack <name>     Domain pack label for the brief.
  --deploy <adapter>       Deployment adapter to record in the brief.
  --notify <adapter>       Notification adapter to record in the brief.
  --scheduler <adapter>    Scheduler adapter to record in the brief.

Creates .bagakit/daily-media-production/surface.toml and
.bagakit/daily-media-production/runs/<run-id>/ ledger templates. Existing run
files are never overwritten.
EOF
        return 0
        ;;
      *)
        printf 'unknown init-run argument: %s\n' "$1" >&2
        return 2
        ;;
    esac
  done

  if [[ -z "$run_id" ]]; then
    printf 'missing required --run-id\n' >&2
    return 2
  fi
  if ! validate_run_id "$run_id"; then
    printf 'invalid run id: %s\n' "$run_id" >&2
    return 2
  fi
  if [[ ! -d "$root" || ! -w "$root" ]]; then
    printf 'root must exist and be writable: %s\n' "$root" >&2
    return 1
  fi
  if [[ -z "$domain_pack" ]]; then
    domain_pack="$(infer_domain_pack_from_run_id "$run_id")"
  fi

  local source_pack=""
  local source_minimum=""
  local recency_window=""
  local credibility_rubric=""
  local confidence_bar=""
  local fallback_behavior=""
  local editorial_rubric=""
  local asset_pack=""
  local output_pack=""
  if is_builtin_domain_pack "$domain_pack"; then
    source_pack="$(domain_pack_field "$domain_pack" source_pack)"
    source_minimum="$(domain_pack_field "$domain_pack" source_minimum)"
    recency_window="$(domain_pack_field "$domain_pack" recency_window)"
    credibility_rubric="$(domain_pack_field "$domain_pack" credibility_rubric)"
    confidence_bar="$(domain_pack_field "$domain_pack" confidence_bar)"
    fallback_behavior="$(domain_pack_field "$domain_pack" fallback_behavior)"
    editorial_rubric="$(domain_pack_field "$domain_pack" editorial_rubric)"
    asset_pack="$(domain_pack_field "$domain_pack" asset_pack)"
    output_pack="$(domain_pack_field "$domain_pack" output_pack)"
  fi

  local surface_dir="$root/.bagakit/daily-media-production"
  local run_dir="$surface_dir/runs/$run_id"
  local surface_file="$surface_dir/surface.toml"
  mkdir -p "$run_dir"

  if [[ ! -e "$surface_file" ]]; then
    write_file_once "$surface_file" 'schema_version = 1
surface_id = "daily-media-production-runtime"
surface_root = ".bagakit/daily-media-production"
owner_kind = "skill"
owner_id = "bagakit-daily-media-production"
lifecycle_class = "durable_state"
edit_policy = "mixed"
cleanup_safe = false
source_of_truth = [
  "docs/specs/runtime-surface-contract.md",
  "skills/media-production/bagakit-daily-media-production/SKILL.md",
  "skills/media-production/bagakit-daily-media-production/references/run-artifacts.md",
]
reviewable_outputs = [
  "runs/<run-id>/archive.md",
  "runs/<run-id>/*-ledger.md",
]' || return 1
  fi

  local initial_deployment_status="drafted"
  local initial_deployment_gate_status="blocked"
  local initial_deployment_gate_note="not deployed"
  if [[ "$deploy_adapter" == "none" ]]; then
    initial_deployment_status="not_in_scope"
    initial_deployment_gate_status="not_applicable"
    initial_deployment_gate_note="deployment not in scope"
  fi

  local initial_notification_status="pending"
  if [[ "$notify_adapter" == "none" ]]; then
    initial_notification_status="not_in_scope"
  fi

  write_file_once "$run_dir/brief.md" "# Brief

- run_id: $run_id
- domain_pack: $domain_pack
- audience:
- cadence:
- timezone:
- source_window: $recency_window
- source_pack: $source_pack
- source_minimum: $source_minimum
- recency_window: $recency_window
- confidence_bar: $confidence_bar
- editorial_rubric: $editorial_rubric
- asset_pack: $asset_pack
- output_pack: $output_pack
- deploy_adapter: $deploy_adapter
- notify_adapter: $notify_adapter
- scheduler_adapter: $scheduler_adapter
- review_mode:
- no_publish_policy: stop on any blocker

## Domain Pack Requirements
- source minimum: $source_minimum
- recency window: $recency_window
- credibility rubric: $credibility_rubric
- confidence bar: $confidence_bar
- fallback behavior: $fallback_behavior" || return 1

  write_file_once "$run_dir/collection-ledger.md" '# Collection Ledger

| source_id | channel | url_or_ref | observed_at | author_or_source | story_candidate | inclusion_reason |
|-----------|---------|------------|-------------|------------------|-----------------|------------------|' || return 1

  write_file_once "$run_dir/evidence-review.md" '# Evidence Review

| story_id | source_ids | novelty | credibility | audience_impact | counterevidence | confidence | decision |
|----------|------------|---------|-------------|-----------------|-----------------|------------|----------|

## Gate Results
| gate | status | evidence_ref | note |
|------|--------|--------------|------|
| source-minimum | blocked | | not reviewed |
| recency-window | blocked | | not reviewed |
| confidence-bar | blocked | | not reviewed |
| counterevidence | blocked | | not reviewed |' || return 1

  write_file_once "$run_dir/asset-ledger.md" '# Asset Ledger

| asset_id | purpose | format | source_refs | prompt_ref | final_path | validation_status | note |
|----------|---------|--------|-------------|------------|------------|-------------------|------|' || return 1

  write_file_once "$run_dir/deployment-ledger.md" "# Deployment Ledger

- deploy_adapter: $deploy_adapter
- deployment_status: $initial_deployment_status
- command_ref:
- environment:
- deploy_url:
- rollback_note:

## Gate Results
| gate | status | evidence_ref | note |
|------|--------|--------------|------|
| webpage-evidence | $initial_deployment_gate_status | | $initial_deployment_gate_note |
| deployment-url | $initial_deployment_gate_status | | $initial_deployment_gate_note |" || return 1

  write_file_once "$run_dir/notification-ledger.md" "# Notification Ledger

- notify_adapter: $notify_adapter
- notification_status: $initial_notification_status
- recipient_class:
- payload_ref:
- delivery_ref:
- redaction_note:" || return 1

  write_file_once "$run_dir/archive.md" "# Run Archive

- run_id: $run_id
- publication_status: drafted
- notification_status: $initial_notification_status
- final_url_or_artifact:
- blocked_stage:
- next_action: fill run ledgers and resolve blocked gates

## Ledgers
- brief: .bagakit/daily-media-production/runs/$run_id/brief.md
- collection: .bagakit/daily-media-production/runs/$run_id/collection-ledger.md
- evidence_review: .bagakit/daily-media-production/runs/$run_id/evidence-review.md
- asset: .bagakit/daily-media-production/runs/$run_id/asset-ledger.md
- webpage:
- deployment: .bagakit/daily-media-production/runs/$run_id/deployment-ledger.md
- notification: .bagakit/daily-media-production/runs/$run_id/notification-ledger.md

## Gate Summary
| gate | status | evidence_ref | note |
|------|--------|--------------|------|" || return 1

  printf 'initialized run: %s\n' ".bagakit/daily-media-production/runs/$run_id"
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
usage: bagakit-daily-media-production-cli doctor [options]

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
        "skills/design/bagakit-codex-webpage-design/SKILL.md" \
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
    printf '%s\n' "bagakit-daily-media-production: recurring research-to-publication orchestration with source, asset, webpage, deploy, notify, archive, and no-publish gates."
    ;;
  list-references)
    find "$skill_root/references" -type f | sed "s#^$skill_root/##" | sort
    ;;
  list-domain-packs)
    shift
    if [[ $# -gt 0 ]]; then
      printf 'list-domain-packs takes no arguments\n' >&2
      exit 2
    fi
    run_list_domain_packs
    ;;
  doctor)
    shift
    run_doctor "$@"
    ;;
  init-run)
    shift
    run_init_run "$@"
    ;;
  validate-run)
    shift
    run_validate_run "$@"
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
