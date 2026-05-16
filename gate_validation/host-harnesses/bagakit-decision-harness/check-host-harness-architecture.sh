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

primary="$root/docs/architecture/A1-system-architecture.md"
index="$root/docs/architecture/A0-README.md"

grep -Fq '### L4: Host Harness' "$primary"
grep -Fq 'docs/specs/host-harness-contract.md' "$primary"
grep -Fq 'docs/specs/host-harness-contract.md' "$index"

if grep -Fq 'three main levels' "$primary"; then
  printf 'primary architecture still declares the retired three-level model\n' >&2
  exit 1
fi

printf 'ok: architecture frontdoor includes the L4 host-harness layer\n'
