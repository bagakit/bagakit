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
EDGE_KINDS = {"depends_on", "blocks", "interrupts", "resumes_after", "supersedes"}
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
    return """schema_version = 1
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
  "skills/harness/bagakit-set-loop-goal/references/loop-off-loop.md",
]
reviewable_outputs = [
  "current.md",
  "state.yaml",
  "supervisor.md",
  "<goal-id>.md",
  "events/<goal-id>.jsonl",
  "reviews/<review-id>.json",
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


def ensure_surface(root: Path, *, supervision_mode: str | None = None) -> dict[str, Path]:
    paths = surface_paths(root)
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
    ensure_surface(root)
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
    ensure_surface(root)
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
    status = args.status or seed.get("status") or existing_frontmatter.get("status") or "active"
    if status not in GOAL_STATUSES:
        raise SystemExit(f"error: invalid goal status `{status}`")
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
    foreground = args.foreground or bool(seed.get("foreground"))
    if foreground or not state.get("foreground_goal"):
        entry_role = "foreground"
        if status not in OPEN_GOAL_STATUSES:
            raise SystemExit("error: a foreground goal must use an incomplete status")
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
    if args.kind not in EDGE_KINDS:
        raise SystemExit(f"error: edge kind must be one of {', '.join(sorted(EDGE_KINDS))}")
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
    state = load_state(root)
    mode = state.get("supervision", {}).get("mode", "off")
    sys.stdout.write(WRAPPER_WITH_SUPERVISOR if mode != "off" else WRAPPER_WITHOUT_SUPERVISOR)


def surface_summary(root: Path) -> dict[str, Any]:
    state = load_state(root)
    return {
        "surface_root": ".bagakit/goal",
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


def show_surface(args: argparse.Namespace) -> None:
    root = Path(args.root).resolve()
    ensure_surface(root)
    summary = surface_summary(root)
    if args.json:
        print(json.dumps(summary, indent=2, ensure_ascii=False))
        return
    print(f"surface_root: {summary['surface_root']}")
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
        raise SystemExit("error: " + "; ".join(issues))

    state = load_state(root)
    if state.get("schema") != STATE_SCHEMA:
        issues.append("state.yaml schema must be bagakit.goal-state.v1")

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

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    result = args.func(args)
    if result is not None:
        print(result)


if __name__ == "__main__":
    main()
