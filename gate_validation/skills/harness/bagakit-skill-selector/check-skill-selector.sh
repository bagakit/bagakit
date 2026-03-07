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
      cat <<'EOF'
usage: gate_validation/skills/harness/bagakit-skill-selector/check-skill-selector.sh [--root <repo-root>]
EOF
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
TARGET="$TMP_DIR/.bagakit/skill-selector/tasks/demo/skill-usage.toml"
DRIVER_PACK="$TMP_DIR/.bagakit/skill-selector/tasks/demo/bagakit-drivers.md"
RANKING_REPORT="$TMP_DIR/.bagakit/skill-selector/tasks/demo/skill-ranking.md"
EVOLVER_EXPORT="$TMP_DIR/.bagakit/skill-selector/tasks/demo/evolver-signals.json"
SELECTOR_BIN=(node --experimental-strip-types "$ROOT/skills/harness/bagakit-skill-selector/scripts/skill_selector.ts")
EVOLVER_BIN=(node --experimental-strip-types "$ROOT/skills/harness/bagakit-skill-evolver/scripts/evolver.ts")

"${SELECTOR_BIN[@]}" init \
  --file "$TARGET" \
  --task-id "demo-task" \
  --objective "smoke task-level skill selector loop" \
  --owner "validator"

"${SELECTOR_BIN[@]}" preflight \
  --file "$TARGET" \
  --answer partial \
  --gap-summary "need explicit driver loading and retry backoff coverage" \
  --decision "compose_then_execute" \
  --status in_progress

"${SELECTOR_BIN[@]}" recipe \
  --file "$TARGET" \
  --recipe-id "research-to-knowledge" \
  --source "skills/harness/bagakit-skill-selector/recipes/research-to-knowledge.md" \
  --why "need an explicit research-to-knowledge promotion handoff decision" \
  --status selected

"${SELECTOR_BIN[@]}" plan \
  --file "$TARGET" \
  --skill-id "bagakit-skill-selector" \
  --kind local \
  --source "skills/harness/bagakit-skill-selector" \
  --why "validate selector-owned explicit composition entrypoint" \
  --expected-impact "keep coupled harness composition visible and auditable" \
  --composition-role composition_entrypoint \
  --composition-id "knowledge-research-loop" \
  --activation-mode composed

"${SELECTOR_BIN[@]}" plan \
  --file "$TARGET" \
  --skill-id "bagakit-living-knowledge" \
  --kind local \
  --source "skills/harness/bagakit-living-knowledge" \
  --why "provide host-side knowledge substrate inside the composed task loop" \
  --expected-impact "retain local project knowledge while selector orchestrates composition" \
  --composition-role composition_peer \
  --composition-id "knowledge-research-loop" \
  --activation-mode composed \
  --fallback-strategy standalone_first

"${SELECTOR_BIN[@]}" plan \
  --file "$TARGET" \
  --skill-id "bagakit-researcher" \
  --kind local \
  --source "skills/harness/bagakit-researcher" \
  --why "represent the tightly coupled evidence-producing peer in the same task loop" \
  --expected-impact "make evidence production explicit without hard-binding it to living knowledge" \
  --composition-role composition_peer \
  --composition-id "knowledge-research-loop" \
  --activation-mode composed \
  --fallback-strategy standalone_first

"${SELECTOR_BIN[@]}" plan \
  --file "$TARGET" \
  --skill-id "research-benchmark-note" \
  --kind research \
  --source "docs/architecture/B2-behavior-architecture.md" \
  --why "keep one explicit research benchmark candidate in the same loop" \
  --expected-impact "exercise strict benchmark coverage" \
  --selected false

"${SELECTOR_BIN[@]}" usage \
  --file "$TARGET" \
  --skill-id "bagakit-skill-selector" \
  --phase execution \
  --attempt-key "driver-pack-load" \
  --action "loaded selector drivers for the composed task loop" \
  --result partial \
  --evidence "gate_validation/skills/harness/bagakit-skill-selector/check-skill-selector.sh"

"${SELECTOR_BIN[@]}" usage \
  --file "$TARGET" \
  --skill-id "bagakit-skill-selector" \
  --phase execution \
  --attempt-key "driver-pack-load" \
  --action "loaded selector drivers for the composed task loop" \
  --result failed \
  --evidence "gate_validation/skills/harness/bagakit-skill-selector/check-skill-selector.sh"

"${SELECTOR_BIN[@]}" usage \
  --file "$TARGET" \
  --skill-id "bagakit-skill-selector" \
  --phase execution \
  --attempt-key "driver-pack-load" \
  --action "loaded selector drivers for the composed task loop" \
  --result failed \
  --evidence "gate_validation/skills/harness/bagakit-skill-selector/check-skill-selector.sh"

"${SELECTOR_BIN[@]}" error-pattern \
  --file "$TARGET" \
  --error-type "driver_load_failure" \
  --message-pattern "loaded selector drivers for the composed task loop" \
  --skill-id "bagakit-skill-selector" \
  --resolution "switch method after repeated failed driver-pack load" \
  --notes "clustered failure depth should match the two failed attempts"

