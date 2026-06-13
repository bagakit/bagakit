#!/usr/bin/env python3
"""Check explicit repository-relative Markdown references in active docs.

Historical ``mem/`` notes and parameterized ``<shared_root>/...`` examples are
intentionally outside this gate; they describe prior or optional surfaces.
"""
from __future__ import annotations
import argparse
import re
import tempfile
from pathlib import Path

LINK = re.compile(r"\[[^\]]*\]\(([^)#\s]+)(?:#[^)]*)?\)")
CODE = re.compile(r"`([^`\n]+)`")
ROOT_PREFIXES = ("docs/", "dev/", "gate_eval/", "gate_validation/", "host-harnesses/", "mem/", "scripts/", "skills/", "blogs/")

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    root = args.root.resolve()
    if args.self_test:
        errors = check(root)
        if errors:
            print("\n".join(errors))
            return 1
        with tempfile.TemporaryDirectory() as directory:
            fixture = Path(directory)
            (fixture / "docs").mkdir()
            (fixture / "README.md").write_text("[ok](docs/spec.md)\n", encoding="utf-8")
            (fixture / "docs/spec.md").write_text("# ok\n", encoding="utf-8")
            assert check(fixture) == []
            (fixture / "README.md").write_text("[missing](docs/missing.md)\n", encoding="utf-8")
            assert check(fixture)
        print("documentation reference self-test: ok")
        return 0
    errors = check(root)
    if errors:
        print("\n".join(errors))
        return 1
    print("documentation references: ok")
    return 0

def check(root: Path) -> list[str]:
    errors: list[str] = []
    files = [root / "README.md", root / "AGENTS.md", *sorted((root / "docs").rglob("*.md"))]
    for path in files:
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        refs = [x for x in LINK.findall(text) if not x.startswith(("http://", "https://", "mailto:"))]
        refs.extend(x for x in CODE.findall(text) if x.startswith(ROOT_PREFIXES))
        for ref in sorted(x.rstrip(".,:") for x in refs if "<" not in x and "*" not in x and " " not in x):
            target = root / ref if ref.startswith(ROOT_PREFIXES) else path.parent / ref
            if not target.exists():
                errors.append(f"{path.relative_to(root)}: missing link {ref}")
    return errors

if __name__ == "__main__":
    raise SystemExit(main())
