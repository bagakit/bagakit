set -euo pipefail

root="."

while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      root="$2"
      shift 2
      ;;
    *)
      printf 'unknown argument: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

cd "$root"

cli="skills/harness/bagakit-consensus-ledger/scripts/consensus-ledger.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

bash "$cli" init --root "$tmp" --ledger-id demo --goal "Clarify a shared goal" --success-bar "User confirms the success criteria"
standalone="$tmp/.bagakit/consensus-ledger/ledgers/demo/ledger.json"
bash "$cli" add-dimension --root "$tmp" --ledger .bagakit/consensus-ledger/ledgers/demo/ledger.json --dimension-id success --name "Success Criteria" --why "The task cannot close without a success bar" --current-state partial --risk "False completion" --next-probe "Ask for success boundary"
bash "$cli" add-item --root "$tmp" --ledger .bagakit/consensus-ledger/ledgers/demo/ledger.json --item-id i001 --epistemic-class known_unknown --status proposed --statement "Success criteria need confirmation" --source agent_inference --dimension success --confidence medium
bash "$cli" add-question --root "$tmp" --ledger .bagakit/consensus-ledger/ledgers/demo/ledger.json --question-id q001 --question "Is this the success bar?" --dimension success --decision-protected "closure boundary"
bash "$cli" snapshot --root "$tmp" --ledger .bagakit/consensus-ledger/ledgers/demo/ledger.json --snapshot-id s001 --title "Candidate Consensus" --summary "The success bar is ready for confirmation." --status candidate
bash "$cli" render --root "$tmp" --ledger .bagakit/consensus-ledger/ledgers/demo/ledger.json
bash "$cli" validate --root "$tmp" --ledger .bagakit/consensus-ledger/ledgers/demo/ledger.json

mkdir -p "$tmp/.bagakit/grill/runs/demo"
bash "$cli" init --root "$tmp" --owner-ref .bagakit/grill/runs/demo --owner-skill bagakit-grill --goal "Stress-test a plan"
bash "$cli" add-dimension --root "$tmp" --ledger .bagakit/grill/runs/demo/consensus-ledger.json --dimension-id risk --name "Risk Branches" --why "Grill convergence depends on risk coverage"
bash "$cli" add-item --root "$tmp" --ledger .bagakit/grill/runs/demo/consensus-ledger.json --item-id i002 --epistemic-class unknown_known --status inferred --statement "The plan may hide an untested risk branch" --source agent_inference --dimension risk --evidence-ref tracks/risk-review.md --confidence low
bash "$cli" validate --root "$tmp" --ledger .bagakit/grill/runs/demo/consensus-ledger.json

python3 - "$tmp" <<'PY'
import json
import pathlib
import sys

tmp = pathlib.Path(sys.argv[1])
standalone = json.loads((tmp / ".bagakit/consensus-ledger/ledgers/demo/ledger.json").read_text())
embedded = json.loads((tmp / ".bagakit/grill/runs/demo/consensus-ledger.json").read_text())
view = (tmp / ".bagakit/consensus-ledger/ledgers/demo/ledger.md").read_text()
surface = (tmp / ".bagakit/consensus-ledger/surface.toml").read_text()

assert standalone["schema"] == "bagakit/consensus-ledger/v1"
assert standalone["owner"]["mode"] == "standalone"
assert standalone["status"] == "snapshot_ready"
assert standalone["goal_dimensions"][0]["item_refs"] == ["i001"]
assert standalone["questions"][0]["id"] == "q001"
assert "Consensus Ledger" in view
assert 'owner_id = "bagakit-consensus-ledger"' in surface
assert embedded["owner"]["mode"] == "embedded"
assert embedded["owner"]["owner_skill"] == "bagakit-grill"
assert embedded["epistemic_items"][0]["status"] == "inferred"
PY

printf 'bagakit-consensus-ledger smoke passed\n'
