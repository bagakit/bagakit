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
    -h|--help)
      echo "usage: check-selector-disposition.sh [--root <repo-root>]"
      exit 0
      ;;
    *)
      echo "unexpected argument: $1" >&2
      exit 2
      ;;
  esac
done

ROOT="$(cd "$ROOT" && pwd)"
TMP_DIR="$(mktemp -d)"
SELECTOR=(node --experimental-strip-types "$ROOT/skills/harness/bagakit-skill-selector/scripts/skill_selector.ts")

init_direct() {
  local file="$1"
  local task_id="$2"
  "${SELECTOR[@]}" init --file "$file" --task-id "$task_id" --objective "selector disposition proof" --owner validator >/dev/null
  "${SELECTOR[@]}" preflight --file "$file" --answer yes --decision direct_execute --status in_progress >/dev/null
}

add_complete_episode() {
  local file="$1"
  "${SELECTOR[@]}" plan \
    --file "$file" \
    --skill-id bagakit-skill-selector \
    --kind local \
    --source skills/harness/bagakit-skill-selector \
    --why "exercise selector close behavior" \
    --expected-impact "produce deterministic validation evidence" \
    --availability available \
    --availability-detail "canonical skill is present" >/dev/null
  "${SELECTOR[@]}" usage \
    --file "$file" \
    --skill-id bagakit-skill-selector \
    --phase execution \
    --action "completed the selected direct route" \
    --result success \
    --evidence gate_validation/skills/harness/bagakit-skill-selector/check-selector-disposition.sh >/dev/null
  "${SELECTOR[@]}" evaluate \
    --file "$file" \
    --quality-score 1 \
    --evidence-score 1 \
    --feedback-score 1 \
    --overall pass \
    --summary "complete selector episode" >/dev/null
}

expect_full_required() {
  local file="$1"
  local expected_signal="$2"
  if "${SELECTOR[@]}" close --file "$file" --disposition receipt_only >"$TMP_DIR/rejected.out" 2>"$TMP_DIR/rejected.err"; then
    echo "error: material selector episode unexpectedly closed as receipt_only" >&2
    exit 1
  fi
  grep -q 'episode requires full_episode because material signals are present' "$TMP_DIR/rejected.err"
  grep -q "$expected_signal" "$TMP_DIR/rejected.err"
  if grep -q '^\[episode_disposition\]' "$file"; then
    echo "error: rejected close mutated the selector task receipt" >&2
    exit 1
  fi
}

RECEIPT="$TMP_DIR/receipt/skill-usage.toml"
init_direct "$RECEIPT" receipt-task
"${SELECTOR[@]}" close --file "$RECEIPT" >/dev/null
grep -q '^value = "receipt_only"$' "$RECEIPT"
grep -q '^reason = "routine_direct_execute"$' "$RECEIPT"
"${SELECTOR[@]}" validate --file "$RECEIPT" --strict >/dev/null
"${SELECTOR[@]}" doctor --root "$TMP_DIR" --tasks-dir receipt --strict >"$TMP_DIR/receipt-doctor.out"
grep -q 'ok: no selector doctor findings' "$TMP_DIR/receipt-doctor.out"

AUDIT="$TMP_DIR/audit/skill-usage.toml"
init_direct "$AUDIT" audit-task
add_complete_episode "$AUDIT"
"${SELECTOR[@]}" close --file "$AUDIT" --disposition audit_sample >/dev/null
grep -q '^value = "audit_sample"$' "$AUDIT"
grep -q '^reason = "operator_selected_audit_sample"$' "$AUDIT"
"${SELECTOR[@]}" validate --file "$AUDIT" --strict >/dev/null
audit_checksum="$(shasum -a 256 "$AUDIT" | awk '{print $1}')"
"${SELECTOR[@]}" close --file "$AUDIT" >/dev/null
test "$audit_checksum" = "$(shasum -a 256 "$AUDIT" | awk '{print $1}')"
if "${SELECTOR[@]}" close --file "$AUDIT" --disposition receipt_only >/dev/null 2>"$TMP_DIR/audit-rewrite.err"; then
  echo "error: selector rewrote a terminal audit disposition" >&2
  exit 1
fi
grep -q 'already closed as audit_sample' "$TMP_DIR/audit-rewrite.err"
test "$audit_checksum" = "$(shasum -a 256 "$AUDIT" | awk '{print $1}')"

python3 - "$AUDIT" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
path.write_text(text.replace('reason = "operator_selected_audit_sample"', 'reason = "routine_direct_execute"'), encoding="utf-8")
PY
if "${SELECTOR[@]}" validate --file "$AUDIT" --strict >/dev/null 2>"$TMP_DIR/audit-reason.err"; then
  echo "error: selector accepted a hand-edited disposition reason" >&2
  exit 1
