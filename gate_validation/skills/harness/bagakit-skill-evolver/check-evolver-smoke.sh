set -euo pipefail

ROOT="."

while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      ROOT="$2"
      shift 2
      ;;
    *)
      echo "unexpected argument: $1" >&2
      exit 2
      ;;
  esac
done

ROOT="$(cd "$ROOT" && pwd)"
EVOLVER_DIR="$ROOT/skills/harness/bagakit-skill-evolver"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

git -C "$TMP_DIR" init -q -b main
git -C "$TMP_DIR" config user.name "Bagakit"
git -C "$TMP_DIR" config user.email "bagakit@example.com"
printf '# demo\n' > "$TMP_DIR/README.md"
git -C "$TMP_DIR" add README.md
git -C "$TMP_DIR" commit -q -m "init"

mkdir -p "$TMP_DIR/docs/specs"
printf 'spec\n' > "$TMP_DIR/docs/specs/demo-rule.md"
printf 'proof\n' > "$TMP_DIR/docs/specs/demo-rule-proof.md"
mkdir -p "$TMP_DIR/docs/session" "$TMP_DIR/.bagakit/goal/reviews"
printf 'approved evidence slice\n' > "$TMP_DIR/docs/session/session-evidence.md"
printf 'counterevidence slice\n' > "$TMP_DIR/docs/session/counterevidence.md"
cat > "$TMP_DIR/.bagakit/goal/reviews/round-1.json" <<'EOF'
{
  "schema": "bagakit.goal-evolver-review.v1",
  "goal_id": "demo-goal",
  "review_id": "round-1",
  "trigger": "after_round",
  "status": "completed",
  "evidence_refs": [
    "docs/session/session-evidence.md",
    "docs/session/counterevidence.md"
  ],
  "drift": [],
  "next_instruction": "Let Evolver review the bounded evidence.",
  "approval": "approved",
  "evolver_disposition": "signal_candidate"
}
EOF

