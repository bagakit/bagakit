set -eu

usage() {
  cat <<'USAGE'
usage:
  decision-harness.sh init --root <host-root> [--force]
  decision-harness.sh add-signal --root <host-root> --input-type <type> --text <text> [--privacy-class <class>] [--source-ref <ref>]
  decision-harness.sh create-decision --root <host-root> --question <text> [--decision-type <type>] [--source-signal <id>] [--option <text>]... [--confidence <text>] [--reversibility <type>] [--expected-outcome <text>] [--review-date <text>] [--risk-tier <tier>]
  decision-harness.sh review-decision --root <host-root> --decision <id> --actual-outcome <text> [--result-gap <text>] [--calibration-note <text>] [--next-practice-update <text>]
  decision-harness.sh propose-pattern --root <host-root> --condition <text> --default-action <text> [--source-decision <id>]... [--example <text>]... [--counter-example <text>]... [--confidence <low|medium|high>]
  decision-harness.sh set-pattern-status --root <host-root> --pattern <id> --status <candidate|accepted|rejected|merged|expired> [--note <text>]
  decision-harness.sh add-ai-update --root <host-root> --update-type <type> --candidate-change <text> [--why-change <text>] [--expected-improvement <text>] [--scope <text>] [--evidence-ref <ref>]...
  decision-harness.sh metric-action --root <host-root> --metric <name> --value <text> --action <text> [--reason <text>]
USAGE
}

cmd="${1:-}"
if [ -z "$cmd" ]; then
  usage
  exit 2
fi
shift

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
harness_dir=$(CDPATH= cd -- "$script_dir/.." && pwd)

die() {
  echo "error: $*" >&2
  exit 2
}

require_value() {
  [ "$#" -ge 2 ] || die "missing value for $1"
}

require_root() {
  [ -n "${root:-}" ] || die "--root is required"
}

require_host() {
  require_root
  [ -f "$root/harness.toml" ] || die "missing harness.toml under --root; run init first"
}

ensure_runtime_dirs() {
  mkdir -p "$root/.bagakit/decision-harness/indexes"
  mkdir -p "$root/.bagakit/decision-harness/cache"
  mkdir -p "$root/.bagakit/decision-harness/runtime-state"
}

ensure_host_dirs() {
  for dir in inbox signals decisions reviews patterns drills ai-updates metrics principles projects exports; do
    mkdir -p "$root/$dir"
  done
  ensure_runtime_dirs
}

next_id() {
  prefix="$1"
  dir="$2"
  count=$(find "$dir" -maxdepth 1 -type f -name "${prefix}-*.toml" 2>/dev/null | wc -l | tr -d ' ')
  number=$((count + 1))
  printf '%s-%04d\n' "$prefix" "$number"
}

literal_field() {
  key="$1"
  value="$2"
  printf '%s = %s\n%s\n%s\n' "$key" "'''" "$value" "'''"
}

escape_double_quoted() {
  awk 'BEGIN { ORS = "" } { gsub("\\\\", "\\\\"); gsub("\"", "\\\""); print }'
}

array_field_lines() {
  key="$1"
  values="$2"
  printf '%s = [\n' "$key"
  if [ -n "$values" ]; then
    printf '%s\n' "$values" | while IFS= read -r value; do
      [ -n "$value" ] || continue
      escaped=$(printf '%s' "$value" | escape_double_quoted)
      printf '  "%s",\n' "$escaped"
    done
  fi
  printf ']\n'
}

validate_one_of() {
  label="$1"
  value="$2"
  shift 2
  for allowed in "$@"; do
    [ "$value" = "$allowed" ] && return 0
  done
  die "invalid $label: $value"
}

