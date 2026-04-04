set -euo pipefail

ROOT="."

while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      ROOT="$2"
      shift 2
      ;;
    *)
      echo "unexpected argument: $1" >&2
      exit 2
      ;;
  esac
done

ROOT="$(cd "$ROOT" && pwd)"
SKILL_DIR="$ROOT/skills/harness/bagakit-researcher"
RESEARCHER="$SKILL_DIR/scripts/bagakit-researcher.py"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

run_researcher() {
  python3 "$RESEARCHER" "$@"
}

topic_path() {
  local topic_class="$1"
  local topic="$2"
  local slash="/"
  local topic_root_suffix="."bagakit/researcher/topics/
  printf '%s%s%s%s%s%s' "$TMP_DIR" "$slash" "$topic_root_suffix" "$topic_class" "$slash" "$topic"
}

join_path() {
  local base="$1"
  local rel="$2"
  printf '%s/%s' "$base" "$rel"
}

init_topic() {
  local topic_class="$1"
  local topic="$2"
  local title="$3"
  run_researcher init-topic \
    --root "$TMP_DIR" \
    --topic-class "$topic_class" \
    --topic "$topic" \
    --title "$title" >/dev/null
}

add_source() {
  local topic_class="$1"
  local topic="$2"
  local source_id="$3"
  local title="$4"
  run_researcher add-source-card \
    --root "$TMP_DIR" \
    --topic-class "$topic_class" \
    --topic "$topic" \
    --source-id "$source_id" \
    --title "$title" \
    --url "https://example.com/$source_id" \
    --authority primary \
    --published unknown \
    --source-role primary \
    --scope-fit core \
    --limitations "example limitation" \
    --why "sets the baseline" >/dev/null
}

add_summary() {
  local topic_class="$1"
  local topic="$2"
  local source_id="$3"
  local title="$4"
  run_researcher add-summary \
    --root "$TMP_DIR" \
    --topic-class "$topic_class" \
    --topic "$topic" \
    --source-id "$source_id" \
    --title "$title" \
    --why-matters "clarifies the baseline" \
    --borrow "one reusable idea" \
    --avoid "one wrong direction" \
    --implication "one Bagakit implication" >/dev/null
}

assert_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "error: expected file missing: $path" >&2
    exit 1
  fi
}

assert_contains() {
  local path="$1"
  local pattern="$2"
  if ! grep -Fq -- "$pattern" "$path"; then
    echo "error: expected pattern '$pattern' in $path" >&2
    exit 1
  fi
}

assert_not_contains() {
  local path="$1"
  local pattern="$2"
  if grep -Fq -- "$pattern" "$path"; then
    echo "error: unexpected pattern '$pattern' in $path" >&2
    exit 1
  fi
}

assert_no_warnings() {
  local output_file="$1"
  shift
  if ! "$@" >"$output_file" 2>&1; then
    echo "error: warning-free command failed: $*" >&2
    cat "$output_file" >&2
    exit 1
  fi
  if grep -qi 'warning' "$output_file"; then
    echo "error: unexpected warning output from: $*" >&2
    cat "$output_file" >&2
    exit 1
  fi
}

assert_count() {
  local path="$1"
  local pattern="$2"
  local expected="$3"
  local actual
  actual="$(grep -F -- "$pattern" "$path" | wc -l | tr -d ' ')"
  if [[ "$actual" != "$expected" ]]; then
    echo "error: expected $expected occurrences of '$pattern' in $path, got $actual" >&2
    exit 1
  fi
}

assert_no_path_leaks() {
  local target_dir="$1"
  local users_marker="/""Users"
  local var_folders_marker="/""var/""folders"
  local file_marker="file""://"
  if grep -R -n -F "$TMP_DIR" "$target_dir" >/dev/null; then
    echo "error: generated artifacts leaked temp root under $target_dir" >&2
    exit 1
  fi
  if grep -R -n -F "$ROOT" "$target_dir" >/dev/null; then
    echo "error: generated artifacts leaked repo root under $target_dir" >&2
    exit 1
  fi
  if grep -R -n -F "$users_marker" "$target_dir" >/dev/null; then
    echo "error: generated artifacts contain absolute path markers under $target_dir" >&2
    exit 1
  fi
  if grep -R -n -F "$var_folders_marker" "$target_dir" >/dev/null; then
    echo "error: generated artifacts contain absolute path markers under $target_dir" >&2
    exit 1
  fi
  if grep -R -n -F "$file_marker" "$target_dir" >/dev/null; then
    echo "error: generated artifacts contain absolute path markers under $target_dir" >&2
    exit 1
  fi
}

