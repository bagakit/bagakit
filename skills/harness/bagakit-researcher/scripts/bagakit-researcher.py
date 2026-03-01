#!/usr/bin/env python3
"""Local-first research workspace helper for Bagakit."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


DEFAULT_RESEARCHER_ROOT = ".bagakit/researcher"


def slugify(raw: str) -> str:
    lowered = raw.strip().lower()
    lowered = re.sub(r"[^a-z0-9]+", "-", lowered)
    lowered = re.sub(r"-{2,}", "-", lowered).strip("-")
    return lowered or "topic"


def normalize_topic_class(raw: str) -> str:
    value = raw.strip()
    if value.startswith("."):
        value = value[1:]
    return slugify(value)


def resolve_root(raw: str) -> Path:
    return (Path.cwd() / raw).resolve()


def load_researcher_root(root: Path) -> str:
    conf = root / ".bagakit" / "knowledge_conf.toml"
    if not conf.is_file():
        return DEFAULT_RESEARCHER_ROOT
    current = ""
    top_level_value = ""
    for raw_line in conf.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("[") and line.endswith("]"):
            current = line[1:-1].strip()
            continue
        if "=" not in line:
            continue
        key, raw_value = line.split("=", 1)
        if key.strip() != "researcher_root":
            continue
        value = raw_value.strip().strip('"').strip("'")
        if current == "paths":
            return value
        if current == "":
            top_level_value = value
    return top_level_value or DEFAULT_RESEARCHER_ROOT


def workspace_dir(root: Path, topic_class: str, topic: str) -> Path:
    return root / load_researcher_root(root) / "topics" / normalize_topic_class(topic_class) / slugify(topic)


def title_of(path: Path) -> str:
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return path.name


def topic_index_text(root: Path, workspace: Path, title: str) -> str:
    originals = sorted((workspace / "originals").glob("*.md")) if (workspace / "originals").is_dir() else []
    summaries = sorted((workspace / "summaries").glob("*.md")) if (workspace / "summaries").is_dir() else []

    lines = [
        f"# {title}",
        "",
        "## Goal",
        "",
        f"Research topic for `{workspace.relative_to(root).as_posix()}`.",
        "",
        "## Local Topic Layout",
        "",
        "```text",
        f"{workspace.relative_to(root).as_posix()}/",
        "├── originals/",
        "├── summaries/",
        "└── index.md",
        "```",
        "",
        "## Current Read Order",
        "",
        "1. `summaries/`",
        "2. preserved source cards under `originals/`",
        "3. update this index after every meaningful research pass",
        "",
        "## Source Cards",
    ]
    if originals:
        lines.extend([f"- `originals/{path.name}` — {title_of(path)}" for path in originals])
    else:
        lines.append("- none yet")
    lines.extend(["", "## Summaries"])
    if summaries:
        lines.extend([f"- `summaries/{path.name}` — {title_of(path)}" for path in summaries])
    else:
        lines.append("- none yet")
    lines.extend(
        [
            "",
            "## Remaining Gaps",
            "",
            "- add or refine source cards",
            "- add or refine reusable summaries",
            "- update the reading order when the topic changes",
            "",
        ]
    )
    return "\n".join(lines)


def write_file(path: Path, text: str, force: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and not force:
        raise SystemExit(f"error: already exists: {path}")
    path.write_text(text, encoding="utf-8")


def init_topic(args: argparse.Namespace) -> int:
    root = resolve_root(args.root)
    workspace = workspace_dir(root, args.topic_class, args.topic)
    (workspace / "originals").mkdir(parents=True, exist_ok=True)
    (workspace / "summaries").mkdir(parents=True, exist_ok=True)
    index = workspace / "index.md"
    if not index.exists():
        index.write_text(topic_index_text(root, workspace, args.title or args.topic), encoding="utf-8")
    print(f"ok: initialized {workspace}")
    return 0


def add_source_card(args: argparse.Namespace) -> int:
    root = resolve_root(args.root)
    workspace = workspace_dir(root, args.topic_class, args.topic)
    if not workspace.exists():
        raise SystemExit(f"error: topic workspace missing: {workspace}")
    target = workspace / "originals" / f"{slugify(args.source_id)}.md"
    text = "\n".join(
        [
            f"# {args.title}",
            "",
            "## Source",
            "",
            f"- id: `{args.source_id}`",
            f"- url: `{args.url}`",
            f"- published: `{args.published or 'unknown'}`",
            f"- authority: `{args.authority}`",
            "",
            "## Why It Matters",
            "",
            args.why or "<why this source matters>",
            "",
        ]
    )
    write_file(target, text, force=args.force)
    print(f"ok: wrote {target.relative_to(root)}")
    return 0


def add_summary(args: argparse.Namespace) -> int:
    root = resolve_root(args.root)
    workspace = workspace_dir(root, args.topic_class, args.topic)
    if not workspace.exists():
        raise SystemExit(f"error: topic workspace missing: {workspace}")
    target = workspace / "summaries" / f"{slugify(args.source_id)}.md"
    lines = [
        f"# {args.title}",
        "",
        "## What This Is",
        "",
        f"- source id: `{args.source_id}`",
        "",
        "## Why It Matters",
        "",
        args.why_matters or "<why this matters>",
        "",
        "## Borrow",
    ]
    if args.borrow:
        lines.extend([f"- {item}" for item in args.borrow])
    else:
        lines.append("- <what to borrow>")
    lines.extend(["", "## Avoid"])
    if args.avoid:
        lines.extend([f"- {item}" for item in args.avoid])
    else:
        lines.append("- <what not to copy>")
    lines.extend(["", "## Bagakit Implication"])
    if args.implication:
        lines.extend([f"- {item}" for item in args.implication])
    else:
        lines.append("- <bagakit implication>")
    lines.append("")
    write_file(target, "\n".join(lines), force=args.force)
    print(f"ok: wrote {target.relative_to(root)}")
    return 0


def refresh_index(args: argparse.Namespace) -> int:
    root = resolve_root(args.root)
    workspace = workspace_dir(root, args.topic_class, args.topic)
    if not workspace.exists():
        raise SystemExit(f"error: topic workspace missing: {workspace}")
    index = workspace / "index.md"
    index.write_text(topic_index_text(root, workspace, args.title or workspace.name.replace("-", " ").title()), encoding="utf-8")
    print(f"ok: refreshed {index.relative_to(root)}")
    return 0


def iter_topics(root: Path):
    base = root / load_researcher_root(root) / "topics"
    if not base.is_dir():
        return
    for topic_class_dir in sorted(base.iterdir()):
        if not topic_class_dir.is_dir():
            continue
        for topic in sorted(topic_class_dir.iterdir()):
            if topic.is_dir():
                yield topic_class_dir.name, topic


def list_topics(args: argparse.Namespace) -> int:
    root = resolve_root(args.root)
    found = False
    for topic_class, workspace in iter_topics(root) or []:
        index = workspace / "index.md"
        if index.exists():
            found = True
            print(f"{topic_class}/{workspace.name}\t{index.relative_to(root)}")
    if not found:
        print("no research topics found")
    return 0


def validate_workspace(root: Path, workspace: Path) -> list[str]:
    issues: list[str] = []
    rel = workspace.relative_to(root)
    if not (workspace / "index.md").is_file():
        issues.append(f"missing index.md: {rel}")
    if not (workspace / "originals").is_dir():
        issues.append(f"missing originals/: {rel}")
    if not (workspace / "summaries").is_dir():
        issues.append(f"missing summaries/: {rel}")
    return issues


def doctor(args: argparse.Namespace) -> int:
    root = resolve_root(args.root)
    issues: list[str] = []

    if args.topic_class and args.topic:
        workspace = workspace_dir(root, args.topic_class, args.topic)
        if not workspace.exists():
            issues.append(f"missing topic workspace: {workspace.relative_to(root)}")
        else:
            issues.extend(validate_workspace(root, workspace))
    else:
        found = False
        for _topic_class, workspace in iter_topics(root) or []:
            found = True
            issues.extend(validate_workspace(root, workspace))
        if not found:
            issues.append("no researcher topics found under the configured researcher root")

    if issues:
        for issue in issues:
            print(issue, file=sys.stderr)
        return 1

    print("research workspace check passed")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Bagakit local-first research workspace helper")
    sub = parser.add_subparsers(dest="command", required=True)

    init_p = sub.add_parser("init-topic", help="initialize one topic workspace under the configured researcher root")
    init_p.add_argument("--root", default=".")
    init_p.add_argument("--topic-class", required=True)
    init_p.add_argument("--topic", required=True)
    init_p.add_argument("--title")
    init_p.set_defaults(func=init_topic)

    card_p = sub.add_parser("add-source-card", help="write one source card under originals/")
    card_p.add_argument("--root", default=".")
    card_p.add_argument("--topic-class", required=True)
    card_p.add_argument("--topic", required=True)
    card_p.add_argument("--source-id", required=True)
    card_p.add_argument("--title", required=True)
    card_p.add_argument("--url", required=True)
    card_p.add_argument("--authority", required=True)
    card_p.add_argument("--published")
    card_p.add_argument("--why")
    card_p.add_argument("--force", action="store_true")
    card_p.set_defaults(func=add_source_card)

    summary_p = sub.add_parser("add-summary", help="write one reusable summary under summaries/")
    summary_p.add_argument("--root", default=".")
    summary_p.add_argument("--topic-class", required=True)
    summary_p.add_argument("--topic", required=True)
    summary_p.add_argument("--source-id", required=True)
    summary_p.add_argument("--title", required=True)
    summary_p.add_argument("--why-matters")
    summary_p.add_argument("--borrow", action="append", default=[])
    summary_p.add_argument("--avoid", action="append", default=[])
    summary_p.add_argument("--implication", action="append", default=[])
    summary_p.add_argument("--force", action="store_true")
    summary_p.set_defaults(func=add_summary)

    refresh_p = sub.add_parser("refresh-index", help="refresh one topic index")
    refresh_p.add_argument("--root", default=".")
    refresh_p.add_argument("--topic-class", required=True)
    refresh_p.add_argument("--topic", required=True)
    refresh_p.add_argument("--title")
    refresh_p.set_defaults(func=refresh_index)

    list_p = sub.add_parser("list-topics", help="list researcher topics")
    list_p.add_argument("--root", default=".")
    list_p.set_defaults(func=list_topics)

    doctor_p = sub.add_parser("doctor", help="validate one topic or every researcher topic workspace")
    doctor_p.add_argument("--root", default=".")
    doctor_p.add_argument("--topic-class")
    doctor_p.add_argument("--topic")
    doctor_p.set_defaults(func=doctor)

    return parser


def main(argv: list[str]) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
