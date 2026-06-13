set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_root="$(dirname "$script_dir")"

usage() {
  cat <<'EOF'
usage: bagakit-explain-cli <command>

Commands:
  describe          Print the explain ownership boundary.
  list-references   List references shipped by this skill.
  validate          Check required skill files and references.
  validate-artifact Validate one HTML artifact and optional JSON receipt.
EOF
}

validate_artifact() {
  local artifact="${1:-}"
  local receipt=""
  if [[ -z "$artifact" || "$artifact" == -* ]]; then
    printf '%s\n' 'usage: bagakit-explain-cli validate-artifact <artifact.html> [--receipt <receipt.json>]' >&2
    return 2
  fi
  shift
  if [[ "${1:-}" == "--receipt" ]]; then
    receipt="${2:-}"
    [[ -n "$receipt" ]] || { printf '%s\n' 'missing receipt path' >&2; return 2; }
    shift 2
  fi
  [[ $# -eq 0 ]] || { printf '%s\n' 'unexpected validate-artifact arguments' >&2; return 2; }
  [[ -f "$artifact" ]] || { printf 'missing artifact: %s\n' "$artifact" >&2; return 1; }
  python3 - "$artifact" "$receipt" <<'PY'
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

artifact = Path(sys.argv[1])
receipt_arg = sys.argv[2]
text = artifact.read_text(encoding="utf-8", errors="strict")
lower = text.lower()
errors = []
if artifact.suffix.lower() != ".html":
    errors.append("artifact must use the .html extension")
for marker, label in (("<html", "html root"), ("<title", "title"), ("lang=", "language"), ("<main", "main reading region")):
    if marker not in lower:
        errors.append(f"artifact missing {label}")
if not re.search(r"(?:conclusion|mechanism|map|boundary|limit|结论|机制|边界|限制)", lower):
    errors.append("artifact does not expose an explanation boundary or mechanism")

if receipt_arg:
    receipt_path = Path(receipt_arg)
    if not receipt_path.is_file():
        errors.append(f"missing receipt: {receipt_arg}")
    else:
        try:
            receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"receipt is not valid JSON: {exc}")
        else:
            required = {
                "artifact_path", "language", "primary_diagram_family",
                "motion_decision", "evidence_refs", "desktop_mobile_evidence",
                "changed_case_result", "limits",
            }
            missing = sorted(key for key in required if key not in receipt)
            if missing:
                errors.append("receipt missing fields: " + ", ".join(missing))
            if receipt.get("artifact_path") not in {str(artifact), artifact.name}:
                errors.append("receipt artifact_path does not identify the artifact")

if errors:
    print("explain artifact validation failed:")
    for error in errors:
        print(f"- {error}")
    raise SystemExit(1)
print(json.dumps({"status": "pass", "artifact": str(artifact)}, ensure_ascii=False))
PY
}

case "${1:-}" in
  describe)
    printf '%s\n' "bagakit-explain: novice-first visual HTML explanations with architecture maps, causal depth, and user-language delivery."
    ;;
  list-references)
    find "$skill_root/references" -type f | sed "s#^$skill_root/##" | sort
    ;;
  validate)
    test -f "$skill_root/SKILL.md"
    test -f "$skill_root/agents/openai.yaml"
    test -f "$skill_root/references/frontdoor-rule.toml"
    test -f "$skill_root/references/skill-cli.toml"
    test -f "$skill_root/references/technical-architecture-analysis.md"
    printf '%s\n' "ok: bagakit-explain skill assets are complete"
    ;;
  validate-artifact)
    shift
    validate_artifact "$@"
    ;;
  ""|-h|--help|help)
    usage
    ;;
  *)
    printf 'unknown command: %s\n' "$1" >&2
    usage >&2
    exit 2
    ;;
esac
