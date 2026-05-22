set -euo pipefail

root="."
while [[ $# -gt 0 ]]; do
  case "$1" in
    --root) root="$2"; shift 2 ;;
    *) printf 'unknown argument: %s\n' "$1" >&2; exit 2 ;;
  esac
done

cd "$root"
cli="skills/harness/bagakit-set-loop-goal/scripts/bagakit-set-loop-goal-cli.sh"
tmp="$(mktemp -d)"
concurrent_tmp=""
trap 'rm -rf "$tmp" "${concurrent_tmp:-}"' EXIT
fixture="$tmp/repo"

mkdir -p "$fixture/.bagakit/feature-tracker/features/demo"
printf '{"current_task":"task-1"}\n' > "$fixture/.bagakit/feature-tracker/features/demo/tasks.json"

if sh "$cli" upsert-goal \
  --root "$fixture" \
  --goal-id missing-owner \
  --title "Missing Owner" \
  --prime-directive-text "Deliver the outcome." \
  --invariant-line "Preserve the contract." \
  --acceptance-line "Acceptance requires evidence." >/dev/null 2>"$tmp/missing-owner.err"; then
  printf 'upsert-goal unexpectedly accepted a Goal without an execution owner\n' >&2
  exit 1
fi
grep -q 'create a Feature with bagakit-feature-tracker' "$tmp/missing-owner.err"

sh "$cli" upsert-goal \
  --root "$fixture" \
  --goal-id demo-goal \
  --title "Demo Goal" \
  --prime-directive-text "Deliver the demo outcome because restart-safe completion matters." \
  --invariant-line "Preserve the observable behavior contract." \
  --invariant-line "Non-goals: do not replace the target with a partial report." \
  --acceptance-line "Acceptance: owner evidence proves the complete outcome." \
  --acceptance-line "Insufficient: a plan or unverified implementation does not count." \
  --acceptance-line "Stop and ask before irreversible or publication actions." \
  --execution-owner-kind bagakit-feature-tracker \
  --execution-owner-ref .bagakit/feature-tracker/features/demo \
  --context-reference '`docs/specs/example.md`: explains the protected contract; read when acceptance is challenged.' \
  --foreground

test "$(sh "$cli" fresh-check --root "$fixture")" = "fresh-executor check passed"

python3 - "$fixture" <<'PY'
from pathlib import Path
import json
import sys
import yaml

root = Path(sys.argv[1])
goal_root = root / ".bagakit" / "goal"
goal = (goal_root / "demo-goal.md").read_text(encoding="utf-8")
state = yaml.safe_load((goal_root / "state.yaml").read_text(encoding="utf-8"))
current = (goal_root / "current.md").read_text(encoding="utf-8")
events = [json.loads(line) for line in (goal_root / "events/demo-goal.jsonl").read_text(encoding="utf-8").splitlines()]

for heading in (
    "Prime Directive",
    "Protected Invariants",
    "Acceptance And Stop Rules",
    "Authority And Orchestration",
    "Context References",
):
    assert f"## {heading}" in goal
for forbidden in ("## Current State", "## Next Execution Instruction", "## Recent Decisions", "## Open Questions"):
    assert forbidden not in goal
owner = {"kind": "bagakit-feature-tracker", "ref": ".bagakit/feature-tracker/features/demo"}
frontmatter = yaml.safe_load(goal.split("---", 2)[1])
assert frontmatter["protocol_version"] == "bagakit.goal.v.0.3"
assert frontmatter["execution_owner"] == owner
assert state["goals"]["demo-goal"]["execution_owner"] == owner
assert "execution_owner" in current
assert events[0]["kind"] == "goal_created"
PY

wrapper_without="$(sh "$cli" render-wrapper --root "$fixture")"
expected_without="$(cat <<'EOF'
@./.bagakit/goal/current.md
Read current.md first; it resolves state.yaml, foreground_goal, and the active Goal.

Context may be stale or wrong; recover from this file before trusting prior context.
EOF
)"
test "$wrapper_without" = "$expected_without"

sh "$cli" append-goal-event \
  --root "$fixture" \
  --goal-id demo-goal \
  --kind goal_updated \
  --owner goal-supervisor \
  --summary "Owner task truth must absorb a direction-changing finding." \
  --evidence-ref .bagakit/feature-tracker/features/demo/tasks.json \
  --control-effect owner_update_required >/dev/null

if sh "$cli" fresh-check --root "$fixture" >"$tmp/unreconciled.out" 2>&1; then
  printf 'fresh-check unexpectedly accepted an unreconciled control event\n' >&2
  exit 1
fi
grep -q 'unreconciled Goal control events require reconciliation' "$tmp/unreconciled.out"

if sh "$cli" reconcile-goal \
  --root "$fixture" \
  --goal-id demo-goal \
  --owner goal-supervisor \
  --summary "Attempted reconciliation with non-owner evidence." \
  --evidence-ref .bagakit/goal/demo-goal.md >/dev/null 2>"$tmp/outside-owner.err"; then
  printf 'reconcile-goal unexpectedly accepted evidence outside the owner\n' >&2
  exit 1
