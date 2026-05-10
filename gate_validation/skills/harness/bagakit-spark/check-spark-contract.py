"""Validate bagakit-spark structured workflow contract."""

from __future__ import annotations

import argparse
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover
    tomllib = None


CONTRACT_PATH = "skills/harness/bagakit-spark/references/workflow-contract.toml"

REQUIRED_LOOP_RULE_IDS = {
    "mandatory-question-until-explicit-completion",
    "end-check-needs-summary-and-snapshot",
    "execution-window-reopens-loop",
    "option-surface-preserves-meaningful-alternatives",
    "stress-test-option-audit-before-recommendation",
    "ledger-first-before-question-or-snapshot",
    "evidence-route-before-question",
}

REQUIRED_ARTIFACT_IDS = {
    "raw-discussion-log",
    "question-inventory",
    "research-sufficiency-judgment",
    "consensus-snapshot",
    "mvp-eval-envelope",
    "review-packet",
    "feedback-signal-ledger",
    "rationale-ledger",
}

REQUIRED_RESEARCH_DECISIONS = {
    "research_now",
    "research_later",
    "research_not_needed",
}

REQUIRED_BOUNDARY_IDS = {
    "brainstorm-state-substrate",
    "researcher-evidence-producer",
    "portable-eval-meaning",
}

REQUIRED_OUTPUT_FIELD_IDS = {
    "ledger-excerpt",
    "current-frame",
    "research-judgment",
    "question-inventory",
    "feedback-signals",
    "mvp-eval",
    "accepted-snapshot",
    "next-question-or-action",
    "option-surface",
    "option-surface-audit",
    "resolution-route",
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
    """Parse the simple TOML subset used by workflow-contract.toml."""

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


def require_superset(actual: set[str], expected: set[str], label: str) -> list[str]:
    missing = sorted(expected - actual)
    return [f"{label} missing ids: {missing}"] if missing else []


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
    if contract.get("skill_id") != "bagakit-spark":
        failures.append("contract skill_id mismatch")
    if contract.get("contract_kind") != "skill_workflow_contract":
        failures.append("contract_kind must be skill_workflow_contract")

    try:
        loop_rule_ids = ids(contract.get("loop_rule"), "loop_rule")
        artifact_ids = ids(contract.get("artifact"), "artifact")
        boundary_ids = ids(contract.get("composition_boundary"), "composition_boundary")
        output_field_ids = ids(contract.get("output_field"), "output_field")
    except ValueError as exc:
        failures.append(str(exc))
        loop_rule_ids = set()
        artifact_ids = set()
        boundary_ids = set()
        output_field_ids = set()

    failures.extend(require_superset(loop_rule_ids, REQUIRED_LOOP_RULE_IDS, "loop_rule"))
    failures.extend(require_superset(artifact_ids, REQUIRED_ARTIFACT_IDS, "artifact"))
    failures.extend(
        require_superset(boundary_ids, REQUIRED_BOUNDARY_IDS, "composition_boundary")
    )
    failures.extend(
        require_superset(output_field_ids, REQUIRED_OUTPUT_FIELD_IDS, "output_field")
    )

    research_gate = contract.get("research_gate")
    if not isinstance(research_gate, list):
        failures.append("research_gate must be an array of tables")
    else:
        decisions: set[str] = set()
        for item in research_gate:
            if not isinstance(item, dict):
                failures.append("research_gate entries must be tables")
                continue
            decision = item.get("decision")
            if not isinstance(decision, str):
                failures.append("research_gate decision must be a string")
                continue
            decisions.add(decision)
        failures.extend(
            require_superset(decisions, REQUIRED_RESEARCH_DECISIONS, "research_gate.decision")
        )

    entry = contract.get("entry")
    if not isinstance(entry, dict):
        failures.append("missing [entry] table")
    else:
        for rel_link in entry.get("required_reference_links", []):
            if not isinstance(rel_link, str):
                failures.append("entry.required_reference_links must contain strings")
                continue
            if not (root / "skills/harness/bagakit-spark" / rel_link).is_file():
                failures.append(f"entry required reference missing: {rel_link}")
        skill_text = (root / "skills/harness/bagakit-spark/SKILL.md").read_text(
            encoding="utf-8"
        )
        if "references/workflow-contract.toml" not in skill_text:
            failures.append("SKILL.md must link references/workflow-contract.toml")

    if failures:
        print("spark workflow contract check failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print("ok: spark workflow contract structure is aligned")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
