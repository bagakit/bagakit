"""Check validation proof-surface guidance anchors."""

from __future__ import annotations

import argparse
from pathlib import Path


REQUIRED_ANCHOR_GROUPS = {
    "AGENTS.md": [
        (
            "validation rule points to the SOP",
            [
                "Validation should prove public behavior or owned contract text",
                "docs/stewardship/sop/validation-sop.md",
            ],
        ),
    ],
    "docs/specs/validation-system.md": [
        (
            "suite proof triple vocabulary",
            ["`protects`", "`oracle`", "`exercised_surface`", "suite-level proof triple"],
        ),
        (
            "proof triple must not become boilerplate",
            ["generic text", "A missing or weak proof", "default `gate_validation/` suites"],
        ),
        (
            "source text is only a contract proof surface",
            ["source text checks", "published contract"],
        ),
        (
            "private implementation shape is not behavior proof",
            ["private source strings", "method names", "imports", "comments"],
        ),
        (
            "historical failures map to guard ids",
            ["historical failure cases", "contract guard ids"],
        ),
    ],
    "docs/stewardship/sop/validation-sop.md": [
        (
            "proof triple questions",
            [
                "the behavior or boundary being protected",
                "the independent oracle that proves it",
                "the public or owned boundary being exercised",
            ],
        ),
        (
            "suite registration fields",
            ["`protects`", "`oracle`", "`exercised_surface`"],
        ),
        (
            "proof triple fields are not boilerplate",
            ["generic boilerplate", "hard-gated", "review prompts"],
        ),
        (
            "source inspection boundary",
            ["Source inspection is valid only", "published", "contract"],
        ),
        (
            "wording contract classification",
            ['proof_mode = "wording_contract"', "generated payload"],
        ),
        (
            "source grep anti-pattern",
            ["source grep", "change-detector test"],
        ),
        (
            "skill text and tool source have different proof surfaces",
            ["skill text may be runtime payload", "tool source code is usually implementation detail"],
        ),
        (
            "skill structured contracts before prose",
            ["structured skill-owned contract files", "`references/`"],
        ),
        (
            "historical failures should not be phrase requirements",
            ["Do not use case fields", "`must_find`"],
        ),
    ],
    "dev/validator/README.md": [
        (
            "validator exposes proof triple metadata",
            ["proof triple", "`protects`", "`oracle`", "`exercised_surface`"],
        ),
        (
            "audit prompts do not invite boilerplate",
            ["missing proof triples", "generic boilerplate", "config loading"],
        ),
        (
            "source grep boundary",
            ["source grep", "published contract"],
        ),
        (
            "skill validation structured-first guidance",
            ["structured contracts", "guard", "generated artifacts"],
        ),
        (
            "detailed SOP link",
            ["docs/stewardship/sop/validation-sop.md"],
        ),
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
    for rel_path, groups in REQUIRED_ANCHOR_GROUPS.items():
        path = root / rel_path
        if not path.is_file():
            missing.append(f"{rel_path}: missing file")
            continue
        text = path.read_text(encoding="utf-8")
        for group_name, anchors in groups:
            if not all(anchor in text for anchor in anchors):
                missing.append(f"{rel_path}: missing anchor group: {group_name}")
    if missing:
        print("validation proof discipline check failed:")
        for item in missing:
            print(f"- {item}")
        return 1
    print("ok: validation proof discipline anchors present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
