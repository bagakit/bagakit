#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

ENV_SKILL_DIR = "BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR"
START_TAG = "<!-- BAGAKIT:LIVING-KNOWLEDGE:START -->"
END_TAG = "<!-- BAGAKIT:LIVING-KNOWLEDGE:END -->"
ROOT_REDEFINITION_RE = re.compile(r"(?i)\bas the (?:canonical|shared) knowledge root\b")
SUBTREE_STORAGE_REDEFINITION_RE = re.compile(
    r"(?i)\b(?:use|store|keep|put|write)\b.*\b(?:docs/|notes/|knowledge/)\S*.*\bfor this subtree\b"
)
BOOTSTRAP_SHADOW_TOKENS = (
    "This is a managed block for `bagakit-living-knowledge`.",
    "AGENTS.md is only the bootstrap layer",
    "BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR",
)
REPO_ABSOLUTE_PATH_RE = re.compile(r"(?<![A-Za-z0-9_.-])/(?:Users|home|var|tmp|private)/")


@dataclass(frozen=True)
class KnowledgeConfig:
    shared_root: str = "docs"
    system_root: str = "docs"
    generated_root: str = ".bagakit/living-knowledge/.generated"
    researcher_root: str = ".bagakit/researcher"
    selector_root: str = ".bagakit/skill-selector"
    evolver_root: str = ".bagakit/evolver"


@dataclass(frozen=True)
class Surfaces:
    root: Path
    config_file: Path
    shared_root: Path
    system_root: Path
    generated_root: Path
    agents: Path
    must_guidebook: Path
    must_authority: Path
    must_recall: Path


def eprint(*items: object) -> None:
    print(*items, file=sys.stderr)


def normalize_rel(value: str) -> str:
    text = value.replace("\\", "/")
    while text.startswith("./"):
        text = text[2:]
    return text


def repo_root(value: str) -> Path:
    root = Path(value).expanduser().resolve()
    if not root.exists():
        raise SystemExit(f"error: invalid --root: {value}")
    return root


def skill_root() -> Path:
    env = os.environ.get(ENV_SKILL_DIR)
    if env:
        path = Path(env).expanduser().resolve()
        if not path.is_dir():
            raise SystemExit(f"error: {ENV_SKILL_DIR} does not point to a directory: {env}")
        return path
    return Path(__file__).resolve().parent.parent


def template_root() -> Path:
    return skill_root() / "playbook" / "tpl"


def read_template(name: str) -> str:
    path = template_root() / name
    if not path.is_file():
        raise SystemExit(f"error: missing template: {path}")
    return path.read_text(encoding="utf-8")


def render_template(name: str, replacements: dict[str, str] | None = None) -> str:
    text = read_template(name)
    for key, value in (replacements or {}).items():
        text = text.replace("{{" + key + "}}", value)
    return text


