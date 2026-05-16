set -euo pipefail

ORIG_PWD="$(pwd)"
cd "$(dirname "$0")"
cd ..
ROOT="$(pwd)"
cd "$ORIG_PWD"

if [[ $# -lt 1 || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  exec node --experimental-strip-types "$ROOT/scripts/skill.ts" --help
fi

COMMAND="$1"
shift

exec node --experimental-strip-types \
  "$ROOT/scripts/skill.ts" \
  "$COMMAND" \
  --root "$ROOT" \
  "$@"
