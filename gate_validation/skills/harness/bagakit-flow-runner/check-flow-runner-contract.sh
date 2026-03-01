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
CONTRACT_DOC="$ROOT/docs/specs/flow-runner-contract.md"
POLICY_TEMPLATE="$ROOT/skills/harness/bagakit-flow-runner/references/tpl/runner-policy-template.json"
RECIPE_TEMPLATE="$ROOT/skills/harness/bagakit-flow-runner/references/tpl/loop-recipe-template.json"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

git -C "$TMP_DIR" init -q -b main
git -C "$TMP_DIR" config user.name "Bagakit"
git -C "$TMP_DIR" config user.email "bagakit@example.com"
printf '# contract\n' > "$TMP_DIR/README.md"
git -C "$TMP_DIR" add README.md
git -C "$TMP_DIR" commit -q -m "init"

bash "$ROOT/skills/harness/bagakit-flow-runner/scripts/flow-runner.sh" apply --root "$TMP_DIR" --skill-dir "$ROOT/skills/harness/bagakit-flow-runner" >/dev/null

python3 - "$CONTRACT_DOC" "$POLICY_TEMPLATE" "$RECIPE_TEMPLATE" "$TMP_DIR" <<'PY'
import json
import re
import sys
from pathlib import Path

contract_doc = Path(sys.argv[1]).read_text(encoding="utf-8")
policy_template = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
recipe_template = json.loads(Path(sys.argv[3]).read_text(encoding="utf-8"))
tmp_dir = Path(sys.argv[4])

runtime_policy = json.loads((tmp_dir / ".bagakit" / "flow-runner" / "policy.json").read_text(encoding="utf-8"))
runtime_recipe = json.loads((tmp_dir / ".bagakit" / "flow-runner" / "recipe.json").read_text(encoding="utf-8"))

policy_section = re.search(r"## Policy Contract\n(.*?)\n## Recipe Contract", contract_doc, re.S)
recipe_section = re.search(r"## Recipe Contract\n(.*?)\n## Payload Rule", contract_doc, re.S)
assert policy_section
assert recipe_section

policy_bullets = re.findall(r"- `([^`]+)`", policy_section.group(1))
recipe_bullets = re.findall(r"- `([^`]+)`", recipe_section.group(1))

assert policy_template == runtime_policy
assert runtime_policy["schema"] == "bagakit/flow-runner/policy/v2"
assert sorted(runtime_policy.keys()) == ["safety", "schema"]
assert sorted(runtime_policy["safety"].keys()) == [
    "checkpoint_before_stop",
    "persist_state_before_stop",
    "snapshot_before_session",
]
assert "bagakit/flow-runner/policy/v2" in policy_section.group(1)
assert policy_bullets == [
    "safety.snapshot_before_session",
    "safety.checkpoint_before_stop",
    "safety.persist_state_before_stop",
]

assert recipe_template == runtime_recipe
assert runtime_recipe["schema"] == "bagakit/flow-runner/recipe/v2"
assert sorted(runtime_recipe.keys()) == ["recipe_id", "recipe_version", "schema", "stage_chain"]
assert "bagakit/flow-runner/recipe/v2" in recipe_section.group(1)
assert recipe_bullets == [
    "recipe_id",
    "recipe_version",
    "stage_chain[]",
    "stage_key",
    "goal",
]
for stage in runtime_recipe["stage_chain"]:
    assert sorted(stage.keys()) == ["goal", "stage_key"]
PY

echo "ok: bagakit-flow-runner contract templates passed"
