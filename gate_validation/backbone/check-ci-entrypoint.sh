set -euo pipefail

root="."
while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      root="$2"
      shift 2
      ;;
    *)
      printf 'unknown argument: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

workflow="$root/.github/workflows/validate.yml"
expected='run: bash ./scripts/gate.sh validate'

if ! grep -Fq "$expected" "$workflow"; then
  printf 'CI validation must call the canonical gate entrypoint: %s\n' "$expected" >&2
  exit 1
fi

if grep -Fq 'scripts/validate-repo.sh' "$workflow"; then
  printf 'CI validation still references the forbidden legacy validate-repo.sh entrypoint\n' >&2
  exit 1
fi

printf 'ok: CI validation uses scripts/gate.sh validate\n'