assert_command_fails() {
  if "$@" >/dev/null 2>&1; then
    echo "error: command unexpectedly succeeded: $*" >&2
    exit 1
  fi
}

assert_command_succeeds_with_warning() {
  local output_file="$1"
  shift
  if ! "$@" >"$output_file" 2>&1; then
    echo "error: warning-only command failed: $*" >&2
    cat "$output_file" >&2
    exit 1
  fi
  if ! grep -qi 'warning' "$output_file"; then
    echo "error: expected warning output from: $*" >&2
    cat "$output_file" >&2
    exit 1
  fi
}

mkdir -p "$TMP_DIR/.bagakit"

init_topic frontier smoke-test "Smoke Test"
add_source frontier smoke-test a01 "Example Source"
add_summary frontier smoke-test a01 "Example Source Summary"

run_researcher refresh-index \
  --root "$TMP_DIR" \
  --topic-class frontier \
  --topic smoke-test \
  --title "Smoke Test" >/dev/null

run_researcher list-topics --root "$TMP_DIR" | grep -q 'frontier/smoke-test'
run_researcher doctor --root "$TMP_DIR" --topic-class frontier --topic smoke-test >/dev/null
SMOKE_WS="$(topic_path frontier smoke-test)"
assert_file "$(join_path "$SMOKE_WS" "originals/a01.md")"
assert_file "$(join_path "$SMOKE_WS" "summaries/a01.md")"
assert_contains "$(join_path "$SMOKE_WS" "index.md")" 'a01.md'
assert_contains "$(join_path "$SMOKE_WS" "index.md")" 'summaries/a01.md'

cat > "$TMP_DIR/.bagakit/knowledge_conf.toml" <<'EOF'
[paths]
researcher_root = ".bagakit/researcher"
EOF

init_topic configured topic-root "Configured Root"
run_researcher list-topics --root "$TMP_DIR" | grep -q 'configured/topic-root'
run_researcher doctor --root "$TMP_DIR" --topic-class configured --topic topic-root >/dev/null
CONFIGURED_WS="$(topic_path configured topic-root)"
assert_file "$(join_path "$CONFIGURED_WS" "index.md")"

cat > "$TMP_DIR/.bagakit/knowledge_conf.toml" <<'EOF'
[paths]
researcher_root = "docs/.research"
EOF

assert_command_fails run_researcher init-topic \
  --root "$TMP_DIR" \
  --topic-class invalid \
  --topic old-root \
  --title "Invalid Root"

cat > "$TMP_DIR/.bagakit/knowledge_conf.toml" <<'EOF'
[paths]
researcher_root = ".bagakit/researcher"
EOF

init_topic frontier integrated-plan "Integrated Plan"
INTEGRATED_WS="$(topic_path frontier integrated-plan)"
cat >> "$INTEGRATED_WS/index.md" <<'EOF'

## Hand Authored Notes

Keep this curation intact.
EOF

run_researcher plan-pass \
  --root "$TMP_DIR" \
  --topic-class frontier \
  --topic integrated-plan \
  --pass-id pass-001 \
  --question "How should researcher support parallel anti-drift research?" \
  --decision-use "implement researcher workflow" \
  --output-shape "validated local artifacts" \
  --in-scope "parallel track contracts" \
  --in-scope "drift warnings" \
  --out-of-scope "subagent spawning" \
  --source-priority "primary implementation references" \
  --evidence-threshold "recommendations need evidence refs" \
  --stop-condition "two useful tracks are specified" \
  --drift-sentinel "track output must answer the charter question" \
  --source-class "primary implementation reference" \
  --track "track-alpha:Topic extraction:a001-a099" \
  --track "track-beta:Active mining:b001-b099" \
  --required-source-type "source-card" \
  --source-id-range a001-b099 \
  --budget "two tracks" \
  --merge-expectation "merge through claims.md" \
  --synthesis-target "summaries/pass-001-synthesis.md" \
  --lead-policy "defer off-topic leads" \
  --drift-check "must answer the charter question" >/dev/null