cat > "$TMP_DIR/session-review.json" <<'EOF'
{
  "schema": "bagakit.evolver.session-review.v1",
  "producer": "goal-reviewer",
  "generated_at": "2001-01-02T00:05:00Z",
  "session_evidence": {
    "session_id": "session-001",
    "run_id": "run-001",
    "source_channel": "goal-review",
    "source_refs": [
      ".bagakit/goal/reviews/round-1.json",
      "docs/session/session-evidence.md",
      "docs/session/counterevidence.md"
    ],
    "captured_at": "2001-01-02T00:00:00Z",
    "sensitivity": "internal",
    "privacy_disposition": "approved_slices",
    "retention_disposition": "expires",
    "retention_until": "2001-02-02T00:00:00Z",
    "redaction_policy": "exclude raw transcript and secrets"
  },
  "candidates": [
    {
      "signal_id": "reviewed-session-gap",
      "operation": "add",
      "kind": "gotcha",
      "title": "Reviewed session gap",
      "statement": "Session closeout omitted one reusable evidence check.",
      "observed_outcome": "The same omission appeared in a bounded goal review.",
      "proposed_generalization": "Require the evidence check before reusable session learning enters Evolver.",
      "scope": "bagakit harness sessions",
      "confidence": 0.82,
      "source_refs": ["docs/session/session-evidence.md"],
      "source_spans": [{"ref": "docs/session/session-evidence.md", "locator": "lines:1-1"}],
      "counterevidence_refs": ["docs/session/counterevidence.md"],
      "supersedes": [],
      "conflicts_with": ["older-session-guidance"],
      "limitations": ["one bounded review"],
      "topic_hint": "session-evidence-intake"
    },
    {
      "signal_id": "rejected-session-gap",
      "operation": "add",
      "kind": "preference",
      "title": "Rejected session gap",
      "statement": "A weak preference appeared once.",
      "observed_outcome": "No repeat evidence was found.",
      "proposed_generalization": "Prefer one session layout.",
      "scope": "one session",
      "confidence": 0.2,
      "source_refs": ["docs/session/session-evidence.md"],
      "source_spans": [{"ref": "docs/session/session-evidence.md", "locator": "lines:1-1"}],
      "counterevidence_refs": [],
      "supersedes": [],
      "conflicts_with": [],
      "limitations": ["single observation"]
    },
    {
      "signal_id": "needs-more-session-gap",
      "operation": "revise",
      "kind": "howto",
      "title": "Needs more evidence",
      "statement": "A possible workflow improvement was observed.",
      "observed_outcome": "The outcome has not been reproduced.",
      "proposed_generalization": "Revise session review timing.",
      "scope": "unknown",
      "confidence": 0.4,
      "source_refs": ["docs/session/session-evidence.md"],
      "source_spans": [{"ref": "docs/session/session-evidence.md", "locator": "lines:1-1"}],
      "counterevidence_refs": [],
      "supersedes": [],
      "conflicts_with": [],
      "limitations": ["not reproduced"]
    },
    {
      "signal_id": "open-conflict-session-gap",
      "operation": "revise",
      "kind": "decision",
      "title": "Open conflict",
      "statement": "Two session outcomes disagree.",
      "observed_outcome": "Supporting and counter evidence remain unresolved.",
      "proposed_generalization": "Choose one retention policy.",
      "scope": "session retention",
      "confidence": 0.5,
      "source_refs": ["docs/session/session-evidence.md"],
      "source_spans": [{"ref": "docs/session/session-evidence.md", "locator": "lines:1-1"}],
      "counterevidence_refs": ["docs/session/counterevidence.md"],
      "supersedes": [],
      "conflicts_with": ["retention-policy-a"],
      "limitations": ["conflict is open"]
    }
  ],
  "reviews": [
    {
      "signal_id": "reviewed-session-gap",
      "coverage": "pass",
      "preservation": "pass",
      "faithfulness": "pass",
      "disposition": "accepted",
      "reviewer": "maintainer",
      "reviewed_at": "2001-01-02T00:04:00Z",
      "rationale": "The candidate preserves supporting and counter evidence."
    },
    {
      "signal_id": "rejected-session-gap",
      "coverage": "fail",
      "preservation": "pass",
      "faithfulness": "pass",
      "disposition": "rejected",
      "reviewer": "maintainer",
      "reviewed_at": "2001-01-02T00:04:00Z",
      "rationale": "The observation is not reusable."
    },
    {
      "signal_id": "needs-more-session-gap",
      "coverage": "unclear",
      "preservation": "pass",
      "faithfulness": "unclear",
      "disposition": "needs_more_evidence",
      "reviewer": "maintainer",
      "reviewed_at": "2001-01-02T00:04:00Z",
      "rationale": "A second verified outcome is required."
    },
    {
      "signal_id": "open-conflict-session-gap",
      "coverage": "pass",
      "preservation": "pass",
      "faithfulness": "unclear",
      "disposition": "conflict_open",
      "reviewer": "maintainer",
      "reviewed_at": "2001-01-02T00:04:00Z",
      "rationale": "Keep both outcomes visible until the conflict is resolved."
    }
  ]
}
EOF

node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" validate-session-review --root "$TMP_DIR" --contract "$TMP_DIR/session-review.json" >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" bridge-session-review --root "$TMP_DIR" --contract "$TMP_DIR/session-review.json" >/dev/null

python3 - "$TMP_DIR/.mem_inbox/signals/reviewed-session-gap.json" "$TMP_DIR/.mem_inbox/signals" <<'PY'
import json
import sys
from pathlib import Path

signal = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
signal_dir = Path(sys.argv[2])
assert signal["status"] == "pending"
assert signal["source_channel"] == "goal-review"
assert ".bagakit/goal/reviews/round-1.json" in signal["local_refs"]
assert "docs/session/session-evidence.md" in signal["local_refs"]
assert "docs/session/counterevidence.md" in signal["local_refs"]
assert "privacy_disposition: approved_slices" in signal["evidence"]
assert "retention_disposition: expires" in signal["evidence"]
assert "review_disposition: accepted" in signal["evidence"]
assert "reviewed_at: 2001-01-02T00:04:00Z" in signal["evidence"]
assert "source_span: docs/session/session-evidence.md @ lines:1-1" in signal["evidence"]
assert "counterevidence_ref: docs/session/counterevidence.md" in signal["evidence"]
assert "conflicts_with: older-session-guidance" in signal["evidence"]
for blocked in ["rejected-session-gap", "needs-more-session-gap", "open-conflict-session-gap"]:
    assert not (signal_dir / f"{blocked}.json").exists()
