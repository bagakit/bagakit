#!/usr/bin/env bash
set -euo pipefail

ROOT="."
while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      if [[ $# -lt 2 ]]; then
        echo "error: --root requires a path" >&2
        exit 2
      fi
      ROOT="$2"
      shift 2
      ;;
    *)
      echo "error: unexpected argument: $1" >&2
      exit 2
      ;;
  esac
done

ROOT="$(cd "$ROOT" && pwd)"
SKILL_DIR="$ROOT/skills/harness/bagakit-feature-tracker"
LIB_DIR="$ROOT/gate_validation/skills/harness/bagakit-feature-tracker/lib"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
source "$LIB_DIR/feature-tracker-testlib.sh"

feature_tracker_init_temp_repo "$TMP_DIR"
bash "$SKILL_DIR/scripts/feature-tracker.sh" initialize-tracker --root "$TMP_DIR" >/dev/null

PLAN="$TMP_DIR/status-board-plan.json"
cat >"$PLAN" <<'JSON'
{
  "schema": "bagakit.feature-task-plan.v1",
  "review": {"status": "approved", "evidence_ref": "review/status-board"},
  "source_refs": ["test/status-board"],
  "tasks": [
    {
      "id": "T-003",
      "depends_on": ["T-001", "T-002"],
      "title": "Join the two status branches into one readable candidate",
      "objective": "Close the integrated status-board fixture.",
      "outcome": "The topology exposes a readable fan-in join.",
      "acceptance": ["The joined candidate has two incoming edges."],
      "verification": [{"kind": "command", "ref": "true", "proves": "The fixture gate is executable."}],
      "source_refs": ["test/status-board"],
      "supersedes": []
    },
    {
      "id": "T-001",
      "depends_on": [],
      "title": "Build the first status branch with a deliberately long title",
      "objective": "Close the first independent status branch.",
      "outcome": "The first branch is independently visible.",
      "acceptance": ["The first branch is visible in the topology."],
      "verification": [{"kind": "command", "ref": "true", "proves": "The fixture gate is executable."}],
      "source_refs": ["test/status-board"],
      "supersedes": []
    },
    {
      "id": "T-002",
      "depends_on": [],
      "title": "Build the second status branch with a deliberately long title",
      "objective": "Close the second independent status branch.",
      "outcome": "The second branch is independently visible.",
      "acceptance": ["The second branch is visible in the topology."],
      "verification": [{"kind": "command", "ref": "true", "proves": "The fixture gate is executable."}],
      "source_refs": ["test/status-board"],
      "supersedes": []
    }
  ]
}
JSON

bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature \
  --root "$TMP_DIR" \
  --title "Status board fixture" \
  --slug "status-board-fixture" \
  --goal "Exercise stable status-board layout and readable topology routing." \
  --workspace-mode current_tree \
  --tasks-file "$PLAN" >/dev/null
FEATURE_ID="$(feature_tracker_feature_id_by_title "$TMP_DIR" "Status board fixture")"
bash "$SKILL_DIR/scripts/feature-tracker.sh" show-feature-status \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --format html >"$TMP_DIR/status-board.html"

python3 - "$TMP_DIR/status-board.html" "$FEATURE_ID" <<'PY'
import re
import sys
from pathlib import Path

html = Path(sys.argv[1]).read_text(encoding="utf-8")
feature_id = sys.argv[2]

# Every canonical status gets a stable column, including empty states, so the
# board does not resize when the frontier changes.
assert html.count('class="status-column ') == 5
assert html.count('class="column-empty"') == 4
assert "grid-template-columns:repeat(5,320px)" in html
assert "grid-auto-columns:320px" in html
assert "align-items:start" in html

# A focused Feature id is reflected in markup and opens the active review.
assert f'data-focus-feature="{feature_id}"' in html
assert '<details class="feature-review" open>' in html

# Feature and Task titles carry the same compact, copyable affordance.
assert html.count('class="copy-title"') == 4
assert 'aria-label="Copy Feature title"' in html
assert 'aria-label="Copy Task title"' in html
assert 'function copyTitle(button)' in html

# The diamond fixture emits independently routed edges rather than one shared
# control path that visually stacks every branch.
edges = re.findall(r'<path class="topology-edge"[^>]+>', html)
assert len(edges) == 2
assert all('data-source-lane=' in edge and 'data-target-lane=' in edge for edge in edges)
assert len({re.search(r'data-source-lane="([^"]+)"', edge).group(1) for edge in edges}) == 2

# The query focus is also recoverable after a live content replacement.
assert 'window.__bagakitFocusFeature' in html
print("ok: status board layout and interaction projection")
PY

SERVER_OUT="$TMP_DIR/status-board-server.out"
bash "$SKILL_DIR/scripts/feature-tracker.sh" serve-feature-status \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --port 0 --refresh-ms 1000 \
  >"$SERVER_OUT" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true; wait "$SERVER_PID" 2>/dev/null || true; rm -rf "$TMP_DIR"' EXIT
for _ in $(seq 1 30); do
  grep -q '^status_server: http://' "$SERVER_OUT" && break
  sleep 0.1
done
SERVER_URL="$(sed -n '1s/^status_server: //p' "$SERVER_OUT")"
test -n "$SERVER_URL"
python3 - "$SERVER_URL" <<'PY'
import sys
from urllib.request import urlopen

body = urlopen(sys.argv[1], timeout=5).read().decode("utf-8")
assert "__bagakitFocusFeature(nextContent)" in body
assert "window.__bagakitFocusFeature" in body
print("ok: live focus refresh hook")
PY
kill "$SERVER_PID"
wait "$SERVER_PID" 2>/dev/null || true

echo "feature-tracker status board passed"
