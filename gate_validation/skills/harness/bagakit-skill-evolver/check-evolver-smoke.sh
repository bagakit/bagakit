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
printf 'accepted by maintainer\n' > "$TMP_DIR/docs/specs/demo-rule-acceptance.md"
printf 'proof plan\n' > "$TMP_DIR/docs/specs/demo-rule-proof-plan.md"
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

if node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" archive-topic --root "$TMP_DIR" --topic demo-evolver --summary "premature archive" >/dev/null 2>"$TMP_DIR/archive-before-ready.err"; then
  echo "error: archive unexpectedly bypassed promotion readiness" >&2
  exit 1
fi
grep -q 'archive blocked' "$TMP_DIR/archive-before-ready.err"

if node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" record-promotion --root "$TMP_DIR" --topic demo-evolver --surface spec --target docs/specs/demo-rule.md --summary "land demo rule" --promotion demo-rule --status landed_verified --ref docs/specs/demo-rule.md >/dev/null 2>&1; then
  echo "error: landed promotion unexpectedly accepted without proof refs" >&2
  exit 1
fi

node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" record-promotion --root "$TMP_DIR" --topic demo-evolver --surface spec --target docs/specs/demo-rule.md --summary "land demo rule" --promotion demo-rule --status landed_verified --ref docs/specs/demo-rule.md --proof-refs docs/specs/demo-rule-proof.md >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" promote-candidate --root "$TMP_DIR" --topic demo-evolver --candidate c1 --note "candidate accepted for landing" >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" set-route --root "$TMP_DIR" --topic demo-evolver --decision upstream --rationale "reusable upstream lesson" --acceptance-authority maintainer --acceptance-ref docs/specs/demo-rule-acceptance.md --counterevidence-disposition open --target-owner docs-specs-maintainers --proof-plan demo-rule-contract-proof --proof-plan-ref docs/specs/demo-rule-proof-plan.md --upstream-promotions demo-rule >/dev/null
if node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" set-topic-status --root "$TMP_DIR" --topic demo-evolver --status archived >/dev/null 2>"$TMP_DIR/archive-open-counterevidence.err"; then
  echo "error: set-topic-status unexpectedly archived with open counterevidence" >&2
  exit 1
fi
grep -q 'open counterevidence' "$TMP_DIR/archive-open-counterevidence.err"
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" set-route --root "$TMP_DIR" --topic demo-evolver --decision upstream --rationale "reusable upstream lesson" --acceptance-authority maintainer --acceptance-ref docs/specs/demo-rule-acceptance.md --counterevidence-disposition addressed --target-owner docs-specs-maintainers --proof-plan demo-rule-contract-proof --proof-plan-ref docs/specs/demo-rule-proof-plan.md --upstream-promotions demo-rule >/dev/null

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
assert payload["blockers"] == []
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

rm "$TMP_DIR/docs/specs/demo-rule-proof.md"
if node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" archive-topic --root "$TMP_DIR" --topic demo-evolver --summary "archive with missing current proof" >/dev/null 2>"$TMP_DIR/archive-missing-proof.err"; then
  echo "error: archive unexpectedly accepted a missing landed proof ref" >&2
  exit 1
fi
grep -q 'landed promotion proof ref does not currently exist' "$TMP_DIR/archive-missing-proof.err"
printf 'proof\n' > "$TMP_DIR/docs/specs/demo-rule-proof.md"

rm "$TMP_DIR/docs/specs/demo-rule.md"
if node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" archive-topic --root "$TMP_DIR" --topic demo-evolver --summary "archive with missing current landing" >/dev/null 2>"$TMP_DIR/archive-missing-landing.err"; then
  echo "error: archive unexpectedly accepted a missing landed ref" >&2
  exit 1
fi
grep -q 'landed promotion ref does not currently exist' "$TMP_DIR/archive-missing-landing.err"
printf 'spec\n' > "$TMP_DIR/docs/specs/demo-rule.md"

node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" archive-topic --root "$TMP_DIR" --topic demo-evolver --summary "archive the demo evolver topic" >/dev/null
ARCHIVE_FILE="$TMP_DIR/.bagakit/evolver/topics/demo-evolver/ARCHIVE.md"
test -f "$ARCHIVE_FILE"
grep -q "## Promotion Trail" "$ARCHIVE_FILE"
grep -q "docs/specs/demo-rule-proof.md" "$ARCHIVE_FILE"

python3 - "$TOPIC_JSON" <<'PY'
import json
import sys
from pathlib import Path

topic = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
promotion = next(item for item in topic["promotions"] if item["id"] == "demo-rule")
assert promotion["surface"] == "spec"
assert "model_fit_review" not in promotion
PY