assert_file "$INTEGRATED_WS/charter.md"
assert_file "$INTEGRATED_WS/claims.md"
assert_file "$INTEGRATED_WS/leads.md"
assert_file "$INTEGRATED_WS/passes/pass-001.md"
assert_file "$INTEGRATED_WS/tracks/track-alpha.md"
assert_file "$INTEGRATED_WS/tracks/track-beta.md"

run_researcher add-track \
  --root "$TMP_DIR" \
  --topic-class frontier \
  --topic integrated-plan \
  --track-id track-gamma \
  --pass-id pass-001 \
  --question "How should summaries preserve evidence parentage?" \
  --required-source-type "source-card" \
  --preferred-source "existing originals" \
  --disallowed-source "unsourced recommendation" \
  --source-id-range c001-c099 \
  --owned-output "summaries/summary-parentage.md" \
  --minimum-evidence "one source card and one claim ref" \
  --lead-policy "defer off-topic leads" \
  --drift-check "must answer the charter question" \
  --merge-note "merge through claims.md" >/dev/null

run_researcher list-tracks \
  --root "$TMP_DIR" \
  --topic-class frontier \
  --topic integrated-plan | grep -q 'track-gamma'

add_source frontier integrated-plan a01 "Integrated Source"
add_summary frontier integrated-plan z99 "Mismatched Summary"

run_researcher add-claim \
  --root "$TMP_DIR" \
  --topic-class frontier \
  --topic integrated-plan \
  --claim-id cl-ungrounded \
  --kind recommendation \
  --statement "Researcher should adopt every discovered lead immediately." \
  --confidence high >/dev/null

run_researcher add-lead \
  --root "$TMP_DIR" \
  --topic-class frontier \
  --topic integrated-plan \
  --lead-id lead-loose \
  --originating-artifact "claims.md#cl-ungrounded" \
  --hypothesis "a broad adjacent topic may matter" \
  --expected-value "" \
  --stop-rule "" >/dev/null

run_researcher add-insight \
  --root "$TMP_DIR" \
  --topic-class frontier \
  --topic integrated-plan \
  --insight-id insight-one \
  --insight "One unsupported claim is not enough for a high confidence insight." \
  --source-claim cl-ungrounded \
  --confidence high >/dev/null

assert_command_succeeds_with_warning "$TMP_DIR/quality.out" run_researcher doctor \
  --root "$TMP_DIR" \
  --topic-class frontier \
  --topic integrated-plan \
  --quality
assert_contains "$TMP_DIR/quality.out" 'z99'

assert_command_succeeds_with_warning "$TMP_DIR/drift.out" run_researcher doctor \
  --root "$TMP_DIR" \
  --topic-class frontier \
  --topic integrated-plan \
  --drift
assert_contains "$TMP_DIR/drift.out" 'cl-ungrounded'
assert_contains "$TMP_DIR/drift.out" 'lead-loose'
assert_contains "$TMP_DIR/drift.out" 'insight-one'

run_researcher refresh-index \
  --root "$TMP_DIR" \
  --topic-class frontier \
  --topic integrated-plan \
  --title "Integrated Plan" >/dev/null
run_researcher refresh-index \
  --root "$TMP_DIR" \
  --topic-class frontier \
  --topic integrated-plan \
  --title "Integrated Plan" >/dev/null
