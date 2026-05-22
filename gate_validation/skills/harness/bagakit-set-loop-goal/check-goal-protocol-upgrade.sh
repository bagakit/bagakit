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
trap 'rm -rf "$tmp"' EXIT

write_legacy_goal() {
  local path="$1" goal_id="$2" title="$3" status="$4"
  mkdir -p "$(dirname "$path")"
  cat >"$path" <<EOF
---
schema: bagakit.loop-goal.v1
protocol_version: bagakit.goal.v.0.2
goal_id: $goal_id
status: $status
truth_surface: .bagakit/goal/$goal_id.md
completion_evidence: []
---

# Goal: $title

## Prime Directive
Deliver the promised $title outcome.

## Current State
- Last known progress: legacy execution is in progress.

## Execution Principles
- Preserve the promised behavior and evidence bar.

## Acceptance And Stop Rules
- Acceptance: observable owner evidence proves the complete outcome.
- Insufficient: a plan or partial implementation does not count.

## Orchestration Index
- Feature truth: not yet migrated.

## Next Execution Instruction
Continue from the legacy live state.

## Recent Decisions
- Preserve the original outcome.

## Open Questions
- Which current task should run next?
EOF
}

write_migration_receipt() {
  local repo="$1" goal_id="$2" owner_ref="$3" receipt_ref="$4"
  python3 - "$repo" "$goal_id" "$owner_ref" "$receipt_ref" <<'PY'
from pathlib import Path, PurePosixPath
import hashlib
import json
import sys
import yaml

root = Path(sys.argv[1])
goal_id = sys.argv[2]
owner_ref = sys.argv[3]
receipt_ref = sys.argv[4]
goal_ref = f".bagakit/goal/{goal_id}.md"
goal_path = root / goal_ref
text = goal_path.read_text(encoding="utf-8")
frontmatter = yaml.safe_load(text.split("---", 2)[1])
body = text.split("---", 2)[2]

sections = {}
heading = None
buffer = []
for line in body.splitlines():
    if line.startswith("## "):
        if heading is not None:
            sections[heading] = "\n".join(buffer).strip()
        heading = line[3:].strip()
        buffer = []
    elif heading is not None:
        buffer.append(line)
if heading is not None:
    sections[heading] = "\n".join(buffer).strip()

known_kernel = {
    "Prime Directive",
    "Protected Invariants",
    "Acceptance And Stop Rules",
    "Authority And Orchestration",
    "Context References",
}
migration_sections = {
    name: content
    for name, content in sections.items()
    if name not in known_kernel and name != "Execution Principles" and content
}
if "wait" in frontmatter:
    migration_sections["frontmatter.wait"] = json.dumps(
        frontmatter["wait"], ensure_ascii=False, sort_keys=True
    )

target_ref = str(PurePosixPath(owner_ref) / "tasks.json")
records = {}
for name, content in migration_sections.items():
    promoted = name == "Orchestration Index"
    records[name] = {
        "source_sha256": hashlib.sha256(content.encode()).hexdigest(),
        "disposition": "promoted_to_kernel" if promoted else "migrated_to_owner",
        "target_refs": [] if promoted else [target_ref],
        "kernel_headings": ["Authority And Orchestration"] if promoted else [],
        "rationale": (
            "The legacy orchestration section contains a durable approval boundary."
            if promoted
            else "Current execution truth was distilled into owner-native task state."
        ),
    }

receipt = {
    "schema": "bagakit.goal-owner-migration.v1",
    "goal_id": goal_id,
    "source_protocol": frontmatter.get("protocol_version", "missing"),
    "source_goal_ref": goal_ref,
    "source_sha256": hashlib.sha256(text.encode()).hexdigest(),
    "execution_owner": {
        "kind": "bagakit-feature-tracker",
        "ref": owner_ref,
    },
    "sections": records,
    "kernel_patch": {
        "Protected Invariants": [],
        "Acceptance And Stop Rules": [],
        "Authority And Orchestration": [
            "Ask before publication, authorization changes, or irreversible actions."
        ],
        "Context References": [],
    },
    "unresolved": [],
}
path = root / receipt_ref
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
PY
}

legacy="$tmp/legacy"
write_legacy_goal "$legacy/.bagakit/goal/legacy-goal.md" legacy-goal "Legacy Goal" active
cat >"$legacy/.bagakit/goal/surface.toml" <<'EOF'
protocol_version = "bagakit.goal.v.0.2"
[surface]
id = "bagakit-goal"
owner = "bagakit-set-loop-goal"
kind = "runtime-control"
EOF

