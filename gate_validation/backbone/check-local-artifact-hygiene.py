"""Check that generated local artifacts stay out of steady-state repo roots."""

from __future__ import annotations

import argparse
import fnmatch
import sys
from pathlib import Path


ALLOWED_ROOT_DIRS = {
    ".bagakit",
    ".codex",
    ".git",
    ".github",
    ".mem_inbox",
    ".tmp",
    "blogs",
    "catalog",
    "dev",
    "docs",
    "gate_eval",
    "gate_validation",
    "host-harnesses",
    "mem",
    "node_modules",
    "scripts",
    "skills",
}

FORBIDDEN_SKILL_DIR_NAMES = {
    ".cache",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".tmp",
    "__pycache__",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "tmp",
}

FORBIDDEN_ROOT_PATTERNS = [
    ".dist-*",
    "dist_*",
    "tmp",
    "temp",
    ".temp",
    "cache",
    ".cache",
    "build",
    "coverage",
    "playwright-report",
    "test-results",
    "site",
    "dist",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    return parser.parse_args()


def rel(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def root_dir_issues(root: Path) -> list[str]:
    issues: list[str] = []
    for child in sorted(root.iterdir(), key=lambda path: path.name):
        if not child.is_dir():
            continue
        name = child.name
        if name in ALLOWED_ROOT_DIRS:
            continue
        if any(fnmatch.fnmatchcase(name, pattern) for pattern in FORBIDDEN_ROOT_PATTERNS):
            issues.append(
                f"temporary or generated root directory must move under .tmp/ or be cleaned: {name}"
            )
            continue
        issues.append(
            f"unexpected root directory outside the canonical boundary: {name}"
        )
    return issues


def skill_payload_issues(root: Path) -> list[str]:
    skills_root = root / "skills"
    if not skills_root.is_dir():
        return []

    issues: list[str] = []
    for path in sorted(skills_root.rglob("*")):
        if not path.is_dir():
            continue
        if path.name not in FORBIDDEN_SKILL_DIR_NAMES:
            continue
        issues.append(
            "generated directory inside installable skill payload: "
            f"{rel(path, root)}"
        )
    return issues


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    if not root.is_dir():
        print(f"repo root not found: {root}", file=sys.stderr)
        return 2

    issues = root_dir_issues(root)
    issues.extend(skill_payload_issues(root))

    if issues:
        for issue in issues:
            print(issue, file=sys.stderr)
        print(
            "local artifact hygiene failed; use .tmp/<tool-or-task>/ for ad hoc scratch output",
            file=sys.stderr,
        )
        return 1

    print("local artifact hygiene passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