assert_contains "$INTEGRATED_WS/index.md" 'Keep this curation intact'
assert_contains "$INTEGRATED_WS/index.md" 'pass-001.md'
assert_contains "$INTEGRATED_WS/index.md" 'track-gamma.md'
assert_count "$INTEGRATED_WS/index.md" '<!-- BAGAKIT:RESEARCHER:SOURCE-CARDS:START -->' 1
assert_count "$INTEGRATED_WS/index.md" '<!-- BAGAKIT:RESEARCHER:SOURCE-CARDS:END -->' 1
assert_count "$INTEGRATED_WS/index.md" '<!-- BAGAKIT:RESEARCHER:SUMMARIES:START -->' 1
assert_count "$INTEGRATED_WS/index.md" '<!-- BAGAKIT:RESEARCHER:SUMMARIES:END -->' 1
assert_count "$INTEGRATED_WS/index.md" '<!-- BAGAKIT:RESEARCHER:PASSES:START -->' 1
assert_count "$INTEGRATED_WS/index.md" '<!-- BAGAKIT:RESEARCHER:PASSES:END -->' 1
assert_count "$INTEGRATED_WS/index.md" '<!-- BAGAKIT:RESEARCHER:TRACKS:START -->' 1
assert_count "$INTEGRATED_WS/index.md" '<!-- BAGAKIT:RESEARCHER:TRACKS:END -->' 1
assert_count "$INTEGRATED_WS/index.md" '<!-- BAGAKIT:RESEARCHER:CLAIMS:START -->' 1
assert_count "$INTEGRATED_WS/index.md" '<!-- BAGAKIT:RESEARCHER:CLAIMS:END -->' 1
assert_count "$INTEGRATED_WS/index.md" '<!-- BAGAKIT:RESEARCHER:INSIGHTS:START -->' 1
assert_count "$INTEGRATED_WS/index.md" '<!-- BAGAKIT:RESEARCHER:INSIGHTS:END -->' 1
assert_count "$INTEGRATED_WS/index.md" '<!-- BAGAKIT:RESEARCHER:LEADS:START -->' 1
assert_count "$INTEGRATED_WS/index.md" '<!-- BAGAKIT:RESEARCHER:LEADS:END -->' 1

for handoff_kind in selector evolver living-knowledge; do
  run_researcher render-handoff \
    --root "$TMP_DIR" \
    --topic-class frontier \
    --topic integrated-plan \
    --kind "$handoff_kind" >/dev/null
done
assert_file "$INTEGRATED_WS/handoffs/selector-evidence.md"
assert_file "$INTEGRATED_WS/handoffs/evolver-context.md"
assert_file "$INTEGRATED_WS/handoffs/living-knowledge-intake.md"
if [[ -e "$TMP_DIR/.bagakit/evolver" || -e "$TMP_DIR/.bagakit/living-knowledge" ]]; then
  echo "error: render-handoff mutated non-researcher systems" >&2
  exit 1
fi

init_topic frontier clean-topic "Clean Topic"
CLEAN_WS="$(topic_path frontier clean-topic)"
run_researcher plan-pass \
  --root "$TMP_DIR" \
  --topic-class frontier \
  --topic clean-topic \
  --pass-id pass-001 \
  --question "How should a clean topic avoid warnings?" \
  --decision-use "validate warning controls" \
  --output-shape "clean local artifacts" \
  --in-scope "complete evidence chain" \
  --out-of-scope "provider execution" \
  --source-priority "primary source cards" \
  --evidence-threshold "one matching source and summary" \
  --stop-condition "one clean chain exists" \
  --drift-sentinel "no unsupported recommendation" \
  --source-class "primary" \
  --track "summaries:Build a complete clean chain:c001-c099" \
  --required-source-type "source-card" \
  --source-id-range c001-c099 \
  --budget "one track" \
  --merge-expectation "merge through claims" \
  --synthesis-target "summaries/pass-001-synthesis.md" \
  --lead-policy "defer off-topic leads" \
  --drift-check "answer the charter" >/dev/null
run_researcher add-source-card \
  --root "$TMP_DIR" \
  --topic-class frontier \
  --topic clean-topic \
  --source-id c001 \
  --title "Clean Source" \
  --url "https://example.com/clean-source" \
  --authority primary \
  --source-role primary \
  --scope-fit core \
  --limitations "single example" \
  --why "grounds the clean chain" >/dev/null
