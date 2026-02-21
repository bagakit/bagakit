#!/usr/bin/env python3
"""Render catalog/skills.json from current git submodule state."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GITMODULES = ROOT / ".gitmodules"
OUTPUT = ROOT / "catalog" / "skills.json"

REQUIRED_FILES = (
    "SKILL.md",
    "SKILL_PAYLOAD.json",
    "scripts_dev/test.sh",
)


def run(*args: str, cwd: Path = ROOT, check: bool = True) -> str:
    proc = subprocess.run(
        args,
        cwd=str(cwd),
        check=check,
        text=True,
        capture_output=True,
    )
    return proc.stdout.strip()


def maybe_run(*args: str, cwd: Path = ROOT) -> str | None:
    try:
        return run(*args, cwd=cwd, check=True)
    except subprocess.CalledProcessError:
        return None


def list_submodules() -> list[tuple[str, str]]:
    raw = maybe_run(
        "git",
        "config",
        "-f",
        str(GITMODULES),
        "--get-regexp",
        r"^submodule\..*\.path$",
    )
    if not raw:
        return []

    modules: list[tuple[str, str]] = []
    for line in raw.splitlines():
        key, path = line.split(maxsplit=1)
        name = key[len("submodule.") : -len(".path")]
        rel_path = path.strip()
        root_path = ROOT / rel_path
        if (root_path / "SKILL.md").is_file() and (root_path / "SKILL_PAYLOAD.json").is_file():
            modules.append((name, rel_path))

    modules.sort(key=lambda item: item[1])
    return modules


def build_entry(module_name: str, path_text: str) -> dict[str, object]:
    path = ROOT / path_text
    skill_id = Path(path_text).name

    repo_url = run(
        "git", "config", "-f", str(GITMODULES), "--get", f"submodule.{module_name}.url"
    )
    branch = (
        maybe_run(
            "git",
            "config",
            "-f",
            str(GITMODULES),
            "--get",
            f"submodule.{module_name}.branch",
        )
        or "main"
    )
    commit = run("git", "-C", str(path), "rev-parse", "HEAD")
    dirty = bool(run("git", "-C", str(path), "status", "--short"))

    required_files = {name: (path / name).is_file() for name in REQUIRED_FILES}

    return {
        "id": skill_id,
        "path": path_text,
        "repo": repo_url,
        "branch": branch,
        "commit": commit,
        "dirty": dirty,
        "required_files": required_files,
        "has_openai_agent": (path / "agents" / "openai.yaml").is_file(),
    }


def main() -> int:
    skills = [
        build_entry(module_name, path_text)
        for module_name, path_text in list_submodules()
    ]

    payload = {"schema_version": "1.0.0", "skills": skills}

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)} ({len(skills)} skills)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
