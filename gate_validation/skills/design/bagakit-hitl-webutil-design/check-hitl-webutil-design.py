"""Validate bagakit-hitl-webutil-design structured contract."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover
    tomllib = None


POSIX_SEP = chr(47)
SKILL_ROOT = POSIX_SEP.join(["skills", "design", "bagakit-hitl-webutil-design"])
CONTRACT_PATH = POSIX_SEP.join([SKILL_ROOT, "references", "workflow-contract.toml"])
CROSSWALK_PATH = POSIX_SEP.join([SKILL_ROOT, "references", "composition-crosswalk.md"])
MANUAL_TEST_TEMPLATE_PATH = POSIX_SEP.join(
    [SKILL_ROOT, "references", "templates", "manual-test-console.md"]
)

REQUIRED_STAGE_IDS = {
    "design-brief",
    "operator-mode",
    "scene-crosswalk-selection",
    "mechanism-selection",
    "style-selection",
    "artifact-selection",
    "hardening-audit",
    "implementation-route",
}

REQUIRED_ARTIFACT_IDS = {
    "page-manifest",
    "agent-handoff-packet",
    "report-export",
}

REQUIRED_EVAL_GATE_IDS = {
    "minimum-transfer-proof",
    "lightweight-hardening-audit",
}

REQUIRED_BOUNDARY_IDS = {
    "hitl-design-vs-webpage-implementation",
    "hitl-design-vs-design-review",
    "hitl-design-vs-spark",
}

REQUIRED_SHARED_GUARDS = {
    "status_and_error",
    "provenance",
    "local_session_state",
    "information_load",
    "audience_mismatch",
}

REQUIRED_CROSSWALK_SCENES = {
    "manual-test-execution",
    "repository-understanding",
}


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


def load_toml(path: Path) -> dict:
    if tomllib is None:
        return parse_minimal_toml(path.read_text(encoding="utf-8"))
    with path.open("rb") as handle:
        data = tomllib.load(handle)
    if not isinstance(data, dict):
        raise ValueError("contract root must be a TOML table")
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


def crosswalk_scenes(text: str) -> set[str]:
    scenes: set[str] = set()
    for match in re.finditer(r"^\|\s*`([^`]+)`\s*\|", text, flags=re.MULTILINE):
        scenes.add(match.group(1))
    return scenes


def skill_routes_to_reference(skill_text: str, rel_link: str) -> bool:
    if rel_link in skill_text:
        return True
    readme_suffix = POSIX_SEP + "README.md"
    if rel_link.endswith(readme_suffix):
        return rel_link[: -len("README.md")] in skill_text and "README.md" in skill_text
    return False


def skill_rel(*parts: str) -> str:
    return POSIX_SEP.join([SKILL_ROOT, *parts])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository root")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    failures: list[str] = []

    required_files = [
        skill_rel("SKILL.md"),
        skill_rel("agents", "openai.yaml"),
        skill_rel("references", "frontdoor-rule.toml"),
        skill_rel("references", "bagakit-driver.toml"),
        skill_rel("references", "skill-cli.toml"),
        skill_rel("references", "mechanisms", "README.md"),
        skill_rel("references", "styles", "README.md"),
        skill_rel("references", "artifacts", "README.md"),
        skill_rel("references", "templates", "README.md"),
        MANUAL_TEST_TEMPLATE_PATH,
        skill_rel("references", "artifacts", "page-manifest.md"),
        skill_rel("references", "artifacts", "agent-handoff-packet.md"),
        skill_rel("references", "artifacts", "report-export.md"),
        skill_rel("scripts", "bagakit-hitl-webutil-design-cli.sh"),
        CONTRACT_PATH,
        CROSSWALK_PATH,
    ]
    for rel in required_files:
        if not (root / rel).is_file():
            failures.append(f"missing required file: {rel}")

    if failures:
        for failure in failures:
            print(f"error: {failure}")
        return 1

    contract_text = (root / CONTRACT_PATH).read_text(encoding="utf-8")
    crosswalk_text = (root / CROSSWALK_PATH).read_text(encoding="utf-8")
    manual_test_template_text = (root / MANUAL_TEST_TEMPLATE_PATH).read_text(encoding="utf-8")
    skill_text = (root / SKILL_ROOT / "SKILL.md").read_text(encoding="utf-8")

    try:
        contract = load_toml(root / CONTRACT_PATH)
    except Exception as exc:  # noqa: BLE001
        print(f"error: failed to parse {CONTRACT_PATH}: {exc}")
        return 1

    if contract.get("version") != 1:
        failures.append("contract version must be 1")
    if contract.get("skill_id") != "bagakit-hitl-webutil-design":
        failures.append("contract skill_id mismatch")
    if contract.get("contract_kind") != "skill_workflow_contract":
        failures.append("contract_kind must be skill_workflow_contract")
    if contract.get("owner") != SKILL_ROOT:
        failures.append("contract owner mismatch")

    entry = contract.get("entry")
    if not isinstance(entry, dict):
        failures.append("missing [entry] table")
        entry = {}
    reference_links = entry.get("required_reference_links")
    if not isinstance(reference_links, list):
        failures.append("entry.required_reference_links must be an array")
        reference_links = []
    for rel_link in reference_links:
        if not isinstance(rel_link, str):
            failures.append("entry.required_reference_links must contain strings")
            continue
        if not (root / SKILL_ROOT / rel_link).is_file():
            failures.append(f"entry required reference missing: {rel_link}")
        if not skill_routes_to_reference(skill_text, rel_link):
            failures.append(f"SKILL.md must route to {rel_link}")

    optional_peer_contracts = entry.get("optional_peer_contracts", [])
    if not isinstance(optional_peer_contracts, list):
        failures.append("entry.optional_peer_contracts must be an array when present")
        optional_peer_contracts = []
    for rel in optional_peer_contracts:
        if isinstance(rel, str) and not (root / rel).is_file():
            failures.append(f"optional peer contract target missing: {rel}")

    try:
        failures.extend(require_superset(ids(contract.get("stage"), "stage"), REQUIRED_STAGE_IDS, "stage"))
        failures.extend(require_superset(ids(contract.get("artifact"), "artifact"), REQUIRED_ARTIFACT_IDS, "artifact"))
        failures.extend(require_superset(ids(contract.get("eval_gate"), "eval_gate"), REQUIRED_EVAL_GATE_IDS, "eval_gate"))
        failures.extend(
            require_superset(
                ids(contract.get("composition_boundary"), "composition_boundary"),
                REQUIRED_BOUNDARY_IDS,
                "composition_boundary",
            )
        )
    except ValueError as exc:
        failures.append(str(exc))

    for guard_id in REQUIRED_SHARED_GUARDS:
        if f"[shared_guard.{guard_id}]" not in contract_text:
            failures.append(f"shared_guard missing table: {guard_id}")

    failures.extend(
        require_superset(crosswalk_scenes(crosswalk_text), REQUIRED_CROSSWALK_SCENES, "crosswalk scene")
    )

    if "bagakit-codex-webpage-design" not in skill_text:
        failures.append("SKILL.md must name the webpage-design implementation handoff peer")
    if "Lean V0 Rule" not in skill_text:
        failures.append("SKILL.md must preserve the Lean V0 Rule")
    if "Explicit Invocation Contract" not in skill_text or "request for a HITL page" not in skill_text:
        failures.append("SKILL.md must preserve explicit invocation as a HITL page request")
    if "concrete page brief" not in skill_text:
        failures.append("SKILL.md must preserve page brief as the explicit invocation default output")
    if "expects a built" not in skill_text or "frontend page" not in skill_text:
        failures.append("SKILL.md must preserve implementation handoff when the user expects a built page")
    if "strongly matches the request" not in skill_text or "scenario first" not in skill_text:
        failures.append("SKILL.md must preserve high-fit scene-first design routing")
    if "taxonomy work, critique, or planning without a page" not in skill_text:
        failures.append("SKILL.md must preserve the no-page exception for taxonomy, critique, or planning requests")
    for required in [
        "manual-test-execution",
        "case-inventory",
        "procedure-runbook",
        "copyable-reproduction",
        "result-capture",
        "evidence-context",
        "local-session-state",
        "interaction-result-packet",
        "ide-verification-console",
        "report-export",
        "agent-handoff-packet",
    ]:
        if required not in manual_test_template_text:
            failures.append(f"manual-test-console template missing required route token: {required}")
    if "Do not hard-code" not in manual_test_template_text:
        failures.append("manual-test-console template must include parameterization guidance")

    if failures:
        print("hitl-webutil-design contract check failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print("ok: HITL webutil design contract is aligned")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
