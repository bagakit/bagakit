set -euo pipefail

ROOT="."
TMP_ROOT=""
slash="$(printf '\057')"

cleanup() {
  if [[ -n "${TMP_ROOT:-}" && -d "${TMP_ROOT:-}" ]]; then
    rm -rf "$TMP_ROOT"
  fi
}

trap cleanup EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      [[ $# -ge 2 ]] || { echo "missing value for --root" >&2; exit 2; }
      ROOT="$2"
      shift 2
      ;;
    -h|--help)
      cat <<'EOF'
usage: gate_validation/skills/evolve/adapt/bagakit-skill-evolver/check-evolver-state.sh [--root <repo-root>]
EOF
      exit 0
      ;;
    *)
      echo "unexpected argument: $1" >&2
      exit 2
      ;;
  esac
done

ROOT="$(cd "$ROOT" && pwd)"
TMP_BASE="${TMPDIR:-${slash}tmp}"
TMP_ROOT="$(mktemp -d "${TMP_BASE}${slash}bagakit-evolver-check.XXXXXX")"

PASSIVE_ROOT="$TMP_ROOT/passive"
mkdir -p "$PASSIVE_ROOT"
EVOLVER_SCRIPT="$ROOT/skills/evolve/adapt/bagakit-skill-evolver/scripts/evolver.ts"

node --experimental-strip-types "$EVOLVER_SCRIPT" help --root "$PASSIVE_ROOT" >/dev/null
node --experimental-strip-types "$EVOLVER_SCRIPT" status --root "$PASSIVE_ROOT" >/dev/null
node --experimental-strip-types "$EVOLVER_SCRIPT" list-signals --root "$PASSIVE_ROOT" --json >/dev/null
node --experimental-strip-types "$EVOLVER_SCRIPT" export-signals --root "$PASSIVE_ROOT" >/dev/null
if [[ -e "$PASSIVE_ROOT/.bagakit" || -e "$PASSIVE_ROOT/.mem_inbox" ]]; then
  echo "error: read-only evolver inspection materialized runtime state" >&2
  exit 1
fi

mkdir -p "$TMP_ROOT/.bagakit/evolver/topics"
cat > "$TMP_ROOT/.bagakit/evolver/index.json" <<'EOF'
{
  "version": 1,
  "topics": []
}
EOF

node --experimental-strip-types \
  "$EVOLVER_SCRIPT" \
  check \
  --root "$TMP_ROOT"
