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
SKILL_DIR="$ROOT/skills/harness/bagakit-feature-tracker"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

git -C "$TMP_DIR" init -q -b main
git -C "$TMP_DIR" config user.name "Bagakit"
git -C "$TMP_DIR" config user.email "bagakit@example.com"
printf '# demo\n' > "$TMP_DIR/README.md"
git -C "$TMP_DIR" add README.md
git -C "$TMP_DIR" commit -q -m "init"

bash "$SKILL_DIR/scripts/feature-tracker.sh" check-reference-readiness --root "$TMP_DIR" >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" initialize-tracker --root "$TMP_DIR"
ISSUER_NAMESPACE_BEFORE="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

issuer_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "local" / "issuer.json"
payload = json.loads(issuer_path.read_text(encoding="utf-8"))
print(payload["namespace"])
PY
)"
bash "$SKILL_DIR/scripts/feature-tracker.sh" rekey-local-issuer --root "$TMP_DIR" >/dev/null
ISSUER_NAMESPACE_AFTER="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

issuer_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "local" / "issuer.json"
payload = json.loads(issuer_path.read_text(encoding="utf-8"))
print(payload["namespace"])
PY
)"
test "$ISSUER_NAMESPACE_BEFORE" != "$ISSUER_NAMESPACE_AFTER"
bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Demo feature" --slug "demo-feature" --goal "Ship demo" --workspace-mode proposal_only

FEATURE_ID="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
items = payload.get("features")
if not isinstance(items, list):
    raise SystemExit("missing features array")
print(items[0]["feat_id"])
PY
)"

HANDOFF_JSON="$TMP_DIR/.bagakit/planning-entry/handoffs/demo-approved.json"
mkdir -p "$(dirname "$HANDOFF_JSON")"
cat >"$HANDOFF_JSON" <<'JSON'
{
  "schema": "bagakit/planning-entry-handoff/v1",
  "handoff_id": "peh-demo-approved",
  "status": "approved",
  "producer_surface": "bagakit-brainstorm",
  "title": "Handoff feature",
  "goal": "Materialize approved planning-entry handoff into canonical tracker truth",
  "objective": "Turn one approved planning-entry handoff into tracker state without scraping brainstorm prose.",
  "demand_summary": "The request was clarified upstream and is ready for canonical feature planning.",
  "success_criteria": [
    "A new tracker feature is created from the approved handoff."
  ],
  "constraints": [
    "Do not create a second planning SSOT."
  ],
  "clarification_status": "complete",
  "discussion_clear": true,
  "user_review_status": "approved",
  "recommended_route": {
    "scene": "ambiguous_delivery",
    "recipe_id": "planning-entry-brainstorm-to-feature"
  },
  "source_artifacts": [
    ".bagakit/brainstorm/archive/demo/input_and_qa.md",
    ".bagakit/brainstorm/archive/demo/expert_forum.md",
    ".bagakit/brainstorm/archive/demo/outcome_and_handoff.md"
  ],
  "source_refs": [
    "input_and_qa.md#Q-001",
    "expert_forum.md#Decision-Target-And-Exit",
    "outcome_and_handoff.md#Outcome-Summary"
  ]
}
JSON

bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature-from-planning-entry-handoff --root "$TMP_DIR" --handoff "$HANDOFF_JSON" --workspace-mode proposal_only >/dev/null

python3 - "$TMP_DIR" "$HANDOFF_JSON" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
handoff_path = Path(sys.argv[2])
index_path = root / ".bagakit" / "feature-tracker" / "index" / "features.json"
payload = json.loads(index_path.read_text(encoding="utf-8"))
features = payload.get("features")
if not isinstance(features, list):
    raise SystemExit("missing features array")
assert len(features) == 2
match = next(item for item in features if item["title"] == "Handoff feature")
feat_id = match["feat_id"]
proposal_path = root / ".bagakit" / "feature-tracker" / "features" / feat_id / "proposal.md"
proposal_text = proposal_path.read_text(encoding="utf-8")
state_path = root / ".bagakit" / "feature-tracker" / "features" / feat_id / "state.json"
state_payload = json.loads(state_path.read_text(encoding="utf-8"))
assert handoff_path.exists()
assert proposal_path.exists()
assert "peh-demo-approved" in proposal_text
assert "The request was clarified upstream and is ready for canonical feature planning." in proposal_text
assert "planning-entry-brainstorm-to-feature" in proposal_text
assert "## Principle Layer" in proposal_text
assert "- What: Turn one approved planning-entry handoff into tracker state without scraping brainstorm prose." in proposal_text
assert "- Why: The request was clarified upstream and is ready for canonical feature planning." in proposal_text
assert "## Transfer Checks" in proposal_text
assert any(item.get("action") == "planning_entry_handoff_applied" for item in state_payload.get("history", []))
PY

