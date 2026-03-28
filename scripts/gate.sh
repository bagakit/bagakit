set -euo pipefail

ORIG_PWD="$(pwd)"
cd "$(dirname "$0")"
cd ..
ROOT="$(pwd)"
cd "$ORIG_PWD"

usage() {
  cat <<'EOF'
usage:
  scripts/gate.sh validate [validator args...]
  scripts/gate.sh validate-all [validator args...]
  scripts/gate.sh validate-plan [validator args...]
  scripts/gate.sh validate-audit [validator args...]
  scripts/gate.sh eval [validator args...]
  scripts/gate.sh eval-all [validator args...]
  scripts/gate.sh eval-plan [validator args...]
  scripts/gate.sh eval-audit [validator args...]

Semantic entrypoint for the repository gate surface.
EOF
}

if [[ $# -lt 1 || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

MODE="$1"
shift

case "$MODE" in
  validate)
    exec node --experimental-strip-types \
      "$ROOT/dev/validator/src/cli.ts" \
      run-default \
      --root "$ROOT" \
      --config gate_validation/validation.toml \
      --fail-fast \
      "$@"
    ;;
  validate-all)
    exec node --experimental-strip-types \
      "$ROOT/dev/validator/src/cli.ts" \
      run-default \
      --root "$ROOT" \
      --config gate_validation/validation.toml \
      "$@"
    ;;
  validate-plan)
    exec node --experimental-strip-types \
      "$ROOT/dev/validator/src/cli.ts" \
      plan \
      --root "$ROOT" \
      --config gate_validation/validation.toml \
      "$@"
    ;;
  validate-audit)
    exec node --experimental-strip-types \
      "$ROOT/dev/validator/src/cli.ts" \
      audit \
      --root "$ROOT" \
      --config gate_validation/validation.toml \
      "$@"
    ;;
  eval)
    exec node --experimental-strip-types \
      "$ROOT/dev/validator/src/cli.ts" \
      run-default \
      --root "$ROOT" \
      --config gate_eval/validation.toml \
      --fail-fast \
      "$@"
    ;;
  eval-all)
    exec node --experimental-strip-types \
      "$ROOT/dev/validator/src/cli.ts" \
      run-default \
      --root "$ROOT" \
      --config gate_eval/validation.toml \
      "$@"
    ;;
  eval-audit)
    exec node --experimental-strip-types \
      "$ROOT/dev/validator/src/cli.ts" \
      audit \
      --root "$ROOT" \
      --config gate_eval/validation.toml \
      "$@"
    ;;
  eval-plan)
    exec node --experimental-strip-types \
      "$ROOT/dev/validator/src/cli.ts" \
      plan \
      --root "$ROOT" \
      --config gate_eval/validation.toml \
      "$@"
    ;;
  *)
    echo "unknown gate mode: $MODE" >&2
    usage >&2
    exit 2
    ;;
esac
