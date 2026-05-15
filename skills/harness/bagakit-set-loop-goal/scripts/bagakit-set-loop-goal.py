"""Operator for bagakit-set-loop-goal."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ModuleNotFoundError as exc:  # pragma: no cover
    raise SystemExit("error: PyYAML is required for bagakit-set-loop-goal") from exc

sys.dont_write_bytecode = True

GOAL_SCHEMA = "bagakit.loop-goal.v1"
STATE_SCHEMA = "bagakit.goal-state.v1"
GOAL_PROTOCOL_VERSION = "bagakit.goal.v.0.1"
GOAL_UPGRADE_REPORT_SCHEMA = "bagakit.goal-upgrade-report.v1"
EVOLVER_REVIEW_SCHEMA = "bagakit.goal-evolver-review.v1"
GOAL_EVENT_SCHEMA = "bagakit.goal-event.v1"
GOAL_STATUSES = {
    "draft",
    "active",
    "paused",
    "blocked",
    "ready_for_review",
    "complete",
    "abandoned",
}
OPEN_GOAL_STATUSES = {"draft", "active", "paused", "blocked", "ready_for_review"}
RESUMABLE_TO_ACTIVE = {"draft", "paused", "ready_for_review"}
SUPERVISION_MODES = {"off", "self", "external"}
EVOLVER_REVIEW_TRIGGERS = {
    "before_round",
    "after_round",
    "risk",
    "stale",
    "pre_closeout",
    "session_end",
}
EVOLVER_REVIEW_STATUSES = {"requested", "completed", "blocked", "skipped"}
EVOLVER_REVIEW_APPROVALS = {"not_required", "pending", "approved", "rejected"}
EVOLVER_REVIEW_DISPOSITIONS = {"pending", "no_signal", "signal_candidate", "deferred"}
GOAL_EVENT_KINDS = {
    "goal_created",
    "goal_updated",
    "goal_reconciled",
    "goal_upgraded",
    "supervisor_checkpoint",
    "delta_proposed",
    "delta_applied",
    "status_changed",
}
GOAL_CONTROL_EFFECTS = {
    "none",
    "update_current_state",
    "replace_next_instruction",
    "patch_goal",
    "change_status",
    "ask_user",
}
GOAL_FILE_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}$")
EDGE_KIND_RE = re.compile(r"^[a-z][a-z0-9_]{0,62}$")
GOAL_PROTOCOL_RE = re.compile(r"^bagakit\.goal\.v\.(\d+)\.(\d+)$")
POSIX_SEP = chr(47)
ABSOLUTE_PATH_RE = re.compile(
    r"(^"
    + re.escape(POSIX_SEP)
    + r"|^[A-Za-z]:["
    + re.escape(POSIX_SEP)
    + r"\\]|file:"
    + re.escape(POSIX_SEP)
    + re.escape(POSIX_SEP)
    + r")"
)

KNOWN_SECTION_ORDER = [
    "Prime Directive",
    "Current State",
    "Execution Principles",
    "Acceptance And Stop Rules",
    "Orchestration Index",
    "Next Execution Instruction",
    "Recent Decisions",
    "Open Questions",
]
OBSOLETE_APPEND_ONLY_SECTIONS = {"Goal Delta Log"}
LEGACY_SECTION_ALIASES = {"Completion State": "Current State"}

WRAPPER_WITH_SUPERVISOR = """@./.bagakit/goal/current.md
Read current.md first; it resolves state.yaml, foreground_goal, and the active Goal.

@./.bagakit/goal/supervisor.md
Read supervisor.md when present; run checkpoint rules around bounded work.

Context may be stale or wrong; recover from these files before trusting prior context.
"""

WRAPPER_WITHOUT_SUPERVISOR = """@./.bagakit/goal/current.md
Read current.md first; it resolves state.yaml, foreground_goal, and the active Goal.

Context may be stale or wrong; recover from this file before trusting prior context.
"""


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: Any) -> None:
    write_text(path, json.dumps(data, indent=2, ensure_ascii=False, sort_keys=True) + "\n")


def load_yaml(path: Path) -> Any:
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    return data


def dump_yaml(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        yaml.safe_dump(data, handle, sort_keys=False, allow_unicode=True)


def require_nonempty(value: str | None, label: str) -> str:
    if value is None or not value.strip():
        raise SystemExit(f"error: {label} must be a non-empty string")
    return value.strip()


def ensure_no_absolute_paths(values: list[str], label: str, allow_absolute: bool) -> None:
    if allow_absolute:
        return
    for item in values:
        if ABSOLUTE_PATH_RE.search(item):
            raise SystemExit(
                f"error: {label} contains an absolute or file URI path; use repo-relative paths or pass --allow-absolute-paths"
            )


def ensure_repo_relative_refs(root: Path, values: list[str], label: str) -> None:
    ensure_no_absolute_paths(values, label, False)
    resolved_root = root.resolve()
    for item in values:
        try:
            relative = (resolved_root / item).resolve().relative_to(resolved_root)
        except ValueError as exc:
            raise SystemExit(f"error: {label} escapes the repository root: {item}") from exc
        if relative == Path("."):
            raise SystemExit(f"error: {label} must point to a repository artifact: {item}")


def slugify(value: str) -> str:
    out = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    if not out:
        out = "goal"
    return out[:63]


def parse_frontmatter_markdown(text: str) -> tuple[dict[str, Any], str]:
    if not text.startswith("---\n"):
        raise SystemExit("error: goal file must start with YAML frontmatter")
    lines = text.splitlines()
    closing_index = None
    for idx in range(1, len(lines)):
        if lines[idx] == "---":
            closing_index = idx
            break
    if closing_index is None:
        raise SystemExit("error: goal file frontmatter is not closed")
    frontmatter_text = "\n".join(lines[1:closing_index])
    body = "\n".join(lines[closing_index + 1 :]).lstrip("\n")
    frontmatter = yaml.safe_load(frontmatter_text) or {}
    if not isinstance(frontmatter, dict):
        raise SystemExit("error: goal file frontmatter must be a mapping")
    return frontmatter, body


def dump_frontmatter_markdown(frontmatter: dict[str, Any], body: str) -> str:
    yaml_text = yaml.safe_dump(frontmatter, sort_keys=False, allow_unicode=True).strip()
    return f"---\n{yaml_text}\n---\n\n{body.rstrip()}\n"


def parse_goal_sections(body: str) -> tuple[str, dict[str, str], list[tuple[str, str]]]:
    title = ""
    sections: dict[str, str] = {}
    extras: list[tuple[str, str]] = []
    current_heading: str | None = None
    buffer: list[str] = []
    lines = body.splitlines()
    for line in lines:
        if line.startswith("# Goal: "):
            title = line[len("# Goal: ") :].strip()
            continue
        if line.startswith("## "):
            if current_heading is not None:
                text = "\n".join(buffer).strip()
                if current_heading in KNOWN_SECTION_ORDER:
                    sections[current_heading] = text
                else:
                    extras.append((current_heading, text))
            current_heading = line[len("## ") :].strip()
            buffer = []
            continue
        buffer.append(line)
    if current_heading is not None:
        text = "\n".join(buffer).strip()
        if current_heading in KNOWN_SECTION_ORDER:
            sections[current_heading] = text
        else:
            extras.append((current_heading, text))
    return title, sections, extras


def render_list_section(lines: list[str], default_text: str = "- none") -> str:
    cleaned = [line.rstrip() for line in lines if line.strip()]
    if not cleaned:
        return default_text
    out: list[str] = []
    for line in cleaned:
        if line.lstrip().startswith(("-", "*")):
            out.append(line)
        else:
            out.append(f"- {line}")
    return "\n".join(out)


def render_goal_body(title: str, sections: dict[str, str], extras: list[tuple[str, str]]) -> str:
    parts = [f"# Goal: {title}"]
    for heading in KNOWN_SECTION_ORDER:
        parts.append(f"## {heading}\n{sections.get(heading, '').strip()}".rstrip())
    for heading, text in extras:
        parts.append(f"## {heading}\n{text}".rstrip())
    return "\n\n".join(part for part in parts if part.strip()) + "\n"


def drop_obsolete_append_only_sections(extras: list[tuple[str, str]]) -> list[tuple[str, str]]:
    return [(heading, text) for heading, text in extras if heading not in OBSOLETE_APPEND_ONLY_SECTIONS]


def surface_root(root: Path) -> Path:
    return root / ".bagakit" / "goal"


def surface_paths(root: Path) -> dict[str, Path]:
    goal_root = surface_root(root)
    return {
        "root": goal_root,
        "surface_toml": goal_root / "surface.toml",
        "current": goal_root / "current.md",
        "state": goal_root / "state.yaml",
        "supervisor": goal_root / "supervisor.md",
        "events": goal_root / "events",
        "reviews": goal_root / "reviews",
        "upgrade": goal_root / "upgrade.json",
        "archive": goal_root / "archive",
    }


def goal_path(root: Path, goal_id: str) -> Path:
    return surface_root(root) / f"{goal_id}.md"


def archived_goal_path(root: Path, goal_id: str) -> Path:
    return surface_root(root) / "archive" / f"{goal_id}.md"


def evolver_review_path(root: Path, review_id: str) -> Path:
    return surface_root(root) / "reviews" / f"{review_id}.json"


def goal_event_path(root: Path, goal_id: str) -> Path:
    return surface_root(root) / "events" / f"{goal_id}.jsonl"


def default_surface_toml() -> str:
    return f"""schema_version = 1
protocol_version = "{GOAL_PROTOCOL_VERSION}"
surface_id = "goal-runtime"
surface_root = ".bagakit/goal"
owner_kind = "skill"
owner_id = "bagakit-set-loop-goal"
lifecycle_class = "durable_state"
edit_policy = "mixed"
cleanup_safe = false
source_of_truth = [
  "docs/specs/runtime-surface-contract.md",
  "skills/harness/bagakit-set-loop-goal/SKILL.md",
  "skills/harness/bagakit-set-loop-goal/references/goal-file-contract.md",
  "skills/harness/bagakit-set-loop-goal/references/event-stream-contract.md",
  "skills/harness/bagakit-set-loop-goal/references/protocol-upgrade-contract.md",
  "skills/harness/bagakit-set-loop-goal/references/loop-off-loop.md",
]
reviewable_outputs = [
  "current.md",
  "state.yaml",
  "supervisor.md",
  "<goal-id>.md",
  "events/<goal-id>.jsonl",
  "reviews/<review-id>.json",
  "upgrade.json",
  "archive/<goal-id>.md",
  "archive/<goal-id>.events.jsonl",
]
"""


def current_md_text(has_supervisor: bool, has_foreground: bool) -> str:
    supervisor_line = ""
    if has_supervisor:
        supervisor_line = (
            "If `.bagakit/goal/supervisor.md` exists, read it before\n"
            "execution and run its checkpoint rules."
        )
    if has_foreground:
        middle = (
            "Read `.bagakit/goal/state.yaml`, resolve `foreground_goal`, then read that Goal\n"
            "file before acting."
        )
    else:
        middle = (
            "No foreground Goal is currently selected. Read `.bagakit/goal/state.yaml`,\n"
            "choose or create a foreground Goal, then read that Goal file before acting."
        )
    lines = ["# Current Goal", "", middle]
    if supervisor_line:
        lines.extend(["", supervisor_line])
    lines.extend(["", "Context may be stale or wrong; recover from these files before trusting prior context."])
    return "\n".join(lines) + "\n"


def supervisor_md_text() -> str:
    return """# Goal Supervisor

## Role Boundary
- Inner loop: execute one bounded step toward the foreground Goal.
- Supervisor checkpoint: observe evidence, detect drift, and update the Goal or
  next instruction before more implementation.
- Do not become a second executor.

## Checkpoint Cadence
- Run before each bounded execution round.
- Run after each bounded execution round.
- Run before claiming `status: complete`.

## Drift Classes
- target drift
- method drift
- scope drift
- evidence drift
- retry drift
- risk drift
- context drift

## Packet
```toml
goal_state_file = ".bagakit/goal/state.yaml"
goal_file = ".bagakit/goal/<goal-id>.md"
foreground_goal = "<goal-id>"
status = "on_track" # on_track | needs_correction | blocked | ready_to_stop
goal_delta = "none" # none | clarify | narrow | broaden | replace
sidecar = "not_needed" # not_needed | dispatched | pending | unavailable | incorporated
drift = []
evidence = []
goal_patch = ""
next_instruction = ""
stop_rule = ""
user_question = ""
```

## Evolver Review Checkpoints
- Use event-bound review triggers: `before_round`, `after_round`, `risk`,
  `stale`, `pre_closeout`, or opportunistic `session_end`.
- `stale` means expected evidence is missing; do not add a timer or daemon.
- Store request/receipt state under `.bagakit/goal/reviews/`; Goal does not own
  Evolver topic, adoption, routing, or promotion state.

## Rules
- Patch the Goal only when new information changes execution direction or
  recovery.
