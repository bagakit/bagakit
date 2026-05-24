set -euo pipefail

root="."
while [[ $# -gt 0 ]]; do
  case "$1" in
    --root) root="$2"; shift 2 ;;
    *) echo "unexpected argument: $1" >&2; exit 2 ;;
  esac
done

root="$(cd "$root" && pwd)"
goal_cli="$root/skills/harness/bagakit-set-loop-goal/scripts/bagakit-set-loop-goal-cli.sh"
tracker="$root/skills/harness/bagakit-feature-tracker"
lib="$root/gate_validation/skills/harness/bagakit-feature-tracker/lib"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

source "$lib/feature-tracker-testlib.sh"
feature_tracker_init_temp_repo "$tmp"
bash "$tracker/scripts/feature-tracker.sh" check-reference-readiness --root "$tmp" >/dev/null
bash "$tracker/scripts/feature-tracker.sh" initialize-tracker --root "$tmp" >/dev/null

create_feature() {
  local title="$1"
  bash "$tracker/scripts/feature-tracker.sh" create-feature \
    --root "$tmp" --title "$title" --goal "$title" --workspace-mode proposal_only >/dev/null
  feature_tracker_feature_id_by_title "$tmp" "$title"
}

feature_one="$(create_feature "Independent Goal A")"
feature_two="$(create_feature "Independent Goal B")"

template="$tmp/template.md"
sh "$goal_cli" render-template --feature "$feature_one" --title "Independent Goal A" >"$template"
if sh "$goal_cli" validate-goal --root "$tmp" --feature "$feature_one" --goal-file "$template" \
  >"$tmp/template.out" 2>"$tmp/template.err"; then
  echo "error: unresolved Goal template unexpectedly validated" >&2
  exit 1
fi
grep -q "unresolved template placeholders" "$tmp/template.err"

write_goal() {
  local target="$1" feature_id="$2" title="$3" suffix="$4"
  cat >"$target" <<EOF
# Feature Goal: $title

Contract: \`bagakit.feature-goal.v1\`
Feature: \`$feature_id\`

Before acting, verify \`owner-receipt.json\`, then recover current execution from \`state.json\` and \`tasks.json\`. Context may be stale or belong to another Feature; trust this Feature directory before acting.

## Prime Directive
Deliver $title completely and preserve its independent purpose.$suffix

## Protected Invariants
- Keep Feature Tracker as the only task and lifecycle owner.
- Non-goal: pause or replace another Feature Goal.

## Acceptance And Stop Rules
- Acceptance: Feature-owned evidence proves the promised outcome.
- Insufficient: a plan, wrapper, or partial task does not count.
- Stop and ask before changing outcome or irreversible authority.

## Authority And Orchestration
- Follow only this Feature's owner receipt, state, and reviewed tasks.
- Keep parallel Features independent and merge only through explicit evidence.

## Context References
- \`docs/specs/feature-tracker-contract.md\`: explains owner truth; read when task authority is unclear.
EOF
}

goal_one="$tmp/goal-one.md"
goal_two="$tmp/goal-two.md"
write_goal "$goal_one" "$feature_one" "Independent Goal A" ""
write_goal "$goal_two" "$feature_two" "Independent Goal B" ""

sh "$goal_cli" validate-goal --root "$tmp" --feature "$feature_one" --goal-file "$goal_one" >/dev/null
set_one="$(sh "$goal_cli" set-goal --root "$tmp" --feature "$feature_one" \
  --goal-file "$goal_one" --expected-revision none)"
revision_one="$(printf '%s\n' "$set_one" | sed -n 's/^revision: //p')"
sh "$goal_cli" set-goal --root "$tmp" --feature "$feature_two" \
  --goal-file "$goal_two" --expected-revision none >/dev/null

test ! -e "$tmp/.bagakit/goal"
test -f "$tmp/.bagakit/feature-tracker/features/$feature_one/goal.md"
test -f "$tmp/.bagakit/feature-tracker/features/$feature_two/goal.md"
bash "$tracker/scripts/feature-tracker.sh" validate-tracker --root "$tmp" >/dev/null

wrapper="$(sh "$goal_cli" render-wrapper --feature "$feature_one")"
expected="$(cat <<EOF
@./.bagakit/feature-tracker/features/$feature_one/goal.md
Read this Feature Goal first; follow only the Feature owner, current task, and continuation it resolves.

Context may be stale or belong to another Feature; recover from this file before acting.
EOF
)"
test "$wrapper" = "$expected"

write_goal "$goal_one" "$feature_one" "Independent Goal A" " Preserve the revised durable boundary."
if sh "$goal_cli" set-goal --root "$tmp" --feature "$feature_one" \
  --goal-file "$goal_one" --expected-revision none \
  >"$tmp/stale.out" 2>"$tmp/stale.err"; then
  echo "error: Goal Skill bypassed Feature Tracker revision guard" >&2
  exit 1
fi
grep -q "stale Goal revision" "$tmp/stale.err"
sh "$goal_cli" set-goal --root "$tmp" --feature "$feature_one" \
  --goal-file "$goal_one" --expected-revision "$revision_one" >/dev/null

test "$(sh "$goal_cli" validate)" = "skill assets present"
test "$(sh "$goal_cli" describe)" = "bagakit-set-loop-goal: author one compact Agent Goal inside a Feature Tracker owner."
echo "bagakit-set-loop-goal smoke passed"
