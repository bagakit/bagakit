"""Core implementation for bagakit-feature-tracker."""

from __future__ import annotations

import argparse
import copy
import fcntl
import hashlib
import html
import json
import math
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import time
import unicodedata
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Generator, Iterable
from urllib.parse import parse_qs, urlparse

sys.dont_write_bytecode = True
RENDERER_BUILD = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()

FEATURE_ID_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz"
FEATURE_ID_BASE = len(FEATURE_ID_ALPHABET)
FEATURE_ID_SCHEME = "feature-tracker-id-v1-c3n2g4"
FEAT_CURSOR_WIDTH = 3
FEAT_NAMESPACE_WIDTH = 2
FEAT_GUARD_WIDTH = 4
LOCAL_GUARD_KEY_WIDTH = 12
LOCAL_ISSUER_VERSION = 1
LOCAL_ISSUER_FILENAME = "issuer.json"
LOCAL_GUARD_KEY_CONFIG = "bagakit.feature-tracker.guard-key"
CURRENT_FEAT_ID_RE = re.compile(r"^f-[23456789abcdefghjkmnpqrstuvwxyz]{9}$")
TRANSITIONAL_FEAT_ID_RE = re.compile(r"^f-[0-9a-z]{7}$")
LEGACY_FEAT_ID_RE = re.compile(r"^f-\d{8}-[a-z0-9][a-z0-9-]*$")
TASK_ID_RE = re.compile(r"^T-\d{3}$")
URI_SCHEME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]*:")
WINDOWS_DRIVE_ABSOLUTE_RE = re.compile(r"^[A-Za-z]:[\\/]")
FEAT_STATUS = {"proposal", "ready", "in_progress", "replanning", "blocked", "done", "archived", "discarded", "transferred"}
TASK_STATUS = {"todo", "in_progress", "done", "blocked", "failed", "cancelled", "transferred"}
GATE_STATUS = {"pass", "fail"}
WORKSPACE_MODES = {"worktree", "current_tree", "proposal_only"}
CLOSED_FEAT_STATUS = {"archived", "discarded", "transferred"}
FEATURE_SCOPES = {"active", "archived", "discarded", "transferred"}
DEFAULT_FEATURE_SCOPES = frozenset({"active"})
RUNTIME_ROLES = {"standalone", "frontdoor_context", "execution_owner", "foreground_owner"}
BLOCKED_REASON_CLASSES = {"none", "external_blocker", "internal_blocker", "parked_context"}
RUNTIME_RELATION_TYPES = {"frontdoor_for", "handoff_from"}
RUNTIME_RELATION_REVERSE = {
    "frontdoor_for": "handoff_from",
    "handoff_from": "frontdoor_for",
}
PLANNING_ENTRY_HANDOFF_SCHEMA = "bagakit/planning-entry-handoff/v1"
PLANNING_ENTRY_HANDOFF_STATUS = {"draft", "approved", "superseded", "applied", "rejected"}
PLANNING_ENTRY_HANDOFF_CLARIFICATION_STATUS = {"pending", "in_progress", "complete", "blocked"}
PLANNING_ENTRY_HANDOFF_USER_REVIEW_STATUS = {"pending", "approved", "changes_requested"}
PLANNING_ENTRY_HANDOFF_SCENES = {"analysis_only", "ambiguous_delivery", "clear_delivery", "execution_ready"}
PLANNING_ENTRY_FEATURE_RECIPE_IDS = {"planning-entry-brainstorm-to-feature", "planning-entry-brainstorm-feature-flow"}
RUNTIME_POLICY_FILENAME = "runtime-policy.json"
LEGACY_CONFIG_FILENAME = "config.json"
FEATURE_PROPOSAL_FILENAME = "proposal.md"
FEATURE_SPEC_DELTA_FILENAME = "spec-delta.md"
FEATURE_VERIFICATION_FILENAME = "verification.md"
FEATURE_GOAL_FILENAME = "goal.md"
FEATURE_SUMMARY_FILENAME = "summary.md"
FEATURE_OWNER_RECEIPT_FILENAME = "owner-receipt.json"
LEGACY_UI_VERIFICATION_FILENAME = "ui-verification.md"
TASK_PLAN_SCHEMA = "bagakit.feature-task-plan.v1"
OWNER_RECEIPT_SCHEMA = "bagakit.execution-owner-receipt.v2"
FEATURE_GOAL_SCHEMA = "bagakit.feature-goal.v1"
FEATURE_CLOSEOUT_REVIEW_SCHEMA = "bagakit.feature-closeout-review.v1"
TASK_PLAN_STATUSES = {"draft", "reviewed"}
TASK_VERIFICATION_KINDS = {"command", "artifact", "manual", "owner_receipt"}
CLOSEOUT_DOCUMENTATION_DISPOSITIONS = {"updated", "verified_current", "not_applicable"}
CLOSEOUT_LEARNING_DISPOSITIONS = {"no_reusable_learning", "candidates_reviewed"}
CLOSEOUT_PROMOTION_DISPOSITIONS = {"not_needed", "routed_for_review", "promoted"}
FEATURE_REQUIRED_ROOT_FILES = frozenset({"state.json", "tasks.json"})
FEATURE_DERIVED_ROOT_FILES = frozenset({FEATURE_OWNER_RECEIPT_FILENAME})
FEATURE_CONTROL_ROOT_FILES = frozenset({FEATURE_GOAL_FILENAME})
FEATURE_OPTIONAL_ROOT_FILES = frozenset(
    {
        FEATURE_PROPOSAL_FILENAME,
        FEATURE_SPEC_DELTA_FILENAME,
        FEATURE_VERIFICATION_FILENAME,
    }
)
FEATURE_CLOSEOUT_ROOT_FILES = frozenset({FEATURE_SUMMARY_FILENAME})
FEATURE_ALLOWED_ROOT_DIRS = frozenset({"artifacts"})
FEATURE_CLOSEOUT_PRESERVE_DIRNAME = "closeout-preserved-root"
FEATURE_INVALID_SOURCE_DIRNAME = "invalid-source"
FEATURE_ROOT_FILE_HINTS = {
    "prd.md": "route feature intent and scope to proposal.md or an upstream planning artifact instead",
    "changelog.md": "route change history to repo/release surfaces; use summary.md only for closeout narrative",
    "design.md": "route behavior or contract deltas to spec-delta.md when that helper is actually needed",
    "tasks.md": "tasks.json is the only task source of truth",
    LEGACY_UI_VERIFICATION_FILENAME: "rename ui-verification.md to verification.md; the ui-only filename is retired",
}
POSIX_SEP = chr(47)
MACHINE_LOCAL_PATH_RE = re.compile(
    r"(?:file:"
    + re.escape(POSIX_SEP * 2)
    + r"|"
    + re.escape(POSIX_SEP)
    + r"(?:Users|home|private|tmp|var|opt|workspace|Volumes)"
    + re.escape(POSIX_SEP)
    + r"|[A-Za-z]:[\\\\/]|\\\\\\\\[A-Za-z0-9_.-]+[\\\\/])"
)
LEGACY_RUNTIME_PATH_HINTS = {
    "feats": ".bagakit/feature-tracker/features/",
    "feats-archived": ".bagakit/feature-tracker/features-archived/",
    "feats-discarded": ".bagakit/feature-tracker/features-discarded/",
}


def sha256_bytes(data: bytes) -> str:
    h = hashlib.sha256()
    h.update(data)
    return h.hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def json_payload_bytes(data: Any) -> bytes:
    return (
        json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    ).encode("utf-8")


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(json_payload_bytes(data))
    tmp.replace(path)


def read_text(path: Path) -> str:
    with path.open("r", encoding="utf-8") as f:
        return f.read()


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def write_text_atomic(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)


def write_bytes_atomic(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, raw_tmp = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    tmp = Path(raw_tmp)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(payload)
        tmp.replace(path)
    except BaseException:
        tmp.unlink(missing_ok=True)
        raise


def normalized_markdown(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n").rstrip() + "\n"


def validate_feature_goal_text(text: str, *, feat_id: str) -> list[str]:
    issues: list[str] = []
    if "\x00" in text:
        issues.append("goal.md must not contain NUL bytes")
        return issues
    normalized = normalized_markdown(text)
    lines = normalized.splitlines()
    contract_marker = f"Contract: `{FEATURE_GOAL_SCHEMA}`"
    feature_marker = f"Feature: `{feat_id}`"
    declared_contracts = [line for line in lines if line.startswith("Contract: ")]
    declared_features = [line for line in lines if line.startswith("Feature: ")]
    if declared_contracts != [contract_marker]:
        issues.append(f"goal.md must declare Contract: `{FEATURE_GOAL_SCHEMA}`")
    if declared_features != [feature_marker]:
        issues.append(f"goal.md must bind Feature: `{feat_id}`")
    control_lines = [
        line.strip()
        for line in lines
        if line.strip()
        and line not in {contract_marker, feature_marker}
        and not line.startswith("#")
    ]
    if not control_lines:
        issues.append("goal.md must contain non-empty control content")
    if MACHINE_LOCAL_PATH_RE.search(normalized):
        issues.append("goal.md contains a machine-local absolute path or file URI")
    return issues


def require_record(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise SystemExit(f"error: {label} must be an object")
    return value


def require_nonempty_string(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise SystemExit(f"error: {label} must be a non-empty string")
    return value.strip()


def require_string_list(value: Any, label: str) -> list[str]:
    if not isinstance(value, list) or not value:
        raise SystemExit(f"error: {label} must be a non-empty list of strings")
    out: list[str] = []
    for index, item in enumerate(value):
        out.append(require_nonempty_string(item, f"{label}[{index}]"))
    return out


def require_optional_string_list(value: Any, label: str) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise SystemExit(f"error: {label} must be a list of strings")
    return [require_nonempty_string(item, f"{label}[{index}]") for index, item in enumerate(value)]


def normalize_repo_relative_ref(value: Any, label: str) -> str:
    raw = require_nonempty_string(value, label)
    path_part, separator, anchor = raw.partition("#")
    if URI_SCHEME_RE.match(path_part):
        raise SystemExit(f"error: {label} must not use a URI or drive-qualified path")
    if WINDOWS_DRIVE_ABSOLUTE_RE.match(path_part) or path_part.startswith(("/", "\\")):
        raise SystemExit(f"error: {label} must be repo-relative")
    portable_path = path_part.replace("\\", "/")
    normalized_text = os.path.normpath(portable_path).replace("\\", "/")
    normalized = Path(normalized_text)
    if normalized_text in {"", ".", ".."} or normalized_text.startswith("../"):
        raise SystemExit(f"error: {label} must not escape the repository root")
    result = normalized.as_posix()
    return f"{result}#{anchor}" if separator else result


def require_repo_relative_ref(root: Path, value: Any, label: str) -> str:
    result = normalize_repo_relative_ref(value, label)
    path_part = result.partition("#")[0]
    normalized = Path(path_part)
    try:
        (root / normalized).resolve().relative_to(root.resolve())
    except ValueError as exc:
        raise SystemExit(f"error: {label} must not escape the repository root") from exc
    return result


def require_repo_relative_refs(root: Path, value: Any, label: str) -> list[str]:
    refs = require_string_list(value, label)
    return [require_repo_relative_ref(root, ref, f"{label}[{index}]") for index, ref in enumerate(refs)]


def canonical_closeout_review(
    root: Path,
    value: Any,
    *,
    feat_id: str,
) -> dict[str, Any]:
    label = f"{feat_id}: closeout_review"
    review = require_record(value, label)
    expected_keys = {"schema", "documentation", "learning", "promotion"}
    if set(review) != expected_keys:
        raise SystemExit(
            f"error: {label} must contain exactly {', '.join(sorted(expected_keys))}"
        )
    if review.get("schema") != FEATURE_CLOSEOUT_REVIEW_SCHEMA:
        raise SystemExit(
            f"error: {label}.schema must be {FEATURE_CLOSEOUT_REVIEW_SCHEMA}"
        )

    options = {
        "documentation": CLOSEOUT_DOCUMENTATION_DISPOSITIONS,
        "learning": CLOSEOUT_LEARNING_DISPOSITIONS,
        "promotion": CLOSEOUT_PROMOTION_DISPOSITIONS,
    }
    normalized: dict[str, Any] = {"schema": FEATURE_CLOSEOUT_REVIEW_SCHEMA}
    for group, allowed in options.items():
        group_label = f"{label}.{group}"
        item = require_record(review.get(group), group_label)
        if set(item) != {"disposition", "rationale", "refs"}:
            raise SystemExit(
                f"error: {group_label} must contain exactly disposition, rationale, and refs"
            )
        disposition = require_nonempty_string(
            item.get("disposition"), f"{group_label}.disposition"
        )
        if disposition not in allowed:
            raise SystemExit(
                f"error: {group_label}.disposition must be one of {', '.join(sorted(allowed))}"
            )
        rationale = require_nonempty_string(item.get("rationale"), f"{group_label}.rationale")
        if MACHINE_LOCAL_PATH_RE.search(rationale):
            raise SystemExit(
                f"error: {group_label}.rationale contains a machine-local absolute path or file URI"
            )
        refs = require_optional_string_list(item.get("refs"), f"{group_label}.refs")
        refs = [
            require_repo_relative_ref(root, ref, f"{group_label}.refs[{index}]")
            for index, ref in enumerate(refs)
        ]
        normalized[group] = {
            "disposition": disposition,
            "rationale": rationale,
            "refs": refs,
        }

    documentation = normalized["documentation"]
    if documentation["disposition"] in {"updated", "verified_current"} and not documentation["refs"]:
        raise SystemExit(
            f"error: {label}.documentation.refs is required when documentation is "
            f"{documentation['disposition']}"
        )
    learning = normalized["learning"]
    if learning["disposition"] == "candidates_reviewed" and not learning["refs"]:
        raise SystemExit(
            f"error: {label}.learning.refs is required when learning is candidates_reviewed"
        )
    promotion = normalized["promotion"]
    if promotion["disposition"] in {"routed_for_review", "promoted"} and not promotion["refs"]:
        raise SystemExit(
            f"error: {label}.promotion.refs is required when promotion is "
            f"{promotion['disposition']}"
        )
    if (
        learning["disposition"] == "no_reusable_learning"
        and promotion["disposition"] != "not_needed"
    ):
        raise SystemExit(
            f"error: {label} cannot route or promote learning after declaring no_reusable_learning"
        )
    return normalized


def closeout_review_guidance_lines() -> list[str]:
    return [
        "closeout review checklist:",
        "- documentation: updated | verified_current | not_applicable",
        "  arguments: --documentation-disposition <choice> --documentation-rationale <why> [--documentation-ref <repo-relative-ref>]",
        "  method: identify changed public behavior or contracts and update only the owning SSOT; requirement changes must come from user-confirmed discussion or explicitly delegated review evidence, never Agent inference; do not edit docs only to satisfy closeout",
        "- learning: candidates_reviewed | no_reusable_learning",
        "  arguments: --learning-disposition <choice> --learning-rationale <why> [--learning-ref <repo-relative-ref>]",
        "  method: the Agent may summarize bounded plan revisions, gate failures, user corrections, and final evidence; compare original intent and non-goals with delivered scope; check that the shortest useful vertical closure came before expansion and that later work raised quality rather than only task count; merge duplicates, keep the result concise, and never promote Agent-authored learning into a requirement without user confirmation; keep raw sessions with their host",
        "- promotion: routed_for_review | promoted | not_needed",
        "  arguments: --promotion-disposition <choice> --promotion-rationale <why> [--promotion-ref <repo-relative-ref>]",
        "  method: check repository principles, merge same-class candidates, and use the existing Chronicle, Evolver, Principle Layer, or Living Knowledge owner; remove obsolete guidance instead of appending a competing rule",
        "required: one disposition and non-empty rationale per item; add repo-relative refs for updated/verified_current, candidates_reviewed, routed_for_review, or promoted",
    ]


def closeout_review_from_args(
    root: Path,
    args: argparse.Namespace,
    *,
    feat_id: str,
) -> dict[str, Any]:
    raw = {
        "schema": FEATURE_CLOSEOUT_REVIEW_SCHEMA,
        "documentation": {
            "disposition": str(getattr(args, "documentation_disposition", "") or ""),
            "rationale": str(getattr(args, "documentation_rationale", "") or ""),
            "refs": list(getattr(args, "documentation_ref", []) or []),
        },
        "learning": {
            "disposition": str(getattr(args, "learning_disposition", "") or ""),
            "rationale": str(getattr(args, "learning_rationale", "") or ""),
            "refs": list(getattr(args, "learning_ref", []) or []),
        },
        "promotion": {
            "disposition": str(getattr(args, "promotion_disposition", "") or ""),
            "rationale": str(getattr(args, "promotion_rationale", "") or ""),
            "refs": list(getattr(args, "promotion_ref", []) or []),
        },
    }
    try:
        return canonical_closeout_review(root, raw, feat_id=feat_id)
    except SystemExit as exc:
        detail = normalize_error_text(exc)
        raise SystemExit(
            "error: " + detail + "\n" + "\n".join(closeout_review_guidance_lines())
        ) from exc


def has_closeout_review_args(args: argparse.Namespace) -> bool:
    return any(
        getattr(args, name, None)
        for name in (
            "documentation_disposition",
            "documentation_rationale",
            "documentation_ref",
            "learning_disposition",
            "learning_rationale",
            "learning_ref",
            "promotion_disposition",
            "promotion_rationale",
            "promotion_ref",
        )
    )


def parse_task_plan_candidate(
    value: Any,
    *,
    root: Path,
    label: str,
    inherited_review_ref: str | None = None,
) -> dict[str, Any]:
    plan = require_record(value, label)
    schema = require_nonempty_string(plan.get("schema"), f"{label}.schema")
    if schema != TASK_PLAN_SCHEMA:
        raise SystemExit(f"error: {label}.schema must be {TASK_PLAN_SCHEMA}")

    if inherited_review_ref is None:
        review = require_record(plan.get("review"), f"{label}.review")
        review_status = require_nonempty_string(review.get("status"), f"{label}.review.status")
        if review_status != "approved":
            raise SystemExit(f"error: {label}.review.status must be approved")
        review_ref = require_repo_relative_ref(root, review.get("evidence_ref"), f"{label}.review.evidence_ref")
    else:
        review_ref = require_repo_relative_ref(root, inherited_review_ref, f"{label}.review_ref")

    source_refs = require_repo_relative_refs(root, plan.get("source_refs"), f"{label}.source_refs")
    raw_tasks = plan.get("tasks")
    if not isinstance(raw_tasks, list) or not raw_tasks:
        raise SystemExit(f"error: {label}.tasks must be a non-empty list")

    tasks: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for index, raw_task in enumerate(raw_tasks):
        task_label = f"{label}.tasks[{index}]"
        task = require_record(raw_task, task_label)
        task_id = require_nonempty_string(task.get("id"), f"{task_label}.id")
        if not TASK_ID_RE.fullmatch(task_id):
            raise SystemExit(f"error: {task_label}.id must match T-000")
        if task_id in seen_ids:
            raise SystemExit(f"error: duplicate task id in reviewed plan: {task_id}")
        seen_ids.add(task_id)

        verification_raw = task.get("verification")
        if not isinstance(verification_raw, list) or not verification_raw:
            raise SystemExit(f"error: {task_label}.verification must be a non-empty list")
        verification: list[dict[str, str]] = []
        for verification_index, raw_mapping in enumerate(verification_raw):
            mapping_label = f"{task_label}.verification[{verification_index}]"
            mapping = require_record(raw_mapping, mapping_label)
            kind = require_nonempty_string(mapping.get("kind"), f"{mapping_label}.kind")
            if kind not in TASK_VERIFICATION_KINDS:
                raise SystemExit(
                    f"error: {mapping_label}.kind must be one of {', '.join(sorted(TASK_VERIFICATION_KINDS))}"
                )
            verification.append(
                {
                    "kind": kind,
                    "ref": require_repo_relative_ref(root, mapping.get("ref"), f"{mapping_label}.ref"),
                    "proves": require_nonempty_string(mapping.get("proves"), f"{mapping_label}.proves"),
                }
            )
        if not any(mapping["kind"] == "command" for mapping in verification):
            raise SystemExit(
                f"error: {task_label}.verification must include at least one "
                "kind=command mapping for the Task completion gate"
            )

        supersedes = require_optional_string_list(task.get("supersedes"), f"{task_label}.supersedes")
        if len(set(supersedes)) != len(supersedes):
            raise SystemExit(f"error: {task_label}.supersedes must not contain duplicates")
        for superseded_id in supersedes:
            if not TASK_ID_RE.fullmatch(superseded_id):
                raise SystemExit(f"error: {task_label}.supersedes entries must match T-000")
            if superseded_id == task_id:
                raise SystemExit(f"error: {task_label} must not supersede itself")

        estimate_hours, heavy, heavy_reason = canonical_task_effort(task, label=task_label)
        normalized_task = {
            "id": task_id,
            "depends_on": canonical_task_dependencies(task, label=task_label),
            "title": require_nonempty_string(task.get("title"), f"{task_label}.title"),
            "objective": require_nonempty_string(task.get("objective"), f"{task_label}.objective"),
            "outcome": require_nonempty_string(task.get("outcome"), f"{task_label}.outcome"),
            "acceptance": require_string_list(task.get("acceptance"), f"{task_label}.acceptance"),
            "verification": verification,
            "source_refs": require_repo_relative_refs(root, task.get("source_refs"), f"{task_label}.source_refs"),
            "supersedes": supersedes,
        }
        if estimate_hours is not None:
            normalized_task["estimate_hours"] = estimate_hours
        if heavy:
            normalized_task["heavy"] = True
            assert heavy_reason is not None
            normalized_task["heavy_reason"] = heavy_reason
        tasks.append(normalized_task)

    current_plan_task_graph(
        {
            "plan_revision": 1,
            "plan_history": [{"revision": 1, "task_ids": [task["id"] for task in tasks]}],
            "tasks": tasks,
        },
        feat_id=label,
    )

    return {
        "schema": schema,
        "review_ref": review_ref,
        "source_refs": source_refs,
        "tasks": tasks,
    }


def canonical_runtime_role(value: Any, *, feat_id: str) -> str:
    raw = str(value or "standalone").strip()
    if raw not in RUNTIME_ROLES:
        raise SystemExit(
            f"error: {feat_id}: runtime_role must be one of {', '.join(sorted(RUNTIME_ROLES))}"
        )
    return raw


def canonical_blocker_pair(
    reason_class: Any,
    reason: Any,
    *,
    class_label: str,
    reason_label: str,
) -> tuple[str, str]:
    if not isinstance(reason_class, str) or not reason_class.strip():
        raise SystemExit(f"error: {class_label} is required")
    if reason_class != reason_class.strip():
        raise SystemExit(f"error: {class_label} must not have surrounding whitespace")
    if reason_class == "none" or reason_class not in BLOCKED_REASON_CLASSES:
        allowed = ", ".join(sorted(BLOCKED_REASON_CLASSES - {"none"}))
        raise SystemExit(f"error: {class_label} must be one of {allowed}")
    if not isinstance(reason, str) or not reason.strip():
        raise SystemExit(f"error: {reason_label} is required")
    if reason != reason.strip():
        raise SystemExit(f"error: {reason_label} must not have surrounding whitespace")
    return reason_class, reason


def canonical_task_finish_blocker(
    *,
    result: str,
    blocked_reason_class: Any,
    blocked_reason: Any,
    blocked_owner: Any = None,
    blocked_resume_when: Any = None,
    cancel_reason: Any = None,
) -> tuple[str | None, str | None]:
    if result == "blocked":
        try:
            return canonical_blocker_pair(
                blocked_reason_class,
                blocked_reason,
                class_label="--blocked-reason-class",
                reason_label="--blocked-reason",
            )
        except SystemExit as exc:
            raise SystemExit(f"{exc} with --result blocked") from None
    if blocked_reason_class is not None or blocked_reason is not None:
        raise SystemExit(
            "error: --blocked-reason-class and --blocked-reason are valid only with --result blocked"
        )
    if blocked_owner is not None or blocked_resume_when is not None:
        raise SystemExit("error: --blocked-owner and --blocked-resume-when are valid only with --result blocked")
    if result != "cancelled" and cancel_reason is not None:
        raise SystemExit("error: --cancel-reason is valid only with --result cancelled")
    return None, None


def canonical_task_finish_failure(
    *,
    result: str,
    failure_reason: Any,
    failure_assumption: Any,
) -> tuple[str, str] | None:
    """Validate the explicit failed-assumption handoff.

    ``failed`` means the reviewed approach was disproved.  It is terminal
    evidence that forces a reviewed successor plan; it is deliberately
    separate from ``blocked``, which means the current approach is still
    viable but cannot proceed right now.
    """
    supplied = any(value is not None for value in (failure_reason, failure_assumption))
    if result != "failed":
        if supplied:
            raise SystemExit(
                "error: failure arguments are valid only with --result failed"
            )
        return None
    if not isinstance(failure_reason, str) or not failure_reason.strip():
        raise SystemExit("error: --failure-reason is required with --result failed")
    if failure_reason != failure_reason.strip():
        raise SystemExit("error: --failure-reason must not have surrounding whitespace")
    if not isinstance(failure_assumption, str) or not failure_assumption.strip():
        raise SystemExit("error: --failure-assumption is required with --result failed")
    if failure_assumption != failure_assumption.strip():
        raise SystemExit("error: --failure-assumption must not have surrounding whitespace")
    return failure_reason, failure_assumption


def canonical_task_finish_cancellation(
    *,
    result: str,
    cancel_reason: Any,
) -> str | None:
    if result != "cancelled":
        return None
    if not isinstance(cancel_reason, str) or not cancel_reason.strip():
        raise SystemExit("error: --cancel-reason is required with --result cancelled")
    if cancel_reason != cancel_reason.strip():
        raise SystemExit("error: --cancel-reason must not have surrounding whitespace")
    return cancel_reason


def canonical_task_last_blocker(
    task: dict[str, Any],
    *,
    feat_id: str,
) -> tuple[str, str] | None:
    task_id = str(task.get("id") or "<unknown>")
    raw = task.get("last_blocker")
    if raw is None:
        if task.get("status") == "blocked":
            raise SystemExit(f"error: {feat_id}/{task_id}: blocked task requires last_blocker")
        return None
    if task.get("status") == "todo":
        raise SystemExit(f"error: {feat_id}/{task_id}: todo task must not carry last_blocker")
    if task.get("status") in {"cancelled", "failed"}:
        raise SystemExit(f"error: {feat_id}/{task_id}: {task.get('status')} task must not carry last_blocker")
    if not isinstance(raw, dict) or not {"class", "reason"}.issubset(set(raw)) or set(raw) - {"class", "reason", "owner", "resume_when"}:
        raise SystemExit(
            f"error: {feat_id}/{task_id}: last_blocker must contain class/reason and optional owner/resume_when"
        )
    pair = canonical_blocker_pair(
        raw.get("class"),
        raw.get("reason"),
        class_label=f"{feat_id}/{task_id}: last_blocker.class",
        reason_label=f"{feat_id}/{task_id}: last_blocker.reason",
    )
    for key in ("owner", "resume_when"):
        if key in raw and (not isinstance(raw[key], str) or not raw[key].strip() or raw[key] != raw[key].strip()):
            raise SystemExit(f"error: {feat_id}/{task_id}: last_blocker.{key} must be a trimmed non-empty string")
    return pair


def canonical_task_failure(task: dict[str, Any], *, feat_id: str) -> tuple[str, str] | None:
    task_id = str(task.get("id") or "<unknown>")
    raw = task.get("failure")
    if task.get("status") == "failed":
        if not isinstance(raw, dict) or set(raw) != {"reason", "assumption"}:
            raise SystemExit(
                f"error: {feat_id}/{task_id}: failed task requires failure reason and assumption"
            )
        reason = raw.get("reason")
        assumption = raw.get("assumption")
        if not isinstance(reason, str) or not reason.strip() or reason != reason.strip():
            raise SystemExit(f"error: {feat_id}/{task_id}: failure.reason must be a trimmed non-empty string")
        if not isinstance(assumption, str) or not assumption.strip() or assumption != assumption.strip():
            raise SystemExit(f"error: {feat_id}/{task_id}: failure.assumption must be a trimmed non-empty string")
        return reason, assumption
    if raw is not None:
        raise SystemExit(f"error: {feat_id}/{task_id}: non-failed task must not carry failure")
    return None


def canonical_task_cancel_reason(
    task: dict[str, Any],
    *,
    feat_id: str,
) -> str | None:
    task_id = str(task.get("id") or "<unknown>")
    raw = task.get("cancel_reason")
    if task.get("status") == "cancelled":
        if not isinstance(raw, str) or not raw.strip():
            raise SystemExit(f"error: {feat_id}/{task_id}: cancelled task requires cancel_reason")
        if raw != raw.strip():
            raise SystemExit(f"error: {feat_id}/{task_id}: cancel_reason must not have surrounding whitespace")
        return raw
    if raw is not None:
        raise SystemExit(f"error: {feat_id}/{task_id}: non-cancelled task must not carry cancel_reason")
    return None


def require_canonical_task_blockers(tasks: dict[str, Any], *, feat_id: str) -> None:
    task_items = tasks.get("tasks")
    if not isinstance(task_items, list):
        return
    for task in task_items:
        if isinstance(task, dict):
            canonical_task_last_blocker(task, feat_id=feat_id)
            canonical_task_cancel_reason(task, feat_id=feat_id)
            canonical_task_failure(task, feat_id=feat_id)


def current_task_blockers(tasks: dict[str, Any], *, feat_id: str) -> list[dict[str, str]]:
    current_ids = set(latest_plan_task_ids(tasks))
    blockers: list[dict[str, str]] = []
    for task in tasks.get("tasks", []):
        if not isinstance(task, dict):
            continue
        task_id = str(task.get("id") or "")
        if task_id not in current_ids or task.get("status") != "blocked":
            continue
        blocker = canonical_task_last_blocker(task, feat_id=feat_id)
        assert blocker is not None
        reason_class, reason = blocker
        blocker_item = {"item_id": task_id, "class": reason_class, "reason": reason}
        for key in ("owner", "resume_when"):
            if isinstance(task.get("last_blocker"), dict) and key in task["last_blocker"]:
                blocker_item[key] = str(task["last_blocker"][key])
        blockers.append(blocker_item)
    return sorted(blockers, key=lambda item: item["item_id"])


def current_task_failures(tasks: dict[str, Any], *, feat_id: str) -> list[dict[str, Any]]:
    current_ids = set(latest_plan_task_ids(tasks))
    failures: list[dict[str, Any]] = []
    for task in tasks.get("tasks", []):
        if not isinstance(task, dict) or str(task.get("id") or "") not in current_ids:
            continue
        failure = canonical_task_failure(task, feat_id=feat_id)
        if failure is None:
            continue
        reason, assumption = failure
        failures.append({"item_id": str(task.get("id")), "reason": reason, "assumption": assumption})
    return sorted(failures, key=lambda item: item["item_id"])


def require_task_blocker_runtime_role(
    state: dict[str, Any],
    tasks: dict[str, Any],
    *,
    feat_id: str,
) -> None:
    blockers = current_task_blockers(tasks, feat_id=feat_id)
    if any(item["class"] == "parked_context" for item in blockers):
        if canonical_runtime_role(state.get("runtime_role"), feat_id=feat_id) != "frontdoor_context":
            raise SystemExit(
                f"error: {feat_id}: parked_context Task blocker requires runtime_role=frontdoor_context"
            )


@dataclass(frozen=True)
class CloseoutPublication:
    state: dict[str, Any]
    tasks: dict[str, Any]
    index: dict[str, Any]
    receipt: dict[str, Any] | None
    summary: str
    root_moves: list[tuple[str, str]]


def prepare_closed_feature_publication(
    paths: HarnessPaths,
    state: dict[str, Any],
    tasks: dict[str, Any],
    *,
    feat_id: str,
    target_status: str,
    event_action: str,
    event_detail: str,
    closeout_review: dict[str, Any],
    discard_reason: str | None = None,
    replacement_feat_id: str | None = None,
) -> CloseoutPublication:
    if target_status not in CLOSED_FEAT_STATUS:
        raise SystemExit(f"error: unsupported closeout target status: {target_status}")
    current_status = str(state.get("status") or "")
    require_valid_feature_goal_contract(paths, state)
    require_canonical_task_blockers(tasks, feat_id=feat_id)
    require_task_blocker_runtime_role(state, tasks, feat_id=feat_id)
    if current_status == "blocked" and not current_task_blockers(tasks, feat_id=feat_id):
        raise SystemExit(f"error: {feat_id}: blocked Feature requires Task blocker evidence")

    candidate_state = copy.deepcopy(state)
    candidate_tasks = copy.deepcopy(tasks)
    candidate_tasks["closeout_review"] = copy.deepcopy(closeout_review)
    candidate_state["closed_from_status"] = current_status
    candidate_state["status"] = target_status
    if target_status == "discarded":
        candidate_state["discard_reason"] = discard_reason
        candidate_state["replacement_feat_id"] = replacement_feat_id
    elif target_status == "transferred":
        candidate_state["transferred_to"] = {"feature_id": replacement_feat_id}
    candidate_state.setdefault("history", []).append(
        history_event(event_action, event_detail)
    )
    normalize_state_payload(candidate_state)
    normalize_tasks_payload(candidate_tasks)
    normalize_feature_goal_ref(paths, candidate_state)
    require_canonical_task_blockers(candidate_tasks, feat_id=feat_id)
    require_task_blocker_runtime_role(candidate_state, candidate_tasks, feat_id=feat_id)

    active_dir = paths.feat_dir(feat_id, status=current_status)
    root_moves = plan_closeout_root_entries(
        active_dir,
        include_closeout_root_files=True,
    )
    preserved_root_entries = [target for _, target in root_moves]
    index_candidate = copy.deepcopy(load_index(paths))
    upsert_feat_index_entry(index_candidate, candidate_state)

    state_ref = relative_display(
        paths.root,
        paths.feat_state(feat_id, status=target_status),
    )
    tasks_ref = relative_display(
        paths.root,
        paths.feat_tasks(feat_id, status=target_status),
    )
    evidence_hashes = {
        state_ref: sha256_bytes(json_payload_bytes(candidate_state)),
        tasks_ref: sha256_bytes(json_payload_bytes(candidate_tasks)),
    }
    if candidate_state.get("goal_contract") is not None:
        goal_path = paths.feat_goal(feat_id, status=current_status)
        evidence_hashes[
            relative_display(paths.root, paths.feat_goal(feat_id, status=target_status))
        ] = sha256_file(goal_path)
    receipt = None
    if has_reviewed_task_plan(candidate_tasks) or candidate_state.get("goal_contract") is not None:
        receipt = build_owner_receipt_payload(
            paths,
            candidate_state,
            candidate_tasks,
            evidence_hashes,
        )

    summary = render_summary(
        candidate_state,
        candidate_tasks,
        preserved_root_entries=preserved_root_entries,
    )
    return CloseoutPublication(
        state=candidate_state,
        tasks=candidate_tasks,
        index=index_candidate,
        receipt=receipt,
        summary=summary,
        root_moves=root_moves,
    )


def prepare_invalid_discard_publication(
    paths: HarnessPaths,
    state: dict[str, Any],
    *,
    feat_id: str,
    closeout_review: dict[str, Any],
    source_issue_count: int,
    replacement_feat_id: str | None,
) -> CloseoutPublication:
    current_status = str(state.get("status") or "")
    raw_title = " ".join(str(state.get("title") or feat_id).split()) or feat_id
    try:
        slug = slugify(str(state.get("slug") or ""))
    except SystemExit:
        slug = slugify(feat_id)

    candidate_state = {
        "version": 1,
        "feat_id": feat_id,
        "title": raw_title,
        "slug": slug,
        "status": "discarded",
        "workspace_mode": "proposal_only",
        "base_ref": str(state.get("base_ref") or ""),
        "branch": "",
        "worktree_name": "",
        "worktree_path": "",
        "counters": {
            "gate_fail_streak": 0,
            "no_progress_rounds": 0,
            "round_count": 0,
        },
        "closed_from_status": current_status,
        "discard_reason": "invalid",
        "replacement_feat_id": replacement_feat_id,
        "history": [
            history_event(
                "feat_discarded",
                "reason=invalid; "
                f"source_issues={source_issue_count}; "
                f"original root files preserved under artifacts/{FEATURE_INVALID_SOURCE_DIRNAME}",
            )
        ],
    }
    candidate_tasks = {
        "version": 1,
        "feat_id": feat_id,
        "tasks": [],
        "closeout_review": copy.deepcopy(closeout_review),
    }
    root_moves = plan_invalid_discard_root_entries(
        paths.feat_dir(feat_id, status=current_status)
    )
    preserved_root_entries = [target for _, target in root_moves]
    index_candidate = copy.deepcopy(load_index(paths))
    upsert_feat_index_entry(index_candidate, candidate_state)
    return CloseoutPublication(
        state=candidate_state,
        tasks=candidate_tasks,
        index=index_candidate,
        receipt=None,
        summary=render_summary(
            candidate_state,
            candidate_tasks,
            preserved_root_entries=preserved_root_entries,
        ),
        root_moves=root_moves,
    )


def canonical_runtime_relations(value: Any, *, feat_id: str) -> list[dict[str, str]]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise SystemExit(f"error: {feat_id}: runtime_relations must be a list")

    out: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for index, item in enumerate(value):
        rel = require_record(item, f"{feat_id}: runtime_relations[{index}]")
        relation = require_nonempty_string(rel.get("relation"), f"{feat_id}: runtime_relations[{index}].relation")
        if relation not in RUNTIME_RELATION_TYPES:
            raise SystemExit(
                f"error: {feat_id}: runtime_relations[{index}].relation must be one of {', '.join(sorted(RUNTIME_RELATION_TYPES))}"
            )
        target_feat = require_nonempty_string(rel.get("feat_id"), f"{feat_id}: runtime_relations[{index}].feat_id")
        if not is_valid_feat_id(target_feat):
            raise SystemExit(f"error: {feat_id}: invalid runtime relation feature id: {target_feat}")
        if target_feat == feat_id:
            raise SystemExit(f"error: {feat_id}: runtime relation may not target self")
        pair = (relation, target_feat)
        if pair in seen:
            continue
        seen.add(pair)
        out.append({"relation": relation, "feat_id": target_feat})
    out.sort(key=lambda item: (item["relation"], feat_sort_key(item["feat_id"])))
    return out


def optional_principle_layer(value: Any, *, root: Path) -> dict[str, Any] | None:
    if value is None:
        return None
    layer = require_record(value, "planning-entry handoff principle_layer")
    return {
        "what": require_nonempty_string(layer.get("what"), "planning-entry handoff principle_layer.what"),
        "why": require_nonempty_string(layer.get("why"), "planning-entry handoff principle_layer.why"),
        "intended_generalization": require_nonempty_string(
            layer.get("intended_generalization"),
            "planning-entry handoff principle_layer.intended_generalization",
        ),
        "failure_boundary": require_nonempty_string(
            layer.get("failure_boundary"),
            "planning-entry handoff principle_layer.failure_boundary",
        ),
        "behavior_examples": require_string_list(
            layer.get("behavior_examples"),
            "planning-entry handoff principle_layer.behavior_examples",
        ),
        "transfer_checks": require_string_list(
            layer.get("transfer_checks"),
            "planning-entry handoff principle_layer.transfer_checks",
        ),
        "evidence_refs": require_repo_relative_refs(
            root,
            layer.get("evidence_refs"),
            "planning-entry handoff principle_layer.evidence_refs",
        ),
    }


def eprint(msg: str) -> None:
    print(msg, file=sys.stderr)


def unsupported_feature_root_file_error(rel_path: str, *, closed_root: bool = False) -> str:
    name = Path(rel_path).name.lower()
    if closed_root:
        return (
            f"unsupported feature-root file: {rel_path}; "
            f"hint: closed feature roots keep state.json, tasks.json, owner-receipt.json, "
            f"optional goal.md, summary.md, and artifacts/ at the root; "
            f"preserve live or legacy root entries under artifacts/{FEATURE_CLOSEOUT_PRESERVE_DIRNAME}/ instead"
        )
    hint = FEATURE_ROOT_FILE_HINTS.get(name)
    if hint:
        return f"unsupported feature-root file: {rel_path}; hint: {hint}"
    allowed = ", ".join(sorted(FEATURE_OPTIONAL_ROOT_FILES | FEATURE_CONTROL_ROOT_FILES))
    return (
        f"unsupported feature-root file: {rel_path}; "
        f"allowed live-feature helper files are state.json, tasks.json, {allowed}, and artifacts/"
    )


def normalize_error_text(exc: BaseException) -> str:
    text = str(exc).strip()
    if text.startswith("error: "):
        return text[len("error: ") :]
    return text


def relative_display(root: Path, path: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return str(path)


def legacy_runtime_path_error(root: Path, legacy_dir: Path) -> str:
    rel = relative_display(root, legacy_dir)
    mapped = LEGACY_RUNTIME_PATH_HINTS.get(legacy_dir.name)
    if mapped:
        return (
            f"legacy feature-tracker runtime path is not supported: {rel}; "
            f"repair: move contents to {mapped} and remove {rel}"
        )
    return f"legacy feature-tracker runtime path is not supported: {rel}"


def is_public_token(raw: str, *, width: int) -> bool:
    return len(raw) == width and all(ch in FEATURE_ID_ALPHABET for ch in raw)


def encode_public_token(value: int, *, width: int) -> str:
    if value < 0:
        raise SystemExit("error: public token encoding requires non-negative integers")
    if value == 0:
        encoded = FEATURE_ID_ALPHABET[0]
    else:
        chars: list[str] = []
        current = value
        while current:
            current, remainder = divmod(current, FEATURE_ID_BASE)
            chars.append(FEATURE_ID_ALPHABET[remainder])
        encoded = "".join(reversed(chars))
    if len(encoded) > width:
        raise SystemExit(f"error: {FEATURE_ID_SCHEME} exhausted for width {width}")
    return encoded.rjust(width, FEATURE_ID_ALPHABET[0])


def public_token_int(raw: str) -> int:
    value = 0
    for ch in raw:
        value = value * FEATURE_ID_BASE + FEATURE_ID_ALPHABET.index(ch)
    return value


def short_hash_token(text: str, *, width: int) -> str:
    digest = hashlib.blake2s(text.encode("utf-8"), digest_size=8).digest()
    return encode_public_token(int.from_bytes(digest, "big") % (FEATURE_ID_BASE ** width), width=width)


def random_token(*, width: int = 8) -> str:
    return short_hash_token(os.urandom(16).hex(), width=width)


def is_valid_feat_id(feat_id: str) -> bool:
    return bool(CURRENT_FEAT_ID_RE.match(feat_id) or TRANSITIONAL_FEAT_ID_RE.match(feat_id) or LEGACY_FEAT_ID_RE.match(feat_id))


def parse_current_feat_cursor(feat_id: str) -> int | None:
    if not CURRENT_FEAT_ID_RE.match(feat_id):
        return None
    payload = feat_id.removeprefix("f-")
    return public_token_int(payload[:FEAT_CURSOR_WIDTH])


def parse_current_feat_namespace(feat_id: str) -> str | None:
    if not CURRENT_FEAT_ID_RE.match(feat_id):
        return None
    payload = feat_id.removeprefix("f-")
    start = FEAT_CURSOR_WIDTH
    end = start + FEAT_NAMESPACE_WIDTH
    return payload[start:end]


def parse_transitional_feat_sequence(feat_id: str) -> int | None:
    if not TRANSITIONAL_FEAT_ID_RE.match(feat_id):
        return None
    payload = feat_id.removeprefix("f-")
    try:
        return int(payload[:4], 36)
    except ValueError:
        return None


def feat_sort_key(feat_id: str) -> tuple[int, int, str]:
    if LEGACY_FEAT_ID_RE.match(feat_id):
        return (0, -1, feat_id)
    seq = parse_transitional_feat_sequence(feat_id)
    if seq is not None:
        return (1, seq, feat_id)
    seq = parse_current_feat_cursor(feat_id)
    if seq is not None:
        return (2, seq, feat_id)
    return (3, -1, feat_id)


def history_event(action: str, detail: str) -> dict[str, str]:
    return {"action": action, "detail": detail}


def active_feature_ids(paths: "HarnessPaths") -> set[str]:
    payload = load_index(paths)
    return {
        str(item.get("feat_id", "")).strip()
        for item in payload.get("features", [])
        if isinstance(item, dict) and str(item.get("feat_id", "")).strip()
    }


def load_planning_entry_handoff(handoff_path: Path, *, root: Path) -> dict[str, Any]:
    payload = require_record(load_json(handoff_path), f"planning-entry handoff {handoff_path}")
    schema = require_nonempty_string(payload.get("schema"), "planning-entry handoff schema")
    if schema != PLANNING_ENTRY_HANDOFF_SCHEMA:
        raise SystemExit(
            f"error: planning-entry handoff schema must be {PLANNING_ENTRY_HANDOFF_SCHEMA}: {schema}"
        )

    status = require_nonempty_string(payload.get("status"), "planning-entry handoff status")
    if status not in PLANNING_ENTRY_HANDOFF_STATUS:
        raise SystemExit(f"error: invalid planning-entry handoff status: {status}")

    clarification_status = require_nonempty_string(
        payload.get("clarification_status"),
        "planning-entry handoff clarification_status",
    )
    if clarification_status not in PLANNING_ENTRY_HANDOFF_CLARIFICATION_STATUS:
        raise SystemExit(f"error: invalid planning-entry handoff clarification_status: {clarification_status}")

    user_review_status = require_nonempty_string(
        payload.get("user_review_status"),
        "planning-entry handoff user_review_status",
    )
    if user_review_status not in PLANNING_ENTRY_HANDOFF_USER_REVIEW_STATUS:
        raise SystemExit(f"error: invalid planning-entry handoff user_review_status: {user_review_status}")

    discussion_clear = payload.get("discussion_clear")
    if not isinstance(discussion_clear, bool):
        raise SystemExit("error: planning-entry handoff discussion_clear must be a boolean")

    route = require_record(payload.get("recommended_route"), "planning-entry handoff recommended_route")
    scene = require_nonempty_string(route.get("scene"), "planning-entry handoff recommended_route.scene")
    if scene not in PLANNING_ENTRY_HANDOFF_SCENES:
        raise SystemExit(f"error: invalid planning-entry handoff recommended_route.scene: {scene}")
    recipe_id = require_nonempty_string(
        route.get("recipe_id"),
        "planning-entry handoff recommended_route.recipe_id",
    )
    principle_layer = optional_principle_layer(payload.get("principle_layer"), root=root)
    task_plan = None
    if payload.get("task_plan") is not None:
        task_plan = parse_task_plan_candidate(
            payload.get("task_plan"),
            root=root,
            label="planning-entry handoff task_plan",
            inherited_review_ref=relative_display(root, handoff_path),
        )

    return {
        "schema": schema,
        "handoff_id": require_nonempty_string(payload.get("handoff_id"), "planning-entry handoff handoff_id"),
        "status": status,
        "producer_surface": require_nonempty_string(
            payload.get("producer_surface"),
            "planning-entry handoff producer_surface",
        ),
        "title": require_nonempty_string(payload.get("title"), "planning-entry handoff title"),
        "goal": require_nonempty_string(payload.get("goal"), "planning-entry handoff goal"),
        "objective": require_nonempty_string(payload.get("objective"), "planning-entry handoff objective"),
        "demand_summary": require_nonempty_string(
            payload.get("demand_summary"),
            "planning-entry handoff demand_summary",
        ),
        "principle_layer": principle_layer,
        "success_criteria": require_string_list(
            payload.get("success_criteria"),
            "planning-entry handoff success_criteria",
        ),
        "constraints": require_string_list(payload.get("constraints"), "planning-entry handoff constraints"),
        "clarification_status": clarification_status,
        "discussion_clear": discussion_clear,
        "user_review_status": user_review_status,
        "recommended_route": {
            "scene": scene,
            "recipe_id": recipe_id,
        },
        "source_artifacts": require_repo_relative_refs(
            root,
            payload.get("source_artifacts"),
            "planning-entry handoff source_artifacts",
        ),
        "source_refs": require_repo_relative_refs(
            root,
            payload.get("source_refs"),
            "planning-entry handoff source_refs",
        ),
        "task_plan": task_plan,
    }


def render_planning_entry_proposal(feat_id: str, handoff: dict[str, Any]) -> str:
    success_lines = [f"  - {item}" for item in handoff["success_criteria"]]
    constraint_lines = [f"- {item}" for item in handoff["constraints"]]
    artifact_lines = [f"- `{item}`" for item in handoff["source_artifacts"]]
    ref_lines = [f"- `{item}`" for item in handoff["source_refs"]]
    layer = handoff.get("principle_layer")
    if not isinstance(layer, dict):
        layer = {
            "what": handoff["objective"],
            "why": handoff["demand_summary"],
            "intended_generalization": (
                "Apply this clarified planning intent to canonical tracker tasks derived from the approved handoff."
            ),
            "failure_boundary": (
                "Do not treat the handoff artifact as a second planning source of truth, and do not infer scope outside approved success criteria and constraints."
            ),
            "behavior_examples": [handoff["goal"]],
            "transfer_checks": [
                "A handoff with similar wording but without approved review must not be materialized.",
                "Raw brainstorm prose outside the normalized handoff must not define tracker scope.",
                "Tracker tasks should still be validated by task gates rather than proposal prose.",
            ],
            "evidence_refs": handoff["source_refs"],
        }
    behavior_example_lines = [f"  - {item}" for item in layer["behavior_examples"]]
    transfer_check_lines = [f"  - {item}" for item in layer["transfer_checks"]]
    evidence_ref_lines = [f"  - `{item}`" for item in layer["evidence_refs"]]
    transfer_check_top_lines = [f"- {item}" for item in layer["transfer_checks"]]
    return "\n".join(
        [
            f"# Feature Proposal: {feat_id}",
            "",
            "## Why",
            f"- {handoff['demand_summary']}",
            "",
            "## Goal",
            f"- {handoff['goal']}",
            "",
            "## Principle Layer",
            f"- What: {layer['what']}",
            f"- Why: {layer['why']}",
            f"- Intended generalization: {layer['intended_generalization']}",
            f"- Failure boundary: {layer['failure_boundary']}",
            "- Behavior examples:",
            *behavior_example_lines,
            "- Transfer checks:",
            *transfer_check_lines,
            "- Evidence refs:",
            *evidence_ref_lines,
            "",
            "## Scope",
            "- In scope:",
            *success_lines,
            "- Out of scope:",
            "  - Replacing canonical tracker truth with the handoff artifact itself.",
            "",
            "## Acceptance Criteria",
            *success_lines,
            "",
            "## Transfer Checks",
            *transfer_check_top_lines,
            "",
            "## Impact",
            "- Code paths:",
            "  - To be refined by canonical task planning.",
            "- Tests:",
            "  - To be refined by canonical task planning.",
            "- Rollout notes:",
            f"  - Generated from planning-entry handoff `{handoff['handoff_id']}`.",
            "",
            "## Planning Entry Handoff",
            f"- Handoff id: `{handoff['handoff_id']}`",
            f"- Producer surface: `{handoff['producer_surface']}`",
            f"- Title: {handoff['title']}",
            f"- Objective: {handoff['objective']}",
            f"- Route: `{handoff['recommended_route']['scene']}` / `{handoff['recommended_route']['recipe_id']}`",
            f"- Clarification status: `{handoff['clarification_status']}`",
            f"- Discussion clear: `{str(handoff['discussion_clear']).lower()}`",
            f"- User review: `{handoff['user_review_status']}`",
            "",
            "## Constraints",
            *constraint_lines,
            "",
            "## Source Artifacts",
            *artifact_lines,
            "",
            "## Source Refs",
            *ref_lines,
            "",
        ]
    )


def next_numbered_path(directory: Path, *, prefix: str, suffix: str) -> Path:
    pattern = re.compile(rf"^{re.escape(prefix)}(\d+){re.escape(suffix)}$")
    next_number = 1
    if directory.exists():
        for entry in directory.iterdir():
            match = pattern.match(entry.name)
            if not match:
                continue
            next_number = max(next_number, int(match.group(1)) + 1)
    return directory / f"{prefix}{next_number:04d}{suffix}"


def move_path(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    try:
        src.rename(dst)
    except OSError:
        shutil.move(str(src), str(dst))


def first_tree_symlink(root: Path) -> Path | None:
    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        parent = Path(dirpath)
        for name in (*dirnames, *filenames):
            child = parent / name
            if child.is_symlink():
                return child
    return None


def make_owned_tree_writable(root: Path) -> None:
    for dirpath, dirnames, _filenames in os.walk(root):
        path = Path(dirpath)
        path.chmod(path.stat().st_mode | 0o700)
        for dirname in dirnames:
            child = path / dirname
            if not child.is_symlink():
                child.chmod(child.stat().st_mode | 0o700)


def remove_owned_tree(root: Path) -> None:
    if not root.exists():
        return
    make_owned_tree_writable(root)
    shutil.rmtree(root)


def run_cmd(cmd: list[str], *, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=str(cwd) if cwd else None,
        text=True,
        capture_output=True,
        check=False,
    )


def run_shell(command: str, *, cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=str(cwd),
        text=True,
        errors="replace",
        capture_output=True,
        shell=True,
        check=False,
    )


def ensure_git_repo(root: Path) -> None:
    cp = run_cmd(["git", "-C", str(root), "rev-parse", "--is-inside-work-tree"])
    if cp.returncode != 0 or cp.stdout.strip() != "true":
        raise SystemExit(f"error: not a git repository: {root}")


def git_common_dir(root: Path) -> Path:
    cp = run_cmd(["git", "-C", str(root), "rev-parse", "--git-common-dir"])
    if cp.returncode != 0:
        raise SystemExit(cp.stderr.strip() or cp.stdout.strip() or f"error: cannot resolve git common dir for {root}")
    raw = cp.stdout.strip()
    if not raw:
        raise SystemExit(f"error: empty git common dir for {root}")
    path = Path(raw)
    return path if path.is_absolute() else (root / path).resolve()


def current_branch(root: Path) -> str:
    cp = run_cmd(["git", "-C", str(root), "rev-parse", "--abbrev-ref", "HEAD"])
    if cp.returncode != 0:
        return ""
    branch = cp.stdout.strip()
    return "" if branch == "HEAD" else branch


def path_from_porcelain_line(line: str) -> str:
    raw = line[3:] if len(line) > 3 else line
    if " -> " in raw:
        raw = raw.split(" -> ", 1)[1]
    return raw.strip().strip('"')


def is_harness_generated_gitignore(root: Path, rel_path: str) -> bool:
    if rel_path != ".gitignore":
        return False
    target = root / rel_path
    if not target.exists():
        return False
    lines = [line.strip() for line in target.read_text(encoding="utf-8").splitlines() if line.strip()]
    return lines == [".worktrees"]


def non_harness_git_status_lines(root: Path) -> list[str]:
    cp = run_cmd(["git", "-C", str(root), "status", "--porcelain"])
    if cp.returncode != 0:
        raise SystemExit(cp.stderr.strip() or cp.stdout.strip() or "git status failed")

    ignored_prefixes = (".bagakit/", ".worktrees/")
    out: list[str] = []
    for raw in cp.stdout.splitlines():
        line = raw.rstrip()
        if not line:
            continue
        path = path_from_porcelain_line(line)
        if path.startswith(ignored_prefixes):
            continue
        if is_harness_generated_gitignore(root, path):
            continue
        out.append(line)
    return out


def recommend_workspace_mode(root: Path) -> tuple[str, str]:
    changes = non_harness_git_status_lines(root)
    if changes:
        return (
            "worktree",
            "repository has non-harness changes; isolated worktree is safer",
        )
    return (
        "current_tree",
        "repository is clean aside from harness metadata; current_tree is lighter than a dedicated worktree",
    )


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")
    if not value:
        raise SystemExit("error: slug became empty after normalization")
    return value


@dataclass
class HarnessPaths:
    root: Path

    @property
    def harness_dir(self) -> Path:
        return self.root / ".bagakit" / "feature-tracker"

    @property
    def feats_dir(self) -> Path:
        return self.harness_dir / "features"

    @property
    def feats_archived_dir(self) -> Path:
        return self.harness_dir / "features-archived"

    @property
    def feats_discarded_dir(self) -> Path:
        return self.harness_dir / "features-discarded"

    @property
    def feats_transferred_dir(self) -> Path:
        return self.harness_dir / "features-transferred"

    @property
    def index_dir(self) -> Path:
        return self.harness_dir / "index"

    @property
    def artifacts_dir(self) -> Path:
        return self.harness_dir / "artifacts"

    @property
    def local_dir(self) -> Path:
        return self.harness_dir / "local"

    @property
    def index_file(self) -> Path:
        return self.index_dir / "features.json"

    @property
    def runtime_policy_file(self) -> Path:
        return self.harness_dir / RUNTIME_POLICY_FILENAME

    @property
    def legacy_config_file(self) -> Path:
        return self.harness_dir / LEGACY_CONFIG_FILENAME

    @property
    def issuer_file(self) -> Path:
        return self.local_dir / LOCAL_ISSUER_FILENAME

    def feat_dir(self, feat_id: str, *, status: str | None = None) -> Path:
        if status == "archived":
            base = self.feats_archived_dir
        elif status == "discarded":
            base = self.feats_discarded_dir
        elif status == "transferred":
            base = self.feats_transferred_dir
        else:
            base = self.feats_dir
        return base / feat_id

    def feat_state(self, feat_id: str, *, status: str | None = None) -> Path:
        return self.feat_dir(feat_id, status=status) / "state.json"

    def feat_tasks(self, feat_id: str, *, status: str | None = None) -> Path:
        return self.feat_dir(feat_id, status=status) / "tasks.json"

    def feat_owner_receipt(self, feat_id: str, *, status: str | None = None) -> Path:
        return self.feat_dir(feat_id, status=status) / FEATURE_OWNER_RECEIPT_FILENAME

    def feat_goal(self, feat_id: str, *, status: str | None = None) -> Path:
        return self.feat_dir(feat_id, status=status) / FEATURE_GOAL_FILENAME

    def feat_summary(self, feat_id: str, *, status: str | None = None) -> Path:
        return self.feat_dir(feat_id, status=status) / "summary.md"

    def feat_proposal(self, feat_id: str, *, status: str | None = None) -> Path:
        return self.feat_dir(feat_id, status=status) / FEATURE_PROPOSAL_FILENAME

    def feat_spec_delta(self, feat_id: str, *, status: str | None = None) -> Path:
        return self.feat_dir(feat_id, status=status) / FEATURE_SPEC_DELTA_FILENAME

    def feat_verification(self, feat_id: str, *, status: str | None = None) -> Path:
        return self.feat_dir(feat_id, status=status) / FEATURE_VERIFICATION_FILENAME

    def feat_artifacts_dir(self, feat_id: str, *, status: str | None = None) -> Path:
        return self.feat_dir(feat_id, status=status) / "artifacts"


@dataclass(frozen=True)
class FeatureExecutionRoot:
    path: Path
    workspace_mode: str
    detail: str


@contextmanager
def tracker_state_lock(root: Path, *, allow_create: bool = False) -> Generator[None, None, None]:
    paths = HarnessPaths(root)
    if not allow_create and not paths.harness_dir.exists():
        raise SystemExit("error: tracker not initialized. run feature-tracker.sh initialize-tracker first")
    lock_file = git_common_dir(root) / "bagakit" / "feature-tracker.lock"
    lock_file.parent.mkdir(parents=True, exist_ok=True)
    with lock_file.open("a+", encoding="utf-8") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lock.fileno(), fcntl.LOCK_UN)


def infer_next_feat_sequence(index_data: dict[str, Any]) -> int:
    max_seen = -1
    for item in index_data.get("features", []):
        feat_id = str(item.get("feat_id") or "")
        seq = parse_current_feat_cursor(feat_id)
        if seq is None:
            seq = parse_transitional_feat_sequence(feat_id)
        if seq is not None:
            max_seen = max(max_seen, seq)
    return max_seen + 1


def ensure_feature_id_issuance(index_data: dict[str, Any]) -> tuple[dict[str, Any], bool]:
    changed = False
    if "id_allocator" in index_data:
        raise SystemExit(
            "error: unsupported feature index field: id_allocator; canonical runtime does not auto-migrate legacy allocators"
        )
    issuance = index_data.get("feature_id_issuance")
    if not isinstance(issuance, dict):
        issuance = {}
        index_data["feature_id_issuance"] = issuance
        changed = True

    scheme = str(issuance.get("scheme") or "")
    if scheme != FEATURE_ID_SCHEME:
        issuance["scheme"] = FEATURE_ID_SCHEME
        changed = True

    inferred_next = infer_next_feat_sequence(index_data)
    raw_next = issuance.get("next_cursor")
    baseline_next = max(
        inferred_next,
        int(raw_next) if isinstance(raw_next, int) else 0,
    )
    if issuance.get("next_cursor") != baseline_next:
        issuance["next_cursor"] = baseline_next
        changed = True

    return issuance, changed


def normalize_index_data(index_data: dict[str, Any]) -> None:
    if not isinstance(index_data.get("features"), list):
        index_data["features"] = []
    index_data.pop("updated_at", None)
    ensure_feature_id_issuance(index_data)


def normalize_history(items: Any) -> list[dict[str, str]]:
    if not isinstance(items, list):
        return []
    out: list[dict[str, str]] = []
    for raw in items:
        if isinstance(raw, dict):
            action = str(raw.get("action") or "").strip()
            detail = str(raw.get("detail") or "").strip()
            if action:
                out.append(history_event(action, detail))
        elif raw is not None:
            text = str(raw).strip()
            if text:
                out.append(history_event("note", text))
    return out


def normalize_state_payload(state: dict[str, Any]) -> None:
    for key in ("created_at", "updated_at", "archived_at", "discarded_at"):
        state.pop(key, None)
    for key in (
        "current_task_id",
        "blocked_reason_class",
        "blocked_reason",
        "blocked_task_id",
    ):
        state.pop(key, None)
    gate = state.get("gate")
    if isinstance(gate, dict):
        gate.pop("last_checked_at", None)
    history = normalize_history(state.get("history"))
    if history:
        state["history"] = history
    else:
        state.pop("history", None)


def normalize_tasks_payload(tasks: dict[str, Any]) -> None:
    tasks.pop("updated_at", None)
    if not isinstance(tasks.get("tasks"), list):
        return
    for item in tasks["tasks"]:
        if not isinstance(item, dict):
            continue
        for key in ("last_gate_at", "started_at", "finished_at", "updated_at", "last_commit_hash"):
            item.pop(key, None)


def draft_tasks_payload(feat_id: str) -> dict[str, Any]:
    return {
        "version": 2,
        "feat_id": feat_id,
        "plan_status": "draft",
        "plan_revision": 0,
        "supersedes_revision": None,
        "review_ref": "",
        "source_refs": [],
        "plan_history": [],
        "tasks": [],
    }


def latest_plan_task_ids(tasks: dict[str, Any]) -> list[str]:
    history = tasks.get("plan_history")
    if not isinstance(history, list) or not history:
        return []
    latest = history[-1]
    if not isinstance(latest, dict) or latest.get("revision") != tasks.get("plan_revision"):
        return []
    task_ids = latest.get("task_ids")
    if not isinstance(task_ids, list) or not task_ids:
        return []
    out: list[str] = []
    for task_id in task_ids:
        if not isinstance(task_id, str) or not TASK_ID_RE.fullmatch(task_id) or task_id in out:
            return []
        out.append(task_id)
    return out


def canonical_task_dependencies(task: dict[str, Any], *, label: str) -> list[str]:
    raw = task.get("depends_on")
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise SystemExit(f"error: {label}.depends_on must be a list of Task ids")
    task_id = str(task.get("id") or "")
    dependencies: list[str] = []
    for index, item in enumerate(raw):
        dependency = require_nonempty_string(item, f"{label}.depends_on[{index}]")
        if not TASK_ID_RE.fullmatch(dependency):
            raise SystemExit(f"error: {label}.depends_on[{index}] must match T-000")
        if dependency == task_id:
            raise SystemExit(f"error: {label} must not depend on itself")
        if dependency in dependencies:
            raise SystemExit(f"error: {label}.depends_on must not contain duplicates")
        dependencies.append(dependency)
    return sorted(dependencies)


def canonical_task_effort(
    task: dict[str, Any],
    *,
    label: str,
) -> tuple[float | int | None, bool, str | None]:
    """Validate the optional effort signal owned by a Task plan.

    ``estimate_hours`` is deliberately numeric and uses Agent execution hours.
    The field is optional for small Tasks; a heavy Task must carry both an
    estimate and a concise reason why it cannot be safely split.  Older
    reviewed plans omit these fields and remain valid.
    """
    raw_estimate = task.get("estimate_hours")
    estimate: float | int | None = None
    if raw_estimate is not None:
        if isinstance(raw_estimate, bool) or not isinstance(raw_estimate, (int, float)):
            raise SystemExit(f"error: {label}.estimate_hours must be a positive number of Agent hours")
        if not math.isfinite(float(raw_estimate)) or float(raw_estimate) <= 0:
            raise SystemExit(f"error: {label}.estimate_hours must be a positive number of Agent hours")
        estimate = raw_estimate

    raw_heavy = task.get("heavy", False)
    if not isinstance(raw_heavy, bool):
        raise SystemExit(f"error: {label}.heavy must be boolean")
    heavy = raw_heavy

    raw_reason = task.get("heavy_reason")
    reason: str | None = None
    if raw_reason is not None:
        if not isinstance(raw_reason, str) or not raw_reason.strip():
            raise SystemExit(f"error: {label}.heavy_reason must be a non-empty string when present")
        if raw_reason != raw_reason.strip():
            raise SystemExit(f"error: {label}.heavy_reason must not have surrounding whitespace")
        reason = raw_reason

    if heavy:
        if estimate is None:
            raise SystemExit(f"error: {label}.heavy requires estimate_hours in Agent hours")
        if float(estimate) <= 0.5:
            raise SystemExit(f"error: {label}.heavy requires estimate_hours greater than 0.5 Agent hours")
        if reason is None:
            raise SystemExit(f"error: {label}.heavy requires heavy_reason")
    elif reason is not None:
        raise SystemExit(f"error: {label}.heavy_reason is only valid when heavy=true")

    return estimate, heavy, reason


def task_effort_fingerprint(task: dict[str, Any], *, label: str) -> tuple[float | int | None, bool, str | None]:
    """Return normalized optional effort fields for plan revision comparison."""
    return canonical_task_effort(task, label=label)


def canonical_transferred_from(
    raw: Any,
    *,
    feat_id: str,
) -> list[dict[str, Any]]:
    """Validate the successor-side Feature transfer lineage.

    This is deliberately a small, presentation-friendly structure. The
    successor Feature owns the list; Task-level mapping is intentionally not
    persisted because a successor may regroup or split the remaining work.
    """
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise SystemExit(f"error: {feat_id}: transferred_from must be a list")
    seen: set[str] = set()
    normalized: list[dict[str, Any]] = []
    for index, item in enumerate(raw):
        label = f"{feat_id}: transferred_from[{index}]"
        if not isinstance(item, dict) or set(item) != {"feature_id"}:
            raise SystemExit(f"error: {label} must contain only feature_id")
        source_id = require_nonempty_string(item.get("feature_id"), f"{label}.feature_id")
        if not is_valid_feat_id(source_id):
            raise SystemExit(f"error: {label}.feature_id is not a valid Feature id")
        if source_id == feat_id:
            raise SystemExit(f"error: {label}.feature_id must differ from successor Feature")
        if source_id in seen:
            raise SystemExit(f"error: {feat_id}: transferred_from must not contain duplicate source Features")
        seen.add(source_id)
        normalized.append({"feature_id": source_id})
    return sorted(normalized, key=lambda item: item["feature_id"])


def canonical_transferred_to(
    raw: Any,
    *,
    feat_id: str,
) -> dict[str, str] | None:
    if raw is None:
        return None
    if not isinstance(raw, dict) or set(raw) != {"feature_id"}:
        raise SystemExit(f"error: {feat_id}: transferred_to must contain only feature_id")
    target_id = require_nonempty_string(raw.get("feature_id"), f"{feat_id}.transferred_to.feature_id")
    if not is_valid_feat_id(target_id) or target_id == feat_id:
        raise SystemExit(f"error: {feat_id}: transferred_to.feature_id is invalid")
    return {"feature_id": target_id}


def current_plan_task_graph(
    tasks: dict[str, Any],
    *,
    feat_id: str,
) -> tuple[dict[str, dict[str, Any]], list[str]]:
    current_ids = latest_plan_task_ids(tasks)
    current_id_set = set(current_ids)
    by_id = {
        str(task.get("id")): task
        for task in tasks.get("tasks", [])
        if isinstance(task, dict) and str(task.get("id") or "") in current_id_set
    }
    missing = current_id_set - set(by_id)
    if missing:
        raise SystemExit(
            f"error: {feat_id}: current Task graph references missing Tasks: "
            + ", ".join(sorted(missing))
        )

    dependents_by_id: dict[str, list[str]] = {task_id: [] for task_id in current_ids}
    indegree: dict[str, int] = {}
    for task_id in current_ids:
        dependencies = canonical_task_dependencies(
            by_id[task_id],
            label=f"{feat_id}/{task_id}",
        )
        unknown = set(dependencies) - current_id_set
        if unknown:
            raise SystemExit(
                f"error: {feat_id}/{task_id}: depends_on references non-current Tasks: "
                + ", ".join(sorted(unknown))
            )
        indegree[task_id] = len(dependencies)
        for dependency in dependencies:
            dependents_by_id[dependency].append(task_id)

    ready = sorted(task_id for task_id, degree in indegree.items() if degree == 0)
    topological_order: list[str] = []
    while ready:
        task_id = ready.pop(0)
        topological_order.append(task_id)
        for dependent in sorted(dependents_by_id[task_id]):
            indegree[dependent] -= 1
            if indegree[dependent] == 0:
                ready.append(dependent)
                ready.sort()
    if len(topological_order) != len(current_ids):
        cyclic = sorted(current_id_set - set(topological_order))
        raise SystemExit(
            f"error: {feat_id}: current Task dependencies contain a cycle: "
            + ", ".join(cyclic)
        )

    return by_id, topological_order


def task_topology_layers_from_graph(
    by_id: dict[str, dict[str, Any]],
    topological_order: list[str],
    *,
    feat_id: str,
) -> list[list[str]]:
    depth_by_id: dict[str, int] = {}
    for task_id in topological_order:
        dependencies = canonical_task_dependencies(
            by_id[task_id],
            label=f"{feat_id}/{task_id}",
        )
        depth_by_id[task_id] = (
            max(depth_by_id[dependency] for dependency in dependencies) + 1
            if dependencies
            else 0
        )
    layers: list[list[str]] = []
    for task_id in topological_order:
        depth = depth_by_id[task_id]
        while len(layers) <= depth:
            layers.append([])
        layers[depth].append(task_id)
    return layers


def task_topology_layers(
    tasks: dict[str, Any],
    *,
    feat_id: str,
) -> tuple[dict[str, dict[str, Any]], list[list[str]]]:
    by_id, topological_order = current_plan_task_graph(tasks, feat_id=feat_id)
    return by_id, task_topology_layers_from_graph(
        by_id,
        topological_order,
        feat_id=feat_id,
    )


def task_frontier(tasks: dict[str, Any], *, feat_id: str) -> dict[str, list[str]]:
    by_id, topological_order = current_plan_task_graph(tasks, feat_id=feat_id)
    active: list[str] = []
    runnable: list[str] = []
    blocked: list[str] = []
    cancelled: list[str] = []
    transferred: list[str] = []
    failed: list[str] = []
    waiting: list[str] = []
    done: list[str] = []
    for task_id in topological_order:
        task = by_id[task_id]
        status = str(task.get("status") or "")
        dependencies = canonical_task_dependencies(
            task,
            label=f"{feat_id}/{task_id}",
        )
        unfinished_dependencies = [
            dependency
            for dependency in dependencies
            if str(by_id[dependency].get("status") or "") != "done"
        ]
        if status in {"in_progress", "blocked", "failed", "done"} and unfinished_dependencies:
            raise SystemExit(
                f"error: {feat_id}/{task_id}: status={status} requires done dependencies: "
                + ", ".join(unfinished_dependencies)
            )
        if status == "in_progress":
            active.append(task_id)
        elif status == "blocked":
            blocked.append(task_id)
        elif status == "failed":
            failed.append(task_id)
        elif status == "cancelled":
            cancelled.append(task_id)
        elif status == "transferred":
            transferred.append(task_id)
        elif status == "done":
            done.append(task_id)
        elif status == "todo":
            if not unfinished_dependencies:
                runnable.append(task_id)
            else:
                waiting.append(task_id)
    return {
        "active": active,
        "runnable": runnable,
        "blocked": blocked,
        "failed": failed,
        "cancelled": cancelled,
        "transferred": transferred,
        "waiting": waiting,
        "done": done,
    }


def feature_task_frontier(
    state: dict[str, Any],
    tasks: dict[str, Any],
) -> dict[str, list[str]]:
    if str(state.get("status") or "") not in CLOSED_FEAT_STATUS and has_reviewed_task_plan(tasks):
        return task_frontier(tasks, feat_id=str(state.get("feat_id") or ""))
    return {"active": [], "runnable": [], "blocked": [], "failed": [], "cancelled": [], "transferred": [], "waiting": [], "done": []}


def derived_feature_status(state: dict[str, Any], tasks: dict[str, Any]) -> str:
    current = str(state.get("status") or "proposal")
    if current in CLOSED_FEAT_STATUS:
        return current
    if workspace_mode_of(state) == "proposal_only" or not has_reviewed_task_plan(tasks):
        return "proposal"
    frontier = task_frontier(tasks, feat_id=str(state.get("feat_id") or ""))
    current_count = len(latest_plan_task_ids(tasks))
    if current_count > 0 and len(frontier["done"]) == current_count:
        return "done"
    if frontier["active"]:
        return "in_progress"
    if frontier["runnable"]:
        return "ready"
    if frontier["failed"]:
        return "replanning"
    if frontier["cancelled"] and not frontier["blocked"]:
        return "replanning"
    return "blocked"


def refresh_feature_status(state: dict[str, Any], tasks: dict[str, Any]) -> None:
    state["status"] = derived_feature_status(state, tasks)


def historical_task_first_revisions(tasks: dict[str, Any]) -> dict[str, int]:
    first_revisions: dict[str, int] = {}
    history = tasks.get("plan_history")
    if not isinstance(history, list):
        return first_revisions
    for entry in history:
        if not isinstance(entry, dict):
            continue
        revision = entry.get("revision")
        task_ids = entry.get("task_ids")
        if (
            not isinstance(revision, int)
            or isinstance(revision, bool)
            or not isinstance(task_ids, list)
        ):
            continue
        for task_id in task_ids:
            if isinstance(task_id, str) and TASK_ID_RE.fullmatch(task_id):
                first_revisions.setdefault(task_id, revision)
    return first_revisions


def plan_history_supersedes_by_task(
    entry: dict[str, Any],
) -> tuple[bool, dict[str, set[str]] | None]:
    raw = entry.get("supersedes_by_task")
    if raw is None:
        return True, None
    if not isinstance(raw, dict):
        return False, None
    out: dict[str, set[str]] = {}
    for raw_owner, raw_supersedes in raw.items():
        owner = str(raw_owner)
        if (
            not TASK_ID_RE.fullmatch(owner)
            or not isinstance(raw_supersedes, list)
            or not raw_supersedes
        ):
            return False, None
        supersedes = {str(item) for item in raw_supersedes}
        if (
            len(supersedes) != len(raw_supersedes)
            or owner in supersedes
            or any(not TASK_ID_RE.fullmatch(str(item)) for item in raw_supersedes)
        ):
            return False, None
        out[owner] = supersedes
    return True, out


def latest_supersedes_by_task(tasks: dict[str, Any]) -> dict[str, set[str]]:
    history = tasks.get("plan_history")
    if not isinstance(history, list) or not history:
        return {}
    valid, explicit = (
        plan_history_supersedes_by_task(history[-1])
        if isinstance(history[-1], dict)
        else (False, None)
    )
    if not valid:
        return {}
    if explicit is not None:
        return explicit
    current_ids = set(latest_plan_task_ids(tasks))
    out: dict[str, set[str]] = {}
    for task in tasks.get("tasks", []):
        if not isinstance(task, dict) or str(task.get("id")) not in current_ids:
            continue
        supersedes = task.get("supersedes")
        if isinstance(supersedes, list) and supersedes:
            out[str(task["id"])] = {str(item) for item in supersedes}
    return out


def task_has_execution_evidence(task: dict[str, Any]) -> bool:
    return bool(
        task.get("status") in {"done", "blocked", "failed", "cancelled", "transferred"}
        or task.get("gate_result") is not None
        or bool(task.get("last_gate_commands"))
    )


def task_has_unstart_evidence(
    paths: HarnessPaths,
    state: dict[str, Any],
    task: dict[str, Any],
    task_id: str,
) -> bool:
    if task.get("gate_result") is not None or bool(task.get("last_gate_commands")):
        return True
    for event in state.get("history", []):
        if (
            isinstance(event, dict)
            and event.get("action") == "task_finished"
            and str(event.get("detail") or "").startswith(f"{task_id} =>")
        ):
            return True
    gate = state.get("gate")
    if isinstance(gate, dict) and str(gate.get("last_task_id") or "") == task_id:
        if (
            gate.get("last_result") is not None
            or bool(gate.get("last_check_commands"))
            or bool(str(gate.get("last_log_path") or "").strip())
        ):
            return True
    for event in state.get("history", []):
        if (
            isinstance(event, dict)
            and event.get("action") == "task_gate"
            and str(event.get("detail") or "").startswith(f"{task_id} =>")
        ):
            return True
    artifacts_dir = paths.feat_artifacts_dir(
        str(state.get("feat_id") or ""),
        status=str(state.get("status") or ""),
    )
    if artifacts_dir.is_dir() and any(
        path.is_file()
        for path in artifacts_dir.iterdir()
        if re.fullmatch(rf"gate-{re.escape(task_id)}-r[0-9]+-[0-9]{{4}}\.log", path.name)
    ):
        return True
    return False


def task_has_canonical_semantics(task: dict[str, Any]) -> bool:
    if not isinstance(task, dict) or not TASK_ID_RE.fullmatch(str(task.get("id") or "")):
        return False
    if task.get("status") not in TASK_STATUS:
        return False
    try:
        canonical_task_last_blocker(task, feat_id=str(task.get("feat_id") or "<unknown>"))
        canonical_task_cancel_reason(task, feat_id=str(task.get("feat_id") or "<unknown>"))
        canonical_task_failure(task, feat_id=str(task.get("feat_id") or "<unknown>"))
    except SystemExit:
        return False
    if not isinstance(task.get("introduced_in_revision"), int) or isinstance(
        task.get("introduced_in_revision"), bool
    ):
        return False
    for field in ("title", "objective", "outcome"):
        if not isinstance(task.get(field), str) or not str(task.get(field)).strip():
            return False
    for field in ("acceptance", "source_refs"):
        values = task.get(field)
        if not isinstance(values, list) or not values or any(not isinstance(item, str) or not item.strip() for item in values):
            return False
    try:
        for index, ref in enumerate(task["source_refs"]):
            normalize_repo_relative_ref(ref, f"task.source_refs[{index}]")
    except SystemExit:
        return False
    supersedes = task.get("supersedes")
    if not isinstance(supersedes, list) or any(
        not isinstance(item, str) or not TASK_ID_RE.fullmatch(item) for item in supersedes
    ):
        return False
    if len(set(supersedes)) != len(supersedes) or str(task.get("id")) in supersedes:
        return False
    try:
        canonical_task_dependencies(task, label=f"task {task.get('id')}")
        canonical_task_effort(task, label=f"task {task.get('id')}")
    except SystemExit:
        return False
    verification = task.get("verification")
    if not isinstance(verification, list) or not verification:
        return False
    for mapping in verification:
        if not isinstance(mapping, dict) or mapping.get("kind") not in TASK_VERIFICATION_KINDS:
            return False
        if not isinstance(mapping.get("ref"), str) or not str(mapping.get("ref")).strip():
            return False
        try:
            normalize_repo_relative_ref(mapping.get("ref"), "task.verification.ref")
        except SystemExit:
            return False
        if not isinstance(mapping.get("proves"), str) or not str(mapping.get("proves")).strip():
            return False
    # A reviewed plan may predate executable Task gates and still remain
    # readable.  New plans are stricter at `parse_task_plan_candidate`, and
    # execution/finish paths fail closed when the current Task has no command
    # proof.  Keeping this structural predicate permissive avoids turning old
    # reviewed history into an unreadable plan merely because its evidence was
    # artifact- or manual-only.
    return True


def has_reviewed_task_plan(tasks: dict[str, Any]) -> bool:
    task_items = tasks.get("tasks")
    if not isinstance(task_items, list) or not task_items:
        return False
    revision = tasks.get("plan_revision")
    if (
        tasks.get("version") != 2
        or tasks.get("plan_status") != "reviewed"
        or not isinstance(revision, int)
        or isinstance(revision, bool)
        or revision < 1
    ):
        return False
    expected_supersedes_revision = None if revision == 1 else revision - 1
    if tasks.get("supersedes_revision") != expected_supersedes_revision:
        return False
    try:
        normalize_repo_relative_ref(tasks.get("review_ref"), "tasks.review_ref")
    except SystemExit:
        return False
    source_refs = tasks.get("source_refs")
    if not isinstance(source_refs, list) or not source_refs:
        return False
    try:
        for index, ref in enumerate(source_refs):
            normalize_repo_relative_ref(ref, f"tasks.source_refs[{index}]")
    except SystemExit:
        return False
    history = tasks.get("plan_history")
    if not isinstance(history, list) or len(history) != revision:
        return False
    previous_history_ids: set[str] = set()
    cumulative_superseded_ids: set[str] = set()
    retired_history_ids: set[str] = set()
    owner_maps_started = False
    previous_owner_map: dict[str, set[str]] = {}
    for history_index, entry in enumerate(history):
        expected_revision = history_index + 1
        if not isinstance(entry, dict) or entry.get("revision") != expected_revision:
            return False
        if entry.get("supersedes_revision") != (None if expected_revision == 1 else expected_revision - 1):
            return False
        try:
            normalize_repo_relative_ref(entry.get("review_ref"), "plan_history.review_ref")
            entry_source_refs = entry.get("source_refs")
            if not isinstance(entry_source_refs, list) or not entry_source_refs:
                return False
            for source_ref in entry_source_refs:
                normalize_repo_relative_ref(source_ref, "plan_history.source_refs")
        except SystemExit:
            return False
        raw_entry_ids = entry.get("task_ids")
        raw_superseded_ids = entry.get("superseded_task_ids")
        if not isinstance(raw_entry_ids, list) or not raw_entry_ids or not isinstance(raw_superseded_ids, list):
            return False
        entry_ids = {str(item) for item in raw_entry_ids}
        superseded_ids = {str(item) for item in raw_superseded_ids}
        if (
            len(entry_ids) != len(raw_entry_ids)
            or len(superseded_ids) != len(raw_superseded_ids)
            or any(not TASK_ID_RE.fullmatch(str(item)) for item in raw_entry_ids)
            or any(not TASK_ID_RE.fullmatch(str(item)) for item in raw_superseded_ids)
        ):
            return False
        if entry_ids & retired_history_ids:
            return False
        expected_removed = previous_history_ids - entry_ids if history_index > 0 else set()
        if superseded_ids != expected_removed:
            return False
        valid_owner_map, owner_map = plan_history_supersedes_by_task(entry)
        if not valid_owner_map:
            return False
        if owner_map is not None:
            owner_maps_started = True
            if set(owner_map) - entry_ids:
                return False
            declared = {task_id for supersedes in owner_map.values() for task_id in supersedes}
            if not superseded_ids.issubset(declared):
                return False
            if previous_owner_map:
                for owner, supersedes in owner_map.items():
                    prior = previous_owner_map.get(owner, set())
                    if not (supersedes - superseded_ids).issubset(prior):
                        return False
                for owner in set(previous_owner_map) & entry_ids:
                    if not previous_owner_map[owner].issubset(owner_map.get(owner, set())):
                        return False
            previous_owner_map = owner_map
        elif owner_maps_started:
            return False
        cumulative_superseded_ids.update(superseded_ids)
        retired_history_ids.update(expected_removed)
        previous_history_ids = entry_ids
    if history[-1].get("review_ref") != tasks.get("review_ref") or history[-1].get("source_refs") != source_refs:
        return False
    current_ids = latest_plan_task_ids(tasks)
    if not current_ids:
        return False
    task_by_id: dict[str, dict[str, Any]] = {}
    for task in task_items:
        if not task_has_canonical_semantics(task):
            return False
        task_id = str(task["id"])
        if task_id in task_by_id:
            return False
        task_by_id[task_id] = task
    for task_id in current_ids:
        task = task_by_id.get(task_id)
        if task is None or bool(task.get("superseded_by")):
            return False
    declared_latest_supersedes = {
        superseded_id
        for task_id in current_ids
        for superseded_id in task_by_id[task_id].get("supersedes", [])
    }
    latest_superseded_ids = {str(item) for item in history[-1].get("superseded_task_ids", [])}
    if (
        not latest_superseded_ids.issubset(declared_latest_supersedes)
        or not declared_latest_supersedes.issubset(cumulative_superseded_ids)
    ):
        return False
    valid_owner_map, latest_owner_map = plan_history_supersedes_by_task(history[-1])
    if not valid_owner_map:
        return False
    if latest_owner_map is not None:
        declared_by_task = {
            task_id: set(task_by_id[task_id].get("supersedes", []))
            for task_id in current_ids
            if task_by_id[task_id].get("supersedes")
        }
        if declared_by_task != latest_owner_map:
            return False
    try:
        current_plan_task_graph(
            tasks,
            feat_id=str(tasks.get("feat_id") or "<unknown>"),
        )
    except SystemExit:
        return False
    return True


def claims_reviewed_task_plan(tasks: dict[str, Any]) -> bool:
    return tasks.get("plan_status") == "reviewed"


def require_canonical_reviewed_claim(tasks: dict[str, Any], *, feat_id: str, action: str) -> None:
    if not claims_reviewed_task_plan(tasks) or has_reviewed_task_plan(tasks):
        return
    raise SystemExit(
        "error: "
        f"feat {feat_id} claims plan_status=reviewed but its task plan is not canonical; "
        "run feature-tracker.sh repair-reviewed-task-plan with exact SHA-256 guards "
        f"before {action}"
    )


def require_reviewed_task_plan(tasks: dict[str, Any], *, feat_id: str, action: str) -> None:
    if has_reviewed_task_plan(tasks):
        return
    raise SystemExit(
        "error: "
        f"feat {feat_id} has no reviewed task plan; run feature-tracker.sh set-task-plan "
        f"before {action}"
    )


def build_reviewed_tasks_payload(
    feat_id: str,
    candidate: dict[str, Any],
    *,
    revision: int,
    supersedes_revision: int | None,
    previous: dict[str, Any] | None = None,
) -> dict[str, Any]:
    previous = previous or draft_tasks_payload(feat_id)
    previous_items = previous.get("tasks") if isinstance(previous.get("tasks"), list) else []

    previous_by_id = {
        str(task.get("id")): task
        for task in previous_items
        if isinstance(task, dict) and str(task.get("id") or "").strip()
    }
    previous_ids = set(previous_by_id)
    historical_first_revisions = historical_task_first_revisions(previous)
    historical_ids = set(historical_first_revisions)
    previous_active_ids = set(latest_plan_task_ids(previous)) if has_reviewed_task_plan(previous) else previous_ids
    previous_in_progress_ids = {
        str(task.get("id"))
        for task in previous_items
        if isinstance(task, dict) and task.get("status") == "in_progress"
    }
    candidate_ids = {str(task["id"]) for task in candidate["tasks"]}
    missing_in_progress = previous_in_progress_ids - candidate_ids
    if missing_in_progress:
        raise SystemExit(
            "error: reviewed task plan must preserve active Tasks during a mid-run revision: "
            + ", ".join(sorted(missing_in_progress))
        )
    reintroduced_historical = {
        task_id
        for task_id in candidate_ids
        if task_id in historical_ids and task_id not in previous_active_ids
    }
    if reintroduced_historical:
        raise SystemExit(
            "error: reviewed task plan cannot reactivate historical superseded tasks: "
            + ", ".join(sorted(reintroduced_historical))
        )
    superseded_ids = previous_active_ids - candidate_ids
    previous_history = previous.get("plan_history")
    cumulative_historical_supersedes = (
        {
            str(task_id)
            for entry in previous_history
            if isinstance(entry, dict)
            for task_id in entry.get("superseded_task_ids", [])
            if isinstance(task_id, str)
        }
        if isinstance(previous_history, list)
        else set()
    )
    declared_current_supersedes: set[str] = set()
    invalid_carried_supersedes: set[str] = set()
    for task in candidate["tasks"]:
        task_id = str(task["id"])
        previous_task = previous_by_id.get(task_id)
        previous_task_supersedes = (
            set(previous_task.get("supersedes", []))
            if isinstance(previous_task, dict) and isinstance(previous_task.get("supersedes"), list)
            else set()
        )
        carried_historical = previous_task_supersedes & cumulative_historical_supersedes
        candidate_supersedes = set(task.get("supersedes", []))
        dropped_carried = carried_historical - candidate_supersedes
        if dropped_carried:
            raise SystemExit(
                "error: retained task must preserve its historical supersession lineage: "
                f"{task_id} dropped {', '.join(sorted(dropped_carried))}"
            )
        for superseded in task.get("supersedes", []):
            if superseded in previous_active_ids:
                declared_current_supersedes.add(superseded)
                continue
            if (
                superseded not in cumulative_historical_supersedes
                or superseded not in previous_task_supersedes
            ):
                invalid_carried_supersedes.add(superseded)
    if invalid_carried_supersedes:
        raise SystemExit(
            "error: reviewed task plan may carry historical supersession only on the same retained task: "
            + ", ".join(sorted(invalid_carried_supersedes))
        )
    retained_supersedes = declared_current_supersedes & candidate_ids
    if retained_supersedes:
        raise SystemExit(
            "error: reviewed task plan cannot supersede tasks retained in the current plan: "
            + ", ".join(sorted(retained_supersedes))
        )
    missing_lineage = superseded_ids - declared_current_supersedes
    if missing_lineage:
        raise SystemExit(
            "error: reviewed task plan must preserve supersession lineage for removed tasks: "
            + ", ".join(sorted(missing_lineage))
        )

    def edges(records: list[dict[str, Any]], ids: set[str]) -> set[tuple[str, str]]:
        return {
            (source, str(task["id"]))
            for task in records if str(task["id"]) in ids
            for source in canonical_task_dependencies(task, label=f"{feat_id}/{task['id']}")
        }

    prior_edges = edges(previous_items, previous_active_ids)
    next_edges = edges(candidate["tasks"], candidate_ids)
    dependency_changes = {
        "added": [{"from": source, "to": target} for source, target in sorted(next_edges - prior_edges)],
        "removed": [{"from": source, "to": target} for source, target in sorted(prior_edges - next_edges)],
    }
    history = list(previous.get("plan_history") or [])
    history.append(
        {
            "revision": revision,
            "supersedes_revision": supersedes_revision,
            "review_ref": candidate["review_ref"],
            "source_refs": candidate["source_refs"],
            "task_ids": [task["id"] for task in candidate["tasks"]],
            "superseded_task_ids": sorted(superseded_ids),
            "supersedes_by_task": {
                task["id"]: sorted(task.get("supersedes", []))
                for task in candidate["tasks"]
                if task.get("supersedes")
            },
        }
    )
    if supersedes_revision is not None:
        history[-1]["dependency_changes"] = dependency_changes
    semantic_fields = (
        "title",
        "objective",
        "outcome",
        "acceptance",
        "verification",
        "source_refs",
        "supersedes",
    )
    tasks = []
    for task in candidate["tasks"]:
        previous_task = previous_by_id.get(task["id"])
        previous_has_evidence = bool(
            previous_task
            and (
                task_has_execution_evidence(previous_task)
                or previous_task.get("status") == "in_progress"
            )
        )
        if previous_task and previous_has_evidence:
            changed = [field for field in semantic_fields if previous_task.get(field) != task.get(field)]
            if canonical_task_dependencies(
                previous_task,
                label=f"{feat_id}/{task['id']}",
            ) != canonical_task_dependencies(
                task,
                label=f"{feat_id}/{task['id']}",
            ):
                changed.append("depends_on")
            if task_effort_fingerprint(
                previous_task,
                label=f"{feat_id}/{task['id']}",
            ) != task_effort_fingerprint(
                task,
                label=f"{feat_id}/{task['id']}",
            ):
                changed.append("effort")
            command_correction = (
                changed == ["verification"]
                and previous_task.get("status") == "in_progress"
                and previous_task.get("gate_result") == "fail"
                and [
                    {key: value for key, value in mapping.items()
                     if not (key == "ref" and mapping.get("kind") == "command")}
                    for mapping in previous_task["verification"]
                ] == [
                    {key: value for key, value in mapping.items()
                     if not (key == "ref" and mapping.get("kind") == "command")}
                    for mapping in task["verification"]
                ]
            )
            if changed and not command_correction:
                raise SystemExit(
                    "error: executed task semantics are immutable across plan revisions: "
                    f"{task['id']} changed {', '.join(changed)}"
                )
            retained = dict(previous_task)
            if command_correction:
                retained["verification"] = task["verification"]
                history[-1].setdefault("command_corrections", []).append(task["id"])
            tasks.append(retained)
            continue
        introduced_in_revision = historical_first_revisions.get(task["id"], revision)
        tasks.append(
            {
                **task,
                "introduced_in_revision": introduced_in_revision,
                "status": "todo",
                "gate_result": None,
                "last_gate_commands": [],
                "notes": [],
            }
        )

    superseded_by: dict[str, list[str]] = {}
    for task in candidate["tasks"]:
        for superseded in task.get("supersedes", []):
            superseded_by.setdefault(superseded, []).append(task["id"])
    preserved_historical_ids = previous_ids - previous_active_ids
    for task_id in sorted(preserved_historical_ids):
        previous_task = previous_by_id[task_id]
        if task_has_execution_evidence(previous_task):
            tasks.append(dict(previous_task))
    for task_id in sorted(superseded_ids):
        previous_task = previous_by_id[task_id]
        previous_has_evidence = task_has_execution_evidence(previous_task)
        if previous_has_evidence:
            preserved = dict(previous_task)
            preserved["superseded_by"] = sorted(superseded_by.get(task_id, []))
            tasks.append(preserved)
    return {
        "version": 2,
        "feat_id": feat_id,
        "plan_status": "reviewed",
        "plan_revision": revision,
        "supersedes_revision": supersedes_revision,
        "review_ref": candidate["review_ref"],
        "source_refs": candidate["source_refs"],
        "plan_history": history,
        "tasks": tasks,
    }


def load_local_issuer(paths: HarnessPaths) -> dict[str, Any] | None:
    if not paths.issuer_file.exists():
        return None
    payload = load_json(paths.issuer_file)
    if not isinstance(payload, dict):
        raise SystemExit(f"error: invalid local issuer schema: {paths.issuer_file}")
    return payload


def normalize_local_issuer_payload(payload: dict[str, Any], *, namespace: str) -> dict[str, Any]:
    return {
        "version": LOCAL_ISSUER_VERSION,
        "scheme": FEATURE_ID_SCHEME,
        "namespace": namespace,
        "guard_key_source": f"git-config:{LOCAL_GUARD_KEY_CONFIG}",
    }


def tracked_paths_under(root: Path, rel_path: Path) -> list[str]:
    cp = run_cmd(["git", "-C", str(root), "ls-files", "--", rel_path.as_posix()])
    if cp.returncode != 0:
        return []
    return [line.strip() for line in cp.stdout.splitlines() if line.strip()]


def git_local_config_get(root: Path, key: str) -> str:
    cp = run_cmd(["git", "-C", str(root), "config", "--local", "--get", key])
    if cp.returncode != 0:
        return ""
    return cp.stdout.strip()


def git_local_config_set(root: Path, key: str, value: str) -> None:
    cp = run_cmd(["git", "-C", str(root), "config", "--local", key, value])
    if cp.returncode != 0:
        raise SystemExit(cp.stderr.strip() or cp.stdout.strip() or f"error: failed to set git config {key}")


def used_current_namespaces(paths: HarnessPaths) -> set[str]:
    namespaces: set[str] = set()
    if not paths.index_file.exists():
        return namespaces
    for item in load_index(paths).get("features", []):
        namespace = parse_current_feat_namespace(str(item.get("feat_id") or ""))
        if namespace:
            namespaces.add(namespace)
    return namespaces


def choose_local_namespace(paths: HarnessPaths, *, exclude: set[str] | None = None) -> str:
    blocked = used_current_namespaces(paths) | (exclude or set())
    for _ in range(FEATURE_ID_BASE ** FEAT_NAMESPACE_WIDTH):
        namespace = random_token(width=FEAT_NAMESPACE_WIDTH)
        if namespace not in blocked:
            return namespace
    raise SystemExit("error: no free local issuer namespace available for the current tracker scheme")


def ensure_local_issuer_state(root: Path, paths: HarnessPaths, *, force_rotate: bool = False) -> dict[str, Any]:
    existing = load_local_issuer(paths)
    current_namespace = str(existing.get("namespace") or "").strip() if isinstance(existing, dict) else ""

    namespace = current_namespace
    should_rewrite_issuer = force_rotate or not is_public_token(namespace, width=FEAT_NAMESPACE_WIDTH)
    if should_rewrite_issuer:
        namespace = choose_local_namespace(
            paths,
            exclude={current_namespace} if current_namespace else set(),
        )
    payload = normalize_local_issuer_payload(existing or {}, namespace=namespace)
    if existing != payload:
        save_json(paths.issuer_file, payload)
        print(f"write: {paths.issuer_file}")

    guard_key = git_local_config_get(root, LOCAL_GUARD_KEY_CONFIG)
    if force_rotate or not is_public_token(guard_key, width=LOCAL_GUARD_KEY_WIDTH):
        guard_key = random_token(width=LOCAL_GUARD_KEY_WIDTH)
        git_local_config_set(root, LOCAL_GUARD_KEY_CONFIG, guard_key)
        print(f"write: git-config {LOCAL_GUARD_KEY_CONFIG}")

    payload = load_local_issuer(paths)
    if payload is None:
        raise SystemExit(f"error: missing local issuer after initialization: {paths.issuer_file}")
    return payload


def build_guard_token(root: Path, namespace: str, cursor_token: str) -> str:
    guard_key = git_local_config_get(root, LOCAL_GUARD_KEY_CONFIG)
    if not is_public_token(guard_key, width=LOCAL_GUARD_KEY_WIDTH):
        raise SystemExit(
            "error: missing git-local guard key; run feature-tracker.sh initialize-tracker "
            "or feature-tracker.sh rekey-local-issuer"
        )
    return short_hash_token(
        f"{FEATURE_ID_SCHEME}:{guard_key}:{cursor_token}:{namespace}",
        width=FEAT_GUARD_WIDTH,
    )


def load_index(paths: HarnessPaths) -> dict[str, Any]:
    if not paths.index_file.exists():
        raise SystemExit(f"error: missing harness index: {paths.index_file}")
    data = load_json(paths.index_file)
    if not isinstance(data, dict) or "features" not in data:
        raise SystemExit(f"error: invalid index schema: {paths.index_file}")
    normalize_index_data(data)
    return data


def save_index(paths: HarnessPaths, index_data: dict[str, Any]) -> None:
    normalize_index_data(index_data)
    save_json(paths.index_file, index_data)


def load_runtime_policy(paths: HarnessPaths) -> dict[str, Any]:
    target = paths.runtime_policy_file
    if not target.exists():
        if paths.legacy_config_file.exists():
            raise SystemExit(
                "error: detected legacy policy file "
                f"{paths.legacy_config_file}. "
                "legacy compatibility is disabled; migrate manually by comparing current SKILL.md "
                "and creating runtime-policy.json."
            )
        raise SystemExit(
            f"error: missing runtime policy file: {paths.runtime_policy_file}. "
            "run feature-tracker.sh initialize-tracker to scaffold the latest layout."
        )
    try:
        payload = load_json(target)
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise SystemExit(
            f"error: invalid runtime policy JSON: {target}: {normalize_error_text(exc)}"
        ) from None
    if not isinstance(payload, dict):
        raise SystemExit(f"error: invalid runtime policy schema: {target}")
    return payload


def runtime_gate_config(config: dict[str, Any]) -> dict[str, Any]:
    gate_cfg = config.get("gate")
    if not isinstance(gate_cfg, dict):
        raise SystemExit("error: runtime policy gate must be an object")
    return gate_cfg


def ensure_runtime_policy(paths: HarnessPaths, skill_dir: Path) -> Path:
    if paths.runtime_policy_file.exists():
        return paths.runtime_policy_file
    if paths.legacy_config_file.exists():
        raise SystemExit(
            "error: detected legacy policy file "
            f"{paths.legacy_config_file}. "
            "automatic compatibility migration is disabled; migrate manually to runtime-policy.json."
        )

    copy_template_if_missing(skill_dir, "tpl/runtime-policy-template.json", paths.runtime_policy_file)
    return paths.runtime_policy_file


def resolve_workspace_mode(policy: dict[str, Any], requested: str | None) -> str:
    workspace_cfg = policy.get("workspace", {}) if isinstance(policy, dict) else {}
    raw = str(requested or workspace_cfg.get("default_mode", "proposal_only")).strip().lower()
    if raw not in WORKSPACE_MODES:
        raise SystemExit(
            "error: invalid workspace mode: "
            f"{raw}. expected one of {', '.join(sorted(WORKSPACE_MODES))}"
        )
    return raw


def resolve_branch_prefix(policy: dict[str, Any], requested: str | None) -> str:
    git_cfg = policy.get("git", {}) if isinstance(policy, dict) else {}
    raw = str(requested if requested is not None else git_cfg.get("branch_prefix", "feat/")).strip()
    if not raw:
        raise SystemExit("error: branch prefix must not be empty")
    return raw


def workspace_mode_of(state: dict[str, Any]) -> str:
    raw = str(state.get("workspace_mode") or "").strip().lower()
    if raw not in WORKSPACE_MODES:
        raise SystemExit(
            "error: invalid or missing workspace_mode in feat state: "
            f"{state.get('feat_id', '<unknown>')}"
        )
    return raw


def workspace_signature(state: dict[str, Any], execution: FeatureExecutionRoot) -> dict[str, str]:
    return {
        "workspace_mode": str(state.get("workspace_mode") or ""),
        "branch": str(state.get("branch") or ""),
        "worktree_path": str(state.get("worktree_path") or ""),
        "execution_root": str(execution.path.resolve()),
    }


def revalidate_workspace_signature(
    root: Path,
    state: dict[str, Any],
    expected: dict[str, str],
    *,
    label: str,
) -> FeatureExecutionRoot | None:
    try:
        execution = resolve_feature_execution_root(root, state)
    except SystemExit as exc:
        eprint(str(exc))
        eprint(f"error: workspace changed while {label} was running; result was not recorded")
        return None
    current = workspace_signature(state, execution)
    if current != expected:
        eprint(f"error: workspace changed while {label} was running; result was not recorded")
        return None
    return execution


def make_worktree_assignment(
    root: Path,
    *,
    feat_id: str,
    branch_prefix: str,
) -> tuple[str, str, str, Path, str]:
    branch = f"{branch_prefix}{feat_id}"
    wt_name = f"wt-{feat_id}"
    wt_rel = str(Path(".worktrees") / wt_name)
    wt_abs = root / wt_rel
    base_ref = pick_base_branch(root)

    ensure_worktree_assignment_preflight(root, branch=branch, wt_abs=wt_abs)
    ensure_worktrees_ignored(root)
    (root / ".worktrees").mkdir(parents=True, exist_ok=True)

    cp = run_cmd(
        [
            "git",
            "-C",
            str(root),
            "worktree",
            "add",
            str(wt_abs),
            "-b",
            branch,
            base_ref,
        ]
    )
    if cp.returncode != 0:
        err = cp.stderr.strip() or cp.stdout.strip() or "failed to create worktree"
        raise SystemExit(f"error: {err}")

    return branch, wt_name, wt_rel, wt_abs, base_ref


def ensure_worktree_assignment_preflight(
    root: Path,
    *,
    branch: str,
    wt_abs: Path,
) -> None:
    worktrees_root = root / ".worktrees"
    if worktrees_root.exists() and not worktrees_root.is_dir():
        raise SystemExit(
            f"error: worktrees root path is not a directory: {relative_display(root, worktrees_root)}"
        )
    if git_local_branch_exists(root, branch):
        raise SystemExit(f"error: worktree branch already exists: {branch}")
    if wt_abs in git_worktree_paths(root):
        raise SystemExit(
            f"error: worktree path already registered: {relative_display(root, wt_abs)}"
        )
    if os.path.lexists(wt_abs):
        raise SystemExit(
            f"error: worktree path already exists: {relative_display(root, wt_abs)}"
        )


def get_feat_index_entry(index_data: dict[str, Any], feat_id: str) -> dict[str, Any] | None:
    for item in index_data.get("features", []):
        if item.get("feat_id") == feat_id:
            return item
    return None


def feat_index_payload(state: dict[str, Any]) -> dict[str, Any]:
    feat_id = str(state["feat_id"])
    status = str(state.get("status") or "proposal")
    runtime_role = canonical_runtime_role(state.get("runtime_role"), feat_id=feat_id)
    runtime_relations = canonical_runtime_relations(state.get("runtime_relations"), feat_id=feat_id)
    transferred_from = canonical_transferred_from(
        state.get("transferred_from"),
        feat_id=feat_id,
    )
    transferred_to = canonical_transferred_to(state.get("transferred_to"), feat_id=feat_id)

    payload = {
        "feat_id": state["feat_id"],
        "title": state.get("title", ""),
        "status": status,
        "workspace_mode": state.get("workspace_mode", ""),
        "branch": state.get("branch", ""),
        "worktree_name": state.get("worktree_name", ""),
    }
    if transferred_from:
        payload["transferred_from"] = transferred_from
    if transferred_to:
        payload["transferred_to"] = transferred_to
    if status == "discarded" and state.get("replacement_feat_id"):
        payload["replacement_feat_id"] = state.get("replacement_feat_id")
    if runtime_role != "standalone" or "runtime_role" in state:
        payload["runtime_role"] = runtime_role
    if runtime_relations or "runtime_relations" in state:
        payload["runtime_relations"] = runtime_relations
    return payload


def upsert_feat_index_entry(index_data: dict[str, Any], state: dict[str, Any]) -> None:
    normalize_index_data(index_data)
    entries = index_data.setdefault("features", [])
    payload = feat_index_payload(state)
    for i, item in enumerate(entries):
        if item.get("feat_id") == payload["feat_id"]:
            entries[i] = payload
            return
    entries.append(payload)
    entries.sort(key=lambda x: feat_sort_key(str(x.get("feat_id", ""))))


def upsert_feat_index(
    paths: HarnessPaths,
    state: dict[str, Any],
    *,
    index_data: dict[str, Any] | None = None,
) -> None:
    working = index_data if index_data is not None else load_index(paths)
    upsert_feat_index_entry(working, state)
    save_index(paths, working)


def feat_index_status(paths: HarnessPaths, feat_id: str) -> str:
    index_data = load_index(paths)
    entry = get_feat_index_entry(index_data, feat_id)
    if entry is None:
        raise SystemExit(f"error: feat not indexed: {feat_id}")
    return str(entry.get("status") or "proposal")


def load_feat(paths: HarnessPaths, feat_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
    status = feat_index_status(paths, feat_id)
    state_file = paths.feat_state(feat_id, status=status)
    tasks_file = paths.feat_tasks(feat_id, status=status)
    if not state_file.exists():
        raise SystemExit(f"error: missing feat state file: {state_file}")
    if not tasks_file.exists():
        raise SystemExit(f"error: missing feat tasks file: {tasks_file}")
    # A malformed Feature record is a repairable record, not an internal fault.
    # Reporting it as a tracker error lets the human projections isolate one bad
    # record behind a repair-needed card instead of crashing the whole board.
    try:
        state = load_json(state_file)
        tasks = load_json(tasks_file)
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise SystemExit(
            f"error: unreadable feat record: {feat_id}: {normalize_error_text(exc)}"
        ) from exc
    return state, tasks


def guarded_file_revision(path: Path, expected: str, *, label: str) -> None:
    expected = str(expected or "").strip().lower()
    if expected == "none":
        if path.exists():
            raise SystemExit(
                f"error: stale {label} revision: expected none, current {sha256_file(path)}"
            )
        return
    if not re.fullmatch(r"[0-9a-f]{64}", expected):
        raise SystemExit(f"error: --expected-{label}-sha256 must be `none` or a lowercase SHA-256 digest")
    if not path.is_file():
        raise SystemExit(f"error: stale {label} revision: expected {expected}, current none")
    current = sha256_file(path)
    if current != expected:
        raise SystemExit(
            f"error: stale {label} revision: expected {expected}, current {current}"
        )


def expected_feature_goal_ref(paths: HarnessPaths, state: dict[str, Any]) -> str:
    feat_id = str(state.get("feat_id") or "")
    status = str(state.get("status") or "")
    return relative_display(paths.root, paths.feat_goal(feat_id, status=status))


def feature_goal_contract_issues(paths: HarnessPaths, state: dict[str, Any]) -> list[str]:
    feat_id = str(state.get("feat_id") or "")
    status = str(state.get("status") or "")
    goal_path = paths.feat_goal(feat_id, status=status)
    contract = state.get("goal_contract")
    if contract is None:
        return [f"{feat_id}: goal.md exists without state.json goal_contract"] if goal_path.exists() else []
    if not isinstance(contract, dict):
        return [f"{feat_id}: state.json goal_contract must be an object"]

    issues: list[str] = []
    if contract.get("schema") != FEATURE_GOAL_SCHEMA:
        issues.append(f"{feat_id}: goal_contract.schema must be {FEATURE_GOAL_SCHEMA}")
    expected_ref = expected_feature_goal_ref(paths, state)
    if contract.get("ref") != expected_ref:
        issues.append(f"{feat_id}: goal_contract.ref must be {expected_ref}")
    revision = contract.get("revision")
    if not isinstance(revision, str) or not re.fullmatch(r"[0-9a-f]{64}", revision):
        issues.append(f"{feat_id}: goal_contract.revision must be a lowercase SHA-256 digest")
    if not goal_path.is_file():
        issues.append(f"{feat_id}: goal_contract target is missing: {expected_ref}")
        return issues

    text = read_text(goal_path)
    issues.extend(f"{feat_id}: {issue}" for issue in validate_feature_goal_text(text, feat_id=feat_id))
    actual_revision = sha256_file(goal_path)
    if isinstance(revision, str) and revision != actual_revision:
        issues.append(f"{feat_id}: goal_contract.revision drifts from goal.md")
    return issues


def require_valid_feature_goal_contract(paths: HarnessPaths, state: dict[str, Any]) -> None:
    issues = feature_goal_contract_issues(paths, state)
    if issues:
        raise SystemExit("error: " + "; ".join(issues))


def normalize_feature_goal_ref(paths: HarnessPaths, state: dict[str, Any]) -> None:
    contract = state.get("goal_contract")
    if isinstance(contract, dict):
        contract["ref"] = expected_feature_goal_ref(paths, state)


def ensure_closed_feat_rerun_state(
    paths: HarnessPaths,
    feat_id: str,
    *,
    expected_status: str,
) -> None:
    if expected_status not in CLOSED_FEAT_STATUS:
        raise SystemExit(f"error: unsupported closed feat status for rerun verification: {expected_status}")

    active_dir = paths.feat_dir(feat_id)
    expected_dir = paths.feat_dir(feat_id, status=expected_status)
    sibling_statuses = CLOSED_FEAT_STATUS - {expected_status}

    if active_dir.exists():
        raise SystemExit(
            "error: feat "
            f"{feat_id} claims status={expected_status} but still lives under features/ directory: "
            f"{relative_display(paths.root, active_dir)}"
        )
    for sibling_status in sorted(sibling_statuses):
        sibling_dir = paths.feat_dir(feat_id, status=sibling_status)
        if sibling_dir.exists():
            raise SystemExit(
                "error: feat "
                f"{feat_id} claims status={expected_status} but also exists under "
                f"{sibling_dir.parent.name} directory: {relative_display(paths.root, sibling_dir)}"
            )
    if not expected_dir.exists():
        raise SystemExit(
            "error: feat "
            f"{feat_id} claims status={expected_status} but closed feat dir missing: "
            f"{relative_display(paths.root, expected_dir)}"
        )

    state_file = paths.feat_state(feat_id, status=expected_status)
    tasks_file = paths.feat_tasks(feat_id, status=expected_status)
    summary_file = paths.feat_summary(feat_id, status=expected_status)
    if not state_file.exists():
        raise SystemExit(
            "error: closed feat state file missing for "
            f"{feat_id}: {relative_display(paths.root, state_file)}"
        )
    if not tasks_file.exists():
        raise SystemExit(
            "error: closed feat tasks file missing for "
            f"{feat_id}: {relative_display(paths.root, tasks_file)}"
        )
    if not summary_file.exists():
        raise SystemExit(
            "error: closed feat summary missing for "
            f"{feat_id}: {relative_display(paths.root, summary_file)}"
        )

    closed_state = load_json(state_file)
    actual_status = str(closed_state.get("status") or "")
    if actual_status != expected_status:
        raise SystemExit(
            f"error: closed feat state status drift for {feat_id}: expected {expected_status}, found {actual_status or '<missing>'}"
        )
    closed_tasks = load_json(tasks_file)
    canonical_closeout_review(
        paths.root,
        closed_tasks.get("closeout_review"),
        feat_id=feat_id,
    )


def canonical_depends_on(state: dict[str, Any], *, feat_id: str) -> list[str]:
    if "depends_on" not in state:
        return []
    raw_deps = state.get("depends_on")
    if not isinstance(raw_deps, list):
        raise SystemExit(
            f"error: {feat_id}: state.json depends_on must be a list of feature ids"
        )

    deps: list[str] = []
    seen: set[str] = set()
    for index, raw_dep in enumerate(raw_deps):
        dep = str(raw_dep).strip()
        if not dep:
            raise SystemExit(
                f"error: {feat_id}: state.json depends_on[{index}] must be a non-empty feature id"
            )
        if not is_valid_feat_id(dep):
            raise SystemExit(f"error: {feat_id}: invalid depends_on feature id: {dep}")
        if dep == feat_id:
            raise SystemExit(f"error: feat cannot depend on itself: {feat_id}")
        if dep in seen:
            continue
        seen.add(dep)
        deps.append(dep)
    return deps


def plan_closeout_root_entries(
    feat_dir: Path,
    *,
    include_closeout_root_files: bool = False,
) -> list[tuple[str, str]]:
    moves: list[tuple[str, str]] = []
    if not feat_dir.exists():
        return moves

    preserve_dir = feat_dir / "artifacts" / FEATURE_CLOSEOUT_PRESERVE_DIRNAME
    reserved = {path.name for path in preserve_dir.iterdir()} if preserve_dir.exists() else set()
    for child in sorted(feat_dir.iterdir()):
        if child.is_file() and child.name in (
            FEATURE_REQUIRED_ROOT_FILES | FEATURE_DERIVED_ROOT_FILES | FEATURE_CONTROL_ROOT_FILES
        ):
            continue
        if child.is_file() and child.name in FEATURE_CLOSEOUT_ROOT_FILES and not include_closeout_root_files:
            continue
        if child.is_dir() and child.name == "artifacts":
            continue
        target_name = child.name
        stem = child.stem if child.suffix else child.name
        suffix = child.suffix if child.suffix else ""
        counter = 1
        while target_name in reserved:
            target_name = f"{stem}-{counter:04d}{suffix}"
            counter += 1
        reserved.add(target_name)
        moves.append(
            (
                child.name,
                (Path("artifacts") / FEATURE_CLOSEOUT_PRESERVE_DIRNAME / target_name).as_posix(),
            )
        )
    return moves


def plan_invalid_discard_root_entries(feat_dir: Path) -> list[tuple[str, str]]:
    preserve_dir = feat_dir / "artifacts" / FEATURE_INVALID_SOURCE_DIRNAME
    if preserve_dir.exists():
        raise SystemExit(
            "error: invalid discard source already exists; inspect before retry: "
            f"{preserve_dir}"
        )
    return [
        (
            child.name,
            (Path("artifacts") / FEATURE_INVALID_SOURCE_DIRNAME / child.name).as_posix(),
        )
        for child in sorted(feat_dir.iterdir())
        if child.name != "artifacts"
    ]


def materialize_feature_artifact(
    paths: HarnessPaths,
    skill_dir: Path,
    feat_id: str,
    *,
    kind: str,
    overwrite: bool,
) -> Path:
    state, _ = load_feat(paths, feat_id)
    status = str(state.get("status") or "")
    if status in CLOSED_FEAT_STATUS:
        raise SystemExit(
            "error: closed feats keep state.json, tasks.json, optional goal.md, summary.md, and artifacts/ at the root; "
            "live-feature helper files are not materializable after closeout"
        )
    if kind == "proposal":
        target = paths.feat_proposal(feat_id, status=status)
        template = (
            load_template(skill_dir, "tpl/feature-proposal-template.md")
            .replace("<feat-id>", feat_id)
            .replace("<feature-id>", feat_id)
            .replace("<goal>", str(state.get("goal") or ""))
        )
    elif kind == "spec-delta":
        target = paths.feat_spec_delta(feat_id, status=status)
        template = load_template(skill_dir, "tpl/feature-spec-delta-template.md").replace("<capability>", "core")
    elif kind == "verification":
        target = paths.feat_verification(feat_id, status=status)
        template = load_template(skill_dir, "tpl/verification-template.md")
    else:
        raise SystemExit(f"error: unsupported artifact kind: {kind}")

    if target.exists() and not overwrite:
        raise SystemExit(f"error: artifact already exists: {target}")

    write_text(target, template)
    return target


def resolve_input_file(root: Path, raw: str, *, label: str) -> Path:
    path = Path(raw)
    if not path.is_absolute():
        path = root / path
    path = path.resolve()
    if not path.is_file():
        raise SystemExit(f"error: {label} does not exist: {path}")
    return path


def cmd_validate_feature_goal(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    state, _ = load_feat(paths, args.feat)
    status = str(state.get("status") or "")
    if args.goal_file:
        source = resolve_input_file(root, args.goal_file, label="goal file")
        issues = validate_feature_goal_text(read_text(source), feat_id=args.feat)
    else:
        issues = feature_goal_contract_issues(paths, state)
        if state.get("goal_contract") is None and not paths.feat_goal(args.feat, status=status).exists():
            issues.append(f"{args.feat}: feature has no goal.md contract")
    if issues:
        for issue in issues:
            eprint(f"error: {issue}")
        return 1
    print(f"ok: feature goal valid {args.feat}")
    return 0


def cmd_set_feature_goal(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    state, tasks = load_feat(paths, args.feat)
    require_canonical_reviewed_claim(tasks, feat_id=args.feat, action="setting a Feature Goal")
    status = str(state.get("status") or "")
    if status in CLOSED_FEAT_STATUS:
        eprint("error: closed features preserve goal.md but do not accept Goal updates")
        return 1

    source = resolve_input_file(root, args.goal_file, label="goal file")
    candidate = normalized_markdown(read_text(source))
    issues = validate_feature_goal_text(candidate, feat_id=args.feat)
    if issues:
        for issue in issues:
            eprint(f"error: {issue}")
        return 1

    target = paths.feat_goal(args.feat, status=status)
    current_contract = state.get("goal_contract")
    if current_contract is not None:
        if not isinstance(current_contract, dict):
            eprint("error: state.json goal_contract must be an object")
            return 1
        if current_contract.get("schema") != FEATURE_GOAL_SCHEMA:
            eprint(f"error: goal_contract.schema must be {FEATURE_GOAL_SCHEMA}")
            return 1
        if current_contract.get("ref") != expected_feature_goal_ref(paths, state):
            eprint("error: goal_contract.ref is not the canonical feature goal path")
            return 1
        current_revision = str(current_contract.get("revision") or "")
        if not re.fullmatch(r"[0-9a-f]{64}", current_revision):
            eprint("error: goal_contract.revision must be a lowercase SHA-256 digest")
            return 1
    else:
        if target.exists():
            eprint("error: goal.md exists without state.json goal_contract; resolve the collision before setting Goal")
            return 1
        current_revision = "none"
    expected_revision = str(args.expected_revision or "").strip().lower()
    if expected_revision != "none" and not re.fullmatch(r"[0-9a-f]{64}", expected_revision):
        eprint("error: --expected-revision must be `none` or a lowercase SHA-256 digest")
        return 1
    if expected_revision != current_revision:
        eprint(
            "error: stale Goal revision: "
            f"expected {expected_revision}, current {current_revision}"
        )
        return 1

    old_bytes = target.read_bytes() if target.exists() else None
    old_mode = target.stat().st_mode & 0o777 if target.exists() else None
    old_state = copy.deepcopy(state)
    old_tasks = copy.deepcopy(tasks)
    try:
        write_text_atomic(target, candidate)
        revision = sha256_file(target)
        state["goal_contract"] = {
            "schema": FEATURE_GOAL_SCHEMA,
            "ref": relative_display(root, target),
            "revision": revision,
        }
        state.setdefault("history", []).append(
            history_event("feature_goal_set", f"{current_revision} -> {revision}")
        )
        save_feat(paths, args.feat, state, tasks)
    except BaseException:
        if old_bytes is None:
            target.unlink(missing_ok=True)
        else:
            target.write_bytes(old_bytes)
            if old_mode is not None:
                target.chmod(old_mode)
        try:
            save_feat(paths, args.feat, old_state, old_tasks)
        except BaseException:
            pass
        raise

    print(f"goal: {relative_display(root, target)}")
    print(f"revision: {revision}")
    return 0


def save_feat(
    paths: HarnessPaths,
    feat_id: str,
    state: dict[str, Any],
    tasks: dict[str, Any],
    *,
    index_data: dict[str, Any] | None = None,
) -> None:
    normalize_state_payload(state)
    normalize_tasks_payload(tasks)
    canonical_transferred_from(state.get("transferred_from"), feat_id=feat_id)
    canonical_transferred_to(state.get("transferred_to"), feat_id=feat_id)
    require_canonical_reviewed_claim(tasks, feat_id=feat_id, action="saving Feature state")
    refresh_feature_status(state, tasks)
    normalize_feature_goal_ref(paths, state)
    require_valid_feature_goal_contract(paths, state)
    status = str(state.get("status") or "")
    require_canonical_task_blockers(tasks, feat_id=feat_id)
    require_task_blocker_runtime_role(state, tasks, feat_id=feat_id)
    if status == "blocked" and not current_task_blockers(tasks, feat_id=feat_id):
        raise SystemExit(f"error: {feat_id}: blocked Feature requires Task blocker evidence")
    save_json(paths.feat_state(feat_id, status=status), state)
    save_json(paths.feat_tasks(feat_id, status=status), tasks)
    receipt_path = paths.feat_owner_receipt(feat_id, status=status)
    if has_reviewed_task_plan(tasks) or state.get("goal_contract") is not None:
        save_json(receipt_path, build_owner_receipt(paths, state, tasks))
    elif receipt_path.exists():
        receipt_path.unlink()
    upsert_feat_index(paths, state, index_data=index_data)


def owner_continuation(
    state: dict[str, Any],
    tasks: dict[str, Any],
) -> tuple[str, list[dict[str, str | None]], str | None]:
    status = str(state.get("status") or "proposal")
    replacement = str(state.get("replacement_feat_id") or "").strip() or None
    if status == "transferred":
        transferred_to = state.get("transferred_to")
        if isinstance(transferred_to, dict):
            replacement = str(transferred_to.get("feature_id") or "").strip() or None
    if status == "archived":
        return "complete", [], None
    if status == "done":
        return (
            "blocked",
            [{
                "item_id": None,
                "class": "closeout_required",
                "reason": "All current-plan Tasks are done; archive or discard the Feature.",
            }],
            None,
        )
    if status == "discarded":
        if replacement:
            return "superseded", [], replacement
        return "unavailable", [], None
    if status == "transferred":
        return "superseded", [], replacement
    if not has_reviewed_task_plan(tasks):
        return (
            "blocked",
            [{"item_id": None, "class": "task_plan_missing", "reason": "Feature has no reviewed semantic task plan."}],
            None,
        )
    if status in {"ready", "in_progress"}:
        return "continue", [], None
    if status == "replanning":
        return (
            "blocked",
            [{
                "item_id": None,
                "class": "replan_required",
                "reason": (
                    "Failed Tasks " + ", ".join(item["item_id"] for item in current_task_failures(tasks, feat_id=str(state.get("feat_id") or "")))
                    + " require a reviewed successor plan; preserve independent work."
                    if current_task_failures(tasks, feat_id=str(state.get("feat_id") or ""))
                    else "A current Task was cancelled; install the reviewed successor plan before continuing."
                ),
            }],
            None,
        )
    if status == "blocked":
        blockers = current_task_blockers(
            tasks,
            feat_id=str(state.get("feat_id") or ""),
        )
        if not blockers:
            raise SystemExit(
                f"error: {state.get('feat_id')}: blocked Feature requires Task blocker evidence"
            )
        return "blocked", blockers, None
    return (
        "blocked",
        [{"item_id": None, "class": "workspace_unassigned", "reason": "Feature has no assigned execution workspace."}],
        None,
    )


def build_owner_receipt(
    paths: HarnessPaths,
    state: dict[str, Any],
    tasks: dict[str, Any],
) -> dict[str, Any]:
    require_valid_feature_goal_contract(paths, state)
    feat_id = str(state.get("feat_id") or "")
    status = str(state.get("status") or "proposal")
    feat_dir = paths.feat_dir(feat_id, status=status)
    evidence_refs = [
        relative_display(paths.root, feat_dir / "state.json"),
        relative_display(paths.root, feat_dir / "tasks.json"),
    ]
    if state.get("goal_contract") is not None:
        evidence_refs.append(relative_display(paths.root, feat_dir / FEATURE_GOAL_FILENAME))
    evidence_hashes: dict[str, str] = {}
    for evidence_ref in evidence_refs:
        evidence_path = paths.root / evidence_ref
        if not evidence_path.is_file():
            raise SystemExit(f"error: owner receipt evidence missing: {evidence_ref}")
        evidence_hashes[evidence_ref] = sha256_file(evidence_path)
    return build_owner_receipt_payload(paths, state, tasks, evidence_hashes)


def build_owner_receipt_payload(
    paths: HarnessPaths,
    state: dict[str, Any],
    tasks: dict[str, Any],
    evidence_hashes: dict[str, str],
) -> dict[str, Any]:
    feat_id = str(state.get("feat_id") or "")
    status = str(state.get("status") or "proposal")
    active_item_ids = feature_task_frontier(state, tasks)["active"]
    continuation, blockers, replacement_id = owner_continuation(state, tasks)
    replacement_ref = None
    if replacement_id:
        replacement_status = feat_index_status(paths, replacement_id)
        replacement_ref = relative_display(
            paths.root,
            paths.feat_owner_receipt(replacement_id, status=replacement_status),
        )
    evidence_refs = list(evidence_hashes)
    semantic_projection = {
        "owner_kind": "feature_tracker",
        "owner_id": feat_id,
        "lifecycle_status": status,
        "continuation": continuation,
        "active_item_ids": active_item_ids,
        "blockers": blockers,
        "replacement_ref": replacement_ref,
        "evidence_hashes": evidence_hashes,
    }
    semantic_revision = sha256_bytes(
        json.dumps(semantic_projection, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    )
    return {
        "schema": OWNER_RECEIPT_SCHEMA,
        "owner_kind": "feature_tracker",
        "owner_id": feat_id,
        "semantic_revision": semantic_revision,
        "lifecycle_status": status,
        "continuation": continuation,
        "active_item_ids": active_item_ids,
        "blockers": blockers,
        "replacement_ref": replacement_ref,
        "evidence_refs": evidence_refs,
        "evidence_hashes": evidence_hashes,
    }


def load_current_owner_receipt(
    paths: HarnessPaths,
    state: dict[str, Any],
    tasks: dict[str, Any],
) -> dict[str, Any]:
    feat_id = str(state.get("feat_id") or "")
    status = str(state.get("status") or "")
    expected = build_owner_receipt(paths, state, tasks)
    receipt_path = paths.feat_owner_receipt(feat_id, status=status)
    if not receipt_path.exists():
        raise SystemExit(
            "error: missing persisted owner receipt: "
            f"{relative_display(paths.root, receipt_path)}"
        )
    persisted = load_json(receipt_path)
    if persisted != expected:
        raise SystemExit(
            "error: owner receipt drift from canonical feature state: "
            f"{relative_display(paths.root, receipt_path)}"
        )
    return persisted


def find_task(tasks: dict[str, Any], task_id: str) -> dict[str, Any]:
    for item in tasks.get("tasks", []):
        if item.get("id") == task_id:
            return item
    raise SystemExit(f"error: task not found: {task_id}")


def count_tasks(tasks: dict[str, Any], status: str) -> int:
    return sum(1 for t in tasks.get("tasks", []) if t.get("status") == status)


def count_current_tasks(tasks: dict[str, Any], status: str) -> int:
    current_ids = set(latest_plan_task_ids(tasks))
    return sum(
        1
        for task in tasks.get("tasks", [])
        if isinstance(task, dict)
        and task.get("status") == status
        and (not current_ids or str(task.get("id") or "") in current_ids)
    )


def apply_task_finish_transition(
    state: dict[str, Any],
    tasks: dict[str, Any],
    *,
    root: Path | None = None,
    feat_id: str,
    task_id: str,
    result: str,
    blocked_reason_class: Any = None,
    blocked_reason: Any = None,
    blocked_owner: Any = None,
    blocked_resume_when: Any = None,
    cancel_reason: Any = None,
    failure_reason: Any = None,
    failure_assumption: Any = None,
) -> None:
    if str(state.get("status") or "") in CLOSED_FEAT_STATUS:
        raise SystemExit("error: cannot finish a Task in a closed Feature")
    if task_id not in set(latest_plan_task_ids(tasks)):
        raise SystemExit(f"error: task {task_id} is not part of the current reviewed task plan")
    task = find_task(tasks, task_id)
    if result == "failed":
        if task.get("status") not in {"in_progress", "blocked"}:
            raise SystemExit(f"error: task must be in_progress or blocked to mark failed: {task_id}")
    elif task.get("status") != "in_progress":
        raise SystemExit(f"error: task is not in_progress: {task_id}")

    reason_class, reason = canonical_task_finish_blocker(
        result=result,
        blocked_reason_class=blocked_reason_class,
        blocked_reason=blocked_reason,
        blocked_owner=blocked_owner,
        blocked_resume_when=blocked_resume_when,
        cancel_reason=cancel_reason,
    )
    normalized_cancel_reason = canonical_task_finish_cancellation(
        result=result,
        cancel_reason=cancel_reason,
    )
    normalized_failure = canonical_task_finish_failure(
        result=result,
        failure_reason=failure_reason,
        failure_assumption=failure_assumption,
    )
    if result == "done":
        if task.get("gate_result") != "pass":
            raise SystemExit("error: cannot finish task as done without gate pass")
        require_task_gate_receipt(
            task,
            feat_id=feat_id,
            root=root,
            state=state,
            plan_revision=tasks.get("plan_revision"),
        )

    blocker_metadata = {}
    for key, value in (("owner", blocked_owner), ("resume_when", blocked_resume_when)):
        if value is not None:
            if not isinstance(value, str) or not value.strip() or value != value.strip():
                raise SystemExit(f"error: --blocked-{key.replace('_', '-')} must be a trimmed non-empty string")
            blocker_metadata[key] = value

    task["status"] = result
    state.setdefault("counters", {})["no_progress_rounds"] = 0
    state.setdefault("history", []).append(
        history_event("task_finished", f"{task_id} => {result}")
    )

    if result == "blocked":
        assert reason_class is not None and reason is not None
        task["last_blocker"] = {"class": reason_class, "reason": reason}
        task["last_blocker"].update(blocker_metadata)
        state.setdefault("history", []).append(
            history_event("task_blocker_set", f"{task_id} => {reason_class}")
        )
        canonical_task_last_blocker(task, feat_id=feat_id)
    elif result == "cancelled":
        assert normalized_cancel_reason is not None
        task.pop("last_blocker", None)
        task["cancel_reason"] = normalized_cancel_reason
        state.setdefault("history", []).append(
            history_event("task_cancelled", f"{task_id} => plan rework")
        )
        canonical_task_cancel_reason(task, feat_id=feat_id)
    elif result == "failed":
        assert normalized_failure is not None
        reason, assumption = normalized_failure
        task.pop("last_blocker", None)
        task.pop("cancel_reason", None)
        task["failure"] = {
            "reason": reason,
            "assumption": assumption,
        }
        state.setdefault("history", []).append(
            history_event("task_failed", f"{task_id} => assumption disproved; replan required")
        )
        canonical_task_failure(task, feat_id=feat_id)
    refresh_feature_status(state, tasks)


def feature_scope_for_status(status: str) -> str:
    if status == "archived":
        return "archived"
    if status == "discarded":
        return "discarded"
    if status == "transferred":
        return "transferred"
    return "active"


def parse_feature_scopes(raw_items: list[str] | None) -> set[str]:
    if not raw_items:
        return set(DEFAULT_FEATURE_SCOPES)
    scopes: set[str] = set()
    for raw in raw_items:
        for item in re.split(r"[,|]", raw):
            scope = item.strip()
            if not scope:
                continue
            if scope not in FEATURE_SCOPES:
                allowed = ", ".join(sorted(FEATURE_SCOPES))
                raise SystemExit(f"error: invalid feature scope: {scope}; expected one of: {allowed}")
            scopes.add(scope)
    if not scopes:
        return set(DEFAULT_FEATURE_SCOPES)
    return scopes


def ensure_harness_exists(paths: HarnessPaths) -> None:
    if not paths.harness_dir.exists():
        raise SystemExit(
            "error: tracker not initialized. run feature-tracker.sh initialize-tracker first"
        )


def ensure_harness_gitignore(paths: HarnessPaths) -> None:
    target = paths.harness_dir / ".gitignore"
    content = target.read_text(encoding="utf-8") if target.exists() else ""
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    changed = False
    for rule in ("artifacts/*.log", "local/"):
        if rule not in lines:
            lines.append(rule)
            changed = True
    if not changed:
        return
    write_text(target, "\n".join(lines) + "\n")
    print(f"write: {target}")


def ensure_worktrees_ignored(root: Path) -> None:
    gitignore = root / ".gitignore"
    content = gitignore.read_text(encoding="utf-8") if gitignore.exists() else ""
    lines = [line.strip() for line in content.splitlines()]
    if ".worktrees" not in lines:
        with gitignore.open("a", encoding="utf-8") as f:
            if content and not content.endswith("\n"):
                f.write("\n")
            f.write(".worktrees\n")
        print(f"write: {gitignore} (+.worktrees)")


def load_template(skill_dir: Path, rel: str) -> str:
    path = skill_dir / "references" / rel
    if not path.exists():
        raise SystemExit(f"error: missing template: {path}")
    return read_text(path)


def copy_template_if_missing(skill_dir: Path, rel: str, dest: Path) -> None:
    if dest.exists():
        return
    write_text(dest, load_template(skill_dir, rel))
    print(f"write: {dest}")


def cmd_apply(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    skill_dir = Path(args.skill_dir).resolve()
    paths = HarnessPaths(root)
    ensure_git_repo(root)

    paths.harness_dir.mkdir(parents=True, exist_ok=True)
    paths.feats_dir.mkdir(parents=True, exist_ok=True)
    paths.feats_archived_dir.mkdir(parents=True, exist_ok=True)
    paths.feats_discarded_dir.mkdir(parents=True, exist_ok=True)
    paths.feats_transferred_dir.mkdir(parents=True, exist_ok=True)
    paths.index_dir.mkdir(parents=True, exist_ok=True)
    paths.artifacts_dir.mkdir(parents=True, exist_ok=True)

    copy_template_if_missing(skill_dir, "tpl/features-index-template.json", paths.index_file)
    save_index(paths, load_index(paths))
    ensure_runtime_policy(paths, skill_dir)
    ensure_harness_gitignore(paths)
    ensure_local_issuer_state(root, paths)

    ensure_worktrees_ignored(root)
    print(f"ok: harness initialized at {paths.harness_dir}")
    return 0


def pick_base_branch(root: Path) -> str:
    for candidate in ("main", "master"):
        cp = run_cmd(["git", "-C", str(root), "show-ref", "--verify", f"refs/heads/{candidate}"])
        if cp.returncode == 0:
            return candidate
    cp = run_cmd(["git", "-C", str(root), "rev-parse", "--abbrev-ref", "HEAD"])
    branch = cp.stdout.strip() if cp.returncode == 0 else ""
    return branch or "HEAD"


def cmd_rekey_local_issuer(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    ensure_git_repo(root)
    payload = ensure_local_issuer_state(root, paths, force_rotate=True)
    print(f"namespace: {payload.get('namespace', '')}")
    return 0


def cmd_materialize_feature_artifact(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    skill_dir = Path(args.skill_dir).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    target = materialize_feature_artifact(
        paths,
        skill_dir,
        args.feat,
        kind=args.kind,
        overwrite=bool(args.overwrite),
    )
    print(f"write: {target}")
    return 0


def allocate_feat_id(root: Path, paths: HarnessPaths) -> tuple[str, dict[str, Any]]:
    index_data = load_index(paths)
    issuance, _ = ensure_feature_id_issuance(index_data)
    existing_ids = {str(item.get("feat_id", "")) for item in index_data.get("features", [])}
    issuer = ensure_local_issuer_state(root, paths)
    namespace = str(issuer.get("namespace") or "")

    def exists(feat_id: str) -> bool:
        return (
            feat_id in existing_ids
            or paths.feat_dir(feat_id).exists()
            or paths.feat_dir(feat_id, status="archived").exists()
            or paths.feat_dir(feat_id, status="discarded").exists()
            or paths.feat_dir(feat_id, status="transferred").exists()
        )

    next_sequence = int(issuance.get("next_cursor", 0))
    while True:
        cursor_token = encode_public_token(next_sequence, width=FEAT_CURSOR_WIDTH)
        guard_token = build_guard_token(root, namespace, cursor_token)
        candidate = f"f-{cursor_token}{namespace}{guard_token}"
        next_sequence += 1
        if exists(candidate):
            continue
        issuance["next_cursor"] = next_sequence
        return candidate, index_data


def build_create_dag_projection_payload(
    paths: HarnessPaths,
    *,
    feat_id: str,
    state: dict[str, Any],
) -> dict[str, Any]:
    states, _ = load_non_archived_feats(paths)
    if feat_id in states:
        raise SystemExit(f"error: feat already exists in active graph: {feat_id}")
    states[feat_id] = copy.deepcopy(state)
    all_status_by_feat = feature_status_by_id(paths)
    all_status_by_feat[feat_id] = str(state.get("status") or "proposal")
    return build_dag_projection_payload(states, all_status_by_feat=all_status_by_feat)


def build_closeout_dag_projection_payload(
    paths: HarnessPaths,
    *,
    feat_id: str,
    target_status: str,
) -> dict[str, Any]:
    states, _ = load_non_archived_feats(paths)
    states.pop(feat_id, None)
    all_status_by_feat = feature_status_by_id(paths)
    all_status_by_feat[feat_id] = target_status
    return build_dag_projection_payload(states, all_status_by_feat=all_status_by_feat)


def active_feature_family_ids(paths: HarnessPaths, slug: str) -> list[str]:
    states, _ = load_non_archived_feats(paths)
    return sorted(
        (
            feat_id
            for feat_id, state in states.items()
            if str(state.get("slug") or "") == slug
        ),
        key=feat_sort_key,
    )


def active_feature_family_id(paths: HarnessPaths, slug: str) -> str | None:
    matches = active_feature_family_ids(paths, slug)
    if len(matches) > 1:
        raise SystemExit(
            "error: active feature family is not unique: "
            f"slug={slug}; features={','.join(matches)}"
        )
    return matches[0] if matches else None


def cmd_feat_new(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    ensure_git_repo(root)
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)

    title = args.title.strip()
    goal = args.goal.strip()
    slug = slugify(args.slug if args.slug else title)
    transferred_from = [
        {"feature_id": str(source).strip()}
        for source in (getattr(args, "transferred_from", []) or [])
        if str(source).strip()
    ]
    try:
        transferred_from = canonical_transferred_from(
            transferred_from,
            feat_id="<new-feature>",
        )
    except SystemExit as exc:
        eprint(str(exc).replace("<new-feature>", "new Feature"))
        return 1
    task_plan = getattr(args, "task_plan", None)
    tasks_file_raw = str(getattr(args, "tasks_file", "") or "").strip()
    if task_plan is not None and tasks_file_raw:
        eprint("error: internal task_plan and --tasks-file cannot be supplied together")
        return 1
    if tasks_file_raw:
        tasks_file = Path(tasks_file_raw)
        if not tasks_file.is_absolute():
            tasks_file = root / tasks_file
        if not tasks_file.exists():
            eprint(f"error: reviewed task plan file not found: {tasks_file}")
            return 1
        task_plan = parse_task_plan_candidate(
            load_json(tasks_file),
            root=root,
            label=f"reviewed task plan {relative_display(root, tasks_file)}",
        )

    try:
        existing_feat_id = active_feature_family_id(paths, slug)
    except SystemExit as exc:
        eprint(str(exc))
        return 1
    if existing_feat_id is not None:
        if transferred_from:
            eprint(
                "error: an existing active Feature family cannot receive transferred_from metadata; "
                "route the extension through its reviewed Task plan"
            )
            return 1
        existing_state, existing_tasks = load_feat(paths, existing_feat_id)
        if task_plan is not None:
            current_revision = existing_tasks.get("plan_revision")
            if not isinstance(current_revision, int) or isinstance(current_revision, bool):
                current_revision = 0
            eprint(
                "error: active feature family already exists; extensions must update its Task plan: "
                f"slug={slug}; feature={existing_feat_id}; current_revision={current_revision}"
            )
            eprint(
                "next: feature-tracker.sh set-task-plan "
                f"--root {root} --feature {existing_feat_id} --tasks-file <reviewed-task-plan.json> "
                f"--expected-revision {current_revision}"
            )
            return 1
        print(f"reuse: active feature family {slug} => {existing_feat_id}")
        print(f"feature_status: {existing_state.get('status', '')}")
        print(f"feature_id: {existing_feat_id}")
        return 0

    policy = load_runtime_policy(paths)
    workspace_mode = resolve_workspace_mode(policy, args.workspace_mode)
    if task_plan is None and workspace_mode != "proposal_only":
        eprint(
            "error: create-feature without a reviewed task plan must use workspace_mode=proposal_only; "
            "supply --tasks-file or materialize a plan later with set-task-plan"
        )
        return 1

    feat_id, planned_index_data = allocate_feat_id(root, paths)
    if not is_valid_feat_id(feat_id):
        eprint(f"error: generated invalid feat id: {feat_id}")
        return 1
    for transfer in transferred_from:
        source_entry = get_feat_index_entry(planned_index_data, transfer["feature_id"])
        if source_entry is None:
            eprint(
                "error: transferred_from Feature is not indexed: "
                f"{transfer['feature_id']}"
            )
            return 1
        if str(source_entry.get("status") or "") in CLOSED_FEAT_STATUS:
            eprint(
                "error: transferred_from source must still be active before transfer: "
                f"{transfer['feature_id']}"
            )
            return 1

    branch_prefix = resolve_branch_prefix(policy, args.branch_prefix)
    base_ref = pick_base_branch(root)
    root_branch = current_branch(root)
    branch = ""
    wt_name = ""
    wt_rel = ""
    wt_abs: Path | None = None

    state: dict[str, Any] = {
        "version": 1,
        "feat_id": feat_id,
        "title": title,
        "slug": slug,
        "goal": goal,
        "status": "ready" if task_plan is not None and workspace_mode != "proposal_only" else "proposal",
        "workspace_mode": workspace_mode,
        "base_ref": base_ref,
        "branch": branch,
        "worktree_name": wt_name,
        "worktree_path": wt_rel,
        "runtime_role": "standalone",
        "runtime_relations": [],
        "counters": {
            "gate_fail_streak": 0,
            "no_progress_rounds": 0,
            "round_count": 0,
        },
        "gate": {
            "last_result": None,
            "last_task_id": None,
            "last_check_commands": [],
            "last_log_path": None,
        },
        "history": [
            history_event(
                "feat_created",
                (
                    f"workspace_mode={workspace_mode}; base_ref={base_ref}; "
                    f"root_branch={root_branch or 'detached'}"
                ),
            )
        ],
    }
    if transferred_from:
        state["transferred_from"] = transferred_from

    try:
        build_create_dag_projection_payload(paths, feat_id=feat_id, state=state)
    except SystemExit as exc:
        eprint(str(exc))
        return 1
    if workspace_mode == "worktree":
        branch = f"{branch_prefix}{feat_id}"
        wt_abs = (root / ".worktrees" / f"wt-{feat_id}").resolve()
        try:
            ensure_worktree_assignment_preflight(root, branch=branch, wt_abs=wt_abs)
        except SystemExit as exc:
            eprint(str(exc))
            return 1
    save_index(paths, planned_index_data)

    if workspace_mode == "worktree":
        try:
            branch, wt_name, wt_rel, wt_abs, base_ref = make_worktree_assignment(
                root,
                feat_id=feat_id,
                branch_prefix=branch_prefix,
            )
        except SystemExit as exc:
            eprint(str(exc))
            return 1
        state["base_ref"] = base_ref
        state["branch"] = branch
        state["worktree_name"] = wt_name
        state["worktree_path"] = wt_rel

    tasks = (
        build_reviewed_tasks_payload(
            feat_id,
            task_plan,
            revision=1,
            supersedes_revision=None,
        )
        if task_plan is not None
        else draft_tasks_payload(feat_id)
    )

    feat_dir = paths.feat_dir(feat_id)
    feat_dir.mkdir(parents=True, exist_ok=False)
    save_feat(paths, feat_id, state, tasks, index_data=planned_index_data)

    print(f"write: {feat_dir / 'state.json'}")
    print(f"write: {feat_dir / 'tasks.json'}")
    print(f"workspace_mode: {workspace_mode}")
    print(f"branch: {branch}")
    print(f"worktree: {wt_abs if wt_abs is not None else ''}")
    print(f"feature_id: {feat_id}")
    return 0


def cmd_feat_new_from_planning_entry_handoff(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    ensure_git_repo(root)
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)

    handoff_path = Path(args.handoff).resolve()
    if not handoff_path.exists():
        eprint(f"error: planning-entry handoff not found: {handoff_path}")
        return 1

    handoff = load_planning_entry_handoff(handoff_path, root=root)
    if handoff["status"] != "approved":
        eprint(
            "error: planning-entry handoff must be approved before feature creation: "
            f"{handoff['status']}"
        )
        return 1
    if handoff["clarification_status"] != "complete":
        eprint(
            "error: planning-entry handoff clarification_status must be complete before feature creation: "
            f"{handoff['clarification_status']}"
        )
        return 1
    if not handoff["discussion_clear"]:
        eprint("error: planning-entry handoff discussion_clear must be true before feature creation")
        return 1
    if handoff["user_review_status"] != "approved":
        eprint(
            "error: planning-entry handoff user_review_status must be approved before feature creation: "
            f"{handoff['user_review_status']}"
        )
        return 1
    recipe_id = str(handoff["recommended_route"]["recipe_id"])
    if recipe_id not in PLANNING_ENTRY_FEATURE_RECIPE_IDS:
        eprint(
            "error: planning-entry handoff recommended_route.recipe_id must target tracker materialization: "
            f"{recipe_id}"
        )
        return 1
    task_plan = handoff.get("task_plan")
    if task_plan is None and args.workspace_mode not in {None, "proposal_only"}:
        eprint(
            "error: planning-entry handoff without task_plan can only create a proposal_only feature"
        )
        return 1

    family_slug = slugify(args.slug if args.slug else handoff["title"])
    try:
        existing_feat_id = active_feature_family_id(paths, family_slug)
    except SystemExit as exc:
        eprint(str(exc))
        return 1
    if existing_feat_id is not None:
        eprint(
            "error: planning-entry handoff resolves to an existing active feature family; "
            f"feature={existing_feat_id}; slug={family_slug}; route the extension through its Task plan"
        )
        return 1

    before_ids = active_feature_ids(paths)
    create_args = argparse.Namespace(
        root=str(root),
        title=handoff["title"],
        slug=args.slug,
        goal=handoff["goal"],
        workspace_mode=args.workspace_mode if task_plan is not None else "proposal_only",
        branch_prefix=args.branch_prefix,
        tasks_file="",
        task_plan=task_plan,
        transferred_from=[],
    )
    result = cmd_feat_new(create_args)
    if result != 0:
        return result

    after_ids = active_feature_ids(paths)
    new_ids = sorted(after_ids - before_ids, key=feat_sort_key)
    if len(new_ids) != 1:
        eprint(
            "error: expected exactly one new feature after planning-entry handoff materialization, "
            f"found {len(new_ids)}"
        )
        return 1

    feat_id = new_ids[0]
    proposal_path = paths.feat_proposal(feat_id)
    write_text(proposal_path, render_planning_entry_proposal(feat_id, handoff))
    state, tasks = load_feat(paths, feat_id)
    state.setdefault("history", []).append(
        history_event(
            "planning_entry_handoff_applied",
            f"{handoff['handoff_id']}; recipe={recipe_id}",
        )
    )
    save_feat(paths, feat_id, state, tasks)
    print(f"handoff: {relative_display(root, handoff_path)}")
    print(f"proposal: {relative_display(root, proposal_path)}")
    return 0


def cmd_set_task_plan(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    state, tasks = load_feat(paths, args.feat)
    status = str(state.get("status") or "")
    if status in CLOSED_FEAT_STATUS:
        eprint(f"error: task plan cannot be replaced while feature status is {status}")
        return 1

    current_revision = tasks.get("plan_revision")
    if not isinstance(current_revision, int) or isinstance(current_revision, bool):
        current_revision = 1 if has_reviewed_task_plan(tasks) else 0
    if args.expected_revision != current_revision:
        eprint(
            "error: task plan revision conflict: "
            f"expected {args.expected_revision}, current {current_revision}"
        )
        return 1

    tasks_file = Path(args.tasks_file)
    if not tasks_file.is_absolute():
        tasks_file = root / tasks_file
    if not tasks_file.exists():
        eprint(f"error: reviewed task plan file not found: {tasks_file}")
        return 1
    candidate = parse_task_plan_candidate(
        load_json(tasks_file),
        root=root,
        label=f"reviewed task plan {relative_display(root, tasks_file)}",
    )
    next_revision = current_revision + 1
    tasks = build_reviewed_tasks_payload(
        args.feat,
        candidate,
        revision=next_revision,
        supersedes_revision=current_revision if current_revision > 0 else None,
        previous=tasks,
    )
    if count_tasks(tasks, "todo") > 0 and status in {"blocked", "done"}:
        state["status"] = "proposal" if workspace_mode_of(state) == "proposal_only" else "ready"
    state.setdefault("history", []).append(
        history_event(
            "task_plan_set",
            f"revision={next_revision}; supersedes_revision={current_revision if current_revision > 0 else 'none'}",
        )
    )
    save_feat(paths, args.feat, state, tasks)
    print(f"ok: task plan set {args.feat} revision={next_revision}")
    audit = build_task_plan_audit(state, tasks)
    print(f"plan_revision: {next_revision}")
    print(f"review_ref: {tasks['review_ref']}")
    print("replan_required_from: " + (",".join(audit["replan_required_from"]) or "none"))
    for kind, edges in audit["latest_dependency_changes"].items():
        for edge in edges:
            print(f"dependency_{kind}: {edge['from']} -> {edge['to']}")
    for replacement in audit["installed_replacements"]:
        if replacement["plan_revision"] == next_revision:
            successors = ",".join(item["task_id"] for item in replacement["successors"])
            print(f"replanned: {replacement['failed_task_id']} -> {successors}")
    return 0


def validate_repaired_task_plan(
    state: dict[str, Any],
    previous: dict[str, Any],
    replacement: dict[str, Any],
    *,
    feat_id: str,
) -> None:
    normalize_tasks_payload(replacement)
    if replacement.get("feat_id") != feat_id:
        raise SystemExit(f"error: repaired task plan feat_id must be {feat_id}")
    if not has_reviewed_task_plan(replacement):
        raise SystemExit("error: repaired task plan must be a complete canonical reviewed tasks.json")
    previous_revision = previous.get("plan_revision")
    replacement_revision = replacement.get("plan_revision")
    if (
        not isinstance(previous_revision, int)
        or isinstance(previous_revision, bool)
        or replacement_revision < previous_revision
    ):
        raise SystemExit(
            "error: repaired task plan must not lower plan_revision; "
            f"current {previous_revision}, replacement {replacement_revision}"
        )
    require_canonical_task_blockers(replacement, feat_id=feat_id)
    previous_in_progress = sorted(
        str(task.get("id"))
        for task in previous.get("tasks", [])
        if isinstance(task, dict) and task.get("status") == "in_progress"
    )
    replacement_in_progress = sorted(
        str(task.get("id"))
        for task in replacement.get("tasks", [])
        if isinstance(task, dict) and task.get("status") == "in_progress"
    )
    if replacement_in_progress != previous_in_progress:
        raise SystemExit(
            "error: repaired task plan must preserve the exact active Task set"
        )
    expected_status = derived_feature_status(state, replacement)
    if str(state.get("status") or "") != expected_status:
        raise SystemExit(
            "error: repaired task plan must preserve Feature status aggregation; "
            f"expected {state.get('status')}, replacement derives {expected_status}"
        )


def publish_repaired_task_plan(
    paths: HarnessPaths,
    state: dict[str, Any],
    replacement: dict[str, Any],
    *,
    feat_id: str,
) -> None:
    status = str(state.get("status") or "")
    tasks_path = paths.feat_tasks(feat_id, status=status)
    receipt_path = paths.feat_owner_receipt(feat_id, status=status)
    old_tasks = tasks_path.read_bytes()
    old_receipt = receipt_path.read_bytes() if receipt_path.exists() else None
    try:
        write_bytes_atomic(tasks_path, json_payload_bytes(replacement))
        save_json(receipt_path, build_owner_receipt(paths, state, replacement))
    except BaseException:
        write_bytes_atomic(tasks_path, old_tasks)
        if old_receipt is None:
            receipt_path.unlink(missing_ok=True)
        else:
            write_bytes_atomic(receipt_path, old_receipt)
        raise


def cmd_repair_reviewed_task_plan(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    state, tasks = load_feat(paths, args.feat)
    status = str(state.get("status") or "")
    if status in CLOSED_FEAT_STATUS:
        eprint("error: closed features do not accept task-plan repair")
        return 1

    state_path = paths.feat_state(args.feat, status=status)
    tasks_path = paths.feat_tasks(args.feat, status=status)
    goal_path = paths.feat_goal(args.feat, status=status)
    receipt_path = paths.feat_owner_receipt(args.feat, status=status)
    guarded_file_revision(state_path, args.expected_state_sha256, label="state")
    guarded_file_revision(tasks_path, args.expected_tasks_sha256, label="tasks")
    guarded_file_revision(goal_path, args.expected_goal_sha256, label="goal")
    guarded_file_revision(receipt_path, args.expected_receipt_sha256, label="receipt")

    source = resolve_input_file(root, args.tasks_file, label="repaired tasks file")
    replacement = load_json(source)
    if not isinstance(replacement, dict):
        eprint("error: repaired tasks file must contain a JSON object")
        return 1
    replacement = copy.deepcopy(replacement)
    validate_repaired_task_plan(state, tasks, replacement, feat_id=args.feat)
    normalize_feature_goal_ref(paths, state)
    require_valid_feature_goal_contract(paths, state)
    require_task_blocker_runtime_role(state, replacement, feat_id=args.feat)
    if status == "blocked" and not current_task_blockers(replacement, feat_id=args.feat):
        eprint(f"error: {args.feat}: blocked Feature requires Task blocker evidence")
        return 1

    publish_repaired_task_plan(paths, state, replacement, feat_id=args.feat)
    print(
        "ok: reviewed task plan repaired "
        f"{args.feat} revision={replacement['plan_revision']} tasks_sha256={sha256_file(tasks_path)}"
    )
    return 0


def cmd_get_owner_receipt(args: argparse.Namespace) -> int:
    paths = HarnessPaths(Path(args.root).resolve())
    ensure_harness_exists(paths)
    state, tasks = load_feat(paths, args.feat)
    receipt = load_current_owner_receipt(paths, state, tasks)
    if args.json:
        print(json.dumps(receipt, ensure_ascii=False, indent=2))
        return 0
    print(f"owner: {receipt['owner_kind']}/{receipt['owner_id']}")
    print(f"semantic_revision: {receipt['semantic_revision']}")
    print(f"lifecycle_status: {receipt['lifecycle_status']}")
    print(f"continuation: {receipt['continuation']}")
    print(f"active_item_ids: {','.join(receipt['active_item_ids']) or 'none'}")
    return 0


def cmd_repair_feature_projections(args: argparse.Namespace) -> int:
    paths = HarnessPaths(Path(args.root).resolve())
    ensure_harness_exists(paths)
    index_data = load_index(paths)
    records = []
    identities = set()
    for directory in (
        paths.feats_dir, paths.feats_archived_dir,
        paths.feats_discarded_dir, paths.feats_transferred_dir,
    ):
        for child in sorted(directory.iterdir()) if directory.exists() else []:
            if not child.is_dir():
                continue
            state = load_json(child / "state.json")
            tasks = load_json(child / "tasks.json")
            feat_id = str(state.get("feat_id") or "")
            if feat_id != child.name or tasks.get("feat_id") != feat_id:
                raise SystemExit(f"error: canonical Feature identity mismatch: {child}")
            if feat_id in identities:
                raise SystemExit(f"error: duplicate canonical Feature identity: {feat_id}")
            if paths.feat_dir(feat_id, status=state.get("status")) != child:
                raise SystemExit(f"error: canonical Feature directory placement mismatch: {child}")
            identities.add(feat_id)
            records.append((state, tasks))
    index_data["features"] = []
    for state, _tasks in records:
        upsert_feat_index_entry(index_data, state)
    originals = {paths.index_file: paths.index_file.read_bytes()}
    try:
        save_index(paths, index_data)
        for state, tasks in records:
            receipt_path = paths.feat_owner_receipt(state["feat_id"], status=state["status"])
            originals[receipt_path] = receipt_path.read_bytes() if receipt_path.exists() else None
            if has_reviewed_task_plan(tasks) or state.get("goal_contract") is not None:
                save_json(receipt_path, build_owner_receipt(paths, state, tasks))
            else:
                receipt_path.unlink(missing_ok=True)
    except BaseException:
        for path, original in originals.items():
            if original is None:
                path.unlink(missing_ok=True)
            else:
                write_bytes_atomic(path, original)
        raise
    print(f"ok: Feature projections repaired records={len(records)}; canonical files unchanged")
    return 0


def cmd_assign_feat_workspace(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    ensure_git_repo(root)

    state, tasks = load_feat(paths, args.feat)
    if str(state.get("status") or "") in CLOSED_FEAT_STATUS:
        eprint(f"error: cannot assign workspace for closed feat: {args.feat}")
        return 1
    try:
        require_reviewed_task_plan(tasks, feat_id=args.feat, action="workspace assignment")
    except SystemExit as exc:
        eprint(str(exc))
        return 1

    current_mode = workspace_mode_of(state)
    if (current_mode == "worktree" or str(state.get("worktree_path") or "").strip()) and args.workspace_mode != "current_tree":
        eprint(
            f"error: feat already has worktree assignment: {args.feat}. "
            "use adopt-feature-worktree to bind an existing worktree."
        )
        return 1

    policy = load_runtime_policy(paths)
    target_mode = resolve_workspace_mode(policy, args.workspace_mode)
    if target_mode == "proposal_only":
        eprint("error: assign-feature-workspace only supports worktree or current_tree")
        return 1
    if target_mode == current_mode:
        print(f"ok: workspace already assigned {args.feat} => {target_mode}")
        return 0
    if count_tasks(tasks, "in_progress") > 0:
        eprint(
            f"error: cannot reassign workspace while feat has in_progress tasks: {args.feat}"
        )
        return 1

    load_current_owner_receipt(paths, state, tasks)
    old_binding = f"{current_mode}:{state.get('branch') or 'none'}@{state.get('worktree_path') or 'none'}"

    branch = ""
    wt_name = ""
    wt_rel = ""
    wt_abs: Path | None = None
    base_ref = str(state.get("base_ref") or pick_base_branch(root))

    if target_mode == "worktree":
        branch_prefix = resolve_branch_prefix(policy, args.branch_prefix)
        try:
            branch, wt_name, wt_rel, wt_abs, base_ref = make_worktree_assignment(
                root,
                feat_id=args.feat,
                branch_prefix=branch_prefix,
            )
        except SystemExit as exc:
            eprint(str(exc))
            return 1

    state["workspace_mode"] = target_mode
    if state.get("status") == "proposal":
        state["status"] = "ready"
    state["base_ref"] = base_ref
    state["branch"] = branch
    state["worktree_name"] = wt_name
    state["worktree_path"] = wt_rel
    state.setdefault("history", []).append(
        history_event(
            "workspace_assigned",
            (
                f"{old_binding} -> {target_mode}; root_branch={current_branch(root) or 'detached'}"
                if current_mode != target_mode
                else f"{target_mode}; root_branch={current_branch(root) or 'detached'}"
            ),
        )
    )
    save_feat(paths, args.feat, state, tasks)

    print(f"ok: workspace assigned {args.feat} => {target_mode}")
    print(f"branch: {branch}")
    print(f"worktree: {wt_abs if wt_abs is not None else ''}")
    return 0


def cmd_adopt_feat_worktree(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    ensure_git_repo(root)

    state, tasks = load_feat(paths, args.feat)
    if str(state.get("status") or "") in CLOSED_FEAT_STATUS:
        eprint(f"error: cannot adopt worktree for closed feat: {args.feat}")
        return 1
    try:
        require_reviewed_task_plan(tasks, feat_id=args.feat, action="worktree adoption")
        load_current_owner_receipt(paths, state, tasks)
    except SystemExit as exc:
        eprint(str(exc))
        return 1

    if count_tasks(tasks, "in_progress") > 0:
        eprint(f"error: cannot adopt worktree while feat has active Tasks: {args.feat}")
        return 1

    raw_worktree_path = str(args.worktree_path or "").strip()
    expected_branch = str(args.branch or "").strip()
    if not raw_worktree_path:
        eprint("error: --worktree-path must not be empty")
        return 1
    if not expected_branch:
        eprint("error: --branch must not be empty")
        return 1

    worktree_abs = resolve_worktree_abs(root, raw_worktree_path).resolve()
    if worktree_abs == root:
        eprint("error: tracker root must use current_tree instead of worktree adoption")
        return 1
    if not worktree_abs.exists():
        eprint(f"error: worktree path does not exist: {worktree_abs}")
        return 1
    if not worktree_abs.is_dir():
        eprint(f"error: worktree path is not a directory: {worktree_abs}")
        return 1
    if worktree_abs not in git_worktree_paths(root):
        eprint(f"error: worktree path is not registered under tracker root: {worktree_abs}")
        return 1

    actual_branch = current_branch(worktree_abs)
    if actual_branch != expected_branch:
        eprint(
            "error: worktree branch mismatch: "
            f"expected {expected_branch}, found {actual_branch or 'detached'}"
        )
        return 1

    worktree_rel = Path(os.path.relpath(worktree_abs, root)).as_posix()
    worktree_name = worktree_abs.name
    current_mode = workspace_mode_of(state)
    old_branch = str(state.get("branch") or "")
    old_worktree_path = str(state.get("worktree_path") or "")
    if (
        current_mode == "worktree"
        and old_branch == expected_branch
        and old_worktree_path == worktree_rel
        and str(state.get("worktree_name") or "") == worktree_name
    ):
        print(f"ok: worktree already adopted {args.feat}")
        print(f"branch: {expected_branch}")
        print(f"worktree: {worktree_abs}")
        return 0

    state["workspace_mode"] = "worktree"
    if state.get("status") == "proposal":
        state["status"] = "ready"
    state["branch"] = expected_branch
    state["worktree_name"] = worktree_name
    state["worktree_path"] = worktree_rel
    state.setdefault("history", []).append(
        history_event(
            "workspace_adopted",
            (
                f"{current_mode}:{old_branch or 'none'}@{old_worktree_path or 'none'}"
                f" -> worktree:{expected_branch}@{worktree_rel}"
            ),
        )
    )
    save_feat(paths, args.feat, state, tasks)

    print(f"ok: existing worktree adopted {args.feat}")
    print(f"branch: {expected_branch}")
    print(f"worktree: {worktree_abs}")
    return 0


FEATURE_STATUS_PRESENTATION = {
    "in_progress": ("In progress", "amber"),
    "replanning": ("Replanning", "amber"),
    "blocked": ("Blocked", "red"),
    "ready": ("Ready", "blue"),
    "proposal": ("Proposal", "slate"),
    "done": ("Needs closeout", "green"),
    "archived": ("Archived", "slate"),
    "discarded": ("Discarded", "red"),
    "transferred": ("Transferred", "slate"),
}
FEATURE_STATUS_ORDER = ("proposal", "ready", "in_progress", "replanning", "blocked", "done")
# One definition of the derived Task frontier groups, in presentation order,
# shared by every human projection so no surface invents its own vocabulary.
TASK_FRONTIER_LABELS = (
    ("active", "Active"),
    ("runnable", "Runnable"),
    ("waiting", "Waiting"),
    ("blocked", "Blocked"),
    ("failed", "Failed · inspect replan"),
    ("cancelled", "Cancelled"),
    ("transferred", "Transferred"),
    ("done", "Done"),
)


def human_status_label(status: Any) -> str:
    token = str(status or "unknown")
    return FEATURE_STATUS_PRESENTATION.get(token, (token.replace("_", " ").title(), "slate"))[0]


def html_text(value: Any) -> str:
    return html.escape(str(value or ""), quote=True)


def xml_text(value: Any) -> str:
    return html.escape(str(value or ""), quote=False)


def task_records_by_id(tasks: dict[str, Any], task_ids: Iterable[str]) -> list[dict[str, Any]]:
    by_id = {
        str(task.get("id") or ""): task
        for task in tasks.get("tasks", [])
        if isinstance(task, dict)
    }
    return [by_id[task_id] for task_id in task_ids if task_id in by_id]


def render_task_stats_html(tasks: dict[str, Any]) -> str:
    parts = []
    for status in ("in_progress", "blocked", "failed", "cancelled", "transferred", "todo", "done"):
        count = count_current_tasks(tasks, status)
        if count:
            parts.append(
                f'<span class="task-count task-count--{status.replace("_", "-")}">'
                f"{html_text(status.replace('_', ' ').title())} {count}</span>"
            )
    return "".join(parts) or '<span class="task-count">No tasks</span>'


def load_feature_runtime_activity(
    paths: HarnessPaths,
    state: dict[str, Any],
    tasks: dict[str, Any],
) -> dict[str, Any] | None:
    """Read optional Flow Runner progress receipts for one Feature.

    Flow Runner owns this log.  The Tracker only projects it, and only an
    explicit ``task_ref`` is allowed to bind a receipt to a Task. Older
    receipts remain valid; the latest overall receipt is shown at Feature
    level and the latest receipt for each bound Task is retained separately.
    """
    feat_id = str(state.get("feat_id") or "").strip()
    if not feat_id or not is_valid_feat_id(feat_id):
        return None
    progress_path = (
        paths.root
        / ".bagakit"
        / "flow-runner"
        / "items"
        / f"feature-{feat_id}"
        / "progress.ndjson"
    )
    if not progress_path.is_file():
        return None

    valid_records: list[dict[str, Any]] = []
    try:
        for line in progress_path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not isinstance(record, dict):
                continue
            if record.get("schema") != "bagakit/flow-runner/progress/v1":
                continue
            if str(record.get("item_id") or "") != f"feature-{feat_id}":
                continue
            if record.get("task_ref") is not None and not isinstance(record.get("task_ref"), str):
                continue
            valid_records.append(record)
    except OSError:
        return None
    if not valid_records:
        return None

    task_ids = {
        str(task.get("id") or "")
        for task in current_plan_tasks(tasks)
        if isinstance(task, dict)
    }

    def activity_for(record: dict[str, Any]) -> dict[str, Any]:
        task_ref = str(record.get("task_ref") or "").strip()
        return {
            "record": record,
            "task_ref": task_ref,
            "bound_task_ref": task_ref if task_ref in task_ids else "",
            "path": relative_display(paths.root, progress_path),
            "href": progress_path.resolve().as_uri(),
        }

    latest = activity_for(valid_records[-1])
    by_task: dict[str, dict[str, Any]] = {}
    task_records: dict[str, list[dict[str, Any]]] = {}
    for record in valid_records:
        task_ref = str(record.get("task_ref") or "").strip()
        if task_ref in task_ids:
            task_records.setdefault(task_ref, []).append(record)
    for task_ref, records in task_records.items():
        item = activity_for(records[-1])
        item["checkpoint_count"] = len(records)
        times = []
        for record in records:
            raw_time = str(record.get("recorded_at") or "").strip()
            if raw_time:
                try:
                    times.append(datetime.fromisoformat(raw_time.replace("Z", "+00:00")))
                except (TypeError, ValueError):
                    continue
        if len(times) >= 2:
            span_seconds = (max(times) - min(times)).total_seconds()
            if span_seconds >= 0:
                item["observed_span_seconds"] = span_seconds
        by_task[task_ref] = item
    latest["by_task"] = by_task
    return latest


def task_execution_stats(
    task: dict[str, Any],
    activity: dict[str, Any] | None,
) -> str:
    """Return compact evidence-backed stats for one topology node.

    Duration is shown only when explicit start/finish fields or multiple
    timestamped Flow Runner checkpoints exist. A checkpoint span is labelled
    observed rather than presented as active execution time.
    """
    verification = task.get("verification") if isinstance(task.get("verification"), list) else []
    proof_kinds = []
    proof_labels = {
        "command": "cmd",
        "artifact": "artifact",
        "manual": "manual",
        "owner_receipt": "owner",
    }
    for item in verification:
        if not isinstance(item, dict):
            continue
        kind = str(item.get("kind") or "").strip()
        label = proof_labels.get(kind)
        if label and label not in proof_kinds:
            proof_kinds.append(label)
    declared_commands = sum(
        1 for item in verification if isinstance(item, dict) and item.get("kind") == "command"
    )
    gate_runs = task.get("last_gate_commands") if isinstance(task.get("last_gate_commands"), list) else []
    passed_runs = sum(
        1 for item in gate_runs if isinstance(item, dict) and str(item.get("status") or "") == "pass"
    )
    gate_stat = f"gate {passed_runs}/{len(gate_runs) or declared_commands}" if (gate_runs or declared_commands) else "gate —"
    proof_stat = f"proof {'+'.join(proof_kinds)}" if proof_kinds else "proof —"

    value = task.get("estimate_hours")
    estimate = str(value).strip() if value not in (None, "") else None
    if estimate and re.fullmatch(r"\d+(?:\.\d+)?", estimate):
        estimate = f"{estimate}h"
    estimate_stat = f"est {estimate}" if estimate else ""
    heavy_stat = "heavy" if task.get("heavy") is True else ""

    duration_stat = ""
    started = task.get("started_at")
    finished = task.get("finished_at")
    if started and finished:
        try:
            duration = (
                datetime.fromisoformat(str(finished).replace("Z", "+00:00"))
                - datetime.fromisoformat(str(started).replace("Z", "+00:00"))
            ).total_seconds()
            if duration >= 0:
                duration_stat = f"run {format_duration(duration)}"
        except (TypeError, ValueError):
            pass
    if not duration_stat and isinstance(activity, dict):
        span = activity.get("observed_span_seconds")
        if isinstance(span, (int, float)) and span >= 0:
            duration_stat = f"observed {format_duration(float(span))}"
    checkpoint_count = int(activity.get("checkpoint_count") or 0) if isinstance(activity, dict) else 0
    update_stat = f"updates {checkpoint_count}" if checkpoint_count else ""
    primary = " · ".join(
        part
        for part in (gate_stat, proof_stat, estimate_stat, heavy_stat, duration_stat, update_stat)
        if part
    )
    return primary


def runtime_activity_reports_progress(activity: dict[str, Any] | None) -> bool:
    """Return whether an explicit Flow Runner receipt reports ongoing work."""
    if not isinstance(activity, dict):
        return False
    record = activity.get("record")
    if not isinstance(record, dict):
        return False
    return str(record.get("session_status") or "").strip().lower() == "progress"


def format_duration(seconds: float) -> str:
    minutes = max(0, round(seconds / 60))
    if minutes < 60:
        return f"{minutes}m"
    hours, remainder = divmod(minutes, 60)
    return f"{hours}h" if remainder == 0 else f"{hours}h {remainder}m"


def task_dependency_summary(
    task: dict[str, Any],
    by_id: dict[str, dict[str, Any]],
    display_status_by_id: dict[str, str],
    *,
    layer_index: int,
    label: str,
) -> str:
    """Describe direct dependency readiness without adding graph truth."""
    dependencies = canonical_task_dependencies(task, label=label)
    if not dependencies:
        return "Root task"
    ready_count = sum(
        1
        for dependency in dependencies
        if str(by_id[dependency].get("status") or "") == "done"
    )
    summary = f"deps {ready_count}/{len(dependencies)}"
    pending = [
        dependency
        for dependency in dependencies
        if str(by_id[dependency].get("status") or "") != "done"
    ]
    if not pending:
        return summary

    blocked_statuses = {"blocked", "failed", "cancelled", "transferred"}
    blocked = [
        f"{dependency} ({display_status_by_id.get(dependency, str(by_id[dependency].get('status') or 'unknown')).replace('_', ' ')})"
        for dependency in pending
        if display_status_by_id.get(dependency, str(by_id[dependency].get("status") or "")) in blocked_statuses
    ]
    if blocked:
        summary += " · blocked by " + ", ".join(blocked)
    else:
        summary += " · waiting on " + ", ".join(pending)
    pending_states = {
        display_status_by_id.get(
            dependency,
            str(by_id[dependency].get("status") or "unknown"),
        )
        for dependency in pending
    }
    if (
        display_status_by_id.get(str(task.get("id") or "")) == "waiting"
        and not pending_states.intersection(blocked_statuses)
    ):
        summary += f" · eligible W{layer_index + 1:02d}"
    return summary


def estimated_task_critical_path(
    by_id: dict[str, dict[str, Any]],
    topological_order: list[str],
    *,
    feat_id: str,
) -> tuple[list[str], float | None]:
    """Return one deterministic longest weighted dependency chain.

    A critical-path claim is only meaningful when every current Task has an
    explicit Agent-hour estimate.  If one is missing, return no path rather
    than pretending Task count or array order is elapsed time.
    """
    durations: dict[str, float] = {}
    for task_id in topological_order:
        raw = by_id[task_id].get("estimate_hours")
        if isinstance(raw, bool) or not isinstance(raw, (int, float)):
            return [], None
        if not math.isfinite(float(raw)) or float(raw) <= 0:
            return [], None
        durations[task_id] = float(raw)
    if not topological_order:
        return [], None

    best_hours: dict[str, float] = {}
    previous: dict[str, str] = {}
    outgoing: dict[str, list[str]] = {task_id: [] for task_id in topological_order}
    for task_id in topological_order:
        dependencies = canonical_task_dependencies(
            by_id[task_id],
            label=f"{feat_id}/{task_id}",
        )
        if dependencies:
            predecessor = max(
                dependencies,
                key=lambda candidate: (best_hours[candidate], candidate),
            )
            previous[task_id] = predecessor
            best_hours[task_id] = best_hours[predecessor] + durations[task_id]
            for dependency in dependencies:
                outgoing[dependency].append(task_id)
        else:
            best_hours[task_id] = durations[task_id]
    terminals = [task_id for task_id in topological_order if not outgoing[task_id]]
    endpoint = max(terminals, key=lambda task_id: (best_hours[task_id], task_id))
    path: list[str] = []
    current: str | None = endpoint
    while current is not None:
        path.append(current)
        current = previous.get(current)
    path.reverse()
    return path, best_hours[endpoint]


def stable_done_task_ids(
    by_id: dict[str, dict[str, Any]],
    topological_order: list[str],
    *,
    feat_id: str,
) -> set[str]:
    """Return completed Tasks outside the dependency cone of unfinished work."""
    unfinished = {
        task_id
        for task_id in topological_order
        if str(by_id[task_id].get("status") or "") != "done"
    }
    if not unfinished:
        return set()
    required: set[str] = set()
    stack = list(unfinished)
    while stack:
        task_id = stack.pop()
        for dependency in canonical_task_dependencies(
            by_id[task_id],
            label=f"{feat_id}/{task_id}",
        ):
            if dependency not in required:
                required.add(dependency)
                stack.append(dependency)
    return {
        task_id
        for task_id in topological_order
        if str(by_id[task_id].get("status") or "") == "done"
        and task_id not in required
    }


def render_runtime_activity_html(
    activity: dict[str, Any] | None,
    *,
    compact: bool = False,
) -> str:
    if not activity:
        return ""
    record = activity.get("record") if isinstance(activity.get("record"), dict) else {}
    task_ref = str(activity.get("task_ref") or "").strip()
    bound_task_ref = str(activity.get("bound_task_ref") or "").strip()
    scope = f"Task {bound_task_ref}" if bound_task_ref else "Feature-wide"
    if task_ref and not bound_task_ref:
        scope = f"Unmatched task_ref {task_ref}"
    session_status = str(record.get("session_status") or "report")
    stage = str(record.get("stage") or "")
    result = str(record.get("result") or "").strip()
    next_action = str(record.get("next_action") or "").strip()
    attempted = str(record.get("attempted") or "").strip()
    recorded_at = str(record.get("recorded_at") or "").strip()
    # The projection cannot serve a local receipt file to the browser. Keep
    # provenance visible as portable repository-relative text instead of a
    # misleading file:// affordance that static exports commonly cannot open.
    source_path = str(activity.get("path") or "progress.ndjson").strip()
    source = f'<code class="runtime-activity-ref">{html_text(source_path)}</code>'
    if compact:
        summary = " · ".join(part for part in (scope, stage, session_status, result) if part)
        return (
            '<div class="runtime-activity-summary"><span class="eyebrow">Execution update</span>'
            f'<strong>{html_text(summary or "Latest progress reported")}</strong></div>'
        )
    detail_rows = []
    if attempted:
        detail_rows.append(f"<div><dt>Attempted</dt><dd>{html_text(attempted)}</dd></div>")
    if next_action:
        detail_rows.append(f"<div><dt>Next action</dt><dd>{html_text(next_action)}</dd></div>")
    if recorded_at:
        detail_rows.append(
            f'<div><dt>Reported</dt><dd><time datetime="{html_text(recorded_at)}">'
            f"{html_text(recorded_at)}</time></dd></div>"
        )
    return (
        '<section class="runtime-activity" aria-label="Latest execution activity">'
        '<div class="runtime-activity-header"><div><span class="eyebrow">Execution update</span>'
        f'<strong>{html_text(scope)}</strong></div>'
        f'<span class="runtime-activity-state">{html_text(session_status)}</span></div>'
        + (f'<p><strong>{html_text(stage)}</strong> · {html_text(result)}</p>' if stage or result else "")
        + (f'<dl>{"".join(detail_rows)}</dl>' if detail_rows else "")
        + (
            '<p class="runtime-activity-source">SSOT: '
            f'{source} · informational only; it does not change Task state or gate evidence.</p>'
        )
        + (
            '<p class="runtime-activity-warning">The receipt names a Task that is not in the current reviewed plan; '
            "it is intentionally not attached to a Task card.</p>"
            if task_ref and not bound_task_ref
            else ""
        )
        + "</section>"
    )


def build_agent_claim_message(
    paths: HarnessPaths,
    state: dict[str, Any],
    tasks: dict[str, Any],
) -> str:
    feat_id = str(state.get("feat_id") or "")
    feature_name = str(state.get("title") or feat_id)
    worktree = str(state.get("worktree_path") or "").strip() or "none"
    branch = str(state.get("branch") or "").strip() or "none"
    feature_status = str(state.get("status") or "unknown")
    frontier = feature_task_frontier(state, tasks)
    active_text = ",".join(frontier["active"]) or "none"
    runnable_text = ",".join(frontier["runnable"]) or "none"
    task_count_parts = [
        f"{status}={count_current_tasks(tasks, status)}"
        for status in ("todo", "in_progress", "done", "blocked", "transferred")
    ]
    cancelled_count = count_current_tasks(tasks, "cancelled")
    if cancelled_count:
        task_count_parts.append(f"cancelled={cancelled_count}")
    failed_count = count_current_tasks(tasks, "failed")
    if failed_count:
        task_count_parts.append(f"failed={failed_count}")
    task_counts = ", ".join(task_count_parts)
    feature_dir = relative_display(
        paths.root,
        paths.feat_dir(feat_id, status=feature_status),
    )
    canonical_refs = [
        f"{feature_dir}{POSIX_SEP}state.json",
        f"{feature_dir}{POSIX_SEP}tasks.json",
    ]
    if paths.feat_goal(feat_id, status=feature_status).is_file():
        canonical_refs.insert(0, f"{feature_dir}{POSIX_SEP}goal.md")
    if paths.feat_owner_receipt(feat_id, status=feature_status).is_file():
        canonical_refs.insert(
            1 if canonical_refs[0].endswith("goal.md") else 0,
            f"{feature_dir}{POSIX_SEP}owner-receipt.json",
        )
    canonical_text = "\n".join(f"{index}. {ref}" for index, ref in enumerate(canonical_refs, 1))
    generated_time = datetime.now(timezone.utc).isoformat(timespec="seconds")
    name = tracker_name_for(feat_id)
    failed_ids = [item["item_id"] for item in current_task_failures(tasks, feat_id=feat_id)]
    nearest_action = (
        "需要重规划的失败节点：" + ", ".join(failed_ids) + "。读取 failure，保持用户目标，安装 reviewed successor plan；独立工作继续。"
        if failed_ids
        else "当前需要先安装 reviewed successor plan。"
        if feature_status == "replanning"
        else f"当前 active Tasks：{active_text}；可认领 Tasks：{runnable_text}。"
    )
    body = f"""你是认领 Feature“{feature_name}”（{feat_id}）的 Agent。先从 canonical truth 建立自己的 Goal model，对齐后直接行动，不需要仅为确认而回复。

Feature name: {feature_name}
Feature ID: {feat_id}
Worktree: {worktree}
Branch: {branch}
Progress snapshot: status={feature_status}; active_tasks={active_text}; runnable_tasks={runnable_text}; {task_counts}

SSOT（按顺序读取）：
{canonical_text}

{nearest_action} 上面的 progress 只帮助定位，不是状态副本。请从 SSOT 恢复 Goal、Task、验收、blocker、authority 和下一步；若两者不一致，以 SSOT 为准。

本消息只传递认领上下文，不授予超出当前 Host 和 Owner truth 的写入、外部副作用、合并或发布权限。对齐后直接推进最接近验收证据的动作；只有在 verified result、稳定 checkpoint、真实 blocker、方向或权限 mismatch、不可逆决策，或完成当前任务验收时，按 Goal / Result / Evidence / Mismatch or blocker / Next 返回。

如果通过追加 user 或 prompt 消息联系其他 Agent，必须使用 bagakit-msg，不能发送裸指令。"""
    return (
        f'<bagakit-msg type="agent-set-v1" name="{html_text(name)}" time="{html_text(generated_time)}">\n'
        f"{xml_text(body)}\n"
        "</bagakit-msg>"
    )


def tracker_name_for(feat_id: str) -> str:
    """Return the stable human/Agent-facing name without adding state."""
    return f"Feature-Tracker-{feat_id}"


def current_plan_tasks(tasks: dict[str, Any]) -> list[dict[str, Any]]:
    current_ids = set(latest_plan_task_ids(tasks))
    return [
        task
        for task in tasks.get("tasks", [])
        if not current_ids or str(task.get("id") or "") in current_ids
    ]


def local_ref_href(root: Path, ref: Any) -> str | None:
    raw = str(ref or "").strip()
    path_part = raw.partition("#")[0]
    if not path_part or URI_SCHEME_RE.match(path_part) or path_part.startswith(("/", "\\")):
        return None
    target = (root / path_part).resolve()
    try:
        target.relative_to(root.resolve())
    except ValueError:
        return None
    try:
        return target.as_uri() if target.is_file() else None
    except OSError:
        # A command verification is not a repository-relative file reference.
        # Long commands can exceed the host path limit; render them as code.
        return None


def render_file_preview_entry(root: Path, path: Path, label: str) -> str:
    """Render one read-only, repo-relative file preview without a file URI."""
    if not path.is_file():
        return ""
    try:
        repo_ref = path.resolve().relative_to(root.resolve()).as_posix()
        content = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError, ValueError):
        return ""
    preview_language = {
        ".json": "json",
        ".md": "markdown",
    }.get(path.suffix.lower(), "text")
    return (
        '<span class="file-preview-entry">'
        f'<button type="button" class="file-preview-trigger" data-file-preview '
        f'data-preview-label="{html_text(label)}" data-preview-ref="{html_text(repo_ref)}" '
        f'data-preview-language="{preview_language}">'
        f'{html_text(label)}</button>'
        f'<template class="file-preview-source"><pre>{html_text(content)}</pre></template>'
        "</span>"
    )


def task_review_anchor(feat_id: str, task_id: str) -> str:
    return f"{feat_id}-task-{task_id}"


def task_projection_anchor(
    feat_id: str,
    task_id: str,
    *,
    read_only: bool,
    plan_revision: int | None,
) -> str:
    # Historical graph links intentionally target the one canonical detail
    # anchor.  Retained Tasks resolve to the current detail; retired Tasks
    # remain visible in the graph but have no fabricated detail target.
    return task_review_anchor(feat_id, task_id)


def topology_character_width(character: str) -> int:
    if unicodedata.combining(character):
        return 0
    return 2 if unicodedata.east_asian_width(character) in {"W", "F", "A"} else 1


def topology_title_lines(
    value: Any,
    *,
    max_units: int = 25,
    max_lines: int = 2,
) -> list[str]:
    """Wrap a compact SVG title by approximate display width.

    Character count underestimates CJK width and allowed mixed-language titles
    to escape their node.  The full title remains in the SVG `<title>`; this is
    only the bounded visible label.
    """
    remaining = " ".join(str(value or "").split())
    lines: list[str] = []
    total_units = sum(topology_character_width(char) for char in remaining)
    if max_lines == 2 and total_units > max_units and total_units <= max_units * max_lines:
        cumulative = 0
        split_candidates: list[tuple[int, int, int]] = []
        for index, character in enumerate(remaining[:-1], start=1):
            cumulative += topology_character_width(character)
            right = remaining[index:].lstrip()
            if character.isspace() or character in ":;,+-—" + POSIX_SEP + "，、":
                penalty = 1 if right[:1] in "+-:;，、" else 0
                split_candidates.append((index, cumulative, penalty))
        if not split_candidates:
            cumulative = 0
            for index, character in enumerate(remaining[:-1], start=1):
                cumulative += topology_character_width(character)
                adjacent_wide = (
                    topology_character_width(character) == 2
                    and topology_character_width(remaining[index]) == 2
                )
                split_candidates.append((index, cumulative, 1 if adjacent_wide else 0))
        target_units = total_units / max_lines
        split_index, _, _ = min(
            split_candidates,
            key=lambda item: (item[2], abs(item[1] - target_units), -item[1]),
        )
        balanced = [remaining[:split_index].rstrip(), remaining[split_index:].lstrip()]
        if all(sum(topology_character_width(char) for char in line) <= max_units for line in balanced):
            return balanced

    while remaining and len(lines) < max_lines:
        used = 0
        cut = 0
        for index, character in enumerate(remaining):
            width = topology_character_width(character)
            if used + width > max_units:
                break
            used += width
            cut = index + 1
        if cut >= len(remaining):
            lines.append(remaining)
            remaining = ""
            break
        if remaining[cut - 1].isascii() and remaining[cut - 1].isalnum() and remaining[cut].isascii() and remaining[cut].isalnum():
            word_break = remaining.rfind(" ", 0, cut)
            if word_break >= cut // 2:
                cut = word_break
        line = remaining[:cut].rstrip()
        if not line:
            line = remaining[:1]
            cut = 1
        lines.append(line)
        remaining = remaining[cut:].lstrip()

    if remaining and lines:
        ellipsis_width = topology_character_width("…")
        last = lines[-1]
        while last and sum(topology_character_width(char) for char in last) > max_units - ellipsis_width:
            last = last[:-1]
        lines[-1] = last.rstrip() + "…"
    return lines or [""]


TOPOLOGY_STAGE_LABELS = (
    ("candidate", "找评", "寻找和评估可行项目"),
    ("ownership", "权责", "issue / ownership 读回"),
    ("implementation", "开发", "开发与 RED→GREEN"),
    ("review", "双审", "主控 + 非作者交叉 review"),
    ("delivery", "交付", "PR 交付与实时检查"),
)


def topology_stage_for_title(title: str) -> str | None:
    for stage, _, prefix in TOPOLOGY_STAGE_LABELS:
        if title.startswith(f"[{prefix}]"):
            return stage
    return None


def render_task_group_overview(
    by_id: dict[str, dict[str, Any]],
    frontier: dict[str, list[str]],
    *,
    feat_id: str,
    read_only: bool = False,
    plan_revision: int | None = None,
) -> str:
    """Render a compact derived group/slot view before the full DAG.

    The full dependency graph remains canonical.  This presentation-only
    overview groups the 100 delivery slots into the ten reviewed acceptance
    joins and exposes each slot's five real stages without adding Tracker
    state, dependencies, or a second source of truth.
    """
    display_status_by_id = {
        task_id: group
        for group in ("active", "runnable", "blocked", "failed", "cancelled", "transferred", "waiting", "done")
        for task_id in frontier[group]
    }
    slot_tasks: dict[int, dict[str, dict[str, Any]]] = {}
    slot_pattern = re.compile(r"\bMR-(\d{3})\b")
    for task_id, task in by_id.items():
        title = str(task.get("title") or "")
        match = slot_pattern.search(title)
        stage = topology_stage_for_title(title)
        if not match or stage is None:
            continue
        slot_tasks.setdefault(int(match.group(1)), {})[stage] = task

    # Completed slots from earlier plan revisions intentionally retain their
    # immutable one-task anchors.  Show them as anchors instead of fabricating
    # five historical stage Tasks.
    legacy_done: dict[int, dict[str, Any]] = {}
    for task_id, task in by_id.items():
        title = str(task.get("title") or "")
        match = slot_pattern.fullmatch(title.split(" ", 1)[0])
        if match and title.endswith("外部技术贡献目标"):
            legacy_done[int(match.group(1))] = task

    group_nodes: list[tuple[int, int, int, dict[str, Any]]] = []
    group_pattern = re.compile(r"\[分组验收\]\s+G(\d{2})\s+·\s+MR-(\d{3})\.\.(?:MR-)?(\d{3})")
    for task_id, task in by_id.items():
        match = group_pattern.search(str(task.get("title") or ""))
        if match:
            group_nodes.append((int(match.group(1)), int(match.group(2)), int(match.group(3)), task))
    if not group_nodes:
        return ""
    group_nodes.sort(key=lambda item: item[1])

    stage_by_token = {stage: (label, prefix) for stage, label, prefix in TOPOLOGY_STAGE_LABELS}
    stage_tokens = list(stage_by_token)

    def chip(task: dict[str, Any] | None, stage: str, slot: int) -> str:
        label, prefix = stage_by_token[stage]
        if task is None:
            if slot in legacy_done:
                return '<span class="topology-stage-chip topology-stage-chip--done" title="已完成历史锚点">已锚定</span>'
            return (
                f'<span class="topology-stage-chip topology-stage-chip--waiting" '
                f'title="{html_text(prefix)}">{html_text(label)}</span>'
            )
        task_id = str(task.get("id") or "")
        status = display_status_by_id.get(task_id, str(task.get("status") or "todo"))
        status_class = status.replace("_", "-")
        anchor = task_projection_anchor(
            feat_id,
            task_id,
            read_only=False,
            plan_revision=None,
        )
        return (
            f'<a class="topology-stage-chip topology-stage-chip--{html_text(status_class)}" '
            f'href="#{html_text(anchor)}" '
            f'title="{html_text(str(task.get("title") or ""))}">{html_text(label)}</a>'
        )

    cards: list[str] = []
    for group_id, start, end, group_task in group_nodes:
        slots = list(range(start, end + 1))
        done_slots = 0
        active_slots = 0
        blocked_slots = 0
        failed_slots = 0
        rows: list[str] = []
        for slot in slots:
            stages = slot_tasks.get(slot, {})
            if slot in legacy_done:
                done_slots += 1
                slot_state = "历史锚点"
            else:
                statuses = [
                    display_status_by_id.get(str(stages[stage].get("id") or ""), "todo")
                    for stage in stage_tokens
                    if stage in stages
                ]
                if len(stages) == len(stage_tokens) and all(status == "done" for status in statuses):
                    done_slots += 1
                if "active" in statuses:
                    active_slots += 1
                if "blocked" in statuses:
                    blocked_slots += 1
                if "failed" in statuses:
                    failed_slots += 1
                slot_state = next(
                    (state.replace("_", " ") for state in ("failed", "active", "blocked", "runnable", "waiting") if state in statuses),
                    "待候选",
                )
            chips = "".join(chip(stages.get(stage), stage, slot) for stage in stage_tokens)
            rows.append(
                f'<div class="topology-slot-row"><strong>MR-{slot:03d}</strong>'
                f'<span class="topology-slot-state topology-slot-state--{html_text(slot_state.replace(" ", "-"))}">{html_text(slot_state)}</span>'
                f'<span class="topology-stage-chips">{chips}</span></div>'
            )
        group_status = display_status_by_id.get(str(group_task.get("id") or ""), str(group_task.get("status") or "todo"))
        group_status_label = group_status.replace("_", " ").title()
        cards.append(
            f'<details class="topology-group-card"><summary><span class="topology-group-id">G{group_id:02d}</span>'
            f'<span class="topology-group-range">MR-{start:03d}..MR-{end:03d}</span>'
            f'<span class="topology-group-progress">{done_slots}/{len(slots)} done · {html_text(group_status_label)}</span></summary>'
            f'<div class="topology-group-body"><div class="topology-group-metrics">'
            f'<span>active {active_slots}</span><span>blocked {blocked_slots}</span><span>failed {failed_slots}</span><span>join {html_text(str(group_task.get("id") or ""))}</span>'
            f'</div>{"".join(rows)}</div></details>'
        )
    return (
        '<section class="topology-group-overview" aria-label="Grouped MR slot overview">'
        '<div class="topology-group-overview-header"><div><span class="eyebrow">Grouped acceptance</span>'
        '<h5>10 组 × 10 槽位 · 每槽位五阶段</h5></div>'
        '<span>展开分组查看：找评 → 权责 → 开发 → 双审 → 交付</span></div>'
        f'<div class="topology-group-grid">{"".join(cards)}</div></section>'
    )


def render_task_wave_overview(
    layers: list[list[str]],
    by_id: dict[str, dict[str, Any]],
    frontier: dict[str, list[str]],
    *,
    feat_id: str,
    read_only: bool = False,
    plan_revision: int | None = None,
) -> str:
    """Render a compact generic overview for large plans without new truth.

    Topological waves are a derived reading aid. They group many Tasks by the
    same dependency depth while keeping the primary graph concise; the wave
    list is collapsed by default and opens only when a human needs a locator.
    """
    if len(by_id) < 12:
        return ""
    display_status_by_id = {
        task_id: group
        for group in ("active", "runnable", "blocked", "failed", "cancelled", "transferred", "waiting", "done")
        for task_id in frontier[group]
    }
    cards: list[str] = []
    for wave, task_ids in enumerate(layers):
        counts = {
            status: sum(1 for task_id in task_ids if display_status_by_id.get(task_id) == status)
            for status in ("active", "runnable", "waiting", "blocked", "failed", "done")
        }
        status_summary = " · ".join(
            f"{label} {counts[status]}"
            for status, label in (("active", "active"), ("runnable", "ready"), ("waiting", "waiting"), ("blocked", "blocked"), ("failed", "failed"), ("done", "done"))
            if counts[status]
        ) or "no current status"
        rows = "".join(
            f'<a class="topology-wave-row" data-task-id="{html_text(task_id)}" href="#{html_text(task_review_anchor(feat_id, task_id))}">'
            f'<strong>{html_text(task_id)}</strong><span>{html_text(str(by_id[task_id].get("title") or task_id))}</span>'
            f'<em>{html_text(display_status_by_id.get(task_id, str(by_id[task_id].get("status") or "todo")).replace("_", " ").upper())}</em></a>'
            for task_id in task_ids
        )
        cards.append(
            f'<details class="topology-group-card"><summary><span class="topology-group-id">W{wave + 1:02d}</span>'
            f'<span class="topology-group-range">{len(task_ids)} Tasks</span>'
            f'<span class="topology-group-progress">{html_text(status_summary)}</span></summary>'
            f'<div class="topology-group-body"><div class="topology-wave-rows">{rows}</div></div></details>'
        )
    return (
        '<details class="topology-group-overview topology-wave-overview">'
        '<summary class="topology-wave-overview-summary">'
        '<div><span class="eyebrow">Execution waves</span>'
        f'<strong>{len(layers)} waves · {len(by_id)} Tasks</strong></div>'
        '<span>Derived schedule · 展开定位 Task</span></summary>'
        f'<div class="topology-wave-overview-body"><div class="topology-group-grid">{"".join(cards)}</div></div>'
        '</details>'
    )


def historical_plan_graph(
    tasks: dict[str, Any],
    *,
    revision: int,
    feat_id: str,
) -> tuple[dict[str, dict[str, Any]], list[list[str]], dict[str, str], list[str]]:
    """Rebuild one reviewed revision for observation without making it current."""
    history = tasks.get("plan_history")
    if not isinstance(history, list) or revision < 1 or revision > len(history):
        raise SystemExit(f"error: {feat_id}: historical plan revision r{revision} is unavailable")
    entry = history[revision - 1]
    if not isinstance(entry, dict) or entry.get("revision") != revision:
        raise SystemExit(f"error: {feat_id}: historical plan revision r{revision} is invalid")
    task_ids = [str(task_id) for task_id in entry.get("task_ids", [])]
    stored_by_id = {
        str(task.get("id")): task
        for task in tasks.get("tasks", [])
        if isinstance(task, dict) and task.get("id")
    }
    omitted = [task_id for task_id in task_ids if task_id not in stored_by_id]
    by_id: dict[str, dict[str, Any]] = {}
    task_id_set = set(task_ids)
    next_removed_edges = (
        history[revision].get("dependency_changes", {}).get("removed", [])
        if revision < len(history)
        and isinstance(history[revision], dict)
        and isinstance(history[revision].get("dependency_changes"), dict)
        else []
    )
    missing_dependencies = {
        target_id: [
            str(edge.get("from") or "")
            for edge in next_removed_edges
            if isinstance(edge, dict)
            and str(edge.get("to") or "") == target_id
            and str(edge.get("from") or "") in task_id_set
        ]
        for target_id in task_ids
    }
    for task_id in task_ids:
        task = stored_by_id.get(task_id)
        if task is None:
            # The Tracker deliberately drops superseded Tasks that never
            # produced execution evidence. Keep their reviewed identity and
            # dependency edges visible without inventing missing semantics.
            by_id[task_id] = {
                "id": task_id,
                "title": "未保留详情的历史节点",
                "depends_on": missing_dependencies.get(task_id, []),
                "verification": [],
                "status": "cancelled",
            }
            continue
        historical = dict(task)
        historical["depends_on"] = [
            dependency
            for dependency in canonical_task_dependencies(task, label=f"{feat_id}/{task_id}")
            if dependency in task_id_set
        ]
        by_id[task_id] = historical

    # The next revision records the complete set of removed direct edges. It
    # restores the exact predecessor DAG even when an unevidenced Task body was
    # intentionally dropped from the compact canonical task store.
    for edge in next_removed_edges:
        if not isinstance(edge, dict):
            continue
        source = str(edge.get("from") or "")
        target = str(edge.get("to") or "")
        if source not in by_id or target not in by_id:
            continue
        dependencies = by_id[target].setdefault("depends_on", [])
        if source not in dependencies:
            dependencies.append(source)

    indegree = {task_id: 0 for task_id in by_id}
    dependents = {task_id: [] for task_id in by_id}
    for task_id, task in by_id.items():
        dependencies = canonical_task_dependencies(task, label=f"{feat_id}/{task_id}")
        indegree[task_id] = len(dependencies)
        for dependency in dependencies:
            dependents[dependency].append(task_id)
    ready = sorted(task_id for task_id, degree in indegree.items() if degree == 0)
    order: list[str] = []
    while ready:
        task_id = ready.pop(0)
        order.append(task_id)
        for dependent in sorted(dependents[task_id]):
            indegree[dependent] -= 1
            if indegree[dependent] == 0:
                ready.append(dependent)
                ready.sort()
    if len(order) != len(by_id):
        raise SystemExit(f"error: {feat_id}: historical revision r{revision} contains a cycle")
    layers = task_topology_layers_from_graph(by_id, order, feat_id=feat_id)
    statuses = {
        task_id: ("transferred" if task_id in omitted else str(task.get("status") or "todo"))
        for task_id, task in by_id.items()
    }
    return by_id, layers, statuses, omitted


def render_plan_lineage_html(
    root: Path,
    state: dict[str, Any],
    tasks: dict[str, Any],
) -> str:
    """Show the immediate reviewed predecessor as read-only formation history."""
    history = tasks.get("plan_history")
    revision = tasks.get("plan_revision")
    if not isinstance(history, list) or not isinstance(revision, int) or revision <= 1:
        return ""
    previous = history[revision - 2]
    current = history[revision - 1]
    if not isinstance(previous, dict) or not isinstance(current, dict):
        return ""
    previous_revision = int(previous.get("revision") or revision - 1)
    previous_count = len(previous.get("task_ids", []))
    current_count = len(current.get("task_ids", []))
    feat_id = str(state.get("feat_id") or "")
    by_id, layers, statuses, omitted = historical_plan_graph(
        tasks, revision=previous_revision, feat_id=feat_id
    )
    topology = render_task_topology_html(
        state,
        tasks,
        graph=(by_id, layers),
        statuses=statuses,
        plan_revision=previous_revision,
        heading=f"r{previous_revision} 的完整可追溯路径",
        eyebrow="Formation history · read only",
        read_only=True,
    )
    current_ids = set(latest_plan_task_ids(tasks))
    historical_ids = [str(task_id) for task_id in previous.get("task_ids", [])]
    stored_by_id = {
        str(task.get("id")): task
        for task in tasks.get("tasks", [])
        if isinstance(task, dict) and task.get("id")
    }
    failed_ids = {
        str(task.get("id"))
        for task in tasks.get("tasks", [])
        if isinstance(task, dict) and task.get("status") == "failed" and task.get("superseded_by")
    }
    historical_detail_parts: list[str] = []
    for task_id in historical_ids:
        if task_id in current_ids or task_id in failed_ids:
            continue
        task = stored_by_id.get(task_id)
        if task is None:
            historical_detail_parts.append(
                f'<p id="{html_text(task_review_anchor(feat_id, task_id))}" class="historical-task-anchor">'
                f'<strong>{html_text(task_id)}</strong> · 历史 Task 详情未保留。</p>'
            )
            continue
        historical_detail_parts.append(render_task_review_html(
            root,
            task=task,
            feat_id=feat_id,
            feature_title=str(state.get("title") or feat_id),
            historical=True,
        ))
    historical_details = (
        '<details class="historical-task-details"><summary>历史 Task 详情 · '
        f'{len(historical_detail_parts)}</summary>{"".join(historical_detail_parts)}</details>'
        if historical_detail_parts else ""
    )
    omitted_note = (
        f'<p class="plan-lineage-omitted">其中 {len(omitted)} 个未执行节点按 Tracker 规范只保留了 Task ID；图中以“未保留详情”占位，不伪造标题、验收或证据。</p>'
        if omitted else ""
    )
    return (
        '<details class="plan-lineage-history">'
        '<summary><span><strong>形成当前节点的历史路径</strong>'
        f'<small>r{previous_revision} · {previous_count} Tasks → r{revision} · {current_count} Task{"s" if current_count != 1 else ""}</small></span>'
        '<span class="plan-lineage-readonly">只读 · 不计入当前进度</span></summary>'
        '<div class="plan-lineage-boundary">'
        '<strong>这里解释当前节点从哪里来。</strong>'
        '<span>历史 Task 不会重新开放，不参与当前 frontier、进度、领取或调度。</span></div>'
        + omitted_note
        + topology
        + historical_details
        + '</details>'
    )


def render_task_topology_html(
    state: dict[str, Any],
    tasks: dict[str, Any],
    runtime_activity: dict[str, Any] | None = None,
    *,
    graph: tuple[dict[str, dict[str, Any]], list[list[str]]] | None = None,
    statuses: dict[str, str] | None = None,
    plan_revision: int | None = None,
    heading: str = "任务如何走向完成",
    eyebrow: str = "Task topology",
    read_only: bool = False,
) -> str:
    """Project canonical semantics. The bundled browser engine owns geometry."""
    feat_id = str(state.get("feat_id") or "")
    if graph is None and not has_reviewed_task_plan(tasks):
        return ""
    by_id, layers = graph or task_topology_layers(tasks, feat_id=feat_id)
    if not layers:
        return ""
    order = [task_id for layer in layers for task_id in layer]
    waves = {task_id: f"W{index + 1:02d}" for index, layer in enumerate(layers) for task_id in layer}
    critical_path, critical_hours = estimated_task_critical_path(by_id, order, feat_id=feat_id)
    critical_ids = set(critical_path)
    critical_edges = set(zip(critical_path, critical_path[1:]))
    stable_done_ids = stable_done_task_ids(by_id, order, feat_id=feat_id)
    if statuses is None:
        frontier = task_frontier(tasks, feat_id=feat_id)
        statuses = {task_id: group for group, ids in frontier.items() for task_id in ids}
    else:
        frontier = {group: [] for group, _ in TASK_FRONTIER_LABELS}
        for task_id in order:
            status = statuses.get(task_id, str(by_id[task_id].get("status") or "todo"))
            frontier.setdefault(status, []).append(task_id)
    activities = (
        runtime_activity.get("by_task", {})
        if isinstance(runtime_activity, dict) and not read_only
        else {}
    )
    nodes, edges, cards = [], [], []
    for task_id in order:
        task = by_id[task_id]
        status = statuses.get(task_id, str(task.get("status") or "todo"))
        status_text = (
            "FAILED→NEXT" if status == "failed" and task.get("superseded_by") else
            "FAILED/REPLAN" if status == "failed" else status.upper()
        )
        activity = status == "active" and runtime_activity_reports_progress(activities.get(task_id))
        dependencies = canonical_task_dependencies(task, label=f"{feat_id}/{task_id}")
        dependency = task_dependency_summary(task, by_id, statuses,
            layer_index=int(waves[task_id][1:]) - 1, label=f"{feat_id}/{task_id}")
        stats = task_execution_stats(task, activities.get(task_id))
        title = str(task.get("title") or task_id)
        gate = {"pass": "Gate pass", "fail": "Gate fail"}.get(task.get("gate_result"), "Gate pending")
        nodes.append({"id": task_id, "title": title, "status": status, "wave": waves[task_id],
            "dependency": dependency, "stats": stats, "activity": activity,
            "critical": task_id in critical_ids, "stable": task_id in stable_done_ids})
        for source in dependencies:
            edges.append({"from": source, "to": task_id, "activity": activity,
                "critical": (source, task_id) in critical_edges})
        classes = f"topology-node topology-node--{status}"
        if task_id in critical_ids:
            classes += " topology-node--critical"
        if task_id in stable_done_ids:
            classes += " topology-node--stable-done"
        if activity:
            classes += " topology-node--activity"
        title_lines = topology_title_lines(title, max_units=36, max_lines=3)
        tspans = "".join(f'<tspan x="14" dy="{0 if index == 0 else 16}">{xml_text(line)}</tspan>'
            for index, line in enumerate(title_lines))
        status_symbol = (
            '<path class="topology-status-symbol" d="M 187 19 L 190 22 L 196 16" />'
            if status == "done" else
            '<circle class="topology-status-symbol" cx="192" cy="19" r="5" /><path class="topology-status-symbol" d="M 192 16 V 19 L 194 20" />'
            if status == "waiting" else ""
        )
        anchor = task_projection_anchor(
            feat_id,
            task_id,
            read_only=read_only,
            plan_revision=plan_revision,
        )
        node_id = ""
        cards.append(
            f'<a class="{classes}"{node_id} data-task-id="{html_text(task_id)}" data-wave="{waves[task_id]}" '
            f'data-task-status="{status}" data-task-dependency-summary="{html_text(dependency)}" '
            f'data-task-evidence-summary="{html_text(stats)}" href="#{html_text(anchor)}">'
            f'<title>{xml_text(task_id)} · {xml_text(title)} · {gate} · {xml_text(dependency)} · {xml_text(stats)}</title>'
            '<rect class="topology-node-card" x="0" y="0" width="272" height="140" rx="12" />'
            '<rect class="topology-node-status-bg" x="180" y="10" width="78" height="18" rx="5" />'
            f'{status_symbol}<text class="topology-node-id" x="14" y="23">{xml_text(task_id)}</text>'
            f'<text class="topology-wave-marker" x="78" y="23">{waves[task_id]}</text>'
            f'<text class="topology-node-status" x="250" y="23" text-anchor="end">{status_text}</text>'
            f'<text class="topology-node-title" x="14" y="47">{tspans}</text>'
            f'<text class="topology-node-stats" x="14" y="104">{xml_text(topology_title_lines(stats, max_units=37, max_lines=1)[0])}</text>'
            f'<text class="topology-node-meta" x="14" y="125">{xml_text(topology_title_lines(dependency, max_units=37, max_lines=1)[0])}</text></a>'
        )
    model = {"nodes": nodes, "edges": edges}
    model_json = json.dumps(model, ensure_ascii=False, separators=(",", ":"))
    signature = sha256_bytes(model_json.encode("utf-8"))[:16]
    summary = (
        f"Critical path · {format_duration(critical_hours * 3600)} · {len(critical_path)} Tasks"
        if critical_path and critical_hours is not None else "Critical path · add Agent-hour estimates"
    )
    legend = "".join(f'<span class="topology-legend topology-legend--{group}"><strong>{html_text(label)}</strong> {len(frontier[group])}</span>'
        for group, label in TASK_FRONTIER_LABELS if frontier[group])
    overview = render_task_group_overview(
        by_id,
        frontier,
        feat_id=feat_id,
        read_only=read_only,
        plan_revision=plan_revision,
    ) or render_task_wave_overview(
        layers,
        by_id,
        frontier,
        feat_id=feat_id,
        read_only=read_only,
        plan_revision=plan_revision,
    )
    topology_classes = "task-topology task-topology--historical" if read_only else "task-topology"
    revision = plan_revision if plan_revision is not None else tasks.get("plan_revision")
    return (
        f'<section class="{topology_classes}" data-feature-id="{html_text(feat_id)}" data-graph-signature="{signature}" '
        f'data-feature-title="{html_text(state.get("title") or feat_id)}" data-plan-revision="{html_text(revision)}" aria-label="{html_text(eyebrow)}">'
        f'<div class="task-topology-header"><div><span class="eyebrow">{html_text(eyebrow)}</span><h4>{html_text(heading)}<span class="map-heading-mark">↗</span></h4></div>'
        '<div class="task-topology-header-actions">'
        + ('' if read_only else '<button type="button" data-topology-current>工作焦点</button>')
        + '<button type="button" class="topology-wire-toggle" data-topology-wire-toggle aria-pressed="false">Show all links</button>'
        + '<button type="button" class="topology-group-toggle" data-topology-group-toggle aria-pressed="false">展开并行组</button>'
        + ('' if read_only else '<button type="button" class="topology-stable-toggle" data-topology-stable-toggle aria-pressed="false">Focus open work</button>')
        + '<div class="topology-zoom-controls" role="group" aria-label="Topology zoom">'
        '<button type="button" data-topology-zoom="out" aria-label="Zoom out">−</button>'
        '<output data-topology-zoom-level>100%</output>'
        '<button type="button" data-topology-zoom="in" aria-label="Zoom in">+</button>'
        '<button type="button" data-topology-zoom="fit">Fit</button>'
        '<button type="button" data-topology-zoom="overview">Overview</button></div>'
        '<div class="topology-export-controls" role="group" aria-label="导出拓扑图">'
        '<button type="button" data-topology-export="png" title="导出完整拓扑，默认 2 倍分辨率">↓ 高清 PNG</button>'
        '<button type="button" data-topology-export="svg" title="导出可无限放大的矢量图">SVG</button></div></div></div>'
        '<div class="topology-export-status" data-export-status role="status"></div>'
        '<div class="topology-context-bar">'
        f'<div class="task-topology-legend" aria-label="Task runtime status">{legend}<span>{html_text(summary)}</span></div>'
        '<div class="topology-navigation"><input type="search" data-topology-search placeholder="定位任务 ID 或标题，按 Enter" aria-label="定位任务" /></div>'
        f'<div class="topology-observations"><span data-layout-summary>{len(nodes)} Tasks · {len(edges)} direct depends_on</span></div></div>'
        '<div class="topology-edge-inspector" data-edge-inspector aria-live="polite">悬停查看；点击连线固定路径 · 拖动画布移动</div>'
        '<div class="topology-error" data-topology-error role="alert" hidden></div>'
        '<div class="topology-workspace"><div class="task-topology-scroll" tabindex="0" aria-label="Dependency canvas">'
        '<svg class="task-topology-svg" role="img" aria-label="Task dependency graph" width="960" height="560" viewBox="0 0 960 560">'
        f'<defs><marker id="{html_text(feat_id)}-task-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 0 L 8 4 L 0 8 z" /></marker></defs>'
        '<g data-graph-edges></g><g data-graph-nodes></g></svg></div>'
        '<div class="topology-minimap" data-minimap><div><span>全局定位</span><button type="button" data-minimap-toggle aria-expanded="true" aria-label="折叠缩略地图">−</button></div><svg data-minimap-svg tabindex="0" role="button" aria-label="点击缩略地图定位，方向键移动"></svg></div>'
        '<aside class="topology-group-panel" data-group-panel aria-label="节点详情" hidden></aside></div>'
        '<details class="topology-reading-guide"><summary>如何阅读这张图</summary><p class="task-topology-note">Wave 按依赖深度推导，不限定节点坐标。并行组仅合并上下游完全相同的任务；精简连线保留相同可达关系，Show all links 展示全部声明依赖。'
        ' transitive and proof/validation relations stay in Task details.</p></details>'
        f'<template data-topology-model>{html_text(model_json)}</template>'
        f'<template data-topology-cards><svg>{"".join(cards)}</svg></template>'
        f'{overview}</section>'
    )


def render_task_review_html(
    root: Path,
    task: dict[str, Any],
    *,
    feat_id: str,
    feature_title: str,
    runtime_activity: dict[str, Any] | None = None,
    open_task: bool = False,
    feature_root_ref: str | None = None,
    historical: bool = False,
) -> str:
    status = str(task.get("status") or "todo")
    gate_result = str(task.get("gate_result") or "").strip()
    dependencies = canonical_task_dependencies(
        task,
        label=f"task {task.get('id')}",
    )
    acceptance = task.get("acceptance") if isinstance(task.get("acceptance"), list) else []
    verification = task.get("verification") if isinstance(task.get("verification"), list) else []
    acceptance_html = (
        '<ul class="acceptance-list">'
        + "".join(f"<li>{html_text(item)}</li>" for item in acceptance)
        + "</ul>"
        if acceptance
        else '<p class="empty">No acceptance statements.</p>'
    )
    verification_rows = []
    for item in verification:
        if not isinstance(item, dict):
            continue
        ref = str(item.get("ref") or "")
        href = local_ref_href(root, ref)
        ref_html = (
            f'<a href="{html_text(href)}" target="_blank" rel="noreferrer">{html_text(ref)}</a>'
            if href
            else f"<code>{html_text(ref)}</code>"
        )
        verification_rows.append(
            '<li><span class="verification-kind">'
            f'{html_text(item.get("kind") or "evidence")}</span>{ref_html}'
            f'<p>{html_text(item.get("proves"))}</p></li>'
        )
    verification_html = (
        '<ul class="verification-list">' + "".join(verification_rows) + "</ul>"
        if verification_rows
        else '<p class="empty">No verification mappings.</p>'
    )
    gate_html = f'<span class="gate">Gate {html_text(gate_result)}</span>' if gate_result else ""
    cancel_reason = str(task.get("cancel_reason") or "").strip()
    cancellation_html = (
        f'<p class="review-copy review-cancellation"><strong>Cancelled</strong>{html_text(cancel_reason)}</p>'
        if cancel_reason
        else ""
    )
    failure = task.get("failure") if isinstance(task.get("failure"), dict) else None
    failure_html = (
        f'<p class="review-copy review-failure"><strong>Failed assumption</strong>'
        f'{html_text(failure.get("reason"))} · 假设：{html_text(failure.get("assumption"))} · '
        + (f'已绑定后继：{html_text(", ".join(task.get("superseded_by", [])))}。' if task.get("superseded_by") else '待重规划：后继计划尚未安装。')
        + '</p>'
        if failure
        else ""
    )
    blocker = task.get("last_blocker") if isinstance(task.get("last_blocker"), dict) else None
    blocker_html = (
        f'<p class="review-copy review-blocker"><strong>Blocker</strong>{html_text(blocker.get("reason"))} · '
        f'owner: {html_text(blocker.get("owner") or "unspecified")} · '
        f'resume when: {html_text(blocker.get("resume_when") or "unspecified")}</p>'
        if blocker
        else ""
    )
    task_id = str(task.get("id") or "")
    task_title = str(task.get("title") or task_id)
    canonical_root_ref = feature_root_ref or f".bagakit/feature-tracker/features/{feat_id}"
    state_ref = f"{canonical_root_ref}/state.json"
    tasks_ref = f"{canonical_root_ref}/tasks.json"
    dependencies_text = ", ".join(dependencies) or "none"
    prompts = {
        "status": (
            f"检查 Feature {feat_id} / Task {task_id} 的当前状态。读取 {state_ref} 与 {tasks_ref}，"
            "报告 Task 状态、直接依赖、真实 blocker、最新 gate evidence 与唯一下一步；"
            "若处于等待，区分开始所需输入与最终签字证据，指出可提前完成的独立部分并交给 Owner 复核依赖；"
            "不要从提交、聊天或进度文本推断完成。"
        ),
        "explain": (
            f"基于 {tasks_ref} 解释 Task {task_id}“{task_title}”：说明 objective、outcome、"
            f"depends_on（{dependencies_text}）、acceptance、verification、当前状态及其在 DAG 中的位置。"
            "明确区分用户确认的要求、执行证据与 Agent 推断。"
        ),
    }
    prompt_labels = {
        "status": "检查状态",
        "explain": "Explain Task",
    }
    prompt_order = ["status", "explain"]
    if not historical:
        prompts = {
            "claim": (
                (
                    f"Task {task_id} 已 failed。读取 {state_ref} 与 {tasks_ref}，核对 failure.assumption 和 failure.reason，"
                    "检查受影响的后继节点与用户目标，提出最小 reviewed successor plan，并用 supersedes 绑定旧节点；"
                    "不要重启 failed Task，也不要把聊天中的重规划当成已安装计划。"
                    if status == "failed" else
                    f"认领 Feature“{feature_title}”（{feat_id}）的 Task {task_id}“{task_title}”。"
                    f"先读取 {state_ref} 与 {tasks_ref}，确认该 Task 当前 runnable 且没有真实 blocker；"
                    f"只有确认可领取后才执行 feature-tracker start-task --feature {feat_id} --task {task_id}，"
                    "随后按该 Task 的 acceptance 与 verification 闭环。不要重写计划或新增未经用户确认的需求。"
                )
            ),
            **prompts,
            "goal": (
                f"Goal：在 Feature“{feature_title}”（{feat_id}）内完成 Task {task_id}“{task_title}”，"
                f"交付“{str(task.get('outcome') or '').strip()}”；依赖为 {dependencies_text}；"
                f"完成标准与证据严格以 {tasks_ref} 中该 Task 的 acceptance 和 verification 为准，"
                "不扩展范围、不沉淀未经用户确认的新需求。"
            ),
        }
        prompt_labels = {
            "claim": "重规划" if status == "failed" else "认领任务",
            "status": "检查状态",
            "explain": "Explain Task",
            "goal": "Goal 语句",
        }
        prompt_order = ["claim", "status", "explain", "goal"]
    prompt_sources = "".join(
        f'<template data-prompt-source="{html_text(kind)}">{html_text(text)}</template>'
        for kind, text in prompts.items()
    )
    prompt_labels = {
        "claim": "复制 · 认领任务",
        "status": "复制 · 检查状态",
        "explain": "复制 · Explain Task",
        "goal": "复制 · Goal 语句",
    }
    prompt_html = (
        '<section class="task-quick-prompts" aria-label="Task quick prompts">'
        '<span class="eyebrow">Task prompts</span><div class="prompt-copy-actions">'
        + "".join(
            f'<button type="button" class="prompt-copy-action" data-prompt-copy="{html_text(kind)}" '
            f'data-prompt-label="{html_text(prompt_labels[kind])}">{html_text(prompt_labels[kind])}</button>'
            for kind in prompt_order
        )
        + '</div><span class="prompt-copy-status" aria-live="polite"></span>'
        + prompt_sources
        + '</section>'
    )
    task_activities = (
        runtime_activity.get("by_task", {})
        if isinstance(runtime_activity, dict)
        else {}
    )
    activity_html = render_runtime_activity_html(task_activities.get(task_id))
    open_attr = " open" if open_task else ""
    return (
        f'<details class="review-task" id="{html_text(task_review_anchor(feat_id, task_id))}"{open_attr}>'
        '<summary class="review-task-summary">'
        '<div class="task-heading">'
        f'<span class="task-id">{html_text(task.get("id"))}</span>'
        f'<span class="task-status task-status--{html_text(status.replace("_", "-"))}">'
        f"{html_text(status.replace('_', ' ').title())}</span>"
        + gate_html
        + "</div>"
        '<div class="task-title-row">'
        f'<h4 title="{html_text(task.get("title"))}">{html_text(task.get("title"))}</h4>'
        f'<button type="button" class="copy-title" data-copy-text="{html_text(task.get("title"))}" aria-label="Copy Task title">Copy</button>'
        '</div>'
        f'<p class="task-dependencies"><strong>Depends on</strong> {html_text(", ".join(dependencies) or "none")}</p>'
        '<span class="review-task-toggle">Details <span aria-hidden="true">↓</span></span>'
        '</summary><div class="review-task-body">'
        + activity_html
        + f'<p class="review-copy"><strong>Objective</strong>{html_text(task.get("objective"))}</p>'
        + f'<p class="review-copy"><strong>Outcome</strong>{html_text(task.get("outcome"))}</p>'
        + cancellation_html
        + blocker_html
        + failure_html
        + prompt_html
        + '<div class="review-grid"><div><h5>Acceptance</h5>'
        + acceptance_html
        + "</div><div><h5>Verification</h5>"
        + verification_html
        + "</div></div></div></details>"
    )


def render_feature_quick_prompts(
    *,
    feat_id: str,
    feature_title: str,
    state_ref: str,
    tasks_ref: str,
    goal_ref: str,
    receipt_ref: str,
) -> str:
    """Render one-click Feature-scoped prompt actions."""
    prompts = {
        "set_goal": (
            f"使用 $bagakit-set-loop-goal 为 Feature“{feature_title}”（{feat_id}）设置或校准唯一 Goal。"
            f"先读取 {state_ref}、{tasks_ref} 与现有 {goal_ref}（若存在），只纳入用户确认的 outcome、"
            "protected invariants、non-goals、closure oracle 和必要上下文；当前进度、next action、"
            f"assignments 与 execution evidence 仍留在 Tracker。通过 Feature Tracker 的 set-feature-goal "
            "以当前 revision guard 安装文件，再由 Host 激活 exact wrapper；不要新增未经确认的需求，"
            "不要创建第二个 Goal runtime 或修改 Task 状态。"
            "在稳定控制规则中保留：派发及完成/阻塞/修订事件后复核可并行 frontier；Wave 不是批次屏障，"
            "使用已确认可用资源推进审查准备与分片测试，最终验收仍绑定 exact candidate；合并同批事件，避免重复空转审查。"
        ),
        "plan": (
            f"解释 Feature“{feature_title}”（{feat_id}）整个 reviewed Task plan 的当前进展。"
            f"先读取 {state_ref}、{tasks_ref}、{receipt_ref}、{goal_ref}（若存在）以及可用的 Flow Runner "
            "task_ref progress receipt；先回答离用户目标还缺什么、当前具体卡在哪里、什么结果能关闭当前任务及下一步。"
            "再用 active、runnable、waiting、blocked 和验收证据支持结论；计划修订、命令次数和补收据不是交付进展。"
            f"可用 review-task-plan --feature {feat_id} --json 查看剩余结果；正常 waiting 不代表缺少审查，"
            "只在依赖前提变化或出现失败假设时重审相关边；"
            "Wave 不是批次屏障。明确指出可提前进行的审查、测试准备和分片验证，以及必须绑定最终 SHA 的验收。"
            "按已确认资源能力列出可立即派发的独立任务；调度变更通过已有授权的 reviewed revision 落地，保留完成历史与 active 语义。"
        ),
    }
    labels = {"set_goal": "复制 · 设置 Goal", "plan": "复制 · 解释全计划"}
    sources = "".join(
        f'<template data-prompt-source="{html_text(kind)}">{html_text(text)}</template>'
        for kind, text in prompts.items()
    )
    buttons = "".join(
        f'<button type="button" class="prompt-copy-action" data-prompt-copy="{html_text(kind)}" '
        f'data-prompt-label="{html_text(labels[kind])}">{html_text(labels[kind])}</button>'
        for kind in ("set_goal", "plan")
    )
    return (
        '<section class="tracker-quick-prompts" aria-label="Tracker-wide Feature prompts">'
        '<span class="eyebrow">Feature prompts</span>'
        f'<div class="prompt-copy-actions">{buttons}</div>'
        '<span class="prompt-copy-status" aria-live="polite"></span>'
        + sources
        + '</section>'
    )


def render_plan_review_html(state: dict[str, Any], tasks: dict[str, Any]) -> str:
    if not has_reviewed_task_plan(tasks):
        return ""
    audit = build_task_plan_audit(state, tasks)
    failed = audit["failed_tasks"]
    rows = []
    for item in failed:
        rows.append(
            f'<li data-replan-source="{html_text(item["item_id"])}"><strong>待重规划 · '
            f'<button type="button" class="lineage-link" data-task-open="{html_text(item["item_id"])}">{html_text(item["item_id"])}</button>'
            f'</strong><span>{html_text(item["assumption"])} → {html_text(item["reason"])}</span>'
            '<small>尚未安装后继计划；独立任务可继续。</small></li>'
        )
    for item in audit["installed_replacements"]:
        successors = " · ".join(
            f'<button type="button" class="lineage-link" data-task-open="{html_text(target["task_id"])}">{html_text(target["task_id"])}</button>'
            f' ({html_text(target["status"])})'
            if target["current"] else f'{html_text(target["task_id"])} (historical)'
            for target in item["successors"]
        )
        rows.append(
            f'<li data-replanned-source="{html_text(item["failed_task_id"])}"><strong>已安装后继计划 · r{item["plan_revision"]}</strong>'
            f'<span><button type="button" class="lineage-link" data-task-open="{html_text(item["failed_task_id"])}">{html_text(item["failed_task_id"])}</button>'
            f' (failed) → {successors}</span><small>Review: {html_text(item["review_ref"])}</small></li>'
        )
    changes = audit["latest_dependency_changes"]
    delta = " · ".join(
        f'{"新增" if kind == "added" else "移除"} {html_text(edge["from"])} → {html_text(edge["to"])}'
        for kind in ("added", "removed") for edge in changes[kind]
    )
    return (
        f'<section class="plan-review-observation" aria-label="Plan review" data-plan-revision="{audit["plan_revision"]}">'
        '<div class="plan-review-heading"><strong>规划调整</strong>'
        f'<span>r{audit["plan_revision"]} · Review: {html_text(audit["review_ref"])}</span></div>'
        + (f'<ul>{"".join(rows)}</ul>' if rows else '')
        + (f'<p class="plan-edge-delta">本次依赖变化：{delta}</p>' if delta else '')
        + '<p class="plan-review-boundary">计划已安装、任务已启动、验收已通过分别以各自证据为准。</p></section>'
    )


def render_feature_review_html(
    paths: HarnessPaths,
    state: dict[str, Any],
    tasks: dict[str, Any],
) -> str:
    feat_id = str(state.get("feat_id") or "")
    status = str(state.get("status") or "")
    branch = str(state.get("branch") or "").strip()
    worktree = str(state.get("worktree_path") or "").strip()
    workspace_detail = branch or worktree or "repository root"
    dependencies = state.get("depends_on", [])
    dependency_text = ", ".join(str(item) for item in dependencies) if isinstance(dependencies, list) else ""
    feature_dir = paths.feat_dir(feat_id, status=status)
    feature_root_ref = relative_display(paths.root, feature_dir)
    canonical_files = [
        ("state.json", paths.feat_state(feat_id, status=status)),
        ("tasks.json", paths.feat_tasks(feat_id, status=status)),
        ("goal.md", paths.feat_goal(feat_id, status=status)),
        ("verification.md", feature_dir / FEATURE_VERIFICATION_FILENAME),
    ]
    canonical_links = "".join(
        render_file_preview_entry(paths.root, path, label)
        for label, path in canonical_files
    )
    reviewed_tasks = current_plan_tasks(tasks)
    runtime_activity = load_feature_runtime_activity(paths, state, tasks)
    try:
        topology_html = render_task_topology_html(state, tasks, runtime_activity)
    except SystemExit as exc:
        # Topology is a read-only aid.  Keep the Feature proof and Task
        # details accessible when a malformed graph cannot be projected.
        topology_html = (
            '<section class="topology-projection-error" role="alert">'
            '<strong>拓扑投影失败</strong> '
            f'{html_text(normalize_error_text(exc))} · Task 详情与验收证据仍可查看。'
            '</section>'
        )
    review_frontier = feature_task_frontier(state, tasks)
    if status in CLOSED_FEAT_STATUS and has_reviewed_task_plan(tasks):
        review_frontier = task_frontier(tasks, feat_id=feat_id)
    current_task_count = len(current_plan_tasks(tasks)) if has_reviewed_task_plan(tasks) else 0
    review_metrics = (
        ("tasks", current_task_count, "Tasks"),
        ("active", len(review_frontier["active"]), "Active"),
        ("runnable", len(review_frontier["runnable"]), "Runnable"),
        ("waiting", len(review_frontier["waiting"]), "Waiting"),
        ("attention", len(review_frontier["failed"]) + len(review_frontier["blocked"]), "需关注"),
        ("done", len(review_frontier["done"]), "Done"),
    )
    next_step = (
        "先重规划已失败的任务路径"
        if review_frontier["failed"]
        else "继续当前 active Task"
        if review_frontier["active"]
        else "处理真实 blocker"
        if review_frontier["blocked"]
        else "领取可运行 Task"
        if review_frontier["runnable"]
        else "复核历史证据"
        if status in CLOSED_FEAT_STATUS
        else "等待新的 reviewed action"
    )
    tracker_name = tracker_name_for(feat_id)
    transferred_from = canonical_transferred_from(
        state.get("transferred_from"),
        feat_id=feat_id,
    )
    lineage_items: list[str] = []
    for transfer in transferred_from:
        source_id = transfer["feature_id"]
        source_ref = (
            f'<button type="button" class="lineage-link" data-feature-history-open="{html_text(source_id)}" '
            f'aria-label="Open transferred source {html_text(source_id)}">{html_text(source_id)}</button>'
        )
        lineage_items.append(source_ref)
    lineage_html = (
        f'<p class="review-lineage"><strong>Transferred from ({len(lineage_items)})</strong>'
        + " · ".join(lineage_items)
        + "</p>"
        if lineage_items
        else ""
    )
    tasks_html = (
        "".join(
            render_task_review_html(
                paths.root,
                task,
                feat_id=feat_id,
                feature_title=str(state.get("title") or feat_id),
                runtime_activity=runtime_activity,
                open_task=(
                    str(task.get("status") or "") in {"in_progress", "blocked", "failed"}
                    or len(reviewed_tasks) <= 2
                ),
                feature_root_ref=feature_root_ref,
                historical=status in CLOSED_FEAT_STATUS,
            )
            for task in reviewed_tasks
        )
        if reviewed_tasks
        else '<p class="empty">No reviewed tasks.</p>'
    )
    historical_failures = [
        task for task in tasks.get("tasks", [])
        if task.get("status") == "failed" and task.get("superseded_by")
    ]
    historical_html = ""
    if historical_failures:
        historical_html = (
            '<details class="failed-task-history"><summary>失败路径与后继 · '
            f'{len(historical_failures)}</summary>'
            + "".join(render_task_review_html(
                paths.root, task, feat_id=feat_id,
                feature_title=str(state.get("title") or feat_id),
                feature_root_ref=feature_root_ref, historical=True,
            ) for task in historical_failures)
            + '</details>'
        )
    runtime_html = render_runtime_activity_html(runtime_activity)
    try:
        formation_html = render_plan_lineage_html(paths.root, state, tasks)
    except SystemExit as exc:
        formation_html = (
            '<section class="topology-projection-error" role="alert">'
            '<strong>历史拓扑投影失败</strong> '
            f'{html_text(normalize_error_text(exc))} · 当前 Task 详情仍可查看。'
            '</section>'
        )
    feature_prompt_html = (
        render_feature_quick_prompts(
            feat_id=feat_id,
            feature_title=str(state.get("title") or feat_id),
            state_ref=f"{feature_root_ref}/state.json",
            tasks_ref=f"{feature_root_ref}/tasks.json",
            goal_ref=f"{feature_root_ref}/goal.md",
            receipt_ref=f"{feature_root_ref}/owner-receipt.json",
        )
        if status not in CLOSED_FEAT_STATUS
        else '<p class="closed-record-note">Closed history · read-only topology and proof; this record cannot be claimed or modified.</p>'
    )
    task_fold_note = (
        f'<p class="review-task-fold-note">{len(reviewed_tasks)} Tasks · active and blocked Tasks are open; '
        "select a Task to inspect its acceptance and proof.</p>"
        if len(reviewed_tasks) > 2
        else ""
    )
    context_html = (
        '<details class="context-drawer"><summary><span>计划上下文</span><span>文件 · 运行记录 · 规划历史</span></summary>'
        f'<nav class="canonical-links" aria-label="Canonical files">{canonical_links}</nav>'
        '<dl class="review-facts">'
        f'<div><dt>Tracker Name</dt><dd class="copyable-value"><code>{html_text(tracker_name)}</code>'
        f'<button type="button" class="copy-value" data-copy-text="{html_text(tracker_name)}" '
        'aria-label="Copy Tracker Name">Copy</button></dd></div>'
        f'<div><dt>Workspace</dt><dd>{html_text(workspace_detail)}</dd></div>'
        f'<div><dt>Runtime role</dt><dd>{html_text(state.get("runtime_role") or "standalone")}</dd></div>'
        f'<div><dt>Depends on</dt><dd>{html_text(dependency_text or "none")}</dd></div>'
        '</dl>' + lineage_html + render_plan_review_html(state, tasks) + runtime_html + '</details>'
    )
    return (
        '<div class="review-panel"><div class="review-header"><div><span class="eyebrow">Review</span>'
        '<h3>Current plan and proof</h3></div></div>'
        '<section class="review-overview" aria-label="Feature overview">'
        f'<div class="review-state-signal review-state-signal--{html_text(status.replace("_", "-"))}">'
        '<span class="review-signal-core" aria-hidden="true"></span><div><span class="eyebrow">Current state</span>'
        f'<strong>{html_text(human_status_label(status))}</strong><span class="review-next-step">{html_text(next_step)}</span></div></div>'
        '<div class="review-metric-strip">'
        + "".join(
            f'<div class="review-metric review-metric--{html_text(kind)}"><strong>{value}</strong><span>{html_text(label)}</span></div>'
            for kind, value, label in review_metrics
        )
        + '</div></section>'
        + feature_prompt_html
        + topology_html
        + formation_html
        + context_html
        + '<section class="review-task-region">'
        + task_fold_note
        + '<p class="review-task-jump-status" data-task-jump-status aria-live="polite"></p>'
        + f'<div class="review-tasks-scroll" tabindex="0" aria-label="Task list"><div class="review-tasks">{tasks_html}{historical_html}</div></div>'
        + '</section></div>'
    )


def render_feature_card_html(
    paths: HarnessPaths,
    state: dict[str, Any],
    tasks: dict[str, Any],
    *,
    focus_feature: bool,
) -> str:
    feat_id = str(state.get("feat_id") or "")
    frontier = feature_task_frontier(state, tasks)
    runtime_activity = load_feature_runtime_activity(paths, state, tasks)
    active_tasks = task_records_by_id(tasks, frontier["active"])
    runnable_tasks = task_records_by_id(tasks, frontier["runnable"])
    active_task_html = (
        '<div class="current-task">'
        f'<span class="eyebrow">Active tasks · {len(active_tasks)}</span>'
        + "".join(
            f'<strong><button type="button" class="board-task-link" data-task-open="{html_text(task.get("id"))}">{html_text(task.get("id"))} · {html_text(task.get("title"))}</button></strong>'
            for task in active_tasks[:2]
        )
        + "</div>"
        if active_tasks
        else '<div class="current-task current-task--empty">No task is currently active</div>'
    )
    runnable_task_html = (
        f'<div class="current-task runnable-tasks"><span class="eyebrow">Runnable tasks · {len(runnable_tasks)}</span>'
        + "".join(
            f'<strong><button type="button" class="board-task-link" data-task-open="{html_text(task.get("id"))}">{html_text(task.get("id"))} · {html_text(task.get("title"))}</button></strong>'
            for task in runnable_tasks[:2]
        )
        + "</div>"
        if runnable_tasks
        else ""
    )
    if len(active_tasks) > 2:
        active_task_html += f'<span class="task-preview-more">另有 {len(active_tasks) - 2} 项进行中 · 打开拓扑查看</span>'
    if len(runnable_tasks) > 2:
        runnable_task_html += f'<span class="task-preview-more">另有 {len(runnable_tasks) - 2} 项可领取</span>'
    runtime_summary_html = render_runtime_activity_html(runtime_activity, compact=True)
    replanning_html = (
        '<p class="replanning-note"><strong>Replanning</strong> '
        'A failed or cancelled Task needs a reviewed successor plan; independent work may continue.</p>'
        if str(state.get("status") or "") == "replanning"
        else ""
    )
    transferred_from = canonical_transferred_from(
        state.get("transferred_from"),
        feat_id=feat_id,
    )
    lineage_card_html = (
        '<p class="lineage-card"><strong>Transferred from</strong> '
        + ", ".join(html_text(item["feature_id"]) for item in transferred_from)
        + "</p>"
        if transferred_from
        else ""
    )
    blocker_items = current_task_blockers(tasks, feat_id=feat_id)
    blocker_html = (
        "".join(
            f'<p class="blocker"><strong><button type="button" class="board-task-link" data-task-open="{html_text(item["item_id"])}">{html_text(item["item_id"])} blocked ↗</button></strong> '
            f'{html_text(item["reason"])}'
            f' · unblock owner: {html_text(item.get("owner") or "unspecified")}'
            f' · resume evidence: {html_text(item.get("resume_when") or "unspecified")}</p>'
            for item in blocker_items
        )
    )
    failure_items = current_task_failures(tasks, feat_id=feat_id)
    failure_card_html = "".join(
        f'<p class="failure"><strong>{html_text(item["item_id"])} failed:</strong> '
        f'{html_text(item["reason"])} · requires reviewed replan</p>'
        for item in failure_items
    )
    goal = str(state.get("goal") or "").strip()
    focused_class = " feature-card--focused" if focus_feature else ""
    claim_message = build_agent_claim_message(paths, state, tasks)
    feature_title = str(state.get("title") or state.get("feat_id") or "Feature")
    search_text = " ".join(
        [
            feat_id,
            feature_title,
            goal,
            str(state.get("status") or ""),
            *[str(task.get("title") or "") for task in current_plan_tasks(tasks)],
        ]
    ).strip()

    task_total = len(current_plan_tasks(tasks))
    task_done = count_current_tasks(tasks, "done")
    completion_html = (
        f'<div class="feature-completion"><div><span>任务完成</span><strong>{task_done}<small> / {task_total}</small></strong></div>'
        f'<progress value="{task_done}" max="{task_total}" aria-label="任务完成 {task_done} / {task_total}"></progress></div>'
        if task_total else '<p class="feature-planning-note">等待 reviewed Task plan</p>'
    )
    return (
        f'<article class="feature-card{focused_class}" id="{html_text(state.get("feat_id"))}" '
        f'data-feature-search="{html_text(search_text)}" data-feature-status="{html_text(state.get("status") or "unknown")}">'
        f'<div class="feature-summary" role="button" tabindex="0" data-feature-open="{html_text(feat_id)}" '
        f'aria-label="Open details for {html_text(feature_title)}">'
        '<div class="feature-identity"><div class="card-kicker">'
        f'<button type="button" class="feature-id copy-feature-id" data-copy-text="{html_text(state.get("feat_id"))}" aria-label="Copy Feature ID">{html_text(state.get("feat_id"))}</button>'
        f'<span class="workspace-chip">{html_text(state.get("workspace_mode") or "unassigned")}</span>'
        "</div>"
        '<div class="feature-title-row">'
        f'<h3 title="{html_text(state.get("title"))}">{html_text(state.get("title"))}</h3>'
        f'<button type="button" class="copy-title" data-copy-text="{html_text(state.get("title"))}" aria-label="Copy Feature title">Copy</button>'
        '</div>'
        + (f'<p class="goal">{html_text(goal)}</p>' if goal else "")
        + completion_html
        + blocker_html
        + failure_card_html
        + '</div><div class="feature-work">'
        + active_task_html
        + runnable_task_html
        + runtime_summary_html
        + replanning_html
        + lineage_card_html
        + f'<div class="task-counts">{render_task_stats_html(tasks)}</div>'
        + '<span class="review-hint">进入任务地图 <span aria-hidden="true">↗</span></span>'
        + "</div></div>"
        + f'<template class="feature-review-template">{render_feature_review_html(paths, state, tasks)}</template>'
        + '<div class="claim-bar"><button type="button" class="claim-trigger" '
        f'data-feature-title="{html_text(feature_title)}">Agent 认领</button>'
        '<span>生成 agent-set-v1 认领消息</span></div>'
        f'<textarea class="claim-draft" hidden>{html_text(claim_message)}</textarea>'
        + "</article>"
    )


def render_closed_features_html(
    paths: HarnessPaths,
    items: list[dict[str, Any]],
    *,
    focus_feat_id: str | None = None,
) -> str:
    if not items:
        return ""
    rows = []
    for item in items:
        item_feat_id = str(item.get("feat_id") or "")
        focused = item_feat_id == str(focus_feat_id or "")
        status = str(item.get("status") or "")
        review_template = ""
        detail_attrs = ""
        try:
            item_title = str(item.get("title") or item_feat_id)
            if focused:
                state, tasks = load_feat(paths, item_feat_id)
                item_title = str(state.get("title") or item_title)
                review_template = (
                    f'<template class="feature-review-template">'
                    f'{render_feature_review_html(paths, state, tasks)}'
                    "</template>"
                )
            detail_attrs = (
                f' data-feature-open="{html_text(item_feat_id)}" role="button" tabindex="0"'
                f' aria-label="Open details for {html_text(item_title)}"'
            )
        except SystemExit as exc:
            item_title = str(item.get("title") or item_feat_id)
            review_template = (
                f'<span class="closed-projection-error" title="{html_text(normalize_error_text(exc))}">'
                "Topology unavailable</span>"
            )
        transferred_to = item.get("transferred_to") if isinstance(item.get("transferred_to"), dict) else {}
        successor = str(
            (transferred_to or {}).get("feature_id")
            or item.get("replacement_feat_id")
            or ""
        ).strip()
        relation_html = (
            f'<span class="closed-status">Transferred → {html_text(successor)}</span>'
            if status == "transferred" and successor
            else f'<span class="closed-status">{html_text(human_status_label(status))}</span>'
        )
        rows.append(
            f'<li id="closed-{html_text(item_feat_id)}" data-closed-feature-id="{html_text(item_feat_id)}"'
            f' class="{"closed-feature--focused" if focused else ""}"{detail_attrs}>'
            '<span class="closed-id">'
            f'{html_text(item_feat_id)}</span>'
            f'<strong title="{html_text(item_title)}">{html_text(item_title)}</strong>'
            f'<button type="button" class="copy-title" data-copy-text="{html_text(item_title)}" aria-label="Copy Feature title">Copy</button>'
            f"{relation_html}"
            + ('<span class="closed-open">Open topology ↗</span>' if detail_attrs else review_template)
            + (review_template if detail_attrs else '')
            + '</li>'
        )
    history_open = any(
        str(item.get("feat_id") or "") == str(focus_feat_id or "")
        for item in items
    )
    return (
        f'<section class="closed-section" id="closed-feature-history"><details{" open" if history_open else ""}><summary>Closed history '
        f'<span>{len(items)}</span></summary><ul>{"".join(rows)}</ul></details></section>'
    )


def render_feature_projection_error_html(
    paths: HarnessPaths,
    state: dict[str, Any],
    error: str,
) -> str:
    """Keep one malformed Feature visible without inventing Task truth."""
    feat_id = str(state.get("feat_id") or "unknown")
    status = str(state.get("status") or "unknown")
    links = []
    for label, path in (
        ("state.json", paths.feat_state(feat_id, status=status)),
        ("tasks.json", paths.feat_tasks(feat_id, status=status)),
    ):
        links.append(render_file_preview_entry(paths.root, path, label))
    links_html = "".join(links)
    search_text = " ".join((feat_id, str(state.get("title") or ""), status, error)).strip()
    return (
        f'<article class="feature-card feature-card--projection-error" id="{html_text(feat_id)}" '
        f'data-feature-search="{html_text(search_text)}" data-feature-status="{html_text(status)}">'
        '<div class="feature-summary">'
        '<div class="card-kicker">'
        f'<button type="button" class="feature-id copy-feature-id" data-copy-text="{html_text(feat_id)}" aria-label="Copy Feature ID">{html_text(feat_id)}</button>'
        f'<span class="workspace-chip">{html_text(state.get("workspace_mode") or "unknown")}</span>'
        '</div>'
        f'<h3>{html_text(state.get("title") or feat_id)}</h3>'
        f'<p class="projection-error"><strong>Needs tracker repair</strong> {html_text(error)}</p>'
        f'<p class="projection-error-links">SSOT: {links_html or "state.json / tasks.json"}</p>'
        '</div></article>'
    )


def choose_focus_feature(
    records: list[tuple[dict[str, Any], dict[str, Any]]],
) -> tuple[dict[str, Any], dict[str, Any], str] | None:
    """Choose one derived attention target without creating tracker truth."""
    candidates: list[tuple[int, str, dict[str, Any], dict[str, Any], str]] = []
    for state, tasks in records:
        if state.get("_projection_error"):
            continue
        feat_id = str(state.get("feat_id") or "")
        status = str(state.get("status") or "")
        try:
            frontier = feature_task_frontier(state, tasks)
        except SystemExit:
            continue
        if frontier["failed"]:
            reason = "Review disproved assumptions and install successor plan"
            priority = 0
        elif status == "in_progress" and frontier["active"]:
            reason = "Continue the active Task"
            priority = 1
        elif status == "blocked" and frontier["blocked"]:
            reason = "Resolve the current blocker"
            priority = 2
        elif status == "replanning":
            reason = "Install the reviewed successor plan"
            priority = 2
        elif status == "ready" and frontier["runnable"]:
            reason = "Claim a runnable Task"
            priority = 3
        elif status == "done":
            reason = "Complete Feature closeout"
            priority = 4
        else:
            continue
        candidates.append((priority, feat_id, state, tasks, reason))
    if not candidates:
        return None
    _, _, state, tasks, reason = min(candidates, key=lambda item: (item[0], feat_sort_key(item[1])))
    return state, tasks, reason


def render_focus_feature_html(
    paths: HarnessPaths,
    candidate: tuple[dict[str, Any], dict[str, Any], str] | None,
) -> str:
    if candidate is None:
        return (
            '<section class="focus-strip focus-strip--empty" aria-label="Current focus">'
            '<div><span class="eyebrow">Current focus</span><h2>No active attention target</h2>'
            '<p>All current Features are waiting for a new reviewed action.</p></div></section>'
        )
    state, tasks, reason = candidate
    feat_id = str(state.get("feat_id") or "")
    status = str(state.get("status") or "")
    frontier = feature_task_frontier(state, tasks)
    active = ", ".join(frontier["active"]) or "none"
    runnable = ", ".join(frontier["runnable"]) or "none"
    blocked = ", ".join(frontier["blocked"]) or "none"
    failed = ", ".join(frontier["failed"]) or "none"
    progress = (
        f"进行 {len(frontier['active'])} · 可领取 {len(frontier['runnable'])} · 阻塞 {len(frontier['blocked'])} · 待重规划 {len(frontier['failed'])}"
        if status != "replanning"
        else "failed or cancelled Tasks need a reviewed successor plan"
    )
    total = len(current_plan_tasks(tasks))
    done = count_current_tasks(tasks, "done")
    completion = (
        f'<div class="focus-completion"><strong>{round(done / total * 100)}<span>%</span></strong>'
        f'<span>任务完成 · {done} / {total}</span><progress value="{done}" max="{total}" aria-label="任务完成 {done} / {total}"></progress></div>'
        if total else ''
    )
    return (
        f'<section class="focus-strip focus-strip--{html_text(status.replace("_", "-"))}" '
        f'role="button" tabindex="0" data-feature-open="{html_text(feat_id)}" '
        f'aria-label="Open details for {html_text(state.get("title") or feat_id)}">'
        '<div class="focus-copy"><span class="eyebrow">当前焦点 / NEXT IN FOCUS</span>'
        f'<h2>{html_text(state.get("title") or feat_id)}</h2>'
        f'<p>{html_text(reason)} · {html_text(progress)}</p></div>'
        + completion
        + f'<div class="focus-meta"><span class="focus-status">{html_text(human_status_label(status))}</span>'
        f'<button type="button" class="focus-id copy-feature-id" data-copy-text="{html_text(feat_id)}" aria-label="Copy Feature ID">{html_text(feat_id)}</button><span class="focus-open">进入任务地图 ↗</span></div>'
        '</section>'
    )


@lru_cache(maxsize=1)
def status_web_bundle() -> tuple[str, str]:
    """One process serves one coherent renderer/asset build, including exports."""
    web_root = Path(__file__).resolve().parent / "web"
    scripts = ("theme.js", "vendor/dagre-LEGAL.txt", "vendor/dagre.min.js", "topology-layout.js", "topology-export.js", "topology-view.js", "feature-relations.js")
    bundle = "".join(
        "<script>" + (web_root / name).read_text(encoding="utf-8").replace("</script", "<\\/script") + "</script>"
        for name in scripts
    ) + "<style>" + "\n".join((web_root / name).read_text(encoding="utf-8") for name in ("topology.css", "theme.css", "feature-relations.css")) + "</style>"
    revision = hashlib.sha256((RENDERER_BUILD + bundle).encode("utf-8")).hexdigest()[:16]
    return bundle, revision



def render_cross_feature_overview_html(
    paths: HarnessPaths,
    active_records: list[tuple[dict[str, Any], dict[str, Any]]],
    closed_items: list[dict[str, Any]],
    focus_feat_id: str | None = None,
) -> str:
    """Project declared Feature dependencies, including retained history."""
    records = {str(state.get("feat_id")): (state, tasks) for state, tasks in active_records}
    errors = []
    for item in closed_items:
        feature_id = str(item.get("feat_id") or "")
        try:
            records[feature_id] = load_feat(paths, feature_id)
        except SystemExit as exc:
            errors.append(normalize_error_text(exc))
            records[feature_id] = ({**item, "_projection_error": True}, {"tasks": []})
    nodes, edges = [], []
    for feature_id, (state, tasks) in records.items():
        unavailable = bool(state.get("_projection_error"))
        try:
            dependencies = canonical_depends_on(state, feat_id=feature_id)
        except SystemExit as exc:
            errors.append(normalize_error_text(exc))
            dependencies = []
        nodes.append({"id": feature_id, "title": str(state.get("title") or feature_id),
                      "status": str(state.get("status") or "unknown"),
                      "label": human_status_label(state.get("status")),
                      "done": count_current_tasks(tasks, "done"),
                      "total": len(current_plan_tasks(tasks)), "unavailable": unavailable})
        edges.extend({"from": dependency, "to": feature_id} for dependency in dependencies)
    known = set(records)
    for missing in sorted({e["from"] for e in edges} - known):
        nodes.append({"id": missing, "title": "引用的 Feature 不在当前索引中", "status": "unknown",
                      "label": "Unavailable", "done": 0, "total": 0, "unavailable": True})
    model = {"nodes": nodes, "edges": edges, "errors": errors}
    return (
        '<section class="cross-feature-overview" id="cross-feature-overview" aria-label="Feature 依赖关系图">'
        '<header class="feature-map-toolbar"><div><strong>Feature 依赖关系</strong>'
        '<p>箭头：前置 Feature → 依赖它的 Feature。仅依据 depends_on，转交沿革不作为依赖。</p></div>'
        '<label><input type="checkbox" data-feature-map-isolated> 显示独立 Feature</label>'
        '<div class="feature-map-zoom" role="group" aria-label="Feature 图缩放">'
        '<button type="button" data-feature-map-zoom="out" aria-label="缩小 Feature 图">−</button>'
        '<output data-feature-map-scale>100%</output>'
        '<button type="button" data-feature-map-zoom="in" aria-label="放大 Feature 图">+</button>'
        '<button type="button" data-feature-map-zoom="fit">适应画面</button></div></header>'
        '<p class="feature-map-status" data-feature-map-status role="status"></p>'
        '<div class="feature-map-scroll" tabindex="0" aria-label="Feature 关系画布，可滚动">'
        '<svg class="feature-map-svg" role="img" aria-label="Feature 之间的依赖关系"></svg></div>'
        '<p class="feature-map-note">点击节点打开原有 Feature 详情与 Task 拓扑；完成、归档、转交和废弃状态分别保留。</p>'
        f'<template data-feature-relations>{html_text(json.dumps(model, ensure_ascii=False))}</template></section>'
    )

def render_feature_status_html(
    paths: HarnessPaths,
    *,
    feat_id: str | None,
    live: bool = False,
    refresh_ms: int = 5000,
) -> str:
    index_items = load_index(paths).get("features", [])
    focus_feat_id = str(feat_id or "").strip() or None
    if focus_feat_id:
        # `--feature` is a focus selector for the human HTML projection. Load
        # it once up front so an invalid id still fails closed, then render the
        # complete active board below with this Feature targeted by the details
        # panel.
        load_feat(paths, focus_feat_id)

    active_records = []
    closed_items = []
    for item in index_items:
        status = str(item.get("status") or "")
        if status in CLOSED_FEAT_STATUS:
            closed_items.append(item)
            continue
        item_feat_id = str(item.get("feat_id") or "")
        try:
            state, tasks = load_feat(paths, item_feat_id)
        except SystemExit as exc:
            state = {
                "feat_id": item_feat_id,
                "title": item.get("title") or item_feat_id,
                "status": status,
                "workspace_mode": item.get("workspace_mode") or "unknown",
                "branch": item.get("branch") or "",
                "worktree_path": item.get("worktree") or "",
                "_projection_error": normalize_error_text(exc),
            }
            tasks = {"tasks": []}
        active_records.append((state, tasks))
    project_name = paths.root.name.strip() or "Project"
    if paths.root == Path.home() or project_name in {".", "Users", "home"}:
        project_name = "Workspace"
    page_title = f"{project_name} · Feature Tracker"

    by_status: dict[str, list[tuple[dict[str, Any], dict[str, Any]]]] = {}
    for state, tasks in active_records:
        by_status.setdefault(str(state.get("status") or "unknown"), []).append((state, tasks))
    focus_candidate = choose_focus_feature(active_records)
    focus_context_id = focus_feat_id or (str(focus_candidate[0].get("feat_id") or "") if focus_candidate else None)
    focus_html = render_focus_feature_html(paths, focus_candidate)

    projection_signature = sha256_bytes(
        json.dumps(
            {
                "active": [
                    {
                        "state": state,
                        "tasks": tasks,
                        "runtime": load_feature_runtime_activity(paths, state, tasks),
                    }
                    for state, tasks in active_records
                ],
                "closed": closed_items,
            },
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    )[:16]

    status_order = list(FEATURE_STATUS_ORDER)
    status_order.extend(sorted(status for status in by_status if status not in FEATURE_STATUS_ORDER))
    columns = []
    empty_columns = []
    for status in status_order:
        records = by_status.get(status, [])
        tone = FEATURE_STATUS_PRESENTATION.get(status, ("", "slate"))[1]
        cards_parts = []
        for state, tasks in records:
            projection_error = str(state.get("_projection_error") or "").strip()
            if projection_error:
                cards_parts.append(render_feature_projection_error_html(paths, state, projection_error))
                continue
            try:
                cards_parts.append(
                    render_feature_card_html(
                        paths,
                        state,
                        tasks,
                        focus_feature=focus_feat_id == str(state.get("feat_id") or ""),
                    )
                )
            except SystemExit as exc:
                cards_parts.append(
                    render_feature_projection_error_html(
                        paths,
                        state,
                        normalize_error_text(exc),
                    )
                )
        cards = "".join(cards_parts) or '<p class="column-empty">No features in this state.</p>'
        empty = not records
        if empty:
            empty_columns.append(
                f'<section class="status-column status-column--{html_text(tone)} status-column--empty" data-status="{html_text(status)}" data-column-empty="true" data-empty-collapsed="true">'
                '<button type="button" class="empty-stage-toggle" aria-expanded="false">'
                f'<span class="empty-stage-chevron" aria-hidden="true">›</span><span>{html_text(human_status_label(status))}</span>'
                f'<span class="status-count" data-status-count data-base-count="0">0</span>'
                '<span class="empty-stage-note">暂无项目 · 展开阶段</span></button>'
                f'<div class="feature-list">{cards}</div></section>'
            )
        else:
            columns.append(
                f'<section class="status-column status-column--{html_text(tone)}" data-status="{html_text(status)}" data-column-empty="false">'
                '<header><div class="status-title">'
                f'<h2>{html_text(human_status_label(status))}</h2>'
                f'<span class="status-count" data-status-count data-base-count="{len(records)}">{len(records)}</span></div></header>'
                f'<div class="feature-list">{cards}</div></section>'
            )

    open_count = sum(
        1 for state, _ in active_records if str(state.get("status") or "") not in CLOSED_FEAT_STATUS
    )
    in_progress_count = len(by_status.get("in_progress", []))
    replanning_count = len(by_status.get("replanning", []))
    blocked_count = len(by_status.get("blocked", []))
    closeout_count = len(by_status.get("done", []))
    board_html = '<div class="board-section-heading"><span>FEATURES / 项目推进</span><span>按阶段查看 · 点击卡片深入</span></div>' + render_cross_feature_overview_html(paths, active_records, closed_items, focus_context_id) + f'<div class="status-board" id="status-board"><main class="populated-stage-board">{"".join(columns)}</main><aside class="empty-stage-rail" aria-label="Empty lifecycle stages">{"".join(empty_columns)}</aside></div>'
    projection_note = (
        f"Live read-only view; refreshes every {refresh_ms // 1000}s from canonical files."
        if live
        else "Snapshot computed from Feature Tracker canonical files. Regenerate and reload for current status; this page stores no planning or runtime truth."
    )

    document_head = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:,">
<title>Feature Tracker Status</title>
<style>
:root { color-scheme:light; --canvas:#f5f5f2; --surface:#fff; --ink:#1d1d1b; --muted:#74756f; --shadow:0 2px 8px rgb(28 28 24 / .055); font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
* { box-sizing:border-box; }
body { margin:0; background:var(--canvas); color:var(--ink); font-size:14px; }
.shell { min-height:100vh; padding:28px; }
.focus-strip { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:18px; align-items:center; margin:0 0 20px; border:1px solid #dedfd8; border-radius:14px; background:#fff; padding:16px 18px; cursor:pointer; box-shadow:0 8px 24px rgb(28 28 24 / .045); }
.focus-strip:hover { border-color:#b8bbb0; }
.focus-strip:focus-visible { outline:2px solid #7d9ab1; outline-offset:3px; }
.focus-strip--in-progress { border-color:#e6d39e; background:#fffaf0; }
.focus-strip--blocked { border-color:#e7b2ae; background:#fff8f7; }
.focus-strip--replanning { border-color:#dfcfaa; background:#fffaf0; }
.focus-strip--ready { border-color:#b9d2ec; background:#f7fbff; }
.focus-strip--done { border-color:#b9d9c5; background:#f7fcf8; }
.focus-copy h2 { margin:4px 0 3px; font-size:17px; line-height:1.25; letter-spacing:-.018em; }
.focus-copy p { margin:0; color:var(--muted); font-size:11px; line-height:1.4; }
.focus-meta { display:grid; justify-items:end; gap:5px; color:var(--muted); font-size:10px; text-align:right; }
.focus-status { border-radius:999px; background:#ecece7; color:#5d6058; padding:4px 8px; font-size:10px; font-weight:650; }
.focus-strip--in-progress .focus-status { background:#f1ddb1; color:#76530e; }
.focus-strip--blocked .focus-status { background:#f4d0cc; color:#8e2d29; }
.focus-strip--replanning .focus-status { background:#efe1bd; color:#775b1d; }
.focus-strip--ready .focus-status { background:#dcecfb; color:#2d6599; }
.focus-strip--done .focus-status { background:#dcefe3; color:#2e6e4b; }
.focus-id { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
.focus-open { color:#356f9e; font-weight:650; }
.focus-strip--empty { cursor:default; }
.focus-strip--empty:hover { border-color:#dedfd8; }
.focus-strip--empty h2 { font-size:15px; }
.page-header { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; margin:0 0 20px; }
.page-header h1 { margin:3px 0 0; font-size:24px; line-height:1.25; letter-spacing:-.025em; }
.page-header p { margin:0; color:var(--muted); font-size:12px; }
.projection-meta { display:grid; justify-items:end; gap:8px; }
.projection-note { max-width:420px; text-align:right; }
.status-toolbar { display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin:0 0 16px; }
.status-toolbar label { color:var(--muted); font-size:10px; text-transform:uppercase; letter-spacing:.055em; }
.status-filter-input,.status-filter-select { min-height:30px; border:1px solid #d6d8d0; border-radius:8px; background:#fff; color:var(--ink); padding:5px 9px; font:12px/1.2 inherit; }
.status-filter-input { width:min(340px,100%); }
.status-filter-input:focus,.status-filter-select:focus { outline:2px solid #8ba8bf; outline-offset:1px; border-color:#8ba8bf; }
.status-filter-clear { min-height:30px; border:1px solid #d6d8d0; border-radius:8px; background:transparent; color:#565851; cursor:pointer; padding:5px 9px; font:11px inherit; }
.status-filter-clear:hover { border-color:#9ca198; color:var(--ink); }
.status-filter-summary { color:var(--muted); font-size:11px; }
.status-column--filtered-empty { display:none; }
.refresh-control { display:flex; align-items:center; gap:7px; color:var(--muted); font-size:10px; }
.refresh-dot { width:7px; height:7px; border-radius:50%; background:#9ca198; }
.refresh-control[data-state="updating"] .refresh-dot { background:#b98313; }
.refresh-control[data-state="updated"] .refresh-dot { background:#2f8a5c; }
.refresh-control[data-state="unchanged"] .refresh-dot { background:#8b9288; }
.refresh-control[data-state="error"] .refresh-dot { background:#c4413b; }
.refresh-now { border:1px solid #d6d8d0; border-radius:7px; background:transparent; color:#565851; cursor:pointer; padding:3px 6px; font:inherit; font-size:10px; }
.refresh-now:hover { border-color:#9ca198; color:var(--ink); }
.metrics { display:flex; flex-wrap:wrap; gap:14px 34px; margin:0 0 20px; padding:0 2px; }
.metric { min-width:86px; }
.metric strong { display:block; font-size:23px; line-height:1.15; font-variant-numeric:tabular-nums; }
.metric span { color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:.055em; }
.status-board { display:flex; flex-wrap:wrap; gap:16px; align-items:start; }
.status-column { --tone:#8b8c86; --tint:#ecece7; min-width:0; display:flex; flex-direction:column; border-radius:15px; background:color-mix(in srgb,var(--tint) 34%,var(--canvas)); padding:9px; scroll-snap-align:start; }
.status-column--amber { --tone:#b98313; --tint:#fbf5e5; }
.status-column--red { --tone:#c4413b; --tint:#fbefee; }
.status-column--blue { --tone:#3578c7; --tint:#edf4fb; }
.status-column--green { --tone:#2f8a5c; --tint:#edf7f1; }
.status-column > header { padding:6px 6px 10px; }
.status-title { display:flex; align-items:center; gap:7px; }
.status-title h2 { margin:0; font-size:12px; font-weight:650; }
.status-count { color:var(--muted); font-size:12px; font-variant-numeric:tabular-nums; }
.feature-list { display:grid; flex:1; align-content:start; gap:8px; }
.column-empty { margin:auto 8px; color:var(--muted); font-size:11px; text-align:center; }
.feature-card { border-radius:12px; background:var(--surface); box-shadow:var(--shadow); overflow:hidden; }
.feature-card--focused { outline:2px solid color-mix(in srgb,var(--tone) 68%,transparent); outline-offset:2px; }
.feature-summary { cursor:pointer; padding:12px; }
.feature-summary:hover { background:#fcfcfa; }
.feature-summary:focus-visible { outline:2px solid var(--tone); outline-offset:-3px; border-radius:12px; }
.card-kicker,.task-heading { display:flex; align-items:center; gap:6px; min-width:0; }
.feature-id,.task-id { color:var(--muted); font-size:11px; font-variant-numeric:tabular-nums; }
.copy-feature-id { margin:0; border:0; background:transparent; padding:0; cursor:pointer; text-align:left; font:inherit; }
.copy-feature-id:hover { text-decoration:underline; text-underline-offset:3px; }
.workspace-chip,.task-status,.gate { margin-left:auto; border-radius:999px; background:#f0f0ed; color:#5f605b; padding:2px 6px; font-size:10px; white-space:nowrap; }
.feature-title-row,.task-title-row { display:flex; align-items:flex-start; gap:8px; min-width:0; }
.feature-title-row h3,.task-title-row h4 { min-width:0; flex:1; }
.feature-card h3 { margin:7px 0 0; font-size:14px; line-height:1.35; letter-spacing:-.01em; }
.copy-title,.copy-value { flex:0 0 auto; border:1px solid #d6d8d0; border-radius:6px; background:#fff; color:#6b6d67; cursor:pointer; padding:3px 5px; font:inherit; font-size:9px; line-height:1.1; opacity:.82; }
.copy-title:hover,.copy-title:focus-visible,.copy-value:hover,.copy-value:focus-visible { border-color:#9ca198; color:var(--ink); opacity:1; }
.feature-card--projection-error { border:1px solid #e7b2ae; }
.projection-error { margin:8px 0 0; border-radius:7px; background:#fff7f6; color:#8e2d29; padding:7px; font-size:11px; line-height:1.45; }
.projection-error-links { margin:7px 0 0; color:var(--muted); font-size:10px; line-height:1.45; overflow-wrap:anywhere; }
.projection-error-links a { color:#356f9e; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
.goal { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; margin:5px 0 0; color:var(--muted); font-size:12px; line-height:1.45; }
.blocker { margin:8px 0 0; border-radius:7px; background:#fff0ef; color:#8e2d29; padding:7px; font-size:11px; line-height:1.45; }
.failure { margin:8px 0 0; border-radius:7px; background:#f7effd; color:#60367d; padding:7px; font-size:11px; line-height:1.45; }
.replanning-note { margin:8px 0 0; border-radius:7px; background:#f5f1e5; color:#7a5a1b; padding:7px; font-size:11px; line-height:1.45; }
.lineage-card,.review-lineage { margin:8px 0 0; color:#665d83; font-size:10px; line-height:1.45; }
.lineage-card strong,.review-lineage strong { color:#5e537d; }
.current-task { display:grid; gap:2px; margin-top:10px; border-radius:8px; background:color-mix(in srgb,var(--tone) 6%,transparent); padding:7px 8px; font-size:12px; line-height:1.4; }
.current-task--empty { background:#f7f7f4; color:var(--muted); }
.runtime-activity-summary { display:grid; gap:2px; margin-top:10px; border-radius:8px; background:#f2f7f4; padding:7px 8px; color:#315c45; font-size:11px; line-height:1.35; }
.runtime-activity-summary strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.eyebrow { color:var(--muted); font-size:10px; text-transform:uppercase; letter-spacing:.06em; }
.task-counts { display:flex; flex-wrap:wrap; gap:5px; margin-top:10px; }
.task-count { border-radius:999px; background:#f2f2ef; color:#666761; padding:2px 6px; font-size:10px; font-variant-numeric:tabular-nums; }
.task-count--in-progress { background:#fff4d8; color:#7a5610; }
.task-count--blocked { background:#fff0ef; color:#8e2d29; }
.task-count--transferred { background:#f0edf8; color:#66548e; }
.task-count--done { background:#eaf7ef; color:#256746; }
.review-hint { display:inline-flex; align-items:center; gap:4px; margin-top:10px; color:var(--tone); font-size:11px; font-weight:650; }
.review-panel { margin:0; background:transparent; padding:4px 0 16px; }
.review-header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.review-header h3 { margin:2px 0 0; font-size:15px; }
.review-overview { display:grid; grid-template-columns:minmax(180px,.55fr) minmax(0,2.45fr); gap:10px; align-items:stretch; margin:10px 0 0; }
.review-state-signal { position:relative; display:flex; align-items:center; gap:8px; min-height:52px; overflow:hidden; border:1px solid #dce1dc; border-radius:10px; background:#f5f7f4; padding:8px 10px; }
.review-state-signal strong { display:block; margin-top:1px; font-size:13px; letter-spacing:-.02em; }
.review-state-signal--in-progress { border-color:#d6c48e; background:#fffaf0; }
.review-state-signal--blocked { border-color:#e3b7b2; background:#fff7f6; }
.review-state-signal--replanning { border-color:#ddcda9; background:#fbf8ed; }
.review-state-signal--done { border-color:#b9d6c1; background:#f2faf4; }
.review-state-signal--archived,.review-state-signal--discarded,.review-state-signal--transferred { background:#f5f5f2; }
.review-signal-core { position:relative; flex:0 0 auto; width:11px; height:11px; border:3px solid #9ca69e; border-radius:50%; background:#fff; }
.review-state-signal--in-progress .review-signal-core { border-color:#a8781e; background:#ffe5a6; box-shadow:0 0 0 5px rgb(168 120 30 / .12); }
.review-state-signal--in-progress .review-signal-core::after { content:""; position:absolute; left:12px; top:1px; width:42px; height:2px; background:linear-gradient(90deg, rgb(168 120 30 / .5), transparent); transform:translateX(-2px); animation:review-signal-scan 2.8s ease-in-out infinite; }
.review-next-step { display:block; max-width:170px; margin-top:3px; color:var(--muted); font-size:10px; }
@keyframes review-signal-scan { 0%,100% { opacity:.15; transform:translateX(-7px); } 50% { opacity:.9; transform:translateX(15px); } }
.review-metric-strip { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:1px; overflow:hidden; border:1px solid #e2e5df; border-radius:10px; background:#e2e5df; }
.review-metric { display:flex; min-height:52px; flex-direction:column; justify-content:center; background:#fff; padding:7px 8px; }
.review-metric strong { font-size:17px; line-height:1.05; font-variant-numeric:tabular-nums; letter-spacing:-.03em; }
.review-metric span { margin-top:5px; color:var(--muted); font-size:9px; text-transform:uppercase; letter-spacing:.06em; }
.review-metric--active strong { color:#9a6b16; }
.review-metric--runnable strong { color:#39718c; }
.review-metric--waiting strong { color:#73736d; }
.review-metric--done strong { color:#397253; }
.canonical-links { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:5px; }
.file-preview-entry { display:inline-flex; }
.file-preview-trigger { border:0; border-radius:999px; background:#eaeae5; color:#4f504b; cursor:pointer; padding:4px 8px; font:inherit; font-size:10px; }
.file-preview-trigger:hover,.file-preview-trigger:focus-visible { background:#dfdfd8; color:var(--ink); outline:2px solid #aeb4ad; outline-offset:1px; }
.review-facts { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px 16px; margin:14px 0 0; }
.review-facts div { display:grid; grid-template-columns:76px 1fr; gap:8px; }
.review-facts dt { color:var(--muted); font-size:10px; text-transform:uppercase; }
.review-facts dd { margin:0; overflow-wrap:anywhere; font-size:11px; }
.review-lineage { padding:7px 0; }
.lineage-link { border:0; border-bottom:1px solid currentColor; background:transparent; color:#5e537d; cursor:pointer; padding:0 1px; font:inherit; font-size:inherit; }
.lineage-link:hover,.lineage-link:focus-visible { color:#352c5d; outline:2px solid #b9addb; outline-offset:2px; }
.copyable-value { display:flex; align-items:center; gap:6px; min-width:0; }
.copyable-value code { min-width:0; overflow:hidden; color:var(--ink); font:10px ui-monospace,SFMono-Regular,Menlo,monospace; text-overflow:ellipsis; white-space:nowrap; }
.status-column .review-facts,.status-column .review-grid { grid-template-columns:1fr; }
.runtime-activity { margin-top:14px; border-radius:9px; background:#f0f7f2; padding:10px; color:#315c45; }
.runtime-activity-header { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
.runtime-activity-header strong { display:block; margin-top:2px; font-size:12px; }
.runtime-activity-state { border-radius:999px; background:#dceee2; color:#315c45; padding:2px 6px; font-size:10px; white-space:nowrap; }
.runtime-activity p { margin:8px 0 0; font-size:11px; line-height:1.45; }
.runtime-activity dl { display:grid; gap:5px; margin:8px 0 0; }
.runtime-activity dl div { display:grid; grid-template-columns:76px 1fr; gap:8px; }
.runtime-activity dt { color:#6a8a73; font-size:10px; text-transform:uppercase; }
.runtime-activity dd { margin:0; overflow-wrap:anywhere; color:#46644f; }
.runtime-activity-source { color:#6a8a73 !important; font-size:10px !important; }
.runtime-activity-ref { color:#356f9e; font:10px ui-monospace,SFMono-Regular,Menlo,monospace; }
.runtime-activity-warning { color:#8e5d21 !important; }
.task-topology { position:relative; margin-top:14px; border-top:1px solid #e5e3dd; background:transparent; padding:16px 0 0; box-shadow:none; }
.task-topology-header { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; }
.task-topology-header-actions { display:flex; align-items:center; justify-content:flex-end; gap:8px; }
.task-topology-header h4 { margin:2px 0 0; font-size:12px; }
.task-topology-header > span { color:var(--muted); font-size:10px; font-variant-numeric:tabular-nums; }
.topology-error { margin-top:8px; border-left:3px solid #b44b42; background:#fff4f2; color:#8f332d; padding:8px 10px; font-size:10px; line-height:1.45; }
.topology-projection-error { margin-top:14px; border-left:3px solid #b44b42; background:#fff4f2; color:#8f332d; padding:10px 12px; font-size:10px; line-height:1.5; }
.task-topology--error .task-topology-scroll { opacity:.45; }
.topology-zoom-controls { display:inline-grid; grid-template-columns:30px 48px 30px auto auto; align-items:stretch; overflow:hidden; border:1px solid #d2d4cd; border-radius:8px; background:#fff; box-shadow:0 1px 2px rgb(28 28 24 / .05); }
.topology-zoom-controls button { min-width:30px; height:28px; border:0; border-left:1px solid #e0e1dc; background:transparent; color:#4f514b; cursor:pointer; padding:2px 8px; font:inherit; font-size:11px; line-height:1; }
.topology-zoom-controls button:first-child { border-left:0; }
.topology-zoom-controls button:hover,.topology-zoom-controls button:focus-visible { background:#f1f2ed; color:var(--ink); outline:none; }
.topology-zoom-controls .topology-fit { min-width:42px; color:#356f9e; font-size:9px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
.topology-zoom-controls .topology-overview { min-width:64px; color:#356f9e; font-size:9px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
.topology-zoom-level { display:grid; place-items:center; min-width:48px; border-left:1px solid #e0e1dc; color:#656760; font-size:9px; font-variant-numeric:tabular-nums; text-align:center; }
.task-topology-legend { display:flex; flex-wrap:wrap; gap:5px; margin-top:10px; color:#77736b; font-size:9px; letter-spacing:.01em; }
.topology-legend { display:inline-flex; align-items:center; gap:4px; border:1px solid #dedbd3; border-radius:5px; background:#f7f6f2; padding:3px 6px; }
.topology-legend strong { color:#504d47; font-size:9px; font-weight:750; letter-spacing:.06em; text-transform:uppercase; }
.topology-legend--active { border-color:#b88a2e; background:#fff7e4; }
.topology-legend--active strong { color:#825b10; }
.topology-legend--runnable { border-style:dashed; border-color:#6a9abe; background:#f2f8fc; }
.topology-legend--runnable strong { color:#326889; }
.topology-legend--waiting { border-color:#d3d0c8; color:#8a877f; }
.topology-legend--blocked { border-color:#c45a52; background:#fff1ef; }
.topology-legend--blocked strong { color:#a03932; }
.topology-legend--cancelled { border-style:dashed; background:#f0efeb; }
.topology-legend--transferred { border-style:dashed; border-color:#9c8fc0; background:#f5f1fb; }
.topology-legend--transferred strong { color:#67538d; }
.topology-legend--critical { border-color:#9ccab0; background:#e9f4ed; }
.topology-legend--critical strong { color:#276c50; }
.topology-legend--done { border-color:#75a082; background:#eef8f1; }
.topology-legend--done strong { color:#397253; }
.topology-group-overview { margin-top:10px; border:1px solid #e8e4db; border-radius:9px; background:#fafaf7; padding:10px; }
.topology-wave-overview { padding:0; }
.topology-wave-overview > summary { list-style:none; }
.topology-wave-overview > summary::-webkit-details-marker { display:none; }
.topology-wave-overview-summary { display:flex; align-items:center; justify-content:space-between; gap:12px; cursor:pointer; padding:8px 10px; }
.topology-wave-overview-summary::before { content:"▸"; color:#77736b; font-size:9px; }
.topology-wave-overview[open] > .topology-wave-overview-summary::before { content:"▾"; }
.topology-wave-overview-summary > div { display:flex; align-items:center; gap:7px; }
.topology-wave-overview-summary strong { font-size:10px; }
.topology-wave-overview-summary > span { color:var(--muted); font-size:9px; }
.topology-wave-overview-body { border-top:1px solid #ece9e2; padding:8px 10px 10px; }
.topology-wave-overview-body .topology-group-grid { margin-top:0; }
.topology-group-overview-header { display:flex; align-items:flex-end; justify-content:space-between; gap:14px; }
.topology-group-overview-header h5 { margin:2px 0 0; font-size:12px; }
.topology-group-overview-header > span { color:var(--muted); font-size:9px; }
.topology-group-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; margin-top:9px; }
.topology-group-card { min-width:0; border:1px solid #e1ded6; border-radius:7px; background:#fff; }
.topology-group-card summary { display:grid; grid-template-columns:42px 1fr auto; align-items:center; gap:8px; cursor:pointer; padding:7px 9px; list-style:none; }
.topology-group-card summary::-webkit-details-marker { display:none; }
.topology-group-card summary::before { content:"▸"; grid-column:1; grid-row:1; color:#77736b; font-size:9px; transform:translateX(-2px); }
.topology-group-card[open] summary::before { content:"▾"; }
.topology-group-id { grid-column:1; grid-row:1; margin-left:10px; font:650 10px ui-monospace,SFMono-Regular,Menlo,monospace; }
.topology-group-range { grid-column:2; grid-row:1; color:#45463f; font-size:10px; }
.topology-group-progress { grid-column:3; grid-row:1; color:var(--muted); font-size:9px; white-space:nowrap; }
.topology-group-body { border-top:1px solid #ece9e2; padding:7px 9px 9px; }
.topology-group-metrics { display:flex; flex-wrap:wrap; gap:5px 10px; margin-bottom:6px; color:var(--muted); font-size:8px; text-transform:uppercase; }
.topology-slot-row { display:grid; grid-template-columns:54px 58px 1fr; align-items:center; gap:7px; min-height:25px; border-top:1px solid #f0eee9; }
.topology-slot-row:first-of-type { border-top:0; }
.topology-slot-row > strong { font:600 9px ui-monospace,SFMono-Regular,Menlo,monospace; }
.topology-slot-state { color:#77736b; font-size:8px; }
.topology-stage-chips { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:3px; }
.topology-stage-chip { overflow:hidden; border:1px solid #e1ded6; border-radius:999px; background:#f4f3ef; color:#666760; padding:2px 3px; font-size:8px; line-height:1; text-align:center; text-decoration:none; text-overflow:ellipsis; white-space:nowrap; }
.topology-stage-chip--active { border-color:#716e66; background:#fff; color:#262721; font-weight:650; }
.topology-stage-chip--runnable { border-color:#8a979d; border-style:dashed; background:#f7fafb; color:#526069; }
.topology-stage-chip--blocked { border-color:#ad5b54; background:#fff6f4; color:#a24f48; }
.topology-stage-chip--done { border-color:#aeb9af; background:#f2f7f2; color:#5f7261; }
.topology-stage-chip--waiting { color:#99958d; }
.topology-wave-rows { display:grid; gap:2px; }
.topology-wave-row { display:grid; grid-template-columns:54px minmax(0,1fr) auto; align-items:center; gap:7px; min-height:25px; border-top:1px solid #f0eee9; color:#555650; text-decoration:none; }
.topology-wave-row:first-child { border-top:0; }
.topology-wave-row:hover { color:var(--ink); }
.topology-wave-row strong { font:600 9px ui-monospace,SFMono-Regular,Menlo,monospace; }
.topology-wave-row span { overflow:hidden; font-size:9px; text-overflow:ellipsis; white-space:nowrap; }
.topology-wave-row em { color:#88857d; font-size:8px; font-style:normal; letter-spacing:.05em; }
.review-task-jump-status { min-height:15px; margin:6px 0 0; color:#356f9e; font-size:10px; font-weight:650; }
.review-task.is-targeted { box-shadow:inset 0 0 0 2px #356f9e, 0 4px 16px rgb(53 111 158 / .12); }
.feature-review-dialog:not([open]):not([data-open="true"]),.file-preview-dialog:not([open]):not([data-open="true"]),.claim-dialog:not([open]):not([data-open="true"]) { display:none; }
.feature-review-dialog[data-open="true"],.file-preview-dialog[data-open="true"],.claim-dialog[data-open="true"] { display:block; position:fixed; top:50%; left:50%; z-index:100; transform:translate(-50%,-50%); }
body[data-modal-fallback="true"]::before { content:""; position:fixed; inset:0; z-index:90; background:rgb(20 20 16 / .28); backdrop-filter:blur(2px); }
@media (max-width:900px) { .topology-group-grid { grid-template-columns:1fr; } }
.feature-review-dialog { width:calc(100vw - 16px); height:calc(100dvh - 16px); max-width:none; max-height:none; margin:8px auto; overflow:hidden; border:0; border-radius:16px; background:#fff; color:var(--ink); padding:0; box-shadow:0 24px 80px rgb(20 20 16 / .24); }
.feature-review-dialog::backdrop { background:rgb(20 20 16 / .36); backdrop-filter:blur(2px); }
.feature-review-dialog-shell { display:grid; grid-template-rows:auto 1fr; height:100%; }
.feature-review-dialog-header { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; padding:18px 20px 12px; border-bottom:1px solid #ecece7; }
.feature-review-dialog-header h2 { margin:2px 0 0; font-size:18px; }
.feature-review-dialog-body { min-height:0; overflow:auto; padding:0 26px 24px; }
.feature-review-dialog:focus-visible,.file-preview-dialog:focus-visible { outline:3px solid #8ba8bf; outline-offset:4px; }
.feature-review-dialog h2:focus-visible,.claim-dialog h2:focus-visible { outline:2px solid #8ba8bf; outline-offset:4px; border-radius:4px; }
.feature-review-dialog-body .review-panel { margin:0; box-shadow:none; }
.feature-review-dialog-body .review-header h3 { display:none; }
.review-task-fold-note { margin:16px 0 0; color:var(--muted); font-size:10px; }
.review-task-region { min-height:0; margin-top:14px; }
.review-tasks-scroll { max-height:min(42vh,520px); overflow:auto; overscroll-behavior:contain; scrollbar-gutter:stable; padding:1px 6px 3px 1px; }
.review-tasks { margin-top:10px; }
.review-task + .review-task { margin-top:7px; }
.review-task { scroll-margin-top:18px; border-radius:9px; background:#fff; box-shadow:inset 0 0 0 1px rgb(31 32 28 / .045); }
.review-task-summary { cursor:pointer; list-style:none; padding:8px 10px; }
.review-task-summary::-webkit-details-marker { display:none; }
.review-task-summary:focus-visible { outline:2px solid #8ba8bf; outline-offset:-2px; border-radius:9px; }
.review-task-summary h4 { margin:4px 0 0; font-size:12px; line-height:1.25; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; }
.review-task-summary .task-dependencies { margin:3px 0 0; font-size:10px; }
.review-task-toggle { display:inline-flex; align-items:center; gap:4px; margin-top:4px; color:#356f9e; font-size:10px; font-weight:600; }
.review-task[open] .review-task-toggle span { transform:rotate(180deg); }
.review-task-body { padding:0 11px 12px; }
.review-task-body > .runtime-activity { margin-top:0; }
.review-task h4 { margin:8px 0 0; font-size:14px; }
.review-copy { display:grid; grid-template-columns:70px 1fr; gap:9px; margin:7px 0 0; color:var(--muted); font-size:11px; line-height:1.5; }
.review-copy strong { color:var(--ink); font-size:10px; text-transform:uppercase; letter-spacing:.04em; }
.review-cancellation { color:#6d6e68; }
.quick-prompt-surface { margin-top:12px; border-top:1px solid #ecece7; padding-top:10px; }
.tracker-quick-prompts { display:flex; align-items:center; flex-wrap:wrap; gap:7px 10px; margin-top:8px; border-top:1px solid #e5e3dd; background:transparent; padding:8px 0 0; }
.tracker-quick-prompts > .eyebrow { margin-right:2px; }
.prompt-copy-actions { display:flex; flex-wrap:wrap; gap:5px; }
.prompt-copy-action { min-height:30px; border:1px solid #d6d8d0; border-radius:7px; background:#fff; color:#3d5f73; cursor:pointer; padding:5px 8px; font:10px/1.2 inherit; font-weight:650; }
.prompt-copy-action:hover,.prompt-copy-action:focus-visible { border-color:#8ba8bf; background:#f5f9fc; outline:2px solid #b5cad8; outline-offset:1px; }
.prompt-copy-action:disabled { cursor:wait; opacity:.58; }
.prompt-copy-status { color:#347151; font-size:10px; }
.task-quick-prompts { display:flex; align-items:center; flex-wrap:wrap; gap:7px; margin-top:10px; border-top:1px solid #ecece7; padding-top:9px; }
.task-quick-prompts > .eyebrow { margin-right:2px; }
.context-drawer { margin-top:10px; border-top:1px solid #e5e3dd; }
.context-drawer > summary { display:flex; justify-content:space-between; gap:12px; cursor:pointer; padding:9px 0; color:#545650; font-size:11px; list-style:none; }
.context-drawer > summary::-webkit-details-marker { display:none; }
.context-drawer > summary::after { content:"＋"; color:var(--muted); font-size:13px; }
.context-drawer[open] > summary::after { content:"−"; }
.context-drawer > .canonical-links { padding-top:0; }
.tracker-quick-prompts > summary { list-style:none; }
.tracker-quick-prompts > summary::-webkit-details-marker { display:none; }
.tracker-prompt-summary { display:flex; align-items:center; justify-content:space-between; gap:14px; cursor:pointer; padding:5px 0; color:#45463f; }
.tracker-prompt-summary::after { content:"＋"; flex:0 0 auto; color:#777a73; font-size:14px; }
.tracker-quick-prompts[open] > .tracker-prompt-summary::after { content:"−"; }
.tracker-prompt-summary > div { display:flex; align-items:baseline; gap:8px; }
.tracker-prompt-summary strong { color:#315c45; font-size:11px; }
.tracker-prompt-summary > span { margin-left:auto; color:var(--muted); font-size:9px; }
.tracker-prompt-body { border-radius:9px; background:#f6f8f4; padding:10px 12px 12px; }
.tracker-quick-prompts .task-prompt-heading { align-items:center; }
.task-prompt-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; color:#45463f; font-size:10px; }
.task-prompt-heading span { color:var(--muted); font-size:9px; }
.task-prompt-tabs { display:inline-flex; flex-wrap:wrap; gap:2px; margin-top:8px; border-radius:8px; background:#ebece7; padding:3px; }
.task-prompt-tab { border:0; border-radius:6px; background:transparent; color:#656760; cursor:pointer; padding:5px 8px; font:inherit; font-size:10px; }
.task-prompt-tab:hover,.task-prompt-tab:focus-visible { color:#2f6388; background:#f5f9fc; outline:none; }
.task-prompt-tab.is-active { background:#fff; color:#254f6c; font-weight:700; box-shadow:0 1px 3px rgb(28 28 24 / .12); }
.task-prompt-output { display:block; width:100%; min-height:94px; max-height:180px; margin-top:8px; resize:vertical; border:1px solid #e1e1dc; border-radius:8px; background:#fff; color:#3f413b; padding:9px; font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; }
.task-prompt-output:focus { outline:2px solid #8ba8bf; }
.task-prompt-actions { display:flex; align-items:center; gap:8px; margin-top:7px; }
.task-prompt-actions span { color:var(--muted); font-size:10px; }
.copy-quick-prompt { border:0; border-radius:7px; background:#292a27; color:#fff; cursor:pointer; padding:6px 9px; font:inherit; font-size:10px; font-weight:700; }
.copy-quick-prompt:hover,.copy-quick-prompt:focus-visible { background:#42433e; outline:2px solid #8ba8bf; outline-offset:2px; }
.review-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px; margin-top:13px; }
.review-grid h5 { margin:0 0 7px; font-size:11px; }
.acceptance-list,.verification-list { display:grid; gap:6px; margin:0; padding-left:17px; color:#555650; font-size:11px; line-height:1.45; }
.verification-list { padding:0; list-style:none; }
.verification-list li { min-width:0; }
.verification-list a,.verification-list code { color:#356f9e; overflow-wrap:anywhere; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:10px; }
.verification-list p { margin:2px 0 0; color:var(--muted); }
.verification-kind { display:inline-block; margin-right:5px; border-radius:999px; background:#e9eee9; color:#46604d; padding:1px 5px; font-size:9px; text-transform:uppercase; }
.claim-bar { display:flex; align-items:center; gap:8px; padding:0 12px 12px; }
.claim-bar span { color:var(--muted); font-size:10px; }
.claim-trigger,.dialog-action { border:0; border-radius:8px; background:#292a27; color:#fff; cursor:pointer; padding:6px 9px; font:inherit; font-size:11px; font-weight:650; }
.claim-trigger:hover,.dialog-action:hover { background:#42433e; }
.claim-dialog { width:min(760px,calc(100vw - 32px)); max-height:calc(100vh - 40px); border:0; border-radius:16px; background:#fff; color:var(--ink); padding:0; box-shadow:0 24px 80px rgb(20 20 16 / .24); }
.claim-dialog::backdrop { background:rgb(20 20 16 / .28); backdrop-filter:blur(2px); }
.claim-dialog-shell { display:grid; gap:13px; padding:20px; }
.claim-dialog-header { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; }
.claim-dialog-header h2 { margin:2px 0 0; font-size:18px; }
.dialog-close { border:0; border-radius:999px; background:#efefeb; color:var(--muted); cursor:pointer; height:30px; width:30px; font-size:17px; }
.claim-note { margin:0; color:var(--muted); font-size:12px; line-height:1.5; }
.claim-message { width:100%; min-height:300px; resize:vertical; border:0; border-radius:10px; background:#f4f4f0; color:#343530; padding:14px; font:11px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace; }
.claim-message:focus { outline:2px solid #8ba8bf; }
.claim-actions { display:flex; align-items:center; gap:8px; }
.dialog-action--secondary { background:#e8e8e3; color:#343530; }
.dialog-action--secondary:hover { background:#dcdcd5; }
.claim-status { margin-left:auto; color:var(--muted); font-size:11px; }
.file-preview-dialog { width:min(1120px,calc(100vw - 24px)); height:min(86dvh,860px); max-height:calc(100dvh - 24px); margin:12px auto; overflow:hidden; border:0; border-radius:16px; background:#fff; color:var(--ink); padding:0; box-shadow:0 24px 80px rgb(20 20 16 / .24); }
.file-preview-dialog::backdrop { background:rgb(20 20 16 / .36); backdrop-filter:blur(2px); }
.file-preview-dialog-shell { display:grid; grid-template-rows:auto 1fr; height:100%; }
.file-preview-dialog-header { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; padding:18px 20px 12px; border-bottom:1px solid #ecece7; }
.file-preview-dialog-header h2 { margin:2px 0 0; font-size:18px; }
.file-preview-dialog-header p { margin:3px 0 0; color:var(--muted); font:10px ui-monospace,SFMono-Regular,Menlo,monospace; }
.file-preview-language { display:inline-block; margin-left:8px; border-radius:4px; background:#e3e9e2; color:#526554; padding:2px 5px; font-size:8px; letter-spacing:.08em; }
.file-preview-content { min-height:0; margin:0; overflow:auto; background:#f7f7f4; color:#343530; padding:18px 20px 24px; font:11px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace; white-space:pre-wrap; overflow-wrap:anywhere; }
.file-preview-content .syntax-key { color:#7c4e16; }
.file-preview-content .syntax-string { color:#396b4a; }
.file-preview-content .syntax-number { color:#6b52a0; }
.file-preview-content .syntax-literal { color:#a03f48; font-weight:650; }
.file-preview-content .syntax-heading { color:#315c45; font-weight:750; }
.file-preview-content .syntax-punctuation { color:#8a6743; }
.file-preview-content .syntax-code { color:#6b52a0; background:#ece8f4; border-radius:3px; padding:0 2px; }
.task-status { margin-left:0; }
.task-status--failed { background:#f2e4ff; color:#71419a; }
.plan-review-observation { margin-top:14px; padding:12px 0; border-top:1px solid #e5e3dd; }
.plan-review-heading { display:flex; flex-wrap:wrap; align-items:baseline; gap:8px 16px; }
.plan-review-heading > span,.plan-review-boundary { color:var(--muted); font-size:10px; overflow-wrap:anywhere; }
.plan-review-observation ul { display:grid; gap:10px; padding:0; margin:10px 0; list-style:none; }
.plan-review-observation li { display:grid; gap:4px; font-size:11px; line-height:1.5; overflow-wrap:anywhere; }
.plan-review-observation li[data-replan-source] strong { color:#71419a; }
.plan-review-observation small { color:var(--muted); }
.plan-edge-delta { font-size:11px; line-height:1.6; }
.plan-lineage-history { margin-top:16px; border:1px solid #dce3e8; border-radius:12px; background:#f9fbfc; overflow:hidden; }
.plan-lineage-history > summary { display:flex; align-items:center; justify-content:space-between; gap:16px; cursor:pointer; padding:13px 15px; list-style:none; }
.plan-lineage-history > summary::-webkit-details-marker { display:none; }
.plan-lineage-history > summary > span:first-child { display:grid; gap:3px; }
.plan-lineage-history > summary strong { color:var(--ink); font-size:12px; }
.plan-lineage-history > summary small { color:var(--muted); font-size:10px; }
.plan-lineage-history > summary::after { content:"＋"; color:var(--muted); font-size:15px; }
.plan-lineage-history[open] > summary::after { content:"−"; }
.plan-lineage-readonly { margin-left:auto; border-radius:999px; background:#e8eef1; color:#4d6674; padding:3px 7px; font-size:9px; font-weight:700; white-space:nowrap; }
.plan-lineage-boundary { display:flex; flex-wrap:wrap; gap:5px 10px; margin:0 15px 10px; border-left:3px solid #8ca8b7; color:var(--muted); padding:7px 10px; font-size:10px; }
.plan-lineage-boundary strong { color:var(--ink); }
.plan-lineage-omitted { margin:0 15px 10px; color:var(--muted); font-size:10px; }
.plan-lineage-history > .task-topology { margin:0 12px 12px; background:var(--surface); }
.historical-task-details { margin:0 12px 12px; border-top:1px solid #dce3e8; }
.historical-task-details > summary { cursor:pointer; padding:10px 3px; color:var(--muted); font-size:10px; }
.historical-task-anchor { margin:8px 3px; color:var(--muted); font-size:10px; }
.task-topology--historical .topology-node { cursor:default; }
.failed-task-history { margin-top:14px; border-top:1px solid #e5e3dd; padding-top:10px; }
.failed-task-history > summary { cursor:pointer; color:#71419a; font-size:12px; padding:8px 0; }
.topology-node--failed .topology-node-card { fill:#f8f0fd; stroke:#8a52b5; stroke-dasharray:5 3; }
.topology-node--failed .topology-node-status-bg,.topology-legend--failed,.task-count--failed { fill:#eee0f7; background:#eee0f7; color:#71419a; }

.gate { margin-left:0; }
.review-failure { border:1px solid #dac7e8; border-radius:8px; background:#f7effd; color:#60367d; padding:9px; }
.review-blocker { border:1px solid #e7c3bf; border-radius:8px; background:#fff4f2; color:#7d342f; padding:9px; }
.closed-section { margin-top:20px; padding:0 4px; }
.closed-section summary { cursor:pointer; color:var(--muted); font-size:11px; font-weight:600; }
.closed-section summary span { font-weight:400; }
.closed-section ul { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:5px 12px; margin:10px 0 0; padding:0; list-style:none; }
.closed-section li { display:grid; grid-template-columns:auto minmax(0,1fr) auto auto auto; gap:7px; align-items:center; color:var(--muted); font-size:11px; }
.closed-section li strong { overflow:hidden; color:var(--ink); font-weight:500; text-overflow:ellipsis; white-space:nowrap; }
.closed-section li[data-feature-open] { cursor:pointer; border-radius:7px; padding:4px 5px; margin:-4px -5px; }
.closed-section li[data-feature-open]:hover { background:#fcfcfa; }
.closed-section li[data-feature-open]:focus-visible { outline:2px solid #7d9ab1; outline-offset:2px; }
.closed-open { color:#356f9e; font-size:10px; font-weight:650; white-space:nowrap; }
.closed-projection-error { color:#a23a36; font-size:10px; white-space:nowrap; }
.closed-feature--focused { border-radius:6px; outline:2px solid #9aa7a0; outline-offset:2px; }
.closed-status { color:var(--muted); }
.closed-record-note { margin:14px 0 0; color:#6d6e68; font-size:11px; }
.empty { color:var(--muted); }
@media (prefers-reduced-motion: reduce) { .review-state-signal--in-progress .review-signal-core::after,.topology-edge--activity,.topology-node-activity-ring { animation:none; } }
@media (max-width:720px) { .shell{padding:18px 12px}.page-header{align-items:flex-start;flex-direction:column}.projection-meta{justify-items:start}.projection-note{text-align:left}.metrics{gap:12px 22px}.focus-strip{grid-template-columns:1fr;gap:10px}.focus-meta{justify-items:start;text-align:left}.status-board{grid-auto-flow:row;grid-auto-columns:auto;grid-template-columns:1fr;overflow:visible;scroll-snap-type:none}.status-column{width:auto;min-width:0}.review-header,.claim-dialog-header,.feature-review-dialog-header,.file-preview-dialog-header{flex-direction:column}.canonical-links{justify-content:flex-start}.review-overview{grid-template-columns:1fr}.review-metric-strip{grid-template-columns:repeat(3,minmax(58px,1fr))}.review-metric{padding-left:7px;padding-right:7px}.review-metric strong{font-size:17px}.review-facts,.review-grid{grid-template-columns:1fr}.claim-bar{align-items:flex-start;flex-direction:column}.claim-dialog-shell{padding:15px}.claim-message{min-height:270px}.claim-actions{align-items:stretch;flex-direction:column}.claim-status{margin:0;text-align:center}.task-topology-header{align-items:flex-start;flex-direction:column}.task-topology-header-actions{justify-content:flex-start;flex-wrap:wrap}.feature-review-dialog,.file-preview-dialog{width:calc(100vw - 16px);height:calc(100vh - 16px)}.feature-review-dialog-header,.feature-review-dialog-body,.file-preview-dialog-header{padding-left:14px;padding-right:14px}.review-tasks-scroll{max-height:44vh} }

/* Low-noise outer board: empty stages remain an index row until requested. */
.status-column--empty { flex:0 0 auto; min-width:190px; padding:0; border:1px solid #d8dfce; border-radius:9px; background:transparent; }
.status-column--empty .empty-stage-toggle { display:flex; align-items:center; gap:7px; width:100%; min-height:42px; border:0; background:transparent; color:var(--ink); cursor:pointer; padding:9px 11px; text-align:left; font:650 11px/1.2 inherit; }
.status-column--empty .empty-stage-toggle:hover { background:#eef2e8; }
.status-column--empty .empty-stage-toggle:focus-visible { outline:2px solid #8ba8bf; outline-offset:-2px; border-radius:8px; }
.empty-stage-chevron { display:inline-block; color:var(--muted); font-size:17px; line-height:10px; transform:rotate(0deg); transition:transform .16s ease; }
.status-column--empty[data-empty-collapsed="false"] .empty-stage-chevron { transform:rotate(90deg); }
.empty-stage-note { margin-left:auto; color:var(--muted); font-size:9px; font-weight:500; }
.status-column--empty .feature-list { display:none; padding:0 10px 10px; }
.status-column--empty[data-empty-collapsed="false"] .feature-list { display:grid; }
.status-column--empty[data-empty-collapsed="false"] .empty-stage-note { display:none; }
@media (max-width:720px) { .status-column--empty { min-width:0; width:100%; } .empty-stage-note { display:none; } }
:root[data-theme="dark"] .status-column--empty { border-color:var(--line); }
:root[data-theme="dark"] .status-column--empty .empty-stage-toggle:hover { background:var(--soft); }
</style>
</head>
<body>
"""
    document_head = document_head.replace(
        "<title>Feature Tracker Status</title>",
        f"<title>{html_text(page_title)} Status</title>",
    )

    feature_review_dialog = r"""
<dialog class="feature-review-dialog" id="feature-review-dialog" aria-labelledby="feature-review-dialog-title">
  <div class="feature-review-dialog-shell">
    <header class="feature-review-dialog-header">
      <div><span class="eyebrow">Feature details</span><h2 id="feature-review-dialog-title" tabindex="-1" data-dialog-initial>Current plan and proof</h2></div>
      <div class="dialog-header-actions"><button type="button" class="theme-toggle" data-theme-toggle aria-label="深色模式" aria-pressed="false"><span class="theme-option theme-option--light" aria-hidden="true">☀ Light</span><span class="theme-option theme-option--dark" aria-hidden="true">☾ Dark</span></button><form method="dialog"><button class="dialog-close" aria-label="Close Feature details">×</button></form></div>
    </header>
    <div class="feature-review-dialog-body" id="feature-review-dialog-body"></div>
  </div>
</dialog>
<script>
(() => {
  const dialogApi = window.__bagakitStatusDialogs;
  const dialog = document.getElementById("feature-review-dialog");
  const body = document.getElementById("feature-review-dialog-body");
  const title = document.getElementById("feature-review-dialog-title");

  function cardFor(featureId) {
    if (!featureId) return null;
    return document.getElementById(featureId)
      || document.querySelector(`[data-closed-feature-id="${escapeSelector(featureId)}"]`);
  }

  function templateFor(card) {
    const template = card && card.querySelector(".feature-review-template");
    return template ? template.innerHTML : "";
  }

  function escapeSelector(value) {
    return typeof CSS !== "undefined" && CSS.escape
      ? CSS.escape(value)
      : value.replace(new RegExp("[^a-zA-Z0-9_-]", "g"), "\\$&");
  }

  function focusReviewTask(taskId) {
    if (!taskId) return;
    const task = body.querySelector(`#${escapeSelector(dialog.dataset.featureId + "-task-" + taskId)}`);
    if (!task) return;
    dialog.dataset.targetTaskId = taskId;
    let ancestor = task.parentElement;
    while (ancestor && ancestor !== body) {
      if (ancestor.tagName === "DETAILS") ancestor.open = true;
      ancestor = ancestor.parentElement;
    }
    task.open = true;
    body.querySelectorAll(".review-task.is-targeted, .topology-node.is-targeted, .topology-wave-row.is-targeted")
      .forEach((item) => item.classList.remove("is-targeted"));
    task.classList.add("is-targeted");
    body.querySelectorAll(`[data-task-id="${escapeSelector(taskId)}"]`)
      .forEach((item) => item.classList.add("is-targeted"));
    const jumpStatus = body.querySelector("[data-task-jump-status]");
    if (jumpStatus) jumpStatus.textContent = `已定位到 ${taskId} · 仅滚动 Task 清单`;
    const topology = body.querySelector(".task-topology");
    if (topology && window.__bagakitInspectTask) {
      window.__bagakitInspectTask(topology, task);
      return;
    }
    const scroller = task.closest(".review-tasks-scroll");
    if (scroller) {
      window.requestAnimationFrame(() => {
        const taskTop = task.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
        scroller.scrollTo({top: Math.max(0, taskTop - 8), behavior: "smooth"});
      });
    } else {
      task.scrollIntoView({behavior: "smooth", block: "nearest"});
    }
    const summary = task.querySelector("summary");
    if (summary) window.setTimeout(() => summary.focus({preventScroll: true}), 0);
  }

  function syncReviewNode(current, next) {
    if (current.nodeType !== next.nodeType || current.nodeName !== next.nodeName ||
        (current.id && next.id && current.id !== next.id)) {
      current.replaceWith(next.cloneNode(true));
      return;
    }
    if (current.nodeType === Node.TEXT_NODE) {
      if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
      return;
    }
    if (current.nodeType !== Node.ELEMENT_NODE) return;
    if (current.matches(".task-topology") && window.__bagakitSyncTopology) {
      window.__bagakitSyncTopology(current, next);
      return;
    }
    if (current.tagName === "TEMPLATE") {
      if (current.innerHTML !== next.innerHTML) current.innerHTML = next.innerHTML;
      return;
    }
    const preserve = new Set(["open"]);
    for (const attribute of [...current.attributes]) {
      if (!preserve.has(attribute.name) && !next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
    }
    for (const attribute of next.attributes) {
      if (!preserve.has(attribute.name) && current.getAttribute(attribute.name) !== attribute.value) current.setAttribute(attribute.name, attribute.value);
    }
    const oldChildren = [...current.childNodes], newChildren = [...next.childNodes];
    newChildren.forEach((child, index) => {
      if (oldChildren[index]) syncReviewNode(oldChildren[index], child);
      else current.append(child.cloneNode(true));
    });
    oldChildren.slice(newChildren.length).forEach(child => child.remove());
  }

  function openFeatureReview(featureId, taskId) {
    const card = cardFor(featureId);
    const markup = templateFor(card);
    if (!card) return;
    if (!markup && card.hasAttribute("data-closed-feature-id")) {
      const target = new URL(window.location.href);
      target.searchParams.set("feature", featureId);
      window.location.assign(target.toString());
      return;
    }
    if (!markup) return;
    const previousFeatureId = dialog.dataset.featureId;
    const preservedTaskId = previousFeatureId === featureId ? dialog.dataset.targetTaskId : "";
    dialog.dataset.featureId = featureId;
    dialog.dataset.targetTaskId = taskId || preservedTaskId || "";
    const alreadyOpen = dialogApi.isOpen(dialog);
    const fragment = document.createElement("template");
    fragment.innerHTML = markup;
    if (previousFeatureId === featureId && body.firstElementChild && fragment.content.firstElementChild) {
      syncReviewNode(body.firstElementChild, fragment.content.firstElementChild);
    } else {
      if (window.__bagakitDisposeTopology) window.__bagakitDisposeTopology(body);
      body.replaceChildren(fragment.content);
    }
    const cardTitle = card.querySelector("h3, strong");
    title.textContent = cardTitle ? cardTitle.textContent.trim() : "Feature details";
    if (!alreadyOpen) dialogApi.open(dialog);
    if (window.__bagakitBindTopologyControls) {
      try { window.__bagakitBindTopologyControls(body); }
      catch (error) {
        const status = body.querySelector("[data-edge-inspector]");
        if (status) status.textContent = "拓扑加载失败；任务详情仍可查看。请刷新页面。";
        console.error("Tracker topology initialization failed", error);
      }
    }
    if (taskId) window.setTimeout(() => focusReviewTask(taskId), 0);
  }

  function closeFeatureReview() {
    dialogApi.close(dialog);
  }

  function focusHistoryFeature(featureId) {
    if (!featureId) return;
    const item = document.querySelector(`[data-closed-feature-id="${escapeSelector(featureId)}"]`);
    if (!item) return;
    const history = item.closest("details");
    if (history) history.open = true;
    document.querySelectorAll(".closed-feature--focused").forEach((entry) => entry.classList.remove("closed-feature--focused"));
    item.classList.add("closed-feature--focused");
    item.scrollIntoView({behavior: "smooth", block: "center"});
    item.setAttribute("tabindex", "-1");
    window.setTimeout(() => item.focus({preventScroll: true}), 0);
    window.setTimeout(() => openFeatureReview(featureId), 0);
  }

  document.addEventListener("click", (event) => {
    const taskTrigger=event.target.closest("[data-task-open]");
    const taskFeature=taskTrigger?.closest("[data-feature-open]");
    if(taskFeature){event.preventDefault();openFeatureReview(taskFeature.dataset.featureOpen,taskTrigger.dataset.taskOpen);return;}
    const trigger = event.target.closest("[data-feature-open]");
    if (!trigger) return;
    if (event.target.closest("button, a")) return;
    event.preventDefault();
    openFeatureReview(trigger.dataset.featureOpen);
  });

  document.addEventListener("keydown", (event) => {
    if(event.target.closest("button,a,input,select,textarea"))return;
    const trigger = event.target.closest && event.target.closest("[data-feature-open]");
    if (!trigger || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    openFeatureReview(trigger.dataset.featureOpen);
  });

  dialog.addEventListener("click", (event) => {
    const taskLink = event.target.closest("[data-task-open]");
    if (taskLink && body.contains(taskLink)) {
      event.preventDefault();
      focusReviewTask(taskLink.dataset.taskOpen);
      return;
    }
    const node = event.target.closest(".topology-node");
    const waveRow = event.target.closest(".topology-wave-row");
    if (node && body.contains(node)) {
      event.preventDefault();
      event.stopPropagation();
      focusReviewTask(node.dataset.taskId);
      return;
    }
    if (waveRow && body.contains(waveRow)) {
      event.preventDefault();
      event.stopPropagation();
      focusReviewTask(waveRow.dataset.taskId);
      return;
    }
    if (event.target.closest(".dialog-close")) {
      event.preventDefault();
      closeFeatureReview();
    }
    const historyLink = event.target.closest("[data-feature-history-open]");
    if (historyLink && body.contains(historyLink)) {
      event.preventDefault();
      event.stopPropagation();
      focusHistoryFeature(historyLink.dataset.featureHistoryOpen);
    }
  });

  async function copyPromptAction(button) {
    const surface = button.closest(".task-quick-prompts, .tracker-quick-prompts");
    const source = surface && surface.querySelector(`[data-prompt-source="${escapeSelector(button.dataset.promptCopy || "")}"]`);
    if (!surface || !source) return;
    const text = source.content ? source.content.textContent : (source.textContent || "");
    const status = surface.querySelector(".prompt-copy-status");
    const original = button.textContent;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch (_) {}
    if (!copied) {
      const fallback = document.createElement("textarea");
      fallback.value = text;
      fallback.setAttribute("readonly", "");
      fallback.style.position = "fixed";
      fallback.style.opacity = "0";
      document.body.appendChild(fallback);
      fallback.select();
      try { copied = document.execCommand("copy"); } catch (_) {}
      fallback.remove();
    }
    button.disabled = false;
    button.removeAttribute("aria-busy");
    if (copied) {
      button.textContent = "已复制 ✓";
      if (status) status.textContent = `${button.dataset.promptLabel || original} 已复制，可直接粘贴给 Agent`;
      window.setTimeout(() => { button.textContent = original; }, 1400);
    } else {
      if (status) status.textContent = "浏览器拒绝剪贴板访问，请手动复制";
    }
  }

  document.addEventListener("click", (event) => {
    const promptButton = event.target.closest("[data-prompt-copy]");
    if (!promptButton) return;
    event.preventDefault();
    event.stopPropagation();
    copyPromptAction(promptButton);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && dialogApi.isOpen(dialog)) closeFeatureReview();
  });

  window.__bagakitOpenFeatureReview = openFeatureReview;
  window.__bagakitFocusHistoryFeature = focusHistoryFeature;
  window.__bagakitFeatureReviewTemplateFor = templateFor;
})();
</script>
"""

    file_preview_dialog = r"""
<dialog class="file-preview-dialog" id="file-preview-dialog" aria-labelledby="file-preview-dialog-title">
  <div class="file-preview-dialog-shell">
    <header class="file-preview-dialog-header">
      <div><span class="eyebrow">Canonical preview</span><h2 id="file-preview-dialog-title" tabindex="-1" data-dialog-initial>Tracker file</h2><p><span id="file-preview-dialog-ref"></span><span class="file-preview-language" id="file-preview-language">TEXT</span></p></div>
      <form method="dialog"><button class="dialog-close" aria-label="Close file preview">×</button></form>
    </header>
    <pre class="file-preview-content" id="file-preview-content"><code class="syntax-text"></code></pre>
  </div>
</dialog>
<script>
(() => {
  const dialogApi = window.__bagakitStatusDialogs;
  const dialog = document.getElementById("file-preview-dialog");
  const title = document.getElementById("file-preview-dialog-title");
  const ref = document.getElementById("file-preview-dialog-ref");
  const languageLabel = document.getElementById("file-preview-language");
  const content = document.querySelector("#file-preview-content code");
  function escapePreview(value) {
    return value.replace(/[&<>]/g, (character) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;"})[character]);
  }
  function highlightJson(value) {
    let normalized = value;
    try { normalized = JSON.stringify(JSON.parse(value), null, 2); } catch (_) {}
    return escapePreview(normalized).replace(
      /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
      (_match, stringToken, keySuffix, literal, number) => {
        if (stringToken) {
          const kind = keySuffix ? "syntax-key" : "syntax-string";
          return `<span class="${kind}">${stringToken}</span>${keySuffix || ""}`;
        }
        if (literal) return `<span class="syntax-literal">${literal}</span>`;
        return `<span class="syntax-number">${number}</span>`;
      },
    );
  }
  function highlightMarkdown(value) {
    return escapePreview(value).split("\n").map((line) => {
      const heading = line.match(/^(#{1,6})(\s+)(.*)$/);
      if (heading) return `<span class="syntax-heading"><span class="syntax-punctuation">${heading[1]}</span>${heading[2]}${heading[3]}</span>`;
      const bullet = line.match(/^(\s*)([-*+]|\d+\.)(\s+)(.*)$/);
      const base = bullet
        ? `${bullet[1]}<span class="syntax-punctuation">${bullet[2]}</span>${bullet[3]}${bullet[4]}`
        : line;
      return base.replace(/`([^`]+)`/g, '<span class="syntax-code">`$1`</span>');
    }).join("\n");
  }
  function highlightPreview(value, language) {
    if (language === "json") return highlightJson(value);
    if (language === "markdown") return highlightMarkdown(value);
    return escapePreview(value);
  }
  function closePreview() { dialogApi.close(dialog); }
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-file-preview]");
    if (trigger) {
      event.preventDefault();
      event.stopPropagation();
      const sourceTemplate = trigger.closest(".file-preview-entry")?.querySelector(".file-preview-source");
      const source = sourceTemplate?.content?.querySelector("pre");
      if (!source) return;
      const language = trigger.dataset.previewLanguage || "text";
      title.textContent = trigger.dataset.previewLabel || "Tracker file";
      ref.textContent = trigger.dataset.previewRef || "";
      languageLabel.textContent = language.toUpperCase();
      content.className = `syntax-${language}`;
      content.innerHTML = highlightPreview(source.textContent || "", language);
      dialogApi.open(dialog);
      return;
    }
    if (event.target.closest("#file-preview-dialog .dialog-close")) {
      event.preventDefault();
      closePreview();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && dialogApi.isOpen(dialog)) closePreview();
  });
})();
</script>
"""

    claim_dialog = r"""
<dialog class="claim-dialog" id="claim-dialog">
  <div class="claim-dialog-shell">
    <header class="claim-dialog-header">
      <div><span class="eyebrow">Agent claim draft</span><h2 id="claim-dialog-title" tabindex="-1" data-dialog-initial>认领 Feature</h2></div>
      <form method="dialog"><button class="dialog-close" aria-label="Close">×</button></form>
    </header>
    <p class="claim-note">这是 <code>agent-set-v1</code> 路由草稿：只告诉 Agent 去哪里恢复 SSOT，不复制 Task 或运行状态。它不认证发送者、不投递消息，也不授予 Host 或 Owner 权限。</p>
    <textarea class="claim-message" id="claim-message" readonly spellcheck="false"></textarea>
    <div class="claim-actions">
      <button type="button" class="dialog-action" id="copy-claim">复制认领消息</button>
      <button type="button" class="dialog-action dialog-action--secondary" id="share-claim">系统分享</button>
      <span class="claim-status" id="claim-status" aria-live="polite"></span>
    </div>
  </div>
</dialog>
<script>
(() => {
  const dialogApi = window.__bagakitStatusDialogs;
  const dialog = document.getElementById("claim-dialog");
  const title = document.getElementById("claim-dialog-title");
  const message = document.getElementById("claim-message");
  const status = document.getElementById("claim-status");

  function refreshTime() {
    const now = new Date().toISOString();
    message.value = message.value.replace(/ time="[^"]*"/, ` time="${now}"`);
    return message.value;
  }

  async function copyMessage() {
    const text = refreshTime();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("clipboard API unavailable");
      }
    } catch (_) {
      message.focus();
      message.select();
      document.execCommand("copy");
    }
    status.textContent = "已复制；请通过 Host 发送给目标 Agent";
  }

  async function copyTitle(button) {
    const text = button.dataset.copyText || "";
    if (!text) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("clipboard API unavailable");
      }
    } catch (_) {
      const helper = document.createElement("textarea");
      helper.value = text;
      helper.setAttribute("readonly", "");
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.appendChild(helper);
      helper.select();
      document.execCommand("copy");
      helper.remove();
    }
    const previous = button.textContent;
    button.textContent = "Copied";
    window.setTimeout(() => { button.textContent = previous; }, 1200);
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest(".copy-title, .copy-value, .copy-feature-id");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    copyTitle(button);
  });

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest(".claim-trigger");
    if (!trigger) return;
    const card = trigger.closest(".feature-card");
    const draft = card && card.querySelector(".claim-draft");
    if (!draft) return;
    title.textContent = `认领 ${trigger.dataset.featureTitle || "Feature"}`;
    message.value = draft.value;
    refreshTime();
    status.textContent = "";
    dialogApi.open(dialog);
  });

  dialog.addEventListener("click", (event) => {
    if (event.target.closest(".dialog-close")) {
      event.preventDefault();
      dialogApi.close(dialog);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && dialogApi.isOpen(dialog)) dialogApi.close(dialog);
  });

  document.getElementById("copy-claim").addEventListener("click", copyMessage);
  document.getElementById("share-claim").addEventListener("click", async () => {
    const text = refreshTime();
    if (!navigator.share) {
      await copyMessage();
      status.textContent = "当前浏览器不支持系统分享，已复制";
      return;
    }
    try {
      await navigator.share({ title: title.textContent, text });
      status.textContent = "已交给系统分享；交付与认领效果仍由 Host 确认";
    } catch (error) {
      if (error && error.name === "AbortError") return;
      await copyMessage();
      status.textContent = "系统分享失败，已复制";
    }
  });

  function focusFeature(root, autoOpen = true) {
    const content = root && root.id === "status-content"
      ? root
      : root && root.querySelector
        ? root.querySelector("#status-content")
        : document.querySelector("#status-content");
    const featureId = content && content.dataset.focusFeature;
    if (!content || !featureId) return;
    const escapedId = typeof CSS !== "undefined" && CSS.escape
      ? CSS.escape(featureId)
      : featureId.replace(new RegExp("[^a-zA-Z0-9_-]", "g"), "\\$&");
    const card = content.querySelector(`#${escapedId}`);
    if (card && card.classList.contains("feature-card")) {
      card.classList.add("feature-card--focused");
      const reviewDialog = document.getElementById("feature-review-dialog");
      const dialogApi = window.__bagakitStatusDialogs;
      if (autoOpen && window.__bagakitOpenFeatureReview &&
          !(reviewDialog && dialogApi && dialogApi.isOpen(reviewDialog))) {
        window.setTimeout(() => window.__bagakitOpenFeatureReview(featureId), 0);
      }
      window.setTimeout(() => card.scrollIntoView({block: "center", inline: "nearest"}), 0);
      return;
    }
    const closed = content.querySelector(`[data-closed-feature-id="${escapedId}"]`);
    if (closed) {
      const history = closed.closest("details");
      if (history && autoOpen) history.open = true;
      closed.classList.add("closed-feature--focused");
      window.setTimeout(() => closed.scrollIntoView({block: "center", inline: "nearest"}), 0);
      if (autoOpen && window.__bagakitOpenFeatureReview && closed.querySelector(".feature-review-template")) {
        window.setTimeout(() => window.__bagakitOpenFeatureReview(featureId), 0);
      }
    }
  }

  window.__bagakitFocusFeature = focusFeature;
  focusFeature(document);
})();
</script>
"""

    dialog_runtime = r"""
<script>
(() => {
  const dialogApi = window.__bagakitStatusDialogs = window.__bagakitStatusDialogs || {
    focusByDialog: new WeakMap(),
    syncBody() {
      const dialogs = Array.from(document.querySelectorAll("dialog"));
      const open = dialogs.some((item) => item.open === true || item.dataset.open === "true");
      const fallback = dialogs.some((item) => item.dataset.open === "true" && item.open !== true);
      document.body.dataset.modalOpen = open ? "true" : "false";
      if (fallback) document.body.dataset.modalFallback = "true";
      else delete document.body.dataset.modalFallback;
    },
    isOpen(item) {
      return Boolean(item && (item.open === true || item.dataset.open === "true"));
    },
    open(item) {
      if (!item) return;
      this.focusByDialog.set(item, document.activeElement);
      try {
        if (typeof item.showModal === "function" && !item.open) item.showModal();
        else item.dataset.open = "true";
      } catch (_) {
        item.dataset.open = "true";
      }
      item.dataset.open = "true";
      this.syncBody();
      const initial = item.querySelector("[autofocus], [data-dialog-initial], .dialog-close, button, [href], input, textarea");
      window.setTimeout(() => (initial || item).focus(), 0);
    },
    close(item) {
      if (!item) return;
      if (typeof item.close === "function" && item.open === true) item.close();
      delete item.dataset.open;
      this.syncBody();
      const restore = this.focusByDialog.get(item);
      this.focusByDialog.delete(item);
      if (restore && typeof restore.focus === "function") window.setTimeout(() => restore.focus(), 0);
    },
  };
})();
</script>
"""

    topology_controls, ui_revision = status_web_bundle()
    document_head = document_head.replace("</head>", topology_controls + "</head>")

    filter_script = r"""
<script>
(() => {
  const input = document.getElementById("status-filter-input");
  const select = document.getElementById("status-filter-select");
  const clear = document.getElementById("status-filter-clear");
  const summary = document.getElementById("status-filter-summary");
  if (!input || !select) return;

  function applyStatusFilter(root = document.getElementById("status-content")) {
    if (!root) return;
    const query = input.value.trim().toLocaleLowerCase();
    const selectedStatus = select.value;
    let visible = 0;
    root.querySelectorAll(".feature-card[data-feature-search]").forEach((card) => {
      const haystack = (card.dataset.featureSearch || "").toLocaleLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      const matchesStatus = !selectedStatus || card.dataset.featureStatus === selectedStatus;
      const shown = matchesQuery && matchesStatus;
      card.hidden = !shown;
      if (shown) visible += 1;
    });
    root.querySelectorAll(".cross-feature-card").forEach((card) => {
      card.hidden = Boolean((query && !card.textContent.toLocaleLowerCase().includes(query))
        || (selectedStatus && card.dataset.featureStatus !== selectedStatus));
    });
    root.querySelectorAll(".status-column").forEach((column) => {
      const cards = Array.from(column.querySelectorAll(".feature-card[data-feature-search]"));
      const count = column.querySelector("[data-status-count]");
      const shown = cards.filter((card) => !card.hidden).length;
      const filtered = Boolean(query || selectedStatus);
      column.classList.toggle("status-column--filtered-empty", filtered && shown === 0);
      if (count) count.textContent = String(filtered ? shown : (count.dataset.baseCount || cards.length));
    });
    const filtering = Boolean(query || selectedStatus);
    const focus = root.querySelector(".focus-strip");
    if (focus) focus.hidden = filtering;
    if (summary) summary.textContent = filtering
      ? `${visible} active Feature${visible === 1 ? "" : "s"} shown`
      : "Showing all active Features";
    if (clear) clear.hidden = !filtering;
    window.__bagakitUpdateFeatureRelations?.();
  }

  document.querySelectorAll(".empty-stage-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const column = button.closest(".status-column");
      if (!column) return;
      const collapsed = column.dataset.emptyCollapsed !== "false";
      column.dataset.emptyCollapsed = String(!collapsed);
      button.setAttribute("aria-expanded", String(collapsed));
    });
  });
  input.addEventListener("input", () => applyStatusFilter());
  select.addEventListener("change", () => applyStatusFilter());
  if (clear) clear.addEventListener("click", () => {
    input.value = "";
    select.value = "";
    input.focus();
    applyStatusFilter();
  });
  window.__bagakitApplyStatusFilter = applyStatusFilter;
  applyStatusFilter();
})();
</script>
"""

    live_script = ""
    if live:
        live_script = f"""
<script>
(() => {{
  const refreshMs = {int(refresh_ms)};
  const indicator = document.getElementById("refresh-indicator");
  const indicatorText = document.getElementById("refresh-indicator-text");
  const refreshButton = document.getElementById("refresh-now");
  const dialogApi = window.__bagakitStatusDialogs;
  let busy = false;
  let refreshTimer = null;

  function setRefreshState(kind, text) {{
    if (!indicator || !indicatorText) return;
    indicator.dataset.state = kind;
    indicatorText.textContent = text;
  }}

  function escapeSelector(value) {{
    return typeof CSS !== "undefined" && CSS.escape
      ? CSS.escape(value)
      : value.replace(new RegExp("[^a-zA-Z0-9_-]", "g"), "\\\\$&");
  }}

  function openFeatureIds() {{
    const featureDialog = document.getElementById("feature-review-dialog");
    if (!featureDialog || !dialogApi.isOpen(featureDialog)) return [];
    return featureDialog.dataset.featureId ? [featureDialog.dataset.featureId] : [];
  }}

  function restoreOpenFeatures(ids) {{
    const id = ids[0];
    if (id && window.__bagakitOpenFeatureReview) window.__bagakitOpenFeatureReview(id);
  }}

  function captureTaskDisclosure() {{
    const featureDialog = document.getElementById("feature-review-dialog");
    if (!featureDialog || !dialogApi.isOpen(featureDialog)) return null;
    const list = featureDialog.querySelector(".review-tasks-scroll");
    return {{
      open: Array.from(featureDialog.querySelectorAll(".review-task"))
        .filter((task) => task.id)
        .map((task) => ({{id: task.id, open: task.open}})),
      scrollTop: list ? list.scrollTop : 0,
    }};
  }}

  function restoreTaskDisclosure(snapshot) {{
    if (!snapshot) return;
    const featureDialog = document.getElementById("feature-review-dialog");
    if (!featureDialog) return;
    for (const item of (snapshot.open || [])) {{
      const task = featureDialog.querySelector(`#${{escapeSelector(item.id)}}`);
      if (task && task.tagName === "DETAILS") task.open = item.open === true;
    }}
    const list = featureDialog.querySelector(".review-tasks-scroll");
    if (list) list.scrollTop = Number(snapshot.scrollTop) || 0;
  }}

  function captureTopologyViews() {{
    const views = new Map();
    for (const topology of document.querySelectorAll("#feature-review-dialog-body .task-topology")) {{
      const view = window.__bagakitTopologyViews?.get(topology);
      if (view) views.set(view.key || `${{topology.dataset.featureId}}:${{topology.dataset.planRevision}}`, view);
    }}
    return views;
  }}
  function restoreTopologyViews(views) {{
    for (const topology of document.querySelectorAll("#feature-review-dialog-body .task-topology")) {{
      const view = views.get(`${{topology.dataset.featureId}}:${{topology.dataset.planRevision}}`);
      if (view) window.__bagakitTopologyViews?.restore(topology, view);
    }}
  }}

  function captureBoardScroll() {{
    const board = document.querySelector("#status-content .status-board");
    return board ? {{left: board.scrollLeft, top: board.scrollTop}} : null;
  }}

  function restoreBoardScroll(view) {{
    const board = document.querySelector("#status-content .status-board");
    if (!board || !view) return;
    const maxLeft = Math.max(0, board.scrollWidth - board.clientWidth);
    const maxTop = Math.max(0, board.scrollHeight - board.clientHeight);
    board.scrollLeft = Math.min(Math.max(0, Number(view.left) || 0), maxLeft);
    board.scrollTop = Math.min(Math.max(0, Number(view.top) || 0), maxTop);
  }}

  function projectionSignature(content) {{
    const clone = content.cloneNode(true);
    // Claim drafts receive a fresh copy-time placeholder on every server
    // render. They are not Tracker truth, so they must not make an idle poll
    // replace the visible status DOM and flash the user's context.
    clone.querySelectorAll(".claim-draft").forEach((item) => item.remove());
    return clone.innerHTML
      .replace(/<textarea[^>]*class="claim-draft"[^>]*>[\s\S]*?<\/textarea>/g, "")
      .replace(/time="[^"]*"/g, 'time=""');
  }}

  async function refreshStatus() {{
    if (busy) return;
    busy = true;
    window.clearTimeout(refreshTimer);
    try {{
      const response = await fetch(window.location.pathname + window.location.search, {{cache: "no-store"}});
      if (!response.ok) throw new Error(`status ${{response.status}}`);
      const markup = await response.text();
      const nextDocument = new DOMParser().parseFromString(markup, "text/html");
      const currentContent = document.getElementById("status-content");
      const nextContent = nextDocument.getElementById("status-content");
      if (!currentContent || !nextContent) throw new Error("status content missing");
      if (currentContent.dataset.uiRevision !== nextContent.dataset.uiRevision) {{
        // A deploy requires one full reload; never mix new markup with old JS.
        window.location.reload();
        return;
      }}
      const changed = currentContent.dataset.projectionSignature && nextContent.dataset.projectionSignature
        ? currentContent.dataset.projectionSignature !== nextContent.dataset.projectionSignature
        : projectionSignature(currentContent) !== projectionSignature(nextContent);
      if (changed) {{
        const openIds = openFeatureIds();
        const taskDisclosureBeforeRefresh = captureTaskDisclosure();
        const topologyViews = captureTopologyViews();
        const boardScroll = captureBoardScroll();
        currentContent.replaceWith(nextContent);
        if (window.__bagakitBindTopologyControls) window.__bagakitBindTopologyControls(nextContent);
        if (window.__bagakitApplyStatusFilter) window.__bagakitApplyStatusFilter(nextContent);
        restoreOpenFeatures(openIds);
        restoreTaskDisclosure(taskDisclosureBeforeRefresh);
        if (window.__bagakitFocusFeature) window.__bagakitFocusFeature(nextContent, false);
        restoreTopologyViews(topologyViews);
        restoreBoardScroll(boardScroll);
      }}
      setRefreshState(changed ? "updated" : "unchanged", changed
        ? `Updated ${{new Date().toLocaleTimeString()}}`
        : `No changes · ${{new Date().toLocaleTimeString()}}`);
    }} catch (_) {{
      setRefreshState("error", "Update failed · retrying");
    }} finally {{
      busy = false;
      refreshTimer = window.setTimeout(refreshStatus, refreshMs);
    }}
  }}

  if (refreshButton) refreshButton.addEventListener("click", refreshStatus);
  refreshStatus();
}})();
</script>
"""

    focus_attr = (
        f' data-focus-feature="{html_text(focus_feat_id)}"'
        if focus_feat_id
        else ""
    )
    return (
        document_head
        + '<div class="app-shell" data-feature-view="board"><div class="shell"><header class="page-header"><div><p>Bagakit · read-only projection</p>'
        f'<h1>{html_text(page_title)}</h1></div><div class="projection-meta"><button type="button" class="theme-toggle" data-theme-toggle aria-label="深色模式" aria-pressed="false"><span class="theme-option theme-option--light" aria-hidden="true">☀ Light</span><span class="theme-option theme-option--dark" aria-hidden="true">☾ Dark</span></button><p class="projection-note">{html_text(projection_note)}</p>'
        + (
            '<div class="refresh-control" id="refresh-indicator" data-state="idle">'
            '<i class="refresh-dot" aria-hidden="true"></i><span id="refresh-indicator-text" aria-live="polite">Connecting…</span>'
            '<button type="button" class="refresh-now" id="refresh-now">Refresh</button></div></div></header>'
            if live
            else "</div></header>"
        )
        + '<nav class="feature-view-tabs" aria-label="Feature 视图"><button type="button" data-feature-view="board" aria-pressed="true">▦ 看板</button><button type="button" data-feature-view="relations" aria-pressed="false">⌁ 依赖图</button><a href="#closed-feature-history" data-feature-history>历史记录</a></nav>'
        + '<div class="status-toolbar" role="search" aria-label="Filter Feature Tracker status">'
        + '<label for="status-filter-input">Find</label>'
        + '<input id="status-filter-input" class="status-filter-input" type="search" placeholder="Feature ID, title, or Task title" autocomplete="off">'
        + '<select id="status-filter-select" class="status-filter-select" aria-label="Filter by lifecycle status">'
        + '<option value="">All statuses</option><option value="proposal">Proposal</option><option value="ready">Ready</option>'
        + '<option value="in_progress">In progress</option><option value="replanning">Replanning</option>'
        + '<option value="blocked">Blocked</option><option value="done">Needs closeout</option></select>'
        + '<button type="button" class="status-filter-clear" id="status-filter-clear">Clear</button>'
        + '<span class="status-filter-summary" id="status-filter-summary" aria-live="polite"></span></div>'
        + f'<div id="status-content"{focus_attr} data-projection-signature="{projection_signature}" data-ui-revision="{ui_revision}">'
        + focus_html
        + '<section class="metrics" aria-label="Feature summary">'
        f'<div class="metric"><strong>{open_count}</strong><span>Open</span></div>'
        f'<div class="metric"><strong>{in_progress_count}</strong><span>In progress</span></div>'
        f'<div class="metric"><strong>{replanning_count}</strong><span>Replanning</span></div>'
        f'<div class="metric"><strong>{blocked_count}</strong><span>Blocked</span></div>'
        f'<div class="metric"><strong>{closeout_count}</strong><span>Needs closeout</span></div>'
        "</section>"
        + board_html
        + render_closed_features_html(paths, closed_items, focus_feat_id=focus_feat_id)
        + "</div></div></div>"
        + dialog_runtime
        + feature_review_dialog
        + file_preview_dialog
        + claim_dialog
        + filter_script
        + live_script
        + "</body></html>"
    )


def cmd_serve_feature_status(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    refresh_ms = max(1000, min(int(args.refresh_ms), 60000))
    requested_feature = str(args.feat or "").strip() or None
    status_web_bundle()

    class StatusHandler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            if parsed.path not in {POSIX_SEP, POSIX_SEP + "status"}:
                self.send_error(404)
                return
            raw_feature = parse_qs(parsed.query).get("feature", [requested_feature])[0]
            query_feature = str(raw_feature or "").strip() or None
            try:
                document = render_feature_status_html(
                    paths,
                    feat_id=query_feature,
                    live=True,
                    refresh_ms=refresh_ms,
                )
            except SystemExit as exc:
                body = html.escape(str(exc)).encode("utf-8")
                self.send_response(404)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            body = document.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store, max-age=0")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, _format: str, *_args: Any) -> None:
            return

    server = ThreadingHTTPServer(("127.0.0.1", args.port), StatusHandler)
    url = f"http://127.0.0.1:{server.server_port}/"
    if requested_feature:
        url += f"?feature={requested_feature}"
    print(f"status_server: {url}", flush=True)
    print("status_server: read-only; press Ctrl-C to stop", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("status_server: stopped")
    finally:
        server.server_close()
    return 0


TERMINAL_FRONTIER_GLYPHS = {
    "active": "▶",
    "runnable": "●",
    "waiting": "○",
    "blocked": "✕",
    "failed": "!",
    "cancelled": "⊘",
    "transferred": "⇢",
    "done": "✓",
}
TERMINAL_FRONTIER_COLORS = {
    "active": "33",
    "runnable": "32",
    "waiting": "36",
    "blocked": "31",
    "failed": "35",
    "cancelled": "90",
    "transferred": "35",
    "done": "90",
}


def terminal_projection_signature(paths: HarnessPaths) -> str:
    """Opaque signature of the canonical inputs a terminal projection renders.

    Derived from tracker content only. Physical identity such as mtime or inode
    is excluded, so rewriting a file with identical bytes is not a change.
    """
    digest = hashlib.sha256()
    for feat_dir in sorted(paths.feats_dir.glob("*")):
        if not feat_dir.is_dir():
            continue
        for name in ("state.json", "tasks.json"):
            candidate = feat_dir / name
            if not candidate.exists():
                continue
            digest.update(feat_dir.name.encode("utf-8"))
            digest.update(name.encode("utf-8"))
            try:
                digest.update(candidate.read_bytes())
            except OSError:
                digest.update(b"<unreadable>")
    return digest.hexdigest()[:12]


def render_terminal_feature_lines(
    state: dict[str, Any],
    tasks: dict[str, Any],
    *,
    expand: bool,
    width: int,
) -> list[str]:
    """One Feature as terminal lines, derived only from canonical projections."""

    def paint(text: str, code: str) -> str:
        return f"\x1b[{code}m{text}\x1b[0m"

    feat_id = str(state.get("feat_id") or "")
    lines = [f"\x1b[1m{feat_id}\x1b[0m  {str(state.get('title') or '')[:max(12, width - 16)]}"]

    projection_error = str(state.get("_projection_error") or "").strip()
    if projection_error:
        # Same contract as the HTML repair-needed card: one malformed record
        # must not hide the rest of the board, and must not read as inactive.
        lines.append(f"  {paint('repair needed', '31')} {projection_error[:max(12, width - 20)]}")
        lines.append("  \x1b[2mrun validate-tracker for the strict diagnosis\x1b[0m")
        return lines

    lines.append(
        f"  {paint(str(state.get('status') or '?'), '34')}"
        f"  \x1b[2mplan r{tasks.get('plan_revision', '?')}"
        f" · {tasks.get('plan_status', '?')}"
        f" · round {(state.get('counters') or {}).get('round_count', '?')}\x1b[0m"
    )

    frontier = feature_task_frontier(state, tasks)
    total = sum(len(frontier[group]) for group, _ in TASK_FRONTIER_LABELS)
    if not total:
        return lines

    bar_width = min(34, max(8, width - 18))
    bar = "".join(
        paint("█" * max(1, round(len(frontier[group]) / total * bar_width)),
              TERMINAL_FRONTIER_COLORS[group])
        for group in ("done", "active", "runnable", "waiting", "blocked", "failed", "cancelled", "transferred")
        if frontier[group]
    )
    done_count = len(frontier["done"])
    lines.append(
        f"  {bar} \x1b[1m{round(done_count / total * 100)}%\x1b[0m"
        f" \x1b[2m{done_count}/{total}\x1b[0m"
    )
    tally = "  ".join(
        paint(f"{TERMINAL_FRONTIER_GLYPHS[group]} {len(frontier[group])} {label.lower()}",
              TERMINAL_FRONTIER_COLORS[group])
        for group, label in TASK_FRONTIER_LABELS
        if group != "done" and frontier[group]
    )
    if tally:
        lines.append("  " + tally)

    gate = state.get("gate") or {}
    if gate.get("last_result"):
        result = str(gate["last_result"])
        lines.append(
            f"  gate {paint(result, '32' if result == 'pass' else '31')}"
            f" \x1b[2mon {gate.get('last_task_id', '?')}\x1b[0m"
        )
    counters = state.get("counters") or {}
    if counters.get("gate_fail_streak") or counters.get("no_progress_rounds"):
        lines.append(
            f"  {paint('!', '33')} fail streak {counters.get('gate_fail_streak', 0)}"
            f" · no-progress {counters.get('no_progress_rounds', 0)}"
        )

    by_id, layers = task_topology_layers(tasks, feat_id=feat_id)
    group_by_id = {
        task_id: group
        for group, _ in TASK_FRONTIER_LABELS
        for task_id in frontier[group]
    }

    for task_id in frontier["active"]:
        title = str(by_id.get(task_id, {}).get("title") or "")
        lines.append(f"  {paint('▶ active', '33')} {task_id} {title[:max(12, width - 22)]}")
        blocker = (by_id.get(task_id, {}).get("last_blocker") or {})
        if blocker.get("class"):
            lines.append(f"      \x1b[2mblocker: {blocker['class']}\x1b[0m")
    for task_id in frontier["failed"]:
        task = by_id.get(task_id, {})
        failure = task.get("failure") if isinstance(task.get("failure"), dict) else {}
        lines.append(
            f"  {paint('! failed · replan', '35')} {task_id} "
            f"{str(failure.get('reason') or 'assumption disproved')[:max(12, width - 34)]}"
        )
    if frontier["runnable"]:
        lines.append(f"  {paint('● runnable', '32')} {' '.join(frontier['runnable'])}")
    elif not frontier["active"]:
        lines.append("  \x1b[2mnothing runnable\x1b[0m")

    if not expand:
        return lines

    lines.append("  \x1b[1mtopology\x1b[0m \x1b[2mL0 = no unmet parents\x1b[0m")
    for depth, members in enumerate(layers):
        visible = [task_id for task_id in members if group_by_id.get(task_id) != "done"]
        if not visible:
            continue
        lines.append(f"  \x1b[2mL{depth}\x1b[0m")
        for task_id in visible:
            group = group_by_id.get(task_id, "waiting")
            dependencies = canonical_task_dependencies(
                by_id[task_id],
                label=f"{feat_id}/{task_id}",
            )
            unmet = [
                dependency for dependency in dependencies
                if str(by_id[dependency].get("status") or "") != "done"
            ]
            if unmet:
                edge = f" \x1b[2m⇠{','.join(unmet)}\x1b[0m"
            elif dependencies:
                edge = " \x1b[90m⇠done\x1b[0m"
            else:
                edge = ""
            title = str(by_id[task_id].get("title") or "")
            lines.append(
                f"    {paint(TERMINAL_FRONTIER_GLYPHS[group], TERMINAL_FRONTIER_COLORS[group])}"
                f" {task_id} {title[:max(12, width - 30)]}{edge}"
            )
    return lines


def render_terminal_status_frame(
    paths: HarnessPaths,
    *,
    feat_id: str | None,
    width: int,
) -> list[str]:
    """The whole board as terminal lines, from the same canonical index the page reads."""
    focus = str(feat_id or "").strip() or None
    lines = ["\x1b[1;35mfeature observation\x1b[0m  \x1b[2mread-only\x1b[0m"]
    active_records: list[tuple[dict[str, Any], dict[str, Any]]] = []
    for item in load_index(paths).get("features", []):
        status = str(item.get("status") or "")
        if status in CLOSED_FEAT_STATUS:
            continue
        item_feat_id = str(item.get("feat_id") or "")
        try:
            state, tasks = load_feat(paths, item_feat_id)
        except SystemExit as exc:
            state = {
                "feat_id": item_feat_id,
                "title": item.get("title") or item_feat_id,
                "status": status,
                "_projection_error": normalize_error_text(exc),
            }
            tasks = {"tasks": []}
        active_records.append((state, tasks))

    if not active_records:
        lines.append("\x1b[2mno active features\x1b[0m")
        return lines

    order = {status: index for index, status in enumerate(FEATURE_STATUS_ORDER)}
    active_records.sort(
        key=lambda record: (
            order.get(str(record[0].get("status") or ""), len(order)),
            str(record[0].get("feat_id") or ""),
        )
    )
    for state, tasks in active_records:
        lines.append("")
        lines.extend(
            render_terminal_feature_lines(
                state,
                tasks,
                expand=(focus is None or str(state.get("feat_id") or "") == focus),
                width=width,
            )
        )
    return lines


def cmd_watch_feature_status(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    refresh_ms = max(1000, min(int(args.refresh_ms), 60000))
    focus = str(args.feat or "").strip() or None
    if focus:
        # Fail closed on an invalid id before entering the render loop.
        load_feat(paths, focus)

    delay = refresh_ms / 1000
    previous_signature = ""
    changed_at = ""
    last_good: list[str] = []
    while True:
        width = shutil.get_terminal_size((80, 24)).columns
        stamp = datetime.now().strftime("%H:%M:%S")
        try:
            signature = terminal_projection_signature(paths)
            if previous_signature and signature != previous_signature:
                changed_at = stamp
            previous_signature = signature
            body = render_terminal_status_frame(paths, feat_id=focus, width=width)
            last_good = body
            footer = f"\x1b[2mupdated {stamp} · refresh {delay:g}s · ^C to stop\x1b[0m"
            if changed_at:
                footer = f"\x1b[35mchanged {changed_at}\x1b[0m  " + footer
        except KeyboardInterrupt:
            raise
        except Exception as exc:  # noqa: BLE001 - a transient read must not blank the pane
            body = last_good or ["\x1b[31mno readable projection yet\x1b[0m"]
            footer = (
                f"\x1b[31mupdate failed {stamp} · retrying"
                f" ({type(exc).__name__})\x1b[0m"
            )
        sys.stdout.write("\x1b[H\x1b[2J\x1b[3J" + "\n".join(body + ["", footer]) + "\n")
        sys.stdout.flush()
        try:
            time.sleep(delay)
        except KeyboardInterrupt:
            break
    return 0


def cmd_feat_status(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)

    if args.output and args.format != "html":
        raise SystemExit("error: --output requires --format html")

    if args.format == "html":
        document = render_feature_status_html(paths, feat_id=args.feat)
        if not args.output:
            print(document)
            return 0

        output_path = Path(args.output).expanduser()
        if not output_path.is_absolute():
            output_path = root / output_path
        output_path = output_path.resolve()
        try:
            output_path.relative_to(paths.harness_dir.resolve())
        except ValueError:
            pass
        else:
            raise SystemExit("error: human status output must stay outside tracker state")
        write_bytes_atomic(output_path, document.encode("utf-8"))
        print(f"status_page: {output_path.as_uri()}")
        return 0

    if args.feat:
        state, tasks = load_feat(paths, args.feat)
        frontier = feature_task_frontier(state, tasks)
        payload = {
            "feature": state,
            "tasks": tasks,
            "task_frontier": frontier,
            "plan_audit": build_task_plan_audit(state, tasks),
        }
        if args.json:
            print(json.dumps(payload, ensure_ascii=False, indent=2))
            return 0
        print(f"feature_id: {state['feat_id']}")
        print(f"title: {state.get('title', '')}")
        print(f"status: {state.get('status', '')}")
        print(f"workspace_mode: {state.get('workspace_mode', '')}")
        print(f"branch: {state.get('branch', '')}")
        print(f"worktree: {state.get('worktree_path', '')}")
        print(f"active_tasks: {','.join(frontier['active']) or 'none'}")
        print(f"runnable_tasks: {','.join(frontier['runnable']) or 'none'}")
        task_count_text = (
            "tasks: "
            f"todo={count_current_tasks(tasks, 'todo')} "
            f"in_progress={count_current_tasks(tasks, 'in_progress')} "
            f"done={count_current_tasks(tasks, 'done')} "
            f"blocked={count_current_tasks(tasks, 'blocked')}"
        )
        cancelled_count = count_current_tasks(tasks, "cancelled")
        if cancelled_count:
            task_count_text += f" cancelled={cancelled_count}"
        transferred_count = count_current_tasks(tasks, "transferred")
        if transferred_count:
            task_count_text += f" transferred={transferred_count}"
        print(task_count_text)
        return 0

    if args.json:
        print(json.dumps({"features": feats}, ensure_ascii=False, indent=2))
        return 0

    if not feats:
        print("no features")
        return 0

    print("feature_id	status	workspace	title	branch")
    for item in feats:
        print(
            f"{item.get('feat_id','')}\t{item.get('status','')}\t{item.get('workspace_mode','')}\t"
            f"{item.get('title','')}\t{item.get('branch','')}"
        )
    return 0


def cmd_task_start(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    ensure_git_repo(root)
    state, tasks = load_feat(paths, args.feat)
    try:
        require_reviewed_task_plan(tasks, feat_id=args.feat, action="task start")
    except SystemExit as exc:
        eprint(str(exc))
        return 1
    workspace_mode = workspace_mode_of(state)
    if workspace_mode == "proposal_only":
        recommended_mode, reason = recommend_workspace_mode(root)
        next_cmd = (
            "feature-tracker.sh assign-feature-workspace "
            f"--root {shlex.quote(str(root))} --feature {args.feat} --workspace-mode {recommended_mode}"
        )
        alternative = (
            "feature-tracker.sh assign-feature-workspace "
            f"--root {shlex.quote(str(root))} --feature {args.feat} "
            f"--workspace-mode {'worktree' if recommended_mode == 'current_tree' else 'current_tree'}"
        )
        eprint(
            f"error: feat {args.feat} is proposal_only; "
            "assign a workspace first with feature-tracker.sh assign-feature-workspace"
        )
        print(f"recommendation: {recommended_mode} ({reason})")
        print(f"next: {next_cmd}")
        print(f"alternative: {alternative}")
        return 1

    task_id = args.task
    if not TASK_ID_RE.fullmatch(task_id):
        eprint(f"error: invalid task id: {task_id}")
        return 1
    if task_id not in set(latest_plan_task_ids(tasks)):
        eprint(f"error: task {task_id} is not part of the current reviewed task plan")
        return 1

    target = find_task(tasks, task_id)
    if target.get("superseded_by"):
        eprint(f"error: task {task_id} has been superseded and cannot be restarted")
        return 1
    if target.get("status") not in {"todo", "blocked"}:
        eprint(f"error: task {task_id} cannot be started from status={target.get('status')}")
        return 1

    by_id, _ = current_plan_task_graph(tasks, feat_id=args.feat)
    unfinished_dependencies = [
        dependency
        for dependency in canonical_task_dependencies(
            target,
            label=f"{args.feat}/{task_id}",
        )
        if str(by_id[dependency].get("status") or "") != "done"
    ]
    if unfinished_dependencies:
        eprint(
            f"error: task {task_id} is not runnable; unfinished dependencies: "
            + ", ".join(unfinished_dependencies)
        )
        return 1

    try:
        task_verification_commands(target, feat_id=args.feat)
    except SystemExit as exc:
        eprint(str(exc))
        return 1

    resolve_feature_execution_root(root, state)
    if target.get("status") == "blocked":
        target["gate_result"] = None
        target["last_gate_commands"] = []
        target.pop("last_gate_context", None)
        gate = state.get("gate")
        if isinstance(gate, dict) and str(gate.get("last_task_id") or "") == task_id:
            gate.pop("last_context", None)
    target["status"] = "in_progress"
    state.setdefault("history", []).append(
        history_event("task_started", task_id)
    )
    save_feat(paths, args.feat, state, tasks)
    print(f"ok: task started {args.feat}/{task_id}")
    return 0


def cmd_task_unstart(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    ensure_git_repo(root)
    state, tasks = load_feat(paths, args.feat)
    try:
        load_current_owner_receipt(paths, state, tasks)
    except SystemExit as exc:
        eprint(str(exc))
        return 1
    task = find_task(tasks, args.task)

    if task.get("status") != "in_progress":
        eprint(f"error: task is not in_progress: {args.task}")
        return 1
    if task_has_unstart_evidence(paths, state, task, args.task):
        eprint(f"error: task has execution evidence and cannot be unstarted: {args.task}")
        return 1
    try:
        execution = resolve_feature_execution_root(root, state)
    except SystemExit as exc:
        eprint(str(exc))
        return 1

    try:
        changes = non_harness_git_status_lines(execution.path)
    except SystemExit as exc:
        eprint(str(exc))
        return 1
    if changes:
        eprint(f"error: feature execution worktree is dirty: {execution.path}")
        return 1

    head = run_cmd(["git", "-C", str(execution.path), "rev-parse", "HEAD"])
    if head.returncode != 0:
        eprint(head.stderr.strip() or head.stdout.strip() or "git rev-parse HEAD failed")
        return 1
    actual_head = head.stdout.strip()
    if actual_head != args.expected_head:
        eprint(
            "error: feature execution HEAD conflict: "
            f"expected {args.expected_head}, current {actual_head}"
        )
        return 1

    try:
        final_changes = non_harness_git_status_lines(execution.path)
    except SystemExit as exc:
        eprint(str(exc))
        return 1
    final_head = run_cmd(["git", "-C", str(execution.path), "rev-parse", "HEAD"])
    if final_head.returncode != 0:
        eprint(final_head.stderr.strip() or final_head.stdout.strip() or "git rev-parse HEAD failed")
        return 1
    if final_changes or final_head.stdout.strip() != actual_head:
        eprint(f"error: feature execution Git state changed during task unstart: {execution.path}")
        return 1

    task["status"] = "todo"
    state.setdefault("history", []).append(history_event("task_unstarted", args.task))
    save_feat(paths, args.feat, state, tasks)
    print(f"ok: task unstarted {args.feat}/{args.task}")
    print(f"feat_status: {state['status']}")
    return 0


def detect_project_type(root: Path, config: dict[str, Any]) -> str:
    gate_cfg = runtime_gate_config(config)
    explicit_value = gate_cfg.get("project_type", "auto")
    if not isinstance(explicit_value, str):
        raise SystemExit("error: gate.project_type must be auto, ui, or non_ui")
    explicit = explicit_value.strip()
    if explicit in {"ui", "non_ui"}:
        return explicit
    if explicit != "auto":
        raise SystemExit("error: gate.project_type must be auto, ui, or non_ui")

    rules = gate_cfg.get("project_type_rules", {})
    if not isinstance(rules, dict):
        raise SystemExit("error: gate.project_type_rules must be an object")
    ui_rules = rules.get("ui", {})
    non_ui_rules = rules.get("non_ui", {})
    default_type = rules.get("default", "non_ui")
    if default_type not in {"ui", "non_ui"}:
        raise SystemExit("error: gate.project_type_rules.default must be ui or non_ui")

    def matches(rule_set: Any, *, label: str) -> bool:
        if not isinstance(rule_set, dict):
            raise SystemExit(f"error: gate.project_type_rules.{label} must be an object")
        matched = False
        for field in ("any_path_exists", "all_paths_exist"):
            paths = rule_set.get(field, [])
            if not isinstance(paths, list) or any(
                not isinstance(rel, str) or not rel.strip() for rel in paths
            ):
                raise SystemExit(
                    f"error: gate.project_type_rules.{label}.{field} must be a list of non-empty paths"
                )
            if field == "any_path_exists" and paths:
                matched = matched or any((root / rel).exists() for rel in paths)
            if field == "all_paths_exist" and paths:
                matched = matched or all((root / rel).exists() for rel in paths)
        return matched

    if matches(ui_rules, label="ui"):
        return "ui"
    if matches(non_ui_rules, label="non_ui"):
        return "non_ui"
    return default_type


def task_verification_commands(task: dict[str, Any], *, feat_id: str) -> list[str]:
    """Return the executable verification declared by the current Task.

    Runtime policy describes tracker behavior (for example whether the
    optional Feature-level verification note is required). It must not choose
    a task's completion command: that meaning belongs to the reviewed Task
    plan. Non-command mappings remain evidence for a human or another owner
    and are intentionally not executed by this command.
    """
    task_id = str(task.get("id") or "<unknown>")
    verification = task.get("verification")
    if not isinstance(verification, list):
        raise SystemExit(f"error: {feat_id}/{task_id}: verification must be a list")
    commands: list[str] = []
    for index, mapping in enumerate(verification):
        if not isinstance(mapping, dict):
            raise SystemExit(
                f"error: {feat_id}/{task_id}: verification[{index}] must be an object"
            )
        if mapping.get("kind") != "command":
            continue
        command = mapping.get("ref")
        if not isinstance(command, str) or not command.strip():
            raise SystemExit(
                f"error: {feat_id}/{task_id}: verification[{index}].ref must be a non-empty command"
            )
        command = command.strip()
        if command in {"package.json", "./package.json", "../package.json"} or command.endswith("/package.json"):
            raise SystemExit(
                f"error: {feat_id}/{task_id}: verification[{index}].ref points to package.json, "
                "which is not executable; use a command such as 'npm test' or move the path to an artifact mapping"
            )
        commands.append(command)
    if not commands:
        raise SystemExit(
            f"error: {feat_id}/{task_id}: reviewed Task gate requires at least one "
            "verification mapping with kind=command; add the Task's executable proof "
            "to tasks.json instead of relying on runtime-policy gate commands"
        )
    return commands


def git_head_sha(path: Path) -> str:
    cp = run_cmd(["git", "-C", str(path), "rev-parse", "HEAD"])
    if cp.returncode != 0 or not cp.stdout.strip():
        raise SystemExit(f"error: cannot resolve candidate HEAD for gate freshness: {path}")
    return cp.stdout.strip()


def git_status_digest(path: Path) -> str:
    # Raw diff metadata gives unstaged files zero object ids: two different
    # edits can look identical. Hash content, excluding mutable Tracker state.
    cp = subprocess.run(
        ["git", "-C", str(path), "diff", "--binary", "--no-ext-diff",
         "--no-textconv", "--no-renames", "HEAD", "--", ".",
         ":(exclude).bagakit/feature-tracker/**", ":(exclude).worktrees/**"],
        capture_output=True, check=False,
    )
    if cp.returncode != 0:
        raise SystemExit(f"error: cannot resolve candidate worktree diff for gate freshness: {path}")
    return sha256_bytes(cp.stdout)


def task_gate_context(
    root: Path,
    state: dict[str, Any],
    execution: FeatureExecutionRoot,
    task: dict[str, Any],
    commands: list[str],
    *,
    feat_id: str,
    plan_revision: int | None = None,
) -> dict[str, Any]:
    """Bind a gate receipt to its exact candidate and reviewed inputs."""
    verification_file = HarnessPaths(root).feat_verification(
        feat_id, status=str(state.get("status") or "")
    )
    verification_digest = sha256_file(verification_file) if verification_file.is_file() else "none"
    artifact_digests = {}
    for mapping in task["verification"]:
        if mapping["kind"] != "artifact":
            continue
        ref = mapping["ref"]
        artifact = (execution.path / ref.split("#", 1)[0]).resolve()
        if not artifact.is_relative_to(execution.path.resolve()):
            raise SystemExit(f"error: Task artifact escapes execution workspace: {ref}")
        artifact_digests[ref] = sha256_file(artifact) if artifact.is_file() else "unavailable"
    candidate_sha = git_head_sha(execution.path)
    worktree_digest = git_status_digest(execution.path)
    if plan_revision is None:
        plan_revision = task.get("introduced_in_revision")
    if not isinstance(plan_revision, int) or isinstance(plan_revision, bool):
        plan_revision = 0
    material = {
        "task_id": str(task.get("id") or ""),
        "task_contract": {key: task.get(key) for key in
                          ("objective", "outcome", "acceptance", "verification", "depends_on")},
        "candidate_sha": candidate_sha,
        "worktree_digest": worktree_digest,
        "verification_digest": verification_digest,
        "gate_policy": runtime_gate_config(load_runtime_policy(HarnessPaths(root))),
        "execution_root": relative_display(root, execution.path),
        "commands": commands,
        "runner": "feature-tracker.run-task-gate",
    }
    source_key = sha256_bytes(
        json.dumps(material, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    )
    # Artifact mappings may name outputs produced by the gate. Bind their
    # final bytes for reuse, but do not reject their creation during execution.
    dedup_key = sha256_bytes(json.dumps(
        [source_key, artifact_digests], sort_keys=True, separators=(",", ":")
    ).encode("utf-8"))
    return {
        "candidate_sha": candidate_sha,
        "worktree_digest": worktree_digest,
        "verification_digest": verification_digest,
        "dedup_key": dedup_key,
        "source_key": source_key,
        "artifact_digests": artifact_digests,
        "plan_revision": plan_revision,
    }


def require_task_gate_receipt(
    task: dict[str, Any],
    *,
    feat_id: str,
    root: Path | None = None,
    state: dict[str, Any] | None = None,
    plan_revision: int | None = None,
) -> None:
    commands = task_verification_commands(task, feat_id=feat_id)
    records = task.get("last_gate_commands")
    if not isinstance(records, list):
        raise SystemExit(
            f"error: {feat_id}/{task.get('id')}: cannot finish task as done without "
            "a Task verification gate receipt; run run-task-gate again"
        )
    recorded_commands = [
        record.get("command")
        for record in records
        if isinstance(record, dict)
    ]
    if recorded_commands != commands or len(recorded_commands) != len(records):
        raise SystemExit(
            f"error: {feat_id}/{task.get('id')}: gate receipt does not match the "
            "current Task verification commands; run run-task-gate again"
        )
    if any(
        not isinstance(record, dict)
        or record.get("status") != "pass"
        or record.get("exit_code") != 0
        for record in records
    ):
        raise SystemExit(
            f"error: {feat_id}/{task.get('id')}: cannot finish task as done with a "
            "non-passing Task verification receipt"
        )
    context = task.get("last_gate_context")
    if root is None or state is None:
        if not isinstance(context, dict):
            raise SystemExit(
                f"error: {feat_id}/{task.get('id')}: gate receipt has no candidate context; "
                "run run-task-gate again"
            )
        return
    if not isinstance(context, dict):
        raise SystemExit(
            f"error: {feat_id}/{task.get('id')}: gate receipt has no candidate context; "
            "run run-task-gate again"
        )
    execution = resolve_feature_execution_root(root, state)
    current = task_gate_context(
        root,
        state,
        execution,
        task,
        commands,
        feat_id=feat_id,
        plan_revision=plan_revision,
    )
    context_keys = (
        "candidate_sha",
        "worktree_digest",
        "verification_digest",
        "dedup_key",
    )
    if any(context.get(key) != current.get(key) for key in context_keys):
        raise SystemExit(
            f"error: {feat_id}/{task.get('id')}: gate receipt is stale for the current "
            "candidate or worktree; run run-task-gate again"
        )


def reject_retired_gate_commands(config: dict[str, Any]) -> None:
    gate_cfg = runtime_gate_config(config)
    retired = [name for name in ("ui_commands", "non_ui_commands") if name in gate_cfg]
    if retired:
        names = ", ".join(f"gate.{name}" for name in retired)
        raise SystemExit(
            f"error: {names} are retired; move completion commands to "
            "tasks.json verification entries with kind=command"
        )


def resolve_verification_policy(config: dict[str, Any]) -> str:
    gate_cfg = runtime_gate_config(config)
    raw = str(gate_cfg.get("verification_policy", "on_demand")).strip().lower()
    allowed = {"never", "on_demand", "auto_ui", "required"}
    if raw not in allowed:
        raise SystemExit(
            "error: invalid gate.verification_policy: "
            f"{raw}. expected one of {', '.join(sorted(allowed))}"
        )
    return raw


def verification_required(policy: str, *, project_type: str, evidence_file: Path) -> bool:
    if policy == "never":
        return False
    if policy == "required":
        return True
    if policy == "auto_ui":
        return project_type == "ui" or evidence_file.exists()
    return evidence_file.exists()


def validate_verification_evidence(evidence_file: Path) -> list[str]:
    errors: list[str] = []
    if not evidence_file.exists():
        return [f"missing verification file: {evidence_file}"]
    try:
        text = read_text(evidence_file)
    except (OSError, UnicodeError) as exc:
        return [f"invalid verification evidence: {normalize_error_text(exc)}"]

    lines = text.splitlines()
    headings = ("## Automated Checks", "## Manual Checks", "## Residual Risks")
    heading_positions: list[int] = []
    for heading in headings:
        positions = [index for index, line in enumerate(lines) if line.strip() == heading]
        if not positions:
            errors.append(f"missing heading in verification evidence: {heading}")
        else:
            heading_positions.append(positions[0])
    if errors:
        return errors
    if heading_positions != sorted(heading_positions):
        return ["verification evidence headings must use canonical order"]

    automated_start, manual_start, residual_start = heading_positions
    sections = {
        "Command": lines[automated_start + 1 : manual_start],
        "Result": lines[automated_start + 1 : manual_start],
        "Step": lines[manual_start + 1 : residual_start],
        "Outcome": lines[manual_start + 1 : residual_start],
    }
    placeholder_labels = ("Command", "Result", "Step", "Outcome")
    values: dict[str, list[str]] = {label: [] for label in placeholder_labels}
    for label, section_lines in sections.items():
        prefix = f"- {label}:"
        for line in section_lines:
            stripped = line.strip()
            if stripped.startswith(prefix):
                value = stripped[len(prefix) :].strip()
                if not value:
                    errors.append(f"blank verification evidence field: {label}")
                values[label].append(value)
    placeholder_tokens = {"todo", "tbd", "pending", "unknown", "n/a"}

    def substantive(value: str) -> bool:
        normalized = unicodedata.normalize("NFKC", value).strip().casefold()
        normalized = re.sub(r"^[\W_]+|[\W_]+$", "", normalized)
        return normalized not in placeholder_tokens and any(
            character.isalnum() for character in normalized
        )

    if not any(
        substantive(value)
        for label in ("Result", "Outcome")
        for value in values[label]
        if value
    ):
        errors.append("verification evidence requires a substantive Result or Outcome")

    residual_lines = [
        line.strip().removeprefix("-").strip()
        for line in lines[residual_start + 1 :]
        if line.strip() and not line.startswith("#")
    ]
    if not any(substantive(line) for line in residual_lines):
        errors.append("verification evidence requires an explicit residual-risk disposition")
    return errors


def cmd_task_gate(args: argparse.Namespace) -> int:
    if args.rerun and not str(args.rerun_reason or "").strip():
        eprint("error: --rerun requires --rerun-reason")
        return 2
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)

    records: list[dict[str, Any]] = []
    failed = False
    fail_reasons: list[str] = []
    commands: list[str] = []
    gate_context: dict[str, Any] | None = None
    command_failure_prefix = "command failed"

    with tracker_state_lock(root):
        state, tasks = load_feat(paths, args.feat)
        task = find_task(tasks, args.task)
        if task.get("status") != "in_progress":
            eprint(f"error: task {args.task} must be in_progress before gate")
            return 1
        try:
            execution = resolve_feature_execution_root(root, state)
        except SystemExit as exc:
            eprint(str(exc))
            return 1
        execution_sig = workspace_signature(state, execution)

        project_type = "invalid"
        try:
            config = load_runtime_policy(paths)
            reject_retired_gate_commands(config)
            project_type = detect_project_type(execution.path, config)
            verification_policy = resolve_verification_policy(config)
            verification_file = paths.feat_verification(
                args.feat, status=str(state.get("status") or "")
            )

            if verification_required(
                verification_policy,
                project_type=project_type,
                evidence_file=verification_file,
            ):
                verification_errors = validate_verification_evidence(verification_file)
                if verification_errors:
                    failed = True
                    fail_reasons.extend(verification_errors)

            commands = task_verification_commands(task, feat_id=args.feat)
            command_failure_prefix = "task verification command failed"
        except SystemExit as exc:
            commands = []
            if project_type not in {"ui", "non_ui"}:
                project_type = "invalid"
            failed = True
            fail_reasons.append(normalize_error_text(exc))

        if commands:
            try:
                gate_context = task_gate_context(
                    root,
                    state,
                    execution,
                    task,
                    commands,
                    feat_id=args.feat,
                    plan_revision=tasks.get("plan_revision"),
                )
            except SystemExit as exc:
                failed = True
                fail_reasons.append(normalize_error_text(exc))
        previous_context = task.get("last_gate_context")
        if (
            not failed
            and gate_context is not None
            and isinstance(previous_context, dict)
            and previous_context.get("dedup_key") == gate_context["dedup_key"]
        ):
            if task.get("gate_result") == "pass" and not args.rerun:
                require_task_gate_receipt(task, feat_id=args.feat, root=root, state=state)
                print(f"ok: gate reused {args.feat}/{args.task}")
                print(f"dedup_key: {gate_context['dedup_key']}")
                return 0
            if not args.rerun:
                eprint(
                    f"error: gate already ran for the same candidate and inputs: {args.feat}/{args.task}; "
                    "record the rerun decision, then use --rerun"
                )
                return 1

    for cmd in commands:
        cp = run_shell(cmd, cwd=execution.path)
        rec = {
            "command": cmd,
            "exit_code": cp.returncode,
            "status": "pass" if cp.returncode == 0 else "fail",
        }
        records.append(rec)
        if cp.returncode != 0:
            failed = True
            fail_reasons.append(f"{command_failure_prefix}: {cmd}")

    gate_result = "fail" if failed else "pass"

    with tracker_state_lock(root):
        state, tasks = load_feat(paths, args.feat)
        task = find_task(tasks, args.task)
        if task.get("status") != "in_progress":
            eprint("error: task state changed while gate was running; gate result was not recorded")
            return 1
        if revalidate_workspace_signature(root, state, execution_sig, label="gate") is None:
            return 1
        if gate_context is not None:
            try:
                current_context = task_gate_context(
                    root,
                    state,
                    execution,
                    task,
                    task_verification_commands(task, feat_id=args.feat),
                    feat_id=args.feat,
                    plan_revision=tasks.get("plan_revision"),
                )
            except SystemExit as exc:
                eprint(str(exc))
                return 1
            if current_context["source_key"] != gate_context["source_key"]:
                eprint("error: candidate or gate inputs changed while gate was running; gate result was not recorded")
                return 1
            if any(
                digest != "unavailable" and current_context["artifact_digests"].get(ref) != digest
                for ref, digest in gate_context["artifact_digests"].items()
            ):
                eprint("error: existing artifact changed while gate was running; gate result was not recorded")
                return 1
            gate_context = current_context

        logs_dir = paths.feat_artifacts_dir(args.feat, status=str(state.get("status") or ""))
        logs_dir.mkdir(parents=True, exist_ok=True)
        next_round = int(state.setdefault("counters", {}).get("round_count", 0)) + 1
        log_file = next_numbered_path(logs_dir, prefix=f"gate-{args.task}-r{next_round}-", suffix=".log")
        lines = [
            f"project_type={project_type}",
            f"execution_root={relative_display(root, execution.path)}",
            f"workspace_mode={execution.workspace_mode}",
            f"execution_detail={execution.detail}",
            f"result={gate_result}",
        ]
        if gate_context is not None:
            lines.extend(
                [
                    f"candidate_sha={gate_context['candidate_sha']}",
                    f"worktree_digest={gate_context['worktree_digest']}",
                    f"verification_digest={gate_context['verification_digest']}",
                    f"dedup_key={gate_context['dedup_key']}",
                ]
            )
        if fail_reasons:
            lines.append("reasons:")
            for r in fail_reasons:
                lines.append(f"- {r}")
        lines.append("commands:")
        for rec in records:
            lines.append(f"- {rec['command']} => {rec['status']} ({rec['exit_code']})")
        write_text(log_file, "\n".join(lines) + "\n")

        counters = state.setdefault("counters", {})
        counters["round_count"] = int(counters.get("round_count", 0)) + 1
        counters["no_progress_rounds"] = int(counters.get("no_progress_rounds", 0)) + 1
        if gate_result == "pass":
            counters["gate_fail_streak"] = 0
        else:
            counters["gate_fail_streak"] = int(counters.get("gate_fail_streak", 0)) + 1

        state["gate"] = {
            "last_result": gate_result,
            "last_task_id": args.task,
            "last_check_commands": records,
            "last_log_path": str(log_file.relative_to(root)),
            "last_context": gate_context,
        }
        history_detail = f"{args.task} => {gate_result}"
        if args.rerun:
            history_detail += f" (rerun: {str(args.rerun_reason).strip()})"
        state.setdefault("history", []).append(history_event("task_gate", history_detail))

        task["gate_result"] = gate_result
        task["last_gate_commands"] = records
        if gate_context is not None:
            task["last_gate_context"] = gate_context
        else:
            task.pop("last_gate_context", None)

        save_feat(paths, args.feat, state, tasks)

    if gate_result == "fail":
        eprint(f"error: gate failed for {args.feat}/{args.task}")
        print("next_action_kind: repair_task_execution")
        print("next: correct the command or environment in this Task; only a disproved approach requires a successor plan")
        for reason in fail_reasons:
            eprint(f"error: {reason}")
        if any(reason.startswith("missing verification file:") for reason in fail_reasons):
            print(
                "next: feature-tracker.sh materialize-feature-artifact "
                f"--root {shlex.quote(str(root))} --feature {args.feat} --kind verification"
            )
        print(f"gate_log: {log_file}")
        return 1

    print(f"ok: gate passed {args.feat}/{args.task}")
    print(f"execution_root: {execution.path}")
    print(f"gate_log: {log_file}")
    return 0


def cmd_task_finish(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)

    try:
        state, tasks = load_feat(paths, args.feat)
        apply_task_finish_transition(
            state,
            tasks,
            root=root,
            feat_id=args.feat,
            task_id=args.task,
            result=args.result,
            blocked_reason_class=args.blocked_reason_class,
            blocked_reason=args.blocked_reason,
            blocked_owner=args.blocked_owner,
            blocked_resume_when=args.blocked_resume_when,
            cancel_reason=args.cancel_reason,
            failure_reason=args.failure_reason,
            failure_assumption=args.failure_assumption,
        )
    except SystemExit as exc:
        eprint(str(exc))
        return 1

    save_feat(paths, args.feat, state, tasks)
    print(f"ok: task finished {args.feat}/{args.task} => {args.result}")
    print(f"feat_status: {state['status']}")
    if args.result == "blocked":
        blocker = find_task(tasks, args.task).get("last_blocker") or {}
        print(f"blocker_owner: {blocker.get('owner') or 'unspecified'}")
        print(f"blocker_resume_when: {blocker.get('resume_when') or 'unspecified'}")
    failures = current_task_failures(tasks, feat_id=args.feat)
    if failures or state["status"] == "replanning":
        print("next_action_kind: revise_task_plan")
        print("next: inspect assumptions and descendants; install a reviewed successor with set-task-plan")
        if failures:
            print("replan_required_from: " + ",".join(item["item_id"] for item in failures))
    elif state["status"] == "done":
        # Task completion is not Feature completion. Keep this explicit and
        # machine-readable so a Host/Agent can continue the same convergence
        # loop instead of treating a successful finish as a terminal result.
        print("feature_completion: pending_closeout")
        print("closeout_required: true")
        root_q = shlex.quote(str(root))
        closeout_cmd = f"feature-tracker.sh closeout-feature --root {root_q} --feature {args.feat}"
        discard_cmd = (
            "feature-tracker.sh closeout-feature "
            f"--root {root_q} --feature {args.feat} --mode discard --reason superseded"
        )
        if workspace_mode_of(state) == "worktree":
            branch = str(state.get("branch") or "")
            base_ref = str(state.get("base_ref") or pick_base_branch(root))
            branch_merged = bool(branch and git_local_branch_exists(root, branch) and git_branch_merged_into(root, branch, base_ref))
            if branch and not branch_merged:
                print("next_action_kind: merge_then_closeout")
                print(
                    "next: git -C "
                    f"{root_q} checkout {shlex.quote(base_ref)} "
                    f"&& git -C {root_q} merge --no-ff {shlex.quote(branch)}"
                )
                print(f"after_merge: {closeout_cmd}")
            else:
                print("next_action_kind: closeout_feature")
                print(f"next: {closeout_cmd}")
        else:
            print("next_action_kind: closeout_feature")
            print(f"next: {closeout_cmd}")
        print(f"alternative: {discard_cmd}")
    return 0


def render_summary(
    state: dict[str, Any],
    tasks: dict[str, Any],
    *,
    preserved_root_entries: list[str] | None = None,
) -> str:
    feat_id = state["feat_id"]
    workspace_mode = state.get("workspace_mode", "")
    todo = count_tasks(tasks, "todo")
    in_prog = count_tasks(tasks, "in_progress")
    done = count_tasks(tasks, "done")
    blocked = count_tasks(tasks, "blocked")
    failed = count_tasks(tasks, "failed")
    cancelled = count_tasks(tasks, "cancelled")
    transferred = count_tasks(tasks, "transferred")
    counters = state.get("counters", {})
    preserved = preserved_root_entries or []
    reviewed_plan = has_reviewed_task_plan(tasks)
    reviewed_revision = str(tasks.get("plan_revision")) if reviewed_plan else "none"
    confirmation_ref = str(tasks.get("review_ref") or "") if reviewed_plan else ""
    closeout_review = tasks.get("closeout_review")
    review_lines: list[str] = []
    if isinstance(closeout_review, dict):
        for group, title in (
            ("documentation", "Documentation"),
            ("learning", "Execution Learning (Agent-authored)"),
            ("promotion", "Promotion"),
        ):
            item = closeout_review.get(group)
            if not isinstance(item, dict):
                continue
            rationale = " ".join(str(item.get("rationale") or "").split())
            refs = item.get("refs") if isinstance(item.get("refs"), list) else []
            review_lines.extend(
                [
                    f"- {title}: {item.get('disposition', '')}",
                    f"  - Rationale: {rationale}",
                    f"  - Refs: {', '.join(str(ref) for ref in refs)}",
                ]
            )

    return "\n".join(
        [
            f"# Feature Summary: {feat_id}",
            "",
            f"- Title: {state.get('title', '')}",
            f"- Final Status: {state.get('status', '')}",
            f"- Closed From Status: {state.get('closed_from_status', '')}",
            f"- Workspace Mode: {workspace_mode}",
            f"- Base Ref: {state.get('base_ref', '')}",
            f"- Branch: {state.get('branch', '')}",
            f"- Worktree: {state.get('worktree_path', '')}",
            f"- Discard Reason: {state.get('discard_reason') or ''}",
            f"- Replacement Feat: {state.get('replacement_feat_id') or ''}",
            f"- Transferred To: {((state.get('transferred_to') or {}).get('feature_id') if isinstance(state.get('transferred_to'), dict) else '') or ''}",
            "",
            "## Requirement Authority",
            "- Archive Synthesis: none; archive does not reinterpret or rewrite requirements",
            "- Canonical Truth: tasks.json",
            f"- Confirmed Plan Revision: {reviewed_revision}",
            f"- Confirmation Ref: {confirmation_ref}",
            "",
            "## Closure",
            "- Git Workspace: unchanged; use ordinary Git commands for worktree or branch cleanup",
            f"- Preserved Root Entries: {', '.join(preserved) if preserved else ''}",
            "",
            "## Task Stats",
            f"- todo: {todo}",
            f"- in_progress: {in_prog}",
            f"- done: {done}",
            f"- blocked: {blocked}",
            f"- failed: {failed} (requires reviewed replan)",
            f"- cancelled: {cancelled}",
            f"- transferred: {transferred}",
            "",
            "## Closeout Review",
            *review_lines,
            "",
            "## Counters",
            f"- gate_fail_streak: {counters.get('gate_fail_streak', 0)}",
            f"- no_progress_rounds: {counters.get('no_progress_rounds', 0)}",
            f"- round_count: {counters.get('round_count', 0)}",
            "",
            "## Notes",
            "- Closeout review is final planning truth; durable knowledge remains with its existing project owner.",
            "- Agent-authored execution learning is not requirement authority and must not redefine confirmed scope.",
            "",
        ]
    )


def apply_template(template: str, replacements: dict[str, str]) -> str:
    out = template
    for k, v in replacements.items():
        out = out.replace(k, v)
    return out


def resolve_worktree_abs(root: Path, raw: str) -> Path:
    p = Path(raw)
    if p.is_absolute():
        return p
    return (root / p).resolve()


def git_local_branch_exists(root: Path, branch: str) -> bool:
    cp = run_cmd(["git", "-C", str(root), "show-ref", "--verify", f"refs/heads/{branch}"])
    return cp.returncode == 0


def git_branch_merged_into(root: Path, branch: str, base_ref: str) -> bool:
    cp = run_cmd(["git", "-C", str(root), "merge-base", "--is-ancestor", branch, base_ref])
    return cp.returncode == 0


def git_worktree_paths(root: Path) -> set[Path]:
    cp = run_cmd(["git", "-C", str(root), "worktree", "list", "--porcelain"])
    if cp.returncode != 0:
        return set()
    out: set[Path] = set()
    for raw in cp.stdout.splitlines():
        line = raw.strip()
        if not line.startswith("worktree "):
            continue
        path = line[len("worktree ") :].strip()
        if not path:
            continue
        out.add(Path(path).resolve())
    return out


def resolve_feature_execution_root(root: Path, state: dict[str, Any]) -> FeatureExecutionRoot:
    feat_id = str(state.get("feat_id") or "<unknown>")
    workspace_mode = workspace_mode_of(state)
    if workspace_mode == "current_tree":
        return FeatureExecutionRoot(
            path=root,
            workspace_mode=workspace_mode,
            detail="current_tree uses the tracker root",
        )
    if workspace_mode == "worktree":
        raw = str(state.get("worktree_path") or "").strip()
        if not raw:
            raise SystemExit(f"error: feat {feat_id} workspace_mode=worktree but state.worktree_path is missing")
        execution_root = resolve_worktree_abs(root, raw).resolve()
        if not execution_root.exists():
            raise SystemExit(f"error: feat {feat_id} worktree path does not exist: {execution_root}")
        if not execution_root.is_dir():
            raise SystemExit(f"error: feat {feat_id} worktree path is not a directory: {execution_root}")
        cp = run_cmd(["git", "-C", str(execution_root), "rev-parse", "--is-inside-work-tree"])
        if cp.returncode != 0 or cp.stdout.strip() != "true":
            raise SystemExit(f"error: feat {feat_id} worktree path is not a git work tree: {execution_root}")
        if execution_root not in git_worktree_paths(root):
            raise SystemExit(
                "error: feat "
                f"{feat_id} worktree path is not registered under tracker root: {execution_root}"
            )
        branch = str(state.get("branch") or "").strip()
        if not branch:
            raise SystemExit(f"error: feat {feat_id} workspace_mode=worktree but state.branch is missing")
        current = current_branch(execution_root)
        if current != branch:
            actual = current or "detached"
            raise SystemExit(
                f"error: feat {feat_id} worktree is on {actual}, expected {branch}: {execution_root}"
            )
        return FeatureExecutionRoot(
            path=execution_root,
            workspace_mode=workspace_mode,
            detail=f"worktree uses state.worktree_path={raw}",
        )
    raise SystemExit(f"error: feat {feat_id} is not execution-ready: workspace_mode={workspace_mode}")


def preflight_closeout_workspace(
    root: Path,
    state: dict[str, Any],
    *,
    target_status: str,
) -> None:
    workspace_mode = workspace_mode_of(state)
    branch = str(state.get("branch") or "")
    base_ref = str(state.get("base_ref") or pick_base_branch(root))
    worktree_path = str(state.get("worktree_path") or "")
    wt_abs = resolve_worktree_abs(root, worktree_path) if worktree_path else None

    branch_exists = bool(branch) and git_local_branch_exists(root, branch)
    if (
        target_status == "archived"
        and workspace_mode == "worktree"
        and branch_exists
        and not git_branch_merged_into(root, branch, base_ref)
    ):
        raise SystemExit(
            f"error: feature branch is not merged into {base_ref}: {branch}; "
            "merge it before archiving"
        )

    if workspace_mode == "current_tree":
        changes = non_harness_git_status_lines(root)
        if changes and target_status == "archived":
            eprint("warn: current_tree archive leaves unrelated non-harness repo changes untouched")
        if changes and target_status in {"discarded", "transferred"}:
            raise SystemExit(
                "error: current_tree feature has non-harness changes; preserve or clean "
                "the root tree before discarding"
            )

    if workspace_mode == "worktree" and wt_abs is not None:
        registered = wt_abs in git_worktree_paths(root)
        if not wt_abs.exists():
            if registered:
                raise SystemExit(
                    f"error: missing registered worktree requires ordinary Git repair: {wt_abs}"
                )
            return
        if not registered:
            raise SystemExit(f"error: feature worktree is not registered under tracker root: {wt_abs}")
        cp = run_cmd(["git", "-C", str(wt_abs), "status", "--porcelain"])
        if cp.returncode != 0:
            raise SystemExit(cp.stderr.strip() or cp.stdout.strip() or "git status failed")
        if cp.stdout.strip():
            raise SystemExit(
                f"error: worktree has uncommitted changes: {wt_abs}; "
                "preserve or clean it with ordinary Git before closeout"
            )


def publish_closeout(
    root: Path,
    paths: HarnessPaths,
    feat_id: str,
    *,
    current_status: str,
    target_status: str,
    publication: CloseoutPublication,
) -> int:
    src_dir = paths.feat_dir(feat_id, status=current_status)
    dst_dir = paths.feat_dir(feat_id, status=target_status)
    stage_dir = dst_dir.with_name(f".{dst_dir.name}.staging")
    backup_dir = src_dir.with_name(f".{src_dir.name}.closing")
    if not src_dir.exists():
        eprint(f"error: missing feature directory: {src_dir}")
        return 1
    if dst_dir.exists():
        eprint(f"error: closed feature directory already exists: {dst_dir}")
        return 1
    if stage_dir.exists() or backup_dir.exists():
        eprint(
            "error: closeout staging residue exists; inspect before retry: "
            f"{stage_dir if stage_dir.exists() else backup_dir}"
        )
        return 1

    try:
        dst_dir.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(src_dir, stage_dir, symlinks=True)
        staged_symlink = first_tree_symlink(stage_dir)
        if staged_symlink is not None:
            raise OSError(
                "feature tree contains unsupported symlink: "
                f"{staged_symlink.relative_to(stage_dir)}"
            )
        make_owned_tree_writable(stage_dir)
        for source_name, target_rel in publication.root_moves:
            move_path(stage_dir / source_name, stage_dir / target_rel)
        save_json(stage_dir / "state.json", publication.state)
        save_json(stage_dir / "tasks.json", publication.tasks)
        receipt_path = stage_dir / FEATURE_OWNER_RECEIPT_FILENAME
        if publication.receipt is None:
            receipt_path.unlink(missing_ok=True)
        else:
            save_json(receipt_path, publication.receipt)
        write_text_atomic(stage_dir / FEATURE_SUMMARY_FILENAME, publication.summary)
    except BaseException as exc:
        if stage_dir.exists():
            try:
                remove_owned_tree(stage_dir)
            except OSError as cleanup_exc:
                eprint(f"warn: closeout staging cleanup pending: {cleanup_exc}")
        eprint(f"error: closeout publication failed without changing active state: {exc}")
        return 1

    try:
        src_dir.rename(backup_dir)
    except BaseException as exc:
        try:
            remove_owned_tree(stage_dir)
        except OSError as cleanup_exc:
            eprint(f"warn: closeout staging cleanup pending: {cleanup_exc}")
        eprint(f"error: closeout publication failed without changing active state: {exc}")
        return 1

    original_index = paths.index_file.read_bytes()
    predecessor_receipts: dict[Path, bytes | None] = {}
    try:
        stage_dir.rename(dst_dir)
        save_index(paths, publication.index)
        for entry in publication.index.get("features", []):
            replacement = (entry.get("transferred_to") or {}).get("feature_id") or entry.get("replacement_feat_id")
            if replacement != feat_id:
                continue
            predecessor_state, predecessor_tasks = load_feat(paths, entry["feat_id"])
            receipt_path = paths.feat_owner_receipt(entry["feat_id"], status=entry["status"])
            predecessor_receipts[receipt_path] = receipt_path.read_bytes() if receipt_path.exists() else None
            save_json(receipt_path, build_owner_receipt(paths, predecessor_state, predecessor_tasks))
    except BaseException as exc:
        rollback_errors: list[str] = []
        try:
            write_bytes_atomic(paths.index_file, original_index)
            for receipt_path, original in predecessor_receipts.items():
                if original is None:
                    receipt_path.unlink(missing_ok=True)
                else:
                    write_bytes_atomic(receipt_path, original)
        except BaseException as rollback_exc:
            rollback_errors.append(f"projection restore failed: {normalize_error_text(rollback_exc)}")
        if dst_dir.exists() and not stage_dir.exists():
            try:
                dst_dir.rename(stage_dir)
            except BaseException as rollback_exc:
                rollback_errors.append(
                    f"closed placement restore failed: {normalize_error_text(rollback_exc)}"
                )
        if backup_dir.exists() and not src_dir.exists():
            try:
                backup_dir.rename(src_dir)
            except BaseException as rollback_exc:
                rollback_errors.append(
                    f"active placement restore failed: {normalize_error_text(rollback_exc)}"
                )

        restored = (
            src_dir.exists()
            and not dst_dir.exists()
            and not backup_dir.exists()
        )
        if restored:
            if stage_dir.exists():
                try:
                    remove_owned_tree(stage_dir)
                except OSError as cleanup_exc:
                    eprint(f"warn: closeout staging cleanup pending: {cleanup_exc}")
            eprint(f"error: closeout publication failed without changing active state: {exc}")
            return 1

        eprint(f"error: closeout publication failed and rollback is incomplete: {exc}")
        for rollback_error in rollback_errors:
            eprint(f"error: {rollback_error}")
        eprint("error: manual repair required; ambiguous closeout residues were preserved")
        eprint(f"active_path: {src_dir}")
        eprint(f"active_backup_path: {backup_dir}")
        eprint(f"closed_path: {dst_dir}")
        eprint(f"staging_path: {stage_dir}")
        eprint(f"index_path: {paths.index_file}")
        eprint("index_publication: unknown; validate index before manual repair")
        return 1

    try:
        remove_owned_tree(backup_dir)
    except OSError as exc:
        eprint(f"warn: closed feature published; active backup cleanup pending: {exc}")
    preserved_root_entries = [target for _, target in publication.root_moves]
    if preserved_root_entries:
        print(f"preserved_root_entries: {len(preserved_root_entries)}")
        preserved_dirs = sorted(
            {str(Path(target).parent) for target in preserved_root_entries}
        )
        for preserved_dir in preserved_dirs:
            print(
                "preserved_root_dir: "
                + relative_display(root, dst_dir / preserved_dir)
            )
    print(f"ok: feat {target_status} {feat_id}")
    return 0


def archive_feature(
    root: Path,
    paths: HarnessPaths,
    feat_id: str,
    state: dict[str, Any],
    tasks: dict[str, Any],
    closeout_review: dict[str, Any] | None,
) -> int:
    current_status = str(state.get("status") or "")
    if current_status == "archived":
        try:
            ensure_closed_feat_rerun_state(paths, feat_id, expected_status="archived")
        except SystemExit as exc:
            eprint(str(exc))
            return 1
        print(f"ok: feat already archived {feat_id}")
        return 0
    if current_status not in {"done", "blocked"}:
        eprint(
            "error: feat must be done/blocked before archive "
            f"(current={current_status})"
        )
        return 1
    if closeout_review is None:
        eprint(f"error: {feat_id}: closeout review is required before archive")
        for line in closeout_review_guidance_lines():
            eprint(line)
        return 1
    try:
        build_closeout_dag_projection_payload(
            paths,
            feat_id=feat_id,
            target_status="archived",
        )
        preflight_closeout_workspace(root, state, target_status="archived")
        publication = prepare_closed_feature_publication(
            paths,
            state,
            tasks,
            feat_id=feat_id,
            target_status="archived",
            event_action="feat_archived",
            event_detail="tracker metadata closed; Git workspace unchanged",
            closeout_review=closeout_review,
        )
    except SystemExit as exc:
        eprint(str(exc))
        return 1
    return publish_closeout(
        root,
        paths,
        feat_id,
        current_status=current_status,
        target_status="archived",
        publication=publication,
    )


def cmd_feat_archive(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    ensure_git_repo(root)
    state, tasks = load_feat(paths, args.feat)
    if str(state.get("status") or "") == "archived" and has_closeout_review_args(args):
        eprint("error: closed feature review is immutable; rerun archive-feature without review arguments")
        return 1
    closeout_review = None
    if str(state.get("status") or "") in {"done", "blocked"}:
        try:
            closeout_review = closeout_review_from_args(root, args, feat_id=args.feat)
        except SystemExit as exc:
            eprint(str(exc))
            return 1
    return archive_feature(root, paths, args.feat, state, tasks, closeout_review)


def cmd_feat_discard(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    ensure_git_repo(root)

    state, tasks = load_feat(paths, args.feat)
    current_status = str(state.get("status") or "")
    if current_status == "discarded":
        if has_closeout_review_args(args):
            eprint("error: closed feature review is immutable; rerun discard-feature without review arguments")
            return 1
        try:
            ensure_closed_feat_rerun_state(paths, args.feat, expected_status="discarded")
        except SystemExit as exc:
            eprint(str(exc))
            return 1
        print(f"ok: feat already discarded {args.feat}")
        return 0
    if current_status == "archived":
        eprint(f"error: archived feat cannot be discarded: {args.feat}")
        return 1
    if current_status not in {"proposal", "ready", "in_progress", "replanning", "blocked", "done"}:
        eprint(f"error: feat cannot be discarded from status={current_status}")
        return 1
    invalid_source_issues = validate_feat(paths, root, args.feat) if args.reason == "invalid" else []
    if args.reason == "invalid" and not invalid_source_issues:
        eprint(
            "error: --reason invalid requires at least one Feature contract error; "
            "use stale, superseded, or cancelled for a valid Feature"
        )
        return 1
    if (
        args.reason != "invalid"
        and current_status == "in_progress"
        and count_tasks(tasks, "in_progress") > 0
    ):
        eprint("error: cannot discard feat while a task is in_progress")
        eprint("hint: finish the active task as blocked or done before discard-feature")
        return 1

    try:
        closeout_review = closeout_review_from_args(root, args, feat_id=args.feat)
    except SystemExit as exc:
        eprint(str(exc))
        return 1

    replacement = str(args.replacement).strip()
    if replacement:
        if replacement == args.feat:
            eprint("error: replacement feat must differ from discarded feat")
            return 1
        replacement_entry = get_feat_index_entry(load_index(paths), replacement)
        if replacement_entry is None:
            eprint(f"error: replacement feat not indexed: {replacement}")
            return 1
        replacement_status = str(replacement_entry.get("status") or "proposal")
        replacement_receipt = paths.feat_owner_receipt(replacement, status=replacement_status)
        if not replacement_receipt.is_file():
            eprint(
                "error: replacement feat has no execution-owner receipt: "
                f"{relative_display(root, replacement_receipt)}"
            )
            return 1

    try:
        build_closeout_dag_projection_payload(
            paths,
            feat_id=args.feat,
            target_status="discarded",
        )
        if args.reason == "invalid":
            publication = prepare_invalid_discard_publication(
                paths,
                state,
                feat_id=args.feat,
                closeout_review=closeout_review,
                source_issue_count=len(invalid_source_issues),
                replacement_feat_id=replacement or None,
            )
        else:
            preflight_closeout_workspace(root, state, target_status="discarded")
            publication = prepare_closed_feature_publication(
                paths,
                state,
                tasks,
                feat_id=args.feat,
                target_status="discarded",
                event_action="feat_discarded",
                event_detail=f"reason={args.reason}; replacement={replacement or 'none'}",
                closeout_review=closeout_review,
                discard_reason=args.reason,
                replacement_feat_id=replacement or None,
            )
    except SystemExit as exc:
        eprint(str(exc))
        return 1

    result = publish_closeout(
        root,
        paths,
        args.feat,
        current_status=current_status,
        target_status="discarded",
        publication=publication,
    )
    if result == 0 and args.reason == "invalid":
        print(f"invalid_source_errors: {len(invalid_source_issues)}")
    return result


def cmd_feat_transfer(args: argparse.Namespace) -> int:
    """Close one partial Feature while preserving unfinished Task lineage."""
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    ensure_git_repo(root)

    feat_id = str(args.feat).strip()
    replacement_id = str(args.replacement).strip()
    if not replacement_id or replacement_id == feat_id:
        eprint("error: transfer requires a different --replacement Feature")
        return 1

    try:
        state, tasks = load_feat(paths, feat_id)
        replacement_state, replacement_tasks = load_feat(paths, replacement_id)
    except SystemExit as exc:
        eprint(str(exc))
        return 1

    current_status = str(state.get("status") or "")
    replacement_status = str(replacement_state.get("status") or "")
    if current_status in CLOSED_FEAT_STATUS:
        eprint(f"error: cannot transfer closed Feature: {feat_id}")
        return 1
    if replacement_status in CLOSED_FEAT_STATUS:
        eprint(f"error: replacement Feature must remain active: {replacement_id}")
        return 1
    if not has_reviewed_task_plan(replacement_tasks):
        eprint(f"error: replacement Feature requires a reviewed Task plan: {replacement_id}")
        return 1
    if count_tasks(tasks, "in_progress") > 0:
        eprint(f"error: cannot transfer Feature while a Task is in_progress: {feat_id}")
        eprint("hint: finish the active Task as done or blocked before transfer-feature")
        return 1

    try:
        source_refs = canonical_transferred_from(
            replacement_state.get("transferred_from"),
            feat_id=replacement_id,
        )
    except SystemExit as exc:
        eprint(str(exc))
        return 1
    if not any(item["feature_id"] == feat_id for item in source_refs):
        eprint(
            f"error: replacement Feature {replacement_id} must declare "
            f"transferred_from for {feat_id} before transfer"
        )
        eprint(
            "hint: create the replacement with "
            f"--transferred-from {feat_id}"
        )
        return 1

    unfinished = [
        task
        for task in current_plan_tasks(tasks)
        if str(task.get("status") or "") != "done"
    ]
    if not unfinished:
        eprint(f"error: Feature has no unfinished current-plan Tasks; archive it instead: {feat_id}")
        return 1

    transferred_tasks = copy.deepcopy(tasks)
    for task in current_plan_tasks(transferred_tasks):
        if str(task.get("status") or "") in {"done", "failed"}:
            continue
        task["status"] = "transferred"
        task.pop("last_blocker", None)
        task.pop("cancel_reason", None)

    try:
        closeout_review = closeout_review_from_args(root, args, feat_id=feat_id)
        build_closeout_dag_projection_payload(
            paths,
            feat_id=feat_id,
            target_status="transferred",
        )
        preflight_closeout_workspace(root, state, target_status="transferred")
        publication = prepare_closed_feature_publication(
            paths,
            state,
            transferred_tasks,
            feat_id=feat_id,
            target_status="transferred",
            event_action="feat_transferred",
            event_detail=f"replacement={replacement_id}",
            closeout_review=closeout_review,
            replacement_feat_id=replacement_id,
        )
    except SystemExit as exc:
        eprint(str(exc))
        return 1

    return publish_closeout(
        root,
        paths,
        feat_id,
        current_status=current_status,
        target_status="transferred",
        publication=publication,
    )


def closeout_plan_lines(root: Path, state: dict[str, Any], tasks: dict[str, Any]) -> list[str]:
    feat_id = str(state.get("feat_id") or "")
    status = str(state.get("status") or "")
    root_q = shlex.quote(str(root))
    lines: list[str] = []

    if status in CLOSED_FEAT_STATUS:
        lines.append(f"{feat_id}: already {status}")
        return lines

    if status == "done":
        lines.append(
            f"{feat_id}: active done; review and close with "
            f"feature-tracker.sh closeout-feature --root {root_q} --feature {feat_id}"
        )
        return lines

    if status == "blocked":
        lines.append(
            f"{feat_id}: blocked; review and choose closeout-feature --archive-blocked or "
            "--mode discard --reason stale|superseded|cancelled; "
            "use invalid only when validate-tracker reports a Feature contract error"
        )
        return lines

    if status == "replanning":
        lines.append(
            f"{feat_id}: replanning; install a reviewed successor plan with "
            f"feature-tracker.sh set-task-plan --root {root_q} --feature {feat_id}"
        )
        return lines

    if status == "in_progress":
        frontier = task_frontier(tasks, feat_id=feat_id)
        for task_id in frontier["active"]:
            task = find_task(tasks, task_id)
            gate_result = str(task.get("gate_result") or "")
            if gate_result != "pass":
                lines.append(
                    f"{feat_id}: task {task_id} needs passing gate; run "
                    f"feature-tracker.sh run-task-gate --root {root_q} --feature {feat_id} --task {task_id}"
                )
                continue
            lines.append(
                f"{feat_id}: task {task_id} gate passed; finish with "
                f"feature-tracker.sh closeout-feature --root {root_q} --feature {feat_id} "
                f"--task {task_id} --result done"
            )
        return lines

    lines.append(f"{feat_id}: status={status}; no automatic closeout plan")
    return lines


def active_closeout_plan_lines(root: Path, paths: HarnessPaths) -> list[str]:
    index_data = load_index(paths)
    lines: list[str] = []
    for item in index_data.get("features", []):
        feat_id = str(item.get("feat_id", ""))
        state, tasks = load_feat(paths, feat_id)
        status = str(state.get("status") or "")
        if status in CLOSED_FEAT_STATUS:
            continue
        if status not in {"done", "blocked", "replanning", "in_progress"}:
            continue
        lines.extend(closeout_plan_lines(root, state, tasks))
    return lines


def cmd_feat_closeout(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)

    state, tasks = load_feat(paths, args.feat)
    status = str(state.get("status") or "")
    feat_id = str(state.get("feat_id") or args.feat)

    mode = args.mode
    task_id = args.task.strip()
    result = args.result if args.result is not None else "done"
    has_task_transition_args = bool(
        task_id
        or args.result is not None
        or args.blocked_reason_class is not None
        or args.blocked_reason is not None
        or args.blocked_owner is not None
        or args.blocked_resume_when is not None
        or args.cancel_reason is not None
        or args.failure_reason is not None
        or args.failure_assumption is not None
    )

    if mode == "archive" and (args.reason or args.replacement):
        eprint("error: --reason and --replacement are valid only with --mode discard")
        return 1
    if mode == "discard" and args.archive_blocked:
        eprint("error: --archive-blocked is valid only with --mode archive")
        return 1
    if mode == "discard" and has_task_transition_args:
        eprint(
            "error: --task, --result, blocker, and failure arguments are valid only "
            "for archive closeout of an in_progress task"
        )
        return 1
    if status != "blocked" and args.archive_blocked:
        eprint("error: --archive-blocked requires a blocked feature")
        return 1
    if status in CLOSED_FEAT_STATUS:
        if has_closeout_review_args(args):
            eprint("error: closed feature review is immutable; rerun closeout-feature without review arguments")
            return 1
        if has_task_transition_args:
            eprint("error: closed feature cannot consume task result or blocker arguments")
            return 1
        if mode != "archive":
            eprint("error: closed feature rerun requires the matching direct closeout command")
            return 1
        try:
            ensure_closed_feat_rerun_state(paths, feat_id, expected_status=status)
        except SystemExit as exc:
            eprint(str(exc))
            return 1
        print(f"ok: feat already {status} {args.feat}")
        return 0

    if mode == "discard":
        if not args.reason:
            eprint("error: --reason is required with --mode discard")
            return 1
        if status == "in_progress" and count_tasks(tasks, "in_progress") > 0:
            eprint("error: cannot discard feat while a task is in_progress")
            eprint("hint: finish the active task as blocked or done before discard closeout")
            return 1
        if not args.execute:
            for line in closeout_review_guidance_lines():
                print(line)
            print("next: rerun closeout-feature with all review choices and --execute")
            return 0
        return cmd_feat_discard(
            argparse.Namespace(
                root=str(root),
                feat=feat_id,
                reason=args.reason,
                replacement=args.replacement,
                documentation_disposition=args.documentation_disposition,
                documentation_rationale=args.documentation_rationale,
                documentation_ref=args.documentation_ref,
                learning_disposition=args.learning_disposition,
                learning_rationale=args.learning_rationale,
                learning_ref=args.learning_ref,
                promotion_disposition=args.promotion_disposition,
                promotion_rationale=args.promotion_rationale,
                promotion_ref=args.promotion_ref,
            )
        )

    if status != "in_progress" and has_task_transition_args:
        eprint(
            "error: task result and blocker arguments require an in_progress feature"
        )
        return 1

    if status == "blocked" and not args.archive_blocked:
        eprint("error: blocked feat closeout requires --archive-blocked or --mode discard --reason <reason>")
        return 1

    if status == "in_progress":
        candidate_state = copy.deepcopy(state)
        candidate_tasks = copy.deepcopy(tasks)
        if not task_id:
            active_task_ids = task_frontier(tasks, feat_id=feat_id)["active"]
            if len(active_task_ids) == 1:
                task_id = active_task_ids[0]
            else:
                eprint("error: --task is required when multiple Tasks are active")
                for line in closeout_plan_lines(root, state, tasks):
                    print(f"plan: {line}")
                return 1
        try:
            apply_task_finish_transition(
                candidate_state,
                candidate_tasks,
                root=root,
                feat_id=feat_id,
                task_id=task_id,
                result=result,
                blocked_reason_class=args.blocked_reason_class,
                blocked_reason=args.blocked_reason,
                blocked_owner=args.blocked_owner,
                blocked_resume_when=args.blocked_resume_when,
                cancel_reason=args.cancel_reason,
                failure_reason=args.failure_reason,
                failure_assumption=args.failure_assumption,
            )
        except SystemExit as exc:
            eprint(str(exc))
            return 1
        blocker_args = ""
        if result == "blocked":
            blocker_args = (
                f" --blocked-reason-class {shlex.quote(args.blocked_reason_class)}"
                f" --blocked-reason {shlex.quote(args.blocked_reason)}"
            )
            if args.blocked_owner:
                blocker_args += f" --blocked-owner {shlex.quote(args.blocked_owner)}"
            if args.blocked_resume_when:
                blocker_args += f" --blocked-resume-when {shlex.quote(args.blocked_resume_when)}"
        elif result == "cancelled":
            blocker_args = f" --cancel-reason {shlex.quote(args.cancel_reason)}"
        elif result == "failed":
            blocker_args = (
                f" --failure-reason {shlex.quote(args.failure_reason)}"
                f" --failure-assumption {shlex.quote(args.failure_assumption)}"
            )
        finish_plan = (
            "plan: feature-tracker.sh finish-task "
            f"--root {shlex.quote(str(root))} --feature {feat_id} --task {task_id} "
            f"--result {result}{blocker_args}"
        )
        if not args.execute:
            print(finish_plan)
            if candidate_state["status"] == "done":
                for line in closeout_review_guidance_lines():
                    print(line)
                print("next: rerun closeout-feature with all review choices and --execute")
            else:
                print("next: rerun closeout-feature with --execute")
            return 0
        if candidate_state["status"] != "done":
            save_feat(paths, feat_id, candidate_state, candidate_tasks)
            print(f"ok: task finished {feat_id}/{task_id} => {result}")
            print(f"feat_status: {candidate_state['status']}")
            return 0
        state, tasks, status = candidate_state, candidate_tasks, "done"

    if status not in {"done", "blocked", "replanning"}:
        for line in closeout_plan_lines(root, state, tasks):
            print(f"plan: {line}")
        return 1

    if not args.execute:
        for line in closeout_review_guidance_lines():
            print(line)
        print("next: rerun closeout-feature with all review choices and --execute")
        return 0

    try:
        closeout_review = closeout_review_from_args(root, args, feat_id=feat_id)
    except SystemExit as exc:
        eprint(str(exc))
        return 1
    return archive_feature(root, paths, feat_id, state, tasks, closeout_review)


def validate_feat(paths: HarnessPaths, root: Path, feat_id: str) -> list[str]:
    errors: list[str] = []
    state, tasks = load_feat(paths, feat_id)
    status = state.get("status")

    if not is_valid_feat_id(feat_id):
        errors.append(f"invalid feat id format: {feat_id}")

    if status not in FEAT_STATUS:
        errors.append(f"{feat_id}: invalid feature status: {status}")

    if status not in CLOSED_FEAT_STATUS:
        for obsolete_field in (
            "current_task_id",
            "blocked_reason_class",
            "blocked_reason",
            "blocked_task_id",
        ):
            if obsolete_field in state:
                errors.append(
                    f"{feat_id}: obsolete state field must be removed: {obsolete_field}"
                )

    if state.get("feat_id") != feat_id:
        errors.append(f"{feat_id}: state feat_id mismatch")

    try:
        transferred_from = canonical_transferred_from(
            state.get("transferred_from"),
            feat_id=feat_id,
        )
    except SystemExit as exc:
        errors.append(normalize_error_text(exc))
        transferred_from = []
    for transfer in transferred_from:
        source_id = transfer["feature_id"]
        source_entry = get_feat_index_entry(load_index(paths), source_id)
        if source_entry is None:
            errors.append(f"{feat_id}: transferred_from Feature is not indexed: {source_id}")
            continue
        source_status = str(source_entry.get("status") or "")
        if source_status in {"archived", "discarded"}:
            errors.append(
                f"{feat_id}: transferred_from source {source_id} has terminal status={source_status}; "
                "use transferred for a moved Feature"
            )
        if source_status == "transferred":
            try:
                source_state, _source_tasks = load_feat(paths, source_id)
            except SystemExit as exc:
                errors.append(normalize_error_text(exc))
            else:
                try:
                    source_target = canonical_transferred_to(
                        source_state.get("transferred_to"),
                        feat_id=source_id,
                    )
                except SystemExit as exc:
                    errors.append(normalize_error_text(exc))
                else:
                    if not source_target or source_target["feature_id"] != feat_id:
                        errors.append(
                            f"{feat_id}: transferred_from source {source_id} does not point back with transferred_to"
                        )

    if status == "transferred":
        transferred_to = canonical_transferred_to(state.get("transferred_to"), feat_id=feat_id)
        replacement_id = transferred_to["feature_id"] if transferred_to else ""
        if not replacement_id:
            errors.append(f"{feat_id}: transferred Feature requires transferred_to")
        else:
            replacement_entry = get_feat_index_entry(load_index(paths), replacement_id)
            if replacement_entry is None:
                errors.append(f"{feat_id}: transferred replacement Feature is not indexed: {replacement_id}")
            else:
                try:
                    replacement_state, _replacement_tasks = load_feat(paths, replacement_id)
                    replacement_refs = canonical_transferred_from(
                        replacement_state.get("transferred_from"),
                        feat_id=replacement_id,
                    )
                except SystemExit as exc:
                    errors.append(normalize_error_text(exc))
                else:
                    if not any(item["feature_id"] == feat_id for item in replacement_refs):
                        errors.append(
                            f"{feat_id}: transferred replacement {replacement_id} is missing transferred_from backlink"
                        )
    elif state.get("transferred_to") is not None:
        errors.append(f"{feat_id}: non-transferred Feature must not carry transferred_to")

    errors.extend(feature_goal_contract_issues(paths, state))

    raw_slug = state.get("slug")
    if not isinstance(raw_slug, str) or not raw_slug.strip():
        errors.append(f"{feat_id}: missing feature slug")
    else:
        try:
            normalized_slug = slugify(raw_slug)
        except SystemExit as exc:
            errors.append(f"{feat_id}: {normalize_error_text(exc)}")
        else:
            if raw_slug != normalized_slug:
                errors.append(f"{feat_id}: feature slug is not normalized: {raw_slug}")

    try:
        canonical_depends_on(state, feat_id=feat_id)
    except SystemExit as exc:
        errors.append(normalize_error_text(exc))

    try:
        state_runtime_role = canonical_runtime_role(state.get("runtime_role"), feat_id=feat_id)
    except SystemExit as exc:
        errors.append(normalize_error_text(exc))
        state_runtime_role = "standalone"

    try:
        require_canonical_task_blockers(tasks, feat_id=feat_id)
    except SystemExit as exc:
        errors.append(normalize_error_text(exc))

    try:
        state_runtime_relations = canonical_runtime_relations(state.get("runtime_relations"), feat_id=feat_id)
    except SystemExit as exc:
        errors.append(normalize_error_text(exc))
        state_runtime_relations = []

    if state_runtime_role == "frontdoor_context":
        invalid = [item["relation"] for item in state_runtime_relations if item["relation"] != "frontdoor_for"]
        if invalid:
            errors.append(
                f"{feat_id}: frontdoor_context may only declare runtime_relations with relation=frontdoor_for"
            )
    if state_runtime_role in {"execution_owner", "foreground_owner"}:
        invalid = [item["relation"] for item in state_runtime_relations if item["relation"] != "handoff_from"]
        if invalid:
            errors.append(
                f"{feat_id}: {state_runtime_role} may only declare runtime_relations with relation=handoff_from"
            )
    try:
        blockers = current_task_blockers(tasks, feat_id=feat_id)
    except SystemExit as exc:
        errors.append(normalize_error_text(exc))
        blockers = []
    if any(item["class"] == "parked_context" for item in blockers) and state_runtime_role != "frontdoor_context":
        errors.append(f"{feat_id}: parked_context Task blocker requires runtime_role=frontdoor_context")

    index_entry = get_feat_index_entry(load_index(paths), feat_id)
    if index_entry is None:
        errors.append(f"{feat_id}: missing feature index entry")
    else:
        if str(index_entry.get("status") or "") != str(state.get("status") or ""):
            errors.append(f"{feat_id}: index status drift from state.json")
        if str(index_entry.get("title") or "") != str(state.get("title") or ""):
            errors.append(f"{feat_id}: index title drift from state.json")
        if str(index_entry.get("workspace_mode") or "") != str(state.get("workspace_mode") or ""):
            errors.append(f"{feat_id}: index workspace_mode drift from state.json")
        if str(index_entry.get("branch") or "") != str(state.get("branch") or ""):
            errors.append(f"{feat_id}: index branch drift from state.json")
        try:
            index_runtime_role = canonical_runtime_role(index_entry.get("runtime_role"), feat_id=feat_id)
        except SystemExit as exc:
            errors.append(normalize_error_text(exc))
            index_runtime_role = "standalone"
        if index_runtime_role != state_runtime_role:
            errors.append(f"{feat_id}: index runtime_role drift from state.json")
        if status not in CLOSED_FEAT_STATUS and "blocked_reason_class" in index_entry:
            errors.append(f"{feat_id}: index contains obsolete blocked_reason_class projection")
        try:
            index_runtime_relations = canonical_runtime_relations(index_entry.get("runtime_relations"), feat_id=feat_id)
        except SystemExit as exc:
            errors.append(normalize_error_text(exc))
            index_runtime_relations = []
        if index_runtime_relations != state_runtime_relations:
            errors.append(f"{feat_id}: index runtime_relations drift from state.json")
        try:
            index_transferred_from = canonical_transferred_from(
                index_entry.get("transferred_from"),
                feat_id=feat_id,
            )
        except SystemExit as exc:
            errors.append(normalize_error_text(exc))
            index_transferred_from = []
        if index_transferred_from != transferred_from:
            errors.append(f"{feat_id}: index transferred_from drift from state.json")
        if status == "transferred":
            if index_entry.get("transferred_to") != state.get("transferred_to"):
                errors.append(f"{feat_id}: index transferred_to drift from state.json")
        elif status == "discarded" and str(index_entry.get("replacement_feat_id") or "") != str(state.get("replacement_feat_id") or ""):
            errors.append(f"{feat_id}: index replacement_feat_id drift from state.json")

    workspace_mode = str(state.get("workspace_mode") or "").strip()
    if workspace_mode not in WORKSPACE_MODES:
        errors.append(f"{feat_id}: invalid workspace_mode: {workspace_mode or '<missing>'}")
    else:
        branch = str(state.get("branch") or "").strip()
        wt_name = str(state.get("worktree_name") or "").strip()
        wt_path = str(state.get("worktree_path") or "").strip()
        if workspace_mode == "worktree":
            if not branch:
                errors.append(f"{feat_id}: worktree mode requires branch")
            if not wt_name:
                errors.append(f"{feat_id}: worktree mode requires worktree_name")
            if not wt_path:
                errors.append(f"{feat_id}: worktree mode requires worktree_path")
        else:
            if branch:
                errors.append(f"{feat_id}: {workspace_mode} mode must not track dedicated branch")
            if wt_name or wt_path:
                errors.append(f"{feat_id}: {workspace_mode} mode must not track worktree fields")

    counters = state.get("counters", {})
    for key in ("gate_fail_streak", "no_progress_rounds", "round_count"):
        try:
            val = int(counters.get(key, 0))
            if val < 0:
                errors.append(f"{feat_id}: counter {key} must be >= 0")
        except Exception:  # noqa: BLE001
            errors.append(f"{feat_id}: counter {key} not integer")

    task_items = tasks.get("tasks")
    if not isinstance(task_items, list):
        errors.append(f"{feat_id}: tasks.json missing tasks array")
        return errors

    explicit_plan = "plan_status" in tasks
    current_plan_ids: set[str] = set()
    latest_superseded_ids: set[str] = set()
    if explicit_plan:
        if tasks.get("version") != 2:
            errors.append(f"{feat_id}: explicit task plan requires version 2")
        plan_status = str(tasks.get("plan_status") or "")
        plan_revision = tasks.get("plan_revision")
        if plan_status not in TASK_PLAN_STATUSES:
            errors.append(f"{feat_id}: invalid task plan status: {plan_status or '<missing>'}")
        if not isinstance(plan_revision, int) or isinstance(plan_revision, bool) or plan_revision < 0:
            errors.append(f"{feat_id}: plan_revision must be a non-negative integer")
        if plan_status == "draft":
            if plan_revision != 0 or task_items:
                errors.append(f"{feat_id}: draft task plan must use revision 0 and contain no executable tasks")
            if tasks.get("supersedes_revision") is not None:
                errors.append(f"{feat_id}: draft task plan supersedes_revision must be null")
            if tasks.get("plan_history") != []:
                errors.append(f"{feat_id}: draft task plan history must be empty")
            if status not in CLOSED_FEAT_STATUS and (status != "proposal" or workspace_mode != "proposal_only"):
                errors.append(f"{feat_id}: draft task plan requires proposal status and proposal_only workspace")
        elif not task_items:
            errors.append(f"{feat_id}: reviewed task plan must contain at least one task")
        if plan_status == "reviewed":
            expected_supersedes_revision = None if plan_revision == 1 else (
                plan_revision - 1 if isinstance(plan_revision, int) and not isinstance(plan_revision, bool) else None
            )
            if tasks.get("supersedes_revision") != expected_supersedes_revision:
                errors.append(f"{feat_id}: reviewed task plan supersedes_revision must identify the prior revision")
            try:
                require_repo_relative_ref(root, tasks.get("review_ref"), f"{feat_id}: reviewed task plan review_ref")
            except SystemExit as exc:
                errors.append(normalize_error_text(exc))
            try:
                require_repo_relative_refs(root, tasks.get("source_refs"), f"{feat_id}: reviewed task plan source_refs")
            except SystemExit as exc:
                errors.append(normalize_error_text(exc))

            history = tasks.get("plan_history")
            if not isinstance(history, list):
                errors.append(f"{feat_id}: reviewed task plan requires plan_history")
            else:
                if isinstance(plan_revision, int) and not isinstance(plan_revision, bool) and len(history) != plan_revision:
                    errors.append(f"{feat_id}: plan_history length must equal plan_revision")
                previous_history_ids: set[str] = set()
                for history_index, raw_entry in enumerate(history):
                    history_label = f"{feat_id}: plan_history[{history_index}]"
                    if not isinstance(raw_entry, dict):
                        errors.append(f"{history_label} must be an object")
                        continue
                    expected_revision = history_index + 1
                    if raw_entry.get("revision") != expected_revision:
                        errors.append(f"{history_label}.revision must be {expected_revision}")
                    expected_prior = None if expected_revision == 1 else expected_revision - 1
                    if raw_entry.get("supersedes_revision") != expected_prior:
                        errors.append(f"{history_label}.supersedes_revision must be {expected_prior}")
                    try:
                        require_repo_relative_ref(root, raw_entry.get("review_ref"), f"{history_label}.review_ref")
                    except SystemExit as exc:
                        errors.append(normalize_error_text(exc))
                    try:
                        require_repo_relative_refs(root, raw_entry.get("source_refs"), f"{history_label}.source_refs")
                    except SystemExit as exc:
                        errors.append(normalize_error_text(exc))
                    entry_task_ids = raw_entry.get("task_ids")
                    if not isinstance(entry_task_ids, list) or not entry_task_ids:
                        errors.append(f"{history_label}.task_ids must be a non-empty list")
                        entry_ids: set[str] = set()
                    else:
                        entry_ids = {str(item) for item in entry_task_ids}
                        if len(entry_ids) != len(entry_task_ids) or any(
                            not TASK_ID_RE.fullmatch(str(item)) for item in entry_task_ids
                        ):
                            errors.append(f"{history_label}.task_ids must contain unique task ids")
                    raw_superseded_ids = raw_entry.get("superseded_task_ids")
                    if not isinstance(raw_superseded_ids, list):
                        errors.append(f"{history_label}.superseded_task_ids must be a list")
                        entry_superseded_ids: set[str] = set()
                    else:
                        entry_superseded_ids = {str(item) for item in raw_superseded_ids}
                        if len(entry_superseded_ids) != len(raw_superseded_ids) or any(
                            not TASK_ID_RE.fullmatch(str(item)) for item in raw_superseded_ids
                        ):
                            errors.append(f"{history_label}.superseded_task_ids must contain unique task ids")
                    expected_removed = previous_history_ids - entry_ids if history_index > 0 else set()
                    if entry_superseded_ids != expected_removed:
                        errors.append(f"{history_label}.superseded_task_ids drift from revision lineage")
                    previous_history_ids = entry_ids
                    if history_index == len(history) - 1:
                        current_plan_ids = entry_ids
                        latest_superseded_ids = entry_superseded_ids
                if history and isinstance(history[-1], dict):
                    if history[-1].get("review_ref") != tasks.get("review_ref"):
                        errors.append(f"{feat_id}: current review_ref drift from latest plan_history entry")
                    if history[-1].get("source_refs") != tasks.get("source_refs"):
                        errors.append(f"{feat_id}: current source_refs drift from latest plan_history entry")
            if not has_reviewed_task_plan(tasks):
                errors.append(f"{feat_id}: reviewed task plan is not canonical executable v2 state")
    elif status not in CLOSED_FEAT_STATUS:
        errors.append(f"{feat_id}: active feature requires an explicit version 2 reviewed task plan")

    seen: set[str] = set()
    in_progress: list[str] = []
    for task in task_items:
        if not isinstance(task, dict):
            errors.append(f"{feat_id}: task entries must be objects")
            continue
        tid = str(task.get("id", ""))
        if not TASK_ID_RE.fullmatch(tid):
            errors.append(f"{feat_id}: invalid task id: {tid}")
        if tid in seen:
            errors.append(f"{feat_id}: duplicate task id: {tid}")
        seen.add(tid)

        tstatus = task.get("status")
        if tstatus not in TASK_STATUS:
            errors.append(f"{feat_id}/{tid}: invalid task status: {tstatus}")
        if tstatus == "in_progress":
            in_progress.append(tid)
        if explicit_plan and tasks.get("plan_status") == "reviewed":
            for field in ("title", "objective", "outcome"):
                if not str(task.get(field) or "").strip():
                    errors.append(f"{feat_id}/{tid}: reviewed task requires {field}")
            for field in ("acceptance", "verification", "source_refs"):
                value = task.get(field)
                if not isinstance(value, list) or not value:
                    errors.append(f"{feat_id}/{tid}: reviewed task requires non-empty {field}")
            acceptance = task.get("acceptance")
            if isinstance(acceptance, list) and any(not isinstance(item, str) or not item.strip() for item in acceptance):
                errors.append(f"{feat_id}/{tid}: acceptance entries must be non-empty strings")
            try:
                require_repo_relative_refs(root, task.get("source_refs"), f"{feat_id}/{tid}: source_refs")
            except SystemExit as exc:
                errors.append(normalize_error_text(exc))
            verification = task.get("verification")
            if isinstance(verification, list):
                for mapping_index, mapping in enumerate(verification):
                    mapping_label = f"{feat_id}/{tid}: verification[{mapping_index}]"
                    if not isinstance(mapping, dict):
                        errors.append(f"{mapping_label} must be an object")
                        continue
                    if mapping.get("kind") not in TASK_VERIFICATION_KINDS:
                        errors.append(f"{mapping_label}.kind is invalid")
                    try:
                        require_repo_relative_ref(root, mapping.get("ref"), f"{mapping_label}.ref")
                    except SystemExit as exc:
                        errors.append(normalize_error_text(exc))
                    if not isinstance(mapping.get("proves"), str) or not str(mapping.get("proves")).strip():
                        errors.append(f"{mapping_label}.proves must be a non-empty string")
                # An active Task must have an executable proof before it can
                # participate in the new gate.  Completed legacy Tasks may
                # remain artifact/manual-only; they are historical evidence,
                # not permission to execute or finish a new Task.
                if tid in current_plan_ids and tstatus == "in_progress":
                    try:
                        task_verification_commands(task, feat_id=feat_id)
                    except SystemExit as exc:
                        errors.append(normalize_error_text(exc))
            supersedes = task.get("supersedes")
            if not isinstance(supersedes, list):
                errors.append(f"{feat_id}/{tid}: supersedes must be a list")
            else:
                if len(set(str(item) for item in supersedes)) != len(supersedes):
                    errors.append(f"{feat_id}/{tid}: supersedes must not contain duplicates")
                for superseded_id in supersedes:
                    if not isinstance(superseded_id, str) or not TASK_ID_RE.fullmatch(superseded_id):
                        errors.append(f"{feat_id}/{tid}: supersedes entries must be task ids")
                    elif superseded_id == tid:
                        errors.append(f"{feat_id}/{tid}: task must not supersede itself")
            try:
                canonical_task_dependencies(task, label=f"{feat_id}/{tid}")
            except SystemExit as exc:
                errors.append(normalize_error_text(exc))
            introduced_revision = task.get("introduced_in_revision")
            if (
                not isinstance(introduced_revision, int)
                or isinstance(introduced_revision, bool)
                or introduced_revision < 1
                or not isinstance(plan_revision, int)
                or introduced_revision > plan_revision
            ):
                errors.append(f"{feat_id}/{tid}: reviewed task requires introduced_in_revision")
            superseded_by = task.get("superseded_by")
            if tid in current_plan_ids and superseded_by:
                errors.append(f"{feat_id}/{tid}: current-plan task must not be superseded")
            if tid not in current_plan_ids:
                if not task_has_execution_evidence(task):
                    errors.append(f"{feat_id}/{tid}: historical task requires preserved execution evidence")
                if not isinstance(superseded_by, list) or not superseded_by:
                    errors.append(f"{feat_id}/{tid}: historical task requires superseded_by lineage")

    if explicit_plan and tasks.get("plan_status") == "reviewed":
        by_id = {
            str(task.get("id")): task
            for task in task_items
            if isinstance(task, dict) and str(task.get("id") or "")
        }
        missing_current = current_plan_ids - set(by_id)
        if missing_current:
            errors.append(f"{feat_id}: latest plan_history references missing tasks: {', '.join(sorted(missing_current))}")
        declared_latest_supersedes = {
            superseded_id
            for task_id in current_plan_ids
            for superseded_id in (
                by_id.get(task_id, {}).get("supersedes", [])
                if isinstance(by_id.get(task_id, {}).get("supersedes", []), list)
                else []
            )
        }
        history = tasks.get("plan_history")
        cumulative_superseded_ids = {
            str(task_id)
            for entry in history
            if isinstance(entry, dict)
            for task_id in entry.get("superseded_task_ids", [])
            if isinstance(task_id, str)
        } if isinstance(history, list) else set()
        if (
            not latest_superseded_ids.issubset(declared_latest_supersedes)
            or not declared_latest_supersedes.issubset(cumulative_superseded_ids)
        ):
            errors.append(f"{feat_id}: current task supersedes lineage drifts from latest plan_history")
        known_plan_task_ids = set(by_id)
        if isinstance(history, list):
            for entry in history:
                if isinstance(entry, dict) and isinstance(entry.get("task_ids"), list):
                    known_plan_task_ids.update(str(item) for item in entry["task_ids"])
        for task_id, task in by_id.items():
            superseded_by = task.get("superseded_by")
            if not isinstance(superseded_by, list):
                continue
            invalid_targets = {
                str(target)
                for target in superseded_by
                if not isinstance(target, str) or target not in known_plan_task_ids
            }
            if invalid_targets:
                errors.append(f"{feat_id}/{task_id}: superseded_by references unknown tasks")
        try:
            current_plan_task_graph(tasks, feat_id=feat_id)
        except SystemExit as exc:
            errors.append(normalize_error_text(exc))

    if status not in CLOSED_FEAT_STATUS and has_reviewed_task_plan(tasks):
        try:
            expected_status = derived_feature_status(state, tasks)
        except SystemExit as exc:
            errors.append(normalize_error_text(exc))
        else:
            if status != expected_status:
                errors.append(
                    f"{feat_id}: feature status drift from Task frontier: "
                    f"expected {expected_status}, found {status}"
                )
            if status == "blocked" and not blockers:
                errors.append(f"{feat_id}: blocked Feature requires Task blocker evidence")
    if workspace_mode == "proposal_only" and in_progress:
        errors.append(f"{feat_id}: proposal_only feat must not have in_progress tasks")

    if status in CLOSED_FEAT_STATUS:
        try:
            canonical_closeout_review(
                root,
                tasks.get("closeout_review"),
                feat_id=feat_id,
            )
        except SystemExit as exc:
            errors.append(normalize_error_text(exc))
    elif "closeout_review" in tasks:
        errors.append(f"{feat_id}: closeout_review is valid only in final closed tasks.json")

    feat_dir = paths.feat_dir(feat_id, status=str(state.get("status") or ""))
    if feat_dir.exists():
        is_closed = str(state.get("status") or "") in CLOSED_FEAT_STATUS
        allowed_files = set(
            FEATURE_REQUIRED_ROOT_FILES | FEATURE_DERIVED_ROOT_FILES | FEATURE_CONTROL_ROOT_FILES
        )
        if is_closed:
            allowed_files |= set(FEATURE_CLOSEOUT_ROOT_FILES)
        else:
            allowed_files |= set(FEATURE_OPTIONAL_ROOT_FILES)
        for child in sorted(feat_dir.iterdir()):
            name = child.name
            rel = child.relative_to(root).as_posix()
            if child.is_dir():
                if name not in FEATURE_ALLOWED_ROOT_DIRS:
                    errors.append(f"{feat_id}: unsupported feature-root directory: {rel}")
                continue
            if name not in allowed_files:
                errors.append(
                    f"{feat_id}: {unsupported_feature_root_file_error(rel, closed_root=is_closed)}"
                )
        if is_closed:
            summary_file = paths.feat_summary(feat_id, status=str(state.get("status") or ""))
            if not summary_file.exists():
                errors.append(f"{feat_id}: closed feat missing summary.md")

    receipt_path = paths.feat_owner_receipt(feat_id, status=str(status or ""))
    receipt_required = has_reviewed_task_plan(tasks) or state.get("goal_contract") is not None
    if receipt_required and not receipt_path.exists():
        errors.append(f"{feat_id}: missing owner-receipt.json for canonical Feature control state")
    elif receipt_path.exists():
        try:
            load_current_owner_receipt(paths, state, tasks)
        except SystemExit as exc:
            errors.append(normalize_error_text(exc))

    return errors


def validate_runtime_relation_consistency(paths: HarnessPaths, feat_ids: list[str]) -> list[str]:
    errors: list[str] = []
    statuses: dict[str, str] = {}
    relations_by_feat: dict[str, list[dict[str, str]]] = {}
    roles_by_feat: dict[str, str] = {}

    for feat_id in feat_ids:
        state, _tasks = load_feat(paths, feat_id)
        statuses[feat_id] = str(state.get("status") or "")
        try:
            roles_by_feat[feat_id] = canonical_runtime_role(state.get("runtime_role"), feat_id=feat_id)
            relations_by_feat[feat_id] = canonical_runtime_relations(state.get("runtime_relations"), feat_id=feat_id)
        except SystemExit:
            continue

    relation_lookup = {
        (feat_id, rel["relation"], rel["feat_id"])
        for feat_id, relations in relations_by_feat.items()
        for rel in relations
    }

    for feat_id, relations in relations_by_feat.items():
        for rel in relations:
            target = rel["feat_id"]
            relation = rel["relation"]
            if target not in statuses:
                errors.append(f"{feat_id}: runtime relation target missing from tracker index: {target}")
                continue
            expected_reverse = RUNTIME_RELATION_REVERSE[relation]
            if (target, expected_reverse, feat_id) not in relation_lookup:
                errors.append(
                    f"{feat_id}: runtime relation `{relation}` to {target} is missing reverse `{expected_reverse}` relation"
                )
            target_role = roles_by_feat.get(target)
            if relation == "frontdoor_for" and target_role not in {"execution_owner", "foreground_owner", "standalone"}:
                errors.append(
                    f"{feat_id}: frontdoor_for target {target} must stay execution_owner, foreground_owner, or standalone, found {target_role or '<missing>'}"
                )
            if relation == "handoff_from" and target_role != "frontdoor_context":
                errors.append(
                    f"{feat_id}: handoff_from target {target} must stay frontdoor_context, found {target_role or '<missing>'}"
                )

    return errors


def cmd_validate(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    ensure_git_repo(root)

    errors: list[str] = []
    if not paths.index_file.exists():
        errors.append(f"missing index file: {paths.index_file}")
    if not paths.runtime_policy_file.exists():
        if paths.legacy_config_file.exists():
            errors.append(
                "legacy policy file is not supported: "
                f"{paths.legacy_config_file}. "
                "migrate manually to runtime-policy.json."
            )
        else:
            errors.append(f"missing runtime policy file: {paths.runtime_policy_file}")

    if paths.index_file.exists():
        try:
            index_data = load_index(paths)
        except SystemExit as exc:
            errors.append(str(exc))
        else:
            issuance = index_data.get("feature_id_issuance", {})
            if not isinstance(issuance, dict):
                errors.append("feature_id_issuance missing or invalid in features.json")
            else:
                if str(issuance.get("scheme") or "") != FEATURE_ID_SCHEME:
                    errors.append("feature_id_issuance.scheme drift from runtime")
                next_cursor = issuance.get("next_cursor")
                if not isinstance(next_cursor, int) or next_cursor < 0:
                    errors.append("feature_id_issuance.next_cursor must be a non-negative integer")

    legacy_dirs = [
        paths.harness_dir / "feats",
        paths.harness_dir / "feats-archived",
        paths.harness_dir / "feats-discarded",
    ]
    for legacy_dir in legacy_dirs:
        if legacy_dir.exists():
            errors.append(legacy_runtime_path_error(root, legacy_dir))

    feats: list[str] = []
    feat_status_by_id: dict[str, str] = {}
    if paths.index_file.exists():
        try:
            index_data = load_index(paths)
            for item in index_data.get("features", []):
                feat_id = str(item.get("feat_id", ""))
                if not feat_id:
                    continue
                feats.append(feat_id)
                feat_status_by_id[feat_id] = str(item.get("status") or "")
        except SystemExit as exc:
            errors.append(str(exc))

    harness_gitignore = paths.harness_dir / ".gitignore"
    if harness_gitignore.exists():
        ignored_lines = {line.strip() for line in harness_gitignore.read_text(encoding="utf-8").splitlines() if line.strip()}
        for rule in ("artifacts/*.log", "local/"):
            if rule not in ignored_lines:
                errors.append(f"tracker .gitignore missing rule: {rule}")
    else:
        errors.append(f"missing tracker .gitignore: {harness_gitignore}")

    tracked_local = tracked_paths_under(root, Path(".bagakit/feature-tracker/local"))
    if tracked_local:
        errors.append(
            "local issuer state must not be tracked: " + ", ".join(sorted(tracked_local))
        )

    if paths.issuer_file.exists():
        try:
            issuer_payload = load_local_issuer(paths)
        except SystemExit as exc:
            errors.append(str(exc))
        else:
            if not isinstance(issuer_payload, dict):
                errors.append(f"invalid local issuer payload: {paths.issuer_file}")
            else:
                if int(issuer_payload.get("version", 0)) != LOCAL_ISSUER_VERSION:
                    errors.append(f"local issuer version drift: {paths.issuer_file}")
                if str(issuer_payload.get("scheme") or "") != FEATURE_ID_SCHEME:
                    errors.append(f"local issuer scheme drift: {paths.issuer_file}")
                namespace = str(issuer_payload.get("namespace") or "")
                if not is_public_token(namespace, width=FEAT_NAMESPACE_WIDTH):
                    errors.append(f"local issuer namespace invalid: {paths.issuer_file}")
                if str(issuer_payload.get("guard_key_source") or "") != f"git-config:{LOCAL_GUARD_KEY_CONFIG}":
                    errors.append(f"local issuer guard source drift: {paths.issuer_file}")

    for feat_id in feats:
        errors.extend(validate_feat(paths, root, feat_id))
    if feats:
        errors.extend(validate_runtime_relation_consistency(paths, feats))

    # Validate physical archive layout.
    for feat_id, status in feat_status_by_id.items():
        active_dir = paths.feat_dir(feat_id)
        closed_dirs = {
            closed_status: paths.feat_dir(feat_id, status=closed_status)
            for closed_status in CLOSED_FEAT_STATUS
        }
        if status in CLOSED_FEAT_STATUS:
            if active_dir.exists():
                errors.append(
                    f"{feat_id}: closed feat dir must not exist in features directory: "
                    f"{relative_display(root, active_dir)}"
                )
            closed_dir = closed_dirs[status]
            if not closed_dir.exists():
                errors.append(
                    f"{feat_id}: {status} feat dir missing: {relative_display(root, closed_dir)}"
                )
        else:
            if not active_dir.exists():
                errors.append(
                    f"{feat_id}: feat dir missing: {relative_display(root, active_dir)}"
                )
            for closed_status, closed_dir in closed_dirs.items():
                if closed_dir.exists():
                    errors.append(
                        f"{feat_id}: non-{closed_status} feat dir must not exist in "
                        f"{closed_dir.parent.name} directory: {relative_display(root, closed_dir)}"
                    )

    # Detect feat directories missing from index (active + archived).
    if paths.feats_dir.exists():
        for child in sorted(paths.feats_dir.iterdir()):
            if child.is_dir() and child.name not in feats:
                errors.append(f"feature directory not indexed: {child.name}")
    if paths.feats_archived_dir.exists():
        for child in sorted(paths.feats_archived_dir.iterdir()):
            if child.is_dir() and child.name not in feats:
                errors.append(f"archived feature directory not indexed: {child.name}")
    if paths.feats_discarded_dir.exists():
        for child in sorted(paths.feats_discarded_dir.iterdir()):
            if child.is_dir() and child.name not in feats:
                errors.append(f"discarded feature directory not indexed: {child.name}")
    if paths.feats_transferred_dir.exists():
        for child in sorted(paths.feats_transferred_dir.iterdir()):
            if child.is_dir() and child.name not in feats:
                errors.append(f"transferred feature directory not indexed: {child.name}")

    try:
        active_states, _ = load_non_archived_feats(paths)
        families: dict[str, list[str]] = {}
        for feat_id, state in active_states.items():
            family_slug = str(state.get("slug") or "")
            if family_slug:
                families.setdefault(family_slug, []).append(feat_id)
        for family_slug, family_ids in sorted(families.items()):
            if len(family_ids) > 1:
                errors.append(
                    "active feature family is not unique: "
                    f"slug={family_slug}; features={','.join(sorted(family_ids, key=feat_sort_key))}"
                )
        build_dag_projection_payload(active_states, all_status_by_feat=feat_status_by_id)
    except SystemExit as exc:
        errors.append(normalize_error_text(exc))

    if errors:
        for err in errors:
            eprint(f"error: {err}")
        eprint(f"failed: {len(errors)} validation error(s)")
        return 1

    print("ok: validation passed")
    return 0


def cmd_doctor(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)

    val_code = cmd_validate(
        argparse.Namespace(
            root=str(root),
        )
    )
    if val_code != 0:
        eprint("doctor: validation failed; continuing read-only diagnostics")

    config = load_runtime_policy(paths)
    thresholds = config.get("stop_thresholds", {}) if isinstance(config, dict) else {}
    gate_fail_limit = int(thresholds.get("gate_fail_streak", 3))
    no_progress_limit = int(thresholds.get("no_progress_rounds", 2))
    max_round = int(thresholds.get("max_round_count", 8))

    index_data = load_index(paths)
    warnings: list[str] = []

    for item in index_data.get("features", []):
        feat_id = str(item.get("feat_id", ""))
        state, tasks = load_feat(paths, feat_id)
        counters = state.get("counters", {})
        fail_streak = int(counters.get("gate_fail_streak", 0))
        no_progress = int(counters.get("no_progress_rounds", 0))
        rounds = int(counters.get("round_count", 0))
        status = str(state.get("status") or "")

        if status in CLOSED_FEAT_STATUS:
            summary_file = paths.feat_summary(feat_id, status=status)
            if not summary_file.exists():
                warnings.append(f"{feat_id}: {status} feat missing summary.md")
            continue

        if status == "done":
            warnings.append(f"{feat_id}: status=done remains active; run closeout-feature")

        if fail_streak >= gate_fail_limit:
            warnings.append(
                f"{feat_id}: gate_fail_streak={fail_streak} reached threshold {gate_fail_limit}"
            )
        if no_progress >= no_progress_limit:
            warnings.append(
                f"{feat_id}: no_progress_rounds={no_progress} reached threshold {no_progress_limit}"
            )
        if rounds >= max_round:
            warnings.append(
                f"{feat_id}: round_count={rounds} reached threshold {max_round}"
            )

        if status == "in_progress" and count_tasks(tasks, "in_progress") == 0:
            warnings.append(f"{feat_id}: feature status in_progress but no task in_progress")

    print("== doctor report ==")
    if warnings:
        for w in warnings:
            print(f"warn: {w}")
    else:
        print("no warnings")

    print("\nrecommended next steps:")
    print("1) Address threshold warnings before starting next task.")
    print("2) Run feature-tracker.sh run-task-gate before finishing every task.")
    print("3) Close completed or superseded feats explicitly with archive-feature or discard-feature.")
    if getattr(args, "closeout_plan", False):
        print("\ncloseout plan:")
        plan_lines = active_closeout_plan_lines(root, paths)
        if plan_lines:
            for line in plan_lines:
                print(f"- {line}")
        else:
            print("- no active closeout candidates")
    return val_code


def parse_dependency_spec(raw: str) -> tuple[str, list[str]]:
    if ":" not in raw:
        raise SystemExit(
            "error: invalid dependency spec. expected '<feat-id>:<dep-id>[,<dep-id>...]'"
        )
    feat_id, dep_blob = raw.split(":", 1)
    feat_id = feat_id.strip()
    if not is_valid_feat_id(feat_id):
        raise SystemExit(f"error: invalid feat id in dependency spec: {feat_id}")

    deps: list[str] = []
    seen: set[str] = set()
    dep_blob = dep_blob.strip()
    if dep_blob:
        for raw_dep in dep_blob.split(","):
            dep = raw_dep.strip()
            if not dep:
                continue
            if not is_valid_feat_id(dep):
                raise SystemExit(f"error: invalid dependency feat id: {dep}")
            if dep == feat_id:
                raise SystemExit(f"error: feat cannot depend on itself: {feat_id}")
            if dep in seen:
                continue
            seen.add(dep)
            deps.append(dep)
    return feat_id, deps


def build_layered_dag(
    feat_ids: list[str],
    deps_by_feat: dict[str, set[str]],
) -> list[list[str]]:
    remaining: set[str] = set(feat_ids)
    unresolved: dict[str, set[str]] = {
        feat_id: set(deps_by_feat.get(feat_id, set())) for feat_id in feat_ids
    }
    dependents: dict[str, set[str]] = {feat_id: set() for feat_id in feat_ids}
    for feat_id, deps in unresolved.items():
        for dep in deps:
            dependents.setdefault(dep, set()).add(feat_id)

    layers: list[list[str]] = []
    while remaining:
        ready = sorted(
            (feat_id for feat_id in remaining if not unresolved.get(feat_id, set())),
            key=feat_sort_key,
        )
        if not ready:
            cycle_nodes = sorted(remaining, key=feat_sort_key)
            raise SystemExit(
                "error: dependency cycle detected among feats: " + ", ".join(cycle_nodes)
            )

        layers.append(ready)
        for feat_id in ready:
            remaining.remove(feat_id)
        for feat_id in ready:
            for child in dependents.get(feat_id, set()):
                if child in remaining:
                    unresolved[child].discard(feat_id)

    return layers


def feature_status_by_id(paths: HarnessPaths) -> dict[str, str]:
    statuses: dict[str, str] = {}
    for item in load_index(paths).get("features", []):
        feat_id = str(item.get("feat_id", ""))
        if feat_id:
            statuses[feat_id] = str(item.get("status") or "")
    return statuses


def load_non_archived_feats(paths: HarnessPaths) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    index_data = load_index(paths)
    states: dict[str, dict[str, Any]] = {}
    tasks_by_feat: dict[str, dict[str, Any]] = {}
    for item in index_data.get("features", []):
        feat_id = str(item.get("feat_id", ""))
        if not feat_id:
            continue
        status = str(item.get("status") or "")
        if status in CLOSED_FEAT_STATUS:
            continue
        state, tasks = load_feat(paths, feat_id)
        states[feat_id] = state
        tasks_by_feat[feat_id] = tasks
    return states, tasks_by_feat


def build_dag_projection_payload(
    states: dict[str, dict[str, Any]],
    *,
    all_status_by_feat: dict[str, str],
) -> dict[str, Any]:
    feat_ids = sorted(states.keys(), key=feat_sort_key)
    if not feat_ids:
        return {
            "version": 1,
            "generated_by": "bagakit-feature-tracker",
            "features": [],
            "layers": [],
            "notes": [],
        }

    notes: list[str] = []
    deps_by_feat: dict[str, set[str]] = {}
    for feat_id, state in states.items():
        deps: set[str] = set()
        for dep in canonical_depends_on(state, feat_id=feat_id):
            dep_status = all_status_by_feat.get(dep, "")
            if dep_status == "archived":
                notes.append(f"{feat_id} depends on archived feat {dep}; treated as already satisfied")
                continue
            if dep_status in {"discarded", "transferred"}:
                raise SystemExit(
                    f"error: {feat_id} depends on {dep_status} feat {dep}; "
                    "update dependencies before replanning"
                )
            if dep not in states:
                notes.append(f"{feat_id} dependency missing from active DAG set: {dep}")
                continue
            deps.add(dep)
        deps_by_feat[feat_id] = deps
        for transfer in canonical_transferred_from(state.get("transferred_from"), feat_id=feat_id):
            source_id = transfer["feature_id"]
            notes.append(f"{feat_id} transferred from {source_id}; lineage is not an execution dependency")

    layers = build_layered_dag(feat_ids, deps_by_feat)
    layer_by_feat: dict[str, int] = {}
    for i, layer in enumerate(layers):
        for feat_id in layer:
            layer_by_feat[feat_id] = i

    dependents_by_feat: dict[str, list[str]] = {feat_id: [] for feat_id in feat_ids}
    for feat_id, deps in deps_by_feat.items():
        for dep in sorted(deps, key=feat_sort_key):
            dependents_by_feat.setdefault(dep, []).append(feat_id)

    return {
        "version": 1,
        "generated_by": "bagakit-feature-tracker",
        "features": [
            {
                "feat_id": feat_id,
                "depends_on": sorted(deps_by_feat.get(feat_id, set()), key=feat_sort_key),
                "dependents": sorted(dependents_by_feat.get(feat_id, []), key=feat_sort_key),
                "layer": layer_by_feat.get(feat_id),
                "transferred_from": canonical_transferred_from(
                    states[feat_id].get("transferred_from"),
                    feat_id=feat_id,
                ),
            }
            for feat_id in feat_ids
        ],
        "layers": [
            {
                "layer": i,
                "feat_ids": layer,
            }
            for i, layer in enumerate(layers)
        ],
        "notes": sorted(set(notes)),
    }


def compute_dag_projection(paths: HarnessPaths) -> dict[str, Any]:
    states, _ = load_non_archived_feats(paths)
    return build_dag_projection_payload(states, all_status_by_feat=feature_status_by_id(paths))


def cmd_replan_feats(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)

    states, tasks_by_feat = load_non_archived_feats(paths)
    proposed_states = {feat_id: copy.deepcopy(state) for feat_id, state in states.items()}
    all_status_by_feat = feature_status_by_id(paths)

    clear_ids = {str(item).strip() for item in (args.clear_dependencies or []) if str(item).strip()}
    for feat_id in clear_ids:
        if not is_valid_feat_id(feat_id):
            eprint(f"error: invalid feat id in --clear-dependencies: {feat_id}")
            return 1
        if feat_id not in states:
            eprint(f"error: feat not found (non-archived): {feat_id}")
            return 1

    set_deps: dict[str, list[str]] = {}
    for raw in args.dependency or []:
        feat_id, deps = parse_dependency_spec(str(raw))
        if feat_id not in states:
            eprint(f"error: feat not found (non-archived): {feat_id}")
            return 1
        set_deps[feat_id] = deps

    changed_feats: set[str] = set()
    for feat_id in clear_ids:
        state = proposed_states[feat_id]
        if state.get("depends_on") != []:
            state["depends_on"] = []
            state.setdefault("history", []).append(
                history_event("dag_dependencies_updated", "depends_on=none")
            )
            changed_feats.add(feat_id)

    for feat_id, deps in set_deps.items():
        state = proposed_states[feat_id]
        if state.get("depends_on") != deps:
            state["depends_on"] = deps
            state.setdefault("history", []).append(
                history_event(
                    "dag_dependencies_updated",
                    "depends_on=" + (",".join(deps) if deps else "none"),
                )
            )
            changed_feats.add(feat_id)

    try:
        payload = build_dag_projection_payload(proposed_states, all_status_by_feat=all_status_by_feat)
    except SystemExit as exc:
        eprint(str(exc))
        return 1

    for feat_id in sorted(changed_feats, key=feat_sort_key):
        save_feat(paths, feat_id, proposed_states[feat_id], tasks_by_feat[feat_id])

    print(f"updated_feature_count: {len(changed_feats)}")
    print(f"feature_count: {len(payload.get('features', []))}")
    print(f"layer_count: {len(payload.get('layers', []))}")

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


def cmd_show_feat_dag(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    try:
        payload = compute_dag_projection(paths)
    except SystemExit as exc:
        eprint(str(exc))
        return 1

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    print("projection: on-demand")
    features = payload.get("features", [])
    layers = payload.get("layers", [])
    print(f"feature_count: {len(features) if isinstance(features, list) else 0}")
    print(f"layer_count: {len(layers) if isinstance(layers, list) else 0}")
    if not isinstance(layers, list) or not layers:
        print("layers: none")
    else:
        print("layers:")
        for layer in layers:
            if not isinstance(layer, dict):
                continue
            layer_id = layer.get("layer")
            feat_ids = layer.get("feat_ids", [])
            print(f"- L{layer_id}: {' '.join(str(fid) for fid in feat_ids)}")

    if isinstance(features, list) and features:
        print("features:")
        for feature in features:
            if not isinstance(feature, dict):
                continue
            feat_id = str(feature.get("feat_id", ""))
            depends_on = feature.get("depends_on", [])
            dependents = feature.get("dependents", [])
            transferred_from = feature.get("transferred_from", [])
            layer = feature.get("layer")
            print(
                f"- {feat_id} | layer={layer} | depends_on={','.join(str(item) for item in depends_on) or 'none'} | "
                f"dependents={','.join(str(item) for item in dependents) or 'none'} | "
                f"transferred_from={','.join(str(item.get('feature_id')) for item in transferred_from if isinstance(item, dict)) or 'none'}"
            )

    notes = payload.get("notes", [])
    if isinstance(notes, list) and notes:
        print("notes:")
        for note in notes:
            print(f"- {note}")
    return 0


def query_list(paths: HarnessPaths, *, scopes: set[str] | None = None) -> list[dict[str, Any]]:
    selected_scopes = scopes or set(DEFAULT_FEATURE_SCOPES)
    index_data = load_index(paths)
    out: list[dict[str, Any]] = []
    for item in index_data.get("features", []):
        feat_id = str(item.get("feat_id", ""))
        try:
            state, tasks = load_feat(paths, feat_id)
        except SystemExit:
            continue
        scope = feature_scope_for_status(str(state.get("status") or ""))
        if scope not in selected_scopes:
            continue
        frontier = feature_task_frontier(state, tasks)
        out.append(
            {
                "feat_id": feat_id,
                "title": state.get("title", ""),
                "status": state.get("status", ""),
                "scope": scope,
                "workspace_mode": state.get("workspace_mode", ""),
                "branch": state.get("branch", ""),
                "worktree": state.get("worktree_path", ""),
                "task_stats": {
                    "todo": count_current_tasks(tasks, "todo"),
                    "in_progress": count_current_tasks(tasks, "in_progress"),
                    "done": count_current_tasks(tasks, "done"),
                    "blocked": count_current_tasks(tasks, "blocked"),
                    "failed": count_current_tasks(tasks, "failed"),
                    "cancelled": count_current_tasks(tasks, "cancelled"),
                    "transferred": count_current_tasks(tasks, "transferred"),
                    "runnable": len(frontier["runnable"]),
                },
                "active_task_ids": frontier["active"],
                "runnable_task_ids": frontier["runnable"],
            }
        )
    return out


def query_one(paths: HarnessPaths, feat_id: str) -> dict[str, Any]:
    state, tasks = load_feat(paths, feat_id)
    frontier = feature_task_frontier(state, tasks)
    return {"state": state, "tasks": tasks, "task_frontier": frontier, "plan_audit": build_task_plan_audit(state, tasks)}


def build_task_plan_audit(state: dict[str, Any], tasks: dict[str, Any]) -> dict[str, Any]:
    """Derive review inputs and installed changes; never judge or edit edges."""
    feat_id = str(state.get("feat_id") or "")
    by_id = {str(task["id"]): task for task in current_plan_tasks(tasks)} if has_reviewed_task_plan(tasks) else {}
    frontier = feature_task_frontier(state, tasks)
    waiting_edges = []
    for target_id in frontier["waiting"]:
        target = by_id[target_id]
        for source_id in canonical_task_dependencies(target, label=f"{feat_id}/{target_id}"):
            source = by_id[source_id]
            if source.get("status") == "done":
                continue
            waiting_edges.append({
                "from": source_id,
                "to": target_id,
                "source_status": str(source.get("status") or "todo"),
                "source_outcome": source.get("outcome"),
                "target_title": target.get("title"),
                "target_acceptance": target.get("acceptance", []),
                "target_verification": target.get("verification", []),
                "decision": "replan_required" if source.get("status") in {"failed", "cancelled"} else "waiting",
                "question": "Is this result required to start the target, or only for the final acceptance join?",
            })
    all_tasks = {str(task["id"]): task for task in tasks.get("tasks", []) if isinstance(task, dict)}
    history = tasks.get("plan_history", [])
    replacements = []
    for task_id, task in all_tasks.items():
        if task.get("status") != "failed" or not task.get("superseded_by"):
            continue
        revision = next((entry for entry in history if task_id in entry.get("superseded_task_ids", [])), {})
        replacements.append({
            "failed_task_id": task_id,
            "assumption": task["failure"]["assumption"],
            "reason": task["failure"]["reason"],
            "plan_revision": revision.get("revision"),
            "review_ref": revision.get("review_ref"),
            "successors": [
                {"task_id": successor, "status": all_tasks.get(successor, {}).get("status", "historical"),
                 "current": successor in by_id}
                for successor in task["superseded_by"]
            ],
        })
    failed = current_task_failures(tasks, feat_id=feat_id)
    cancelled = frontier["cancelled"]
    needs_replan = bool(failed or cancelled) and state.get("status") not in CLOSED_FEAT_STATUS
    if state.get("status") in CLOSED_FEAT_STATUS:
        next_action = "Feature is closed; preserved Tasks are historical evidence."
    elif needs_replan:
        next_action = "Install a reviewed successor plan for failed or cancelled Tasks; continue independent work."
    elif frontier["active"] or frontier["runnable"]:
        next_action = (
            "Continue active Tasks: " + (", ".join(frontier["active"]) or "none")
            + "; runnable Tasks: " + (", ".join(frontier["runnable"]) or "none")
            + ". Waiting dependencies do not require another review."
        )
    elif frontier["blocked"]:
        next_action = "Resolve the recorded execution blocker; retain the current plan."
    elif state.get("status") == "done":
        next_action = "All Task outcomes are accepted; complete Feature closeout."
    else:
        next_action = "Follow the reviewed prerequisites; waiting alone does not require replanning."
    return {
        "feature_id": feat_id,
        "plan_revision": tasks.get("plan_revision"),
        "review_ref": tasks.get("review_ref"),
        "waiting_edges": waiting_edges,
        "parallelism_review": {
            "wave_semantics": "dependency_depth_not_dispatch_barrier",
            "runnable_now": frontier["runnable"],
            "continue_active": frontier["active"],
            "capacity_owner": "Host/Supervisor; use confirmed available capacity, not assumed scarcity",
            "edge_dispositions": ["retain_start_prerequisite", "remove_unnecessary_edge", "split_early_evidence_and_final_join", "bounded_provisional_lane"],
            "review_output": ["required_input_now", "useful_evidence_now", "candidate_ref", "rerun_on", "final_join", "dispatch_or_retention_reason"],
            "completion_rule": "Early review/test evidence never substitutes for exact final-candidate acceptance.",
        },
        "failed_tasks": failed,
        "replan_required_from": sorted([item["item_id"] for item in failed] + cancelled) if needs_replan else [],
        "delivery_summary": {
            "goal": state.get("goal", ""),
            "remaining": [
                {"task_id": task_id, "status": task["status"],
                 "outcome": task["outcome"], "acceptance": task["acceptance"]}
                for task_id, task in by_id.items() if task["status"] != "done"
            ] if state.get("status") not in CLOSED_FEAT_STATUS else [],
        },
        "installed_replacements": sorted(replacements, key=lambda item: item["failed_task_id"]),
        "latest_dependency_changes": history[-1].get("dependency_changes", {"added": [], "removed": []}) if history else {"added": [], "removed": []},
        "review_required": needs_replan,
        "next_action": next_action,
    }


def cmd_review_task_plan(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    try:
        state, tasks = load_feat(paths, args.feat)
        payload = build_task_plan_audit(state, tasks)
    except SystemExit as exc:
        eprint(str(exc))
        return 1
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0
    print(f"feature: {payload['feature_id']}")
    print(f"goal: {payload['delivery_summary']['goal']}")
    for item in payload["delivery_summary"]["remaining"]:
        print(f"- remaining {item['task_id']} [{item['status']}] | {item['outcome']}")
        for acceptance in item["acceptance"]:
            print(f"  acceptance: {acceptance}")
    for blocker in current_task_blockers(tasks, feat_id=args.feat):
        print(f"- blocked {blocker['item_id']} | {blocker['reason']} | resume_when={blocker.get('resume_when') or 'unspecified'}")
    print(f"plan_revision: {payload['plan_revision']}")
    print(f"review_required: {str(payload['review_required']).lower()}")
    print(f"next_action: {payload['next_action']}")
    for edge in payload["waiting_edges"]:
        print(f"- edge {edge['from']} -> {edge['to']} | source={edge['source_status']} | decision={edge['decision']}")
    for failure in payload["failed_tasks"]:
        print(f"- failed {failure['item_id']} | {failure['reason']} | assumption={failure['assumption']}")
    return 0


def query_filter(
    paths: HarnessPaths,
    *,
    scopes: set[str],
    feat_status: str | None,
    task_status: str | None,
    contains: str | None,
) -> list[dict[str, Any]]:
    items = query_list(paths, scopes=scopes)
    out: list[dict[str, Any]] = []
    needle = contains.lower() if contains else None

    for item in items:
        if feat_status and item.get("status") != feat_status:
            continue
        if task_status and int(item.get("task_stats", {}).get(task_status, 0)) == 0:
            continue
        if needle:
            hay = (
                f"{item.get('feat_id','')} "
                f"{item.get('title','')} "
                f"{item.get('branch','')} "
                f"{item.get('workspace_mode','')}"
            ).lower()
            if needle not in hay:
                continue
        out.append(item)
    return out


def cmd_query_list(args: argparse.Namespace) -> int:
    paths = HarnessPaths(Path(args.root).resolve())
    ensure_harness_exists(paths)
    scopes = parse_feature_scopes(args.scope)
    print(json.dumps({"features": query_list(paths, scopes=scopes)}, ensure_ascii=False, indent=2))
    return 0


def cmd_query_get(args: argparse.Namespace) -> int:
    paths = HarnessPaths(Path(args.root).resolve())
    ensure_harness_exists(paths)
    print(json.dumps(query_one(paths, args.feat), ensure_ascii=False, indent=2))
    return 0


def cmd_query_filter(args: argparse.Namespace) -> int:
    paths = HarnessPaths(Path(args.root).resolve())
    ensure_harness_exists(paths)
    scopes = parse_feature_scopes(args.scope)
    print(
        json.dumps(
            {
                "features": query_filter(
                    paths,
                    scopes=scopes,
                    feat_status=args.status,
                    task_status=args.task_status,
                    contains=args.contains,
                )
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="bagakit feature tracker")
    sub = p.add_subparsers(dest="cmd", required=True)

    def add_common(sp: argparse.ArgumentParser) -> None:
        sp.add_argument("--root", default=".")
        sp.add_argument("--skill-dir", default=str(Path(__file__).resolve().parent.parent))

    def add_closeout_review(sp: argparse.ArgumentParser) -> None:
        sp.add_argument(
            "--documentation-disposition",
            choices=sorted(CLOSEOUT_DOCUMENTATION_DISPOSITIONS),
            default="",
        )
        sp.add_argument("--documentation-rationale", default="")
        sp.add_argument("--documentation-ref", action="append", default=[])
        sp.add_argument(
            "--learning-disposition",
            choices=sorted(CLOSEOUT_LEARNING_DISPOSITIONS),
            default="",
        )
        sp.add_argument("--learning-rationale", default="")
        sp.add_argument("--learning-ref", action="append", default=[])
        sp.add_argument(
            "--promotion-disposition",
            choices=sorted(CLOSEOUT_PROMOTION_DISPOSITIONS),
            default="",
        )
        sp.add_argument("--promotion-rationale", default="")
        sp.add_argument("--promotion-ref", action="append", default=[])

    sp = sub.add_parser("initialize-tracker", help="apply tracker files into project")
    add_common(sp)
    sp.set_defaults(func=cmd_apply)

    sp = sub.add_parser("rekey-local-issuer", help="rotate the local issuer namespace and git-local guard key")
    add_common(sp)
    sp.set_defaults(func=cmd_rekey_local_issuer)

    sp = sub.add_parser("materialize-feature-artifact", help="write an optional feature helper file from the canonical template")
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.add_argument("--kind", choices=["proposal", "spec-delta", "verification"], required=True)
    sp.add_argument("--overwrite", action="store_true")
    sp.set_defaults(func=cmd_materialize_feature_artifact)

    sp = sub.add_parser("create-feature", help="create feature with explicit workspace mode")
    add_common(sp)
    sp.add_argument("--title", required=True)
    sp.add_argument("--slug", default="")
    sp.add_argument("--goal", required=True)
    sp.add_argument("--workspace-mode", choices=sorted(WORKSPACE_MODES), default=None)
    sp.add_argument("--branch-prefix", default=None)
    sp.add_argument("--tasks-file", default="")
    sp.add_argument(
        "--transferred-from",
        action="append",
        default=[],
        help="derive successor lineage from an existing Feature; repeat for multiple sources",
    )
    sp.set_defaults(func=cmd_feat_new)

    sp = sub.add_parser(
        "create-feature-from-planning-entry-handoff",
        help="create feature from an approved planning-entry handoff",
    )
    add_common(sp)
    sp.add_argument("--handoff", required=True)
    sp.add_argument("--slug", default="")
    sp.add_argument("--workspace-mode", choices=sorted(WORKSPACE_MODES), default=None)
    sp.add_argument("--branch-prefix", default=None)
    sp.set_defaults(func=cmd_feat_new_from_planning_entry_handoff)

    sp = sub.add_parser("set-task-plan", help="materialize or replace one reviewed semantic task plan")
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.add_argument("--tasks-file", required=True)
    sp.add_argument("--expected-revision", type=int, required=True)
    sp.set_defaults(func=cmd_set_task_plan)

    sp = sub.add_parser(
        "repair-reviewed-task-plan",
        help="replace a damaged reviewed tasks.json under exact content guards",
    )
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.add_argument("--tasks-file", required=True)
    sp.add_argument("--expected-state-sha256", required=True)
    sp.add_argument("--expected-tasks-sha256", required=True)
    sp.add_argument("--expected-goal-sha256", required=True)
    sp.add_argument("--expected-receipt-sha256", required=True)
    sp.set_defaults(func=cmd_repair_reviewed_task_plan)

    sp = sub.add_parser("repair-feature-projections", help="rebuild derived index and owner receipts from canonical Feature records")
    add_common(sp)
    sp.set_defaults(func=cmd_repair_feature_projections)

    sp = sub.add_parser("validate-feature-goal", help="validate a candidate or installed feature-owned goal.md")
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.add_argument("--goal-file", default="")
    sp.set_defaults(func=cmd_validate_feature_goal)

    sp = sub.add_parser("set-feature-goal", help="install or revise one feature-owned goal.md with revision guard")
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.add_argument("--goal-file", required=True)
    sp.add_argument("--expected-revision", required=True)
    sp.set_defaults(func=cmd_set_feature_goal)

    sp = sub.add_parser("assign-feature-workspace", help="assign current_tree/worktree to an existing feature")
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.add_argument("--workspace-mode", choices=["current_tree", "worktree"], required=True)
    sp.add_argument("--branch-prefix", default=None)
    sp.set_defaults(func=cmd_assign_feat_workspace)

    sp = sub.add_parser(
        "adopt-feature-worktree",
        help="bind an existing registered Git worktree to a reviewed feature",
    )
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.add_argument("--worktree-path", required=True)
    sp.add_argument("--branch", required=True)
    sp.set_defaults(func=cmd_adopt_feat_worktree)

    sp = sub.add_parser("show-feature-status", help="show feature status")
    add_common(sp)
    sp.add_argument(
        "--feature",
        dest="feat",
        default=None,
        help="text/JSON: inspect one Feature; HTML: focus and expand it while keeping the full active board",
    )
    status_output = sp.add_mutually_exclusive_group()
    status_output.add_argument("--json", action="store_true")
    status_output.add_argument("--format", choices=["text", "html"], default="text")
    sp.add_argument("--output", default=None, help="atomically write HTML outside tracker state")
    sp.set_defaults(func=cmd_feat_status)

    sp = sub.add_parser(
        "serve-feature-status",
        help="serve a live, read-only feature status page from canonical tracker files",
    )
    add_common(sp)
    sp.add_argument(
        "--feature",
        dest="feat",
        default=None,
        help="focus one Feature's details while keeping the full active board",
    )
    sp.add_argument("--port", type=int, default=0, help="loopback TCP port; 0 selects an available port")
    sp.add_argument(
        "--refresh-ms",
        type=int,
        default=5000,
        help="page reload interval in milliseconds, clamped to 1000..60000",
    )
    sp.set_defaults(func=cmd_serve_feature_status)

    sp = sub.add_parser(
        "watch-feature-status",
        help="render a live, read-only feature status view in the terminal",
    )
    add_common(sp)
    sp.add_argument(
        "--feature",
        dest="feat",
        default=None,
        help="focus one Feature's Task topology while keeping the full active board",
    )
    sp.add_argument(
        "--refresh-ms",
        type=int,
        default=5000,
        help="recompute interval in milliseconds, clamped to 1000..60000",
    )
    sp.set_defaults(func=cmd_watch_feature_status)

    sp = sub.add_parser("get-owner-receipt", help="read the current feature execution-owner receipt")
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.add_argument("--json", action="store_true")
    sp.set_defaults(func=cmd_get_owner_receipt)

    sp = sub.add_parser("start-task", help="start a task")
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.add_argument("--task", required=True)
    sp.set_defaults(func=cmd_task_start)

    sp = sub.add_parser("unstart-task", help="return an evidence-free active task to todo")
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.add_argument("--task", required=True)
    sp.add_argument("--expected-head", required=True)
    sp.set_defaults(func=cmd_task_unstart)

    sp = sub.add_parser("run-task-gate", help="execute gate checks")
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.add_argument("--task", required=True)
    sp.add_argument(
        "--rerun",
        action="store_true",
        help="rerun an identical gate after recording an explicit reason",
    )
    sp.add_argument(
        "--rerun-reason",
        default=None,
        help="reason recorded in Feature history when --rerun is used",
    )
    sp.set_defaults(func=cmd_task_gate)

    sp = sub.add_parser("finish-task", help="finish task with result")
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.add_argument("--task", required=True)
    sp.add_argument("--result", choices=["done", "blocked", "failed", "cancelled"], required=True)
    sp.add_argument(
        "--blocked-reason-class",
        choices=sorted(BLOCKED_REASON_CLASSES - {"none"}),
        default=None,
    )
    sp.add_argument("--blocked-reason", default=None)
    sp.add_argument("--blocked-owner", default=None, help="who or what can unblock this Task")
    sp.add_argument("--blocked-resume-when", default=None, help="evidence or event required to resume")
    sp.add_argument("--failure-reason", default=None)
    sp.add_argument("--failure-assumption", default=None)
    sp.add_argument("--cancel-reason", default=None)
    sp.set_defaults(func=cmd_task_finish)

    sp = sub.add_parser("closeout-feature", help="plan or execute feature closeout")
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.add_argument("--task", default="")
    sp.add_argument("--result", choices=["done", "blocked", "failed", "cancelled"], default=None)
    sp.add_argument(
        "--blocked-reason-class",
        choices=sorted(BLOCKED_REASON_CLASSES - {"none"}),
        default=None,
    )
    sp.add_argument("--blocked-reason", default=None)
    sp.add_argument("--blocked-owner", default=None, help="who or what can unblock this Task")
    sp.add_argument("--blocked-resume-when", default=None, help="evidence or event required to resume")
    sp.add_argument("--failure-reason", default=None)
    sp.add_argument("--failure-assumption", default=None)
    sp.add_argument("--cancel-reason", default=None)
    sp.add_argument("--mode", choices=["archive", "discard"], default="archive")
    sp.add_argument("--reason", choices=["stale", "superseded", "cancelled", "invalid"], default="")
    sp.add_argument("--replacement", default="")
    sp.add_argument("--archive-blocked", action="store_true")
    sp.add_argument("--execute", action="store_true")
    add_closeout_review(sp)
    sp.set_defaults(func=cmd_feat_closeout)

    sp = sub.add_parser("archive-feature", help="archive feature metadata without changing Git workspace")
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    add_closeout_review(sp)
    sp.set_defaults(func=cmd_feat_archive)

    sp = sub.add_parser("discard-feature", help="discard feature metadata without changing Git workspace")
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.add_argument("--reason", choices=["stale", "superseded", "cancelled", "invalid"], required=True)
    sp.add_argument("--replacement", default="")
    add_closeout_review(sp)
    sp.set_defaults(func=cmd_feat_discard)

    sp = sub.add_parser(
        "transfer-feature",
        help="transfer unfinished Feature Tasks to an existing successor Feature",
    )
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.add_argument("--replacement", required=True)
    add_closeout_review(sp)
    sp.set_defaults(func=cmd_feat_transfer)

    sp = sub.add_parser("validate-tracker", help="validate tracker consistency")
    add_common(sp)
    sp.set_defaults(func=cmd_validate)

    sp = sub.add_parser("diagnose-tracker", help="run doctor checks")
    add_common(sp)
    sp.add_argument("--closeout-plan", action="store_true")
    sp.set_defaults(func=cmd_doctor)

    sp = sub.add_parser("replan-features", help="update dependencies after validating the resulting active graph")
    add_common(sp)
    sp.add_argument(
        "--dependency",
        action="append",
        default=[],
        help="dependency override in '<feature-id>:<dep1>,<dep2>' format",
    )
    sp.add_argument("--clear-dependencies", action="append", default=[])
    sp.add_argument("--json", action="store_true")
    sp.set_defaults(func=cmd_replan_feats)

    sp = sub.add_parser("show-feature-dag", help="compute and show the current feature dependency graph")
    add_common(sp)
    sp.add_argument("--json", action="store_true")
    sp.set_defaults(func=cmd_show_feat_dag)

    sp = sub.add_parser("list-features", help="query features list")
    add_common(sp)
    sp.add_argument(
        "--scope",
        action="append",
        default=None,
        help="feature lifecycle scope: active, archived, discarded, transferred; repeat or comma-separate values; default active",
    )
    sp.set_defaults(func=cmd_query_list)

    sp = sub.add_parser("get-feature", help="query one feature")
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.set_defaults(func=cmd_query_get)

    sp = sub.add_parser(
        "review-task-plan",
        help="audit waiting dependency edges and failed assumptions without changing Tracker state",
    )
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.add_argument("--json", action="store_true")
    sp.set_defaults(func=cmd_review_task_plan)

    sp = sub.add_parser("filter-features", help="query features with filters")
    add_common(sp)
    sp.add_argument(
        "--scope",
        action="append",
        default=None,
        help="feature lifecycle scope: active, archived, discarded, transferred; repeat or comma-separate values; default active",
    )
    sp.add_argument("--status", default=None)
    sp.add_argument(
        "--task-status",
        choices=["todo", "runnable", "in_progress", "done", "blocked", "failed", "cancelled", "transferred"],
        default=None,
    )
    sp.add_argument("--contains", default=None)
    sp.set_defaults(func=cmd_query_filter)

    return p


def command_requires_global_tracker_lock(args: argparse.Namespace) -> bool:
    command = str(getattr(args, "cmd", "") or "")
    # Gate stages its own short tracker locks around long-running external
    # commands so unrelated tracker readers and writers are not blocked.
    return command in {
        "initialize-tracker",
        "rekey-local-issuer",
        "materialize-feature-artifact",
        "create-feature",
        "create-feature-from-planning-entry-handoff",
        "set-task-plan",
        "repair-reviewed-task-plan",
        "repair-feature-projections",
        "set-feature-goal",
        "assign-feature-workspace",
        "adopt-feature-worktree",
        "start-task",
        "unstart-task",
        "finish-task",
        "closeout-feature",
        "archive-feature",
        "discard-feature",
        "transfer-feature",
        "replan-features",
        "get-owner-receipt",
    }


def main(argv: Iterable[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(list(argv) if argv is not None else None)
    if command_requires_global_tracker_lock(args):
        root = Path(args.root).resolve()
        with tracker_state_lock(root, allow_create=str(args.cmd) == "initialize-tracker"):
            return int(args.func(args))
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
