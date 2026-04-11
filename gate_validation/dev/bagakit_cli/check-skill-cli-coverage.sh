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

cd "$root"

missing=0
while IFS= read -r skill_file; do
  skill_dir="$(dirname "$skill_file")"
  manifest="$skill_dir/references/skill-cli.toml"
  if [[ ! -f "$manifest" ]]; then
    printf 'missing skill CLI declaration: %s\n' "$manifest" >&2
    missing=1
  fi
done < <(find skills -mindepth 3 -maxdepth 3 -name SKILL.md -type f | sort)

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

printf 'skill CLI coverage passed\n'