PY

python3 - "$TMP_DIR/session-review.json" "$TMP_DIR/session-review-collision.json" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
payload["candidates"][0]["proposed_generalization"] = "Replace the first pending signal with weaker guidance."
Path(sys.argv[2]).write_text(json.dumps(payload), encoding="utf-8")
PY
if node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" bridge-session-review --root "$TMP_DIR" --contract "$TMP_DIR/session-review-collision.json" >/dev/null 2>"$TMP_DIR/session-collision.err"; then
  echo "error: session review unexpectedly rewrote a pending signal collision" >&2
  exit 1
fi
grep -q 'pending signal collision would rewrite existing intake' "$TMP_DIR/session-collision.err"
python3 - "$TMP_DIR/.mem_inbox/signals/reviewed-session-gap.json" <<'PY'
import json
import sys
from pathlib import Path

signal = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert signal["summary"] == "Require the evidence check before reusable session learning enters Evolver."
PY

if find "$TMP_DIR/.bagakit/evolver/topics" -mindepth 1 -print -quit | grep -q .; then
  echo "error: session review bridge unexpectedly created a topic" >&2
  exit 1
fi

python3 - "$TMP_DIR/session-review.json" "$TMP_DIR/invalid-session-review.json" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
payload["reviews"][0]["faithfulness"] = "fail"
Path(sys.argv[2]).write_text(json.dumps(payload), encoding="utf-8")
PY
if node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" validate-session-review --root "$TMP_DIR" --contract "$TMP_DIR/invalid-session-review.json" >/dev/null 2>&1; then
  echo "error: accepted session review unexpectedly passed with failed faithfulness" >&2
  exit 1
fi

python3 - "$TMP_DIR/session-review.json" "$TMP_DIR/raw-session-review.json" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
payload["raw_transcript"] = [{"role": "user", "content": "must not persist"}]
Path(sys.argv[2]).write_text(json.dumps(payload), encoding="utf-8")
PY
if node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" validate-session-review --root "$TMP_DIR" --contract "$TMP_DIR/raw-session-review.json" >/dev/null 2>&1; then
  echo "error: session review unexpectedly accepted a raw transcript payload" >&2
  exit 1
fi

python3 - "$TMP_DIR/session-review.json" "$TMP_DIR/oversized-session-review.json" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
payload["candidates"][0]["statement"] = "raw-turn " * 5000
Path(sys.argv[2]).write_text(json.dumps(payload), encoding="utf-8")
PY
if node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" validate-session-review --root "$TMP_DIR" --contract "$TMP_DIR/oversized-session-review.json" >/dev/null 2>&1; then
  echo "error: session review unexpectedly accepted transcript-sized candidate text" >&2
  exit 1
fi

python3 - "$TMP_DIR/session-review.json" "$TMP_DIR/missing-source-review.json" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
payload["session_evidence"]["source_refs"].append("docs/session/missing.md")
Path(sys.argv[2]).write_text(json.dumps(payload), encoding="utf-8")
PY
if node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" validate-session-review --root "$TMP_DIR" --contract "$TMP_DIR/missing-source-review.json" >/dev/null 2>&1; then
  echo "error: session review unexpectedly accepted a missing retained source ref" >&2
  exit 1
fi

python3 - "$TMP_DIR/session-review.json" "$TMP_DIR/restricted-session-review.json" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
payload["session_evidence"]["sensitivity"] = "restricted"
payload["session_evidence"]["privacy_disposition"] = "restricted"
Path(sys.argv[2]).write_text(json.dumps(payload), encoding="utf-8")
PY
if node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" validate-session-review --root "$TMP_DIR" --contract "$TMP_DIR/restricted-session-review.json" >/dev/null 2>&1; then
  echo "error: session review unexpectedly accepted restricted evidence for a new signal" >&2
  exit 1
fi