inspect_no_owner="$(sh "$cli" inspect-upgrade --root "$legacy")"
python3 - "$inspect_no_owner" <<'PY'
import json
import sys
report = json.loads(sys.argv[1])
conflict = next(item for item in report["conflicts"] if item["kind"] == "missing_execution_owner")
assert report["status"] == "blocked"
assert conflict["route"] == "bagakit-feature-tracker"
assert "Create or update" in report["next_instruction"]
PY
grep -q 'protocol_version: bagakit.goal.v.0.2' "$legacy/.bagakit/goal/legacy-goal.md"

mkdir -p "$legacy/.bagakit/feature-tracker/features/legacy"
printf '{"current_task":"continue legacy execution","decisions":["preserve the original outcome"]}\n' > "$legacy/.bagakit/feature-tracker/features/legacy/tasks.json"
owner_arg='legacy-goal:bagakit-feature-tracker:.bagakit/feature-tracker/features/legacy'

inspect_no_migration="$(sh "$cli" inspect-upgrade --root "$legacy" --execution-owner "$owner_arg")"
python3 - "$inspect_no_migration" <<'PY'
import json
import sys
report = json.loads(sys.argv[1])
assert any(item["kind"] == "execution_truth_migration_required" for item in report["conflicts"])
assert report["status"] == "blocked"
PY

migration_arg='legacy-goal:.bagakit/feature-tracker/features/legacy/goal-migration.json'
printf '{}\n' > "$legacy/.bagakit/feature-tracker/features/legacy/goal-migration.json"
inspect_empty_receipt="$(sh "$cli" inspect-upgrade --root "$legacy" --execution-owner "$owner_arg" --owner-migration-ref "$migration_arg")"
python3 - "$inspect_empty_receipt" <<'PY'
import json
import sys
report = json.loads(sys.argv[1])
assert any(item["kind"] == "invalid_owner_migration_receipt" for item in report["conflicts"])
assert report["status"] == "blocked"
PY
write_migration_receipt \
  "$legacy" \
  legacy-goal \
  .bagakit/feature-tracker/features/legacy \
  .bagakit/feature-tracker/features/legacy/goal-migration.json
python3 - "$legacy/.bagakit/feature-tracker/features/legacy/goal-migration.json" <<'PY'
from pathlib import Path
import json
import sys
path = Path(sys.argv[1])
receipt = json.loads(path.read_text(encoding="utf-8"))
receipt["unresolved"] = ["Decide whether the legacy authorization boundary remains durable."]
path.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
PY
inspect_unresolved="$(sh "$cli" inspect-upgrade --root "$legacy" --execution-owner "$owner_arg" --owner-migration-ref "$migration_arg")"
python3 - "$inspect_unresolved" <<'PY'
import json
import sys
report = json.loads(sys.argv[1])
conflict = next(item for item in report["conflicts"] if item["kind"] == "unresolved_kernel_migration")
assert conflict["route"] == "bagakit-grill"
PY
write_migration_receipt \
  "$legacy" \
  legacy-goal \
  .bagakit/feature-tracker/features/legacy \
  .bagakit/feature-tracker/features/legacy/goal-migration.json
inspect_ready="$(sh "$cli" inspect-upgrade --root "$legacy" --execution-owner "$owner_arg" --owner-migration-ref "$migration_arg")"
python3 - "$inspect_ready" <<'PY'
import json
import sys
report = json.loads(sys.argv[1])
assert report["status"] == "upgrade_required"
assert report["conflicts"] == []
assert any(item["kind"] == "migrate_to_goal_kernel" for item in report["deterministic_actions"])
PY

sh "$cli" upgrade-surface \
  --root "$legacy" \
  --execution-owner "$owner_arg" \
  --owner-migration-ref "$migration_arg" \
  --apply >/dev/null
test "$(sh "$cli" fresh-check --root "$legacy")" = "fresh-executor check passed"

node --experimental-strip-types --input-type=module - "$legacy/.bagakit/goal/surface.toml" <<'JS'
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const parserUrl = pathToFileURL(path.resolve("dev/validator/src/lib/toml.ts")).href;
const { parseTomlFile } = await import(parserUrl);
const surface = parseTomlFile(process.argv[2]);
assert.equal(surface.schema_version, 1);
assert.equal(surface.protocol_version, "bagakit.goal.v.0.3");
assert.equal(surface.surface_id, "goal-runtime");
assert.equal(surface.surface_root, ".bagakit/goal");
assert.equal(surface.owner_kind, "skill");
assert.equal(surface.owner_id, "bagakit-set-loop-goal");
assert.ok(surface.source_of_truth.length > 0);
assert.ok(surface.reviewable_outputs.length > 0);
assert.equal(surface.surface.id, "bagakit-goal");
JS

python3 - "$legacy" <<'PY'
from pathlib import Path
import json
import sys
import yaml