fi
grep -q 'episode_disposition.reason must equal deterministic close reason' "$TMP_DIR/audit-reason.err"

COMPARE="$TMP_DIR/compare/skill-usage.toml"
"${SELECTOR[@]}" init --file "$COMPARE" --task-id compare-task --objective "compare route" --owner validator >/dev/null
"${SELECTOR[@]}" preflight \
  --file "$COMPARE" \
  --answer yes \
  --decision compare_then_execute \
  --status in_progress >/dev/null
expect_full_required "$COMPARE" route_compare_then_execute
add_complete_episode "$COMPARE"
"${SELECTOR[@]}" close --file "$COMPARE" >/dev/null
grep -q '^value = "full_episode"$' "$COMPARE"
grep -q 'route_compare_then_execute' "$COMPARE"
"${SELECTOR[@]}" validate --file "$COMPARE" --strict >/dev/null

for route in compose_then_execute review_loop; do
  file="$TMP_DIR/$route/skill-usage.toml"
  "${SELECTOR[@]}" init --file "$file" --task-id "${route//_/-}-task" --objective "$route" --owner validator >/dev/null
  "${SELECTOR[@]}" preflight --file "$file" --answer yes --decision "$route" --status in_progress >/dev/null
  expect_full_required "$file" "route_$route"
done

FAILURE="$TMP_DIR/failure/skill-usage.toml"
init_direct "$FAILURE" failure-task
"${SELECTOR[@]}" plan \
  --file "$FAILURE" --skill-id bagakit-skill-selector --kind local \
  --source skills/harness/bagakit-skill-selector --why "failure proof" \
  --expected-impact "exercise escalation" --availability available >/dev/null
"${SELECTOR[@]}" usage \
  --file "$FAILURE" --skill-id bagakit-skill-selector --phase execution \
  --action "failed direct route" --result failed >/dev/null
expect_full_required "$FAILURE" usage_failure_or_partial

RETRY="$TMP_DIR/retry/skill-usage.toml"
init_direct "$RETRY" retry-task
add_complete_episode "$RETRY"
"${SELECTOR[@]}" usage \
  --file "$RETRY" --skill-id bagakit-skill-selector --phase execution \
  --attempt-key "repeat-success" --action "completed the selected direct route" \
  --result success --evidence gate_validation/skills/harness/bagakit-skill-selector/check-selector-disposition.sh >/dev/null
"${SELECTOR[@]}" usage \
  --file "$RETRY" --skill-id bagakit-skill-selector --phase execution \
  --attempt-key "repeat-success" --action "completed the selected direct route" \
  --result success --evidence gate_validation/skills/harness/bagakit-skill-selector/check-selector-disposition.sh >/dev/null
expect_full_required "$RETRY" retry

FEEDBACK="$TMP_DIR/feedback/skill-usage.toml"
init_direct "$FEEDBACK" feedback-task
"${SELECTOR[@]}" plan \
  --file "$FEEDBACK" --skill-id bagakit-skill-selector --kind local \
  --source skills/harness/bagakit-skill-selector --why "feedback proof" \
  --expected-impact "exercise escalation" --availability available >/dev/null
"${SELECTOR[@]}" feedback \
  --file "$FEEDBACK" --skill-id bagakit-skill-selector --channel user \
  --signal positive --detail "explicit user feedback" >/dev/null
expect_full_required "$FEEDBACK" explicit_feedback

RESULT="$TMP_DIR/result/skill-usage.toml"
init_direct "$RESULT" result-task
"${SELECTOR[@]}" plan \
  --file "$RESULT" --skill-id bagakit-skill-selector --kind local \
  --source skills/harness/bagakit-skill-selector --why "candidate result proof" \
  --expected-impact "exercise escalation" --availability available >/dev/null
"${SELECTOR[@]}" candidate-result \
  --file "$RESULT" --result-id selector-result --candidate-id bagakit-skill-selector \
  --result-status success --verification-ref gate_validation/skills/harness/bagakit-skill-selector/check-selector-disposition.sh >/dev/null
expect_full_required "$RESULT" candidate_result

SIGNAL="$TMP_DIR/signal/skill-usage.toml"
init_direct "$SIGNAL" signal-task
"${SELECTOR[@]}" task-signal \
  --file "$SIGNAL" --signal-id workflow-friction --kind workflow_friction \
  --summary "material workflow signal" \
  --evidence-ref gate_validation/skills/harness/bagakit-skill-selector/check-selector-disposition.sh >/dev/null
expect_full_required "$SIGNAL" task_signal

echo "ok: selector close derives selective persistence and rejects shallow material episodes"