- Ask before changing the promised outcome, dropping a requirement, or taking
  irreversible, privacy-sensitive, publication, or cost-bearing action.
- Distill sidecar output into a Goal delta, risk, non-goal, acceptance
  criterion, open question, or owner-file pointer.
"""


def default_state_data() -> dict[str, Any]:
    return {
        "schema": STATE_SCHEMA,
        "protocol_version": GOAL_PROTOCOL_VERSION,
        "foreground_goal": None,
        "supervision": {
            "mode": "off",
            "contract": ".bagakit/goal/supervisor.md",
            "checkpoint": "before_action_and_after_round",
        },
        "goals": {},
        "edges": [],
        "archive": {"dir": ".bagakit/goal/archive"},
    }


def load_state(root: Path) -> dict[str, Any]:
    state = load_yaml(surface_paths(root)["state"])
    if state is None:
        return default_state_data()
    if not isinstance(state, dict):
        raise SystemExit("error: state.yaml must be a mapping")
    return state


def save_state(root: Path, state: dict[str, Any]) -> None:
    dump_yaml(surface_paths(root)["state"], state)


def read_goal_doc(path: Path) -> tuple[dict[str, Any], str, dict[str, str], list[tuple[str, str]]]:
    frontmatter, body = parse_frontmatter_markdown(read_text(path))
    title, sections, extras = parse_goal_sections(body)
    return frontmatter, title, sections, extras


def goal_status(frontmatter: dict[str, Any], path: Path) -> str:
    status = frontmatter.get("status")
    if status not in GOAL_STATUSES:
        raise SystemExit(f"error: {path}: invalid goal status `{status}`")
    return str(status)


def normalize_goal_id(goal_id: str | None, title: str | None) -> str:
    if goal_id:
        value = goal_id.strip()
    elif title:
        value = slugify(title)
    else:
        raise SystemExit("error: either --goal-id or --title is required")
    if not GOAL_FILE_RE.fullmatch(value):
        raise SystemExit("error: goal id must use lowercase letters, digits, and hyphens only")
    return value


def protocol_key(value: Any) -> tuple[int, int] | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("protocol version must be a string")
    match = GOAL_PROTOCOL_RE.fullmatch(value)
    if not match:
        raise ValueError(f"invalid Goal protocol version: {value}")
    return int(match.group(1)), int(match.group(2))


def protocol_relation(value: Any) -> str:
    if value is None:
        return "missing"
    try:
        current = protocol_key(GOAL_PROTOCOL_VERSION)
        candidate = protocol_key(value)
    except ValueError:
        return "invalid"
    if candidate == current:
        return "current"
    if candidate is not None and current is not None and candidate < current:
        return "older"
    return "newer"


def read_surface_protocol(path: Path) -> tuple[Any, bool]:
    if not path.exists():
        return None, False
    text = read_text(path)
    matches = re.findall(r'(?m)^protocol_version\s*=\s*"([^"]+)"\s*$', text)
    if len(matches) > 1:
        return None, True
    return (matches[0] if matches else None), False


def upgrade_conflict(
    conflict_id: str,
    kind: str,
    goal_ids: list[str],
    evidence_refs: list[str],
    options: list[str],
    recommended: str,
    risk_if_wrong: str,
    route: str = "bagakit-grill",
) -> dict[str, Any]:
    return {
        "conflict_id": conflict_id,
        "kind": kind,
        "goal_ids": goal_ids,
        "evidence_refs": evidence_refs,
        "options": options,
        "recommended": recommended,
        "risk_if_wrong": risk_if_wrong,
        "route": route,
    }


def build_upgrade_plan(
    root: Path,
    *,
    foreground_override: str | None = None,
    pause_goal_ids: set[str] | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    paths = surface_paths(root)
    actions: list[dict[str, Any]] = []
    conflicts: list[dict[str, Any]] = []
    prepared: dict[str, dict[str, Any]] = {}
    discovered_goal_ids: set[str] = set()
    pause_goal_ids = pause_goal_ids or set()

    surface_version, surface_invalid = read_surface_protocol(paths["surface_toml"])
    if surface_invalid:
        actions.append({"kind": "rewrite_surface_toml", "path": ".bagakit/goal/surface.toml"})
    else:
        relation = protocol_relation(surface_version)
        if relation in {"missing", "older"}:
            actions.append({"kind": "set_protocol_version", "path": ".bagakit/goal/surface.toml"})
        elif relation in {"newer", "invalid"}:
            conflicts.append(
                upgrade_conflict(
                    "future-surface-protocol" if relation == "newer" else "invalid-surface-protocol",
                    "unsupported_future_protocol" if relation == "newer" else "invalid_protocol_version",
                    [],
                    [".bagakit/goal/surface.toml"],
                    ["install a newer Goal skill", "inspect without mutation"] if relation == "newer" else ["repair protocol metadata", "rewrite the generated surface file"],
                    "Install a Goal skill that supports the newer protocol." if relation == "newer" else "Repair invalid protocol metadata before upgrade.",
                    "Downgrading may discard state that this skill does not understand." if relation == "newer" else "Invalid protocol metadata prevents reliable version ordering.",
                    "install_newer_skill" if relation == "newer" else "repair_protocol_metadata",
                )
            )

    raw_state: dict[str, Any] = {}
    state_invalid = False
    if paths["state"].exists():
        try:
            loaded_state = load_yaml(paths["state"])
            if isinstance(loaded_state, dict):
                raw_state = loaded_state
            else:
                state_invalid = True
        except yaml.YAMLError:
            state_invalid = True
    if state_invalid:
        conflicts.append(
            upgrade_conflict(
                "invalid-state-yaml",
                "invalid_state",
                [],
                [".bagakit/goal/state.yaml"],
                ["restore a valid state file", "rebuild state from Goal files"],
                "Rebuild state from readable Goal frontmatter after confirming the foreground Goal.",
                "An invalid registry can hide unfinished Goals or select the wrong foreground.",
            )
        )
    else:
        state_relation = protocol_relation(raw_state.get("protocol_version"))
        if state_relation in {"missing", "older"}:
            actions.append({"kind": "set_protocol_version", "path": ".bagakit/goal/state.yaml"})
        elif state_relation in {"newer", "invalid"}:
            conflicts.append(
                upgrade_conflict(
                    "future-state-protocol" if state_relation == "newer" else "invalid-state-protocol",
                    "unsupported_future_protocol" if state_relation == "newer" else "invalid_protocol_version",
                    [],
                    [".bagakit/goal/state.yaml"],
                    ["install a newer Goal skill", "inspect without mutation"] if state_relation == "newer" else ["repair protocol metadata", "rebuild state after review"],
                    "Install a Goal skill that supports the newer protocol." if state_relation == "newer" else "Repair invalid protocol metadata before upgrade.",
                    "Downgrading may corrupt topology or lifecycle state." if state_relation == "newer" else "Invalid protocol metadata prevents reliable version ordering.",
                    "install_newer_skill" if state_relation == "newer" else "repair_protocol_metadata",
                )
            )
        if raw_state.get("schema") != STATE_SCHEMA:
            actions.append({"kind": "repair_state_schema", "path": ".bagakit/goal/state.yaml"})

    state_entries = raw_state.get("goals") if isinstance(raw_state.get("goals"), dict) else {}
    goal_files = sorted(
        path
        for path in paths["root"].glob("*.md")
        if path.name not in {"current.md", "supervisor.md"}
    ) if paths["root"].exists() else []

    for path in goal_files:
        rel = str(path.relative_to(root))
        try:
            frontmatter, title, sections, extras = read_goal_doc(path)
        except SystemExit as exc:
            conflicts.append(
                upgrade_conflict(
                    f"unreadable-{path.stem}",
                    "unreadable_goal",
                    [path.stem],
                    [rel],
                    ["restore valid frontmatter", "reconstruct the Goal", "explicitly abandon after review"],
                    "Restore enough Goal meaning to classify lifecycle and acceptance before upgrade.",
                    str(exc).removeprefix("error: "),
                )
            )
            continue

        goal_id = frontmatter.get("goal_id")
        if goal_id is None and GOAL_FILE_RE.fullmatch(path.stem):
            goal_id = path.stem
            frontmatter["goal_id"] = goal_id
            actions.append({"kind": "infer_goal_id", "goal_id": goal_id, "path": rel})
        if not isinstance(goal_id, str) or not GOAL_FILE_RE.fullmatch(goal_id):
            conflicts.append(
                upgrade_conflict(
                    f"invalid-goal-id-{path.stem}",
                    "invalid_goal_identity",
                    [path.stem],
                    [rel],
                    ["set a stable goal_id", "rename the Goal file", "correct the premise"],
                    "Use one stable lowercase goal id that matches the file name.",
                    "Unstable identity can attach events or topology to the wrong Goal.",
                )
            )
            continue
        if goal_id != path.stem:
            conflicts.append(
                upgrade_conflict(
                    f"identity-mismatch-{goal_id}",
                    "goal_identity_mismatch",
                    [goal_id, path.stem],
                    [rel],
                    [f"rename file to {goal_id}.md", f"change goal_id to {path.stem}", "correct the topology"],
                    "Preserve the identity referenced by owner files and make the filename match it.",
                    "Choosing the wrong identity can orphan references and event history.",
                )
            )
            continue
        discovered_goal_ids.add(goal_id)

        relation = protocol_relation(frontmatter.get("protocol_version"))
        if relation in {"missing", "older"}:
            frontmatter["protocol_version"] = GOAL_PROTOCOL_VERSION
            actions.append({"kind": "set_protocol_version", "goal_id": goal_id, "path": rel})
        elif relation in {"newer", "invalid"}:
            conflicts.append(
                upgrade_conflict(
                    f"unsupported-protocol-{goal_id}",
                    "unsupported_future_protocol" if relation == "newer" else "invalid_protocol_version",
                    [goal_id],
                    [rel],
                    ["install a compatible Goal skill", "correct invalid metadata after review"],
                    "Do not rewrite a Goal whose protocol meaning is not understood.",
                    "A forced rewrite may discard newer or unknown control semantics.",
                    "install_newer_skill" if relation == "newer" else "bagakit-grill",
                )
            )
            continue

        if frontmatter.get("schema") != GOAL_SCHEMA:
            frontmatter["schema"] = GOAL_SCHEMA
            actions.append({"kind": "repair_goal_schema", "goal_id": goal_id, "path": rel})
        status = frontmatter.get("status")
        if status not in GOAL_STATUSES:
            conflicts.append(
                upgrade_conflict(
                    f"lifecycle-{goal_id}",
                    "unknown_lifecycle",
                    [goal_id],
                    [rel],
                    ["paused", "blocked", "complete", "abandoned", "correct the premise"],
                    "Classify the Goal lifecycle from current owner evidence before upgrade.",
                    "A wrong lifecycle can hide unfinished work or falsely claim completion.",
                )
            )
            continue
        if goal_id in pause_goal_ids:
            if status not in OPEN_GOAL_STATUSES:
                conflicts.append(
                    upgrade_conflict(
                        f"pause-closed-{goal_id}",
                        "invalid_resolution",
                        [goal_id],
                        [rel],
                        ["remove the pause override", "correct lifecycle first"],
                        "Do not pause a closed Goal.",
                        "The override contradicts the Goal lifecycle.",
                    )
                )
                continue
            frontmatter["status"] = "paused"
            status = "paused"
            actions.append({"kind": "apply_pause_resolution", "goal_id": goal_id, "path": rel})

        completion_evidence = frontmatter.get("completion_evidence")
        if completion_evidence is None:
            completion_evidence = []
            frontmatter["completion_evidence"] = []
            actions.append({"kind": "initialize_completion_evidence", "goal_id": goal_id, "path": rel})
        if not isinstance(completion_evidence, list):
            conflicts.append(
                upgrade_conflict(
                    f"completion-evidence-{goal_id}",
                    "invalid_completion_evidence",
                    [goal_id],
                    [rel],
                    ["repair evidence refs", "reclassify lifecycle"],
                    "Restore completion evidence as a list of concise observable results.",
                    "Malformed evidence prevents truthful lifecycle recovery.",
                )
            )
            continue
        if status == "complete" and not completion_evidence:
            conflicts.append(
                upgrade_conflict(
                    f"completion-claim-{goal_id}",
                    "unproven_completion",
                    [goal_id],
                    [rel],
                    ["add completion evidence", "set ready_for_review", "set paused", "correct the premise"],
                    "Do not preserve status=complete without observable completion evidence.",
                    "The upgrade could turn an unsupported claim into durable truth.",
                )
            )
            continue

        if not title.strip():
            conflicts.append(
                upgrade_conflict(
                    f"missing-title-{goal_id}",
                    "incomplete_goal_content",
                    [goal_id],
                    [rel],
                    ["restore the Goal title", "reconstruct the Goal", "correct the premise"],
                    "Restore the human-readable Goal identity before upgrade.",
                    "A titleless Goal is difficult to distinguish during multi-Goal recovery.",
                )
            )
            continue
        for legacy_heading, current_heading in LEGACY_SECTION_ALIASES.items():
            legacy_values = [text for heading, text in extras if heading == legacy_heading and text.strip()]
            if not sections.get(current_heading, "").strip() and legacy_values:
                sections[current_heading] = legacy_values[0]
                extras = [(heading, text) for heading, text in extras if heading != legacy_heading]
                actions.append(
                    {
                        "kind": "map_legacy_goal_section",
                        "goal_id": goal_id,
                        "from": legacy_heading,
                        "to": current_heading,
                        "path": rel,
                    }
                )

        required_core = [
            "Prime Directive",
            "Current State",
            "Execution Principles",
            "Acceptance And Stop Rules",
            "Orchestration Index",
            "Next Execution Instruction",
        ]
        missing_core = [heading for heading in required_core if not sections.get(heading, "").strip()]
        if missing_core:
            conflicts.append(
                upgrade_conflict(
                    f"incomplete-{goal_id}",
                    "incomplete_goal_content",
                    [goal_id],
                    [rel],
                    ["reconstruct missing sections", "recover from owner files", "correct the premise"],
                    "Use owner truth and Grill when needed to restore the missing control meaning.",
                    "Missing sections prevent a fresh executor from recovering safely: " + ", ".join(missing_core),
                )
            )
            continue
        if not sections.get("Recent Decisions", "").strip():
            sections["Recent Decisions"] = "- none"
            actions.append({"kind": "add_recent_decisions", "goal_id": goal_id, "path": rel})
        if not sections.get("Open Questions", "").strip():
            sections["Open Questions"] = "- none"
            actions.append({"kind": "add_open_questions", "goal_id": goal_id, "path": rel})

        legacy_logs = [text for heading, text in extras if heading in OBSOLETE_APPEND_ONLY_SECTIONS and text.strip()]
        extras = drop_obsolete_append_only_sections(extras)
        requires_reconciliation = bool(legacy_logs and status in OPEN_GOAL_STATUSES)
        if legacy_logs:
            actions.append({"kind": "archive_legacy_goal_log", "goal_id": goal_id, "path": rel})
        if requires_reconciliation:
            actions.append({"kind": "require_reconciliation", "goal_id": goal_id, "path": rel})

        frontmatter["truth_surface"] = (
            f".bagakit/goal/archive/{goal_id}.md"
            if status in {"complete", "abandoned"}
            else f".bagakit/goal/{goal_id}.md"
        )
        if status in {"complete", "abandoned"}:
            archive_destination = archived_goal_path(root, goal_id)
            if archive_destination.exists() and archive_destination != path:
                conflicts.append(
                    upgrade_conflict(
                        f"archive-collision-{goal_id}",
                        "archive_collision",
                        [goal_id],
                        [rel, str(archive_destination.relative_to(root))],
                        ["compare both Goal files", "choose the authoritative archive", "correct the identity"],
                        "Preserve both files until their lifecycle and evidence are reconciled.",
                        "Automatic overwrite could destroy completion or recovery evidence.",
                    )
                )
                continue
            actions.append({"kind": "archive_closed_goal", "goal_id": goal_id, "path": rel})

        event_path = goal_event_path(root, goal_id)
        archived_event_path = paths["archive"] / f"{goal_id}.events.jsonl"
        if status in {"complete", "abandoned"} and event_path.exists() and archived_event_path.exists():
            conflicts.append(
                upgrade_conflict(
                    f"archive-event-collision-{goal_id}",
                    "archive_collision",
                    [goal_id],
                    [str(event_path.relative_to(root)), str(archived_event_path.relative_to(root))],
                    ["compare both event streams", "choose one authoritative stream", "preserve both under distinct ids"],
                    "Resolve the event history collision before archiving the Goal.",
                    "Automatic overwrite could erase audit history.",
                    "repair_event_stream",
                )
            )
            continue
        events: list[dict[str, Any]] = []
        create_event = not event_path.exists()
        if not create_event:
            try:
                events = load_goal_events(root, goal_id)
            except SystemExit as exc:
                conflicts.append(
                    upgrade_conflict(
                        f"event-stream-{goal_id}",
                        "invalid_event_stream",
                        [goal_id],
                        [str(event_path.relative_to(root))],
                        ["repair the JSONL stream", "restore it from owner evidence", "archive it after review"],
                        "Repair event order and schema before upgrading the Goal.",
                        str(exc).removeprefix("error: "),
                        "repair_event_stream",
                    )
                )
                continue
        if create_event:
            actions.append({"kind": "create_upgrade_event", "goal_id": goal_id, "path": rel})

        entry = state_entries.get(goal_id) if isinstance(state_entries.get(goal_id), dict) else {}
        cursor = entry.get("reconciled_through")
        if create_event:
            cursor = 0 if requires_reconciliation else 1
        elif not isinstance(cursor, int) or isinstance(cursor, bool) or cursor < 0 or cursor > len(events):
            if all(event.get("control_effect") == "none" for event in events):
                cursor = len(events)
                actions.append({"kind": "repair_reconciliation_cursor", "goal_id": goal_id, "path": rel})
            else:
                conflicts.append(
                    upgrade_conflict(
                        f"cursor-{goal_id}",
                        "unknown_reconciliation_cursor",
                        [goal_id],
                        [rel, str(event_path.relative_to(root))],
                        ["reconcile the Goal", "restore a known cursor", "inspect owner truth"],
                        "Reconcile current truth against the pending event stream before upgrade.",
                        "Guessing the cursor may skip an unapplied direction change.",
                        "reconcile-goal",
                    )
                )
                continue
        if not create_event and any(event.get("control_effect") != "none" for event in events[cursor:]):
            requires_reconciliation = True
            actions.append({"kind": "require_reconciliation", "goal_id": goal_id, "path": rel})

        prepared[goal_id] = {
            "source_path": path,
            "frontmatter": frontmatter,
            "title": title,
            "sections": sections,
            "extras": extras,
            "legacy_logs": legacy_logs,
            "status": status,
            "events": events,
            "create_event": create_event,
            "cursor": cursor,
            "requires_reconciliation": requires_reconciliation,
            "existing_role": entry.get("role") if isinstance(entry, dict) else None,
        }

    open_goal_ids = sorted(goal_id for goal_id, item in prepared.items() if item["status"] in OPEN_GOAL_STATUSES)
    closed_goal_ids = sorted(goal_id for goal_id, item in prepared.items() if item["status"] in {"complete", "abandoned"})
    foreground = foreground_override
    if foreground is not None and foreground not in open_goal_ids:
        conflicts.append(
            upgrade_conflict(
                "invalid-foreground-override",
                "invalid_resolution",
                [foreground],
                [".bagakit/goal/state.yaml"],
                ["select an incomplete Goal", "remove the override"],
                "Choose one readable incomplete Goal as foreground.",
                "The requested foreground is missing or already closed.",
            )
        )
        foreground = None
    if foreground is None:
        state_foreground = raw_state.get("foreground_goal")
        if isinstance(state_foreground, str) and state_foreground in open_goal_ids:
            foreground = state_foreground
        else:
            role_foregrounds = sorted(
                goal_id
                for goal_id in open_goal_ids
                if prepared[goal_id].get("existing_role") == "foreground"
            )
            if len(role_foregrounds) == 1:
                foreground = role_foregrounds[0]
            elif len(open_goal_ids) == 1:
                foreground = open_goal_ids[0]
                actions.append({"kind": "select_only_incomplete_goal", "goal_id": foreground})
            elif len(open_goal_ids) > 1:
                conflicts.append(
                    upgrade_conflict(
                        "foreground-selection",
                        "foreground_selection",
                        open_goal_ids,
                        [".bagakit/goal/state.yaml", *[f".bagakit/goal/{goal_id}.md" for goal_id in open_goal_ids]],
                        [
                            "select one listed Goal as foreground",
                            "consolidate related Goals before selecting foreground",
                            "correct the topology or premise",
                        ],
                        "Select the Goal protecting the currently promised outcome; pause other active Goals without abandoning them.",
                        "The executor may advance the wrong objective or hide unfinished work.",
                    )
                )

    if foreground is not None:
        for goal_id in open_goal_ids:
            if goal_id != foreground and prepared[goal_id]["status"] == "active":
                conflicts.append(
                    upgrade_conflict(
                        f"active-nonforeground-{goal_id}",
                        "active_nonforeground_goal",
                        [foreground, goal_id],
                        [f".bagakit/goal/{goal_id}.md", ".bagakit/goal/state.yaml"],
                        [f"pause {goal_id}", f"select {goal_id} instead", "correct the topology"],
                        f"Keep {foreground} foreground and pause {goal_id} unless the user intends to switch.",
                        "Leaving two Goals active makes execution ownership ambiguous.",
                    )
                )

    raw_edges = raw_state.get("edges") if isinstance(raw_state.get("edges"), list) else []
    edges: list[dict[str, str]] = []
    for edge_index, edge in enumerate(raw_edges, start=1):
        if not isinstance(edge, dict):
            conflicts.append(
                upgrade_conflict(
                    f"invalid-edge-{edge_index}",
                    "invalid_topology_edge",
                    [],
                    [".bagakit/goal/state.yaml"],
                    ["repair the edge", "remove it after review", "correct the topology"],
                    "Repair malformed topology instead of dropping it silently.",
                    "A malformed edge may encode scheduling intent that the upgrade cannot infer.",
                )
            )
            continue
        kind = edge.get("kind")
        from_goal = edge.get("from")
        to_goal = edge.get("to")
        if not isinstance(kind, str) or not EDGE_KIND_RE.fullmatch(kind):
            conflicts.append(
                upgrade_conflict(
                    f"invalid-edge-kind-{edge_index}",
                    "invalid_topology_relation",
                    [goal_id for goal_id in (from_goal, to_goal) if isinstance(goal_id, str)],
                    [".bagakit/goal/state.yaml"],
                    ["rename the relation", "remove it after review", "correct the topology"],
                    "Use a stable lowercase underscore relation id that preserves the original meaning.",
                    "An invalid relation cannot be recovered reliably across tools.",
                )
            )
            continue
        missing_endpoints = [
            goal_id
            for goal_id in (from_goal, to_goal)
            if not isinstance(goal_id, str) or goal_id not in discovered_goal_ids
        ]
        if missing_endpoints:
            conflicts.append(
                upgrade_conflict(
                    f"orphan-edge-{edge_index}",
                    "orphan_topology_edge",
                    [goal_id for goal_id in (from_goal, to_goal) if isinstance(goal_id, str)],
                    [".bagakit/goal/state.yaml"],
                    ["restore the missing Goal", "remove the edge after review", "correct the identity"],
                    "Preserve the edge until its missing endpoint is explained.",
                    "Dropping it may erase dependency or scheduling intent.",
                )
            )
            continue
        edges.append({"from": from_goal, "to": to_goal, "kind": kind})

    supervision = raw_state.get("supervision") if isinstance(raw_state.get("supervision"), dict) else {}
    mode = supervision.get("mode", "off")
    if mode not in SUPERVISION_MODES:
        mode = "off"
        actions.append({"kind": "repair_supervision_mode"})
    target_goals: dict[str, Any] = {}
    for goal_id in open_goal_ids:
        item = prepared[goal_id]
        role = "foreground" if goal_id == foreground else item.get("existing_role") or "backlog"
        if role == "foreground" and goal_id != foreground:
            role = "backlog"
        target_goals[goal_id] = {
            "file": f".bagakit/goal/{goal_id}.md",
            "status": item["status"],
            "role": role,
            "event_log": f".bagakit/goal/events/{goal_id}.jsonl",
            "reconciled_through": item["cursor"],
        }
    target_state = {
        "schema": STATE_SCHEMA,
        "protocol_version": GOAL_PROTOCOL_VERSION,
        "foreground_goal": foreground,
        "supervision": {
            "mode": mode,
            "contract": ".bagakit/goal/supervisor.md",
            "checkpoint": supervision.get("checkpoint", "before_action_and_after_round"),
        },
        "goals": target_goals,
        "edges": sorted(edges, key=lambda item: (item["from"], item["to"], item["kind"])),
        "archive": {"dir": ".bagakit/goal/archive"},
    }

    for directory_key in ("events", "reviews", "archive"):
        if not paths[directory_key].is_dir():
            actions.append(
                {
                    "kind": "create_surface_directory",
                    "path": str(paths[directory_key].relative_to(root)),
                }
            )
    expected_current = current_md_text(mode != "off", bool(foreground))
    if not paths["current"].exists() or read_text(paths["current"]) != expected_current:
        actions.append({"kind": "regenerate_current_entrypoint", "path": ".bagakit/goal/current.md"})
    if mode != "off" and not paths["supervisor"].exists():
        actions.append({"kind": "materialize_supervisor_contract", "path": ".bagakit/goal/supervisor.md"})

    action_kinds = {action["kind"] for action in actions}
    report_status = (
        "blocked"
        if conflicts
        else "reconciliation_required"
        if action_kinds == {"require_reconciliation"}
        else "upgrade_required"
        if actions
        else "current"
    )
    report = {
        "schema": GOAL_UPGRADE_REPORT_SCHEMA,
        "target_protocol": GOAL_PROTOCOL_VERSION,
        "status": report_status,
        "inventory": {
            "goal_count": len(discovered_goal_ids),
            "open_goal_ids": open_goal_ids,
            "closed_goal_ids": closed_goal_ids,
            "foreground_goal": foreground,
        },
        "reconciliation_required_goal_ids": sorted(
            goal_id for goal_id, item in prepared.items() if item["requires_reconciliation"]
        ),
        "deterministic_actions": actions,
        "conflicts": conflicts,
        "next_instruction": (
            "Use bagakit-grill with .bagakit/goal/upgrade.json, resolve one semantic conflict at a time, then rerun upgrade-surface --apply."
            if any(conflict.get("route") == "bagakit-grill" for conflict in conflicts)
            else "Install a compatible Goal skill or repair the named technical evidence before retrying."
            if conflicts
            else "Run reconcile-goal for each listed Goal before normal execution."
            if report_status == "reconciliation_required"
            else "Run upgrade-surface --apply, then reconcile the listed Goals before normal execution."
            if any(item["requires_reconciliation"] for item in prepared.values())
            else "Run upgrade-surface --apply."
            if actions
            else "Goal surface already uses the current protocol."
        ),
    }
    internal = {"prepared": prepared, "target_state": target_state}
    return report, internal


def upgraded_surface_toml(path: Path) -> str:
    if not path.exists():
        return default_surface_toml()
    text = read_text(path)
    protocol_line = f'protocol_version = "{GOAL_PROTOCOL_VERSION}"'
    if re.search(r"(?m)^protocol_version\s*=", text):
        return re.sub(r'(?m)^protocol_version\s*=.*$', protocol_line, text)
    lines = text.splitlines()
    insert_at = 1 if lines and lines[0].startswith("schema_version") else 0
    lines.insert(insert_at, protocol_line)
    return "\n".join(lines).rstrip() + "\n"


def apply_upgrade_plan(root: Path, report: dict[str, Any], internal: dict[str, Any]) -> None:
    if report["conflicts"]:
        surface_paths(root)["root"].mkdir(parents=True, exist_ok=True)
        write_json(surface_paths(root)["upgrade"], report)
        raise SystemExit("error: Goal protocol upgrade is blocked; inspect .bagakit/goal/upgrade.json")

    paths = surface_paths(root)
    for key in ("root", "events", "reviews", "archive"):
        paths[key].mkdir(parents=True, exist_ok=True)
    write_text(paths["surface_toml"], upgraded_surface_toml(paths["surface_toml"]))

    for goal_id, item in internal["prepared"].items():
        source_path: Path = item["source_path"]
        status = item["status"]
        archived = status in {"complete", "abandoned"}
        destination = archived_goal_path(root, goal_id) if archived else goal_path(root, goal_id)
        write_text(
            destination,
            dump_frontmatter_markdown(
                item["frontmatter"],
                render_goal_body(item["title"], item["sections"], item["extras"]),
            ),
        )
        if source_path != destination and source_path.exists():
            source_path.unlink()

        if item["legacy_logs"]:
            legacy_path = paths["archive"] / f"{goal_id}.legacy-log.md"
            legacy_text = "\n\n".join(item["legacy_logs"])
            if not legacy_path.exists():
                write_text(
                    legacy_path,
                    f"# Legacy Goal Log: {item['title']}\n\nSource Goal: `{destination.relative_to(root)}`\n\n{legacy_text}\n",
                )

        active_event_path = goal_event_path(root, goal_id)
        event_destination = paths["archive"] / f"{goal_id}.events.jsonl" if archived else active_event_path
        if item["create_event"]:
            event = {
                "schema": GOAL_EVENT_SCHEMA,
                "seq": 1,
                "event_id": "e-000001",
                "goal_id": goal_id,
                "kind": "goal_upgraded",
                "owner": "bagakit-set-loop-goal",
                "summary": f"Upgraded Goal control plane to {GOAL_PROTOCOL_VERSION}.",
                "evidence_refs": [str(destination.relative_to(root))],
                "control_effect": "update_current_state" if item["requires_reconciliation"] else "none",
            }
            write_text(event_destination, json.dumps(event, ensure_ascii=False, sort_keys=True) + "\n")
        elif archived and active_event_path.exists():
            active_event_path.replace(event_destination)

    save_state(root, internal["target_state"])
    refresh_current(root, internal["target_state"])
    if internal["target_state"]["supervision"]["mode"] != "off" and not paths["supervisor"].exists():
        write_text(paths["supervisor"], supervisor_md_text())
    if paths["upgrade"].exists():
        paths["upgrade"].unlink()


def inspect_upgrade(args: argparse.Namespace) -> None:
    root = Path(args.root).resolve()
    report, _internal = build_upgrade_plan(
        root,
        foreground_override=args.foreground_goal,
        pause_goal_ids=set(args.pause_goal or []),
    )
    print(json.dumps(report, indent=2, ensure_ascii=False, sort_keys=True))


def upgrade_surface(args: argparse.Namespace) -> None:
    root = Path(args.root).resolve()
    report, internal = build_upgrade_plan(
        root,
        foreground_override=args.foreground_goal,
        pause_goal_ids=set(args.pause_goal or []),
    )
    if not args.apply:
        print(json.dumps(report, indent=2, ensure_ascii=False, sort_keys=True))
        return
    if report["status"] == "reconciliation_required":
        print(f"Goal surface protocol: {GOAL_PROTOCOL_VERSION}")
        for goal_id in report["reconciliation_required_goal_ids"]:
            print(f"reconcile_required: {goal_id}")
        return
    apply_upgrade_plan(root, report, internal)
    print(f"Goal surface protocol: {GOAL_PROTOCOL_VERSION}")
    for goal_id in report["reconciliation_required_goal_ids"]:
        print(f"reconcile_required: {goal_id}")


def unreconciled_goal_ids(root: Path, state: dict[str, Any] | None = None) -> list[str]:
    state = state or load_state(root)
    pending_goal_ids: list[str] = []
    for goal_id, entry in state.get("goals", {}).items():
        cursor = entry.get("reconciled_through")
        if not isinstance(cursor, int) or isinstance(cursor, bool) or cursor < 0:
            continue
        try:
            events = load_goal_events(root, goal_id)
        except SystemExit:
            continue
        if any(event.get("control_effect") != "none" for event in events[cursor:]):
            pending_goal_ids.append(goal_id)
    return sorted(pending_goal_ids)


def ensure_surface(
    root: Path,
    *,
    supervision_mode: str | None = None,
    allow_unreconciled: bool = False,
) -> dict[str, Path]:
    paths = surface_paths(root)
    preexisting = paths["root"].exists() and any(paths["root"].iterdir())
    if preexisting:
        report, internal = build_upgrade_plan(root)
        if report["status"] in {"blocked", "upgrade_required"}:
            apply_upgrade_plan(root, report, internal)
            if report["reconciliation_required_goal_ids"] and not allow_unreconciled:
                raise SystemExit(
                    "error: Goal protocol upgrade applied but reconciliation is required for: "
                    + ", ".join(report["reconciliation_required_goal_ids"])
                )
        elif report["status"] == "reconciliation_required" and not allow_unreconciled:
            raise SystemExit(
                "error: reconcile Goal control truth before normal mutation for: "
                + ", ".join(report["reconciliation_required_goal_ids"])
            )
        elif paths["upgrade"].exists():
            paths["upgrade"].unlink()
    paths["root"].mkdir(parents=True, exist_ok=True)
    paths["archive"].mkdir(parents=True, exist_ok=True)
    paths["events"].mkdir(parents=True, exist_ok=True)
    paths["reviews"].mkdir(parents=True, exist_ok=True)
    if not paths["surface_toml"].exists():
        write_text(paths["surface_toml"], default_surface_toml())
    state = load_state(root)
    if supervision_mode is not None:
        state["supervision"]["mode"] = supervision_mode
    save_state(root, state)
    write_text(
        paths["current"],
        current_md_text(
            state.get("supervision", {}).get("mode") != "off",
            bool(state.get("foreground_goal")),
        ),
    )
    if state.get("supervision", {}).get("mode") != "off" and not paths["supervisor"].exists():
        write_text(paths["supervisor"], supervisor_md_text())
    pending_goal_ids = unreconciled_goal_ids(root, state)
    if pending_goal_ids and not allow_unreconciled:
        raise SystemExit(
            "error: unreconciled Goal control events block normal mutation for: "
            + ", ".join(pending_goal_ids)
        )
    return paths


def normalize_registry_entry(
    goal_id: str,
    frontmatter: dict[str, Any],
    role: str | None,
    existing: dict[str, Any] | None = None,
) -> dict[str, Any]:
    status = goal_status(frontmatter, Path(f".bagakit/goal/{goal_id}.md"))
    existing = existing or {}
    return {
        "file": f".bagakit/goal/{goal_id}.md",
        "status": status,
        "role": role or ("foreground" if status == "active" else "backlog"),
        "event_log": f".bagakit/goal/events/{goal_id}.jsonl",
        "reconciled_through": existing.get("reconciled_through", 0),
    }


def refresh_current(root: Path, state: dict[str, Any]) -> None:
    write_text(
        surface_paths(root)["current"],
        current_md_text(
            state.get("supervision", {}).get("mode") != "off",
            bool(state.get("foreground_goal")),
        ),
    )


def pause_previous_foregrounds(root: Path, state: dict[str, Any], next_goal_id: str) -> list[str]:
    paused: list[str] = []
    for other_id, entry in state.get("goals", {}).items():
        if other_id == next_goal_id or entry.get("role") != "foreground":
            continue
        entry["role"] = "backlog"
        other_path = root / entry["file"]
        if not other_path.exists():
            continue
        frontmatter, title, sections, extras = read_goal_doc(other_path)
        if frontmatter.get("status") == "active":
            frontmatter["status"] = "paused"
            entry["status"] = "paused"
            write_text(other_path, dump_frontmatter_markdown(frontmatter, render_goal_body(title, sections, extras)))
            paused.append(other_id)
    return paused


def validate_goal_event(event: Any, path: Path, line_number: int, root: Path | None = None) -> list[str]:
    prefix = f"{path}:{line_number}"
    if not isinstance(event, dict):
        return [f"{prefix}: event must be a JSON object"]
    required = {
        "schema",
        "seq",
        "event_id",
        "goal_id",
        "kind",
        "owner",
        "summary",
        "evidence_refs",
        "control_effect",
    }
    issues: list[str] = []
    missing = sorted(required - set(event))
    if missing:
        return [f"{prefix}: missing fields: {', '.join(missing)}"]
    unexpected = sorted(set(event) - required)
    if unexpected:
        issues.append(f"{prefix}: unexpected fields: {', '.join(unexpected)}")
    if event.get("schema") != GOAL_EVENT_SCHEMA:
        issues.append(f"{prefix}: schema must be {GOAL_EVENT_SCHEMA}")
    seq = event.get("seq")
    if not isinstance(seq, int) or isinstance(seq, bool) or seq < 1:
        issues.append(f"{prefix}: seq must be a positive integer")
    elif event.get("event_id") != f"e-{seq:06d}":
        issues.append(f"{prefix}: event_id must match seq")
    if not isinstance(event.get("goal_id"), str) or not GOAL_FILE_RE.fullmatch(event["goal_id"]):
        issues.append(f"{prefix}: invalid goal_id")
    if event.get("kind") not in GOAL_EVENT_KINDS:
        issues.append(f"{prefix}: invalid kind")
    if not isinstance(event.get("owner"), str) or not event["owner"].strip():
        issues.append(f"{prefix}: owner must be a non-empty logical id")
    if not isinstance(event.get("summary"), str) or not event["summary"].strip():
        issues.append(f"{prefix}: summary must be non-empty")
    evidence_refs = event.get("evidence_refs")
    if not isinstance(evidence_refs, list) or not all(isinstance(item, str) and item.strip() for item in evidence_refs):
        issues.append(f"{prefix}: evidence_refs must be a list of non-empty strings")
    elif root is not None:
        try:
            ensure_repo_relative_refs(root, evidence_refs, "goal event evidence_refs")
        except SystemExit as exc:
            issues.append(f"{prefix}: {str(exc).removeprefix('error: ')}")
    if event.get("control_effect") not in GOAL_CONTROL_EFFECTS:
        issues.append(f"{prefix}: invalid control_effect")
    return issues


def load_goal_events(root: Path, goal_id: str) -> list[dict[str, Any]]:
    path = goal_event_path(root, goal_id)
    if not path.exists():
        return []
    events: list[dict[str, Any]] = []
    issues: list[str] = []
    for line_number, raw_line in enumerate(read_text(path).splitlines(), start=1):
        if not raw_line.strip():
            issues.append(f"{path.relative_to(root)}:{line_number}: blank JSONL line")
            continue
        try:
            event = json.loads(raw_line)
        except json.JSONDecodeError as exc:
            issues.append(f"{path.relative_to(root)}:{line_number}: invalid JSON: {exc.msg}")
            continue
        issues.extend(validate_goal_event(event, path.relative_to(root), line_number, root))
        if isinstance(event, dict):
            events.append(event)
    for expected_seq, event in enumerate(events, start=1):
        if event.get("seq") != expected_seq:
            issues.append(f"{path.relative_to(root)}: event sequence must be contiguous from 1")
            break
        if event.get("goal_id") != goal_id:
            issues.append(f"{path.relative_to(root)}:{expected_seq}: goal_id does not match filename")
    if issues:
        raise SystemExit("error: " + "; ".join(issues))
    return events


def append_goal_event_record(
    root: Path,
    goal_id: str,
    *,
    kind: str,
    owner: str,
    summary: str,
    evidence_refs: list[str],
    control_effect: str,
) -> dict[str, Any]:
    if not goal_path(root, goal_id).exists():
        raise SystemExit(f"error: active goal does not exist: {goal_id}")
    ensure_repo_relative_refs(root, evidence_refs, "goal event evidence_refs")
    events = load_goal_events(root, goal_id)
    seq = len(events) + 1
    event = {
        "schema": GOAL_EVENT_SCHEMA,
        "seq": seq,
        "event_id": f"e-{seq:06d}",
        "goal_id": goal_id,
        "kind": kind,
        "owner": require_nonempty(owner, "--owner"),
        "summary": require_nonempty(summary, "--summary"),
        "evidence_refs": list(dict.fromkeys(evidence_refs)),
        "control_effect": control_effect,
    }
    event_path = goal_event_path(root, goal_id)
    event_path.parent.mkdir(parents=True, exist_ok=True)
    with event_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False, sort_keys=True) + "\n")

    if control_effect == "none":
        state = load_state(root)
        entry = state.get("goals", {}).get(goal_id)
        if entry is not None:
            entry["event_log"] = f".bagakit/goal/events/{goal_id}.jsonl"
            entry["reconciled_through"] = seq
            save_state(root, state)
    return event


def append_goal_event(args: argparse.Namespace) -> None:
    root = Path(args.root).resolve()
    ensure_surface(root, allow_unreconciled=True)
    state = load_state(root)
    goal_id = require_nonempty(args.goal_id or state.get("foreground_goal"), "--goal-id or foreground_goal")
    event = append_goal_event_record(
        root,
        goal_id,
        kind=args.kind,
        owner=args.owner,
        summary=args.summary,
        evidence_refs=args.evidence_ref or [],
        control_effect=args.control_effect,
    )
    print(f".bagakit/goal/events/{goal_id}.jsonl#{event['seq']}")


def reconcile_goal(args: argparse.Namespace) -> None:
    root = Path(args.root).resolve()
    ensure_surface(root, allow_unreconciled=True)
    state = load_state(root)
    goal_id = require_nonempty(args.goal_id or state.get("foreground_goal"), "--goal-id or foreground_goal")
    path = goal_path(root, goal_id)
    if not path.exists():
        raise SystemExit(f"error: active goal does not exist: {goal_id}")
    frontmatter, title, sections, extras = read_goal_doc(path)
    extras = drop_obsolete_append_only_sections(extras)
    current_state = render_list_section(args.current_state_line)
    next_instruction = require_nonempty(args.next_instruction_text, "--next-instruction-text")
    decisions = render_list_section(args.decision_line)
    ensure_no_absolute_paths(
        [current_state, next_instruction, decisions, args.summary] + list(args.evidence_ref or []),
        "reconciliation content",
        args.allow_absolute_paths,
    )
    sections["Current State"] = current_state
    sections["Next Execution Instruction"] = next_instruction
    sections["Recent Decisions"] = decisions
    write_text(path, dump_frontmatter_markdown(frontmatter, render_goal_body(title, sections, extras)))

    event = append_goal_event_record(
        root,
        goal_id,
        kind="goal_reconciled",
        owner=args.owner,
        summary=args.summary,
        evidence_refs=args.evidence_ref or [],
        control_effect="none",
    )
    print(path.relative_to(root))
    print(f"event: .bagakit/goal/events/{goal_id}.jsonl#{event['seq']}")


def create_or_update_goal(args: argparse.Namespace) -> None:
    root = Path(args.root).resolve()
    seed: dict[str, Any] = {}
    if args.from_json:
        seed = load_json(Path(args.from_json).resolve())
        if not isinstance(seed, dict):
            raise SystemExit("error: --from-json must point to a JSON object")

    goal_id = normalize_goal_id(args.goal_id or seed.get("goal_id"), args.title or seed.get("title"))
    ensure_surface(root)
    state = load_state(root)
    path = goal_path(root, goal_id)
    is_new = not path.exists()

    existing_frontmatter: dict[str, Any] = {}
    existing_title = args.title or ""
    existing_sections: dict[str, str] = {}
    existing_extras: list[tuple[str, str]] = []
    if path.exists():
        existing_frontmatter, existing_title, existing_sections, existing_extras = read_goal_doc(path)
        existing_extras = drop_obsolete_append_only_sections(existing_extras)

    title = (args.title or seed.get("title") or existing_title or goal_id).strip()
    foreground_requested = args.foreground or bool(seed.get("foreground"))
    default_status = "active" if foreground_requested or not state.get("foreground_goal") else "paused"
    status = args.status or seed.get("status") or existing_frontmatter.get("status") or default_status
    if status not in GOAL_STATUSES:
        raise SystemExit(f"error: invalid goal status `{status}`")
    if status == "active" and state.get("foreground_goal") not in {None, goal_id} and not foreground_requested:
        raise SystemExit("error: a non-foreground Goal cannot be active; use status=paused or select it as foreground")
    prime_directive = args.prime_directive_text or seed.get("prime_directive_text") or existing_sections.get("Prime Directive", "")
    current_state = (
        render_list_section(args.current_state_line)
        if args.current_state_line
        else render_list_section(seed.get("current_state_line", []))
        if seed.get("current_state_line")
        else existing_sections.get("Current State", "")
    )
    principles = (
        render_list_section(args.principle_line)
        if args.principle_line
        else render_list_section(seed.get("principle_line", []))
        if seed.get("principle_line")
        else existing_sections.get("Execution Principles", "")
    )
    acceptance = (
        render_list_section(args.acceptance_line)
        if args.acceptance_line
        else render_list_section(seed.get("acceptance_line", []))
        if seed.get("acceptance_line")
        else existing_sections.get("Acceptance And Stop Rules", "")
    )
    orchestration = (
        render_list_section(args.orchestration_line)
        if args.orchestration_line
        else render_list_section(seed.get("orchestration_line", []))
        if seed.get("orchestration_line")
        else existing_sections.get("Orchestration Index", "")
    )
    next_instruction = args.next_instruction_text or seed.get("next_instruction_text") or existing_sections.get("Next Execution Instruction", "")
    decisions = (
        render_list_section(args.decision_line)
        if args.decision_line
        else render_list_section(seed.get("decision_line", []))
        if seed.get("decision_line")
        else existing_sections.get("Recent Decisions", "- none")
    )
    questions = (
        render_list_section(args.question_line)
        if args.question_line
        else render_list_section(seed.get("question_line", []))
        if seed.get("question_line")
        else existing_sections.get("Open Questions", "- none")
    )

    required_pairs = {
        "Prime Directive": prime_directive,
        "Current State": current_state,
        "Execution Principles": principles,
        "Acceptance And Stop Rules": acceptance,
        "Orchestration Index": orchestration,
        "Next Execution Instruction": next_instruction,
    }
    missing = [label for label, value in required_pairs.items() if not value.strip()]
    if missing:
        raise SystemExit(f"error: missing required goal sections: {', '.join(missing)}")

    all_lines = [prime_directive, current_state, principles, acceptance, orchestration, next_instruction, decisions, questions]
    completion_evidence_arg = args.completion_evidence or seed.get("completion_evidence") or []
    allow_absolute_paths = args.allow_absolute_paths or bool(seed.get("allow_absolute_paths"))
    ensure_no_absolute_paths(all_lines + list(completion_evidence_arg), "goal content", allow_absolute_paths)

    truth_surface = f".bagakit/goal/{goal_id}.md"
    completion_evidence = list(completion_evidence_arg or existing_frontmatter.get("completion_evidence") or [])
    if status == "complete" and not completion_evidence:
        raise SystemExit("error: status=complete requires at least one completion evidence entry")

    frontmatter = {
        "schema": GOAL_SCHEMA,
        "protocol_version": GOAL_PROTOCOL_VERSION,
        "goal_id": goal_id,
        "status": status,
        "truth_surface": truth_surface,
        "completion_evidence": completion_evidence,
    }
    sections = {
        "Prime Directive": prime_directive.strip(),
        "Current State": current_state.strip(),
        "Execution Principles": principles.strip(),
        "Acceptance And Stop Rules": acceptance.strip(),
        "Orchestration Index": orchestration.strip(),
        "Next Execution Instruction": next_instruction.strip(),
        "Recent Decisions": decisions.strip(),
        "Open Questions": questions.strip(),
    }
    write_text(path, dump_frontmatter_markdown(frontmatter, render_goal_body(title, sections, existing_extras)))

    entry_role = args.role or seed.get("role")
    foreground = foreground_requested
    paused_goal_ids: list[str] = []
    if foreground or not state.get("foreground_goal"):
        entry_role = "foreground"
        if status not in OPEN_GOAL_STATUSES:
            raise SystemExit("error: a foreground goal must use an incomplete status")
        paused_goal_ids = pause_previous_foregrounds(root, state, goal_id)
        state["foreground_goal"] = goal_id
        existing_entry = state.setdefault("goals", {}).get(goal_id)
        state["goals"][goal_id] = normalize_registry_entry(goal_id, frontmatter, "foreground", existing_entry)
    elif status in OPEN_GOAL_STATUSES:
        existing_entry = state.setdefault("goals", {}).get(goal_id)
        state["goals"][goal_id] = normalize_registry_entry(
            goal_id,
            frontmatter,
            entry_role or "backlog",
            existing_entry,
        )
    else:
        state.setdefault("goals", {}).pop(goal_id, None)
        if state.get("foreground_goal") == goal_id:
            state["foreground_goal"] = None

    save_state(root, state)
    for paused_goal_id in paused_goal_ids:
        append_goal_event_record(
            root,
            paused_goal_id,
            kind="status_changed",
            owner="bagakit-set-loop-goal",
            summary=f"Paused Goal because foreground switched to {goal_id}.",
            evidence_refs=[f".bagakit/goal/{paused_goal_id}.md", ".bagakit/goal/state.yaml"],
            control_effect="none",
        )
    if is_new:
        append_goal_event_record(
            root,
            goal_id,
            kind="goal_created",
            owner="bagakit-set-loop-goal",
            summary=f"Created Goal control plane: {title}",
            evidence_refs=[],
            control_effect="none",
        )
    elif args.decision_line:
        append_goal_event_record(
            root,
            goal_id,
            kind="goal_updated",
            owner="bagakit-set-loop-goal",
            summary="; ".join(line.strip() for line in args.decision_line if line.strip()),
            evidence_refs=[],
            control_effect="none",
        )
    refresh_current(root, state)
    print(path.relative_to(root))


def initialize_surface(args: argparse.Namespace) -> None:
    ensure_surface(Path(args.root).resolve(), supervision_mode=args.supervision_mode)
    print(".bagakit/goal")


def set_foreground(args: argparse.Namespace) -> None:
    root = Path(args.root).resolve()
    ensure_surface(root)
    state = load_state(root)
    goal_id = require_nonempty(args.goal_id, "--goal-id")
    path = goal_path(root, goal_id)
    if not path.exists():
        raise SystemExit(f"error: goal does not exist: {goal_id}")
    frontmatter, title, sections, extras = read_goal_doc(path)
    status = goal_status(frontmatter, path)
    if status not in OPEN_GOAL_STATUSES:
        raise SystemExit("error: only incomplete goals may become foreground")
    paused_goal_ids = pause_previous_foregrounds(root, state, goal_id)
    existing_entry = state.setdefault("goals", {}).get(goal_id)
    state["goals"][goal_id] = normalize_registry_entry(goal_id, frontmatter, "foreground", existing_entry)
    for other_id, entry in state.get("goals", {}).items():
        if other_id != goal_id and entry.get("role") == "foreground":
            entry["role"] = "backlog"
    if status in RESUMABLE_TO_ACTIVE:
        frontmatter["status"] = "active"
        write_text(path, dump_frontmatter_markdown(frontmatter, render_goal_body(title, sections, extras)))
        state["goals"][goal_id]["status"] = "active"
    state["foreground_goal"] = goal_id
    save_state(root, state)
    for paused_goal_id in paused_goal_ids:
        append_goal_event_record(
            root,
            paused_goal_id,
            kind="status_changed",
            owner="bagakit-set-loop-goal",
            summary=f"Paused Goal because foreground switched to {goal_id}.",
            evidence_refs=[f".bagakit/goal/{paused_goal_id}.md", ".bagakit/goal/state.yaml"],
            control_effect="none",
        )
    if status in RESUMABLE_TO_ACTIVE:
        append_goal_event_record(
            root,
            goal_id,
            kind="status_changed",
            owner="bagakit-set-loop-goal",
            summary="Activated Goal as the foreground execution target.",
            evidence_refs=[f".bagakit/goal/{goal_id}.md", ".bagakit/goal/state.yaml"],
            control_effect="none",
        )
    refresh_current(root, state)
    print(goal_id)


def set_supervision(args: argparse.Namespace) -> None:
    root = Path(args.root).resolve()
    paths = ensure_surface(root, supervision_mode=args.mode)
    state = load_state(root)
    state["supervision"]["mode"] = args.mode
    state["supervision"]["contract"] = ".bagakit/goal/supervisor.md"
    state["supervision"]["checkpoint"] = args.checkpoint
    save_state(root, state)
    if args.mode != "off" and (args.force or not paths["supervisor"].exists()):
        write_text(paths["supervisor"], supervisor_md_text())
    refresh_current(root, state)
    print(args.mode)


def relate_goals(args: argparse.Namespace) -> None:
    root = Path(args.root).resolve()
    ensure_surface(root)
    state = load_state(root)
    if not EDGE_KIND_RE.fullmatch(args.kind):
        raise SystemExit("error: edge kind must use lowercase letters, digits, and underscores")
    for goal_id in (args.from_goal, args.to_goal):
        if goal_id not in state.get("goals", {}) and not goal_path(root, goal_id).exists():
            raise SystemExit(f"error: goal not found for edge: {goal_id}")
    edge = {"from": args.from_goal, "to": args.to_goal, "kind": args.kind}
    edges = [item for item in state.get("edges", []) if not (item.get("from") == args.from_goal and item.get("to") == args.to_goal and item.get("kind") == args.kind)]
    if not args.remove:
        edges.append(edge)
    state["edges"] = sorted(edges, key=lambda item: (item["from"], item["to"], item["kind"]))
    save_state(root, state)
    print(json.dumps(edge, ensure_ascii=False))


def normalize_review_id(review_id: str | None) -> str:
    value = require_nonempty(review_id, "--review-id")
    if not GOAL_FILE_RE.fullmatch(value):
        raise SystemExit("error: review id must use lowercase letters, digits, and hyphens only")
    return value


def validate_evolver_review(review: Any, path: Path, root: Path | None = None) -> list[str]:
    issues: list[str] = []
    if not isinstance(review, dict):
        return [f"{path}: review receipt must be a JSON object"]
    required = {
        "schema",
        "goal_id",
        "review_id",
        "trigger",
        "status",
        "evidence_refs",
        "drift",
        "next_instruction",
        "approval",
        "evolver_disposition",
    }
    missing = sorted(required - set(review))
    if missing:
        issues.append(f"{path}: missing fields: {', '.join(missing)}")
        return issues
    unexpected = sorted(set(review) - required)
    if unexpected:
        issues.append(f"{path}: unexpected fields: {', '.join(unexpected)}")
    if review.get("schema") != EVOLVER_REVIEW_SCHEMA:
        issues.append(f"{path}: schema must be {EVOLVER_REVIEW_SCHEMA}")
    if not isinstance(review.get("goal_id"), str) or not GOAL_FILE_RE.fullmatch(review["goal_id"]):
        issues.append(f"{path}: invalid goal_id")
    if not isinstance(review.get("review_id"), str) or not GOAL_FILE_RE.fullmatch(review["review_id"]):
        issues.append(f"{path}: invalid review_id")
    if review.get("trigger") not in EVOLVER_REVIEW_TRIGGERS:
        issues.append(f"{path}: invalid trigger")
    if review.get("status") not in EVOLVER_REVIEW_STATUSES:
        issues.append(f"{path}: invalid status")
    if review.get("approval") not in EVOLVER_REVIEW_APPROVALS:
        issues.append(f"{path}: invalid approval")
    if review.get("evolver_disposition") not in EVOLVER_REVIEW_DISPOSITIONS:
        issues.append(f"{path}: invalid evolver_disposition")
    status = review.get("status")
    disposition = review.get("evolver_disposition")
    approval = review.get("approval")
    allowed_dispositions = {
        "requested": {"pending"},
        "completed": {"no_signal", "signal_candidate"},
        "blocked": {"deferred"},
        "skipped": {"no_signal"},
    }
    if status in allowed_dispositions and disposition not in allowed_dispositions[status]:
        issues.append(f"{path}: {status} status is inconsistent with evolver_disposition={disposition}")
    if disposition == "signal_candidate" and approval not in {"not_required", "approved"}:
        issues.append(f"{path}: signal_candidate requires approval=not_required or approved")
    if not isinstance(review.get("evidence_refs"), list) or not all(
        isinstance(item, str) and item.strip() for item in review.get("evidence_refs", [])
    ):
        issues.append(f"{path}: evidence_refs must be a list of non-empty strings")
    elif root is not None:
        resolved_root = root.resolve()
        for item in review["evidence_refs"]:
            if ABSOLUTE_PATH_RE.search(item):
                issues.append(f"{path}: evidence_ref must be repo-relative: {item}")
                continue
            try:
                relative = (resolved_root / item).resolve().relative_to(resolved_root)
            except ValueError:
                issues.append(f"{path}: evidence_ref escapes the repository root: {item}")
                continue
            if relative == Path("."):
                issues.append(f"{path}: evidence_ref must point to a repository artifact: {item}")
    if not isinstance(review.get("drift"), list) or not all(
        isinstance(item, str) and item.strip() for item in review.get("drift", [])
    ):
        issues.append(f"{path}: drift must be a list of non-empty strings")
    if not isinstance(review.get("next_instruction"), str):
        issues.append(f"{path}: next_instruction must be a string")
    return issues


def request_evolver_review(args: argparse.Namespace) -> None:
    root = Path(args.root).resolve()
    ensure_surface(root)
    state = load_state(root)
    goal_id = require_nonempty(args.goal_id or state.get("foreground_goal"), "--goal-id or foreground_goal")
    if not GOAL_FILE_RE.fullmatch(goal_id):
        raise SystemExit("error: goal id must use lowercase letters, digits, and hyphens only")
    review_id = normalize_review_id(args.review_id)
    if not goal_path(root, goal_id).exists() and not archived_goal_path(root, goal_id).exists():
        raise SystemExit(f"error: goal does not exist: {goal_id}")

    evidence_refs = list(dict.fromkeys(args.evidence_ref or []))
    drift = list(dict.fromkeys(args.drift or []))
    ensure_repo_relative_refs(root, evidence_refs, "review evidence_refs")
    path = evolver_review_path(root, review_id)
    if path.exists():
        existing = load_json(path)
        issues = validate_evolver_review(existing, path.relative_to(root), root)
        if issues:
            raise SystemExit("error: " + "; ".join(issues))
        if existing["review_id"] != review_id or existing["goal_id"] != goal_id or existing["trigger"] != args.trigger:
            raise SystemExit("error: review id already belongs to a different goal or trigger")
        if existing["status"] != "requested":
            if evidence_refs or drift or args.next_instruction is not None or args.approval != "not_required":
                raise SystemExit(
                    "error: finalized review request identity cannot accept a different request payload; use a new review id"
                )
            print(path.relative_to(root))
            return
        proposed = {
            "schema": EVOLVER_REVIEW_SCHEMA,
            "goal_id": goal_id,
            "review_id": review_id,
            "trigger": args.trigger,
            "status": "requested",
            "evidence_refs": evidence_refs,
            "drift": drift,
            "next_instruction": args.next_instruction or "Run an Evolver review over the referenced evidence and record the disposition.",
            "approval": args.approval,
            "evolver_disposition": "pending",
        }
        if proposed != existing:
            raise SystemExit("error: review id already has a different request payload; use a new review id")
        print(path.relative_to(root))
        return

    review = {
        "schema": EVOLVER_REVIEW_SCHEMA,
        "goal_id": goal_id,
        "review_id": review_id,
        "trigger": args.trigger,
        "status": "requested",
        "evidence_refs": evidence_refs,
        "drift": drift,
        "next_instruction": args.next_instruction or "Run an Evolver review over the referenced evidence and record the disposition.",
        "approval": args.approval,
        "evolver_disposition": "pending",
    }
    write_json(path, review)
    print(path.relative_to(root))


def record_evolver_review(args: argparse.Namespace) -> None:
    root = Path(args.root).resolve()
    ensure_surface(root)
    review_id = normalize_review_id(args.review_id)
    path = evolver_review_path(root, review_id)
    if not path.exists():
        raise SystemExit(f"error: evolver review request does not exist: {review_id}")
    review = load_json(path)
    issues = validate_evolver_review(review, path.relative_to(root), root)
    if issues:
        raise SystemExit("error: " + "; ".join(issues))

    new_evidence = args.evidence_ref or []
    ensure_repo_relative_refs(root, new_evidence, "review evidence_refs")
    proposed = dict(review)
    proposed["status"] = args.status
    proposed["evidence_refs"] = list(dict.fromkeys(review["evidence_refs"] + new_evidence))
    proposed["drift"] = list(dict.fromkeys(review["drift"] + (args.drift or [])))
    if args.next_instruction is not None:
        proposed["next_instruction"] = args.next_instruction
    if args.approval is not None:
        proposed["approval"] = args.approval
    proposed["evolver_disposition"] = args.evolver_disposition
    proposed_issues = validate_evolver_review(proposed, path.relative_to(root), root)
    if proposed_issues:
        raise SystemExit("error: " + "; ".join(proposed_issues))
    if review["status"] != "requested" and proposed != review:
        raise SystemExit(
            "error: evolver review receipt is finalized; use a new review id when the outcome or evidence changes"
        )
    write_json(path, proposed)
    print(path.relative_to(root))
    if args.evolver_disposition == "signal_candidate":
        print(
            "next_instruction: Ask bagakit-skill-evolver session-review intake to review "
            f"{path.relative_to(root)} as evidence."
        )


def render_wrapper(args: argparse.Namespace) -> None:
    root = Path(args.root).resolve()
    report, _internal = build_upgrade_plan(root)
    if report["status"] != "current":
        raise SystemExit("error: Goal surface requires upgrade; run inspect-upgrade before rendering the wrapper")
    state = load_state(root)
    pending_goal_ids = unreconciled_goal_ids(root, state)
    if pending_goal_ids:
        raise SystemExit(
            "error: reconcile Goal control truth before rendering the wrapper for: "
            + ", ".join(pending_goal_ids)
        )
    mode = state.get("supervision", {}).get("mode", "off")
    sys.stdout.write(WRAPPER_WITH_SUPERVISOR if mode != "off" else WRAPPER_WITHOUT_SUPERVISOR)


def surface_summary(root: Path) -> dict[str, Any]:
    state = load_state(root)
    return {
        "surface_root": ".bagakit/goal",
        "protocol_version": state.get("protocol_version"),
        "foreground_goal": state.get("foreground_goal"),
        "supervision_mode": state.get("supervision", {}).get("mode", "off"),
        "goals": state.get("goals", {}),
        "edges": state.get("edges", []),
        "reviews_dir": ".bagakit/goal/reviews",
        "review_count": len(list(surface_paths(root)["reviews"].glob("*.json"))),
        "events_dir": ".bagakit/goal/events",
        "event_stream_count": len(list(surface_paths(root)["events"].glob("*.jsonl"))),
        "archive_dir": state.get("archive", {}).get("dir", ".bagakit/goal/archive"),
    }


def compact_driver_value(value: str | None, fallback: str = "none") -> str:
    compact = " ".join((value or "").split())
    return compact or fallback


def acceptance_progress(
    acceptance_text: str,
    passed_override: int | None,
    total_override: int | None,
) -> tuple[str, float | None]:
    if (passed_override is None) != (total_override is None):
        raise SystemExit("error: --progress-passed and --progress-total must be supplied together")
    if passed_override is not None and total_override is not None:
        if total_override <= 0 or passed_override < 0 or passed_override > total_override:
            raise SystemExit("error: progress counts must satisfy 0 <= passed <= total and total > 0")
        passed = passed_override
        total = total_override
    else:
        checks = re.findall(r"(?m)^\s*[-*]\s+\[([ xX])\]\s+", acceptance_text)
        if not checks:
            return "unknown", None
        total = len(checks)
        passed = sum(1 for marker in checks if marker.lower() == "x")
    filled = round((passed / total) * 10)
    return f"[{'#' * filled}{'-' * (10 - filled)}] {passed}/{total} gates", passed / total


def budget_dimension(
    label: str,
    used: int | None,
    budget: int | None,
    progress_ratio: float | None,
) -> tuple[str, str]:
    if used is None and budget is None:
        return f"{label}=unknown", "unknown"
    if used is None or budget is None:
        raise SystemExit(f"error: {label.lower()} used and budget values must be supplied together")
    if used < 0 or budget <= 0:
        raise SystemExit(f"error: {label.lower()} values require used >= 0 and budget > 0")
    ratio = used / budget
    if ratio > 1:
        status = "exceeded"
    elif progress_ratio is not None and ratio > progress_ratio + 0.2:
        status = "at_risk"
    elif progress_ratio is None and ratio >= 0.8:
        status = "at_risk"
    else:
        status = "on_track"
    return f"{label}={used}/{budget}({status})", status


def make_driver_alert(
    severity: str,
    alert_id: str,
    signal: str,
    impact: str,
    response: str,
    evidence: str,
) -> dict[str, str]:
    return {
        "severity": severity,
        "source": "Goal",
        "id": alert_id,
        "signal": compact_driver_value(signal),
        "impact": compact_driver_value(impact),
        "response": compact_driver_value(response),
        "evidence": compact_driver_value(evidence, "none"),
    }


def render_driver_alerts(alerts: list[dict[str, str]]) -> str | None:
    if not alerts:
        return None
    severity_order = {"P0": 0, "P1": 1, "P2": 2}
    unique: dict[tuple[str, str, str], dict[str, str]] = {}
    for alert in alerts:
        unique[(alert["source"], alert["id"], alert["response"])] = alert
    ordered = sorted(
        unique.values(),
        key=lambda item: (severity_order[item["severity"]], item["source"], item["id"]),
    )
    rendered = [
        f"{item['severity']}[{item['source']}/{item['id']}] "
        f"Signal={item['signal']}; Impact={item['impact']}; "
        f"Response={item['response']}; Evidence={item['evidence']}"
        for item in ordered
    ]
    return "- 👩🏻‍🚒 ALERTS !! " + " | ".join(rendered)


def driver_report(args: argparse.Namespace) -> None:
    root = Path(args.root).resolve()
    report, _internal = build_upgrade_plan(root)
    alerts: list[dict[str, str]] = []
    evidence_refs = list(dict.fromkeys(args.evidence_ref or []))
    ensure_repo_relative_refs(root, evidence_refs, "driver evidence refs")

    if report["status"] != "current":
        goal_id = report["inventory"].get("foreground_goal") or "none"
        severity = "P0" if report["status"] == "blocked" else "P1"
        evidence = ".bagakit/goal/upgrade.json" if report["status"] == "blocked" else ".bagakit/goal"
        alerts.append(
            make_driver_alert(
                severity,
                report["status"],
                f"Goal control plane is {report['status']}",
                "Fresh execution cannot safely trust the current Goal surface.",
                report["next_instruction"],
                evidence,
            )
        )
        summary = {
            "goal_id": goal_id,
            "status": report["status"],
            "event": "protocol_inspection",
            "progress": "unknown",
            "drift": "control_plane_not_current",
            "budget": "Time=unknown,Tokens=unknown",
            "discovery": compact_driver_value(" | ".join(args.discovery)),
            "evidence": compact_driver_value(" | ".join(evidence_refs), evidence),
            "next": compact_driver_value(report["next_instruction"]),
            "alerts": alerts,
        }
    else:
        state = load_state(root)
        goal_id = state.get("foreground_goal")
        if not goal_id or goal_id not in state.get("goals", {}):
            alerts.append(
                make_driver_alert(
                    "P1",
                    "no_foreground",
                    "No foreground Goal is registered.",
                    "The execution loop has no unambiguous target.",
                    "Select or create one foreground Goal before continuing.",
                    ".bagakit/goal/state.yaml",
                )
            )
            summary = {
                "goal_id": "none",
                "status": "no_foreground",
                "event": compact_driver_value(args.event, "inspection"),
                "progress": "unknown",
                "drift": "no_foreground",
                "budget": "Time=unknown,Tokens=unknown",
                "discovery": compact_driver_value(" | ".join(args.discovery)),
                "evidence": compact_driver_value(" | ".join(evidence_refs), ".bagakit/goal/state.yaml"),
                "next": compact_driver_value(args.next_action, "Select one foreground Goal."),
                "alerts": alerts,
            }
        else:
            entry = state["goals"][goal_id]
            goal_file = root / entry["file"]
            frontmatter, _title, sections, _extras = read_goal_doc(goal_file)
            events = load_goal_events(root, goal_id)
            latest_event = events[-1] if events else {}
            progress, progress_ratio = acceptance_progress(
                sections.get("Acceptance And Stop Rules", ""),
                args.progress_passed,
                args.progress_total,
            )
            time_text, time_status = budget_dimension(
                "Time", args.elapsed_seconds, args.expected_seconds, progress_ratio
            )
            token_text, token_status = budget_dimension(
                "Tokens", args.tokens_used, args.token_budget, progress_ratio
            )
            budget = f"{time_text},{token_text}"
            drift_items = [compact_driver_value(item) for item in args.drift if compact_driver_value(item) != "none"]
            if drift_items:
                alerts.append(
                    make_driver_alert(
                        "P1",
                        "drift",
                        " | ".join(drift_items),
                        "Execution may no longer match the protected Goal direction.",
                        "Record a Goal delta or reconcile before the next bounded round.",
                        " | ".join(evidence_refs) or entry["file"],
                    )
                )
            if frontmatter.get("status") == "blocked":
                alerts.append(
                    make_driver_alert(
                        "P1",
                        "blocked",
                        "Foreground Goal status is blocked.",
                        "Normal execution cannot make reliable forward progress.",
                        "Resolve the blocker or route the decision before continuing.",
                        entry["file"],
                    )
                )
            budget_states = {time_status, token_status}
            if "exceeded" in budget_states:
                alerts.append(
                    make_driver_alert(
                        "P0",
                        "budget_exceeded",
                        budget,
                        "Execution exceeded an explicit resource boundary.",
                        "Stop and obtain a new budget or reduce scope before continuing.",
                        " | ".join(evidence_refs) or entry["file"],
                    )
                )
            elif "at_risk" in budget_states:
                alerts.append(
                    make_driver_alert(
                        "P1",
                        "budget_at_risk",
                        budget,
                        "Resource consumption is ahead of evidence-backed progress.",
                        "Replan the next bounded round or reduce method cost.",
                        " | ".join(evidence_refs) or entry["file"],
                    )
                )
            status = str(frontmatter.get("status", entry.get("status", "unknown")))
            status_display = (
                f"{args.previous_status}→{status}"
                if args.previous_status and args.previous_status != status
                else status
            )
            default_evidence = list(latest_event.get("evidence_refs", [])) or [entry["file"]]
            effective_evidence = evidence_refs or default_evidence
            summary = {
                "goal_id": goal_id,
                "status": status_display,
                "event": compact_driver_value(args.event, compact_driver_value(latest_event.get("kind"), "inspection")),
                "progress": progress,
                "drift": compact_driver_value(" | ".join(drift_items)),
                "budget": budget,
                "discovery": compact_driver_value(" | ".join(args.discovery)),
                "evidence": compact_driver_value(" | ".join(effective_evidence)),
                "next": compact_driver_value(
                    args.next_action,
                    compact_driver_value(sections.get("Next Execution Instruction"), "unknown"),
                ),
                "alerts": alerts,
            }

    alert_line = render_driver_alerts(summary["alerts"])
    footer_lines = [
        "[[BAGAKIT]]",
        "- Goal: "
        f"ID={summary['goal_id']}; Status={summary['status']}; Event={summary['event']}; "
        f"Progress={summary['progress']}; Drift={summary['drift']}; Budget={summary['budget']}; "
        f"Discovery={summary['discovery']}; Evidence={summary['evidence']}; Next={summary['next']}",
    ]
    if alert_line:
        footer_lines.append(alert_line)
    summary["footer"] = "\n".join(footer_lines)
    if args.json:
        print(json.dumps(summary, indent=2, ensure_ascii=False, sort_keys=True))
    else:
        print(summary["footer"])


def show_surface(args: argparse.Namespace) -> None:
    root = Path(args.root).resolve()
    ensure_surface(root)
    summary = surface_summary(root)
    if args.json:
        print(json.dumps(summary, indent=2, ensure_ascii=False))
        return
    print(f"surface_root: {summary['surface_root']}")
    print(f"protocol_version: {summary['protocol_version']}")
    print(f"foreground_goal: {summary['foreground_goal']}")
    print(f"supervision_mode: {summary['supervision_mode']}")
    print(f"reviews: {summary['review_count']} | dir={summary['reviews_dir']}")
    print(f"event_streams: {summary['event_stream_count']} | dir={summary['events_dir']}")
    goals = summary["goals"]
    print(f"goals: {len(goals)}")
    for goal_id, entry in sorted(goals.items()):
        print(f"- {goal_id} | status={entry.get('status')} | role={entry.get('role')} | file={entry.get('file')}")
    if summary["edges"]:
        print("edges:")
        for edge in summary["edges"]:
            print(f"- {edge['from']} -> {edge['to']} ({edge['kind']})")


def expected_current_text(root: Path) -> str:
    state = load_state(root)
    return current_md_text(
        state.get("supervision", {}).get("mode") != "off",
        bool(state.get("foreground_goal")),
    )


def fresh_check(args: argparse.Namespace) -> None:
    root = Path(args.root).resolve()
    paths = surface_paths(root)
    issues: list[str] = []

    if not paths["surface_toml"].exists():
        issues.append("missing .bagakit/goal/surface.toml")
    if not paths["current"].exists():
        issues.append("missing .bagakit/goal/current.md")
    if not paths["state"].exists():
        issues.append("missing .bagakit/goal/state.yaml")
    if issues:
        raise SystemExit("error: " + "; ".join(issues) + "; run inspect-upgrade")

    upgrade_report, _upgrade_internal = build_upgrade_plan(root)
    if upgrade_report["status"] != "current":
        issues.append(
            f"Goal protocol inspection is {upgrade_report['status']}; run inspect-upgrade before execution"
        )

    surface_version, surface_invalid = read_surface_protocol(paths["surface_toml"])
    if surface_invalid or surface_version != GOAL_PROTOCOL_VERSION:
        issues.append(f"surface.toml protocol_version must be {GOAL_PROTOCOL_VERSION}")
    if paths["upgrade"].exists():
        issues.append("unresolved .bagakit/goal/upgrade.json blocks fresh execution")

    state = load_state(root)
    if state.get("schema") != STATE_SCHEMA:
        issues.append("state.yaml schema must be bagakit.goal-state.v1")
    if state.get("protocol_version") != GOAL_PROTOCOL_VERSION:
        issues.append(f"state.yaml protocol_version must be {GOAL_PROTOCOL_VERSION}")

    current_text = read_text(paths["current"])
    if current_text != expected_current_text(root):
        issues.append("current.md does not match the expected template for the current supervision and foreground state")

    foreground_goal = state.get("foreground_goal")
    goals = state.get("goals", {})
    if foreground_goal:
        if foreground_goal not in goals:
            issues.append("foreground_goal is not registered in state.yaml goals")
        else:
            fg_path = root / goals[foreground_goal]["file"]
            if not fg_path.exists():
                issues.append("foreground goal file is missing")
            else:
                frontmatter, title, sections, _extras = read_goal_doc(fg_path)
                if frontmatter.get("schema") != GOAL_SCHEMA:
                    issues.append("foreground goal schema is invalid")
                if frontmatter.get("protocol_version") != GOAL_PROTOCOL_VERSION:
                    issues.append(f"foreground goal protocol_version must be {GOAL_PROTOCOL_VERSION}")
                if not title.strip():
                    issues.append("foreground goal title is missing")
                for heading in KNOWN_SECTION_ORDER:
                    text = sections.get(heading, "").strip()
                    if not text:
                        issues.append(f"foreground goal section missing: {heading}")
                if frontmatter.get("status") == "complete" and not frontmatter.get("completion_evidence"):
                    issues.append("complete goal requires completion_evidence")
                if goals[foreground_goal].get("status") != frontmatter.get("status"):
                    issues.append("state.yaml goal status does not match foreground goal frontmatter")
                if goals[foreground_goal].get("role") != "foreground":
                    issues.append("foreground goal registry role must be foreground")
    else:
        issues.append("no foreground_goal is registered")

    for goal_id, entry in goals.items():
        path = root / entry["file"]
        if not path.exists():
            issues.append(f"registered goal file missing: {goal_id}")
            continue
        frontmatter, _title, _sections, _extras = read_goal_doc(path)
        if frontmatter.get("goal_id") != goal_id:
            issues.append(f"{goal_id}: goal_id frontmatter does not match registry key")
        if frontmatter.get("protocol_version") != GOAL_PROTOCOL_VERSION:
            issues.append(f"{goal_id}: protocol_version must be {GOAL_PROTOCOL_VERSION}")
        if frontmatter.get("truth_surface") != entry["file"]:
            issues.append(f"{goal_id}: truth_surface does not match registry file")
        if entry.get("status") != frontmatter.get("status"):
            issues.append(f"{goal_id}: registry status does not match frontmatter")
        expected_event_log = f".bagakit/goal/events/{goal_id}.jsonl"
        if entry.get("event_log") != expected_event_log:
            issues.append(f"{goal_id}: registry event_log must be {expected_event_log}")
            continue
        cursor = entry.get("reconciled_through")
        if not isinstance(cursor, int) or isinstance(cursor, bool) or cursor < 0:
            issues.append(f"{goal_id}: reconciled_through must be a non-negative integer")
            continue
        try:
            events = load_goal_events(root, goal_id)
        except SystemExit as exc:
            issues.append(str(exc).removeprefix("error: "))
            continue
        if not events:
            issues.append(f"{goal_id}: Goal event stream is missing or empty")
            continue
        if cursor > len(events):
            issues.append(f"{goal_id}: reconciled_through exceeds the Goal event stream")
            continue
        pending = [event for event in events[cursor:] if event.get("control_effect") != "none"]
        if pending:
            issues.append(f"{goal_id}: unreconciled Goal control events require reconciliation")

    if paths["reviews"].exists():
        for review_path in sorted(paths["reviews"].glob("*.json")):
            try:
                review = load_json(review_path)
            except json.JSONDecodeError as exc:
                issues.append(f"{review_path.relative_to(root)}: invalid JSON: {exc.msg}")
                continue
            issues.extend(validate_evolver_review(review, review_path.relative_to(root), root))
            if isinstance(review, dict) and review.get("review_id") != review_path.stem:
                issues.append(f"{review_path.relative_to(root)}: review_id does not match filename")

    if issues:
        for issue in issues:
            print(f"- {issue}")
        raise SystemExit(1)
    print("fresh-executor check passed")


def archive_goal(args: argparse.Namespace) -> None:
    root = Path(args.root).resolve()
    ensure_surface(root)
    state = load_state(root)
    goal_id = require_nonempty(args.goal_id, "--goal-id")
    active_path = goal_path(root, goal_id)
    if not active_path.exists():
        raise SystemExit(f"error: active goal file not found: {goal_id}")
    frontmatter, title, sections, extras = read_goal_doc(active_path)
    if args.status not in {"complete", "abandoned"}:
        raise SystemExit("error: archive-goal status must be complete or abandoned")
    frontmatter["status"] = args.status
    completion_evidence = list(args.completion_evidence or frontmatter.get("completion_evidence") or [])
    if args.status == "complete" and not completion_evidence:
        raise SystemExit("error: archive-goal status=complete requires completion evidence")
    frontmatter["completion_evidence"] = completion_evidence
    frontmatter["truth_surface"] = f".bagakit/goal/archive/{goal_id}.md"
    archive_path = archived_goal_path(root, goal_id)
    write_text(archive_path, dump_frontmatter_markdown(frontmatter, render_goal_body(title, sections, extras)))
    active_path.unlink()
    active_event_path = goal_event_path(root, goal_id)
    if active_event_path.exists():
        archived_event_path = surface_root(root) / "archive" / f"{goal_id}.events.jsonl"
        active_event_path.replace(archived_event_path)

    state.get("goals", {}).pop(goal_id, None)
    state["edges"] = [
        edge
        for edge in state.get("edges", [])
        if edge.get("from") != goal_id and edge.get("to") != goal_id
    ]
    if state.get("foreground_goal") == goal_id:
        replacement = args.replacement_foreground
        if replacement:
            if replacement not in state.get("goals", {}):
                raise SystemExit("error: replacement foreground goal is not registered")
            state["foreground_goal"] = replacement
            state["goals"][replacement]["role"] = "foreground"
            rep_path = root / state["goals"][replacement]["file"]
            rep_frontmatter, rep_title, rep_sections, rep_extras = read_goal_doc(rep_path)
            if rep_frontmatter.get("status") in RESUMABLE_TO_ACTIVE:
                rep_frontmatter["status"] = "active"
                write_text(rep_path, dump_frontmatter_markdown(rep_frontmatter, render_goal_body(rep_title, rep_sections, rep_extras)))
                state["goals"][replacement]["status"] = "active"
        else:
            state["foreground_goal"] = None
    save_state(root, state)
    refresh_current(root, state)
    print(archive_path.relative_to(root))


def validate_skill(_args: argparse.Namespace) -> None:
    skill_root = Path(__file__).resolve().parents[1]
    required = [
        skill_root / "SKILL.md",
        skill_root / "agents" / "openai.yaml",
        skill_root / "references" / "skill-cli.toml",
        skill_root / "references" / "frontdoor-rule.toml",
        skill_root / "references" / "goal-file-contract.md",
        skill_root / "references" / "event-stream-contract.md",
        skill_root / "references" / "protocol-upgrade-contract.md",
        skill_root / "references" / "bagakit-driver.toml",
        skill_root / "references" / "tool-orchestration.md",
        skill_root / "references" / "loop-off-loop.md",
        skill_root / "references" / "design-origin.md",
        skill_root / "scripts" / "bagakit-set-loop-goal-cli.sh",
        skill_root / "scripts" / "bagakit-set-loop-goal.py",
    ]
    missing = [str(path.relative_to(skill_root)) for path in required if not path.exists()]
    if missing:
        raise SystemExit("error: missing required files: " + ", ".join(missing))
    print("skill assets present")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="bagakit-set-loop-goal-cli")
    sub = parser.add_subparsers(dest="command", required=True)

    describe = sub.add_parser("describe")
    describe.set_defaults(func=lambda _args: print("bagakit-set-loop-goal: create recoverable Goal control planes with executable lifecycle operators."))

    list_refs = sub.add_parser("list-references")
    list_refs.set_defaults(
        func=lambda _args: print(
            "\n".join(
                sorted(
                    str(path.relative_to(Path(__file__).resolve().parents[1]))
                    for path in (Path(__file__).resolve().parents[1] / "references").glob("*")
                    if path.is_file()
                )
            )
        )
    )

    validate = sub.add_parser("validate")
    validate.set_defaults(func=validate_skill)

    init = sub.add_parser("initialize-surface")
    init.add_argument("--root", default=".")
    init.add_argument("--supervision-mode", default="off", choices=sorted(SUPERVISION_MODES))
    init.set_defaults(func=initialize_surface)

    inspect = sub.add_parser("inspect-upgrade")
    inspect.add_argument("--root", default=".")
    inspect.add_argument("--foreground-goal")
    inspect.add_argument("--pause-goal", action="append", default=[])
    inspect.set_defaults(func=inspect_upgrade)

    upgrade = sub.add_parser("upgrade-surface")
    upgrade.add_argument("--root", default=".")
    upgrade.add_argument("--foreground-goal")
    upgrade.add_argument("--pause-goal", action="append", default=[])
    upgrade.add_argument("--apply", action="store_true")
    upgrade.set_defaults(func=upgrade_surface)

    upsert = sub.add_parser("upsert-goal")
    upsert.add_argument("--root", default=".")
    upsert.add_argument("--from-json")
    upsert.add_argument("--goal-id")
    upsert.add_argument("--title")
    upsert.add_argument("--status")
    upsert.add_argument("--prime-directive-text")
    upsert.add_argument("--current-state-line", action="append", default=[])
    upsert.add_argument("--principle-line", action="append", default=[])
    upsert.add_argument("--acceptance-line", action="append", default=[])
    upsert.add_argument("--orchestration-line", action="append", default=[])
    upsert.add_argument("--next-instruction-text")
    upsert.add_argument("--decision-line", action="append", default=[])
    upsert.add_argument("--question-line", action="append", default=[])
    upsert.add_argument("--completion-evidence", action="append", default=[])
    upsert.add_argument("--role")
    upsert.add_argument("--foreground", action="store_true")
    upsert.add_argument("--allow-absolute-paths", action="store_true")
    upsert.set_defaults(func=create_or_update_goal)

    set_fg = sub.add_parser("set-foreground")
    set_fg.add_argument("--root", default=".")
    set_fg.add_argument("--goal-id", required=True)
    set_fg.set_defaults(func=set_foreground)

    set_sup = sub.add_parser("set-supervision")
    set_sup.add_argument("--root", default=".")
    set_sup.add_argument("--mode", required=True, choices=sorted(SUPERVISION_MODES))
    set_sup.add_argument("--checkpoint", default="before_action_and_after_round")
    set_sup.add_argument("--force", action="store_true")
    set_sup.set_defaults(func=set_supervision)

    relate = sub.add_parser("relate-goals")
    relate.add_argument("--root", default=".")
    relate.add_argument("--from-goal", required=True)
    relate.add_argument("--to-goal", required=True)
    relate.add_argument("--kind", required=True)
    relate.add_argument("--remove", action="store_true")
    relate.set_defaults(func=relate_goals)

    request_review = sub.add_parser("request-evolver-review")
    request_review.add_argument("--root", default=".")
    request_review.add_argument("--goal-id")
    request_review.add_argument("--review-id", required=True)
    request_review.add_argument("--trigger", required=True, choices=sorted(EVOLVER_REVIEW_TRIGGERS))
    request_review.add_argument("--evidence-ref", action="append", default=[])
    request_review.add_argument("--drift", action="append", default=[])
    request_review.add_argument("--next-instruction")
    request_review.add_argument("--approval", default="not_required", choices=sorted(EVOLVER_REVIEW_APPROVALS))
    request_review.set_defaults(func=request_evolver_review)

    record_review = sub.add_parser("record-evolver-review")
    record_review.add_argument("--root", default=".")
    record_review.add_argument("--review-id", required=True)
    record_review.add_argument("--status", required=True, choices=sorted(EVOLVER_REVIEW_STATUSES - {"requested"}))
    record_review.add_argument("--evidence-ref", action="append")
    record_review.add_argument("--drift", action="append")
    record_review.add_argument("--next-instruction")
    record_review.add_argument("--approval", choices=sorted(EVOLVER_REVIEW_APPROVALS))
    record_review.add_argument("--evolver-disposition", required=True, choices=sorted(EVOLVER_REVIEW_DISPOSITIONS - {"pending"}))
    record_review.set_defaults(func=record_evolver_review)

    append_event = sub.add_parser("append-goal-event")
    append_event.add_argument("--root", default=".")
    append_event.add_argument("--goal-id")
    append_event.add_argument("--kind", required=True, choices=sorted(GOAL_EVENT_KINDS))
    append_event.add_argument("--owner", required=True)
    append_event.add_argument("--summary", required=True)
    append_event.add_argument("--evidence-ref", action="append", default=[])
    append_event.add_argument("--control-effect", default="none", choices=sorted(GOAL_CONTROL_EFFECTS))
    append_event.set_defaults(func=append_goal_event)

    reconcile = sub.add_parser("reconcile-goal")
    reconcile.add_argument("--root", default=".")
    reconcile.add_argument("--goal-id")
    reconcile.add_argument("--current-state-line", action="append", required=True)
    reconcile.add_argument("--next-instruction-text", required=True)
    reconcile.add_argument("--decision-line", action="append", default=[])
    reconcile.add_argument("--owner", required=True)
    reconcile.add_argument("--summary", required=True)
    reconcile.add_argument("--evidence-ref", action="append", default=[])
    reconcile.add_argument("--allow-absolute-paths", action="store_true")
    reconcile.set_defaults(func=reconcile_goal)

    wrapper = sub.add_parser("render-wrapper")
    wrapper.add_argument("--root", default=".")
    wrapper.set_defaults(func=render_wrapper)

    fresh = sub.add_parser("fresh-check")
    fresh.add_argument("--root", default=".")
    fresh.set_defaults(func=fresh_check)

    archive = sub.add_parser("archive-goal")
    archive.add_argument("--root", default=".")
    archive.add_argument("--goal-id", required=True)
    archive.add_argument("--status", required=True)
    archive.add_argument("--completion-evidence", action="append", default=[])
    archive.add_argument("--replacement-foreground")
    archive.set_defaults(func=archive_goal)

    show = sub.add_parser("show-surface")
    show.add_argument("--root", default=".")
    show.add_argument("--json", action="store_true")
    show.set_defaults(func=show_surface)

    driver = sub.add_parser("driver-report")
    driver.add_argument("--root", default=".")
    driver.add_argument("--previous-status", choices=sorted(GOAL_STATUSES))
    driver.add_argument("--event")
    driver.add_argument("--progress-passed", type=int)
    driver.add_argument("--progress-total", type=int)
    driver.add_argument("--elapsed-seconds", type=int)
    driver.add_argument("--expected-seconds", type=int)
    driver.add_argument("--tokens-used", type=int)
    driver.add_argument("--token-budget", type=int)
    driver.add_argument("--drift", action="append", default=[])
    driver.add_argument("--discovery", action="append", default=[])
    driver.add_argument("--evidence-ref", action="append", default=[])
    driver.add_argument("--next-action")
    driver.add_argument("--json", action="store_true")
    driver.set_defaults(func=driver_report)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    result = args.func(args)
    if result is not None:
        print(result)


if __name__ == "__main__":
    main()