python3 - "$TMP_DIR" "$FEATURE_ID" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
feature_id = sys.argv[2]
dag_path = root / ".bagakit" / "feature-tracker" / "index" / "FEATURES_DAG.json"
dag_payload = json.loads(dag_path.read_text(encoding="utf-8"))
assert feature_id in [item["feat_id"] for item in dag_payload["features"]]
assert any(feature_id in layer["feat_ids"] for layer in dag_payload["layers"])
PY

bash "$SKILL_DIR/scripts/feature-tracker.sh" assign-feature-workspace --root "$TMP_DIR" --feature "$FEATURE_ID" --workspace-mode current_tree
bash "$SKILL_DIR/scripts/feature-tracker.sh" start-task --root "$TMP_DIR" --feature "$FEATURE_ID" --task T-001
bash "$SKILL_DIR/scripts/feature-tracker.sh" show-feature-status --root "$TMP_DIR" --feature "$FEATURE_ID" --json >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" list-features --root "$TMP_DIR" >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" replan-features --root "$TMP_DIR" --json >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" validate-tracker --root "$TMP_DIR" >/dev/null

python3 - "$TMP_DIR" "$FEATURE_ID" <<'PY'
import json
import re
import sys
from pathlib import Path
import subprocess

root = Path(sys.argv[1])
feature_id = sys.argv[2]

if not re.fullmatch(r"f-[23456789abcdefghjkmnpqrstuvwxyz]{9}", feature_id):
    raise SystemExit(f"unexpected feature id shape: {feature_id}")

index_path = root / ".bagakit" / "feature-tracker" / "index" / "features.json"
state_path = root / ".bagakit" / "feature-tracker" / "features" / feature_id / "state.json"
tasks_path = root / ".bagakit" / "feature-tracker" / "features" / feature_id / "tasks.json"
dag_path = root / ".bagakit" / "feature-tracker" / "index" / "FEATURES_DAG.json"
issuer_path = root / ".bagakit" / "feature-tracker" / "local" / "issuer.json"
feature_dir = root / ".bagakit" / "feature-tracker" / "features" / feature_id

index_payload = json.loads(index_path.read_text(encoding="utf-8"))
state_payload = json.loads(state_path.read_text(encoding="utf-8"))
tasks_payload = json.loads(tasks_path.read_text(encoding="utf-8"))
dag_payload = json.loads(dag_path.read_text(encoding="utf-8"))
issuer_payload = json.loads(issuer_path.read_text(encoding="utf-8"))

assert "updated_at" not in index_payload
assert index_payload["feature_id_issuance"]["scheme"] == "feature-tracker-id-v1-c3n2g4"
assert isinstance(index_payload["feature_id_issuance"]["next_cursor"], int)
assert "generated_at" not in dag_payload
assert sorted(dag_payload.keys()) == ["features", "generated_by", "layers", "notes", "version"]
assert "execution_mode" not in dag_payload
assert "max_parallel" not in dag_payload
assert "parallel_recommendation" not in dag_payload
assert "first_unfinished_layer" not in dag_payload
assert "created_at" not in state_payload
assert "updated_at" not in state_payload
assert "archived_at" not in state_payload
assert "discarded_at" not in state_payload
assert "last_checked_at" not in state_payload["gate"]
assert all("at" not in item for item in state_payload.get("history", []))
assert not (feature_dir / "tasks.md").exists()
assert not (feature_dir / "artifacts").exists()
assert not (feature_dir / "proposal.md").exists()
assert not (feature_dir / "spec-delta.md").exists()
assert not (feature_dir / "verification.md").exists()
task = tasks_payload["tasks"][0]
for key in ("last_gate_at", "started_at", "finished_at", "updated_at"):
    assert key not in task
assert issuer_payload["namespace"] == feature_id[5:7]
assert issuer_payload["guard_key_source"] == "git-config:bagakit.feature-tracker.guard-key"