python3 - "$TMP_DIR/session-review.json" "$TMP_DIR/expired-session-review.json" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
payload["session_evidence"]["retention_disposition"] = "expired"
payload["session_evidence"].pop("retention_until")
Path(sys.argv[2]).write_text(json.dumps(payload), encoding="utf-8")
PY
if node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" validate-session-review --root "$TMP_DIR" --contract "$TMP_DIR/expired-session-review.json" >/dev/null 2>&1; then
  echo "error: session review unexpectedly accepted expired evidence for a new signal" >&2
  exit 1
fi

python3 - "$TMP_DIR/session-review.json" "$TMP_DIR/late-review.json" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
payload["reviews"][0]["reviewed_at"] = "2001-03-03T00:00:00Z"
payload["generated_at"] = "2001-03-04T00:00:00Z"
Path(sys.argv[2]).write_text(json.dumps(payload), encoding="utf-8")
PY
if node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" validate-session-review --root "$TMP_DIR" --contract "$TMP_DIR/late-review.json" >/dev/null 2>&1; then
  echo "error: session review unexpectedly accepted review after evidence expiry" >&2
  exit 1
fi

cp "$TMP_DIR/.bagakit/goal/reviews/round-1.json" "$TMP_DIR/.bagakit/goal/reviews/round-1.valid.json"
python3 - "$TMP_DIR/.bagakit/goal/reviews/round-1.json" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
payload = json.loads(path.read_text(encoding="utf-8"))
payload["goal_id"] = "../invalid-goal"
payload["trigger"] = "hourly"
payload["drift"] = {"raw": "invalid"}
payload["next_instruction"] = {"raw": "invalid"}
path.write_text(json.dumps(payload), encoding="utf-8")
PY
if node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" validate-session-review --root "$TMP_DIR" --contract "$TMP_DIR/session-review.json" >/dev/null 2>&1; then
  echo "error: session review unexpectedly accepted an invalid Goal review receipt" >&2
  exit 1
fi
mv "$TMP_DIR/.bagakit/goal/reviews/round-1.valid.json" "$TMP_DIR/.bagakit/goal/reviews/round-1.json"

node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" capture-signal --root "$TMP_DIR" --signal living-doc-taxonomy --kind decision --title "Doc taxonomy signal" --summary "shared doc taxonomy keeps drifting" --producer bagakit-living-knowledge --channel host --topic-hint demo-evolver --confidence 0.8 --evidence "host-side churn" --local-refs docs/specs/demo-rule.md >/dev/null

EXPORT_JSON="$TMP_DIR/signals.json"
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" export-signals --root "$TMP_DIR" --status pending --output "$EXPORT_JSON" >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" validate-signals --root "$TMP_DIR" --contract "$EXPORT_JSON" >/dev/null

cat > "$TMP_DIR/import-signals.json" <<'EOF'
{
  "schema": "bagakit.evolver.signal.v1",
  "producer": "external-review",
  "generated_at": "2026-04-20T00:00:00Z",
  "signals": [
    {
      "version": 1,
      "id": "external-gap",
      "kind": "gotcha",
      "title": "External gap signal",
      "summary": "one external review highlighted a reusable gap",
      "producer": "external-review",
      "source_channel": "external",
      "topic_hint": "demo-evolver",
      "confidence": 0.7,
      "evidence": ["external review"],
      "local_refs": ["docs/specs/demo-rule.md"],
      "status": "pending",
      "created_at": "2026-04-20T00:00:00Z",
      "updated_at": "2026-04-20T00:00:00Z"
    }
  ]
}
EOF
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" import-signals --root "$TMP_DIR" --contract "$TMP_DIR/import-signals.json" >/dev/null

