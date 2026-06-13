set -euo pipefail
root="."
while [[ $# -gt 0 ]]; do
  case "$1" in
    --root) root="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
cd "$root"
cli="skills/evolve/generate/bagakit-auto-research/scripts/bagakit-auto-research-cli.sh"
bash "$cli" --help >/dev/null
bash "$cli" describe | grep -Fq 'Bagakit Auto Research'
bash "$cli" contract | grep -Fq 'Candidate manifest'
echo "ok: bagakit-auto-research CLI passed"
