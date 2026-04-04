"""Check researcher wiki maintenance wording contract anchors."""

from __future__ import annotations

import argparse
from pathlib import Path


REQUIRED_PHRASES = {
    "skills/harness/bagakit-researcher/SKILL.md": [
        "reads the wiki inherits a maintenance duty",
        "Before new research, refresh or inspect the researcher frontdoor",
    ],
    "skills/harness/bagakit-researcher/references/research-workspace-spec.md": [
        "maintenance means updating topic evidence first",
    ],
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository root")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    missing: list[str] = []

    for rel_path, phrases in REQUIRED_PHRASES.items():
        path = root / rel_path
        if not path.is_file():
            missing.append(f"{rel_path}: missing file")
            continue
        text = path.read_text(encoding="utf-8")
        for phrase in phrases:
            if phrase not in text:
                missing.append(f"{rel_path}: missing phrase: {phrase}")

    if missing:
        print("researcher wiki contract check failed:")
        for item in missing:
            print(f"- {item}")
        return 1

    print("ok: researcher wiki maintenance wording contract anchors present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
