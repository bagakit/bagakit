set -euo pipefail

ROOT="."

while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      [[ $# -ge 2 ]] || { echo "missing value for --root" >&2; exit 2; }
      ROOT="$2"
      shift 2
      ;;
    --)
      shift
      break
      ;;
    -h|--help)
      cat <<'EOF'
usage: dev/host_tools/typescript/tsc-local.sh --root <repo-root> -- <tsc args...>

Run the repository-pinned TypeScript compiler from node_modules.
EOF
      exit 0
      ;;
    *)
      break
      ;;
  esac
done

ROOT="$(cd "$ROOT" && pwd)"
TSC="$ROOT/node_modules/.bin/tsc"

if [[ ! -x "$TSC" ]]; then
  echo "missing local TypeScript compiler: run npm ci before validation" >&2
  exit 1
fi

cd "$ROOT"
exec "$TSC" "$@"
