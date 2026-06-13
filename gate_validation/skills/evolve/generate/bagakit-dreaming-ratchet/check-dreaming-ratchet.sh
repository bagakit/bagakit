set -euo pipefail
root="."
while [[ $# -gt 0 ]]; do
  case "$1" in
    --root) root="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
cd "$root"
cli="skills/evolve/generate/bagakit-dreaming-ratchet/scripts/bagakit-dreaming-ratchet-cli.sh"
bash "$cli" --help >/dev/null
tmp="$(mktemp -d "${TMPDIR:-/tmp}/bagakit-ratchet.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT
printf 'previous\n' > "$tmp/rollback"
cat > "$tmp/candidate.json" <<EOF
{"candidate_id":"candidate","changed_object":"skill","artifact_digest":"sha256:artifact","analysis_id":"sha256:analysis","source_digest":"sha256:source","baseline_id":"baseline","rollback_ref":"$tmp/rollback","evaluator_id":"tests-v1","environment_digest":"sha256:env","seed_policy":"fixed","holdout_access":false,"required_splits":["dream","holdout"]}
EOF
cat > "$tmp/replay.json" <<'EOF'
{"schema":"bagakit.replay-receipt.v1","candidates":["baseline","candidate"],"baseline_id":"baseline","manifest":"manifest.json","manifest_source_digest":"sha256:source","summary":{"baseline":{"dream":{"mean_score":0.4},"holdout":{"mean_score":0.4}},"candidate":{"dream":{"mean_score":0.5},"holdout":{"mean_score":0.6}}},"protected_episodes":["h"],"protected_retention":{"baseline":{"expected":1,"actual":1,"regressions":[]},"candidate":{"expected":1,"actual":1,"regressions":[]}},"errors":[],"warnings":[]}
EOF
python3 skills/evolve/generate/bagakit-dreaming-ratchet/scripts/ratchet.py "$tmp/candidate.json" "$tmp/replay.json" "$tmp/accepted.json" >/dev/null
python3 - "$tmp/accepted.json" <<'PY'
import json, sys
assert json.load(open(sys.argv[1], encoding="utf-8"))["status"] == "accepted"
PY
sed 's#"rollback_ref":"[^"]*"#"rollback_ref":"missing"#' "$tmp/candidate.json" > "$tmp/no-rollback.json"
if python3 skills/evolve/generate/bagakit-dreaming-ratchet/scripts/ratchet.py "$tmp/no-rollback.json" "$tmp/replay.json" "$tmp/proposed.json" >/dev/null 2>&1; then
  echo "error: missing rollback accepted" >&2; exit 1
fi
echo "ok: bagakit-dreaming-ratchet contract passed"
