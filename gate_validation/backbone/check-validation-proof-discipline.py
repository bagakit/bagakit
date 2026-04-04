"""Check validation proof-surface guidance anchors."""

from __future__ import annotations

import argparse
from pathlib import Path


REQUIRED_PHRASES = {
    "AGENTS.md": [
        "Validation should prove public behavior or owned contract text",
        "docs/stewardship/sop/validation-sop.md",
    ],
    "docs/specs/validation-system.md": [
        "source text checks only when that text is the published contract",
        "asserting private source strings, method names, imports, comments",
    ],
    "docs/stewardship/sop/validation-sop.md": [
        "the behavior or boundary being protected",
        "the independent oracle that proves it",
        "Source inspection is valid only when the inspected text is itself the published",
        'proof_mode = "wording_contract"',
        "source grep is usually a change-detector test",
        "skill text may be runtime payload",
    ],
    "dev/validator/README.md": [
        "source grep is a valid proof surface only when the source text is itself",
        "docs/stewardship/sop/validation-sop.md",
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
        print("validation proof discipline check failed:")
        for item in missing:
            print(f"- {item}")
        return 1
    print("ok: validation proof discipline anchors present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
