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
EVOLVER_DIR="$ROOT/skills/harness/bagakit-skill-evolver"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

git -C "$TMP_DIR" init -q -b main
git -C "$TMP_DIR" config user.name "Bagakit"
git -C "$TMP_DIR" config user.email "bagakit@example.com"
printf '# demo\n' > "$TMP_DIR/README.md"
git -C "$TMP_DIR" add README.md
git -C "$TMP_DIR" commit -q -m "init"

mkdir -p "$TMP_DIR/docs/specs"
printf 'spec\n' > "$TMP_DIR/docs/specs/demo-rule.md"
printf 'proof\n' > "$TMP_DIR/docs/specs/demo-rule-proof.md"

node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" init-topic --root "$TMP_DIR" --slug demo-evolver --title "Demo Evolver" >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" preflight --root "$TMP_DIR" --topic demo-evolver --decision track --rationale "repo-level learning" >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" add-candidate --root "$TMP_DIR" --topic demo-evolver --candidate c1 --kind local --source skills/harness/demo --summary "candidate" >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" add-source --root "$TMP_DIR" --topic demo-evolver --source-id s1 --kind doc --title "Demo Rule" --origin manual --local-ref docs/specs/demo-rule.md >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" add-feedback --root "$TMP_DIR" --topic demo-evolver --channel maintainer --signal positive --detail "looks reusable" >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" add-benchmark --root "$TMP_DIR" --topic demo-evolver --benchmark b1 --metric report_quality --result pass --detail "report stays concise" >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" record-decision --root "$TMP_DIR" --topic demo-evolver --decision "Promote demo rule" --rationale "holds outside one task" --candidate c1 >/dev/null

if node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" record-promotion --root "$TMP_DIR" --topic demo-evolver --surface spec --target docs/specs/demo-rule.md --summary "land demo rule" --promotion demo-rule --status landed --ref docs/specs/demo-rule.md >/dev/null 2>&1; then
  echo "error: landed promotion unexpectedly accepted without proof refs" >&2
  exit 1
fi

node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" record-promotion --root "$TMP_DIR" --topic demo-evolver --surface spec --target docs/specs/demo-rule.md --summary "land demo rule" --promotion demo-rule --status landed --ref docs/specs/demo-rule.md --proof-refs docs/specs/demo-rule-proof.md >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" set-route --root "$TMP_DIR" --topic demo-evolver --decision upstream --rationale "reusable upstream lesson" --upstream-promotions demo-rule >/dev/null

READINESS_JSON="$TMP_DIR/readiness.json"
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" promotion-readiness --root "$TMP_DIR" --topic demo-evolver --json > "$READINESS_JSON"
python3 - "$READINESS_JSON" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert payload["state"] == "upstream-landed"
assert payload["route_decision"] == "upstream"
assert payload["archive_ready"] is True
assert payload["referenced_promotions"][0]["proof_refs"] == ["docs/specs/demo-rule-proof.md"]
PY

HANDOFF_FILE="$TMP_DIR/.bagakit/evolver/topics/demo-evolver/HANDOFF.md"
test -f "$HANDOFF_FILE"
grep -q "## Strongest Evidence" "$HANDOFF_FILE"
grep -q "## Open Promotion Actions" "$HANDOFF_FILE"

node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" archive-topic --root "$TMP_DIR" --topic demo-evolver --summary "archive the demo evolver topic" >/dev/null
ARCHIVE_FILE="$TMP_DIR/.bagakit/evolver/topics/demo-evolver/ARCHIVE.md"
test -f "$ARCHIVE_FILE"
grep -q "## Promotion Trail" "$ARCHIVE_FILE"
grep -q "docs/specs/demo-rule-proof.md" "$ARCHIVE_FILE"

node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" check --root "$TMP_DIR" >/dev/null

echo "ok: bagakit-skill-evolver canonical smoke passed"