mkdir -p "$TMP_DIR/skills/harness/demo"
printf '%s\n' '# Demo Skill' > "$TMP_DIR/skills/harness/demo/SKILL.md"
printf 'skill proof\n' > "$TMP_DIR/docs/specs/demo-skill-proof.md"
printf 'model fit evidence\n' > "$TMP_DIR/docs/specs/demo-skill-model-fit.md"

node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" init-topic --root "$TMP_DIR" --slug skill-promotion-review --title "Skill Promotion Review" >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" preflight --root "$TMP_DIR" --topic skill-promotion-review --decision track --rationale "skill promotion spans durable model and harness boundaries" >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" add-source --root "$TMP_DIR" --topic skill-promotion-review --source-id model-fit --kind doc --title "Model fit evidence" --origin local-eval --local-ref docs/specs/demo-skill-model-fit.md >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" record-decision --root "$TMP_DIR" --topic skill-promotion-review --decision "Promote the bounded skill" --rationale "the skill keeps hard state and verification boundaries while delegating flexible orchestration" >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" record-promotion --root "$TMP_DIR" --topic skill-promotion-review --surface skill --target skills/harness/demo/SKILL.md --summary "land the low-entropy demo skill" --promotion demo-skill --status proposed >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" set-route --root "$TMP_DIR" --topic skill-promotion-review --decision upstream --rationale "the capability belongs in the reusable skill" --acceptance-authority maintainer --acceptance-ref docs/specs/demo-rule-acceptance.md --counterevidence-disposition addressed --target-owner harness-skill-maintainers --proof-plan demo-skill-contract-proof --proof-plan-ref docs/specs/demo-rule-proof-plan.md --upstream-promotions demo-skill >/dev/null

if node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" record-promotion --root "$TMP_DIR" --topic skill-promotion-review --surface skill --target skills/harness/demo/SKILL.md --summary "land the low-entropy demo skill" --promotion demo-skill --status accepted_for_landing >/dev/null 2>"$TMP_DIR/skill-accept-without-review.err"; then
  echo "error: skill promotion unexpectedly reached accepted_for_landing without model-fit review" >&2
  exit 1
fi
grep -q 'requires a passing model-fit review' "$TMP_DIR/skill-accept-without-review.err"

node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" review-skill-promotion --root "$TMP_DIR" --topic skill-promotion-review --promotion demo-skill --disposition blocked --model-floor "current general-purpose frontier models" --model-owned "flexible planning and tool ordering" --harness-owned "durable state authority verification and recovery" --entropy neutral --entropy-rationale "the proposal still duplicates planning structure" --obsolete-compensation retained_with_evidence --evidence-refs docs/specs/demo-skill-model-fit.md >/dev/null
if node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" record-promotion --root "$TMP_DIR" --topic skill-promotion-review --surface skill --target skills/harness/demo/SKILL.md --summary "land the low-entropy demo skill" --promotion demo-skill --status accepted_for_landing >/dev/null 2>"$TMP_DIR/skill-accept-blocked-review.err"; then
  echo "error: skill promotion unexpectedly accepted a blocked model-fit review" >&2
  exit 1
fi
grep -q 'requires a passing model-fit review' "$TMP_DIR/skill-accept-blocked-review.err"

node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" review-skill-promotion --root "$TMP_DIR" --topic skill-promotion-review --promotion demo-skill --disposition passed --model-floor "current general-purpose frontier models" --model-owned "flexible planning context selection and tool ordering" --harness-owned "authority durable state verification recovery and irreversible actions" --entropy reduced --entropy-rationale "removed duplicated planning stages while preserving proof-bearing boundaries" --obsolete-compensation removed --evidence-refs docs/specs/demo-skill-model-fit.md >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" record-promotion --root "$TMP_DIR" --topic skill-promotion-review --surface skill --target skills/harness/demo/SKILL.md --summary "land the low-entropy demo skill" --promotion demo-skill --status landed_verified --ref skills/harness/demo/SKILL.md --proof-refs docs/specs/demo-skill-proof.md >/dev/null

SKILL_TOPIC_JSON="$TMP_DIR/.bagakit/evolver/topics/skill-promotion-review/topic.json"
python3 - "$SKILL_TOPIC_JSON" <<'PY'
import json
import sys
from pathlib import Path

topic = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
promotion = next(item for item in topic["promotions"] if item["id"] == "demo-skill")
assert promotion["status"] == "landed_verified"
assert promotion["model_fit_review"]["disposition"] == "passed"
assert promotion["model_fit_review"]["entropy_disposition"] == "reduced"
assert promotion["model_fit_review"]["obsolete_compensation_disposition"] == "removed"
PY

node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" record-promotion --root "$TMP_DIR" --topic skill-promotion-review --surface skill --target skills/harness/demo/SKILL.md --summary "land the simplified demo skill v2" --promotion demo-skill --status proposed --ref skills/harness/demo/SKILL.md --proof-refs docs/specs/demo-skill-proof.md >/dev/null
python3 - "$SKILL_TOPIC_JSON" <<'PY'
import json
import sys
from pathlib import Path

