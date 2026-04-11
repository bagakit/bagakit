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

check_manifest_commands() {
  local manifest="$1"
  local help_text="$2"
  local missing_command=0
  local manifest_commands
  local help_commands
  manifest_commands="$(mktemp)"
  help_commands="$(mktemp)"
  trap 'rm -f "$manifest_commands" "$help_commands"' RETURN

  sed -n 's/^[[:space:]]*name = "\(.*\)"[[:space:]]*$/\1/p' "$manifest" | sort -u > "$manifest_commands"
  printf '%s\n' "$help_text" \
    | sed -n 's/^[[:space:]]\{2,6\}\([a-z0-9][a-z0-9-]*\)\([[:space:]].*\)\?$/\1/p' \
    | sort -u > "$help_commands"

  while IFS= read -r command; do
    if [[ -z "$command" ]]; then
      continue
    fi
    if [[ "$help_text" != *"$command"* ]]; then
      printf 'declared command not found in CLI help: %s in %s\n' "$command" "$manifest" >&2
      missing_command=1
    fi
  done < "$manifest_commands"

  while IFS= read -r command; do
    if [[ -z "$command" ]]; then
      continue
    fi
    if ! grep -Fxq "$command" "$manifest_commands"; then
      printf 'CLI help command missing from manifest: %s in %s\n' "$command" "$manifest" >&2
      missing_command=1
    fi
  done < "$help_commands"

  return "$missing_command"
}

while IFS= read -r manifest; do
  skill_dir="$(dirname "$(dirname "$manifest")")"
  entrypoint="$(sed -n 's/^[[:space:]]*entrypoint = "\(.*\)"[[:space:]]*$/\1/p' "$manifest" | head -n 1)"
  runner="$(sed -n 's/^[[:space:]]*runner = "\(.*\)"[[:space:]]*$/\1/p' "$manifest" | head -n 1)"
  if [[ -z "$entrypoint" || -z "$runner" ]]; then
    printf 'missing entrypoint or runner in manifest: %s\n' "$manifest" >&2
    missing=1
    continue
  fi
  entry_path="$skill_dir/$entrypoint"
  case "$runner" in
    shell)
      if ! help_text="$(bash "$entry_path" --help 2>&1)"; then
        printf 'failed to read CLI help: %s\n' "$entry_path" >&2
        missing=1
        continue
      fi
      ;;
    node)
      if ! help_text="$(node --experimental-strip-types "$entry_path" --help 2>&1)"; then
        printf 'failed to read CLI help: %s\n' "$entry_path" >&2
        missing=1
        continue
      fi
      ;;
    python)
      if ! help_text="$(python3 "$entry_path" --help 2>&1)"; then
        printf 'failed to read CLI help: %s\n' "$entry_path" >&2
        missing=1
        continue
      fi
      ;;
    *)
      printf 'unknown runner in manifest %s: %s\n' "$manifest" "$runner" >&2
      missing=1
      continue
      ;;
  esac
  if ! check_manifest_commands "$manifest" "$help_text"; then
    missing=1
  fi
done < <(find skills -mindepth 4 -maxdepth 4 -name 'skill-cli.toml' -type f | sort)

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

printf 'skill CLI coverage passed\n'
