#!/usr/bin/env python3
"""Check that the stable living-knowledge spec stays aligned with runtime docs."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


TOKENS_BY_FILE = {
    "docs/specs/living-knowledge-system.md": [
        ".bagakit/knowledge_conf.toml",
        "shared_root = \"docs\"",
        "system_root = \"docs\"",
        "must-guidebook.md",
        "must-authority.md",
        "must-sop.md",
        "must-recall.md",
        "norms-maintaining-reusable-items.md",
        ".bagakit/living-knowledge/.generated",
        ".bagakit/researcher",
        ".bagakit/skill-selector",
        ".bagakit/evolver",
        "repo-relative paths only",
        "absolute filesystem paths are forbidden",
        "short opaque repo-local",
        "must not encode time",
        "raw source-path or action-time metadata",
    ],
    "skills/harness/bagakit-living-knowledge/SKILL.md": [
        ".bagakit/knowledge_conf.toml",
        "must-guidebook.md",
        "must-authority.md",
        "must-sop.md",
        "must-recall.md",
        "norms-maintaining-reusable-items.md",
        "BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR",
        "bagakit-researcher",
        "bagakit-skill-selector",
        "bagakit-skill-evolver",
        "repo-relative paths only",
        "absolute filesystem paths are forbidden",
        "short opaque",
        "wall-clock dates",
        "source file names",
        "source file contents",
        "captured_at",
    ],
    "skills/harness/bagakit-living-knowledge/README.md": [
        ".bagakit/knowledge_conf.toml",
        "must-guidebook.md",
        "must-authority.md",
        "must-sop.md",
        "must-recall.md",
        "norms-maintaining-reusable-items.md",
        "BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR",
        ".bagakit/living-knowledge/.generated/",
        "repo-relative paths only",
        "absolute filesystem paths",
        "opaque repo-local id",
        "howto-learning-20260426.md",
        "source_path",
        "captured_at",
    ],
    "skills/harness/bagakit-living-knowledge/playbook/tpl/agents-block-template.md": [
        ".bagakit/knowledge_conf.toml",
        "must-guidebook.md",
        "must-authority.md",
        "must-sop.md",
        "must-recall.md",
        "reusable-items",
        "BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR",
        "repo-relative-installed-skill-dir",
        "absolute filesystem paths",
        "short opaque id",
        "timestamped capture name",
    ],
    "skills/harness/bagakit-living-knowledge/playbook/tpl/must-authority-template.md": [
        "repo-relative",
        "absolute filesystem paths are forbidden",
        "short opaque id",
        "k-2ab7qxk9",
        "timestamp-derived names",
        "raw source file names",
        "source file contents",
    ],
    "skills/harness/bagakit-living-knowledge/playbook/tpl/shared-page-template.md": [
        "repo-relative path or external link",
        "opaque id",
        "absolute filesystem paths",
        "source-path/action-time metadata",
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
        "<path-to-bagakit-living-knowledge-skill>",
    ],
    "skills/harness/bagakit-living-knowledge/README.md": [
        "knowledge/inbox/",
        "knowledge/memory/",
        ".bagakit/living-knowledge/private/",
        ".bagakit/living-knowledge/signals/",
        ".bagakit/living-knowledge/runs/",
        "sh scripts/bagakit-living-knowledge.sh",
        "<path-to-bagakit-living-knowledge-skill>",
    ],
    "skills/harness/bagakit-living-knowledge/playbook/tpl/agents-block-template.md": [
        "<path-to-bagakit-living-knowledge-skill>",
    ],
}

FORBIDDEN_PATTERNS = {
    "docs/specs/living-knowledge-system.md": [re.compile(r"(?<![A-Za-z0-9_.-])/(?:Users|home|var|tmp|private)/")],
    "skills/harness/bagakit-living-knowledge/SKILL.md": [re.compile(r"(?<![A-Za-z0-9_.-])/(?:Users|home|var|tmp|private)/")],
    "skills/harness/bagakit-living-knowledge/README.md": [re.compile(r"(?<![A-Za-z0-9_.-])/(?:Users|home|var|tmp|private)/")],
    "skills/harness/bagakit-living-knowledge/playbook/tpl/agents-block-template.md": [
        re.compile(r"(?<![A-Za-z0-9_.-])/(?:Users|home|var|tmp|private)/")
    ],
    "skills/harness/bagakit-living-knowledge/playbook/tpl/must-authority-template.md": [
        re.compile(r"(?<![A-Za-z0-9_.-])/(?:Users|home|var|tmp|private)/")
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

    for rel, patterns in FORBIDDEN_PATTERNS.items():
        path = root / rel
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        for pattern in patterns:
            if pattern.search(text):
                failures.append(f"{rel} still matches forbidden pattern: {pattern.pattern}")

    if failures:
        for failure in failures:
            print(f"error: {failure}", file=sys.stderr)
        return 1

    print("ok: living-knowledge spec and runtime docs are aligned on the substrate contract")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