root = Path(sys.argv[1])
goal_root = root / ".bagakit/goal"
goal = (goal_root / "legacy-goal.md").read_text(encoding="utf-8")
legacy = (goal_root / "archive/legacy-goal.pre-v0.3.md").read_text(encoding="utf-8")
state = yaml.safe_load((goal_root / "state.yaml").read_text(encoding="utf-8"))
events = [json.loads(line) for line in (goal_root / "events/legacy-goal.jsonl").read_text(encoding="utf-8").splitlines()]

assert "protocol_version: bagakit.goal.v.0.3" in goal
assert "## Protected Invariants" in goal
assert "## Context References" in goal
assert "Ask before publication, authorization changes, or irreversible actions." in goal
for heading in ("Current State", "Next Execution Instruction", "Recent Decisions", "Open Questions", "Orchestration Index"):
    assert f"## {heading}" not in goal
assert "## Current State" in legacy
owner = {"kind": "bagakit-feature-tracker", "ref": ".bagakit/feature-tracker/features/legacy"}
assert state["goals"]["legacy-goal"]["execution_owner"] == owner
assert events == [{
    "control_effect": "none",
    "event_id": "e-000001",
    "evidence_refs": [".bagakit/goal/legacy-goal.md"],
    "goal_id": "legacy-goal",
    "kind": "goal_upgraded",
    "owner": "bagakit-set-loop-goal",
    "schema": "bagakit.goal-event.v1",
    "seq": 1,
    "summary": "Upgraded Goal control plane to bagakit.goal.v.0.3.",
}]
PY

repeat="$(sh "$cli" inspect-upgrade --root "$legacy")"
python3 - "$repeat" <<'PY'
import json
import sys
report = json.loads(sys.argv[1])
assert report["status"] == "current"
assert report["deterministic_actions"] == []
assert report["conflicts"] == []
PY

mkdir -p "$legacy/.bagakit/feature-tracker/features/wrong-owner"
python3 - "$legacy/.bagakit/goal/state.yaml" <<'PY'
from pathlib import Path
import sys
import yaml