guard_key = subprocess.run(
    ["git", "-C", str(root), "config", "--local", "--get", "bagakit.feature-tracker.guard-key"],
    check=True,
    text=True,
    capture_output=True,
).stdout.strip()
assert re.fullmatch(r"[23456789abcdefghjkmnpqrstuvwxyz]{12}", guard_key)

check_ignore = subprocess.run(
    ["git", "-C", str(root), "check-ignore", ".bagakit/feature-tracker/local/issuer.json"],
    check=False,
    text=True,
    capture_output=True,
)
assert check_ignore.returncode == 0
PY

bash "$SKILL_DIR/scripts/feature-tracker.sh" materialize-feature-artifact --root "$TMP_DIR" --feature "$FEATURE_ID" --kind proposal >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" materialize-feature-artifact --root "$TMP_DIR" --feature "$FEATURE_ID" --kind spec-delta >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" materialize-feature-artifact --root "$TMP_DIR" --feature "$FEATURE_ID" --kind verification >/dev/null
test -f "$TMP_DIR/.bagakit/feature-tracker/features/$FEATURE_ID/proposal.md"
test -f "$TMP_DIR/.bagakit/feature-tracker/features/$FEATURE_ID/spec-delta.md"
test -f "$TMP_DIR/.bagakit/feature-tracker/features/$FEATURE_ID/verification.md"

mkdir -p "$TMP_DIR/.bagakit/feature-tracker/test-bin"
printf 'exit 0\n' > "$TMP_DIR/.bagakit/feature-tracker/test-bin/ok.sh"
python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