topic = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
promotion = next(item for item in topic["promotions"] if item["id"] == "demo-skill")
assert promotion["status"] == "proposed"
assert "model_fit_review" not in promotion
PY
if node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" record-promotion --root "$TMP_DIR" --topic skill-promotion-review --surface skill --target skills/harness/demo/SKILL.md --summary "land the simplified demo skill v2" --promotion demo-skill --status landed_verified --ref skills/harness/demo/SKILL.md --proof-refs docs/specs/demo-skill-proof.md >/dev/null 2>"$TMP_DIR/skill-land-after-semantic-change.err"; then
  echo "error: semantic promotion change unexpectedly preserved model-fit authorization" >&2
  exit 1
fi
grep -q 'requires a passing model-fit review' "$TMP_DIR/skill-land-after-semantic-change.err"

node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" review-skill-promotion --root "$TMP_DIR" --topic skill-promotion-review --promotion demo-skill --disposition passed --model-floor "current general-purpose frontier models" --model-owned "flexible planning context selection and tool ordering" --harness-owned "authority durable state verification recovery and irreversible actions" --entropy neutral --entropy-rationale "the v2 intent keeps the already reduced control surface" --obsolete-compensation none_found --evidence-refs docs/specs/demo-skill-model-fit.md >/dev/null
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" record-promotion --root "$TMP_DIR" --topic skill-promotion-review --surface skill --target skills/harness/demo/SKILL.md --summary "land the simplified demo skill v2" --promotion demo-skill --status landed_verified --ref skills/harness/demo/SKILL.md --proof-refs docs/specs/demo-skill-proof.md >/dev/null

SKILL_READINESS_JSON="$TMP_DIR/skill-readiness.json"
node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" promotion-readiness --root "$TMP_DIR" --topic skill-promotion-review --json > "$SKILL_READINESS_JSON"
python3 - "$SKILL_READINESS_JSON" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert payload["state"] == "upstream-landed"
assert payload["archive_ready"] is True
assert payload["referenced_promotions"][0]["model_fit_review"]["disposition"] == "passed"
assert payload["blockers"] == []
PY

SKILL_HANDOFF="$TMP_DIR/.bagakit/evolver/topics/skill-promotion-review/HANDOFF.md"
grep -q 'model-fit: `passed`' "$SKILL_HANDOFF"
grep -q 'entropy: `neutral`' "$SKILL_HANDOFF"

python3 - "$SKILL_TOPIC_JSON" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
topic = json.loads(path.read_text(encoding="utf-8"))
promotion = next(item for item in topic["promotions"] if item["id"] == "demo-skill")
promotion["summary"] = "direct-edited skill intent"
path.write_text(json.dumps(topic, indent=2) + "\n", encoding="utf-8")
PY
if node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" archive-topic --root "$TMP_DIR" --topic skill-promotion-review --summary "archive with stale direct-edited review" >/dev/null 2>"$TMP_DIR/archive-stale-model-fit.err"; then
  echo "error: archive unexpectedly accepted a stale direct-edited model-fit review" >&2
  exit 1
fi
grep -q 'has a stale model-fit review' "$TMP_DIR/archive-stale-model-fit.err"
python3 - "$SKILL_TOPIC_JSON" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
topic = json.loads(path.read_text(encoding="utf-8"))
promotion = next(item for item in topic["promotions"] if item["id"] == "demo-skill")
promotion["summary"] = "land the simplified demo skill v2"
path.write_text(json.dumps(topic, indent=2) + "\n", encoding="utf-8")
PY

rm "$TMP_DIR/docs/specs/demo-skill-model-fit.md"
if node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" archive-topic --root "$TMP_DIR" --topic skill-promotion-review --summary "archive with missing model-fit evidence" >/dev/null 2>"$TMP_DIR/archive-missing-model-fit.err"; then
  echo "error: archive unexpectedly accepted a missing model-fit evidence ref" >&2
  exit 1
fi
grep -q 'skill promotion model-fit evidence ref does not currently exist' "$TMP_DIR/archive-missing-model-fit.err"
printf 'model fit evidence\n' > "$TMP_DIR/docs/specs/demo-skill-model-fit.md"

node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" archive-topic --root "$TMP_DIR" --topic skill-promotion-review --summary "archive the model-fit-reviewed skill promotion" >/dev/null
SKILL_ARCHIVE="$TMP_DIR/.bagakit/evolver/topics/skill-promotion-review/ARCHIVE.md"
grep -q 'model-fit: `passed`' "$SKILL_ARCHIVE"
grep -q 'obsolete compensation: `none_found`' "$SKILL_ARCHIVE"

node --experimental-strip-types "$EVOLVER_DIR/scripts/evolver.ts" check --root "$TMP_DIR" >/dev/null

echo "ok: bagakit-skill-evolver canonical smoke passed"
