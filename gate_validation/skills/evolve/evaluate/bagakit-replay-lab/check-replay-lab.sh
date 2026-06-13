set -euo pipefail
root="."
while [[ $# -gt 0 ]]; do
  case "$1" in
    --root) root="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
cd "$root"
cli="skills/evolve/evaluate/bagakit-replay-lab/scripts/bagakit-replay-lab-cli.sh"
bash "$cli" --help >/dev/null
tmp="$(mktemp -d "${TMPDIR:-/tmp}/bagakit-replay-lab.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT
cat > "$tmp/manifest.json" <<'EOF'
{"source_digest":"sha256:source","splits":{"dream":["d"],"holdout":["h"],"fresh":[]},"protected_episodes":["h"]}
EOF
cat > "$tmp/results.jsonl" <<'EOF'
{"candidate_id":"baseline","episode_id":"d","split":"dream","score":0.4,"evaluator":"tests-v1","seed":1}
{"candidate_id":"candidate","episode_id":"d","split":"dream","score":0.5,"evaluator":"tests-v1","seed":1}
{"candidate_id":"baseline","episode_id":"h","split":"holdout","score":0.4,"evaluator":"tests-v1","seed":1}
{"candidate_id":"candidate","episode_id":"h","split":"holdout","score":0.6,"evaluator":"tests-v1","seed":1}
EOF
python3 skills/evolve/evaluate/bagakit-replay-lab/scripts/replay_eval.py "$tmp/results.jsonl" "$tmp/out.json" --manifest "$tmp/manifest.json" >/dev/null
python3 - "$tmp/out.json" <<'PY'
import json, sys
receipt = json.load(open(sys.argv[1], encoding="utf-8"))
assert receipt["decision_hint"] == "improves"
assert receipt["protected_retention"]["candidate"]["actual"] == 1
PY
sed 's/"score":0.6/"score":NaN/' "$tmp/results.jsonl" > "$tmp/nan.jsonl"
if python3 skills/evolve/evaluate/bagakit-replay-lab/scripts/replay_eval.py "$tmp/nan.jsonl" "$tmp/nan.json" --manifest "$tmp/manifest.json" >/dev/null 2>&1; then
  echo "error: non-finite score accepted" >&2; exit 1
fi
python3 - "$tmp/results.jsonl" "$tmp/drift.jsonl" <<'PY'
import json, sys
rows = [json.loads(line) for line in open(sys.argv[1], encoding="utf-8") if line.strip()]
rows[1]["evaluator"] = "other"
with open(sys.argv[2], "w", encoding="utf-8") as handle:
    for row in rows:
        handle.write(json.dumps(row) + "\n")
PY
if python3 skills/evolve/evaluate/bagakit-replay-lab/scripts/replay_eval.py "$tmp/drift.jsonl" "$tmp/drift.json" --manifest "$tmp/manifest.json" >/dev/null 2>&1; then
  echo "error: evaluator drift accepted" >&2; exit 1
fi
echo "ok: bagakit-replay-lab contract passed"
