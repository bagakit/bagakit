#!/usr/bin/env python3
"""Validate living-knowledge substrate contract and low-leakage surfaces."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover
    tomllib = None


CONTRACT_PATH = "skills/harness/bagakit-living-knowledge/references/substrate-contract.toml"

REQUIRED_SYSTEM_PAGE_IDS = {
    "must-guidebook",
    "must-authority",
    "must-sop",
    "must-recall",
}

REQUIRED_BOUNDARY_IDS = {
    "researcher-runtime",
    "selector-runtime",
    "evolver-memory",
}

REQUIRED_HYGIENE_RULE_IDS = {
    "repo-relative-paths",
    "no-absolute-paths",
    "opaque-durable-ids",
    "no-raw-source-metadata",
}

FORBIDDEN_SNIPPETS = [
    "knowledge/inbox/",
    "knowledge/memory/",
    ".bagakit/living-knowledge/private/",
    ".bagakit/living-knowledge/signals/",
    ".bagakit/living-knowledge/runs/",
    "<path-to-bagakit-living-knowledge-skill>",
]

ABSOLUTE_PATH_PATTERN = re.compile(
    r"(?<![A-Za-z0-9_.-])/(?:Users|home|var|tmp|private)/"
)


def load_toml(path: Path) -> dict:
    if tomllib is None:
        return load_contract_toml_subset(path)
    with path.open("rb") as handle:
        data = tomllib.load(handle)
    if not isinstance(data, dict):
        raise ValueError("contract root must be a TOML table")
    return data


def parse_scalar(raw: str, line_no: int) -> object:
    value = raw.strip()
    if value.startswith('"') and value.endswith('"'):
        return value[1:-1]
    if value.isdigit():
        return int(value)
    raise ValueError(f"unsupported TOML value on line {line_no}: {raw}")


def load_contract_toml_subset(path: Path) -> dict:
    """Parse the constrained TOML subset used by substrate-contract.toml."""

    data: dict[str, object] = {}
    current: dict[str, object] = data
    current_name = ""

    for line_no, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("[[") and line.endswith("]]"):
            name = line[2:-2].strip()
            if not name:
                raise ValueError(f"empty array table name on line {line_no}")
            bucket = data.setdefault(name, [])
            if not isinstance(bucket, list):
                raise ValueError(f"{name} cannot be both a table and array table")
            entry: dict[str, object] = {}
            bucket.append(entry)
            current = entry
            current_name = name
            continue
        if line.startswith("[") and line.endswith("]"):
            name = line[1:-1].strip()
            if not name:
                raise ValueError(f"empty table name on line {line_no}")
            table = data.setdefault(name, {})
            if not isinstance(table, dict):
                raise ValueError(f"{name} cannot be both a table and array table")
            current = table
            current_name = name
            continue
        if "=" not in line:
            raise ValueError(f"expected key/value on line {line_no}")
        key, raw_value = line.split("=", 1)
        key = key.strip()
        if not key:
            raise ValueError(f"empty key on line {line_no}")
        if key in current:
            scope = current_name or "root"
            raise ValueError(f"duplicate key {key!r} in {scope} on line {line_no}")
        current[key] = parse_scalar(raw_value, line_no)

    return data


def ids(items: object, label: str) -> set[str]:
    if not isinstance(items, list):
        raise ValueError(f"{label} must be an array of tables")
    result: set[str] = set()
    for item in items:
        if not isinstance(item, dict):
            raise ValueError(f"{label} entries must be tables")
        item_id = item.get("id")
        if not isinstance(item_id, str) or not item_id.strip():
            raise ValueError(f"{label} entry missing non-empty id")
        if item_id in result:
            raise ValueError(f"{label} duplicate id: {item_id}")
        result.add(item_id)
    return result


def require_superset(actual: set[str], expected: set[str], label: str) -> list[str]:
    missing = sorted(expected - actual)
    return [f"{label} missing ids: {missing}"] if missing else []


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, help="repo root")
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    contract_path = root / CONTRACT_PATH
    failures: list[str] = []

    if not contract_path.is_file():
        print(f"error: missing contract: {CONTRACT_PATH}", file=sys.stderr)
        return 1

    try:
        contract = load_toml(contract_path)
    except Exception as exc:  # noqa: BLE001
        print(f"error: failed to parse {CONTRACT_PATH}: {exc}", file=sys.stderr)
        return 1

    if contract.get("version") != 1:
        failures.append("contract version must be 1")
    if contract.get("skill_id") != "bagakit-living-knowledge":
        failures.append("contract skill_id mismatch")
    if contract.get("contract_kind") != "living_knowledge_substrate_contract":
        failures.append("contract_kind must be living_knowledge_substrate_contract")

    authority = contract.get("authority")
    if not isinstance(authority, dict):
        failures.append("missing [authority] table")
        authority = {}

    authority_paths: list[Path] = []
    for label, rel in authority.items():
        if not isinstance(rel, str):
            failures.append(f"authority.{label} must be a path string")
            continue
        path = root / rel
        if not path.is_file():
            failures.append(f"authority path missing: {rel}")
            continue
        authority_paths.append(path)

    path_protocol = contract.get("path_protocol")
    if not isinstance(path_protocol, dict):
        failures.append("missing [path_protocol] table")
    else:
        expected_paths = {
            "config": ".bagakit/knowledge_conf.toml",
            "config_behavior": "optional_local_override",
            "default_shared_root": "docs",
            "default_system_root": "docs",
            "runtime_root": ".bagakit/living-knowledge",
            "generated_root": ".bagakit/living-knowledge/.generated",
        }
        for key, expected in expected_paths.items():
            if path_protocol.get(key) != expected:
                failures.append(f"path_protocol.{key} must be {expected!r}")

    try:
        system_page_ids = ids(contract.get("system_page"), "system_page")
        boundary_ids = ids(contract.get("boundary"), "boundary")
        hygiene_rule_ids = ids(contract.get("hygiene_rule"), "hygiene_rule")
    except ValueError as exc:
        failures.append(str(exc))
        system_page_ids = set()
        boundary_ids = set()
        hygiene_rule_ids = set()

    failures.extend(require_superset(system_page_ids, REQUIRED_SYSTEM_PAGE_IDS, "system_page"))
    failures.extend(require_superset(boundary_ids, REQUIRED_BOUNDARY_IDS, "boundary"))
    failures.extend(
        require_superset(hygiene_rule_ids, REQUIRED_HYGIENE_RULE_IDS, "hygiene_rule")
    )

    skill_path = root / "skills/harness/bagakit-living-knowledge/SKILL.md"
    readme_path = root / "skills/harness/bagakit-living-knowledge/README.md"
    for path in (skill_path, readme_path):
        if path.is_file() and "references/substrate-contract.toml" not in path.read_text(
            encoding="utf-8"
        ):
            failures.append(f"{path.relative_to(root)} must link references/substrate-contract.toml")

    for path in authority_paths:
        text = path.read_text(encoding="utf-8")
        rel = path.relative_to(root)
        for snippet in FORBIDDEN_SNIPPETS:
            if snippet in text:
                failures.append(f"{rel} still contains forbidden snippet: {snippet}")
        if ABSOLUTE_PATH_PATTERN.search(text):
            failures.append(f"{rel} still contains an absolute filesystem path marker")

    if failures:
        for failure in failures:
            print(f"error: {failure}", file=sys.stderr)
        return 1

    print("ok: living-knowledge substrate contract and low-leakage surfaces are aligned")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
