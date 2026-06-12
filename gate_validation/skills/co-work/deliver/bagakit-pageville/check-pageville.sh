#!/usr/bin/env bash
set -euo pipefail

root="."
if [[ "${1:-}" == "--root" ]]; then
  root="${2:?missing root after --root}"
fi

cli="$root/skills/co-work/deliver/bagakit-pageville/scripts/pageville.sh"
tmp_root=$(mktemp -d)
cleanup() {
  python3 - "$tmp_root" <<'PY'
import shutil
import sys

shutil.rmtree(sys.argv[1], ignore_errors=True)
PY
}
trap cleanup EXIT

mkdir -p "$tmp_root/source"
printf '%s\n' '<!doctype html><title>v1</title><h1>version one</h1>' > "$tmp_root/source/index.html"
printf '%s\n' '{"case":"pageville","value":1}' > "$tmp_root/payload.json"

"$cli" init --root "$tmp_root" --json >/dev/null
first=$($cli start --root "$tmp_root" --json)
port=$(printf '%s' "$first" | python3 -c 'import json,sys; print(json.load(sys.stdin)["port"])')
pid=$(printf '%s' "$first" | python3 -c 'import json,sys; print(json.load(sys.stdin)["pid"])')
second=$($cli start --root "$tmp_root" --json)
port2=$(printf '%s' "$second" | python3 -c 'import json,sys; print(json.load(sys.stdin)["port"])')
pid2=$(printf '%s' "$second" | python3 -c 'import json,sys; print(json.load(sys.stdin)["pid"])')
test "$port" = "$port2"
test "$pid" = "$pid2"

published=$($cli publish --root "$tmp_root" --slug design-preview --title 'Design Preview' --kind design --owner reviewer --source "$tmp_root/source" --source-ref design/preview --payload "$tmp_root/payload.json" --json)
printf '%s' "$published" | rg -q '"version": "v1"'
curl -fsS "http://127.0.0.1:$port/pages/design-preview/latest/" | rg -q 'version one'

$cli annotate --root "$tmp_root" --slug design-preview --anchor '#decision' --label clear --note 'Human can follow the flow' --json | rg -q '"annotation_id": "a1"'
printf '%s\n' '<!doctype html><title>v2</title><h1>version two</h1>' > "$tmp_root/source/index.html"
$cli publish --root "$tmp_root" --slug design-preview --title 'Design Preview' --kind design --owner reviewer --source "$tmp_root/source" --source-ref design/preview --version v2 --json | rg -q '"version": "v2"'
curl -fsS "http://127.0.0.1:$port/pages/design-preview/v1/" | rg -q 'version one'
curl -fsS "http://127.0.0.1:$port/pages/design-preview/latest/" | rg -q 'version two'
curl -fsS "http://127.0.0.1:$port/api/pages/design-preview/v1" | rg -q 'Human can follow the flow'
if curl -fsS "http://127.0.0.1:$port/pages/design-preview/v1/%2e%2e/%2e%2e/registry.json" >/dev/null 2>&1; then
  echo 'path traversal unexpectedly served' >&2
  exit 1
fi
$cli fetch --root "$tmp_root" --slug design-preview --version v1 --json | rg -q 'Human can follow the flow'
$cli versions --root "$tmp_root" --slug design-preview --json | rg -q 'v1'
$cli archive --root "$tmp_root" --slug design-preview --json | rg -q 'archived'
$cli stop --root "$tmp_root" --json | rg -q 'stopped'

echo 'ok: pageville smoke passed'
