"""Validate bagakit-design-core structured contract and required files."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover
    tomllib = None  # type: ignore[assignment]


SKILL_ROOT = "skills/design/bagakit-design-core"
POSIX_SEP = chr(47)
CONTRACT_PATH = POSIX_SEP.join(
    [SKILL_ROOT, "references", "design-core-contract.toml"]
)
DESIGN_MEMORY_ROOT = "mem/decisions/design-core"


def skill_rel(*parts: str) -> str:
    return POSIX_SEP.join([SKILL_ROOT, *parts])


def design_memory_rel(name: str) -> str:
    return POSIX_SEP.join([DESIGN_MEMORY_ROOT, name])

REQUIRED_STAGE_IDS = {
    "design-read",
    "target-register",
    "source-evidence",
    "brand-tonality",
    "brand-system-board",
    "first-frame-composition",
    "design-rule-coverage",
    "anti-default-risk-scan",
    "design-packet",
    "draft-checkpoint-review",
    "plan-checkpoint-review",
}

REQUIRED_COMPLETION_ARTIFACT_IDS = {
    "result-checkpoint-review",
    "handoff",
}

REQUIRED_GUARD_IDS = {
    "design-read-before-taste",
    "evidence-before-taste",
    "tone-axis-concreteness",
    "taste-dial-explicitness",
    "observed-derived-split",
    "target-register-fit",
    "first-frame-fit",
    "semantic-economy",
    "full-surface-rule-coverage",
    "anti-default-risk-overrides",
    "brand-system-board-transfer",
    "three-checkpoint-review",
    "reference-tier-honesty",
    "rights-boundary",
}

def parse_flat_toml(text: str) -> dict:
    data: dict[str, object] = {}
    array_key: str | None = None
    array_values: list[str] = []

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if array_key is not None:
            if line == "]":
                data[array_key] = array_values
                array_key = None
                array_values = []
                continue
            array_values.append(line.rstrip(",").strip().strip('"'))
            continue
        key, sep, value = line.partition("=")
        if not sep:
            continue
        key = key.strip()
        value = value.strip()
        if value == "[":
            array_key = key
            array_values = []
        elif value == "true":
            data[key] = True
        elif value == "false":
            data[key] = False
        elif value.startswith('"') and value.endswith('"'):
            data[key] = value.strip('"')
        else:
            try:
                data[key] = int(value)
            except ValueError:
                data[key] = value

    if array_key is not None:
        data[array_key] = array_values
    return data


def load_toml(path: Path) -> dict:
    if tomllib is not None:
        with path.open("rb") as handle:
            return tomllib.load(handle)
    return parse_flat_toml(path.read_text(encoding="utf-8"))


def section_ids(text: str, section: str) -> set[str]:
    ids: set[str] = set()
    current = ""
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("[[") and stripped.endswith("]]"):
            current = stripped.strip("[]")
            continue
        if current == section:
            match = re.match(r'id\s*=\s*"([^"]+)"', stripped)
            if match:
                ids.add(match.group(1))
    return ids


def require_ids(actual: set[str], expected: set[str], label: str) -> list[str]:
    missing = sorted(expected - actual)
    return [f"{label} missing ids: {missing}"] if missing else []


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository root")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    failures: list[str] = []

    for rel in [
        skill_rel("SKILL.md"),
        skill_rel("README.md"),
        skill_rel("references", "frontdoor-rule.toml"),
        skill_rel("references", "bagakit-driver.toml"),
        skill_rel("references", "skill-cli.toml"),
        skill_rel("references", "artifact-contract.md"),
        skill_rel("references", "brand-tonality.md"),
        skill_rel("references", "design-rule-system.md"),
        skill_rel("scripts", "bagakit-design-core-cli.sh"),
        CONTRACT_PATH,
        design_memory_rel("brand-tonality-synthesis.md"),
        design_memory_rel("design-rule-synthesis.md"),
        design_memory_rel("image-reference-set-synthesis.md"),
        design_memory_rel("review-protocol.md"),
    ]:
        if not (root / rel).is_file():
            failures.append(f"missing required file: {rel}")

    if failures:
        for failure in failures:
            print(f"error: {failure}")
        return 1

    contract_text = (root / CONTRACT_PATH).read_text(encoding="utf-8")
    contract = load_toml(root / CONTRACT_PATH) if tomllib is not None else {}
    if tomllib is not None:
        if contract.get("version") != 1:
            failures.append("contract version must be 1")
        if contract.get("skill_id") != "bagakit-design-core":
            failures.append("contract skill_id mismatch")
        if contract.get("contract_kind") != "skill_workflow_contract":
            failures.append("contract_kind must be skill_workflow_contract")

    failures.extend(require_ids(section_ids(contract_text, "stage"), REQUIRED_STAGE_IDS, "stage"))
    failures.extend(
        require_ids(
            section_ids(contract_text, "completion_artifact"),
            REQUIRED_COMPLETION_ARTIFACT_IDS,
            "completion_artifact",
        )
    )
    failures.extend(require_ids(section_ids(contract_text, "guard"), REQUIRED_GUARD_IDS, "guard"))

    if failures:
        print("design-core contract check failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print("ok: design-core structured contract is aligned")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
