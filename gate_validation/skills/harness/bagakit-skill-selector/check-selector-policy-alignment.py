"""Validate selector policy through its structured contract and minimal anchors."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover
    tomllib = None


CONTRACT_PATH = "skills/harness/bagakit-skill-selector/references/policy-contract.toml"

REQUIRED_POLICY_RULE_IDS = {
    "mandatory-preflight",
    "trivial-work-bypass",
    "frontmatter-is-declarative",
}

REQUIRED_CANDIDATE_STATES = {
    "visible",
    "available",
    "selected",
    "used",
}


def load_toml(path: Path) -> dict:
    if tomllib is None:
        return parse_minimal_toml(path.read_text(encoding="utf-8"))
    with path.open("rb") as handle:
        data = tomllib.load(handle)
    if not isinstance(data, dict):
        raise ValueError("contract root must be a TOML table")
    return data


def parse_value(value: str) -> object:
    value = value.strip()
    if value.startswith("[") and value.endswith("]"):
        return parse_inline_array(value)
    if value.startswith('"') and value.endswith('"'):
        return value[1:-1]
    try:
        return int(value)
    except ValueError:
        return value


def parse_inline_array(value: str) -> list[str]:
    inner = value.strip()[1:-1].strip()
    if not inner:
        return []
    items: list[str] = []
    for raw_item in inner.split(","):
        item = raw_item.strip()
        if not item:
            continue
        if item.startswith('"') and item.endswith('"'):
            item = item[1:-1]
        items.append(item)
    return items


def parse_array_item(line: str) -> str:
    item = line.rstrip(",").strip()
    if item.startswith('"') and item.endswith('"'):
        item = item[1:-1]
    return item


def parse_minimal_toml(text: str) -> dict:
    """Parse the simple TOML subset used by policy-contract.toml."""

    data: dict[str, object] = {}
    current: dict[str, object] = data
    array_key: str | None = None
    array_target: dict[str, object] | None = None
    array_values: list[str] = []

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        if array_key is not None:
            if line == "]":
                if array_target is None:
                    raise ValueError("array target missing")
                array_target[array_key] = array_values
                array_key = None
                array_target = None
                array_values = []
                continue
            item = parse_array_item(line)
            if item:
                array_values.append(item)
            continue

        if line.startswith("[[") and line.endswith("]]"):
            section = line[2:-2].strip()
            items = data.setdefault(section, [])
            if not isinstance(items, list):
                raise ValueError(f"section conflict: {section}")
            current = {}
            items.append(current)
            continue

        if line.startswith("[") and line.endswith("]"):
            section = line[1:-1].strip()
            table = data.setdefault(section, {})
            if not isinstance(table, dict):
                raise ValueError(f"section conflict: {section}")
            current = table
            continue

        key, sep, value = line.partition("=")
        if not sep:
            continue
        key = key.strip()
        value = value.strip()
        if value == "[":
            array_key = key
            array_target = current
            array_values = []
        else:
            current[key] = parse_value(value)

    if array_key is not None:
        raise ValueError(f"unterminated array: {array_key}")

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


def normalized_contains(path: Path, phrase: str) -> bool:
    text = " ".join(path.read_text(encoding="utf-8").split())
    return " ".join(phrase.split()) in text


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
    if contract.get("skill_id") != "bagakit-skill-selector":
        failures.append("contract skill_id mismatch")
    if contract.get("contract_kind") != "selector_policy_contract":
        failures.append("contract_kind must be selector_policy_contract")

    authority = contract.get("authority")
    if not isinstance(authority, dict):
        failures.append("missing [authority] table")
        authority = {}

    for label, rel in authority.items():
        if not isinstance(rel, str):
            failures.append(f"authority.{label} must be a path string")
            continue
        if not (root / rel).is_file():
            failures.append(f"authority path missing: {rel}")

    try:
        policy_rule_ids = ids(contract.get("policy_rule"), "policy_rule")
        candidate_state_ids = ids(contract.get("candidate_state"), "candidate_state")
    except ValueError as exc:
        failures.append(str(exc))
        policy_rule_ids = set()
        candidate_state_ids = set()

    missing_policy = sorted(REQUIRED_POLICY_RULE_IDS - policy_rule_ids)
    missing_states = sorted(REQUIRED_CANDIDATE_STATES - candidate_state_ids)
    if missing_policy:
        failures.append(f"policy_rule missing ids: {missing_policy}")
    if missing_states:
        failures.append(f"candidate_state missing ids: {missing_states}")

    selection_policy = root / str(authority.get("selection_policy", ""))
    bootstrap = root / str(authority.get("bootstrap", ""))
    runtime_skill = root / str(authority.get("runtime_skill", ""))
    if selection_policy.is_file() and not normalized_contains(
        selection_policy,
        "For non-trivial Bagakit-shaped work, selector preflight is mandatory before major implementation starts.",
    ):
        failures.append("selection policy must publish the mandatory preflight rule")
    if bootstrap.is_file() and not normalized_contains(
        bootstrap,
        "For non-trivial Bagakit-shaped work, run selector preflight before major implementation.",
    ):
        failures.append("bootstrap must publish the selector entry rule")
    if runtime_skill.is_file() and "references/policy-contract.toml" not in runtime_skill.read_text(
        encoding="utf-8"
    ):
        failures.append("SKILL.md must link references/policy-contract.toml")

    forbidden = contract.get("forbidden_legacy_wording")
    if not isinstance(forbidden, list):
        failures.append("forbidden_legacy_wording must be an array of tables")
        forbidden = []
    check_paths = [
        path
        for path in authority.values()
        if isinstance(path, str) and (root / path).is_file()
    ]
    for item in forbidden:
        if not isinstance(item, dict):
            failures.append("forbidden_legacy_wording entries must be tables")
            continue
        phrase = item.get("phrase")
        if not isinstance(phrase, str) or not phrase:
            failures.append("forbidden_legacy_wording entry missing phrase")
            continue
        for rel in check_paths:
            path = root / rel
            if normalized_contains(path, phrase):
                failures.append(f"{rel} still contains forbidden legacy wording: {phrase}")

    if failures:
        for failure in failures:
            print(f"error: {failure}", file=sys.stderr)
        return 1

    print("ok: selector policy contract is structured and aligned across authority surfaces")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
