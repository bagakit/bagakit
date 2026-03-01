set -euo pipefail

ROOT="."
TMP_DIR=""

cleanup() {
  if [[ -n "${TMP_DIR:-}" && -d "${TMP_DIR:-}" ]]; then
    rm -rf "$TMP_DIR"
  fi
  if [[ -n "${TMP_DIR:-}" && -f "${TMP_DIR:-}.json" ]]; then
    rm -f "${TMP_DIR}.json"
  fi
}

trap cleanup EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      [[ $# -ge 2 ]] || { echo "missing value for --root" >&2; exit 2; }
      ROOT="$2"
      shift 2
      ;;
    -h|--help)
      cat <<'EOF'
usage: gate_validation/backbone/check-canonical-packaging.sh [--root <repo-root>]

Run a smoke packaging pass for discovered installable skills and verify the
expected archives exist.
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
TMP_DIR="$ROOT/.bagakit/package-smoke"
mkdir -p "$(dirname "$TMP_DIR")"

bash "$ROOT/scripts/skill.sh" distribute-package --dist "$TMP_DIR" --selector all --json > "$TMP_DIR.json"

python3 - "$ROOT" "$TMP_DIR" "$TMP_DIR.json" <<'PY'
from __future__ import annotations

import json
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
dist_root = Path(sys.argv[2]).resolve()
payload = json.loads(Path(sys.argv[3]).read_text(encoding="utf-8"))

missing: list[str] = []
for entry in payload.get("results", []):
    archive = root / entry["archivePath"]
    if not archive.is_file():
        missing.append(archive.relative_to(root).as_posix())

if missing:
    for item in missing:
        print(f"missing packaged skill archive: {item}", file=sys.stderr)
    raise SystemExit(1)
PY

echo "installable skill packaging smoke passed"
