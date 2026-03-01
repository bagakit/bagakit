#!/usr/bin/env python3
"""Check that the stable living-knowledge spec stays aligned with runtime docs."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


TOKENS_BY_FILE = {
    "docs/specs/living-knowledge-system.md": [
        ".bagakit/knowledge_conf.toml",
        "shared_root = \"docs\"",
        "system_root = \"docs\"",
        "must-guidebook.md",
        "must-authority.md",
        "must-recall.md",
        ".bagakit/living-knowledge/.generated",
        ".bagakit/researcher",
        ".bagakit/skill-selector",
        ".bagakit/evolver",
    ],
    "skills/harness/bagakit-living-knowledge/SKILL.md": [
        ".bagakit/knowledge_conf.toml",
        "must-guidebook.md",
        "must-authority.md",
        "must-recall.md",
        "BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR",
        "bagakit-researcher",
        "bagakit-skill-selector",
        "bagakit-skill-evolver",
    ],
    "skills/harness/bagakit-living-knowledge/README.md": [
        ".bagakit/knowledge_conf.toml",
        "must-guidebook.md",
        "must-authority.md",
        "must-recall.md",
        "BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR",
        ".bagakit/living-knowledge/.generated/",
    ],
    "skills/harness/bagakit-living-knowledge/playbook/tpl/agents-block-template.md": [
        ".bagakit/knowledge_conf.toml",
        "must-guidebook.md",
        "must-authority.md",
        "must-recall.md",
        "BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR",
    ],
}

FORBIDDEN_SNIPPETS = {
    "skills/harness/bagakit-living-knowledge/SKILL.md": [
        "knowledge/inbox/",
        "knowledge/memory/",
        ".bagakit/living-knowledge/private/",
        ".bagakit/living-knowledge/signals/",
        ".bagakit/living-knowledge/runs/",
        "sh scripts/bagakit-living-knowledge.sh",
    ],
    "skills/harness/bagakit-living-knowledge/README.md": [
        "knowledge/inbox/",
        "knowledge/memory/",
        ".bagakit/living-knowledge/private/",
        ".bagakit/living-knowledge/signals/",
        ".bagakit/living-knowledge/runs/",
        "sh scripts/bagakit-living-knowledge.sh",
    ],
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, help="repo root")
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    failures: list[str] = []

    for rel, tokens in TOKENS_BY_FILE.items():
        path = root / rel
        if not path.is_file():
            failures.append(f"missing required file: {rel}")
            continue
        text = path.read_text(encoding="utf-8")
        for token in tokens:
            if token not in text:
                failures.append(f"{rel} missing token: {token}")

    for rel, snippets in FORBIDDEN_SNIPPETS.items():
        path = root / rel
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        for snippet in snippets:
            if snippet in text:
                failures.append(f"{rel} still contains forbidden snippet: {snippet}")

    if failures:
        for failure in failures:
            print(f"error: {failure}", file=sys.stderr)
        return 1

    print("ok: living-knowledge spec and runtime docs are aligned on the substrate contract")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
