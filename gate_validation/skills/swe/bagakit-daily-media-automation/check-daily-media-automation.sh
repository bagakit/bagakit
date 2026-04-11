set -euo pipefail

ROOT="."

while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      [[ $# -ge 2 ]] || { echo "missing value for --root" >&2; exit 2; }
      ROOT="$2"
      shift 2
      ;;
    -h|--help)
      cat <<'EOF'
usage: gate_validation/skills/swe/bagakit-daily-media-automation/check-daily-media-automation.sh [--root <repo-root>]

Run deterministic behavior and contract smoke checks for
bagakit-daily-media-automation.
EOF
      exit 0
      ;;
    *)
      echo "unexpected argument: $1" >&2
      exit 2
      ;;
  esac
done

ROOT="$(cd "$ROOT" && pwd)"
SKILL_DIR="$ROOT/skills/swe/bagakit-daily-media-automation"
CMD="$SKILL_DIR/scripts/bagakit-daily-media-automation-cli.sh"
RUNBOOK="$SKILL_DIR/references/runbook.md"
RUN_ARTIFACTS="$SKILL_DIR/references/run-artifacts.md"
ADAPTER_MATRIX="$SKILL_DIR/references/adapter-matrix.md"
SKILL_MD="$SKILL_DIR/SKILL.md"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

assert_contains() {
  local file="$1"
  local needle="$2"
  if ! grep -Fq -- "$needle" "$file"; then
    echo "missing expected text in $(basename "$file"): $needle" >&2
    exit 1
  fi
}

run_ok() {
  local output="$TMP_DIR/out"
  if ! "$@" >"$output" 2>"$TMP_DIR/err"; then
    echo "command unexpectedly failed: $*" >&2
    cat "$TMP_DIR/err" >&2
    exit 1
  fi
}

run_fail() {
  local expected_status="$1"
  local output="$TMP_DIR/out"
  shift
  set +e
  "$@" >"$output" 2>"$TMP_DIR/err"
  local status=$?
  set -e
  if [[ "$status" -ne "$expected_status" ]]; then
    echo "command returned $status, expected $expected_status: $*" >&2
    cat "$output" >&2 || true
    cat "$TMP_DIR/err" >&2 || true
    exit 1
  fi
}

run_ok bash "$CMD" describe
grep -Fq "no-publish gates" "$TMP_DIR/out"

run_ok bash "$CMD" list-references
grep -Fq "references/adapter-matrix.md" "$TMP_DIR/out"
grep -Fq "references/run-artifacts.md" "$TMP_DIR/out"
grep -Fq "references/runbook.md" "$TMP_DIR/out"
grep -Fq "references/skill-cli.toml" "$TMP_DIR/out"

run_fail 2 bash "$CMD" doctor --source
grep -Fq "missing value for --source" "$TMP_DIR/err"

run_fail 2 bash "$CMD" doctor --unknown-route value
grep -Fq "unknown doctor argument: --unknown-route" "$TMP_DIR/err"

run_ok bash "$CMD" doctor \
  --source none \
  --image none \
  --web none \
  --deploy none \
  --notify none \
  --scheduler manual \
  --write-root "$TMP_DIR"
grep -Fq "doctor result: no required route dependency is missing" "$TMP_DIR/out"
grep -Fq "source               ok        none" "$TMP_DIR/out"
grep -Fq "notification         ok        none" "$TMP_DIR/out"

run_ok bash "$CMD" doctor \
  --source none \
  --image none \
  --web bagakit-codex-webpage-design \
  --deploy static \
  --notify none \
  --scheduler manual \
  --write-root "$TMP_DIR"
grep -Fq "webpage-design skill ok        skills/swe/bagakit-codex-webpage-design/SKILL.md" "$TMP_DIR/out"
grep -Fq "doctor result: no required route dependency is missing" "$TMP_DIR/out"

run_fail 1 bash "$CMD" doctor \
  --source none \
  --image none \
  --web none \
  --deploy static \
  --notify none \
  --scheduler manual \
  --write-root "$TMP_DIR/missing-root"
grep -Fq "write-root           missing" "$TMP_DIR/out"
grep -Fq "doctor result: blocked route dependency is missing" "$TMP_DIR/out"

(
  unset TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID
  run_fail 1 bash "$CMD" doctor \
    --source none \
    --image none \
    --web none \
    --deploy none \
    --notify telegram \
    --scheduler manual \
    --write-root "$TMP_DIR"
)
grep -Fq 'Telegram token       unset     $TELEGRAM_BOT_TOKEN is required for selected route' "$TMP_DIR/out"
grep -Fq 'Telegram chat        unset     $TELEGRAM_CHAT_ID is required for selected route' "$TMP_DIR/out"
if grep -Fq "secret" "$TMP_DIR/out"; then
  echo "doctor output contains a secret-like placeholder instead of env names only" >&2
  exit 1
fi

