set -euo pipefail

root="$(mktemp -d "${TMPDIR:-/tmp}/bagakit-cli-coverage-test.XXXXXX")"
trap 'rm -rf "$root"' EXIT

mkdir -p "$root/skills/human-improvement/guidance-only"
printf '# Guidance only\n' > "$root/skills/human-improvement/guidance-only/SKILL.md"

bash gate_validation/dev/bagakit_cli/check-skill-cli-coverage.sh --root "$root" >/dev/null

mkdir -p "$root/skills/co-work/orchestrate/execution/operator-skill/scripts"
printf '# Operator skill\n' > "$root/skills/co-work/orchestrate/execution/operator-skill/SKILL.md"
printf '#!/usr/bin/env bash\n' > "$root/skills/co-work/orchestrate/execution/operator-skill/scripts/operator.sh"

if bash gate_validation/dev/bagakit_cli/check-skill-cli-coverage.sh --root "$root" >/dev/null 2>&1; then
  printf 'operator skill without a CLI manifest unexpectedly passed\n' >&2
  exit 1
fi

mkdir -p "$root/skills/co-work/orchestrate/execution/operator-skill/references"
cat > "$root/skills/co-work/orchestrate/execution/operator-skill/references/skill-cli.toml" <<'EOF'
entrypoint = "scripts/operator.sh"
runner = "shell"
[[command]]
name = "inspect"
EOF
if bash gate_validation/dev/bagakit_cli/check-skill-cli-coverage.sh --root "$root" >/dev/null 2>&1; then
  printf 'deep operator manifest with missing public command unexpectedly passed\n' >&2
  exit 1
fi
printf 'printf "  inspect\\n"\n' > "$root/skills/co-work/orchestrate/execution/operator-skill/scripts/operator.sh"
bash gate_validation/dev/bagakit_cli/check-skill-cli-coverage.sh --root "$root" >/dev/null

printf 'skill CLI coverage fixture checks passed\n'
