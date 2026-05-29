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
usage: gate_validation/skills/harness/bagakit-skill-evolver/check-evolver-state.sh [--root <repo-root>]
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
mkdir -p "$TMP_ROOT/.bagakit/evolver/topics"
cat > "$TMP_ROOT/.bagakit/evolver/index.json" <<'EOF'
{
  "version": 1,
  "topics": []
}
EOF

node --experimental-strip-types \
  "$ROOT/skills/harness/bagakit-skill-evolver/scripts/evolver.ts" \
  check \
  --root "$TMP_ROOT"
