set -euo pipefail

ROOT="."
while [[ $# -gt 0 ]]; do
  case "$1" in
    --root) ROOT="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$ROOT" && pwd)"
EVOLVER="$ROOT/skills/harness/bagakit-skill-evolver/scripts/evolver.ts"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

git -C "$TMP_DIR" init -q -b main
git -C "$TMP_DIR" config user.name Bagakit
git -C "$TMP_DIR" config user.email bagakit@example.com
printf '# fixture\n' > "$TMP_DIR/README.md"
git -C "$TMP_DIR" add README.md
git -C "$TMP_DIR" commit -q -m init

node --experimental-strip-types "$EVOLVER" init-topic --root "$TMP_DIR" --slug concurrent --title Concurrent --operation-id init >/dev/null

pids=()
for index in $(seq 1 8); do
  node --experimental-strip-types "$EVOLVER" add-source \
    --root "$TMP_DIR" \
    --topic concurrent \
    --source-id "s${index}" \
    --kind note \
    --title "Source ${index}" \
    --origin concurrency-test \
    --operation-id "source-${index}" \
    >"$TMP_DIR/source-${index}.out" 2>"$TMP_DIR/source-${index}.err" &
  pids+=("$!")
done
for pid in "${pids[@]}"; do
  wait "$pid"
done

TOPIC="$TMP_DIR/.bagakit/evolver/topics/concurrent/topic.json"
INDEX="$TMP_DIR/.bagakit/evolver/index.json"
REPORT="$TMP_DIR/.bagakit/evolver/topics/concurrent/REPORT.md"

python3 - "$TOPIC" "$INDEX" <<'PY'
import json
import sys
from pathlib import Path

topic = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
index = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
assert topic["revision"] == 9
assert sorted(source["id"] for source in topic["sources"]) == [f"s{i}" for i in range(1, 9)]
assert sorted(receipt["operation_id"] for receipt in topic["mutation_receipts"]) == ["init"] + [f"source-{i}" for i in range(1, 9)]
entry = next(item for item in index["topics"] if item["slug"] == "concurrent")
assert entry["source_count"] == 8
PY

before_revision="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["revision"])' "$TOPIC")"
node --experimental-strip-types "$EVOLVER" add-source --root "$TMP_DIR" --topic concurrent --source-id s1 --kind note --title "Source 1" --origin concurrency-test --operation-id source-1 >/dev/null
after_revision="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["revision"])' "$TOPIC")"
test "$before_revision" = "$after_revision"

if node --experimental-strip-types "$EVOLVER" add-source --root "$TMP_DIR" --topic concurrent --source-id s1 --kind note --title "Conflicting source" --origin concurrency-test --operation-id source-1 >/dev/null 2>"$TMP_DIR/id-conflict.err"; then
  echo "error: operation id reuse unexpectedly accepted different input" >&2
  exit 1
fi
grep -q 'conflict\[operation_id_reused\]: operation-id source-1' "$TMP_DIR/id-conflict.err"

if node --experimental-strip-types "$EVOLVER" add-source --root "$TMP_DIR" --topic concurrent --source-id invalid-operation --kind note --title Invalid --origin concurrency-test --operation-id INVALID >/dev/null 2>"$TMP_DIR/invalid-operation.err"; then
  echo "error: invalid operation id unexpectedly accepted" >&2
  exit 1
fi
grep -q 'operation-id must be a stable lowercase token' "$TMP_DIR/invalid-operation.err"

mkdir "$TMP_DIR/.bagakit/evolver/topics/concurrent/.topic.lock"
printf '{"pid":%s,"acquired_at":"2001-01-01T00:00:00Z"}\n' "$$" > "$TMP_DIR/.bagakit/evolver/topics/concurrent/.topic.lock/owner.json"
if BAGAKIT_EVOLVER_LOCK_TIMEOUT_MS=200 node --experimental-strip-types "$EVOLVER" add-source --root "$TMP_DIR" --topic concurrent --source-id blocked --kind note --title Blocked --origin concurrency-test --operation-id blocked >/dev/null 2>"$TMP_DIR/lock-conflict.err"; then
  echo "error: command unexpectedly wrote through an active topic lock" >&2
  exit 1
fi
grep -q 'topic mutation conflict: timed out waiting for topic concurrent' "$TMP_DIR/lock-conflict.err"
rm -rf "$TMP_DIR/.bagakit/evolver/topics/concurrent/.topic.lock"

set +e
BAGAKIT_EVOLVER_TEST_CRASH_AFTER_TEMP_WRITE=1 node --experimental-strip-types "$EVOLVER" add-source --root "$TMP_DIR" --topic concurrent --source-id temp-recovered --kind note --title "Temp Recovered" --origin crash-test --operation-id temp-retry >/dev/null 2>"$TMP_DIR/temp-crash.err"
temp_crash_status=$?
set -e
test "$temp_crash_status" -eq 86
test -d "$TMP_DIR/.bagakit/evolver/topics/concurrent/.topic.lock"
node --experimental-strip-types "$EVOLVER" add-source --root "$TMP_DIR" --topic concurrent --source-id temp-recovered --kind note --title "Temp Recovered" --origin crash-test --operation-id temp-retry >/dev/null

set +e
BAGAKIT_EVOLVER_TEST_CRASH_AFTER_RENAME=1 node --experimental-strip-types "$EVOLVER" add-source --root "$TMP_DIR" --topic concurrent --source-id recovered --kind note --title Recovered --origin crash-test --operation-id crash-retry >/dev/null 2>"$TMP_DIR/crash.err"
crash_status=$?
set -e
test "$crash_status" -eq 87
test -d "$TMP_DIR/.bagakit/evolver/topics/concurrent/.topic.lock"
node --experimental-strip-types "$EVOLVER" add-source --root "$TMP_DIR" --topic concurrent --source-id recovered --kind note --title Recovered --origin crash-test --operation-id crash-retry >/dev/null

python3 - "$TOPIC" <<'PY'
import json
import sys
from pathlib import Path

topic = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert [source["id"] for source in topic["sources"]].count("temp-recovered") == 1
assert [source["id"] for source in topic["sources"]].count("recovered") == 1
assert [receipt["operation_id"] for receipt in topic["mutation_receipts"]].count("temp-retry") == 1
assert [receipt["operation_id"] for receipt in topic["mutation_receipts"]].count("crash-retry") == 1
PY
test ! -e "$TMP_DIR/.bagakit/evolver/topics/concurrent/.topic.lock"

printf 'stale projection\n' > "$REPORT"
node --experimental-strip-types "$EVOLVER" refresh-index --root "$TMP_DIR" >/dev/null
grep -q 'Source 1' "$REPORT"
grep -q 'Source 8' "$REPORT"
grep -q 'Temp Recovered' "$REPORT"
grep -q 'Recovered' "$REPORT"

if find "$TMP_DIR/.bagakit/evolver/topics/concurrent" -maxdepth 1 -name '.topic.json.tmp-*' -print -quit | grep -q .; then
  echo "error: atomic topic replacement left a temporary file" >&2
  exit 1
fi

echo "ok: bagakit-skill-evolver concurrent topic mutation passed"
