"""Check that selector mandatory-preflight policy stays aligned across surfaces."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


REQUIRED_PHRASES = {
    "docs/specs/selector-selection-model.md": [
        "selector preflight is mandatory before major implementation starts.",
        "mandatory preflight is the required entry gate for non-trivial Bagakit-shaped work",
        "trivial one-step work may execute directly without selector ceremony",
        "Mandatory selector preflight policy belongs in shared specs and workspace bootstrap guidance, not in per-skill frontmatter.",
    ],
    "docs/specs/selector-planning-entry-routes.md": [
        "This spec assumes selector preflight has already been handled according to:",
        "`docs/specs/selector-selection-model.md`",
        "That means this file starts only after selector has already concluded that one planning-entry route is needed.",
        "Out-of-scope preflight outcomes such as `direct_execute` remain valid, but they are governed by selector preflight policy, not by this route spec.",
    ],
    "docs/specs/bagakit-driver-contract.md": [
        "mandatory selector-preflight policy for non-trivial Bagakit-shaped work",
        "driver files must not redefine, weaken, or recreate that policy.",
    ],
    "docs/stewardship/selector-usage-guidance.md": [
        "For non-trivial Bagakit-shaped work, run selector preflight before major implementation.",
        "Mandatory preflight may still end in `direct_execute` when current coverage is already sufficient or no better candidate exists.",
        "It is not a hidden second control plane.",
    ],
    "skills/harness/bagakit-skill-selector/SKILL.md": [
        "Non-trivial Bagakit-shaped work must enter through selector preflight before major implementation",
        "For each non-trivial Bagakit-shaped task that enters through selector, maintain one structured TOML file.",
        "planning-entry recipes are a narrower subset",
    ],
    "skills/harness/bagakit-skill-selector/README.md": [
        "For non-trivial Bagakit-shaped work, selector preflight is mandatory before major implementation.",
        "initialize `.bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml`",
        "record one typed preflight decision before major implementation begins",
    ],
    "skills/harness/bagakit-skill-selector/references/skill-usage-file-spec.md": [
        "for non-trivial Bagakit-shaped work, initialize this file before major implementation starts",
        "for non-trivial Bagakit-shaped work, this decision must be recorded before major implementation starts",
    ],
    "skills/harness/bagakit-skill-selector/assets/skill-usage.template.toml": [
        "For non-trivial Bagakit-shaped work, initialize selector preflight before",
        "major implementation starts. \"direct_execute\" remains a valid outcome",
    ],
    "AGENTS.md": [
        "For non-trivial Bagakit-shaped work, run selector preflight before major implementation.",
        "selector entry policy:",
        "`docs/specs/selector-selection-model.md`",
    ],
    "skills/harness/bagakit-living-knowledge/playbook/tpl/agents-block-template.md": [
        "Task-level composition/runtime belongs to `bagakit-skill-selector`.",
    ],
}

FORBIDDEN_PHRASES = {
    "docs/stewardship/selector-usage-guidance.md": [
        "If yes, use selector.",
        "Invocation remains a task-level decision.",
        "For substantial tasks, default to considering selector preflight first.",
        "needs a recorded preflight decision in `skill-usage.toml`",
    ],
    "skills/harness/bagakit-skill-selector/SKILL.md": [
        "substantial tasks should consider selector preflight",
        "Once a task chooses selector",
    ],
    "skills/harness/bagakit-skill-selector/README.md": [
        "For non-trivial work, selector preflight is mandatory before major implementation.",
        "the default is to consider selector preflight first",
    ],
    "skills/harness/bagakit-living-knowledge/playbook/tpl/agents-block-template.md": [
        "docs/specs/selector-selection-model.md",
        "run selector preflight before major implementation",
        "Non-trivial Bagakit-shaped task entry",
    ],
}


def normalize(text: str) -> str:
    return " ".join(text.split())


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, help="repo root")
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    failures: list[str] = []

    for rel, phrases in REQUIRED_PHRASES.items():
        path = root / rel
        if not path.is_file():
            failures.append(f"missing required file: {rel}")
            continue
        normalized = normalize(path.read_text(encoding="utf-8"))
        for phrase in phrases:
            if normalize(phrase) not in normalized:
                failures.append(f"{rel} missing phrase: {phrase}")

    for rel, phrases in FORBIDDEN_PHRASES.items():
        path = root / rel
        if not path.is_file():
            continue
        normalized = normalize(path.read_text(encoding="utf-8"))
        for phrase in phrases:
            if normalize(phrase) in normalized:
                failures.append(f"{rel} still contains forbidden phrase: {phrase}")

    if failures:
        for failure in failures:
            print(f"error: {failure}", file=sys.stderr)
        return 1

    print("ok: selector mandatory-preflight policy is aligned across selector specs, runtime docs, and repo bootstrap")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
