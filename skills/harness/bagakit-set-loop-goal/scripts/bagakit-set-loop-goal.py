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
    "Goal Delta Log",
    "Open Questions",
]

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
        "archive": goal_root / "archive",
    }


def goal_path(root: Path, goal_id: str) -> Path:
    return surface_root(root) / f"{goal_id}.md"


def archived_goal_path(root: Path, goal_id: str) -> Path:
    return surface_root(root) / "archive" / f"{goal_id}.md"


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
  "skills/harness/bagakit-set-loop-goal/references/loop-off-loop.md",
]
reviewable_outputs = [
  "current.md",
  "state.yaml",
  "supervisor.md",
  "<goal-id>.md",
  "archive/<goal-id>.md",
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


def normalize_registry_entry(goal_id: str, frontmatter: dict[str, Any], role: str | None) -> dict[str, Any]:
    status = goal_status(frontmatter, Path(f".bagakit/goal/{goal_id}.md"))
    return {
        "file": f".bagakit/goal/{goal_id}.md",
        "status": status,
        "role": role or ("foreground" if status == "active" else "backlog"),
    }


def refresh_current(root: Path, state: dict[str, Any]) -> None:
    write_text(
        surface_paths(root)["current"],
        current_md_text(
            state.get("supervision", {}).get("mode") != "off",
            bool(state.get("foreground_goal")),
        ),
    )


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

    existing_frontmatter: dict[str, Any] = {}
    existing_title = args.title or ""
    existing_sections: dict[str, str] = {}
    existing_extras: list[tuple[str, str]] = []
    if path.exists():
        existing_frontmatter, existing_title, existing_sections, existing_extras = read_goal_doc(path)

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
    deltas = (
        render_list_section(args.delta_line)
        if args.delta_line
        else render_list_section(seed.get("delta_line", []))
        if seed.get("delta_line")
        else existing_sections.get("Goal Delta Log", "- none")
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

    all_lines = [prime_directive, current_state, principles, acceptance, orchestration, next_instruction, deltas, questions]
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
        "Goal Delta Log": deltas.strip(),
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
        state.setdefault("goals", {})[goal_id] = normalize_registry_entry(goal_id, frontmatter, "foreground")
    elif status in OPEN_GOAL_STATUSES:
        state.setdefault("goals", {})[goal_id] = normalize_registry_entry(goal_id, frontmatter, entry_role or "backlog")
    else:
        state.setdefault("goals", {}).pop(goal_id, None)
        if state.get("foreground_goal") == goal_id:
            state["foreground_goal"] = None

    save_state(root, state)
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
    state.setdefault("goals", {})[goal_id] = normalize_registry_entry(goal_id, frontmatter, "foreground")
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
    upsert.add_argument("--delta-line", action="append", default=[])
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