fi
grep -q 'must live in the execution owner' "$tmp/outside-owner.err"

reconcile_output="$(sh "$cli" reconcile-goal \
  --root "$fixture" \
  --goal-id demo-goal \
  --owner goal-supervisor \
  --summary "Owner task truth now reflects the finding." \
  --evidence-ref .bagakit/feature-tracker/features/demo/tasks.json)"
printf '%s\n' "$reconcile_output" | grep -q '^.bagakit/feature-tracker/features/demo$'
printf '%s\n' "$reconcile_output" | grep -q 'events/demo-goal.jsonl#3'
test "$(sh "$cli" fresh-check --root "$fixture")" = "fresh-executor check passed"

# Coarse waiting status remains schedulable; detailed wait truth stays in owner state.
sh "$cli" upsert-goal \
  --root "$fixture" \
  --goal-id demo-goal \
  --status waiting >/dev/null
python3 - "$fixture/.bagakit/goal/demo-goal.md" <<'PY'
from pathlib import Path
import sys
import yaml

frontmatter = yaml.safe_load(Path(sys.argv[1]).read_text(encoding="utf-8").split("---", 2)[1])
assert frontmatter["status"] == "waiting"
assert "wait" not in frontmatter
PY

mkdir -p "$fixture/.bagakit/feature-tracker/features/second"
printf '{}\n' > "$fixture/.bagakit/feature-tracker/features/second/tasks.json"
sh "$cli" upsert-goal \
  --root "$fixture" \
  --goal-id second-goal \
  --title "Second Goal" \
  --prime-directive-text "Deliver the second outcome." \
  --invariant-line "Preserve the first unfinished Goal." \
  --acceptance-line "Acceptance: second owner evidence proves completion." \
  --execution-owner-kind bagakit-feature-tracker \
  --execution-owner-ref .bagakit/feature-tracker/features/second >/dev/null

sh "$cli" set-foreground --root "$fixture" --goal-id second-goal >/dev/null
python3 - "$fixture/.bagakit/goal/state.yaml" <<'PY'
from pathlib import Path
import sys
import yaml

