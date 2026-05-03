from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
import re
import sys

SCHEMA = "bagakit/consensus-ledger/v1"
EP_CLASSES = {"known_known", "known_unknown", "unknown_known", "unknown_unknown"}
ITEM_STATUSES = {
    "confirmed",
    "proposed",
    "inferred",
    "contested",
    "deferred",
    "superseded",
    "stale",
    "promoted",
}
SOURCES = {"user", "agent_inference", "source_evidence", "tool_observation", "artifact"}
CONFIDENCE = {"high", "medium", "low", "unknown"}
LEDGER_STATUSES = {"active", "snapshot_ready", "promoted", "archived"}
SNAPSHOT_STATUSES = {"candidate", "accepted", "corrected", "rejected", "superseded"}


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def slugify(raw: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", raw.strip().lower()).strip("-")
    return slug or "ledger"


def repo_rel(root: Path, path: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()


def ensure_surface(root: Path) -> None:
    surface = root / ".bagakit" / "consensus-ledger"
    (surface / "ledgers").mkdir(parents=True, exist_ok=True)
    marker = surface / "surface.toml"
    if not marker.exists():
        marker.write_text(
            "\n".join(
                [
                    "schema_version = 1",
                    'surface_id = "consensus-ledger-runtime"',
                    'surface_root = ".bagakit/consensus-ledger"',
                    'owner_kind = "skill"',
                    'owner_id = "bagakit-consensus-ledger"',
                    'lifecycle_class = "durable_state"',
                    'edit_policy = "generated_or_operator"',
                    "cleanup_safe = false",
                    "source_of_truth = [",
                    '  "docs/specs/consensus-ledger-contract.md",',
                    '  "skills/harness/bagakit-consensus-ledger/SKILL.md",',
                    "]",
                    "",
                ]
            ),
            encoding="utf-8",
        )


def resolve_ledger_path(args: argparse.Namespace, *, for_init: bool = False) -> Path:
    root = Path(args.root).resolve()
    ledger_arg = getattr(args, "ledger", None)
    if ledger_arg:
        return (root / ledger_arg).resolve()
    owner_ref = getattr(args, "owner_ref", "")
    if owner_ref:
        return (root / owner_ref / "consensus-ledger.json").resolve()
    ledger_id = slugify(getattr(args, "ledger_id", "") or getattr(args, "goal", "") or "default")
    if for_init:
        ensure_surface(root)
    return (root / ".bagakit" / "consensus-ledger" / "ledgers" / ledger_id / "ledger.json").resolve()


def read_ledger(path: Path) -> dict:
    if not path.exists():
        raise SystemExit(f"missing ledger: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schema") != SCHEMA:
        raise SystemExit(f"unsupported ledger schema: {path}")
    return data


def write_ledger(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data["updated_at"] = now()
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def find_or_create(items: list[dict], item_id: str, base: dict) -> dict:
    for item in items:
        if item.get("id") == item_id:
            return item
    items.append(base)
    return base


def split_values(values: list[str] | None) -> list[str]:
    return [value for value in (values or []) if value]


def command_init(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    path = resolve_ledger_path(args, for_init=True)
    ledger_id = slugify(args.ledger_id or path.parent.name)
    owner_mode = "embedded" if args.owner_ref else "standalone"
    data = {
        "schema": SCHEMA,
        "ledger_id": ledger_id,
        "status": "active",
        "owner": {
            "mode": owner_mode,
            "owner_skill": args.owner_skill,
            "owner_ref": args.owner_ref,
            "ledger_path": repo_rel(root, path),
        },
        "goal_context": {
            "goal": args.goal,
            "success_bar": args.success_bar,
            "non_goals": split_values(args.non_goal),
            "protected_principle": args.protected_principle,
        },
        "epistemic_items": [],
        "goal_dimensions": [],
        "questions": [],
        "decision_items": [],
        "skill_lenses": [],
        "evidence_refs": [],
        "snapshots": [],
        "promotion_state": {"status": "none", "target": "none", "refs": []},
        "render": {"view_path": repo_rel(root, path.with_suffix(".md")), "last_rendered_at": ""},
        "created_at": now(),
        "updated_at": now(),
    }
    write_ledger(path, data)
    print(f"ok: initialized {repo_rel(root, path)}")
    return 0


def command_add_dimension(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    path = resolve_ledger_path(args)
    data = read_ledger(path)
    dims = data.setdefault("goal_dimensions", [])
    dim = find_or_create(
        dims,
        args.dimension_id,
        {
            "id": args.dimension_id,
            "name": "",
            "why_it_matters": "",
            "current_state": "",
            "item_refs": [],
            "question_refs": [],
            "risk_if_ignored": "",
            "next_probe": "",
            "created_at": now(),
        },
    )
    dim.update(
        {
            "name": args.name,
            "why_it_matters": args.why,
            "current_state": args.current_state,
            "risk_if_ignored": args.risk,
            "next_probe": args.next_probe,
            "updated_at": now(),
        }
    )
    write_ledger(path, data)
    print(f"ok: dimension {args.dimension_id} in {repo_rel(root, path)}")
    return 0


def command_add_item(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    path = resolve_ledger_path(args)
    if args.epistemic_class not in EP_CLASSES:
        raise SystemExit(f"invalid epistemic class: {args.epistemic_class}")
    if args.status not in ITEM_STATUSES:
        raise SystemExit(f"invalid status: {args.status}")
    if args.source not in SOURCES:
        raise SystemExit(f"invalid source: {args.source}")
    if args.confidence not in CONFIDENCE:
        raise SystemExit(f"invalid confidence: {args.confidence}")
    data = read_ledger(path)
    items = data.setdefault("epistemic_items", [])
    item = find_or_create(
        items,
        args.item_id,
        {
            "id": args.item_id,
            "created_at": now(),
        },
    )
    item.update(
        {
            "epistemic_class": args.epistemic_class,
            "status": args.status,
            "statement": args.statement,
            "source": args.source,
            "confidence": args.confidence,
            "dimension_refs": split_values(args.dimension),
            "evidence_refs": split_values(args.evidence_ref),
            "next_action": args.next_action,
            "updated_at": now(),
        }
    )
    for dim in data.setdefault("goal_dimensions", []):
        if dim.get("id") in item["dimension_refs"] and args.item_id not in dim.setdefault("item_refs", []):
            dim["item_refs"].append(args.item_id)
    write_ledger(path, data)
    print(f"ok: item {args.item_id} in {repo_rel(root, path)}")
    return 0


def command_add_question(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    path = resolve_ledger_path(args)
    data = read_ledger(path)
    questions = data.setdefault("questions", [])
    question = find_or_create(questions, args.question_id, {"id": args.question_id, "created_at": now()})
    question.update(
        {
            "question": args.question,
            "status": args.status,
            "dimension_refs": split_values(args.dimension),
            "decision_protected": args.decision_protected,
            "answer_ref": args.answer_ref,
            "updated_at": now(),
        }
    )
    for dim in data.setdefault("goal_dimensions", []):
        if dim.get("id") in question["dimension_refs"] and args.question_id not in dim.setdefault("question_refs", []):
            dim["question_refs"].append(args.question_id)
    write_ledger(path, data)
    print(f"ok: question {args.question_id} in {repo_rel(root, path)}")
    return 0


def command_snapshot(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    path = resolve_ledger_path(args)
    if args.status not in SNAPSHOT_STATUSES:
        raise SystemExit(f"invalid snapshot status: {args.status}")
    data = read_ledger(path)
    snapshots = data.setdefault("snapshots", [])
    snap = find_or_create(snapshots, args.snapshot_id, {"id": args.snapshot_id, "created_at": now()})
    snap.update(
        {
            "title": args.title,
            "summary": args.summary,
            "status": args.status,
            "refs": split_values(args.ref),
            "updated_at": now(),
        }
    )
    if args.status in {"candidate", "accepted"}:
        data["status"] = "snapshot_ready"
    write_ledger(path, data)
    print(f"ok: snapshot {args.snapshot_id} in {repo_rel(root, path)}")
    return 0


def render_markdown(data: dict) -> str:
    lines = [
        "# Consensus Ledger",
        "",
        "<!-- Generated by bagakit-consensus-ledger. Do not edit directly. -->",
        "",
        "## Goal",
        "",
        f"- Ledger: `{data.get('ledger_id', '')}`",
        f"- Status: `{data.get('status', '')}`",
        f"- Owner: `{data.get('owner', {}).get('owner_skill', '')}` `{data.get('owner', {}).get('owner_ref', '')}`",
        f"- Goal: {data.get('goal_context', {}).get('goal', '')}",
    ]
    success_bar = data.get("goal_context", {}).get("success_bar", "")
    if success_bar:
        lines.append(f"- Success bar: {success_bar}")
    protected = data.get("goal_context", {}).get("protected_principle", "")
    if protected:
        lines.append(f"- Protected principle: {protected}")
    lines.extend(["", "## Dimensions", ""])
    for dim in data.get("goal_dimensions", []):
        lines.extend(
            [
                f"### {dim.get('id', '')}: {dim.get('name', '')}",
                "",
                f"- Why: {dim.get('why_it_matters', '')}",
                f"- Current state: {dim.get('current_state', '')}",
                f"- Items: {', '.join(dim.get('item_refs', [])) or 'none'}",
                f"- Questions: {', '.join(dim.get('question_refs', [])) or 'none'}",
                f"- Risk if ignored: {dim.get('risk_if_ignored', '')}",
                f"- Next probe: {dim.get('next_probe', '')}",
                "",
            ]
        )
    lines.extend(["## Shared Understanding", ""])
    groups = [
        ("known_known", "Known known", "Confirmed or directly available understanding."),
        ("known_unknown", "Known unknown", "Explicit gaps, risks, or missing decisions."),
        ("unknown_known", "Unknown known", "Inferred or latent understanding that needs confirmation."),
        ("unknown_unknown", "Unknown unknown", "Possible blind spots or unexplored dimensions."),
    ]
    items = data.get("epistemic_items", [])
    for ep_class, title, note in groups:
        lines.extend([f"### {title}", "", f"- Meaning: {note}"])
        matched = [item for item in items if item.get("epistemic_class") == ep_class]
        if matched:
            for item in matched:
                lines.append(f"- `{item.get('id', '')}` {item.get('status', '')}: {item.get('statement', '')}")
        else:
            lines.append("- none")
        lines.append("")

    lines.extend(["## Epistemic Items", ""])
    for item in items:
        lines.extend(
            [
                f"- `{item.get('id', '')}` {item.get('epistemic_class', '')}/{item.get('status', '')}: {item.get('statement', '')}",
                f"  - source: {item.get('source', '')}; confidence: {item.get('confidence', '')}; dimensions: {', '.join(item.get('dimension_refs', [])) or 'none'}",
            ]
        )
    if not data.get("epistemic_items"):
        lines.append("- none")
    lines.extend(["", "## Questions", ""])
    for question in data.get("questions", []):
        lines.append(f"- `{question.get('id', '')}` {question.get('status', '')}: {question.get('question', '')}")
    if not data.get("questions"):
        lines.append("- none")
    lines.extend(["", "## Snapshots", ""])
    for snap in data.get("snapshots", []):
        lines.append(f"- `{snap.get('id', '')}` {snap.get('status', '')}: {snap.get('title', '')}")
    if not data.get("snapshots"):
        lines.append("- none")
    lines.extend(["", "## Source Of Truth", "", "- Authoritative ledger truth: JSON ledger file.", ""])
    return "\n".join(lines)


def command_render(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    path = resolve_ledger_path(args)
    data = read_ledger(path)
    view = path.with_suffix(".md")
    view.write_text(render_markdown(data), encoding="utf-8")
    data.setdefault("render", {})["view_path"] = repo_rel(root, view)
    data["render"]["last_rendered_at"] = now()
    write_ledger(path, data)
    print(f"ok: rendered {repo_rel(root, view)}")
    return 0


def validate_data(data: dict) -> list[str]:
    errors: list[str] = []
    if data.get("schema") != SCHEMA:
        errors.append("schema mismatch")
    if data.get("status") not in LEDGER_STATUSES:
        errors.append("invalid ledger status")
    dim_ids = {dim.get("id") for dim in data.get("goal_dimensions", [])}
    for item in data.get("epistemic_items", []):
        if item.get("epistemic_class") not in EP_CLASSES:
            errors.append(f"{item.get('id')}: invalid epistemic class")
        if item.get("status") not in ITEM_STATUSES:
            errors.append(f"{item.get('id')}: invalid status")
        for dim in item.get("dimension_refs", []):
            if dim not in dim_ids:
                errors.append(f"{item.get('id')}: unknown dimension ref {dim}")
        if item.get("status") in {"inferred", "contested", "promoted"} and not item.get("evidence_refs"):
            errors.append(f"{item.get('id')}: {item.get('status')} item needs evidence_refs")
    return errors


def command_validate(args: argparse.Namespace) -> int:
    path = resolve_ledger_path(args)
    data = read_ledger(path)
    errors = validate_data(data)
    if errors:
        for error in errors:
            print(f"error: {error}", file=sys.stderr)
        return 1
    print("consensus ledger check passed")
    return 0


def command_status(args: argparse.Namespace) -> int:
    path = resolve_ledger_path(args)
    data = read_ledger(path)
    print(f"ledger_id={data.get('ledger_id', '')}")
    print(f"status={data.get('status', '')}")
    print(f"dimensions={len(data.get('goal_dimensions', []))}")
    print(f"items={len(data.get('epistemic_items', []))}")
    print(f"questions={len(data.get('questions', []))}")
    print(f"snapshots={len(data.get('snapshots', []))}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Manage Bagakit consensus ledgers.")
    sub = parser.add_subparsers(dest="command", required=True)

    def common(p: argparse.ArgumentParser) -> None:
        p.add_argument("--root", default=".")
        p.add_argument("--ledger")

    p = sub.add_parser("init")
    p.add_argument("--root", default=".")
    p.add_argument("--ledger")
    p.add_argument("--ledger-id", default="")
    p.add_argument("--owner-ref", default="")
    p.add_argument("--owner-skill", default="user")
    p.add_argument("--goal", required=True)
    p.add_argument("--success-bar", default="")
    p.add_argument("--non-goal", action="append", default=[])
    p.add_argument("--protected-principle", default="")
    p.set_defaults(func=command_init)

    p = sub.add_parser("add-dimension")
    common(p)
    p.add_argument("--dimension-id", required=True)
    p.add_argument("--name", required=True)
    p.add_argument("--why", required=True)
    p.add_argument("--current-state", default="")
    p.add_argument("--risk", default="")
    p.add_argument("--next-probe", default="")
    p.set_defaults(func=command_add_dimension)

    p = sub.add_parser("add-item")
    common(p)
    p.add_argument("--item-id", required=True)
    p.add_argument("--epistemic-class", required=True)
    p.add_argument("--status", required=True)
    p.add_argument("--statement", required=True)
    p.add_argument("--source", default="agent_inference")
    p.add_argument("--confidence", default="unknown")
    p.add_argument("--dimension", action="append", default=[])
    p.add_argument("--evidence-ref", action="append", default=[])
    p.add_argument("--next-action", default="")
    p.set_defaults(func=command_add_item)

    p = sub.add_parser("add-question")
    common(p)
    p.add_argument("--question-id", required=True)
    p.add_argument("--question", required=True)
    p.add_argument("--status", default="pending")
    p.add_argument("--dimension", action="append", default=[])
    p.add_argument("--decision-protected", default="")
    p.add_argument("--answer-ref", default="")
    p.set_defaults(func=command_add_question)

    p = sub.add_parser("snapshot")
    common(p)
    p.add_argument("--snapshot-id", required=True)
    p.add_argument("--title", required=True)
    p.add_argument("--summary", required=True)
    p.add_argument("--status", default="candidate")
    p.add_argument("--ref", action="append", default=[])
    p.set_defaults(func=command_snapshot)

    p = sub.add_parser("render")
    common(p)
    p.set_defaults(func=command_render)

    p = sub.add_parser("status")
    common(p)
    p.set_defaults(func=command_status)

    p = sub.add_parser("validate")
    common(p)
    p.set_defaults(func=command_validate)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