(
  mkdir -p "$TMP_DIR/empty-home" "$TMP_DIR/empty-codex" "$TMP_DIR/empty-bin"
  dirname_path="$(command -v dirname)"
  ln -s "$dirname_path" "$TMP_DIR/empty-bin/dirname"
  run_fail 1 env \
    HOME="$TMP_DIR/empty-home" \
    CODEX_HOME="$TMP_DIR/empty-codex" \
    PATH="$TMP_DIR/empty-bin" \
    "$BASH" "$CMD" doctor \
    --source agent-reach \
    --image none \
    --web none \
    --deploy none \
    --notify none \
    --scheduler manual \
    --write-root "$TMP_DIR"
)
grep -Fq "agent-reach route" "$TMP_DIR/out"
grep -Fq "selected route needs Agent Reach skill or at least one supported channel command" "$TMP_DIR/out"

run_fail 2 bash "$CMD" init-run --run-id
grep -Fq "missing value for --run-id" "$TMP_DIR/err"

run_fail 2 bash "$CMD" init-run --run-id "Bad_Run"
grep -Fq "invalid run id: Bad_Run" "$TMP_DIR/err"

RUN_ROOT="$TMP_DIR/run-root"
RUN_ID="ai-news-$(printf '%08d' 0)-main"
mkdir -p "$RUN_ROOT"
run_ok bash "$CMD" init-run \
  --root "$RUN_ROOT" \
  --run-id "$RUN_ID" \
  --domain-pack ai-news \
  --deploy static \
  --notify none \
  --scheduler manual
grep -Fq "initialized run: .bagakit/daily-media-automation/runs/$RUN_ID" "$TMP_DIR/out"

SURFACE="$RUN_ROOT/.bagakit/daily-media-automation/surface.toml"
RUN_DIR="$RUN_ROOT/.bagakit/daily-media-automation/runs/$RUN_ID"
test -f "$SURFACE"
test -f "$RUN_DIR/brief.md"
test -f "$RUN_DIR/collection-ledger.md"
test -f "$RUN_DIR/evidence-review.md"
test -f "$RUN_DIR/asset-ledger.md"
test -f "$RUN_DIR/deployment-ledger.md"
test -f "$RUN_DIR/notification-ledger.md"
test -f "$RUN_DIR/archive.md"
grep -Fq 'surface_root = ".bagakit/daily-media-automation"' "$SURFACE"
grep -Fq "run_id: $RUN_ID" "$RUN_DIR/brief.md"
grep -Fq "domain_pack: ai-news" "$RUN_DIR/brief.md"
grep -Fq "deploy_adapter: static" "$RUN_DIR/deployment-ledger.md"
grep -Fq "notify_adapter: none" "$RUN_DIR/notification-ledger.md"
grep -Fq "publication_status: drafted" "$RUN_DIR/archive.md"

if grep -R -F "$RUN_ROOT" "$RUN_DIR" "$SURFACE" >/dev/null; then
  echo "init-run leaked a machine-local root" >&2
  exit 1
fi

run_fail 1 bash "$CMD" init-run \
  --root "$RUN_ROOT" \
  --run-id "$RUN_ID" \
  --domain-pack ai-news
grep -Fq "refusing to overwrite existing file" "$TMP_DIR/err"

assert_contains "$SKILL_MD" "Do not deploy or notify as a successful publication when any blocker remains"
assert_contains "$SKILL_MD" "published_with_notification_failure"
assert_contains "$SKILL_MD" "Deployment and notification are separate statuses"
assert_contains "$SKILL_MD" "Every domain pack must declare:"
assert_contains "$SKILL_MD" "If these are omitted, collect and synthesize only as a draft"

assert_contains "$RUNBOOK" "If the brief is missing source thresholds, collect and synthesize only as a"
assert_contains "$RUNBOOK" "Track deployment status separately from notification status."
assert_contains "$RUNBOOK" "Publication status values:"
assert_contains "$RUNBOOK" 'Use `references/run-artifacts.md` for compact ledger templates'

assert_contains "$RUN_ARTIFACTS" "Surface Marker"
assert_contains "$RUN_ARTIFACTS" "Publication status:"
assert_contains "$RUN_ARTIFACTS" "Notification status:"
assert_contains "$RUN_ARTIFACTS" "Gate status:"
assert_contains "$RUN_ARTIFACTS" "source-minimum"
assert_contains "$RUN_ARTIFACTS" "deployment-url"
assert_contains "$RUN_ARTIFACTS" "notification_status"
assert_contains "$RUN_ARTIFACTS" "runs/<run-id>/archive.md"

assert_contains "$ADAPTER_MATRIX" "Adapters are dependencies to check, not payloads to vendor."
assert_contains "$ADAPTER_MATRIX" 'Do not assume `skill_id` equals `cli_command`.'
assert_contains "$ADAPTER_MATRIX" "Block publish when:"
assert_contains "$ADAPTER_MATRIX" "If publish succeeds and notification fails"
assert_contains "$ADAPTER_MATRIX" "published_with_notification_failure"

echo "ok: bagakit-daily-media-automation behavior smoke passed"