state = yaml.safe_load(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert state["foreground_goal"] == "second-goal"
assert state["goals"]["demo-goal"]["status"] == "waiting"
assert state["goals"]["demo-goal"]["role"] == "backlog"
assert state["goals"]["second-goal"]["role"] == "foreground"
PY

sh "$cli" set-supervision --root "$fixture" --mode self
wrapper_with="$(sh "$cli" render-wrapper --root "$fixture")"
printf '%s\n' "$wrapper_with" | grep -q '@./.bagakit/goal/current.md'
printf '%s\n' "$wrapper_with" | grep -q '@./.bagakit/goal/supervisor.md'
grep -q 'current supervisor packet and execution evidence' "$fixture/.bagakit/goal/supervisor.md"
test "$(sh "$cli" fresh-check --root "$fixture")" = "fresh-executor check passed"

# Invalid replacement must fail before moving any Goal or event file.
state_hash_before="$(shasum -a 256 "$fixture/.bagakit/goal/state.yaml" | awk '{print $1}')"
current_hash_before="$(shasum -a 256 "$fixture/.bagakit/goal/current.md" | awk '{print $1}')"
goal_hash_before="$(shasum -a 256 "$fixture/.bagakit/goal/second-goal.md" | awk '{print $1}')"
event_hash_before="$(shasum -a 256 "$fixture/.bagakit/goal/events/second-goal.jsonl" | awk '{print $1}')"
if sh "$cli" archive-goal \
  --root "$fixture" \
  --goal-id second-goal \
  --status complete \
  --completion-evidence .bagakit/feature-tracker/features/second/tasks.json \
  --replacement-foreground missing-goal >/dev/null 2>"$tmp/missing-replacement.err"; then
  printf 'archive-goal unexpectedly accepted a missing replacement\n' >&2
  exit 1
fi
grep -q 'replacement foreground goal is not registered' "$tmp/missing-replacement.err"
test "$state_hash_before" = "$(shasum -a 256 "$fixture/.bagakit/goal/state.yaml" | awk '{print $1}')"
test "$current_hash_before" = "$(shasum -a 256 "$fixture/.bagakit/goal/current.md" | awk '{print $1}')"
test "$goal_hash_before" = "$(shasum -a 256 "$fixture/.bagakit/goal/second-goal.md" | awk '{print $1}')"
test "$event_hash_before" = "$(shasum -a 256 "$fixture/.bagakit/goal/events/second-goal.jsonl" | awk '{print $1}')"
test ! -e "$fixture/.bagakit/goal/archive/second-goal.md"

archive_path="$(sh "$cli" archive-goal \
  --root "$fixture" \
  --goal-id second-goal \
  --status complete \
  --completion-evidence .bagakit/feature-tracker/features/second/tasks.json \
  --replacement-foreground demo-goal)"
test "$archive_path" = ".bagakit/goal/archive/second-goal.md"
test -f "$fixture/.bagakit/goal/archive/second-goal.md"
test -f "$fixture/.bagakit/goal/archive/second-goal.events.jsonl"
test ! -e "$fixture/.bagakit/goal/second-goal.md"
test "$(sh "$cli" fresh-check --root "$fixture")" = "fresh-executor check passed"

# Inject a failure after publication begins and prove the rollback helper
# restores updated, created, and deleted paths without leftover temp files.
python3 - \
  "$root/skills/harness/bagakit-set-loop-goal/scripts/bagakit-set-loop-goal.py" \
  "$tmp" <<'PY'
import importlib.util
import sys
from pathlib import Path

module_path = Path(sys.argv[1])
fixture = Path(sys.argv[2]) / "rollback-fixture"
fixture.mkdir()
first = fixture / "first.txt"
created = fixture / "created.txt"
deleted = fixture / "deleted.txt"
last = fixture / "last.txt"
first.write_text("first-before\n", encoding="utf-8")
deleted.write_text("deleted-before\n", encoding="utf-8")

spec = importlib.util.spec_from_file_location("bagakit_set_loop_goal", module_path)
assert spec is not None and spec.loader is not None
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

original_replace = module.os.replace
replace_count = 0

def injected_replace(source, destination):
    global replace_count
    original_replace(source, destination)
    replace_count += 1
    if replace_count == 2:
        raise OSError("injected post-publish failure")

module.os.replace = injected_replace
try:
    module.commit_file_transaction(
        [
            (first, b"first-after\n", 0o644),
            (created, b"created-after\n", 0o644),
            (last, b"last-after\n", 0o644),
        ],
        [deleted],
    )
except SystemExit as exc:
    assert "without publishing partial state" in str(exc)
else:
    raise AssertionError("injected transaction failure unexpectedly succeeded")
finally:
    module.os.replace = original_replace

assert first.read_text(encoding="utf-8") == "first-before\n"
assert not created.exists()
assert deleted.read_text(encoding="utf-8") == "deleted-before\n"
assert not last.exists()
assert not list(fixture.glob(".*.tmp-*"))
PY

# Competing archive commands serialize and publish exactly one closed Goal.
concurrent_tmp="$(mktemp -d)"
concurrent_owner="$concurrent_tmp/.bagakit/feature-tracker/features/concurrent"
mkdir -p "$concurrent_owner"
printf '{}\n' > "$concurrent_owner/tasks.json"
sh "$cli" initialize-surface --root "$concurrent_tmp" >/dev/null
sh "$cli" upsert-goal \
  --root "$concurrent_tmp" \
  --goal-id concurrent-goal \
  --title "Concurrent Goal" \
  --status active \
  --prime-directive-text "Close exactly once under competing archive requests." \
  --invariant-line "Serialize Goal mutation." \
  --acceptance-line "Acceptance: one archive succeeds and one observes closed truth." \
  --execution-owner-kind bagakit-feature-tracker \
  --execution-owner-ref .bagakit/feature-tracker/features/concurrent >/dev/null
set +e
sh "$cli" archive-goal \
  --root "$concurrent_tmp" \
  --goal-id concurrent-goal \
  --status complete \
  --completion-evidence .bagakit/feature-tracker/features/concurrent/tasks.json \
  >"$concurrent_tmp/archive-one.out" 2>"$concurrent_tmp/archive-one.err" &
archive_one_pid=$!
sh "$cli" archive-goal \
  --root "$concurrent_tmp" \
  --goal-id concurrent-goal \
  --status complete \
  --completion-evidence .bagakit/feature-tracker/features/concurrent/tasks.json \
  >"$concurrent_tmp/archive-two.out" 2>"$concurrent_tmp/archive-two.err" &
archive_two_pid=$!
wait "$archive_one_pid"
archive_one_rc=$?
wait "$archive_two_pid"
archive_two_rc=$?
set -e
if [[ $archive_one_rc -eq 0 && $archive_two_rc -eq 0 ]] || [[ $archive_one_rc -ne 0 && $archive_two_rc -ne 0 ]]; then
  printf 'competing archive-goal commands did not produce exactly one success\n' >&2
  exit 1
fi
test -f "$concurrent_tmp/.bagakit/goal/archive/concurrent-goal.md"
test ! -e "$concurrent_tmp/.bagakit/goal/concurrent-goal.md"
test ! -e "$concurrent_tmp/.bagakit/goal/events/concurrent-goal.jsonl"
test -f "$concurrent_tmp/.bagakit/goal/archive/concurrent-goal.events.jsonl"
cat "$concurrent_tmp/archive-one.err" "$concurrent_tmp/archive-two.err" \
  | grep -Eq 'active goal file not found|archived Goal already exists'

printf 'bagakit-set-loop-goal smoke passed\n'
