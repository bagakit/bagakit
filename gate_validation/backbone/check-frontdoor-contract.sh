set -euo pipefail

ROOT="."

while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      [[ $# -ge 2 ]] || { echo "missing value for --root" >&2; exit 2; }
      ROOT="$2"
      shift 2
      ;;
    -h|--help)
      cat <<'EOF'
usage: gate_validation/backbone/check-frontdoor-contract.sh [--root <repo-root>]

Validate the Bagakit frontdoor declaration/rendering contract through the
repo-owned frontdoor operator.
EOF
      exit 0
      ;;
    *)
      echo "unexpected argument: $1" >&2
      exit 2
      ;;
  esac
done

if [[ ! -d "$ROOT" ]]; then
  echo "repo root not found: $ROOT" >&2
  exit 2
fi

cd "$ROOT"

FRONTDOOR_CLI="dev/host_tools/frontdoor/src/cli.ts"

if [[ ! -f "$FRONTDOOR_CLI" ]]; then
  echo "missing Bagakit frontdoor operator: $FRONTDOOR_CLI" >&2
  echo "expected command: node --experimental-strip-types $FRONTDOOR_CLI check --root ." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "missing required executable: node" >&2
  exit 1
fi

exec node --experimental-strip-types "$FRONTDOOR_CLI" check --root .
