"""Validate bagakit-hitl-webutil-design structured contract."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover
    tomllib = None


POSIX_SEP = chr(47)
SKILL_ROOT = POSIX_SEP.join(["skills", "design", "bagakit-hitl-webutil-design"])
CONTRACT_PATH = POSIX_SEP.join([SKILL_ROOT, "references", "workflow-contract.toml"])
CROSSWALK_PATH = POSIX_SEP.join([SKILL_ROOT, "references", "composition-crosswalk.md"])
COPY_RESULT_COMPONENT_PATH = POSIX_SEP.join(
    [SKILL_ROOT, "references", "components", "copy-result-control.md"]
)
CASE_DIRECTORY_COMPONENT_PATH = POSIX_SEP.join(
    [SKILL_ROOT, "references", "components", "case-directory-panel.md"]
)
CONTEXTUAL_QUESTION_COMPONENT_PATH = POSIX_SEP.join(
    [SKILL_ROOT, "references", "components", "contextual-question-capture.md"]
)
ADAPTIVE_FEEDBACK_COMPONENT_PATH = POSIX_SEP.join(
    [SKILL_ROOT, "references", "components", "adaptive-feedback-panel.md"]
)
MANUAL_TEST_TEMPLATE_PATH = POSIX_SEP.join(
    [SKILL_ROOT, "references", "templates", "manual-test-console.md"]
)
EVIDENCE_REVIEW_TEMPLATE_PATH = POSIX_SEP.join(
    [SKILL_ROOT, "references", "templates", "evidence-review-console.md"]
)
INTERACTIVE_COURSE_TEMPLATE_PATH = POSIX_SEP.join(
    [SKILL_ROOT, "references", "templates", "interactive-learning-course.md"]
)
CASE_CATALOG_ARTIFACT_PATH = POSIX_SEP.join(
    [SKILL_ROOT, "references", "artifacts", "case-catalog.md"]
)
HUMAN_JUDGMENT_MECHANISM_PATH = POSIX_SEP.join(
    [SKILL_ROOT, "references", "mechanisms", "human-judgment-guidance.md"]
)
ADAPTIVE_CONTINUITY_MECHANISM_PATH = POSIX_SEP.join(
    [SKILL_ROOT, "references", "mechanisms", "adaptive-session-continuity.md"]
)

REQUIRED_STAGE_IDS = {
    "design-brief",
    "operator-mode",
    "scene-crosswalk-selection",
    "judgment-contract",
    "mechanism-selection",
    "style-selection",
    "artifact-selection",
    "component-selection",
    "hardening-audit",
    "implementation-route",
}

REQUIRED_ARTIFACT_IDS = {
    "case-catalog",
    "page-manifest",
    "agent-handoff-packet",
    "report-export",
}

REQUIRED_EVAL_GATE_IDS = {
    "built-page-delivery-proof",
    "minimum-transfer-proof",
    "decision-centered-review-proof",
    "interactive-course-projection-proof",
    "adaptive-course-round-trip-proof",
    "lightweight-hardening-audit",
}

REQUIRED_COMPONENT_IDS = {
    "adaptive-feedback-panel",
    "contextual-question-capture",
    "case-directory-panel",
    "copy-result-control",
}

REQUIRED_TEMPLATE_IDS = {
    "interactive-learning-course",
    "manual-test-console",
    "evidence-review-console",
}

REQUIRED_DATA_CONTRACT_IDS = {
    "case-catalog",
    "interactive-course-state",
    "page-export-alignment",
}

REQUIRED_BOUNDARY_IDS = {
    "hitl-design-vs-webpage-implementation",
    "hitl-design-vs-design-review",
    "hitl-design-vs-spark",
    "hitl-design-vs-mastery-learning",
}

REQUIRED_SHARED_GUARDS = {
    "status_and_error",
    "provenance",
    "local_session_state",
    "information_load",
    "audience_mismatch",
    "human_judgment",
    "history_retention",
    "schema_alignment",
    "learning_claim_honesty",
    "learner_facing_chrome",
    "adaptive_session_continuity",
}

REQUIRED_CROSSWALK_SCENES = {
    "manual-test-execution",
    "human-evidence-review",
    "interactive-course-learning",
    "repository-understanding",
}

REQUIRED_CASE_CATALOG_FIELDS = {
    "case_id",
    "case_run_id",
    "evaluation_contract_id",
    "evaluation_contract_version",
    "attention_state",
    "review_mode",
    "reveal_policy",
    "evidence_items",
    "evidence_sufficiency",
    "provisional_human_judgment",
    "agent_position",
    "disagreement",
    "final_human_judgment",
    "evidence_refs",
    "relation_to_prior_run",
}

REQUIRED_CASE_CATALOG_INVARIANTS = {
    "one_case_one_human_decision",
    "stable_case_identity",
    "append_only_run_history",
    "attention_driven_visibility",
    "explicit_review_mode",
    "explicit_reveal_policy",
    "provisional_and_final_judgments_are_distinct",
}

REQUIRED_INTERACTIVE_COURSE_FIELDS = {
    "course_id",
    "mastery_packet_ref",
    "objective_id",
    "page_id",
    "page_manifest_ref",
    "projection_target_ref",
    "primary_interaction_surface",
    "feedback_transport",
    "projection_version",
    "last_applied_event_ref",
    "sync_state",
    "active_task_ref",
    "feedback_ref",
    "learner_event_refs",
    "evidence_record_refs",
    "attempt_refs",
    "question_events",
    "support_level",
    "transfer_distance",
    "retention_interval",
    "evidence_status",
    "provenance",
    "blockers",
    "next_action",
}

REQUIRED_INTERACTIVE_COURSE_INVARIANTS = {
    "upstream_semantics_are_projection_only",
    "append_only_attempt_history",
    "page_status_does_not_map_to_mastery_status",
    "copy_and_download_preserve_upstream_records",
    "question_context_round_trips",
    "missing_evidence_remains_unresolved",
    "page_remains_primary_after_first_attempt",
    "adaptive_round_trip_is_explicit",
    "projection_targets_original_page",
    "stale_projection_is_visible",
    "chat_is_notification_or_fallback",
}

REQUIRED_CONTINUATION_TRIGGERS = {
    "existing_page_submission",
    "attempt_packet",
    "stable_page_ref",
    "course_id_with_resume_intent",
}

REQUIRED_PAGE_LOCATOR_FIELDS = {
    "page_id",
    "page_manifest_ref",
    "projection_target_ref",
}

REQUIRED_PAGE_EXPORT_FIELDS = {
    "scene",
    "template_id",
    "data_contract_refs",
    "operator_mode",
    "primary_interaction_surface",
    "feedback_transport",
    "projection_contract_ref",
}

REQUIRED_HISTORICAL_CASE_IDS = {
    "adaptive-course-chat-drift",
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


def load_toml(path: Path, root: Path) -> dict:
    if tomllib is None:
        script = """
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.argv[1];
const contractPath = process.argv[2];
const parserPath = path.resolve(root, 'dev', 'validator', 'src', 'lib', 'toml.ts');
const parser = await import(pathToFileURL(parserPath).href);
process.stdout.write(JSON.stringify(parser.parseTomlFile(contractPath)));
"""
        completed = subprocess.run(
            [
                "node",
                "--experimental-strip-types",
                "--input-type=module",
                "-e",
                script,
                str(root),
                str(path),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        data = json.loads(completed.stdout)
        if not isinstance(data, dict):
            raise ValueError("contract root must be a TOML table")
        return data
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


def records_by_id(items: object, label: str) -> dict[str, dict]:
    if not isinstance(items, list):
        raise ValueError(f"{label} must be an array of tables")
    result: dict[str, dict] = {}
    for item in items:
        if not isinstance(item, dict):
            raise ValueError(f"{label} entries must be tables")
        item_id = item.get("id")
        if not isinstance(item_id, str) or not item_id.strip():
            raise ValueError(f"{label} entry missing non-empty id")
        if item_id in result:
            raise ValueError(f"{label} duplicate id: {item_id}")
        result[item_id] = item
    return result


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
        skill_rel("references", "components", "README.md"),
        COPY_RESULT_COMPONENT_PATH,
        CASE_DIRECTORY_COMPONENT_PATH,
        CONTEXTUAL_QUESTION_COMPONENT_PATH,
        ADAPTIVE_FEEDBACK_COMPONENT_PATH,
        skill_rel("references", "templates", "README.md"),
        MANUAL_TEST_TEMPLATE_PATH,
        EVIDENCE_REVIEW_TEMPLATE_PATH,
        INTERACTIVE_COURSE_TEMPLATE_PATH,
        HUMAN_JUDGMENT_MECHANISM_PATH,
        ADAPTIVE_CONTINUITY_MECHANISM_PATH,
        CASE_CATALOG_ARTIFACT_PATH,
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
    copy_result_component_text = (root / COPY_RESULT_COMPONENT_PATH).read_text(encoding="utf-8")
    manual_test_template_text = (root / MANUAL_TEST_TEMPLATE_PATH).read_text(encoding="utf-8")
    evidence_review_template_text = (root / EVIDENCE_REVIEW_TEMPLATE_PATH).read_text(encoding="utf-8")
    interactive_course_template_text = (root / INTERACTIVE_COURSE_TEMPLATE_PATH).read_text(
        encoding="utf-8"
    )
    contextual_question_component_text = (root / CONTEXTUAL_QUESTION_COMPONENT_PATH).read_text(
        encoding="utf-8"
    )
    case_catalog_artifact_text = (root / CASE_CATALOG_ARTIFACT_PATH).read_text(encoding="utf-8")
    page_manifest_artifact_text = (
        root / skill_rel("references", "artifacts", "page-manifest.md")
    ).read_text(encoding="utf-8")
    agent_handoff_artifact_text = (
        root / skill_rel("references", "artifacts", "agent-handoff-packet.md")
    ).read_text(encoding="utf-8")
    skill_text = (root / SKILL_ROOT / "SKILL.md").read_text(encoding="utf-8")

    try:
        contract = load_toml(root / CONTRACT_PATH, root)
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

    delivery_policy = contract.get("delivery_policy")
    if not isinstance(delivery_policy, dict):
        failures.append("missing [delivery_policy] table")
        delivery_policy = {}
    if delivery_policy.get("default_for_explicit_page") != "built_page":
        failures.append("explicit HITL page requests must default to built_page")
    if delivery_policy.get("default_for_mastery_interactive_course") != "built_page":
        failures.append("mastery interactive-course handoffs must default to built_page")
    if delivery_policy.get("implementation_peer") != "bagakit-codex-webpage-design":
        failures.append("delivery policy implementation peer mismatch")
    delivery_downgrades = delivery_policy.get("downgrade_modes", [])
    if not isinstance(delivery_downgrades, list):
        failures.append("delivery_policy.downgrade_modes must be an array")
        delivery_downgrades = []
    failures.extend(
        require_superset(
            set(delivery_downgrades),
            {"design_only", "no_file_mutation"},
            "delivery downgrade modes",
        )
    )
    delivery_evidence = delivery_policy.get("completion_evidence", [])
    if not isinstance(delivery_evidence, list):
        failures.append("delivery_policy.completion_evidence must be an array")
        delivery_evidence = []
    failures.extend(
        require_superset(
            set(delivery_evidence),
            {
                "implementation_entrypoint",
                "running_page_location",
                "desktop_browser_evidence",
                "mobile_browser_evidence",
            },
            "built-page completion evidence",
        )
    )
    adaptive_delivery_evidence = delivery_policy.get("adaptive_completion_evidence", [])
    if not isinstance(adaptive_delivery_evidence, list):
        failures.append("delivery_policy.adaptive_completion_evidence must be an array")
        adaptive_delivery_evidence = []
    failures.extend(
        require_superset(
            set(adaptive_delivery_evidence),
            {"adaptive_round_trip_evidence"},
            "adaptive built-page completion evidence",
        )
    )

    continuation_policy = contract.get("continuation_policy")
    if not isinstance(continuation_policy, dict):
        failures.append("missing [continuation_policy] table")
        continuation_policy = {}
    continuation_triggers = continuation_policy.get("trigger_inputs", [])
    if not isinstance(continuation_triggers, list):
        failures.append("continuation_policy.trigger_inputs must be an array")
        continuation_triggers = []
    failures.extend(
        require_superset(
            set(continuation_triggers),
            REQUIRED_CONTINUATION_TRIGGERS,
            "continuation triggers",
        )
    )
    locator_fields = continuation_policy.get("required_locator_fields", [])
    if not isinstance(locator_fields, list):
        failures.append("continuation_policy.required_locator_fields must be an array")
        locator_fields = []
    failures.extend(
        require_superset(
            set(locator_fields),
            REQUIRED_PAGE_LOCATOR_FIELDS,
            "continuation page locator fields",
        )
    )
    if continuation_policy.get("projection_order") != [
        "consume_upstream_evaluation",
        "build_versioned_projection",
        "update_existing_page_or_emit_import",
        "notify_in_chat",
    ]:
        failures.append("continuation projection order must keep page update before chat notification")

    try:
        failures.extend(require_superset(ids(contract.get("stage"), "stage"), REQUIRED_STAGE_IDS, "stage"))
        failures.extend(require_superset(ids(contract.get("artifact"), "artifact"), REQUIRED_ARTIFACT_IDS, "artifact"))
        failures.extend(
            require_superset(ids(contract.get("component"), "component"), REQUIRED_COMPONENT_IDS, "component")
        )
        failures.extend(
            require_superset(ids(contract.get("template"), "template"), REQUIRED_TEMPLATE_IDS, "template")
        )
        failures.extend(
            require_superset(
                ids(contract.get("data_contract"), "data_contract"),
                REQUIRED_DATA_CONTRACT_IDS,
                "data_contract",
            )
        )
        failures.extend(require_superset(ids(contract.get("eval_gate"), "eval_gate"), REQUIRED_EVAL_GATE_IDS, "eval_gate"))
        failures.extend(
            require_superset(
                ids(contract.get("historical_case"), "historical_case"),
                REQUIRED_HISTORICAL_CASE_IDS,
                "historical_case",
            )
        )
        failures.extend(
            require_superset(
                ids(contract.get("composition_boundary"), "composition_boundary"),
                REQUIRED_BOUNDARY_IDS,
                "composition_boundary",
            )
        )
    except ValueError as exc:
        failures.append(str(exc))

    try:
        for label in ("artifact", "component", "template", "data_contract"):
            for record in records_by_id(contract.get(label), label).values():
                owner = record.get("owner")
                if not isinstance(owner, str) or not owner:
                    failures.append(f"{label} record missing owner: {record.get('id')}")
                    continue
                if not (root / SKILL_ROOT / owner).is_file():
                    failures.append(f"{label} owner missing: {owner}")

        case_catalog_contract = records_by_id(
            contract.get("data_contract"), "data_contract"
        ).get("case-catalog", {})
        case_fields = case_catalog_contract.get("required_fields", [])
        case_invariants = case_catalog_contract.get("invariants", [])
        if not isinstance(case_fields, list):
            failures.append("case-catalog required_fields must be an array")
            case_fields = []
        if not isinstance(case_invariants, list):
            failures.append("case-catalog invariants must be an array")
            case_invariants = []
        failures.extend(
            require_superset(set(case_fields), REQUIRED_CASE_CATALOG_FIELDS, "case-catalog fields")
        )
        failures.extend(
            require_superset(
                set(case_invariants),
                REQUIRED_CASE_CATALOG_INVARIANTS,
                "case-catalog invariants",
            )
        )
        for field in case_fields:
            if isinstance(field, str) and f"`{field}`" not in case_catalog_artifact_text:
                failures.append(f"case-catalog artifact missing contracted field: {field}")

        interactive_contract = records_by_id(
            contract.get("data_contract"), "data_contract"
        ).get("interactive-course-state", {})
        interactive_fields = interactive_contract.get("required_fields", [])
        interactive_invariants = interactive_contract.get("invariants", [])
        if not isinstance(interactive_fields, list):
            failures.append("interactive-course-state required_fields must be an array")
            interactive_fields = []
        if not isinstance(interactive_invariants, list):
            failures.append("interactive-course-state invariants must be an array")
            interactive_invariants = []
        failures.extend(
            require_superset(
                set(interactive_fields),
                REQUIRED_INTERACTIVE_COURSE_FIELDS,
                "interactive-course-state fields",
            )
        )
        failures.extend(
            require_superset(
                set(interactive_invariants),
                REQUIRED_INTERACTIVE_COURSE_INVARIANTS,
                "interactive-course-state invariants",
            )
        )
        for field in interactive_fields:
            if isinstance(field, str) and f"`{field}`" not in agent_handoff_artifact_text:
                failures.append(f"agent handoff artifact missing course field: {field}")

        page_export_contract = records_by_id(
            contract.get("data_contract"), "data_contract"
        ).get("page-export-alignment", {})
        page_export_fields = page_export_contract.get("required_fields", [])
        if not isinstance(page_export_fields, list):
            failures.append("page-export-alignment required_fields must be an array")
            page_export_fields = []
        failures.extend(
            require_superset(
                set(page_export_fields),
                REQUIRED_PAGE_EXPORT_FIELDS,
                "page-export-alignment fields",
            )
        )
        for field in page_export_fields:
            if isinstance(field, str) and f"`{field}`" not in page_manifest_artifact_text:
                failures.append(f"page manifest artifact missing contracted field: {field}")

        continuity_case = records_by_id(
            contract.get("historical_case"), "historical_case"
        ).get("adaptive-course-chat-drift", {})
        continuity_guard_ids = continuity_case.get("guard_ids", [])
        continuity_evidence_refs = continuity_case.get("evidence_refs", [])
        if not isinstance(continuity_guard_ids, list):
            failures.append("adaptive-course-chat-drift guard_ids must be an array")
            continuity_guard_ids = []
        if not isinstance(continuity_evidence_refs, list) or not continuity_evidence_refs:
            failures.append("adaptive-course-chat-drift must preserve evidence refs")
        failures.extend(
            require_superset(
                set(continuity_guard_ids),
                {"adaptive_session_continuity", "local_session_state", "schema_alignment"},
                "adaptive course historical guard refs",
            )
        )

        webpage_boundary = records_by_id(
            contract.get("composition_boundary"), "composition_boundary"
        ).get("hitl-design-vs-webpage-implementation", {})
        if webpage_boundary.get("default_when") != (
            "explicit HITL page request or mastery interactive-course handoff"
        ):
            failures.append("HITL/webpage boundary must default for explicit page delivery")
        if not isinstance(webpage_boundary.get("completion_evidence"), str):
            failures.append("HITL/webpage boundary must declare completion evidence")
    except ValueError as exc:
        failures.append(str(exc))

    for guard_id in REQUIRED_SHARED_GUARDS:
        if f"[shared_guard.{guard_id}]" not in contract_text:
            failures.append(f"shared_guard missing table: {guard_id}")

    continuity_guard = contract.get("shared_guard", {}).get("adaptive_session_continuity", {})
    if not isinstance(continuity_guard, dict):
        failures.append("adaptive_session_continuity guard must be a table")
        continuity_guard = {}
    for key, expected in [
        ("lightweight_routes", {"manual_round_trip", "page_reprojection"}),
        (
            "local_exchange_preconditions",
            {"host_owned_exchange_exists", "one_step_submission_materially_improves_repeated_workflow"},
        ),
        (
            "forbidden_continuity_scope",
            {"accounts", "database", "push_infrastructure", "generic_course_service"},
        ),
    ]:
        values = continuity_guard.get(key, [])
        if not isinstance(values, list):
            failures.append(f"adaptive_session_continuity.{key} must be an array")
            values = []
        failures.extend(require_superset(set(values), expected, f"adaptive continuity {key}"))

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
    if "strongly matches the request" not in skill_text or "scenario first" not in skill_text:
        failures.append("SKILL.md must preserve high-fit scene-first design routing")
    if "taxonomy work, critique, or planning without a page" not in skill_text:
        failures.append("SKILL.md must preserve the no-page exception for taxonomy, critique, or planning requests")
    if "references/components/" not in skill_text or "copy-result-control.md" not in skill_text:
        failures.append("SKILL.md must route reusable page components, including copy-result-control")
    if "evidence-review-console.md" not in skill_text or "case-directory-panel.md" not in skill_text:
        failures.append("SKILL.md must route the evidence-review template and case directory component")
    if "human-judgment-guidance.md" not in skill_text or "case-catalog.md" not in skill_text:
        failures.append("SKILL.md must route human judgment and case catalog references")
    if (
        "interactive-learning-course.md" not in skill_text
        or "contextual-question-capture.md" not in skill_text
        or "bagakit-mastery-learning" not in skill_text
    ):
        failures.append("SKILL.md must route the interactive-course template, contextual questions, and optional mastery peer")
    if "monolithic single-page HTML" not in skill_text:
        failures.append("SKILL.md must preserve modular implementation handoff guidance")
    for required in [
        "copy-result-control",
        "payload_builder",
        "copy or download action",
        "fallback route",
        "generic",
    ]:
        if required not in copy_result_component_text:
            failures.append(f"copy-result-control component missing required token: {required}")
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
        "copy-result-control",
        "Component Boundaries",
        "does not create the QA strategy",
    ]:
        if required not in manual_test_template_text:
            failures.append(f"manual-test-console template missing required route token: {required}")
    if "Do not hard-code" not in manual_test_template_text:
        failures.append("manual-test-console template must include parameterization guidance")
    for required in [
        "human-evidence-review",
        "human-judgment-guidance",
        "case-directory-panel",
        "case-catalog",
        "independent",
        "adjudication",
        "approval",
        "case_run_id",
        "Component Boundaries",
        "does not create the QA strategy",
    ]:
        if required not in evidence_review_template_text:
            failures.append(f"evidence-review-console missing required route token: {required}")

    for required in [
        "mastery_packet_ref",
        "learner-event",
        "dimension-evidence",
        "primary_interaction_surface",
        "projection version",
        "passed",
        "failed",
    ]:
        if required not in interactive_course_template_text:
            failures.append(f"interactive-course template missing round-trip token: {required}")
    for required in ["stable context", "objective refs"]:
        if required not in contextual_question_component_text:
            failures.append(f"contextual-question component missing round-trip token: {required}")

    if failures:
        print("hitl-webutil-design contract check failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print("ok: HITL webutil design contract is aligned")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
