set -euo pipefail
root="."
while [[ $# -gt 0 ]]; do
  case "$1" in
    --root) root="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
cd "$root"
cli="skills/evolve/observe/bagakit-session-analysis/scripts/bagakit-session-analysis-cli.sh"
bash "$cli" --help >/dev/null
tmp="$(mktemp -d "${TMPDIR:-/tmp}/bagakit-session-analysis.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT
cat > "$tmp/valid.jsonl" <<'EOF'
{"session_id":"s","episode_id":"e","record_id":"r0","step":0,"action":"start","outcome":"unknown","terminal":false,"alternative_actions":[{"action":"other","candidate_update":{"target":"skill","mechanism":"reduce omission","falsification":"holdout regresses","holdout_plan":"h"}}]}
{"session_id":"s","episode_id":"e","record_id":"r1","step":2,"action":"finish","outcome":"success","terminal":true}
EOF
python3 skills/evolve/observe/bagakit-session-analysis/scripts/analyze_session.py "$tmp/valid.jsonl" "$tmp/out.json" >/dev/null
python3 - "$tmp/out.json" <<'PY'
import json, sys
packet = json.load(open(sys.argv[1], encoding="utf-8"))
assert packet["episodes"][0]["final_outcome"] == "success"
assert packet["candidate_updates"][0]["status"] == "ready"
PY
sed 's/,"terminal":false//' "$tmp/valid.jsonl" > "$tmp/no-terminal.jsonl"
if python3 skills/evolve/observe/bagakit-session-analysis/scripts/analyze_session.py "$tmp/no-terminal.jsonl" "$tmp/no-terminal.json" >/dev/null 2>&1; then
  echo "error: missing terminal accepted" >&2; exit 1
fi
sed 's/"step":2/"step":0/' "$tmp/valid.jsonl" > "$tmp/non-monotonic.jsonl"
if python3 skills/evolve/observe/bagakit-session-analysis/scripts/analyze_session.py "$tmp/non-monotonic.jsonl" "$tmp/non-monotonic.json" >/dev/null 2>&1; then
  echo "error: non-monotonic step accepted" >&2; exit 1
fi
echo "ok: bagakit-session-analysis contract passed"
