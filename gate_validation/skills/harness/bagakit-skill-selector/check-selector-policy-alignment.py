"""Check that selector mandatory-preflight policy stays aligned across surfaces."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


REQUIRED_TOKENS = {
    "docs/specs/selector-selection-model.md": [
        "selector preflight is mandatory before",
        "preflight may still conclude `direct_execute`",
        "trivial one-step work may execute directly without selector ceremony",
        "Mandatory selector preflight policy belongs in shared specs and workspace",
    ],
    "docs/specs/selector-planning-entry-routes.md": [
        "This spec assumes selector preflight has already been handled according to:",
        "planning-entry route is needed",
        "Out-of-scope preflight outcomes such as `direct_execute` remain valid",
    ],
    "docs/stewardship/selector-usage-guidance.md": [
        "run selector preflight before major\nimplementation",
        "Mandatory preflight may still end in `direct_execute`",
        "hidden second control plane",
    ],
    "skills/harness/bagakit-skill-selector/SKILL.md": [
        "must enter through selector preflight before major implementation",
        "selector preflight is the required entry\ngate",
        "`direct_execute` remains valid",
    ],
    "skills/harness/bagakit-skill-selector/README.md": [
        "selector preflight is mandatory before\nmajor implementation",
        "Mandatory preflight may legitimately end in `direct_execute`",
        "record one typed preflight decision before major implementation begins",
    ],
    "skills/harness/bagakit-living-knowledge/playbook/tpl/agents-block-template.md": [
        "run selector preflight before major\n  implementation",
        "Trivial one-step work may still execute directly.",
        "docs/specs/selector-selection-model.md",
    ],
    "AGENTS.md": [
        "selector entry policy:",
        "run selector preflight before major\n  implementation",
    ],
}

FORBIDDEN_TOKENS = {
    "docs/stewardship/selector-usage-guidance.md": [
        "If yes, use selector.",
        "Invocation remains a task-level decision.",
        "For substantial tasks, default to considering selector preflight first.",
    ],
    "skills/harness/bagakit-skill-selector/SKILL.md": [
        "substantial tasks should consider selector preflight",
        "Once a task chooses selector",
    ],
    "skills/harness/bagakit-skill-selector/README.md": [
        "the default is to consider selector preflight first",
    ],
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, help="repo root")
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    failures: list[str] = []

    for rel, tokens in REQUIRED_TOKENS.items():
        path = root / rel
        if not path.is_file():
            failures.append(f"missing required file: {rel}")
            continue
        text = path.read_text(encoding="utf-8")
        for token in tokens:
            if token not in text:
                failures.append(f"{rel} missing token: {token}")

    for rel, tokens in FORBIDDEN_TOKENS.items():
        path = root / rel
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        for token in tokens:
            if token in text:
                failures.append(f"{rel} still contains forbidden token: {token}")

    if failures:
        for failure in failures:
            print(f"error: {failure}", file=sys.stderr)
        return 1

    print("ok: selector mandatory-preflight policy is aligned across specs, runtime docs, and bootstrap")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
