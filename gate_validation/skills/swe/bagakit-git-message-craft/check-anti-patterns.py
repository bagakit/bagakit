#!/usr/bin/env python3
"""Validate the Complexity Guardrails section against validation rules."""

from __future__ import annotations

import argparse
import ast
import re
import sys
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover
    tomllib = None


def load_toml(path: Path) -> dict[str, object]:
    if tomllib is not None:
        with path.open("rb") as handle:
            data = tomllib.load(handle)
        if not isinstance(data, dict):
            raise SystemExit("error: TOML root must be a table")
        return data

    root: dict[str, object] = {}
    current_parts: list[str] = []

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("[") and line.endswith("]"):
            current_parts = [part.strip() for part in line[1:-1].split(".") if part.strip()]
            target = root
            for part in current_parts:
                child = target.get(part)
                if child is None:
                    child = {}
                    target[part] = child
                if not isinstance(child, dict):
                    raise SystemExit(f"error: TOML section path is not a table: {line}")
                target = child
            continue
        if "=" not in line:
            raise SystemExit(f"error: unsupported TOML line: {raw_line}")
        raw_key, raw_value = line.split("=", 1)
        key = raw_key.strip()
        if key.startswith(("'", '"')):
            key = ast.literal_eval(key)
        value = ast.literal_eval(raw_value.strip())
        target = root
        for part in current_parts:
            child = target.get(part)
            if not isinstance(child, dict):
                raise SystemExit(f"error: TOML section path is not a table: {'.'.join(current_parts)}")
            target = child
        target[key] = value

    return root


def section_block(skill_text: str, heading: str) -> str | None:
    match = re.search(rf"(?mi)^##\s+{re.escape(heading)}(?:\s*\(.*\))?\s*$", skill_text)
    if not match:
        return None
    tail = skill_text[match.end() :]
    next_heading = re.search(r"(?m)^##\s+", tail)
    return tail[: next_heading.start()] if next_heading else tail


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skill-md", required=True, help="Path to SKILL.md")
    parser.add_argument("--rules", default="rules.toml", help="Path to rules.toml")
    args = parser.parse_args()

    skill_md = Path(args.skill_md).expanduser().resolve()
    rules_path = Path(args.rules).expanduser().resolve()

    try:
        skill_text = skill_md.read_text(encoding="utf-8")
    except FileNotFoundError:
        print(f"error: missing file: {skill_md}", file=sys.stderr)
        return 1

    try:
        rules = load_toml(rules_path)
    except FileNotFoundError:
        print(f"error: missing file: {rules_path}", file=sys.stderr)
        return 1

    cfg = rules.get("complexity_guardrails")
    if not isinstance(cfg, dict):
        print("error: missing [complexity_guardrails] table", file=sys.stderr)
        return 1

    heading = str(cfg.get("section_heading", "Complexity Guardrails"))
    block = section_block(skill_text, heading)
    if block is None:
        print(f"error: missing section: {heading}", file=sys.stderr)
        return 1

    bullets = re.findall(r"(?m)^\s*-\s+\S", block)
    min_bullets = int(cfg.get("min_bullet_count", 5))
    if len(bullets) < min_bullets:
        print(f"error: section '{heading}' requires >= {min_bullets} bullets", file=sys.stderr)
        return 1

    block_lower = block.lower()
    required_terms = cfg.get("required_terms")
    if not isinstance(required_terms, dict):
        print("error: missing [complexity_guardrails.required_terms]", file=sys.stderr)
        return 1
    for label, terms in required_terms.items():
        if not isinstance(terms, list) or not any(str(term).lower() in block_lower for term in terms):
            print(f"error: section '{heading}' missing coverage for {label}", file=sys.stderr)
            return 1

    print("ok: anti-pattern complexity checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