policy_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "runtime-policy.json"
policy = json.loads(policy_path.read_text(encoding="utf-8"))
policy.setdefault("gate", {})["project_type"] = "other"
policy.setdefault("gate", {})["non_ui_commands"] = ["sh .bagakit/feature-tracker/test-bin/ok.sh"]
policy_path.write_text(json.dumps(policy, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
PY
bash "$SKILL_DIR/scripts/feature-tracker.sh" run-task-gate --root "$TMP_DIR" --feature "$FEATURE_ID" --task T-001 >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" finish-task --root "$TMP_DIR" --feature "$FEATURE_ID" --task T-001 --result done >/dev/null

python3 - "$TMP_DIR" "$FEATURE_ID" "$SKILL_DIR" <<'PY'
import json
import subprocess
import sys
from pathlib import Path

root = Path(sys.argv[1])
feature_id = sys.argv[2]
script = Path(sys.argv[3]) / "scripts" / "feature-tracker.sh"

def run_json(*args):
    cp = subprocess.run(["bash", str(script), *args], check=True, text=True, capture_output=True)
    return json.loads(cp.stdout)

active = run_json("list-features", "--root", str(root))
assert feature_id in [item["feat_id"] for item in active["features"]]
assert {item["scope"] for item in active["features"]} == {"active"}
target = next(item for item in active["features"] if item["feat_id"] == feature_id)
assert target["status"] == "done"

done_active = run_json("filter-features", "--root", str(root), "--status", "done")
assert [item["feat_id"] for item in done_active["features"]] == [feature_id]

archived_default = run_json("filter-features", "--root", str(root), "--status", "archived")
assert archived_default["features"] == []
PY

bash "$SKILL_DIR/scripts/feature-tracker.sh" diagnose-tracker --root "$TMP_DIR" >"$TMP_DIR/doctor-active-done.out"
grep -F "$FEATURE_ID: status=done remains active; run archive-feature" "$TMP_DIR/doctor-active-done.out" >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" archive-feature --root "$TMP_DIR" --feature "$FEATURE_ID" >/dev/null

DISCARD_FEATURE_ID="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
features = json.loads(index_path.read_text(encoding="utf-8"))["features"]
print(next(item["feat_id"] for item in features if item["title"] == "Handoff feature"))
PY
)"
bash "$SKILL_DIR/scripts/feature-tracker.sh" discard-feature --root "$TMP_DIR" --feature "$DISCARD_FEATURE_ID" --reason cancelled >/dev/null

python3 - "$TMP_DIR" "$FEATURE_ID" "$DISCARD_FEATURE_ID" "$SKILL_DIR" <<'PY'
import json
import subprocess
import sys
from pathlib import Path

root = Path(sys.argv[1])
archived_feature_id = sys.argv[2]
discarded_feature_id = sys.argv[3]
script = Path(sys.argv[4]) / "scripts" / "feature-tracker.sh"

def run_json(*args):
    cp = subprocess.run(["bash", str(script), *args], check=True, text=True, capture_output=True)
    return json.loads(cp.stdout)

default_list = run_json("list-features", "--root", str(root))
assert default_list["features"] == []

archived = run_json("list-features", "--root", str(root), "--scope", "archived")
assert [item["feat_id"] for item in archived["features"]] == [archived_feature_id]
assert archived["features"][0]["scope"] == "archived"

discarded = run_json("list-features", "--root", str(root), "--scope", "discarded")
assert [item["feat_id"] for item in discarded["features"]] == [discarded_feature_id]
assert discarded["features"][0]["scope"] == "discarded"

combined = run_json("list-features", "--root", str(root), "--scope", "active,archived", "--scope", "discarded")
assert [item["feat_id"] for item in combined["features"]] == [archived_feature_id, discarded_feature_id]

archived_filter = run_json("filter-features", "--root", str(root), "--scope", "archived", "--status", "archived")
assert [item["feat_id"] for item in archived_filter["features"]] == [archived_feature_id]

archived_hidden_by_default = run_json("filter-features", "--root", str(root), "--status", "archived")
assert archived_hidden_by_default["features"] == []
PY

mkdir -p "$TMP_DIR/.bagakit/planning-entry/handoffs"
bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature --root "$TMP_DIR" --title "Closeout feature" --slug "closeout-feature" --goal "Exercise closeout command" --workspace-mode current_tree >/dev/null
CLOSEOUT_FEATURE_ID="$(python3 - "$TMP_DIR" <<'PY'
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1]) / ".bagakit" / "feature-tracker" / "index" / "features.json"
features = json.loads(index_path.read_text(encoding="utf-8"))["features"]
print(next(item["feat_id"] for item in features if item["title"] == "Closeout feature"))
PY
)"
bash "$SKILL_DIR/scripts/feature-tracker.sh" start-task --root "$TMP_DIR" --feature "$CLOSEOUT_FEATURE_ID" --task T-001 >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" run-task-gate --root "$TMP_DIR" --feature "$CLOSEOUT_FEATURE_ID" --task T-001 >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" closeout-feature --root "$TMP_DIR" --feature "$CLOSEOUT_FEATURE_ID" --task T-001 >"$TMP_DIR/closeout-plan.out"
grep -F "plan: feature-tracker.sh finish-task" "$TMP_DIR/closeout-plan.out" >/dev/null
grep -F "then: feature-tracker.sh archive-feature" "$TMP_DIR/closeout-plan.out" >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" diagnose-tracker --root "$TMP_DIR" --closeout-plan >"$TMP_DIR/doctor-closeout-plan.out"
grep -F "$CLOSEOUT_FEATURE_ID: task T-001 gate passed; close with" "$TMP_DIR/doctor-closeout-plan.out" >/dev/null
bash "$SKILL_DIR/scripts/feature-tracker.sh" closeout-feature --root "$TMP_DIR" --feature "$CLOSEOUT_FEATURE_ID" --task T-001 --execute >/dev/null
test -f "$TMP_DIR/.bagakit/feature-tracker/features-archived/$CLOSEOUT_FEATURE_ID/summary.md"
python3 - "$TMP_DIR" "$CLOSEOUT_FEATURE_ID" "$SKILL_DIR" <<'PY'
import json
import subprocess
import sys
from pathlib import Path

root = Path(sys.argv[1])
feature_id = sys.argv[2]
script = Path(sys.argv[3]) / "scripts" / "feature-tracker.sh"

def run_json(*args):
    cp = subprocess.run(["bash", str(script), *args], check=True, text=True, capture_output=True)
    return json.loads(cp.stdout)

active = run_json("list-features", "--root", str(root))
assert feature_id not in [item["feat_id"] for item in active["features"]]
archived = run_json("list-features", "--root", str(root), "--scope", "archived")
assert feature_id in [item["feat_id"] for item in archived["features"]]
PY

bash "$SKILL_DIR/scripts/feature-tracker.sh" diagnose-tracker --root "$TMP_DIR" >"$TMP_DIR/doctor-closed.out"
if grep -F "round_count=" "$TMP_DIR/doctor-closed.out" >/dev/null; then
  echo "doctor reported closed feature threshold noise" >&2
  cat "$TMP_DIR/doctor-closed.out" >&2
  exit 1
fi

echo "ok: bagakit-feature-tracker canonical smoke passed"
