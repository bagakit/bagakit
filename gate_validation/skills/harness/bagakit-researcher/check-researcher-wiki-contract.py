"""Validate bagakit-researcher wiki maintenance contract."""

from __future__ import annotations

import argparse
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover
    tomllib = None


CONTRACT_PATH = "skills/harness/bagakit-researcher/references/wiki-contract.toml"

REQUIRED_DUTY_IDS = {
    "inspect-before-new-search",
    "maintain-after-reading-wiki",
}

REQUIRED_BOUNDARY_IDS = {
    "wiki-is-derived-frontdoor",
    "topic-evidence-first",
}

REQUIRED_DERIVED_SURFACES = {
    "index.md",
    "wiki/README.md",
    "wiki/concepts/",
    "wiki/questions/",
    "wiki/claims/",
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
    """Parse the simple TOML subset used by wiki-contract.toml."""

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


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository root")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    contract_path = root / CONTRACT_PATH
    failures: list[str] = []

    if not contract_path.is_file():
        print(f"error: missing contract: {CONTRACT_PATH}")
        return 1

    try:
        contract = load_toml(contract_path)
    except Exception as exc:  # noqa: BLE001
        print(f"error: failed to parse {CONTRACT_PATH}: {exc}")
        return 1

    if contract.get("version") != 1:
        failures.append("contract version must be 1")
    if contract.get("skill_id") != "bagakit-researcher":
        failures.append("contract skill_id mismatch")
    if contract.get("contract_kind") != "researcher_wiki_contract":
        failures.append("contract_kind must be researcher_wiki_contract")

    frontdoor = contract.get("frontdoor")
    if not isinstance(frontdoor, dict):
        failures.append("missing [frontdoor] table")
    else:
        if frontdoor.get("source_of_truth") != "topics/":
            failures.append("frontdoor.source_of_truth must be topics/")
        surfaces = set(frontdoor.get("derived_surfaces", []))
        missing_surfaces = sorted(REQUIRED_DERIVED_SURFACES - surfaces)
        if missing_surfaces:
            failures.append(f"frontdoor missing derived surfaces: {missing_surfaces}")

    try:
        duty_ids = ids(contract.get("duty"), "duty")
        boundary_ids = ids(contract.get("boundary"), "boundary")
    except ValueError as exc:
        failures.append(str(exc))
        duty_ids = set()
        boundary_ids = set()

    missing_duties = sorted(REQUIRED_DUTY_IDS - duty_ids)
    missing_boundaries = sorted(REQUIRED_BOUNDARY_IDS - boundary_ids)
    if missing_duties:
        failures.append(f"duty missing ids: {missing_duties}")
    if missing_boundaries:
        failures.append(f"boundary missing ids: {missing_boundaries}")

    entry = contract.get("entry")
    if not isinstance(entry, dict):
        failures.append("missing [entry] table")
    else:
        for rel_link in entry.get("required_reference_links", []):
            if not isinstance(rel_link, str):
                failures.append("entry.required_reference_links must contain strings")
                continue
            if not (root / "skills/harness/bagakit-researcher" / rel_link).is_file():
                failures.append(f"entry required reference missing: {rel_link}")
        skill_text = (root / "skills/harness/bagakit-researcher/SKILL.md").read_text(
            encoding="utf-8"
        )
        if "references/wiki-contract.toml" not in skill_text:
            failures.append("SKILL.md must link references/wiki-contract.toml")

    if failures:
        print("researcher wiki contract check failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print("ok: researcher wiki contract structure is aligned")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