path = Path(sys.argv[1])
state = yaml.safe_load(path.read_text(encoding="utf-8"))
state["goals"]["legacy-goal"]["execution_owner"] = {
    "kind": "bagakit-feature-tracker",
    "ref": ".bagakit/feature-tracker/features/wrong-owner",
}
path.write_text(yaml.safe_dump(state, sort_keys=False), encoding="utf-8")
PY
owner_drift="$(sh "$cli" inspect-upgrade --root "$legacy")"
python3 - "$owner_drift" <<'PY'
import json
import sys
report = json.loads(sys.argv[1])
assert report["status"] == "upgrade_required"
assert any(item["kind"] == "rewrite_state_registry" for item in report["deterministic_actions"])
PY
driver_drift="$(sh "$cli" driver-report --root "$legacy" --json)"
python3 - "$driver_drift" <<'PY'
import json
import sys
report = json.loads(sys.argv[1])
assert report["status"] == "upgrade_required"
assert report["alerts"][0]["id"] == "upgrade_required"
PY
sh "$cli" upgrade-surface --root "$legacy" --apply >/dev/null
python3 - "$legacy/.bagakit/goal/state.yaml" <<'PY'
from pathlib import Path
import sys
import yaml
state = yaml.safe_load(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert state["goals"]["legacy-goal"]["execution_owner"]["ref"] == ".bagakit/feature-tracker/features/legacy"
PY

multi="$tmp/multi"
write_legacy_goal "$multi/.bagakit/goal/goal-a.md" goal-a "Goal A" active
write_legacy_goal "$multi/.bagakit/goal/goal-b.md" goal-b "Goal B" active
for goal_id in goal-a goal-b; do
  mkdir -p "$multi/.bagakit/feature-tracker/features/$goal_id"
  printf '{"current_task":"migrated legacy task"}\n' > "$multi/.bagakit/feature-tracker/features/$goal_id/tasks.json"
  write_migration_receipt \
    "$multi" \
    "$goal_id" \
    ".bagakit/feature-tracker/features/$goal_id" \
    ".bagakit/feature-tracker/features/$goal_id/goal-migration.json"
done

if sh "$cli" upgrade-surface \
  --root "$multi" \
  --execution-owner 'goal-a:bagakit-feature-tracker:.bagakit/feature-tracker/features/goal-a' \
  --owner-migration-ref 'goal-a:.bagakit/feature-tracker/features/goal-a/goal-migration.json' \
  --execution-owner 'goal-b:bagakit-feature-tracker:.bagakit/feature-tracker/features/goal-b' \
  --owner-migration-ref 'goal-b:.bagakit/feature-tracker/features/goal-b/goal-migration.json' \
  --apply >/dev/null 2>"$tmp/multi.err"; then
  printf 'upgrade unexpectedly guessed the foreground Goal\n' >&2
  exit 1
fi
python3 - "$multi/.bagakit/goal/upgrade.json" <<'PY'
from pathlib import Path
import json
import sys
report = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert any(item["kind"] == "foreground_selection" and item["route"] == "bagakit-grill" for item in report["conflicts"])
PY

sh "$cli" upgrade-surface \
  --root "$multi" \
  --foreground-goal goal-a \
  --pause-goal goal-b \
  --execution-owner 'goal-a:bagakit-feature-tracker:.bagakit/feature-tracker/features/goal-a' \
  --owner-migration-ref 'goal-a:.bagakit/feature-tracker/features/goal-a/goal-migration.json' \
  --execution-owner 'goal-b:bagakit-feature-tracker:.bagakit/feature-tracker/features/goal-b' \
  --owner-migration-ref 'goal-b:.bagakit/feature-tracker/features/goal-b/goal-migration.json' \
  --apply >/dev/null
test "$(sh "$cli" fresh-check --root "$multi")" = "fresh-executor check passed"

collision="$tmp/collision"
write_legacy_goal "$collision/.bagakit/goal/collision-goal.md" collision-goal "Collision Goal" active
mkdir -p "$collision/.bagakit/feature-tracker/features/collision" "$collision/.bagakit/goal/archive"
printf '{"current_task":"migrated collision task"}\n' > "$collision/.bagakit/feature-tracker/features/collision/tasks.json"
write_migration_receipt \
  "$collision" \
  collision-goal \
  .bagakit/feature-tracker/features/collision \
  .bagakit/feature-tracker/features/collision/goal-migration.json
printf 'different prior snapshot\n' > "$collision/.bagakit/goal/archive/collision-goal.pre-v0.3.md"
if sh "$cli" upgrade-surface \
  --root "$collision" \
  --execution-owner 'collision-goal:bagakit-feature-tracker:.bagakit/feature-tracker/features/collision' \
  --owner-migration-ref 'collision-goal:.bagakit/feature-tracker/features/collision/goal-migration.json' \
  --apply >/dev/null 2>&1; then
  printf 'upgrade unexpectedly ignored a conflicting legacy snapshot\n' >&2
  exit 1
fi
grep -q 'protocol_version: bagakit.goal.v.0.2' "$collision/.bagakit/goal/collision-goal.md"
python3 - "$collision/.bagakit/goal/upgrade.json" <<'PY'
from pathlib import Path
import json
import sys
report = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert any(item["kind"] == "archive_collision" for item in report["conflicts"])
PY

closed="$tmp/closed"
write_legacy_goal "$closed/.bagakit/goal/closed-goal.md" closed-goal "Closed Goal" complete
python3 - "$closed/.bagakit/goal/closed-goal.md" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
path.write_text(text.replace("completion_evidence: []", "completion_evidence:\n  - verification passed"), encoding="utf-8")
PY
mkdir -p "$closed/.bagakit/goal/events"
printf '%s\n' '{"schema":"bagakit.goal-event.v1","seq":1,"event_id":"e-000001","goal_id":"closed-goal","kind":"goal_created","owner":"legacy-goal","summary":"legacy event","evidence_refs":[],"control_effect":"none"}' > "$closed/.bagakit/goal/events/closed-goal.jsonl"
sh "$cli" upgrade-surface --root "$closed" --apply >/dev/null
test ! -e "$closed/.bagakit/goal/events/closed-goal.jsonl"
test -f "$closed/.bagakit/goal/archive/closed-goal.pre-v0.3.events.jsonl"
test -f "$closed/.bagakit/goal/archive/closed-goal.events.jsonl"
test -f "$closed/.bagakit/goal/archive/closed-goal.md"

future="$tmp/future"
write_legacy_goal "$future/.bagakit/goal/future-goal.md" future-goal "Future Goal" active
python3 - "$future/.bagakit/goal/future-goal.md" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
path.write_text(path.read_text(encoding="utf-8").replace("bagakit.goal.v.0.2", "bagakit.goal.v.9.0"), encoding="utf-8")
PY
if sh "$cli" upgrade-surface --root "$future" --apply >/dev/null 2>&1; then
  printf 'upgrade unexpectedly downgraded a future protocol\n' >&2
  exit 1
fi
python3 - "$future/.bagakit/goal/upgrade.json" <<'PY'
from pathlib import Path
import json
import sys
report = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert any(item["kind"] == "unsupported_future_protocol" and item["route"] == "install_newer_skill" for item in report["conflicts"])
PY

printf 'bagakit-set-loop-goal protocol upgrade passed\n'