def relpath(root: Path, path: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()


def assert_repo_containment(root: Path, path: Path) -> Path:
    resolved_root = root.resolve()
    try:
        relative = path.relative_to(root)
    except ValueError as exc:
        raise SystemExit(f"error: path is outside repo root: {path}") from exc
    current = root
    for part in relative.parts:
        current = current / part
        current_rel = relative if current == path else current.relative_to(root)
        if current.is_symlink():
            raise SystemExit(f"error: path uses symlinked component under repo root: {current_rel.as_posix()}")
        if current.exists():
            resolved_current = current.resolve()
            if resolved_current != resolved_root and resolved_root not in resolved_current.parents:
                raise SystemExit(f"error: resolved path escapes repo root: {current_rel.as_posix()}")
    return path


def safe_any_repo_path(root: Path, value: str) -> Path:
    rel = normalize_rel(value)
    if rel in {"", "."}:
        return root
    if rel == ".." or rel.startswith("/") or rel.startswith("../") or "/../" in rel:
        raise SystemExit(f"error: unsafe path: {value}")
    return assert_repo_containment(root, root / rel)


def safe_repo_path(root: Path, value: str, allowed_prefixes: Sequence[str]) -> Path:
    rel = normalize_rel(value)
    if rel in {"", ".", ".."} or rel.startswith("/") or rel.startswith("../") or "/../" in rel:
        raise SystemExit(f"error: unsafe path: {value}")
    if not any(rel == prefix or rel.startswith(prefix + "/") for prefix in allowed_prefixes):
        raise SystemExit(f"error: disallowed path: {value}")
    return assert_repo_containment(root, root / rel)


def read_title(path: Path) -> str:
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return path.name


def parse_simple_toml(path: Path) -> dict[str, dict[str, str]]:
    payload: dict[str, dict[str, str]] = {}
    current = ""
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("[") and line.endswith("]"):
            current = line[1:-1].strip()
            payload.setdefault(current, {})
            continue
        if "=" not in line:
            continue
        key, raw_value = line.split("=", 1)
        key = key.strip()
        value = raw_value.strip().strip('"').strip("'")
        payload.setdefault(current, {})[key] = value
    return payload


def load_config(root: Path) -> KnowledgeConfig:
    conf = root / ".bagakit" / "knowledge_conf.toml"
    if not conf.is_file():
        return KnowledgeConfig()
    payload = parse_simple_toml(conf)
    paths = payload.get("paths", {})
    return KnowledgeConfig(
        shared_root=paths.get("shared_root", "docs"),
        system_root=paths.get("system_root", paths.get("shared_root", "docs")),
        generated_root=paths.get("generated_root", ".bagakit/living-knowledge/.generated"),
        researcher_root=paths.get("researcher_root", ".bagakit/researcher"),
        selector_root=paths.get("selector_root", ".bagakit/skill-selector"),
        evolver_root=paths.get("evolver_root", ".bagakit/evolver"),
    )


def config_text(config: KnowledgeConfig) -> str:
    return "\n".join(
        [
            "version = 1",
            "",
            "[paths]",
            f'shared_root = "{config.shared_root}"',
            f'system_root = "{config.system_root}"',
            f'generated_root = "{config.generated_root}"',
            f'researcher_root = "{config.researcher_root}"',
            f'selector_root = "{config.selector_root}"',
            f'evolver_root = "{config.evolver_root}"',
            "",
        ]
    )


def surfaces(root: Path, config: KnowledgeConfig | None = None) -> Surfaces:
    cfg = config or load_config(root)
    config_file = root / ".bagakit" / "knowledge_conf.toml"
    shared_root = safe_any_repo_path(root, cfg.shared_root)
    system_root = safe_any_repo_path(root, cfg.system_root)
    generated_root = safe_any_repo_path(root, cfg.generated_root)
    return Surfaces(
        root=root,
        config_file=config_file,
        shared_root=shared_root,
        system_root=system_root,
        generated_root=generated_root,
        agents=root / "AGENTS.md",
        must_guidebook=system_root / "must-guidebook.md",
        must_authority=system_root / "must-authority.md",
        must_recall=system_root / "must-recall.md",
    )


def write_if_needed(path: Path, text: str, force: bool) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_text(encoding="utf-8") == text:
            return f"skip: {path}"
        if not force:
            return f"skip: {path} already exists"
    path.write_text(text, encoding="utf-8")
    return f"write: {path}"


def ensure_agents_block(target: Path, config: KnowledgeConfig) -> str:
    block = render_template(
        "agents-block-template.md",
        {
            "SHARED_ROOT": config.shared_root,
            "SYSTEM_ROOT": config.system_root,
        },
    )
    if not target.exists():
        target.write_text(block + "\n", encoding="utf-8")
        return f"write: {target}"
    text = target.read_text(encoding="utf-8")
    if START_TAG in text and END_TAG in text:
        updated = re.sub(re.escape(START_TAG) + r".*?" + re.escape(END_TAG), block, text, flags=re.S)
        if updated != text:
            target.write_text(updated, encoding="utf-8")
            return f"update: {target} (replaced managed block)"
        return f"skip: {target} (managed block unchanged)"
    if text and not text.endswith("\n"):
        text += "\n"
    target.write_text(text + block + "\n", encoding="utf-8")
    return f"update: {target} (appended managed block)"


def ensure_git_exclude(root: Path, generated_root: Path) -> str | None:
    exclude = root / ".git" / "info" / "exclude"
    if not exclude.is_file():
        return None
    rel = relpath(root, generated_root)
    block = "\n".join(
        [
            "# BAGAKIT:LIVING-KNOWLEDGE:START",
            f"/{rel}/",
            "# BAGAKIT:LIVING-KNOWLEDGE:END",
            "",
        ]
    )
    text = exclude.read_text(encoding="utf-8", errors="replace")
    if "# BAGAKIT:LIVING-KNOWLEDGE:START" in text and "# BAGAKIT:LIVING-KNOWLEDGE:END" in text:
        updated = re.sub(
            r"(?ms)^# BAGAKIT:LIVING-KNOWLEDGE:START\n.*?^# BAGAKIT:LIVING-KNOWLEDGE:END\n?",
            block,
            text,
        )
        if updated != text:
            exclude.write_text(updated, encoding="utf-8")
            return f"update: {exclude} (living-knowledge exclude block)"
        return f"skip: {exclude} (living-knowledge exclude block unchanged)"
    if text and not text.endswith("\n"):
        text += "\n"
    exclude.write_text(text + block, encoding="utf-8")
    return f"update: {exclude} (appended living-knowledge exclude block)"


def iter_markdown(root: Path, base: Path) -> Iterable[Path]:
    assert_repo_containment(root, base)
    if not base.exists():
        return
    for path in sorted(base.rglob("*.md")):
        rel = path.relative_to(base)
        if any(part.startswith(".") for part in rel.parts):
            continue
        assert_repo_containment(root, path)
        if path.is_file():
            yield path


def build_page_map(root: Path, shared_root: Path, system_root: Path) -> str:
    items: list[str] = []
    if shared_root.is_dir():
        for child in sorted(shared_root.iterdir()):
            if child.name.startswith("."):
                continue
            if child == system_root or child.name.startswith("must-"):
                continue
            assert_repo_containment(root, child)
            if child.is_dir():
                label = read_title(child / "README.md") if (child / "README.md").is_file() else child.name
                items.append(f"- `{relpath(root, child)}` — {label}")
            elif child.is_file() and child.suffix == ".md":
                items.append(f"- `{relpath(root, child)}` — {read_title(child)}")
    return "\n".join(items) if items else "- no shared pages yet"


def build_detailed_map(root: Path, shared_root: Path) -> str:
    lines = ["# Shared Knowledge Map", ""]
    count = 0
    for path in iter_markdown(root, shared_root):
        if path.name.startswith("must-"):
            continue
        lines.append(f"- `{relpath(root, path)}` — {read_title(path)}")
        count += 1
    if count == 0:
        lines.append("- no shared pages yet")
    lines.append("")
    return "\n".join(lines)


def sanitize_source_content(root: Path, text: str) -> str:
    if root.as_posix() in text or REPO_ABSOLUTE_PATH_RE.search(text):
        raise SystemExit("error: shared knowledge must not absorb absolute filesystem path literals")
    return text


def find_applicable_agents(root: Path, cwd: Path) -> list[Path]:
    current = cwd if cwd.is_dir() else cwd.parent
    found: list[Path] = []
    while True:
        agents = current / "AGENTS.md"
        if agents.exists():
            assert_repo_containment(root, agents)
        if agents.is_file():
            found.append(agents)
        if current == root:
            break
        current = current.parent
    return list(reversed(found))


def nested_agents_error(path: Path, root: Path, text: str) -> str | None:
    if START_TAG in text or END_TAG in text:
        return f"path-local AGENTS.md must not embed the managed living-knowledge block: {relpath(root, path)}"
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        lowered = line.lower()
        if "do not redefine the shared knowledge root" in lowered or "must not redefine the shared knowledge root" in lowered:
            continue
        if ROOT_REDEFINITION_RE.search(line) or SUBTREE_STORAGE_REDEFINITION_RE.search(line):
            return f"path-local AGENTS.md must not redefine the shared knowledge root: {relpath(root, path)}"
    if any(token in text for token in BOOTSTRAP_SHADOW_TOKENS):
        return f"path-local AGENTS.md must not shadow the shared bootstrap authority: {relpath(root, path)}"
    if "LivingKnowledge:" in text:
        return f"path-local AGENTS.md must not impose the living-knowledge reporting footer: {relpath(root, path)}"
    return None


def git_visible_generated_state(root: Path, generated_root: Path) -> list[str]:
    if not (root / ".git").exists():
        return []
    result = subprocess.run(
        ["git", "-C", str(root), "status", "--short", "--untracked-files=all", "--", relpath(root, generated_root)],
        check=False,
        capture_output=True,
        text=True,
    )
    return [line for line in result.stdout.splitlines() if line.strip()] if result.returncode == 0 else []


def git_tracked_generated_state(root: Path, generated_root: Path) -> list[str]:
    if not (root / ".git").exists():
        return []
    result = subprocess.run(
        ["git", "-C", str(root), "ls-files", "--", relpath(root, generated_root)],
        check=False,
        capture_output=True,
        text=True,
    )
    return [line for line in result.stdout.splitlines() if line.strip()] if result.returncode == 0 else []


def build_guidebook(root: Path, config: KnowledgeConfig, shared_root: Path, system_root: Path) -> str:
    return render_template(
        "must-guidebook-template.md",
        {
            "SHARED_ROOT": relpath(root, shared_root),
            "SHARED_PAGE_MAP": build_page_map(root, shared_root, system_root),
        },
    )


def apply_command(args: argparse.Namespace) -> int:
    root = repo_root(args.root)
    default_cfg = KnowledgeConfig()
    s = surfaces(root, default_cfg if not (root / ".bagakit" / "knowledge_conf.toml").exists() else None)
    outputs: list[str] = []

    outputs.append(write_if_needed(s.config_file, config_text(default_cfg), args.force))
    cfg = load_config(root)
    s = surfaces(root, cfg)

    s.shared_root.mkdir(parents=True, exist_ok=True)
    s.system_root.mkdir(parents=True, exist_ok=True)
    s.generated_root.mkdir(parents=True, exist_ok=True)

    outputs.append(ensure_agents_block(s.agents, cfg))
    outputs.append(write_if_needed(s.generated_root / ".gitignore", "*\n!.gitignore\n", args.force))
    exclude = ensure_git_exclude(root, s.generated_root)
    if exclude is not None:
        outputs.append(exclude)

    outputs.append(
        write_if_needed(
            s.must_authority,
            render_template(
                "must-authority-template.md",
                {
                    "SHARED_ROOT": relpath(root, s.shared_root),
                    "RESEARCHER_ROOT": cfg.researcher_root,
                    "SELECTOR_ROOT": cfg.selector_root,
                    "EVOLVER_ROOT": cfg.evolver_root,
                },
            ),
            args.force,
        )
    )
    outputs.append(write_if_needed(s.must_recall, render_template("must-recall-template.md"), args.force))
    outputs.append(write_if_needed(s.must_guidebook, build_guidebook(root, cfg, s.shared_root, s.system_root), args.force))

    for line in outputs:
        print(line)
    print(f"applied: {root}")
    return 0


def paths_command(args: argparse.Namespace) -> int:
    root = repo_root(args.root)
    cfg = load_config(root)
    s = surfaces(root, cfg)
    lines = [
        f"config: {relpath(root, s.config_file)}",
        f"shared_root: {relpath(root, s.shared_root)}",
        f"system_root: {relpath(root, s.system_root)}",
        f"generated_root: {relpath(root, s.generated_root)}",
        f"researcher_root: {cfg.researcher_root}",
        f"selector_root: {cfg.selector_root}",
        f"evolver_root: {cfg.evolver_root}",
    ]
    print("\n".join(lines))
    return 0


def index_command(args: argparse.Namespace) -> int:
    root = repo_root(args.root)
    cfg = load_config(root)
    s = surfaces(root, cfg)
    s.generated_root.mkdir(parents=True, exist_ok=True)
    s.must_guidebook.write_text(build_guidebook(root, cfg, s.shared_root, s.system_root), encoding="utf-8")
    map_path = s.generated_root / "guidebook-map.md"
    map_path.write_text(build_detailed_map(root, s.shared_root), encoding="utf-8")
    print(f"indexed: {relpath(root, s.must_guidebook)}")
    print(f"indexed: {relpath(root, map_path)}")
    return 0


def recall_search_command(args: argparse.Namespace) -> int:
    root = repo_root(args.root)
    cfg = load_config(root)
    s = surfaces(root, cfg)
    cwd = safe_any_repo_path(root, args.cwd)
    query = args.query
    count = 0

    for agents in find_applicable_agents(root, cwd):
        lines = agents.read_text(encoding="utf-8", errors="replace").splitlines()
        for idx, line in enumerate(lines, start=1):
            if query in line:
                start = max(1, idx - 2)
                end = min(len(lines), idx + 2)
                print(f"{relpath(root, agents)}:{start}-{end}")
                if args.snippets:
                    print(line)
                    print("---")
                count += 1
                if count >= args.max_results:
                    return 0

    for path in iter_markdown(root, s.shared_root):
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        for idx, line in enumerate(lines, start=1):
            if query in line:
                start = max(1, idx - 2)
                end = min(len(lines), idx + 2)
                print(f"{relpath(root, path)}:{start}-{end}")
                if args.snippets:
                    print(line)
                    print("---")
                count += 1
                if count >= args.max_results:
                    return 0
    return 0


def recall_get_command(args: argparse.Namespace) -> int:
    root = repo_root(args.root)
    cfg = load_config(root)
    s = surfaces(root, cfg)
    rel = normalize_rel(args.path)
    if rel == "AGENTS.md" or rel.endswith("/AGENTS.md"):
        path = safe_any_repo_path(root, rel)
    else:
        shared_rel = relpath(root, s.shared_root)
        path = safe_repo_path(root, rel, (shared_rel,))
    if not path.is_file():
        raise SystemExit(f"error: file not found: {args.path}")
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    start = max(1, args.from_line)
    end = min(len(lines), start + args.lines - 1)
    for line in lines[start - 1 : end]:
        print(line)
    return 0


def ingest_command(args: argparse.Namespace) -> int:
    root = repo_root(args.root)
    cfg = load_config(root)
    s = surfaces(root, cfg)
    source = safe_any_repo_path(root, args.source)
    if not source.is_file():
        raise SystemExit(f"error: source file not found: {args.source}")
    if source.suffix != ".md":
        raise SystemExit("error: source must be markdown for shared ingestion")
    dest = safe_repo_path(root, f"{relpath(root, s.shared_root)}/{normalize_rel(args.dest)}", (relpath(root, s.shared_root),))
    if dest.is_dir():
        raise SystemExit(f"error: destination is a directory: {args.dest}")
    if dest.exists() and not args.force:
        raise SystemExit(f"error: destination already exists: {relpath(root, dest)}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(sanitize_source_content(root, source.read_text(encoding="utf-8")), encoding="utf-8")
    print(f"ingested: {relpath(root, source)} -> {relpath(root, dest)}")
    return 0


def inspect_stack_command(args: argparse.Namespace) -> int:
    root = repo_root(args.root)
    cfg = load_config(root)
    s = surfaces(root, cfg)
    cwd = safe_any_repo_path(root, args.cwd)
    cwd = cwd if cwd.is_dir() else cwd.parent
    lines = [
        "# Living Knowledge Stack",
        "",
        f"- shared_root: `{relpath(root, s.shared_root)}`",
        f"- system_root: `{relpath(root, s.system_root)}`",
        f"- generated_root: `{relpath(root, s.generated_root)}`",
        "",
        "## Boot Layer",
    ]
    for path in find_applicable_agents(root, cwd):
        lines.append(f"- `{relpath(root, path)}`")
    if len(lines) == 6:
        lines.append("- none")
    lines.extend(
        [
            "",
            "## System Pages",
            f"- `{relpath(root, s.must_guidebook)}`",
            f"- `{relpath(root, s.must_authority)}`",
            f"- `{relpath(root, s.must_recall)}`",
        ]
    )
    output = "\n".join(lines) + "\n"
    if args.output:
        target = safe_repo_path(root, args.output, (relpath(root, s.generated_root),))
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(output, encoding="utf-8")
        print(f"stack: {relpath(root, target)}")
    else:
        sys.stdout.write(output)
    return 0


def doctor_command(args: argparse.Namespace) -> int:
    root = repo_root(args.root)
    cfg = load_config(root)
    s = surfaces(root, cfg)
    errors: list[str] = []
    warnings: list[str] = []

    if not s.config_file.is_file():
        errors.append("missing .bagakit/knowledge_conf.toml")
    if not s.shared_root.is_dir():
        errors.append(f"missing shared root: {relpath(root, s.shared_root)}")
    if not s.must_guidebook.is_file():
        errors.append(f"missing system page: {relpath(root, s.must_guidebook)}")
    if not s.must_authority.is_file():
        errors.append(f"missing system page: {relpath(root, s.must_authority)}")
    if not s.must_recall.is_file():
        errors.append(f"missing system page: {relpath(root, s.must_recall)}")
    if not (s.generated_root / ".gitignore").is_file():
        errors.append(f"missing generated-root gitignore: {relpath(root, s.generated_root / '.gitignore')}")

    exclude = root / ".git" / "info" / "exclude"
    if exclude.is_file():
        exclude_text = exclude.read_text(encoding="utf-8", errors="replace")
        if "# BAGAKIT:LIVING-KNOWLEDGE:START" not in exclude_text:
            warnings.append("missing .git/info/exclude living-knowledge block")

    visible_generated = git_visible_generated_state(root, s.generated_root)
    if visible_generated:
        errors.append("living-knowledge generated outputs are visible in git status")

    tracked_generated = git_tracked_generated_state(root, s.generated_root)
    if tracked_generated:
        errors.append("living-knowledge generated outputs are tracked by git")

    for path in iter_markdown(root, s.shared_root):
        if not any(line.startswith("# ") for line in path.read_text(encoding="utf-8", errors="replace").splitlines()):
            warnings.append(f"markdown page missing H1: {relpath(root, path)}")

    nested_agents = [path for path in sorted(root.rglob("AGENTS.md")) if path != s.agents]
    for path in nested_agents:
        assert_repo_containment(root, path)
        if not path.is_file():
            continue
        warnings.append(f"path-local AGENTS.md requires precedence review: {relpath(root, path)}")
        error = nested_agents_error(path, root, path.read_text(encoding="utf-8", errors="replace"))
        if error is not None:
            errors.append(error)

    for warning in warnings:
        eprint("warn:", warning)
    for error in errors:
        eprint("error:", error)
    if errors:
        eprint(f"doctor failed: {len(errors)} error(s), {len(warnings)} warning(s)")
        return 1
    print(f"doctor passed: {len(warnings)} warning(s)")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="bagakit-living-knowledge")
    sub = parser.add_subparsers(dest="command", required=True)

    apply_p = sub.add_parser("apply")
    apply_p.add_argument("--root", default=".")
    apply_p.add_argument("--force", action="store_true")
    apply_p.set_defaults(func=apply_command)

    paths_p = sub.add_parser("paths")
    paths_p.add_argument("--root", default=".")
    paths_p.set_defaults(func=paths_command)

    index_p = sub.add_parser("index")
    index_p.add_argument("--root", default=".")
    index_p.set_defaults(func=index_command)

    recall_p = sub.add_parser("recall")
    recall_sub = recall_p.add_subparsers(dest="recall_command", required=True)
    recall_search = recall_sub.add_parser("search")
    recall_search.add_argument("--root", default=".")
    recall_search.add_argument("--cwd", default=".")
    recall_search.add_argument("query")
    recall_search.add_argument("--max-results", type=int, default=8)
    recall_search.add_argument("--snippets", action="store_true")
    recall_search.set_defaults(func=recall_search_command)
    recall_get = recall_sub.add_parser("get")
    recall_get.add_argument("--root", default=".")
    recall_get.add_argument("path")
    recall_get.add_argument("--from", dest="from_line", type=int, default=1)
    recall_get.add_argument("--lines", type=int, default=20)
    recall_get.set_defaults(func=recall_get_command)

    ingest_p = sub.add_parser("ingest")
    ingest_p.add_argument("--root", default=".")
    ingest_p.add_argument("--source", required=True)
    ingest_p.add_argument("--dest", required=True)
    ingest_p.add_argument("--force", action="store_true")
    ingest_p.set_defaults(func=ingest_command)

    inspect_p = sub.add_parser("inspect-stack")
    inspect_p.add_argument("--root", default=".")
    inspect_p.add_argument("--cwd", default=".")
    inspect_p.add_argument("--output")
    inspect_p.set_defaults(func=inspect_stack_command)

    doctor_p = sub.add_parser("doctor")
    doctor_p.add_argument("--root", default=".")
    doctor_p.set_defaults(func=doctor_command)

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
