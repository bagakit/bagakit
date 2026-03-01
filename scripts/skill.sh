set -euo pipefail

ORIG_PWD="$(pwd)"
cd "$(dirname "$0")"
cd ..
ROOT="$(pwd)"
cd "$ORIG_PWD"

if [[ $# -lt 1 || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  exec node --experimental-strip-types "$ROOT/scripts/skill.ts" --help
fi

exec node --experimental-strip-types \
  "$ROOT/scripts/skill.ts" \
  "$@" \
  --root "$ROOT"