rewrite_status() {
  file="$1"
  status="$2"
  tmp="${file}.tmp.$$"
  awk -v status="$status" '
    BEGIN { changed = 0 }
    index($0, "status = ") == 1 {
      print "status = \"" status "\""
      changed = 1
      next
    }
    { print }
    END {
      if (changed == 0) {
        print "status = \"" status "\""
      }
    }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

case "$cmd" in
  init)
    root=""
    force="false"
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --root)
          root="${2:-}"
          shift 2
          ;;
        --force)
          force="true"
          shift
          ;;
        *)
          die "unknown argument: $1"
          ;;
      esac
    done
    require_root
    mkdir -p "$root"
    if [ "$force" != "true" ] && { [ -e "$root/harness.toml" ] || [ -e "$root/README.md" ]; }; then
      die "host root already has harness.toml or README.md; pass --force to overwrite template files"
    fi
    cp "$harness_dir/host-template/harness.toml" "$root/harness.toml"
    cp "$harness_dir/host-template/README.md" "$root/README.md"
    ensure_host_dirs
    cat > "$root/.bagakit/decision-harness/surface.toml" <<'SURFACE'
schema_version = 1
surface_id = "decision-harness-runtime"
surface_root = ".bagakit/decision-harness"
owner_kind = "host_harness"
owner_id = "bagakit-decision-harness"
lifecycle_class = "durable_state"
edit_policy = "mixed"
cleanup_safe = false
source_of_truth = [
  "harness.toml",
]
reviewable_outputs = [
  "decisions/",
  "reviews/",
  "patterns/",
  "ai-updates/",
]
SURFACE
    printf '%s\n' "ok: initialized decision harness host at $root"
    ;;
  add-signal)
    root=""
    input_type=""
    text=""
    privacy_class="private"
    source_ref=""
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --root) require_value "$@"; root="$2"; shift 2 ;;
        --input-type) require_value "$@"; input_type="$2"; shift 2 ;;
        --text) require_value "$@"; text="$2"; shift 2 ;;
        --privacy-class) require_value "$@"; privacy_class="$2"; shift 2 ;;
        --source-ref) require_value "$@"; source_ref="$2"; shift 2 ;;
        *) die "unknown argument: $1" ;;
      esac
    done
    require_host
    ensure_host_dirs
    [ -n "$input_type" ] || die "--input-type is required"
    [ -n "$text" ] || die "--text is required"
    validate_one_of input_type "$input_type" typed_note chat_excerpt agent_trace transcript manual_retro
    validate_one_of privacy_class "$privacy_class" public internal private sensitive regulated
    signal_id=$(next_id signal "$root/signals")
    file="$root/signals/${signal_id}.toml"
    {
      printf 'schema = "decision_signal/v0"\n'
      printf 'signal_id = "%s"\n' "$signal_id"
      printf 'input_type = "%s"\n' "$input_type"
      printf 'privacy_class = "%s"\n' "$privacy_class"
      printf 'status = "raw"\n'
      printf 'source_ref = "%s"\n' "$source_ref"
      literal_field text "$text"
    } > "$file"
    printf '%s\n' "$file"
    ;;
  create-decision)
    root=""
    question=""
    decision_type="choice"
    source_signals=""
    options=""
    confidence=""
    reversibility="two_way_door"
    expected_outcome=""
    review_date=""
    risk_tier="low"
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --root) require_value "$@"; root="$2"; shift 2 ;;
        --question) require_value "$@"; question="$2"; shift 2 ;;
        --decision-type) require_value "$@"; decision_type="$2"; shift 2 ;;
        --source-signal) require_value "$@"; source_signals="${source_signals}${source_signals:+
}$2"; shift 2 ;;
        --option) require_value "$@"; options="${options}${options:+
}$2"; shift 2 ;;
        --confidence) require_value "$@"; confidence="$2"; shift 2 ;;
        --reversibility) require_value "$@"; reversibility="$2"; shift 2 ;;
        --expected-outcome) require_value "$@"; expected_outcome="$2"; shift 2 ;;
        --review-date) require_value "$@"; review_date="$2"; shift 2 ;;
        --risk-tier) require_value "$@"; risk_tier="$2"; shift 2 ;;
        *) die "unknown argument: $1" ;;
      esac
    done
    require_host
    ensure_host_dirs
    [ -n "$question" ] || die "--question is required"
    validate_one_of decision_type "$decision_type" forecast argument_audit choice plan policy_update
    validate_one_of reversibility "$reversibility" one_way_door two_way_door
    validate_one_of risk_tier "$risk_tier" low medium high regulated
    decision_id=$(next_id decision "$root/decisions")
    file="$root/decisions/${decision_id}.toml"
    {
      printf 'schema = "decision_receipt/v0"\n'
      printf 'decision_id = "%s"\n' "$decision_id"
      printf 'decision_type = "%s"\n' "$decision_type"
      printf 'risk_tier = "%s"\n' "$risk_tier"
      printf 'reversibility = "%s"\n' "$reversibility"
      printf 'confidence = "%s"\n' "$confidence"
      printf 'review_date = "%s"\n' "$review_date"
      literal_field question "$question"
      literal_field expected_outcome "$expected_outcome"
      array_field_lines source_signal_ids "$source_signals"
      array_field_lines options "$options"
    } > "$file"
    printf '%s\n' "$file"
    ;;
  review-decision)
    root=""
    decision=""
    actual_outcome=""
    result_gap=""
    calibration_note=""
    next_practice_update=""
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --root) require_value "$@"; root="$2"; shift 2 ;;
        --decision) require_value "$@"; decision="$2"; shift 2 ;;
        --actual-outcome) require_value "$@"; actual_outcome="$2"; shift 2 ;;
        --result-gap) require_value "$@"; result_gap="$2"; shift 2 ;;
        --calibration-note) require_value "$@"; calibration_note="$2"; shift 2 ;;
        --next-practice-update) require_value "$@"; next_practice_update="$2"; shift 2 ;;
        *) die "unknown argument: $1" ;;
      esac
    done
    require_host
    ensure_host_dirs
    [ -n "$decision" ] || die "--decision is required"
    [ -n "$actual_outcome" ] || die "--actual-outcome is required"
    review_id=$(next_id review "$root/reviews")
    file="$root/reviews/${review_id}.toml"
    {
      printf 'schema = "decision_review/v0"\n'
      printf 'review_id = "%s"\n' "$review_id"
      printf 'decision_id = "%s"\n' "$decision"
      literal_field actual_outcome "$actual_outcome"
      literal_field result_gap "$result_gap"
      literal_field calibration_note "$calibration_note"
      literal_field next_practice_update "$next_practice_update"
    } > "$file"
    printf '%s\n' "$file"
    ;;
  propose-pattern)
    root=""
    condition=""
    default_action=""
    source_decisions=""
    examples=""
    counter_examples=""
    confidence="low"
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --root) require_value "$@"; root="$2"; shift 2 ;;
        --condition) require_value "$@"; condition="$2"; shift 2 ;;
        --default-action) require_value "$@"; default_action="$2"; shift 2 ;;
        --source-decision) require_value "$@"; source_decisions="${source_decisions}${source_decisions:+
}$2"; shift 2 ;;
        --example) require_value "$@"; examples="${examples}${examples:+
}$2"; shift 2 ;;
        --counter-example) require_value "$@"; counter_examples="${counter_examples}${counter_examples:+
}$2"; shift 2 ;;
        --confidence) require_value "$@"; confidence="$2"; shift 2 ;;
        *) die "unknown argument: $1" ;;
      esac
    done
    require_host
    ensure_host_dirs
    [ -n "$condition" ] || die "--condition is required"
    [ -n "$default_action" ] || die "--default-action is required"
    validate_one_of confidence "$confidence" low medium high
    pattern_id=$(next_id pattern "$root/patterns")
    file="$root/patterns/${pattern_id}.toml"
    {
      printf 'schema = "decision_pattern/v0"\n'
      printf 'pattern_id = "%s"\n' "$pattern_id"
      printf 'status = "candidate"\n'
      printf 'confidence = "%s"\n' "$confidence"
      literal_field condition "$condition"
      literal_field default_action "$default_action"
      array_field_lines source_decision_ids "$source_decisions"
      array_field_lines examples "$examples"
      array_field_lines counter_examples "$counter_examples"
    } > "$file"
    printf '%s\n' "$file"
    ;;
  set-pattern-status)
    root=""
    pattern=""
    status=""
    note=""
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --root) require_value "$@"; root="$2"; shift 2 ;;
        --pattern) require_value "$@"; pattern="$2"; shift 2 ;;
        --status) require_value "$@"; status="$2"; shift 2 ;;
        --note) require_value "$@"; note="$2"; shift 2 ;;
        *) die "unknown argument: $1" ;;
      esac
    done
    require_host
    [ -n "$pattern" ] || die "--pattern is required"
    [ -n "$status" ] || die "--status is required"
    validate_one_of status "$status" candidate accepted rejected merged expired
    file="$root/patterns/${pattern}.toml"
    [ -f "$file" ] || die "pattern not found: $pattern"
    rewrite_status "$file" "$status"
    if [ -n "$note" ]; then
      history="$root/patterns/${pattern}.history.ndjson"
      printf '{"status":"%s","note":"%s"}\n' "$status" "$(printf '%s' "$note" | escape_double_quoted)" >> "$history"
    fi
    printf '%s\n' "$file"
    ;;
  add-ai-update)
    root=""
    update_type=""
    candidate_change=""
    why_change=""
    expected_improvement=""
    scope=""
    evidence_refs=""
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --root) require_value "$@"; root="$2"; shift 2 ;;
        --update-type) require_value "$@"; update_type="$2"; shift 2 ;;
        --candidate-change) require_value "$@"; candidate_change="$2"; shift 2 ;;
        --why-change) require_value "$@"; why_change="$2"; shift 2 ;;
        --expected-improvement) require_value "$@"; expected_improvement="$2"; shift 2 ;;
        --scope) require_value "$@"; scope="$2"; shift 2 ;;
        --evidence-ref) require_value "$@"; evidence_refs="${evidence_refs}${evidence_refs:+
}$2"; shift 2 ;;
        *) die "unknown argument: $1" ;;
      esac
    done
    require_host
    ensure_host_dirs
    [ -n "$update_type" ] || die "--update-type is required"
    [ -n "$candidate_change" ] || die "--candidate-change is required"
    validate_one_of update_type "$update_type" memory prompt rubric tool_policy skill workflow
    update_id=$(next_id ai-update "$root/ai-updates")
    file="$root/ai-updates/${update_id}.toml"
    {
      printf 'schema = "ai_update_receipt/v0"\n'
      printf 'update_id = "%s"\n' "$update_id"
      printf 'update_type = "%s"\n' "$update_type"
      printf 'activation_status = "candidate"\n'
      literal_field candidate_change "$candidate_change"
      literal_field why_change "$why_change"
      literal_field expected_improvement "$expected_improvement"
      literal_field scope "$scope"
      array_field_lines evidence_refs "$evidence_refs"
    } > "$file"
    printf '%s\n' "$file"
    ;;
  metric-action)
    root=""
    metric=""
    value=""
    action=""
    reason=""
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --root) require_value "$@"; root="$2"; shift 2 ;;
        --metric) require_value "$@"; metric="$2"; shift 2 ;;
        --value) require_value "$@"; value="$2"; shift 2 ;;
        --action) require_value "$@"; action="$2"; shift 2 ;;
        --reason) require_value "$@"; reason="$2"; shift 2 ;;
        *) die "unknown argument: $1" ;;
      esac
    done
    require_host
    ensure_host_dirs
    [ -n "$metric" ] || die "--metric is required"
    [ -n "$value" ] || die "--value is required"
    [ -n "$action" ] || die "--action is required"
    metric_id=$(next_id metric "$root/metrics")
    file="$root/metrics/${metric_id}.toml"
    {
      printf 'schema = "metric_action/v0"\n'
      printf 'metric_id = "%s"\n' "$metric_id"
      printf 'metric = "%s"\n' "$metric"
      literal_field value "$value"
      literal_field action "$action"
      literal_field reason "$reason"
    } > "$file"
    printf '%s\n' "$file"
    ;;
  *)
    die "unknown command: $cmd"
    ;;
esac