add_summary frontier clean-topic c001 "Clean Source Summary"
run_researcher add-claim \
  --root "$TMP_DIR" \
  --topic-class frontier \
  --topic clean-topic \
  --claim-id clean-claim \
  --kind recommendation \
  --statement "Complete evidence chains should remain warning-free." \
  --evidence-ref "originals/c001.md" \
  --counterevidence-ref "summaries/c001.md#avoid" \
  --confidence medium \
  --status supported >/dev/null
run_researcher add-insight \
  --root "$TMP_DIR" \
  --topic-class frontier \
  --topic clean-topic \
  --insight-id clean-insight \
  --insight "The clean chain has explicit evidence and counterevidence." \
  --source-claim clean-claim \
  --confidence low >/dev/null
run_researcher add-lead \
  --root "$TMP_DIR" \
  --topic-class frontier \
  --topic clean-topic \
  --lead-id clean-lead \
  --originating-artifact "claims.md#clean-claim" \
  --hypothesis "A deferred lead can preserve scope." \
  --expected-value "future comparison only" \
  --stop-rule "defer until a new pass" \
  --status deferred \
  --outcome "deferred outside this pass" >/dev/null
run_researcher resolve-lead \
  --root "$TMP_DIR" \
  --topic-class frontier \
  --topic clean-topic \
  --lead-id clean-lead \
  --status promoted \
  --outcome "promoted into clean synthesis" >/dev/null
assert_contains "$CLEAN_WS/leads.md" 'promoted into clean synthesis'
run_researcher new-synthesis \
  --root "$TMP_DIR" \
  --topic-class frontier \
  --topic clean-topic \
  --synthesis-id pass-001-synthesis \
  --what "clean warning-free topic" \
  --claim-ref clean-claim \
  --insight-ref clean-insight \
  --finding "evidence and counterevidence are explicit" \
  --next-action "no action" >/dev/null
run_researcher refresh-index \
  --root "$TMP_DIR" \
  --topic-class frontier \
  --topic clean-topic \
  --title "Clean Topic" >/dev/null
run_researcher refresh-wiki \
  --root "$TMP_DIR" \
  --title "Researcher Frontdoor" >/dev/null
assert_file "$TMP_DIR/.bagakit/researcher/index.md"
assert_file "$TMP_DIR/.bagakit/researcher/wiki/README.md"
assert_file "$TMP_DIR/.bagakit/researcher/wiki/concepts/research-topics.md"
assert_file "$TMP_DIR/.bagakit/researcher/wiki/questions/open-questions.md"
assert_file "$TMP_DIR/.bagakit/researcher/wiki/claims/supported-claims.md"
assert_contains "$TMP_DIR/.bagakit/researcher/index.md" 'frontier/clean-topic'
assert_contains "$TMP_DIR/.bagakit/researcher/index.md" 'not the shared'
assert_contains "$TMP_DIR/.bagakit/researcher/wiki/concepts/research-topics.md" '.bagakit/researcher/topics/frontier/clean-topic/index.md'
assert_contains "$TMP_DIR/.bagakit/researcher/wiki/claims/supported-claims.md" 'claims.md#clean-claim'
assert_no_warnings "$TMP_DIR/wiki.out" run_researcher doctor \
  --root "$TMP_DIR" \
  --wiki
assert_no_warnings "$TMP_DIR/clean-quality.out" run_researcher doctor \
  --root "$TMP_DIR" \
  --topic-class frontier \
  --topic clean-topic \
  --quality
assert_no_warnings "$TMP_DIR/clean-drift.out" run_researcher doctor \
  --root "$TMP_DIR" \
  --topic-class frontier \
  --topic clean-topic \
  --drift
assert_not_contains "$CLEAN_WS/index.md" "$TMP_DIR"
assert_no_path_leaks "$INTEGRATED_WS"
assert_no_path_leaks "$CLEAN_WS"
assert_no_path_leaks "$TMP_DIR/.bagakit/researcher/index.md"
assert_no_path_leaks "$TMP_DIR/.bagakit/researcher/wiki"

echo "ok: bagakit-researcher canonical smoke passed"
