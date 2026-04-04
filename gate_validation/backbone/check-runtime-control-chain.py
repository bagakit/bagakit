"""Check runtime-control-chain contract anchors across architecture and specs."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


EXPECTED_TOKENS = {
    "docs/architecture/C4-runtime-control-chain.md": [
        "operator surface",
        "execution host",
        "flow protocol",
        "runner substrate",
        "harness skills",
        "domain state types",
        "mutation services",
        "read services",
        "receipts",
        "projections",
        "persistence safety",
        "contract and boundary tests",
        "operator displays",
        "connector delivery",
        "host stop policy",
        "runner process launch",
        "skill domain behavior",
        "a receipt proves one accepted protocol mutation",
        "host exhaust and connector delivery receipts remain outside protocol truth",
        "Validation plan",
    ],
    "docs/specs/flow-runner-contract.md": [
        "## Mutation Receipt Rule",
        "`receipt_id`: unique protocol receipt identity",
        "`authority`: `runner_local` or `source_mirror`",
        "`events`: field-level before or after JSON-safe mutation events",
        "bagakit/flow-runner/checkpoint/v2",
        "appends one progress receipt to `progress.ndjson`",
        "bagakit/flow-runner/snapshot/v1",
        "bagakit/flow-runner/feature-activation/v1",
        "invalid stages fail before any checkpoint or progress receipt is appended",
        "tracker-sourced items reject direct `--item-status` mutation overrides",
        "host exhaust, runner stdout, and notification delivery receipts do not count",
    ],
    "docs/specs/agent-loop-contract.md": [
        "runner-sessions/` is host exhaust",
        "Neither surface becomes flow-runner truth",
        "runner stdout as control-plane truth",
        "flow-runner checkpoint and progress receipts",
        "It does not synthesize flow-runner checkpoints on the runner's behalf",
        "Delivery receipts currently use schema",
        "They belong to host exhaust only",
    ],
    "gate_validation/skills/harness/bagakit-flow-runner/check-flow-runner.sh": [
        'payload["schema"] == "bagakit/flow-runner/feature-activation/v1"',
        'payload["recommended_action"] == "run_session"',
        "bagakit/flow-runner/mutation-receipt/v1",
        "--stage bogus",
        "tracker-sourced item unexpectedly accepted --item-status override",
        "bash \"$FLOW_RUNNER_DIR/scripts/flow-runner.sh\" validate --root \"$TMP_DIR\"",
    ],
    "gate_validation/dev/agent_loop/check-agent-loop.sh": [
        "session-observation.json",
        "bagakit/agent-loop/session-observation/v1",
        "host_notification_request",
        "deliver-notification",
        "operator_action_required",
    ],
}

FORBIDDEN_TOKENS = {
    "skills/harness/bagakit-flow-runner": [
        "session-observation.json",
        "bagakit/agent-loop/session-observation/v1",
    ],
    "skills/harness/bagakit-flow-runner/scripts/lib/protocol": [
        "dev/agent_loop",
        "deliver-notification",
        "host_notification_request",
        "spawnSync",
        "child_process",
    ],
}

FORBIDDEN_IMPORTS = {
    "skills/harness/bagakit-flow-runner/scripts/lib/protocol": [
        "node:child_process",
        "dev/agent_loop",
        "dev/agent_runner",
    ],
    "dev/agent_loop/src": [
        "skills/harness/bagakit-flow-runner/scripts/lib/protocol",
    ],
    "dev/agent_runner/test": [
        "skills/harness/bagakit-flow-runner",
        "skills/harness/",
    ],
}

IMPORT_RE = re.compile(r"""(?:from\s+["']([^"']+)["']|import\s*\([^)]*["']([^"']+)["'][^)]*\)|import\s+["']([^"']+)["'])""")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, help="repo root")
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    failures: list[str] = []

    for rel_path, tokens in EXPECTED_TOKENS.items():
        path = root / rel_path
        if not path.is_file():
            failures.append(f"missing required file: {rel_path}")
            continue
        text = path.read_text(encoding="utf-8")
        for token in tokens:
            if token not in text:
                failures.append(f"{rel_path} missing token: {token}")

    for rel_path, tokens in FORBIDDEN_TOKENS.items():
        path = root / rel_path
        if not path.exists():
            failures.append(f"missing boundary path: {rel_path}")
            continue
        files = [path] if path.is_file() else [p for p in path.rglob("*") if p.is_file()]
        for file_path in files:
            try:
                text = file_path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            for token in tokens:
                if token in text:
                    failures.append(f"{file_path.relative_to(root)} contains forbidden boundary token: {token}")

    for rel_path, imports in FORBIDDEN_IMPORTS.items():
        path = root / rel_path
        if not path.exists():
            failures.append(f"missing import-boundary path: {rel_path}")
            continue
        for file_path in path.rglob("*.ts"):
            text = file_path.read_text(encoding="utf-8")
            imported_modules = [match.group(1) or match.group(2) or match.group(3) or "" for match in IMPORT_RE.finditer(text)]
            for imported_module in imported_modules:
                for forbidden in imports:
                    if forbidden in imported_module:
                        failures.append(
                            f"{file_path.relative_to(root)} imports forbidden boundary module: {imported_module}"
                        )

    if failures:
        for failure in failures:
            print(f"error: {failure}", file=sys.stderr)
        return 1

    print("ok: runtime-control-chain contract anchors are present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