"${SELECTOR_BIN[@]}" evolver-signal \
  --file "$TARGET" \
  --signal-id "driver-load-review" \
  --kind gotcha \
  --trigger manual_review \
  --skill-id "bagakit-skill-selector" \
  --title "Driver load loop deserves repo review" \
  --summary "selector-visible repeated driver load failures may reflect a reusable repository-level reporting gap" \
  --scope-hint upstream \
  --attempt-key "driver-pack-load" \
  --error-type "driver_load_failure" \
  --occurrence-index 3 \
  --evidence-ref "$TARGET" \
  --notes "manual bridge example for explicit evolver review"

"${SELECTOR_BIN[@]}" feedback \
  --file "$TARGET" \
  --skill-id "bagakit-skill-selector" \
  --channel self_review \
  --signal positive \
  --detail "ranking report should reflect explicit task-local selector feedback" \
  --impact-scope "driver-loading-loop" \
  --confidence high

"${SELECTOR_BIN[@]}" search \
  --file "$TARGET" \
  --reason "retry backoff threshold hit" \
  --query "driver-pack-load alternative strategy" \
  --source-scope local \
  --notes "selector should step back and switch method after try-3"

"${SELECTOR_BIN[@]}" benchmark \
  --file "$TARGET" \
  --benchmark-id "research-loop-smoke" \
  --metric "evidence_quality" \
  --baseline 0.6 \
  --candidate 0.8 \
  --higher-is-better \
  --notes "research composition example includes benchmark coverage"

"${SELECTOR_BIN[@]}" drivers \
  --file "$TARGET" \
  --root "$ROOT" \
  --output "$DRIVER_PACK"

"${SELECTOR_BIN[@]}" skill-ranking \
  --file "$TARGET" \
  --output "$RANKING_REPORT"

"${SELECTOR_BIN[@]}" evolver-export \
  --file "$TARGET" \
  --output "$EVOLVER_EXPORT" \
  --mark-exported

python3 - "$EVOLVER_EXPORT" "$TMP_DIR" "$TARGET" "$RANKING_REPORT" <<'PY'
import json
import sys
from pathlib import Path

export_path = Path(sys.argv[1])
root_path = Path(sys.argv[2])
task_path = Path(sys.argv[3])
ranking_path = Path(sys.argv[4])
payload = json.loads(export_path.read_text(encoding="utf-8"))
assert payload["schema"] == "bagakit.evolver.signal.v1"
assert payload["producer"] == "bagakit-skill-selector"
assert len(payload["signals"]) >= 1
signal_ids = {item["id"] for item in payload["signals"]}
assert "demo-task--driver-load-review" in signal_ids
manual = next(item for item in payload["signals"] if item["id"] == "demo-task--driver-load-review")
assert manual["source_channel"] == "selector"
assert "trigger=manual_review" in manual["evidence"]
assert "scope_hint=upstream" in manual["evidence"]
assert str(task_path.relative_to(root_path)) in manual["local_refs"]
assert str(ranking_path.relative_to(root_path)) in manual["local_refs"]
PY

"${SELECTOR_BIN[@]}" evolver-bridge \
  --file "$TARGET" \
  --root "$TMP_DIR" \
  --output "$EVOLVER_EXPORT" \
  --status exported

"${EVOLVER_BIN[@]}" list-signals --root "$TMP_DIR" --json > "$TMP_DIR/evolver-signals.json"

python3 - "$TMP_DIR/evolver-signals.json" <<'PY'
import json
import sys
from pathlib import Path

signals = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
ids = {item["id"] for item in signals}
assert "demo-task-driver-load-review" in ids
manual = next(item for item in signals if item["id"] == "demo-task-driver-load-review")
assert manual["status"] == "pending"
assert manual["producer"] == "bagakit-skill-selector"
PY

"${SELECTOR_BIN[@]}" evaluate \
  --file "$TARGET" \
  --quality-score 0.78 \
  --evidence-score 0.86 \
  --feedback-score 0.72 \
  --overall conditional_pass \
  --summary "smoke lifecycle passes with explicit retry backoff evidence" \
  --status completed

"${SELECTOR_BIN[@]}" validate \
  --file "$TARGET" \
  --strict

grep -q 'bagakit-researcher' "$TARGET"
grep -q 'recipe_id = "research-to-knowledge"' "$TARGET"
grep -q 'attempt_key = "driver-pack-load"' "$TARGET"
grep -q 'backoff_required = true' "$TARGET"
grep -q 'error_type = "driver_load_failure"' "$TARGET"
grep -q 'occurrence_index = 2' "$TARGET"
grep -q 'needs_new_search = true' "$TARGET"
grep -q '\[\[evolver_signal_log\]\]' "$TARGET"
grep -q 'signal_id = "driver-load-review"' "$TARGET"
grep -q 'status = "imported"' "$TARGET"
grep -q 'bagakit-skill-selector' "$DRIVER_PACK"
grep -q 'bagakit-living-knowledge' "$DRIVER_PACK"
grep -q 'bagakit-researcher' "$DRIVER_PACK"
grep -q 'RetryBackoffThreshold: `3`' "$DRIVER_PACK"
grep -q 'EvolverReview=<pending review signals or none>' "$DRIVER_PACK"
grep -q 'Skill Ranking Report' "$RANKING_REPORT"
grep -q 'bagakit-skill-selector' "$RANKING_REPORT"
grep -q '| 1 | bagakit-skill-selector | 3 | 0.17 | 1.00 | 2 | 0.43 | at_risk |' "$RANKING_REPORT"
grep -q '## Evolver Review Signals' "$RANKING_REPORT"
