set -euo pipefail

ROOT="."
while [[ $# -gt 0 ]]; do
  case "$1" in
    --root) ROOT="$2"; shift 2 ;;
    *) echo "unexpected argument: $1" >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$ROOT" && pwd)"
SKILL_DIR="$ROOT/skills/harness/bagakit-feature-tracker"
LIB_DIR="$ROOT/gate_validation/skills/harness/bagakit-feature-tracker/lib"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

source "$LIB_DIR/feature-tracker-testlib.sh"
feature_tracker_init_temp_repo "$TMP_DIR"
bash "$SKILL_DIR/scripts/feature-tracker.sh" check-reference-readiness --root "$TMP_DIR" >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" initialize-tracker --root "$TMP_DIR" >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature \
  --root "$TMP_DIR" \
  --title "Feature-owned Goal" \
  --goal "Keep one durable Agent control contract inside the Feature owner." \
  --workspace-mode proposal_only >/dev/null
FEATURE_ID="$(feature_tracker_feature_id_by_title "$TMP_DIR" "Feature-owned Goal")"
FEATURE_DIR="$TMP_DIR/.bagakit/feature-tracker/features/$FEATURE_ID"
GOAL_FILE="$TMP_DIR/candidate-goal.md"

write_goal() {
  local feature_id="$1" suffix="$2"
  cat >"$GOAL_FILE" <<EOF
# Long-Horizon Control Contract

Contract: \`bagakit.feature-goal.v1\`
Feature: \`$feature_id\`

Use the sibling owner receipt to recover live execution state. This prose is
intentionally not coupled to one canonical heading or line-wrapping template.

## Outcome
Deliver the complete feature outcome and preserve why it matters.$suffix

## Guardrails
- Keep Feature Tracker as the only lifecycle and task owner.
- Non-goal: recreate a separate Goal runtime surface.

## Completion Boundary
- Acceptance: owner evidence proves every reviewed task and the final outcome.
- Insufficient: writing this Goal without executable Feature truth does not count.
- Stop and ask before changing the promised outcome or an irreversible boundary.
EOF
}

write_goal wrong-feature ""
if bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-feature-goal \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --goal-file "$GOAL_FILE" \
  >"$TMP_DIR/wrong.out" 2>"$TMP_DIR/wrong.err"; then
  echo "error: goal candidate with wrong Feature binding unexpectedly passed" >&2
  exit 1
fi
grep -q "must bind Feature" "$TMP_DIR/wrong.err"

write_goal "$FEATURE_ID" ""
bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-feature-goal \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --goal-file "$GOAL_FILE" >/dev/null
set_output="$(bash "$SKILL_DIR/scripts/feature-tracker.sh" set-feature-goal \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --goal-file "$GOAL_FILE" --expected-revision none)"
REVISION_ONE="$(printf '%s\n' "$set_output" | sed -n 's/^revision: //p')"
test "${#REVISION_ONE}" -eq 64

python3 - "$TMP_DIR" "$FEATURE_ID" "$REVISION_ONE" <<'PY'
import hashlib
import json
import sys
from pathlib import Path, PurePosixPath

root = Path(sys.argv[1])
feature_id = sys.argv[2]
revision = sys.argv[3]
feature_dir = root / ".bagakit" / "feature-tracker" / "features" / feature_id
state = json.loads((feature_dir / "state.json").read_text(encoding="utf-8"))
receipt = json.loads((feature_dir / "owner-receipt.json").read_text(encoding="utf-8"))
goal_ref = PurePosixPath(
    ".bagakit", "feature-tracker", "features", feature_id, "goal.md"
).as_posix()
assert state["goal_contract"] == {
    "schema": "bagakit.feature-goal.v1",
    "ref": goal_ref,
    "revision": revision,
}
assert receipt["evidence_refs"][-1] == goal_ref
assert receipt["evidence_hashes"][goal_ref] == hashlib.sha256((root / goal_ref).read_bytes()).hexdigest()
PY

mv "$FEATURE_DIR/owner-receipt.json" "$TMP_DIR/owner-receipt.json"
if bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" \
  >"$TMP_DIR/missing-receipt.out" 2>"$TMP_DIR/missing-receipt.err"; then
  echo "error: tracker unexpectedly accepted a Goal without owner-receipt.json" >&2
  exit 1
fi
grep -q "missing owner-receipt.json" "$TMP_DIR/missing-receipt.err"
mv "$TMP_DIR/owner-receipt.json" "$FEATURE_DIR/owner-receipt.json"

if bash "$SKILL_DIR/scripts/feature-tracker.sh" set-feature-goal \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --goal-file "$GOAL_FILE" --expected-revision none \
  >"$TMP_DIR/stale.out" 2>"$TMP_DIR/stale.err"; then
  echo "error: stale Goal revision unexpectedly succeeded" >&2
  exit 1
fi
grep -q "stale Goal revision" "$TMP_DIR/stale.err"

printf '\nmanual drift\n' >>"$FEATURE_DIR/goal.md"
if bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" \
  >"$TMP_DIR/drift.out" 2>"$TMP_DIR/drift.err"; then
  echo "error: tracker unexpectedly accepted goal.md drift" >&2
  exit 1
fi
grep -Eq "goal_contract.revision drifts|owner receipt drift" "$TMP_DIR/drift.err"

write_goal "$FEATURE_ID" " Reconcile the repaired contract."
repair_output="$(bash "$SKILL_DIR/scripts/feature-tracker.sh" set-feature-goal \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --goal-file "$GOAL_FILE" --expected-revision "$REVISION_ONE")"
REVISION_TWO="$(printf '%s\n' "$repair_output" | sed -n 's/^revision: //p')"
test "$REVISION_TWO" != "$REVISION_ONE"
bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/dev/null

PLAN="$TMP_DIR/reviewed-plan.json"
feature_tracker_write_reviewed_task_plan "$PLAN" "Complete a Feature that owns goal.md."
feature_tracker_complete_reviewed_feature "$TMP_DIR" "$SKILL_DIR" "$FEATURE_ID" "$PLAN"
bash "$SKILL_DIR/scripts/feature-tracker.sh" archive-feature \
  --root "$TMP_DIR" --feature "$FEATURE_ID" >/dev/null

python3 - "$TMP_DIR" "$FEATURE_ID" "$REVISION_TWO" <<'PY'
import hashlib
import json
import sys
from pathlib import Path, PurePosixPath

root = Path(sys.argv[1])
feature_id = sys.argv[2]
revision = sys.argv[3]
feature_dir = root / ".bagakit" / "feature-tracker" / "features-archived" / feature_id
state = json.loads((feature_dir / "state.json").read_text(encoding="utf-8"))
receipt = json.loads((feature_dir / "owner-receipt.json").read_text(encoding="utf-8"))
goal_ref = PurePosixPath(
    ".bagakit", "feature-tracker", "features-archived", feature_id, "goal.md"
).as_posix()
assert (feature_dir / "goal.md").is_file()
assert state["goal_contract"]["ref"] == goal_ref
assert state["goal_contract"]["revision"] == revision
assert receipt["evidence_refs"][-1] == goal_ref
assert receipt["evidence_hashes"][goal_ref] == hashlib.sha256((root / goal_ref).read_bytes()).hexdigest()
assert not (feature_dir / "artifacts" / "closeout-preserved-root" / "goal.md").exists()
PY

bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/dev/null
echo "feature-tracker feature Goal contract passed"
