#!/usr/bin/env python3
"""Artifact and message helpers for bagakit-git-message-craft."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath


HOOK_MARKER = "BAGAKIT_GIT_MESSAGE_CRAFT_HOOK"
FOOTER_PROTOCOL = "bagakit.git-message-craft/v1"
FOOTER_HEADER = "[[BAGAKIT]]"
FOOTER_PROTOCOL_LINE = f"- GitMessageCraft: Protocol={FOOTER_PROTOCOL}"
SUBJECT_RE = re.compile(r"^[a-z][a-z0-9-]*(?:\([^)]+\))?: .+$")
COMMIT_SHA_RE = re.compile(r"^[0-9a-f]{7,40}$")
FACT_LINE_RE = re.compile(r"(?m)^- (?P<priority>P[0-2]): (?P<summary>.+?) Key refs: (?P<refs>.+)$")
AMBIGUOUS_START_RE = re.compile(r"^(?:it|this|that|these|those|they)\b", re.IGNORECASE)
FOOTER_PROTOCOL_RE = re.compile(r"(?m)^- GitMessageCraft: Protocol=(?P<protocol>[^\s;]+)(?:;.*)?$")
MR_SUMMARY_START = "<!-- bagakit:git-message-craft:start -->"
MR_SUMMARY_END = "<!-- bagakit:git-message-craft:end -->"
SESSION_ARTIFACTS_LOCAL = "local"
SESSION_ARTIFACTS_TRACKED = "tracked"
ARCHIVE_CLEANUP_SESSION = "session"
ARCHIVE_CLEANUP_NONE = "none"
ABSOLUTE_PATH_LITERAL_RE = re.compile(
    r"""(?:(?<=^)|(?<=[\s"'`(\[]))(?P<path>(?:/(?!/)[^\s"'`)\],;]+|[A-Za-z]:\\[^\s"'`)\],;]+|\\\\[^\s"'`)\],;]+))"""
)
FACT_PRIORITY_ORDER = {"p0": 0, "p1": 1, "p2": 2}
SESSION_GITIGNORE_TEXT = (
    "# bagakit-git-message-craft local mode\n"
    "# Keep git-message-craft session artifacts local by default.\n"
    "*\n"
    "!.gitignore\n"
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def utc_day() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")
    if not value:
        raise SystemExit("error: topic slug became empty")
    return value


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def rel(root: Path, path: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)


def describe_repo_or_git_path(root: Path, path: Path) -> str:
    resolved = path.resolve()
    if path_within(resolved, root):
        return rel(root, resolved)

    git_dir = git_dir_path(root)
    if path_within(resolved, git_dir):
        return f"git-dir/{rel(git_dir, resolved)}"

    raise ValueError(f"path must stay within the repo root or git dir: {resolved}")


def resolve_user_path(root: Path, value: str) -> Path:
    path = Path(value).expanduser()
    if not path.is_absolute():
        path = root / path
    return path.resolve()


def path_within(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
    except ValueError:
        return False
    return True


def git_dir_path(root: Path) -> Path:
    git_dir = Path(run_git(root, ["rev-parse", "--git-dir"]).strip())
    if not git_dir.is_absolute():
        git_dir = root / git_dir
    return git_dir


def discover_git_root(start: Path) -> Path | None:
    try:
        result = subprocess.run(
            ["git", "-C", str(start), "rev-parse", "--show-toplevel"],
            check=True,
            capture_output=True,
            text=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None
    output = result.stdout.strip()
    if not output:
        return None
    return Path(output).resolve()


def is_windows_absolute_path(value: str) -> bool:
    return bool(re.match(r"^[A-Za-z]:[\\/]", value) or value.startswith("\\\\"))


def normalize_repo_relative_path(root: Path, value: str) -> str:
    raw = value.strip()
    if not raw:
        raise ValueError("path must not be empty")
    if "<" in raw or ">" in raw:
        raise ValueError("path contains placeholder token")
    if raw.startswith("~"):
        raise ValueError("home-relative paths are not allowed; use repo-relative paths")
    if is_windows_absolute_path(raw):
        raise ValueError("absolute filesystem paths are not allowed; use repo-relative paths")
    if raw.startswith("/"):
        resolved = Path(raw).expanduser().resolve()
        if not path_within(resolved, root):
            raise ValueError("absolute path points outside repo root")
        raw = rel(root, resolved)
    normalized = PurePosixPath(raw.replace("\\", "/")).as_posix()
    if normalized.startswith("/"):
        raise ValueError("absolute filesystem paths are not allowed; use repo-relative paths")
    if normalized in {"", "."}:
        raise ValueError("path must not be empty")
    if any(part == ".." for part in PurePosixPath(normalized).parts):
        raise ValueError("path traversal is not allowed in key refs")
    while normalized.startswith("./"):
        normalized = normalized[2:]
    if not normalized:
        raise ValueError("path must not be empty")
    return normalized


def normalize_key_ref(root: Path, raw_ref: str) -> str:
    value = raw_ref.strip()
    if not value:
        raise ValueError("key ref must not be empty")
    path_part, sep, line_part = value.rpartition(":")
    if not sep or not line_part.isdigit():
        raise ValueError("key refs must use 'path:line' format")
    line_number = int(line_part)
    if line_number < 1:
        raise ValueError("line number must be >= 1")
    normalized_path = normalize_repo_relative_path(root, path_part)
    return f"{normalized_path}:{line_number}"


def normalize_key_refs(root: Path, raw_refs: str) -> str:
    parts = [part.strip() for part in re.split(r"[;,]", raw_refs) if part.strip()]
    if not parts:
        raise ValueError("key refs must include at least one repo-relative 'path:line' item")
    return ", ".join(normalize_key_ref(root, part) for part in parts)


def find_absolute_path_literals(text: str) -> list[str]:
    seen: set[str] = set()
    matches: list[str] = []
    for match in ABSOLUTE_PATH_LITERAL_RE.finditer(text):
        value = match.group("path").rstrip(".")
        if value not in seen:
            seen.add(value)
            matches.append(value)
    return matches


def normalize_archive_text(root: Path, text: str, field_label: str) -> str:
    normalized = text.strip()
    if not normalized:
        raise ValueError(f"{field_label} must not be empty")

    git_dir = git_dir_path(root)
    for literal in find_absolute_path_literals(normalized):
        if is_windows_absolute_path(literal):
            raise ValueError(
                f"{field_label} must not contain Windows absolute paths in durable output: {literal}"
            )

        resolved = Path(literal).expanduser().resolve()
        if path_within(resolved, root):
            replacement = rel(root, resolved)
        elif path_within(resolved, git_dir):
            replacement = f"git-dir/{rel(git_dir, resolved)}"
        else:
            raise ValueError(
                f"{field_label} must not contain absolute paths outside the repo root or git dir: {literal}"
            )

        normalized = normalized.replace(literal, replacement)

    return normalized


def prune_local_session_root(session_root: Path) -> None:
    if not session_root.is_dir():
        return

    remaining_entries = [entry for entry in session_root.iterdir() if entry.name != ".gitignore"]
    if remaining_entries:
        return

    ignore_path = session_root / ".gitignore"
    if ignore_path.is_file():
        ignore_path.unlink()
        print(f"removed: {ignore_path}")

    if any(session_root.iterdir()):
        return
    session_root.rmdir()
    print(f"removed: {session_root}")

    bagakit_root = session_root.parent
    if bagakit_root.name == ".bagakit" and bagakit_root.is_dir() and not any(bagakit_root.iterdir()):
        bagakit_root.rmdir()
        print(f"removed: {bagakit_root}")


def run_git(root: Path, args: list[str]) -> str:
    cmd = ["git", *args]
    try:
        out = subprocess.check_output(cmd, cwd=root, text=True)
    except subprocess.CalledProcessError as exc:
        raise SystemExit(f"error: git command failed: {' '.join(cmd)}") from exc
    return out


def ensure_git_repo(root: Path) -> None:
    try:
        run_git(root, ["rev-parse", "--is-inside-work-tree"])
    except SystemExit as exc:
        raise SystemExit(f"error: not a git repository: {root}") from exc


def skill_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def ensure_session_gitignore(root: Path, mode: str) -> Path | None:
    if mode != SESSION_ARTIFACTS_LOCAL:
        return None

    ignore_path = root / ".bagakit" / "git-message-craft" / ".gitignore"
    if ignore_path.is_file():
        return None

    write_text(ignore_path, SESSION_GITIGNORE_TEXT)
    return ignore_path


@dataclass
class ChangeItem:
    status: str
    path: str


@dataclass
class FactEntry:
    priority: str
    summary: str
    refs: str


def parse_status_line(line: str) -> ChangeItem | None:
    if not line.strip():
        return None
    status = line[:2]
    path = line[3:]
    if " -> " in path:
        path = path.split(" -> ", 1)[1]
    return ChangeItem(status=status, path=path)


def gather_changes(root: Path, staged_only: bool) -> list[ChangeItem]:
    if staged_only:
        raw = run_git(root, ["diff", "--cached", "--name-status"])
        items: list[ChangeItem] = []
        for line in raw.splitlines():
            if not line.strip():
                continue
            parts = line.split("\t")
            if len(parts) < 2:
                continue
            status = parts[0]
            path = parts[-1]
            items.append(ChangeItem(status=status[:2].ljust(2), path=path))
        return items

    raw = run_git(root, ["status", "--porcelain"])
    items = []
    for line in raw.splitlines():
        item = parse_status_line(line)
        if item:
            items.append(item)
    return items


def is_message_craft_artifact(path: str) -> bool:
    return path == ".bagakit/git-message-craft/.gitignore" or path.startswith(".bagakit/git-message-craft/")


def classify_kind(path: str) -> str:
    lower = path.lower()
    name = Path(lower).name
    if lower.startswith("docs/") or name.endswith((".md", ".rst", ".txt", ".adoc")):
        return "docs"
    if any(token in lower for token in ["/test", "/tests", "__tests__", "spec.", "_test.", ".spec."]):
        return "test"
    if lower.startswith(".github/") or name in {
        "package.json",
        "package-lock.json",
        "pnpm-lock.yaml",
        "yarn.lock",
        "requirements.txt",
        "pyproject.toml",
        "go.mod",
        "go.sum",
        "cargo.toml",
        "cargo.lock",
        "makefile",
    }:
        return "config"
    if lower.startswith("scripts/") or lower.startswith("tools/"):
        return "tooling"
    return "code"


def classify_area(path: str) -> str:
    parts = Path(path).parts
    if not parts:
        return "root"
    first = parts[0]
    if first.startswith(".") and len(parts) > 1:
        return parts[1]
    return first


def suggest_type(kind: str) -> str:
    return {
        "docs": "docs",
        "test": "test",
        "config": "chore",
        "tooling": "chore",
        "code": "refactor",
    }.get(kind, "chore")


def normalize_fact_priority(value: str) -> str:
    cleaned = value.strip().lower()
    if cleaned not in FACT_PRIORITY_ORDER:
        raise ValueError("fact priority must be one of p0|p1|p2")
    return cleaned


def parse_fact_entry(root: Path, raw: str) -> FactEntry:
    parts = [part.strip() for part in raw.split("|")]
    if len(parts) != 3 or not all(parts):
        raise ValueError("--fact must be in format 'p0|self-contained statement|key refs'")
    priority = normalize_fact_priority(parts[0])
    statement = parts[1]
    refs = normalize_key_refs(root, parts[2])
    if "<" in statement or ">" in statement:
        raise ValueError("fact entries must not contain placeholder tokens")
    if statement.endswith("."):
        statement = statement[:-1]
    return FactEntry(priority=priority, summary=statement, refs=refs)


def extract_section(text: str, heading: str) -> str:
    pattern = rf"(?ms)^## {re.escape(heading)}\n(.*?)(?=^## |\Z)"
    match = re.search(pattern, text)
    return match.group(1).strip() if match else ""


def render_simple_section(title: str, bullets: list[str], fallback: str) -> list[str]:
    lines = [f"## {title}"]
    if bullets:
        lines.extend(f"- {item}" for item in bullets)
    else:
        lines.append(f"- {fallback}")
    lines.append("")
    return lines


def render_fact_section(facts: list[FactEntry]) -> list[str]:
    lines = ["## Key Facts"]
    for item in facts:
        lines.append(f"- {item.priority.upper()}: {item.summary}. Key refs: {item.refs}")
    lines.append("")
    return lines


def render_context_section(before: str, change: str, result: str) -> list[str]:
    lines = ["## Context"]
    lines.append(f"- Before: {before}")
    lines.append(f"- Change: {change}")
    lines.append(f"- Result: {result}")
    lines.append("")
    return lines


def render_footer() -> list[str]:
    return ["", FOOTER_HEADER, FOOTER_PROTOCOL_LINE]


def clean_items(values: list[str]) -> list[str]:
    return [value.strip() for value in values if value and value.strip()]


def ensure_lines(values: list[str], label: str) -> list[str]:
    items = clean_items(values)
    if not items:
        raise SystemExit(f"error: provide at least one {label}")
    return items


def resolve_output_path(output: str, default_path: Path) -> Path:
    return Path(output).resolve() if output else default_path


def render_summary_paragraphs(lines: list[str]) -> list[str]:
    rendered: list[str] = []
    for line in lines:
        rendered.append(line)
    return rendered


def render_bullets(values: list[str]) -> list[str]:
    return [f"- {value}" for value in values]


def render_mr_title_outcome_first(change_type: str, outcome: str, scope: str) -> str:
    return f"{change_type}: {outcome} for {scope}"


def render_mr_title_scope_first(change_type: str, scope: str, change: str) -> str:
    return f"{change_type}({scope}): {change}"


def render_mr_body_green_refresh(
    summary_lines: list[str],
    why: str,
    what_changed: list[str],
    gate_revision: str,
    local_checks: str,
    non_goals: str,
    follow_up: str,
) -> str:
    lines = [
        MR_SUMMARY_START,
        "## Summary",
        *render_summary_paragraphs(summary_lines),
        "",
        "## Why",
        why,
        "",
        "## What Changed",
        *render_bullets(what_changed),
        "",
        "## Validation",
        f"- Gate revision: `{gate_revision}`",
        "- MR checks: `green`",
        f"- Local checks: {local_checks}",
        "",
        "## Non-goals / Follow-ups",
        f"- Non-goals: {non_goals}",
        f"- Follow-up: {follow_up}",
        MR_SUMMARY_END,
        "",
    ]
    return "\n".join(lines)


def render_mr_body_status_refresh(
    summary_lines: list[str],
    why: str,
    mr_checks: str,
    gate_revision: str,
    main_blocker: str,
    what_changed: list[str],
    owner: str,
    action: str,
    non_goals: str,
    open_questions: str,
) -> str:
    lines = [
        MR_SUMMARY_START,
        "## Summary",
        *render_summary_paragraphs(summary_lines),
        "",
        "## Why",
        why,
        "",
        "## Current Status",
        f"- Gate revision: `{gate_revision}`",
        f"- MR checks: `{mr_checks}`",
        f"- Main blocker: {main_blocker}",
        "",
        "## What Changed",
        *render_bullets(what_changed),
        "",
        "## Next Step",
        f"- Owner: {owner}",
        f"- Action: {action}",
        "",
        "## Non-goals / Open Questions",
        f"- Non-goals: {non_goals}",
        f"- Open questions: {open_questions}",
        MR_SUMMARY_END,
        "",
    ]
    return "\n".join(lines)


def split_body_and_footer(text: str) -> tuple[str, str, list[str]]:
    errors: list[str] = []
    lines = text.splitlines()
    if not lines:
        return "", "", ["message is empty"]

    if len(lines) < 3:
        return "", "", ["message too short to include markdown body and footer"]

    if lines[1].strip():
        errors.append("second line must be blank")

    if any(line.strip() == "+++" for line in lines):
        errors.append("frontmatter is no longer supported; move protocol markers to the [[BAGAKIT]] footer")
    if re.search(r"(?m)^schema\s*=", text):
        errors.append("schema frontmatter is no longer supported; use the footer protocol marker instead")

    footer_index = None
    for index, line in enumerate(lines[2:], start=2):
        if line.strip() == FOOTER_HEADER:
            footer_index = index
            break

    if footer_index is None:
        errors.append(f"missing required footer anchor: {FOOTER_HEADER}")
        body = "\n".join(lines[2:]).strip("\n")
        return body, "", errors

    if footer_index > 2 and lines[footer_index - 1].strip():
        errors.append("blank line required before the [[BAGAKIT]] footer")

    body = "\n".join(lines[2:footer_index]).rstrip("\n")
    footer = "\n".join(lines[footer_index:])
    return body, footer, errors


def ambiguous_context_warning(label: str, value: str) -> str | None:
    stripped = value.strip()
    if not stripped:
        return None
    if AMBIGUOUS_START_RE.match(stripped):
        return f"{label} should start with an explicit noun instead of an ambiguous pronoun"
    return None


def default_action_dest(root: Path) -> str:
    branch = run_git(root, ["branch", "--show-current"]).strip()
    if branch:
        return f"git:{branch}"
    return "git:HEAD"


def prompt_yes_no(question: str, default_yes: bool = True) -> bool:
    if not sys.stdin.isatty():
        return False
    suffix = "[Y/n]" if default_yes else "[y/N]"
    answer = input(f"{question} {suffix} ").strip().lower()
    if not answer:
        return default_yes
    return answer in {"y", "yes"}


def render_hook_from_template(template_path: Path, skill_hint: Path) -> str:
    template = read_text(template_path)
    return template.replace("__SKILL_DIR_HINT__", str(skill_hint))


def install_commit_msg_hook(root: Path, force: bool) -> Path:
    ensure_git_repo(root)
    git_dir = git_dir_path(root)
    hooks_dir = git_dir / "hooks"
    hooks_dir.mkdir(parents=True, exist_ok=True)

    hook_path = hooks_dir / "commit-msg"
    template_path = skill_dir() / "scripts" / "templates" / "commit-msg-template.sh"
    if not template_path.is_file():
        raise SystemExit(f"error: hook template missing: {template_path}")

    if hook_path.exists():
        existing = read_text(hook_path)
        if HOOK_MARKER not in existing and not force:
            raise SystemExit(
                f"error: existing hook at {hook_path} is not managed by bagakit; use --force to replace"
            )
        if HOOK_MARKER not in existing and force:
            backup = hook_path.with_name(f"commit-msg.bak.{utc_day().replace('-', '')}")
            shutil.copy2(hook_path, backup)
            print(f"backup: {backup}")

    rendered = render_hook_from_template(template_path, skill_dir())
    write_text(hook_path, rendered)
    hook_path.chmod(0o755)
    return hook_path


def cmd_install_hooks(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    hook_path = install_commit_msg_hook(root, force=args.force)
    print(f"installed: {hook_path}")
    return 0


def cmd_init(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    ensure_git_repo(root)

    topic = args.topic.strip()
    slug = slugify(topic)
    ignored = ensure_session_gitignore(root, args.session_artifacts)
    session = f"{utc_day()}-{slug}"
    session_dir = root / ".bagakit" / "git-message-craft" / session
    if session_dir.exists() and not args.force:
        raise SystemExit(f"error: session already exists: {session_dir}")

    session_dir.mkdir(parents=True, exist_ok=True)

    if ignored:
        print(f"wrote: {ignored}")
    print(f"initialized: {session_dir}")

    mode = args.install_hooks
    if mode == "yes":
        hook_path = install_commit_msg_hook(root, force=args.force_hooks)
        print(f"installed: {hook_path}")
    elif mode == "ask":
        if sys.stdin.isatty():
            if prompt_yes_no("Install commit-msg hook template now?", default_yes=True):
                hook_path = install_commit_msg_hook(root, force=args.force_hooks)
                print(f"installed: {hook_path}")
            else:
                print("skipped: hook install")
        else:
            print(
                "hint: run `sh scripts/bagakit-git-message-craft.sh install-hooks --root .` "
                "to enable commit message gate hook"
            )
    return 0


def cmd_inventory(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    ensure_git_repo(root)
    session_dir = Path(args.dir).resolve()
    if not session_dir.is_dir():
        raise SystemExit(f"error: session dir not found: {session_dir}")

    items = [
        item
        for item in gather_changes(root, staged_only=args.staged_only)
        if not is_message_craft_artifact(item.path)
    ]
    if not items:
        raise SystemExit("error: no changed files found after excluding git-message-craft session artifacts")

    groups: dict[tuple[str, str], list[ChangeItem]] = defaultdict(list)
    for item in items:
        kind = classify_kind(item.path)
        area = classify_area(item.path)
        groups[(kind, area)].append(item)

    lines = [
        "# Suggested Split Inventory",
        "",
        f"Generated: {utc_now_iso()}",
        "Repository root: `.`",
        "",
        "| Group | Suggested Type | Files |",
        "| --- | --- | --- |",
    ]

    serializable = []
    for idx, ((kind, area), members) in enumerate(sorted(groups.items()), start=1):
        group = f"G{idx}-{kind}-{area}"
        ctype = suggest_type(kind)
        files = "<br>".join(sorted(m.path for m in members))
        lines.append(f"| {group} | {ctype} | {files} |")
        serializable.append(
            {
                "group": group,
                "kind": kind,
                "area": area,
                "suggested_type": ctype,
                "files": sorted(m.path for m in members),
            }
        )

    lines.append("")
    lines.append("## Notes")
    lines.append("- Split by intent boundary first, then by file grouping.")
    lines.append("- Use `git add -p` when one file contains mixed intents.")
    lines.append("- Keep the final commit message to 1-5 ranked facts; do not mirror every touched file.")

    write_text(session_dir / "split-inventory.md", "\n".join(lines) + "\n")
    print(f"wrote: {session_dir / 'split-inventory.md'}")
    if args.write_json:
        write_text(session_dir / "split-inventory.json", json.dumps(serializable, indent=2) + "\n")
        print(f"wrote: {session_dir / 'split-inventory.json'}")
    return 0


def cmd_draft_message(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    ensure_git_repo(root)

    session_dir = Path(args.dir).resolve()
    if not session_dir.is_dir():
        raise SystemExit(f"error: session dir not found: {session_dir}")

    ctype = args.type.strip()
    scope = args.scope.strip()
    summary = args.summary.strip()
    if not ctype or not summary:
        raise SystemExit("error: --type and --summary are required")
    why_before = args.why_before.strip()
    why_change = args.why_change.strip()
    why_gain = args.why_gain.strip()
    if not why_before or not why_change or not why_gain:
        raise SystemExit("error: --why-before, --why-change, and --why-gain are required")

    checks = [item.strip() for item in args.check if item.strip()]
    if not checks:
        raise SystemExit("error: provide at least one --check item with concrete validation evidence")

    try:
        facts = [parse_fact_entry(root, raw) for raw in args.fact]
    except ValueError as exc:
        raise SystemExit(f"error: {exc}")
    if not facts:
        raise SystemExit("error: provide at least one --fact with repo-relative key refs")
    if len(facts) > 5:
        raise SystemExit("error: keep commit messages to at most 5 ranked facts; split the commit or compress the facts")

    facts = sorted(facts, key=lambda item: FACT_PRIORITY_ORDER[item.priority])
    if facts[0].priority != "p0":
        raise SystemExit("error: at least one primary fact is required; start the ranked list with p0")

    subject = f"{ctype}({scope}): {summary}" if scope else f"{ctype}: {summary}"

    lines = [subject, ""]
    lines.extend(render_context_section(why_before, why_change, why_gain))
    lines.extend(render_fact_section(facts))
    lines.extend(render_simple_section("Validation", checks, ""))
    if args.follow_up:
        lines.extend(render_simple_section("Follow-ups", args.follow_up, "state remaining actions"))
    lines.extend(render_footer())

    trailers = list(args.trailer)
    if args.ref:
        for ref in args.ref:
            trailers.append(f"Refs: {ref}")

    if trailers:
        lines.append("")
        lines.extend(trailers)

    default_name = f"commit-{ctype}-{slugify(summary)}.txt"
    output = Path(args.output).resolve() if args.output else session_dir / default_name
    write_text(output, "\n".join(lines).rstrip() + "\n")
    print(f"wrote: {output}")
    return 0


def cmd_draft_mr_title(args: argparse.Namespace) -> int:
    change_type = args.type.strip()
    if not change_type:
        raise SystemExit("error: --type is required")

    template = args.template
    if template == "outcome-first":
        outcome = args.outcome.strip()
        scope = args.scope.strip()
        if not outcome or not scope:
            raise SystemExit("error: outcome-first requires --outcome and --scope")
        title = render_mr_title_outcome_first(change_type, outcome, scope)
    else:
        scope = args.scope.strip()
        change = args.change.strip()
        if not scope or not change:
            raise SystemExit("error: scope-first requires --scope and --change")
        title = render_mr_title_scope_first(change_type, scope, change)

    output = Path(args.output).resolve() if args.output else None
    if output:
        write_text(output, f"{title}\n")
        print(f"wrote: {output}")
    else:
        print(title)
    return 0


def cmd_draft_mr_body(args: argparse.Namespace) -> int:
    summary_lines = ensure_lines(args.summary_line, "--summary-line")
    what_changed = ensure_lines(args.what_changed, "--what-changed")
    why = args.why.strip()
    if not why:
        raise SystemExit("error: --why is required")

    template = args.template
    if template == "green-refresh":
        gate_revision = args.gate_revision.strip()
        if not gate_revision:
            raise SystemExit("error: green-refresh requires --gate-revision")
        body = render_mr_body_green_refresh(
            summary_lines=summary_lines,
            why=why,
            what_changed=what_changed,
            gate_revision=gate_revision,
            local_checks=args.local_checks.strip() or "`not applicable`",
            non_goals=args.non_goals.strip() or "none",
            follow_up=args.follow_up.strip() or "none",
        )
    else:
        gate_revision = args.gate_revision.strip()
        mr_checks = args.mr_checks.strip()
        owner = args.owner.strip()
        action = args.action.strip()
        if not gate_revision or not mr_checks or not owner or not action:
            raise SystemExit(
                "error: status-refresh requires --gate-revision, --mr-checks, --owner, and --action"
            )
        body = render_mr_body_status_refresh(
            summary_lines=summary_lines,
            why=why,
            mr_checks=mr_checks,
            gate_revision=gate_revision,
            main_blocker=args.main_blocker.strip() or "none",
            what_changed=what_changed,
            owner=owner,
            action=action,
            non_goals=args.non_goals.strip() or "none",
            open_questions=args.open_questions.strip() or "none",
        )

    output = Path(args.output).resolve() if args.output else None
    if output:
        write_text(output, body)
        print(f"wrote: {output}")
    else:
        print(body, end="")
    return 0


def cmd_lint_message(args: argparse.Namespace) -> int:
    path = Path(args.message).resolve()
    if not path.is_file():
        raise SystemExit(f"error: message file not found: {path}")

    if args.root:
        lint_root = Path(args.root).expanduser().resolve()
        ensure_git_repo(lint_root)
    else:
        lint_root = discover_git_root(path.parent) or discover_git_root(Path.cwd())
        if lint_root is None:
            raise SystemExit("error: unable to detect git repo root for key-ref validation; pass --root explicitly")

    text = read_text(path)
    lines = text.splitlines()
    if not lines:
        raise SystemExit("error: message file is empty")

    errors: list[str] = []
    warnings: list[str] = []
    subject = lines[0].strip()
    if not subject:
        errors.append("subject line is empty")
    if len(subject) > args.max_subject:
        errors.append(f"subject exceeds {args.max_subject} chars")
    if subject and not SUBJECT_RE.match(subject):
        errors.append("subject must match '<type>(<scope>): <summary>' or '<type>: <summary>'")

    body, footer, parse_errors = split_body_and_footer(text)
    errors.extend(parse_errors)

    if len(lines) < args.min_lines:
        errors.append(f"message must be at least {args.min_lines} lines to avoid one-line commit")

    protocol_match = FOOTER_PROTOCOL_RE.search(footer)
    if not protocol_match:
        errors.append("missing required footer protocol line: - GitMessageCraft: Protocol=<protocol>")
    elif protocol_match.group("protocol") != FOOTER_PROTOCOL:
        errors.append(f"footer protocol must be {FOOTER_PROTOCOL}")

    if "<" in body and ">" in body:
        errors.append("body still contains placeholder tokens")

    absolute_literals = find_absolute_path_literals(text)
    if absolute_literals:
        errors.append("message must not contain absolute filesystem path literals; use repo-relative paths instead")
        for sample in absolute_literals[:5]:
            errors.append(f"absolute path literal found: {sample}")

    required_headings = [
        "Context",
        "Key Facts",
        "Validation",
    ]
    for heading in required_headings:
        if f"## {heading}" not in body:
            errors.append(f"missing required GFM heading: ## {heading}")

    context_section = extract_section(body, "Context")
    before_match = re.search(r"(?m)^- Before: (?P<value>.+\S)$", context_section)
    change_match = re.search(r"(?m)^- Change: (?P<value>.+\S)$", context_section)
    result_match = re.search(r"(?m)^- Result: (?P<value>.+\S)$", context_section)
    if not before_match:
        errors.append("Context must include '- Before: <pre-change state and context>'")
    if not change_match:
        errors.append("Context must include '- Change: <what changed in this commit>'")
    if not result_match:
        errors.append("Context must include '- Result: <incremental outcome>'")
    for label, match in (("Before", before_match), ("Change", change_match), ("Result", result_match)):
        if match:
            warning = ambiguous_context_warning(label, match.group("value"))
            if warning:
                warnings.append(warning)

    facts_section = extract_section(body, "Key Facts")
    fact_entries = list(FACT_LINE_RE.finditer(facts_section))
    if not fact_entries:
        errors.append("Key Facts must include at least one ranked fact line")
    if len(fact_entries) > 5:
        errors.append("Key Facts must include at most 5 ranked fact lines")
    previous_priority = -1
    first_priority = ""
    for index, match in enumerate(fact_entries):
        priority = match.group("priority")
        summary_value = match.group("summary").strip()
        refs_text = match.group("refs")
        priority_value = FACT_PRIORITY_ORDER[priority.lower()]
        if index == 0:
            first_priority = priority
        if priority_value < previous_priority:
            errors.append("Key Facts must be sorted by priority from P0 to P2")
        previous_priority = priority_value
        try:
            normalized_refs = normalize_key_refs(lint_root, refs_text)
        except ValueError as exc:
            errors.append(f"Key refs invalid: {exc}")
            continue
        if refs_text.strip() != normalized_refs:
            errors.append(
                f"Key refs must use normalized repo-relative 'path:line' items; expected: {normalized_refs}"
            )
        warning = ambiguous_context_warning(f"Key fact {priority}", summary_value)
        if warning:
            warnings.append(warning)
    if fact_entries and first_priority != "P0":
        errors.append("Key Facts must start with a primary P0 fact")

    validation_section = extract_section(body, "Validation")
    if not re.search(r"(?m)^- ", validation_section):
        errors.append("Validation section must include at least one bullet")

    follow_up_section = extract_section(body, "Follow-ups")
    if "## Follow-ups" in body and not re.search(r"(?m)^- .+\S$", follow_up_section):
        errors.append("Follow-ups must include at least one concrete bullet when present")

    if errors:
        for err in errors:
            print(f"error: {err}", file=sys.stderr)
        return 1

    for warning in warnings:
        print(f"warn: {warning}", file=sys.stderr)
    print("ok: commit message lint passed")
    return 0


def cmd_archive(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    ensure_git_repo(root)

    session_dir = Path(args.dir).resolve()
    if not session_dir.is_dir():
        raise SystemExit(f"error: session dir not found: {session_dir}")

    action_dest = args.action_dest.strip() or default_action_dest(root)
    memory_dest = args.memory_dest.strip()

    cleanup_mode = args.cleanup.strip().lower()
    if cleanup_mode not in {ARCHIVE_CLEANUP_SESSION, ARCHIVE_CLEANUP_NONE}:
        raise SystemExit("error: --cleanup must be session|none")

    session_root = root / ".bagakit" / "git-message-craft"
    local_store_root = git_dir_path(root) / "bagakit" / "git-message-craft"
    if cleanup_mode == ARCHIVE_CLEANUP_SESSION and not path_within(session_dir, session_root):
        raise SystemExit(
            "error: --cleanup session requires --dir under .bagakit/git-message-craft; "
            "use --cleanup none for custom session paths"
        )

    if memory_dest.lower() == "none":
        reason = args.memory_none_reason.strip() or "commit message and git history are the primary record"
        try:
            memory_line = normalize_archive_text(root, f"none ({reason})", "memory-none-reason")
        except ValueError as exc:
            raise SystemExit(f"error: {exc}")
    else:
        memory_path = resolve_user_path(root, memory_dest)
        if cleanup_mode == ARCHIVE_CLEANUP_SESSION and path_within(memory_path, session_dir):
            memory_target = local_store_root / "memory" / f"{session_dir.name}.md"
            if memory_path.is_file():
                write_text(memory_target, read_text(memory_path))
            else:
                write_text(
                    memory_target,
                    "# Commit Session Memory\n\n"
                    f"- session: {session_dir.name}\n"
                    "- note: source memory file missing at archive-time; created by auto-migration.\n",
                )
            print(f"migrated-memory: {memory_path} -> {memory_target}")
            try:
                memory_line = describe_repo_or_git_path(root, memory_target)
            except ValueError as exc:
                raise SystemExit(f"error: {exc}")
        else:
            try:
                memory_line = normalize_archive_text(root, memory_dest, "memory-dest")
            except ValueError as exc:
                raise SystemExit(f"error: {exc}")

    commits: list[str] = []
    for raw_commit in args.commit:
        commit = raw_commit.strip()
        if not commit:
            continue
        if not COMMIT_SHA_RE.match(commit):
            raise SystemExit(f"error: invalid commit hash: {commit}")
        try:
            run_git(root, ["rev-parse", "--verify", f"{commit}^{{commit}}"])
        except SystemExit as exc:
            raise SystemExit(f"error: commit not found: {commit}") from exc
        if commit not in commits:
            commits.append(commit)

    if not commits:
        raise SystemExit("error: provide at least one --commit as archive evidence")

    raw_checks = [item.strip() for item in args.check_evidence if item.strip()]
    if not raw_checks:
        raise SystemExit("error: provide at least one --check-evidence item")
    try:
        checks = [normalize_archive_text(root, item, "check-evidence") for item in raw_checks]
        action_line = normalize_archive_text(root, action_dest, "action-dest")
    except ValueError as exc:
        raise SystemExit(f"error: {exc}")

    archive_path = resolve_user_path(root, args.archive_path) if args.archive_path else session_dir / "archive.md"
    if cleanup_mode == ARCHIVE_CLEANUP_SESSION and path_within(archive_path, session_dir):
        relocated_archive = local_store_root / "archive" / f"{session_dir.name}.md"
        print(f"migrated-archive: {archive_path} -> {relocated_archive}")
        archive_path = relocated_archive
    try:
        archive_line = describe_repo_or_git_path(root, archive_path)
    except ValueError as exc:
        raise SystemExit(f"error: {exc}")

    lines = [
        "# Commit Session Archive",
        "",
        "Status: complete",
        f"- updated_at: {utc_now_iso()}",
        f"- action_handoff: {action_line}",
        f"- memory_handoff: {memory_line}",
        f"- archive: {archive_line}",
        "",
        "## Commit Evidence",
    ]
    lines.extend(f"- {commit}" for commit in commits)
    lines.extend(
        [
            "",
            "## Check Evidence",
        ]
    )
    lines.extend(f"- {check}" for check in checks)

    write_text(archive_path, "\n".join(lines) + "\n")
    print(f"wrote: {archive_path}")

    if cleanup_mode == ARCHIVE_CLEANUP_SESSION:
        shutil.rmtree(session_dir)
        print(f"cleaned-session: {session_dir}")
        prune_local_session_root(session_root)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p_init = sub.add_parser("init", help="initialize commit session artifacts")
    p_init.add_argument("--root", default=".", help="git repo root")
    p_init.add_argument("--topic", required=True, help="session topic")
    p_init.add_argument("--force", action="store_true", help="overwrite existing session directory")
    p_init.add_argument(
        "--session-artifacts",
        default=SESSION_ARTIFACTS_LOCAL,
        choices=[SESSION_ARTIFACTS_LOCAL, SESSION_ARTIFACTS_TRACKED],
        help="local creates .bagakit/git-message-craft/.gitignore; tracked keeps session artifacts visible to git",
    )
    p_init.add_argument(
        "--install-hooks",
        default="ask",
        choices=["ask", "yes", "no"],
        help="commit-msg hook install mode during init",
    )
    p_init.add_argument("--force-hooks", action="store_true", help="replace existing non-bagakit hook")
    p_init.set_defaults(func=cmd_init)

    p_hook = sub.add_parser("install-hooks", help="install commit-msg hook template into current repo")
    p_hook.add_argument("--root", default=".", help="git repo root")
    p_hook.add_argument("--force", action="store_true", help="replace existing non-bagakit hook")
    p_hook.set_defaults(func=cmd_install_hooks)

    p_inv = sub.add_parser("inventory", help="generate split inventory from working tree")
    p_inv.add_argument("--root", default=".", help="git repo root")
    p_inv.add_argument("--dir", required=True, help="session artifact directory")
    p_inv.add_argument("--staged-only", action="store_true", help="inspect staged files only")
    p_inv.add_argument("--write-json", action="store_true", help="also write split-inventory.json when needed")
    p_inv.set_defaults(func=cmd_inventory)

    p_msg = sub.add_parser("draft-message", help="draft a GFM spec-style commit message with a footer protocol marker")
    p_msg.add_argument("--root", default=".", help="git repo root")
    p_msg.add_argument("--dir", required=True, help="session artifact directory")
    p_msg.add_argument("--type", required=True, help="commit type (feat/fix/refactor/docs/test/chore)")
    p_msg.add_argument("--scope", default="", help="commit scope")
    p_msg.add_argument("--summary", required=True, help="short subject summary")
    p_msg.add_argument("--why-before", required=True, help="pre-change state and why change was needed")
    p_msg.add_argument("--why-change", required=True, help="what changed in this commit")
    p_msg.add_argument("--why-gain", required=True, help="what concrete result this commit brings")
    p_msg.add_argument(
        "--fact",
        action="append",
        default=[],
        help="ranked fact in format 'p0|self-contained statement|repo-relative key refs'",
    )
    p_msg.add_argument("--check", action="append", default=[], help="validation evidence bullet (required, repeatable)")
    p_msg.add_argument("--follow-up", action="append", default=[], help="optional follow-up bullet")
    p_msg.add_argument("--ref", action="append", default=[], help="reference id/url")
    p_msg.add_argument("--trailer", action="append", default=[], help="raw trailer line")
    p_msg.add_argument("--output", default="", help="output commit message path")
    p_msg.set_defaults(func=cmd_draft_message)

    p_mr_title = sub.add_parser("draft-mr-title", help="draft an MR title from one of the bundled title patterns")
    p_mr_title.add_argument("--template", required=True, choices=["outcome-first", "scope-first"])
    p_mr_title.add_argument("--type", required=True, help="MR title type such as fix|feat|refactor")
    p_mr_title.add_argument("--scope", default="", help="scope or affected surface")
    p_mr_title.add_argument("--outcome", default="", help="reviewer-visible outcome for outcome-first titles")
    p_mr_title.add_argument("--change", default="", help="concrete change for scope-first titles")
    p_mr_title.add_argument("--output", default="", help="optional output file path; prints to stdout when omitted")
    p_mr_title.set_defaults(func=cmd_draft_mr_title)

    p_mr_body = sub.add_parser("draft-mr-body", help="draft an MR body block from one of the bundled body patterns")
    p_mr_body.add_argument("--template", required=True, choices=["green-refresh", "status-refresh"])
    p_mr_body.add_argument("--summary-line", action="append", default=[], help="summary paragraph line, repeatable")
    p_mr_body.add_argument("--why", required=True, help="why the MR exists")
    p_mr_body.add_argument("--what-changed", action="append", default=[], help="high-signal change bullet, repeatable")
    p_mr_body.add_argument("--gate-revision", default="", help="current gate revision sha or identifier")
    p_mr_body.add_argument("--local-checks", default="", help="local checks line for green-refresh")
    p_mr_body.add_argument("--non-goals", default="", help="explicit non-goal boundary")
    p_mr_body.add_argument("--follow-up", default="", help="single follow-up item for green-refresh")
    p_mr_body.add_argument("--mr-checks", default="", help="pending|running|blocked for status-refresh")
    p_mr_body.add_argument("--main-blocker", default="", help="main blocker line for status-refresh")
    p_mr_body.add_argument("--owner", default="", help="next-step owner for status-refresh")
    p_mr_body.add_argument("--action", default="", help="next-step action for status-refresh")
    p_mr_body.add_argument("--open-questions", default="", help="single unresolved question for status-refresh")
    p_mr_body.add_argument("--output", default="", help="optional output file path; prints to stdout when omitted")
    p_mr_body.set_defaults(func=cmd_draft_mr_body)

    p_lint = sub.add_parser("lint-message", help="lint commit message hard invariants")
    p_lint.add_argument("--message", required=True, help="commit message file")
    p_lint.add_argument("--root", default="", help="git repo root (auto-detected when omitted)")
    p_lint.add_argument("--max-subject", type=int, default=72, help="subject length limit")
    p_lint.add_argument("--min-lines", type=int, default=12, help="minimum message lines")
    p_lint.set_defaults(func=cmd_lint_message)

    p_arc = sub.add_parser("archive", help="write completion archive record")
    p_arc.add_argument("--root", default=".", help="git repo root")
    p_arc.add_argument("--dir", required=True, help="session artifact directory")
    p_arc.add_argument("--action-dest", default="", help="action handoff destination; defaults to current branch")
    p_arc.add_argument("--memory-dest", default="none", help="memory handoff destination or none")
    p_arc.add_argument("--memory-none-reason", default="", help="optional rationale when memory-dest=none")
    p_arc.add_argument("--commit", action="append", default=[], help="commit hash evidence (required, repeatable)")
    p_arc.add_argument(
        "--check-evidence",
        action="append",
        default=[],
        help="check/validation evidence (required, repeatable)",
    )
    p_arc.add_argument("--archive-path", default="", help="custom archive file path")
    p_arc.add_argument(
        "--cleanup",
        default=ARCHIVE_CLEANUP_SESSION,
        choices=[ARCHIVE_CLEANUP_SESSION, ARCHIVE_CLEANUP_NONE],
        help="archive-time cleanup mode: session migrates archive/memory out of session dir then deletes session",
    )
    p_arc.set_defaults(func=cmd_archive)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
