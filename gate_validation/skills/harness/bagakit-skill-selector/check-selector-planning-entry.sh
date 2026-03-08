set -euo pipefail

ROOT="."
TMP_DIR=""

cleanup() {
  if [[ -n "${TMP_DIR:-}" && -d "${TMP_DIR:-}" ]]; then
    rm -rf "$TMP_DIR"
  fi
}

trap cleanup EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      [[ $# -ge 2 ]] || { echo "missing value for --root" >&2; exit 2; }
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
TMP_DIR="$(mktemp -d)"
SELECTOR_BIN=(node --experimental-strip-types "$ROOT/skills/harness/bagakit-skill-selector/scripts/skill_selector.ts")

init_route_task() {
  local file="$1"
  local task_id="$2"
  local objective="$3"
  local decision="$4"
  local recipe_id="$5"
  local artifact="$6"

  "${SELECTOR_BIN[@]}" init --file "$file" --task-id "$task_id" --objective "$objective" --owner "validator"
  "${SELECTOR_BIN[@]}" preflight --file "$file" --answer partial --gap-summary "need explicit planning route" --decision "$decision" --status in_progress
  "${SELECTOR_BIN[@]}" recipe \
    --file "$file" \
    --recipe-id "$recipe_id" \
    --source "skills/harness/bagakit-skill-selector/recipes/$recipe_id.md" \
    --why "exercise canonical planning-entry route" \
    --synthesis-artifact "$artifact" \
    --status selected
  "${SELECTOR_BIN[@]}" plan \
    --file "$file" \
    --skill-id "bagakit-skill-selector" \
    --kind local \
    --source "skills/harness/bagakit-skill-selector" \
    --why "own explicit route visibility" \
    --expected-impact "keep the route task-local and auditable" \
    --availability available \
    --availability-detail "available as a canonical local skill in the current catalog root" \
    --selected true \
    --composition-role composition_entrypoint \
    --composition-id "$task_id" \
    --activation-mode composed
}

plan_peer() {
  local file="$1"
  local task_id="$2"
  local skill_id="$3"
  local source="$4"
  local why="$5"
  local impact="$6"

  "${SELECTOR_BIN[@]}" plan \
    --file "$file" \
    --skill-id "$skill_id" \
    --kind local \
    --source "$source" \
    --why "$why" \
    --expected-impact "$impact" \
    --availability available \
    --availability-detail "available as a canonical local skill in the current catalog root" \
    --selected true \
    --composition-role composition_peer \
    --composition-id "$task_id" \
    --activation-mode composed \
    --fallback-strategy standalone_first
}

usage_success() {
  local file="$1"
  local skill_id="$2"
  local phase="$3"
  local key="$4"
  local action="$5"
  local evidence="$6"

  "${SELECTOR_BIN[@]}" usage \
    --file "$file" \
    --skill-id "$skill_id" \
    --phase "$phase" \
    --attempt-key "$key" \
    --action "$action" \
    --result success \
    --evidence "$evidence"
}

finalize_route() {
  local file="$1"

  "${SELECTOR_BIN[@]}" evaluate \
    --file "$file" \
    --quality-score 0.82 \
    --evidence-score 0.84 \
    --feedback-score 0.76 \
    --overall pass \
    --summary "planning-entry route remains explicit and valid" \
    --status completed
  "${SELECTOR_BIN[@]}" validate --file "$file" --strict >/dev/null
}

run_positive_routes() {
  local base="$TMP_DIR/.bagakit/skill-selector/tasks"

  local brainstorm_only="$base/brainstorm-only/skill-usage.toml"
  init_route_task "$brainstorm_only" "brainstorm-only" "analysis route" "compare_then_execute" "planning-entry-brainstorm-only" ".bagakit/brainstorm/outcome/brainstorm-handoff-analysis.md"
  plan_peer "$brainstorm_only" "brainstorm-only" "bagakit-brainstorm" "skills/harness/bagakit-brainstorm" "reduce ambiguity" "produce a handoff"
  usage_success "$brainstorm_only" "bagakit-brainstorm" "planning" "brainstorm-only" "prepared analysis handoff route" ".bagakit/brainstorm/outcome/brainstorm-handoff-analysis.md"
  finalize_route "$brainstorm_only"

  local brainstorm_feature="$base/brainstorm-feature/skill-usage.toml"
  init_route_task "$brainstorm_feature" "brainstorm-feature" "ambiguous delivery route" "compose_then_execute" "planning-entry-brainstorm-to-feature" ".bagakit/feature-tracker/index/features.json"
  plan_peer "$brainstorm_feature" "brainstorm-feature" "bagakit-brainstorm" "skills/harness/bagakit-brainstorm" "reduce ambiguity" "produce a tracker-ready handoff"
  plan_peer "$brainstorm_feature" "brainstorm-feature" "bagakit-feature-tracker" "skills/harness/bagakit-feature-tracker" "materialize planning truth" "create canonical feature state"
  usage_success "$brainstorm_feature" "bagakit-brainstorm" "planning" "brainstorm-feature-brainstorm" "prepared delivery handoff route" ".bagakit/brainstorm/outcome/brainstorm-handoff-delivery.md"
  usage_success "$brainstorm_feature" "bagakit-feature-tracker" "planning" "brainstorm-feature-tracker" "prepared tracker planning route" ".bagakit/feature-tracker/index/features.json"
  finalize_route "$brainstorm_feature"

  local feature_flow="$base/feature-flow/skill-usage.toml"
  init_route_task "$feature_flow" "feature-flow" "clear delivery route" "direct_execute" "planning-entry-feature-to-flow" ".bagakit/flow-runner/next-action.json"
  plan_peer "$feature_flow" "feature-flow" "bagakit-feature-tracker" "skills/harness/bagakit-feature-tracker" "own planning truth" "create canonical feature state"
  plan_peer "$feature_flow" "feature-flow" "bagakit-flow-runner" "skills/harness/bagakit-flow-runner" "own bounded execution" "expose next-action runtime"
  usage_success "$feature_flow" "bagakit-feature-tracker" "planning" "feature-flow-tracker" "prepared canonical planning route" ".bagakit/feature-tracker/index/features.json"
  usage_success "$feature_flow" "bagakit-flow-runner" "execution" "feature-flow-runner" "prepared bounded execution route" ".bagakit/flow-runner/next-action.json"
  finalize_route "$feature_flow"

  local full_route="$base/full-route/skill-usage.toml"
  init_route_task "$full_route" "full-route" "full planning route" "compose_then_execute" "planning-entry-brainstorm-feature-flow" ".bagakit/flow-runner/next-action.json"
  plan_peer "$full_route" "full-route" "bagakit-brainstorm" "skills/harness/bagakit-brainstorm" "reduce ambiguity" "produce a handoff"
  plan_peer "$full_route" "full-route" "bagakit-feature-tracker" "skills/harness/bagakit-feature-tracker" "materialize planning truth" "create canonical feature state"
  plan_peer "$full_route" "full-route" "bagakit-flow-runner" "skills/harness/bagakit-flow-runner" "own bounded execution" "expose next-action runtime"
  usage_success "$full_route" "bagakit-brainstorm" "planning" "full-route-brainstorm" "prepared ambiguity-reduction handoff route" ".bagakit/brainstorm/outcome/brainstorm-handoff-full-route.md"
  usage_success "$full_route" "bagakit-feature-tracker" "planning" "full-route-tracker" "prepared canonical planning-truth route" ".bagakit/feature-tracker/index/features.json"
  usage_success "$full_route" "bagakit-flow-runner" "execution" "full-route-runner" "prepared bounded execution route" ".bagakit/flow-runner/next-action.json"
  finalize_route "$full_route"
}

run_negative_checks() {
  local unplanned="$TMP_DIR/.bagakit/skill-selector/tasks/unplanned/skill-usage.toml"
  "${SELECTOR_BIN[@]}" init --file "$unplanned" --task-id "unplanned" --objective "reject unplanned usage" --owner "validator" >/dev/null
  if "${SELECTOR_BIN[@]}" usage \
    --file "$unplanned" \
    --skill-id "bagakit-brainstorm" \
    --phase planning \
    --attempt-key "unplanned" \
    --action "should fail without selected plan" \
    --result success \
    --evidence ".bagakit/brainstorm/outcome/unplanned.md" >/dev/null 2>&1; then
    echo "error: usage unexpectedly accepted an unplanned skill" >&2
    exit 1
  fi

  local invalid_route="$TMP_DIR/.bagakit/skill-selector/tasks/invalid-route/skill-usage.toml"
  init_route_task "$invalid_route" "invalid-route" "invalid route" "direct_execute" "planning-entry-feature-to-flow" "task_plan.md"
  plan_peer "$invalid_route" "invalid-route" "bagakit-feature-tracker" "skills/harness/bagakit-feature-tracker" "own planning truth" "create canonical feature state"
  usage_success "$invalid_route" "bagakit-feature-tracker" "planning" "invalid-route-tracker" "prepared canonical planning route" ".bagakit/feature-tracker/index/features.json"
  "${SELECTOR_BIN[@]}" evaluate \
    --file "$invalid_route" \
    --quality-score 0.50 \
    --evidence-score 0.50 \
    --feedback-score 0.50 \
    --overall conditional_pass \
    --summary "intentionally invalid route" \
    --status review
  if "${SELECTOR_BIN[@]}" validate --file "$invalid_route" --strict >/dev/null 2>&1; then
    echo "error: planning-entry validation unexpectedly accepted a mismatched route" >&2
    exit 1
  fi

  local extra_peer="$TMP_DIR/.bagakit/skill-selector/tasks/extra-peer/skill-usage.toml"
  init_route_task "$extra_peer" "extra-peer" "extra peer route" "compare_then_execute" "planning-entry-brainstorm-only" ".bagakit/brainstorm/outcome/brainstorm-handoff-extra-peer.md"
  plan_peer "$extra_peer" "extra-peer" "bagakit-brainstorm" "skills/harness/bagakit-brainstorm" "reduce ambiguity" "produce a handoff"
  plan_peer "$extra_peer" "extra-peer" "bagakit-feature-tracker" "skills/harness/bagakit-feature-tracker" "unexpected extra peer" "should be rejected by route validation"
  usage_success "$extra_peer" "bagakit-brainstorm" "planning" "extra-peer-brainstorm" "prepared analysis handoff route" ".bagakit/brainstorm/outcome/brainstorm-handoff-extra-peer.md"
  "${SELECTOR_BIN[@]}" evaluate \
    --file "$extra_peer" \
    --quality-score 0.50 \
    --evidence-score 0.50 \
    --feedback-score 0.50 \
    --overall conditional_pass \
    --summary "intentionally invalid extra peer" \
    --status review
  if "${SELECTOR_BIN[@]}" validate --file "$extra_peer" --strict >/dev/null 2>&1; then
    echo "error: planning-entry validation unexpectedly accepted an off-route selected peer" >&2
    exit 1
  fi

  local invalid_evidence="$TMP_DIR/.bagakit/skill-selector/tasks/invalid-evidence/skill-usage.toml"
  init_route_task "$invalid_evidence" "invalid-evidence" "invalid evidence route" "direct_execute" "planning-entry-feature-to-flow" ".bagakit/flow-runner/next-action.json"
  plan_peer "$invalid_evidence" "invalid-evidence" "bagakit-feature-tracker" "skills/harness/bagakit-feature-tracker" "own planning truth" "create canonical feature state"
  plan_peer "$invalid_evidence" "invalid-evidence" "bagakit-flow-runner" "skills/harness/bagakit-flow-runner" "own bounded execution" "expose next-action runtime"
  usage_success "$invalid_evidence" "bagakit-feature-tracker" "planning" "invalid-evidence-tracker" "prepared canonical planning route" "task_plan.md"
  usage_success "$invalid_evidence" "bagakit-flow-runner" "execution" "invalid-evidence-runner" "prepared bounded execution route" "progress.md"
  "${SELECTOR_BIN[@]}" evaluate \
    --file "$invalid_evidence" \
    --quality-score 0.50 \
    --evidence-score 0.50 \
    --feedback-score 0.50 \
    --overall conditional_pass \
    --summary "intentionally invalid route evidence" \
    --status review
  if "${SELECTOR_BIN[@]}" validate --file "$invalid_evidence" --strict >/dev/null 2>&1; then
    echo "error: planning-entry validation unexpectedly accepted generic root-note evidence" >&2
    exit 1
  fi
}

run_positive_routes
run_negative_checks

echo "ok: selector planning-entry regression passed"
