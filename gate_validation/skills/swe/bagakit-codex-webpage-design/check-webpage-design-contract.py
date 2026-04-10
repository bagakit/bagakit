"""Validate bagakit-codex-webpage-design structured workflow contract."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover
    tomllib = None


CONTRACT_PATH = "skills/swe/bagakit-codex-webpage-design/references/workflow-contract.toml"
BENCH_PATH = "gate_eval/skills/swe/bagakit-codex-webpage-design/cases/historical-failures.json"

REQUIRED_STAGE_IDS = {
    "design-brief",
    "reference-intent",
    "design-reference",
    "state-reference-set",
    "visual-decomposition",
    "design-spec-ledger",
    "ambition-bar",
    "information-architecture-map",
    "workflow-model",
    "control-surface-map",
    "interaction-model",
    "capability-route",
    "browser-evidence",
}

REQUIRED_COMPLETION_ARTIFACT_IDS = {
    "affordance-inventory",
    "behavior-matrix",
    "visual-bug-ledger",
    "full-page-structural-parity-ledger",
    "micro-parity-checklist",
    "canvas-stability-report",
    "frame-specimen-sheet",
    "visual-parity-ledger",
    "interaction-parity-ledger",
    "visual-judge-scorecards",
    "judge-aggregation",
    "code-quality-review",
    "handoff",
}

REQUIRED_GUARD_IDS = {
    "reference-first",
    "skill-quality-no-reference-invalid",
    "state-reference-authority",
    "affordance-honesty",
    "reference-coverage",
    "information-architecture",
    "motion-frame-stability",
    "spatial-label-legibility",
    "visual-parity-is-not-automation",
    "screenshot-review-integrity",
    "ambition-bar",
    "design-spec-fidelity",
    "material-asset-parity",
    "asset-pipeline-integrity",
    "reference-specific-sprite-retention",
    "nine-slice-renderer-integrity",
    "frame-specimen-readability",
    "alpha-mask-integrity",
    "responsive-asset-parity",
    "mobile-spatial-adaptation",
    "implementation-checkpoint",
    "full-page-structural-parity",
    "control-surface-clarity",
    "mvp-complexity",
}


def load_toml(path: Path) -> dict:
    if tomllib is None:
        raise RuntimeError("tomllib is required for this validation")
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


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository root")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    failures: list[str] = []

    contract_path = root / CONTRACT_PATH
    bench_path = root / BENCH_PATH

    if not contract_path.is_file():
        failures.append(f"missing contract: {CONTRACT_PATH}")
    if not bench_path.is_file():
        failures.append(f"missing historical failure bench: {BENCH_PATH}")
    if failures:
        for failure in failures:
            print(f"error: {failure}")
        return 1

    try:
        contract = load_toml(contract_path)
    except Exception as exc:  # noqa: BLE001
        print(f"error: failed to parse {CONTRACT_PATH}: {exc}")
        return 1

    if contract.get("version") != 1:
        failures.append("contract version must be 1")
    if contract.get("skill_id") != "bagakit-codex-webpage-design":
        failures.append("contract skill_id mismatch")
    if contract.get("contract_kind") != "skill_workflow_contract":
        failures.append("contract_kind must be skill_workflow_contract")

    try:
        stage_ids = ids(contract.get("stage"), "stage")
        artifact_ids = ids(contract.get("completion_artifact"), "completion_artifact")
        guard_ids = ids(contract.get("guard"), "guard")
    except ValueError as exc:
        failures.append(str(exc))
        stage_ids = set()
        artifact_ids = set()
        guard_ids = set()

    failures.extend(require_superset(stage_ids, REQUIRED_STAGE_IDS, "stage"))
    failures.extend(
        require_superset(
            artifact_ids,
            REQUIRED_COMPLETION_ARTIFACT_IDS,
            "completion_artifact",
        )
    )
    failures.extend(require_superset(guard_ids, REQUIRED_GUARD_IDS, "guard"))

    entry = contract.get("entry")
    if not isinstance(entry, dict):
        failures.append("missing [entry] table")
    else:
        for rel_link in entry.get("required_reference_links", []):
            if not isinstance(rel_link, str):
                failures.append("entry.required_reference_links must contain strings")
                continue
            if not (root / "skills/swe/bagakit-codex-webpage-design" / rel_link).is_file():
                failures.append(f"entry required reference missing: {rel_link}")

        skill_path = root / "skills/swe/bagakit-codex-webpage-design/SKILL.md"
        skill_text = skill_path.read_text(encoding="utf-8")
        if "references/workflow-contract.toml" not in skill_text:
            failures.append("SKILL.md must link references/workflow-contract.toml")

    try:
        bench = json.loads(bench_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        failures.append(f"historical failure bench is invalid JSON: {exc}")
        bench = {}

    if bench.get("schema") != "bagakit.codex-webpage-design.historical-failures/v2":
        failures.append("historical failure bench schema must be v2")

    cases = bench.get("cases")
    if not isinstance(cases, list) or not cases:
        failures.append("historical failure bench must contain cases")
        cases = []

    bench_case_ids: set[str] = set()
    for case in cases:
        if not isinstance(case, dict):
            failures.append("historical failure cases must be objects")
            continue
        case_id = case.get("id")
        if not isinstance(case_id, str) or not case_id.strip():
            failures.append("historical failure case missing id")
            continue
        if case_id in bench_case_ids:
            failures.append(f"duplicate historical failure case id: {case_id}")
        bench_case_ids.add(case_id)

        guard_refs = case.get("contract_guard_ids")
        if not isinstance(guard_refs, list) or not guard_refs:
            failures.append(f"case {case_id} must declare contract_guard_ids")
        else:
            missing_guard_refs = sorted(str(ref) for ref in guard_refs if ref not in guard_ids)
            if missing_guard_refs:
                failures.append(
                    f"case {case_id} references unknown guards: {missing_guard_refs}"
                )

        source_refs = case.get("source_refs")
        if not isinstance(source_refs, list) or not source_refs:
            failures.append(f"case {case_id} must declare source_refs")
        else:
            for source_ref in source_refs:
                if not isinstance(source_ref, str):
                    failures.append(f"case {case_id} has non-string source ref")
                    continue
                if not (root / source_ref).exists():
                    failures.append(f"case {case_id} source ref missing: {source_ref}")

        if "must_find" in case:
            failures.append(f"case {case_id} must not use must_find phrase anchors")

    mappings = contract.get("historical_failure_guard")
    if not isinstance(mappings, list):
        failures.append("contract must declare historical_failure_guard mappings")
        mappings = []

    mapped_case_ids: set[str] = set()
    for mapping in mappings:
        if not isinstance(mapping, dict):
            failures.append("historical_failure_guard entries must be tables")
            continue
        case_id = mapping.get("case_id")
        guard_refs = mapping.get("guard_ids")
        if not isinstance(case_id, str) or not case_id:
            failures.append("historical_failure_guard missing case_id")
            continue
        mapped_case_ids.add(case_id)
        if not isinstance(guard_refs, list) or not guard_refs:
            failures.append(f"historical_failure_guard {case_id} missing guard_ids")
            continue
        unknown = sorted(str(ref) for ref in guard_refs if ref not in guard_ids)
        if unknown:
            failures.append(f"historical_failure_guard {case_id} unknown guards: {unknown}")

    if bench_case_ids:
        unmapped = sorted(bench_case_ids - mapped_case_ids)
        extra = sorted(mapped_case_ids - bench_case_ids)
        if unmapped:
            failures.append(f"bench cases missing contract mappings: {unmapped}")
        if extra:
            failures.append(f"contract mappings without bench cases: {extra}")

    if failures:
        print("webpage design workflow contract check failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print("ok: webpage design workflow contract structure and historical guards are aligned")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