node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" init-topic --root "$TMP_DIR" --slug demo-evolver --title "Demo Evolver" >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" preflight --root "$TMP_DIR" --topic demo-evolver --decision track --rationale "repo-level learning" >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" adopt-signal --root "$TMP_DIR" --signal living-doc-taxonomy --topic demo-evolver --source-id sig1 --source-kind doc --note "capture the substrate-side drift" >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" dismiss-signal --root "$TMP_DIR" --signal external-gap --note "too weak for repository-level tracking" >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" add-candidate --root "$TMP_DIR" --topic demo-evolver --candidate c1 --kind local --source skills/harness/demo --summary "candidate" >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" add-source --root "$TMP_DIR" --topic demo-evolver --source-id s1 --kind doc --title "Demo Rule" --origin manual --local-ref docs/specs/demo-rule.md >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" add-feedback --root "$TMP_DIR" --topic demo-evolver --channel maintainer --signal positive --detail "looks reusable" >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" add-benchmark --root "$TMP_DIR" --topic demo-evolver --benchmark b1 --metric report_quality --result pass --detail "report stays concise" >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" record-decision --root "$TMP_DIR" --topic demo-evolver --decision "Promote demo rule" --rationale "holds outside one task" --candidate c1 >/dev/null

if node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" record-promotion --root "$TMP_DIR" --topic demo-evolver --surface spec --target docs/specs/demo-rule.md --summary "land demo rule" --promotion demo-rule --status landed --ref docs/specs/demo-rule.md >/dev/null 2>&1; then
  echo "error: landed promotion unexpectedly accepted without proof refs" >&2
  exit 1
fi

node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" record-promotion --root "$TMP_DIR" --topic demo-evolver --surface spec --target docs/specs/demo-rule.md --summary "land demo rule" --promotion demo-rule --status landed --ref docs/specs/demo-rule.md --proof-refs docs/specs/demo-rule-proof.md >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" set-route --root "$TMP_DIR" --topic demo-evolver --decision upstream --rationale "reusable upstream lesson" --upstream-promotions demo-rule >/dev/null

READINESS_JSON="$TMP_DIR/readiness.json"
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" promotion-readiness --root "$TMP_DIR" --topic demo-evolver --json > "$READINESS_JSON"
python3 - "$READINESS_JSON" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert payload["state"] == "upstream-landed"
assert payload["route_decision"] == "upstream"
assert payload["archive_ready"] is True
assert payload["referenced_promotions"][0]["proof_refs"] == ["docs/specs/demo-rule-proof.md"]
PY

LIST_JSON="$TMP_DIR/signals-after.json"
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" list-signals --root "$TMP_DIR" --json > "$LIST_JSON"
python3 - "$LIST_JSON" <<'PY'
import json
import sys
from pathlib import Path

signals = {item["id"]: item for item in json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))}
assert signals["living-doc-taxonomy"]["status"] == "adopted"
assert signals["living-doc-taxonomy"]["adopted_topic"] == "demo-evolver"
assert signals["external-gap"]["status"] == "dismissed"
PY

TOPIC_JSON="$TMP_DIR/.bagakit/evolver/topics/demo-evolver/topic.json"
python3 - "$TOPIC_JSON" <<'PY'
import json
import sys
from pathlib import Path

topic = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert any(source["id"] == "sig1" for source in topic["sources"])
assert any(note["title"] == "signal:living-doc-taxonomy" for note in topic["notes"])
assert "docs/specs/demo-rule.md" in topic["local_context_refs"]
PY

test -f "$TMP_DIR/.mem_inbox/README.md"
grep -q "living-doc-taxonomy" "$TMP_DIR/.mem_inbox/README.md"

HANDOFF_FILE="$TMP_DIR/.bagakit/evolver/topics/demo-evolver/HANDOFF.md"
test -f "$HANDOFF_FILE"
grep -q "## Strongest Evidence" "$HANDOFF_FILE"
grep -q "## Open Promotion Actions" "$HANDOFF_FILE"

node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" archive-topic --root "$TMP_DIR" --topic demo-evolver --summary "archive the demo evolver topic" >/dev/null
ARCHIVE_FILE="$TMP_DIR/.bagakit/evolver/topics/demo-evolver/ARCHIVE.md"
test -f "$ARCHIVE_FILE"
grep -q "## Promotion Trail" "$ARCHIVE_FILE"
grep -q "docs/specs/demo-rule-proof.md" "$ARCHIVE_FILE"

node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" check --root "$TMP_DIR" >/dev/null

echo "ok: bagakit-skill-evolver canonical smoke passed"
