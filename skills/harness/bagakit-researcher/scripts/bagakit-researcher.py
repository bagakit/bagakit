#!/usr/bin/env python3
"""Local-first research workspace helper for Bagakit."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path, PurePosixPath


DEFAULT_RESEARCHER_ROOT = ".bagakit/researcher"
KNOWLEDGE_CONFIG_PATH = "docs/.bagakit-knowledge.toml"
OPTIONAL_DIRS = ("surveys", "passes", "tracks", "insights", "handoffs")

MANAGED_SECTION_ORDER = (
    "SOURCE-CARDS",
    "SUMMARIES",
    "SURVEYS",
    "PASSES",
    "TRACKS",
    "CLAIMS",
    "INSIGHTS",
    "LEADS",
)

HANDOFF_FILES = {
    "selector": "selector-evidence.md",
    "evolver": "evolver-context.md",
    "living-knowledge": "living-knowledge-intake.md",
}

WIKI_DIRS = ("concepts", "questions", "claims")


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


def repo_rel(root: Path, path: Path) -> str:
    return path.relative_to(root).as_posix()


def posix_join(*parts: object) -> str:
    cleaned = [str(part).strip("/") for part in parts if str(part)]
    if not cleaned:
        return ""
    current = PurePosixPath(cleaned[0])
    for part in cleaned[1:]:
        current = current / part
    return current.as_posix()


def validate_researcher_root(raw: str) -> str:
    value = raw.strip()
    if not value:
        raise SystemExit("error: researcher_root must not be empty")
    candidate = Path(value)
    if candidate.is_absolute():
        raise SystemExit("error: researcher_root must stay repo-relative under .bagakit/")
    normalized = candidate.as_posix()
    if normalized == ".bagakit":
        raise SystemExit("error: researcher_root must point to a child path under .bagakit/")
    if not normalized.startswith(".bagakit/"):
        raise SystemExit("error: researcher_root must stay under .bagakit/")
    if ".." in candidate.parts:
        raise SystemExit("error: researcher_root must not escape .bagakit/")
    return normalized


def load_researcher_root(root: Path) -> str:
    conf = root / KNOWLEDGE_CONFIG_PATH
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
        value = validate_researcher_root(raw_value.strip().strip('"').strip("'"))
        if current == "paths":
            return value
        if current == "":
            top_level_value = value
    return top_level_value or DEFAULT_RESEARCHER_ROOT


def workspace_dir(root: Path, topic_class: str, topic: str) -> Path:
    return root / load_researcher_root(root) / "topics" / normalize_topic_class(topic_class) / slugify(topic)


def researcher_root_dir(root: Path) -> Path:
    return root / load_researcher_root(root)


def require_workspace(root: Path, topic_class: str, topic: str) -> Path:
    workspace = workspace_dir(root, topic_class, topic)
    if not workspace.exists():
        raise SystemExit(f"error: topic workspace missing: {workspace}")
    return workspace


def ensure_base_workspace(workspace: Path) -> None:
    (workspace / "originals").mkdir(parents=True, exist_ok=True)
    (workspace / "summaries").mkdir(parents=True, exist_ok=True)


def ensure_extended_dirs(workspace: Path) -> None:
    for dirname in OPTIONAL_DIRS:
        (workspace / dirname).mkdir(parents=True, exist_ok=True)


def clean_items(items: list[str] | None) -> list[str]:
    if not items:
        return []
    return [item.strip() for item in items if item and item.strip()]


def title_of(path: Path) -> str:
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return path.name


def field_value(text: str, field: str) -> str | None:
    pattern = re.compile(rf"^- {re.escape(field)}:\s*(.+?)\s*$", re.MULTILINE)
    match = pattern.search(text)
    if not match:
        return None
    value = match.group(1).strip()
    if value.startswith("`") and value.endswith("`"):
        value = value[1:-1]
    return value.strip()


def missing_value(value: str | None) -> bool:
    if value is None:
        return True
    normalized = value.strip().strip("`").strip().lower()
    return normalized in {"", "unknown", "none", "none recorded"} or normalized.startswith("<")


def normalize_markdown_value(raw: str) -> str:
    value = raw.strip()
    value = re.sub(r"^[-*]\s+", "", value)
    value = re.sub(r"^\d+[.)]\s+", "", value)
    value = value.strip().strip("`").strip()
    return value


def placeholder_line(raw: str) -> bool:
    value = normalize_markdown_value(raw).lower()
    if not value:
        return True
    return value in {"unknown", "none", "none recorded"} or value.startswith("<")


def markdown_section(text: str, heading: str, level: int = 2) -> str:
    hashes = "#" * level
    pattern = re.compile(
        rf"^{re.escape(hashes)} {re.escape(heading)}\s*$\n(.*?)(?=^#{{1,{level}}}\s+|\Z)",
        re.MULTILINE | re.DOTALL,
    )
    match = pattern.search(text)
    if not match:
        return ""
    return match.group(1).strip()


def section_has_content(text: str, heading: str, level: int = 2) -> bool:
    body = markdown_section(text, heading, level=level)
    if not body:
        return False
    meaningful = [
        line.strip()
        for line in body.splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]
    if not meaningful:
        return False
    return any(not placeholder_line(line) for line in meaningful)


def bullet_lines(items: list[str], placeholder: str) -> list[str]:
    cleaned = clean_items(items)
    if not cleaned:
        return [f"- {placeholder}"]
    return [f"- {item}" for item in cleaned]


def write_file(path: Path, text: str, force: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and not force:
        raise SystemExit(f"error: already exists: {path}")
    path.write_text(text, encoding="utf-8")


def append_entry(path: Path, title: str, entry_id: str, text: str, force: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text(f"# {title}\n\n", encoding="utf-8")
    current = path.read_text(encoding="utf-8")
    pattern = re.compile(
        rf"^## {re.escape(entry_id)}\s*$\n.*?(?=^## |\Z)",
        re.MULTILINE | re.DOTALL,
    )
    if pattern.search(current):
        if not force:
            raise SystemExit(f"error: entry already exists in {path}: {entry_id}")
        path.write_text(pattern.sub(text.rstrip() + "\n", current).rstrip() + "\n", encoding="utf-8")
        return
    if not current.endswith("\n"):
        current += "\n"
    path.write_text(current.rstrip() + "\n\n" + text.rstrip() + "\n", encoding="utf-8")


def topic_index_text(root: Path, workspace: Path, title: str) -> str:
    originals = sorted((workspace / "originals").glob("*.md")) if (workspace / "originals").is_dir() else []
    summaries = sorted((workspace / "summaries").glob("*.md")) if (workspace / "summaries").is_dir() else []

    lines = [
        f"# {title}",
        "",
        "## Goal",
        "",
        f"Research topic for `{repo_rel(root, workspace)}`.",
        "",
        "## Local Topic Layout",
        "",
        "```text",
        f"{repo_rel(root, workspace)}/",
        "├── originals/",
        "├── summaries/",
        "├── surveys/        # optional pre-retrieval packets",
        "├── passes/         # optional bounded pass plans",
        "├── tracks/         # optional parallel work contracts",
        "└── index.md",
        "```",
        "",
        "## Current Read Order",
        "",
        "1. `charter.md` and `surveys/` when present",
        "2. `passes/` and `tracks/` when present",
        "3. `summaries/`",
        "4. preserved source cards under `originals/`",
        "5. update this index after every meaningful research pass",
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


def charter_text(args: argparse.Namespace) -> str:
    lines = [
        "# Topic Charter",
        "",
        "## Core Question",
        "",
        args.charter_question or args.question or "<core research question>",
        "",
        "## Decision Or Downstream Use",
        "",
        args.decision_use or "<decision or downstream use>",
        "",
        "## Output Shape",
        "",
        args.output_shape or "<target output shape>",
        "",
        "## In Scope",
        *bullet_lines(args.in_scope, "<in-scope boundary>"),
        "",
        "## Out Of Scope",
        *bullet_lines(args.out_of_scope, "<out-of-scope boundary>"),
        "",
        "## Source Priority",
        *bullet_lines(args.source_priority, "<source priority>"),
        "",
        "## Evidence Threshold",
        "",
        args.evidence_threshold or "<minimum evidence threshold>",
        "",
        "## Stop Conditions",
        *bullet_lines(args.stop_condition, "<stop condition>"),
        "",
        "## Drift Sentinels",
        *bullet_lines(args.drift_sentinel, "<drift sentinel>"),
        "",
    ]
    return "\n".join(lines)


def pass_text(args: argparse.Namespace, planned_tracks: list[tuple[str, str, str | None]]) -> str:
    lines = [
        f"# {args.title or args.pass_id}",
        "",
        "## Pass Contract",
        "",
        f"- pass id: `{args.pass_id}`",
        "- parent charter: `charter.md`",
        "",
        "## Pass Question",
        "",
        args.question,
        "",
        "## Source Classes To Seek",
        *bullet_lines(args.source_class, "<source class>"),
        "",
        "## Planned Tracks",
    ]
    if planned_tracks:
        for track_id, question, source_range in planned_tracks:
            suffix = f" ({source_range})" if source_range else ""
            lines.append(f"- `tracks/{slugify(track_id)}.md` — {question}{suffix}")
    else:
        lines.append("- none yet")
    lines.extend(
        [
            "",
            "## Budget Or Stop Rule",
            "",
            args.budget or "<budget or stop rule>",
            "",
            "## Merge Expectations",
            *bullet_lines(args.merge_expectation, "<merge expectation>"),
            "",
            "## Synthesis Target",
            "",
            args.synthesis_target or "<synthesis target>",
            "",
        ]
    )
    return "\n".join(lines)


def survey_text(args: argparse.Namespace) -> str:
    lines = [
        f"# {args.title or args.survey_id}",
        "",
        "## Survey Contract",
        "",
        f"- survey id: `{args.survey_id}`",
        f"- parent charter: `{args.charter_ref}`",
        "",
        "## Survey Question",
        "",
        args.question,
        "",
        "## Why Survey Is Needed",
        "",
        args.why_needed or "<why this survey is needed before broad search>",
        "",
        "## Problem Decomposition",
        *bullet_lines(args.problem_dimension, "<problem dimension, decision branch, or sub-question>"),
        "",
        "## Consensus Quadrant Map",
        "",
        "### known_known",
        *bullet_lines(args.known_known, "<confirmed or directly available context>"),
        "",
        "### known_unknown",
        *bullet_lines(args.known_unknown, "<explicit gap, risk, or missing decision>"),
        "",
        "### unknown_known",
        *bullet_lines(args.unknown_known, "<agent inference that still needs confirmation>"),
        "",
        "### unknown_unknown",
        *bullet_lines(args.unknown_unknown, "<possible blind spot or unexplored dimension>"),
        "",
        "## Source Landscape",
        *bullet_lines(args.source_landscape, "<where excellent sources, indexes, rankings, benchmark lists, or expert references likely live>"),
        "",
        "## Ranking And Seed List Strategy",
        *bullet_lines(args.ranking_lead, "<ranking, curated list, benchmark set, or seed source to inspect>"),
        "",
        "## Source Quality Heuristics",
        *bullet_lines(args.quality_heuristic, "<authority, scope-fit, recency, traceability, or counterevidence heuristic>"),
        "",
        "## Retrieval Plan Sketch",
        *bullet_lines(args.seed_query, "<query sketch, index route, or provider-agnostic retrieval path>"),
        "",
        "## Stop Or Handback Conditions",
        *bullet_lines(args.stop_condition, "<condition for stopping survey or handing back to pass planning>"),
        "",
        "## Drift Check",
        "",
        args.drift_check or "<how to detect that the survey is no longer answering the question>",
        "",
        "## Handoff Target",
        "",
        args.handoff_target or "<pass, track, source-card, or downstream artifact this survey should feed>",
        "",
    ]
    return "\n".join(lines)


def track_text(
    *,
    track_id: str,
    pass_id: str,
    charter_ref: str,
    question: str,
    required_source_type: list[str],
    preferred_source: list[str],
    disallowed_source: list[str],
    source_id_range: str | None,
    owned_output: list[str],
    minimum_evidence: str | None,
    lead_policy: str | None,
    drift_check: str | None,
    merge_note: list[str],
) -> str:
    lines = [
        f"# {track_id}",
        "",
        "## Track Contract",
        "",
        f"- track id: `{track_id}`",
        f"- parent pass: `{pass_id}`",
        f"- parent charter: `{charter_ref}`",
        "",
        "## Track Question",
        "",
        question,
        "",
        "## Required Source Types",
        *bullet_lines(required_source_type, "<required source type>"),
        "",
        "## Preferred Sources",
        *bullet_lines(preferred_source, "<preferred source>"),
        "",
        "## Disallowed Sources",
        *bullet_lines(disallowed_source, "<disallowed source>"),
        "",
        "## Source Id Range",
        "",
        source_id_range or "<source id range>",
        "",
        "## Owned Output Files",
        *bullet_lines(owned_output, "<owned output file>"),
        "",
        "## Minimum Evidence",
        "",
        minimum_evidence or "<minimum evidence>",
        "",
        "## Lead Policy",
        "",
        lead_policy or "<lead policy>",
        "",
        "## Drift Check",
        "",
        drift_check or "<drift check>",
        "",
        "## Merge Notes",
        *bullet_lines(merge_note, "<merge note>"),
        "",
    ]
    return "\n".join(lines)


def claim_entry_text(args: argparse.Namespace) -> str:
    lines = [
        f"## {args.claim_id}",
        "",
        f"- kind: `{args.kind}`",
        f"- status: `{args.status}`",
        f"- confidence: `{args.confidence}`",
        "",
        "### Statement",
        "",
        args.statement,
        "",
        "### Evidence Refs",
        *bullet_lines(args.evidence_ref, "none recorded"),
        "",
        "### Counterevidence Refs",
        *bullet_lines(args.counterevidence_ref, "none recorded"),
        "",
        "### Bagakit Implication",
        "",
        args.implication or "<Bagakit implication>",
        "",
    ]
    return "\n".join(lines)


def insight_text(args: argparse.Namespace) -> str:
    lines = [
        f"# {args.title or args.insight_id}",
        "",
        "## Insight",
        "",
        args.insight,
        "",
        "## Source Claims",
        *bullet_lines(args.source_claim, "none recorded"),
        "",
        "## Counterclaims",
        *bullet_lines(args.counterclaim, "none recorded"),
        "",
        "## Confidence",
        "",
        args.confidence,
        "",
        "## Why It Matters",
        "",
        args.why_matters or "<why this matters>",
        "",
        "## Borrow",
        *bullet_lines(args.borrow, "<what to borrow>"),
        "",
        "## Avoid",
        *bullet_lines(args.avoid, "<what to avoid>"),
        "",
        "## Bagakit Implication",
        *bullet_lines(args.implication, "<Bagakit implication>"),
        "",
        "## Next Action",
        "",
        args.next_action or "<next action>",
        "",
    ]
    return "\n".join(lines)


def lead_entry_text(args: argparse.Namespace) -> str:
    lines = [
        f"## {args.lead_id}",
        "",
        f"- status: `{args.status}`",
        f"- originating artifact: `{args.originating_artifact}`",
        "",
        "### Hypothesis",
        "",
        args.hypothesis,
        "",
        "### Expected Value",
        "",
        args.expected_value or "<expected value>",
        "",
        "### Suggested Query Or Source",
        "",
        args.suggested_query or "<suggested query or source>",
        "",
        "### Stop Rule",
        "",
        args.stop_rule or "<stop rule>",
        "",
        "### Outcome",
        "",
        args.outcome or "none recorded",
        "",
    ]
    return "\n".join(lines)


def synthesis_text(args: argparse.Namespace) -> str:
    lines = [
        f"# {args.title or args.synthesis_id}",
        "",
        "## What This Synthesizes",
        "",
        args.what or "<what this synthesis covers>",
        "",
        "## Claim Refs",
        *bullet_lines(args.claim_ref, "none recorded"),
        "",
        "## Insight Refs",
        *bullet_lines(args.insight_ref, "none recorded"),
        "",
        "## Findings",
        *bullet_lines(args.finding, "<finding>"),
        "",
        "## Open Risks",
        *bullet_lines(args.risk, "<open risk>"),
        "",
        "## Next Action",
        "",
        args.next_action or "<next action>",
        "",
    ]
    return "\n".join(lines)


def parse_track_spec(raw: str) -> tuple[str, str, str | None]:
    if ":" in raw:
        parts = raw.split(":")
        track_id = slugify(parts[0])
        question = parts[1].strip() if len(parts) > 1 else ""
        source_range = ":".join(parts[2:]).strip() if len(parts) > 2 else None
        return track_id, question or "<track question>", source_range or None
    if "=" in raw:
        track_id, question = raw.split("=", 1)
        return slugify(track_id), question.strip() or "<track question>", None
    return slugify(raw), raw.strip(), None


def managed_markers(section: str) -> tuple[str, str]:
    return (
        f"<!-- BAGAKIT:RESEARCHER:{section}:START -->",
        f"<!-- BAGAKIT:RESEARCHER:{section}:END -->",
    )


def managed_block(section: str, body: str) -> str:
    start, end = managed_markers(section)
    return f"{start}\n{body.rstrip()}\n{end}"


def update_managed_section(text: str, section: str, body: str) -> str:
    start, end = managed_markers(section)
    has_start = start in text
    has_end = end in text
    block = managed_block(section, body)
    if has_start and has_end:
        pattern = re.compile(
            rf"{re.escape(start)}\n.*?\n{re.escape(end)}",
            re.MULTILINE | re.DOTALL,
        )
        return pattern.sub(block, text)
    if has_start != has_end:
        raise SystemExit(f"error: partial managed section markers for {section}")
    separator = "\n\n" if text.rstrip() else ""
    return text.rstrip() + separator + block + "\n"


def markdown_file_list(workspace: Path, dirname: str) -> list[Path]:
    directory = workspace / dirname
    if not directory.is_dir():
        return []
    return sorted(directory.glob("*.md"))


def render_file_section(title: str, dirname: str, files: list[Path]) -> str:
    lines = [f"## {title}"]
    if files:
        lines.extend([f"- `{dirname}/{path.name}` — {title_of(path)}" for path in files])
    else:
        lines.append("- none yet")
    return "\n".join(lines)


def second_level_ids(path: Path) -> list[str]:
    if not path.is_file():
        return []
    text = path.read_text(encoding="utf-8", errors="replace")
    return [match.group(1).strip() for match in re.finditer(r"^## (.+?)\s*$", text, re.MULTILINE)]


def render_claims_section(workspace: Path) -> str:
    lines = ["## Claims"]
    ids = second_level_ids(workspace / "claims.md")
    if ids:
        lines.extend([f"- `claims.md#{slugify(claim_id)}` — {claim_id}" for claim_id in ids])
    else:
        lines.append("- none yet")
    return "\n".join(lines)


def render_leads_section(workspace: Path) -> str:
    lines = ["## Leads"]
    leads = workspace / "leads.md"
    if leads.is_file():
        text = leads.read_text(encoding="utf-8", errors="replace")
        entries = []
        for match in re.finditer(r"^## (.+?)\s*$", text, re.MULTILINE):
            lead_id = match.group(1).strip()
            next_heading = re.search(r"^## .+?$", text[match.end() :], re.MULTILINE)
            section_text = text[match.end() : match.end() + next_heading.start()] if next_heading else text[match.end() :]
            status = field_value(section_text, "status") or "unknown"
            entries.append(f"- `leads.md#{slugify(lead_id)}` — {lead_id} ({status})")
        if entries:
            lines.extend(entries)
        else:
            lines.append("- none yet")
    else:
        lines.append("- none yet")
    return "\n".join(lines)


def managed_section_body(root: Path, workspace: Path, section: str) -> str:
    del root
    if section == "SOURCE-CARDS":
        return render_file_section("Source Cards", "originals", markdown_file_list(workspace, "originals"))
    if section == "SUMMARIES":
        return render_file_section("Summaries", "summaries", markdown_file_list(workspace, "summaries"))
    if section == "SURVEYS":
        return render_file_section("Surveys", "surveys", markdown_file_list(workspace, "surveys"))
    if section == "PASSES":
        return render_file_section("Passes", "passes", markdown_file_list(workspace, "passes"))
    if section == "TRACKS":
        return render_file_section("Tracks", "tracks", markdown_file_list(workspace, "tracks"))
    if section == "CLAIMS":
        return render_claims_section(workspace)
    if section == "INSIGHTS":
        return render_file_section("Insights", "insights", markdown_file_list(workspace, "insights"))
    if section == "LEADS":
        return render_leads_section(workspace)
    raise SystemExit(f"error: unknown managed section: {section}")


def update_all_managed_sections(root: Path, workspace: Path, text: str) -> str:
    for section in MANAGED_SECTION_ORDER:
        text = update_managed_section(text, section, managed_section_body(root, workspace, section))
    return text.rstrip() + "\n"


def init_topic(args: argparse.Namespace) -> int:
    root = resolve_root(args.root)
    workspace = workspace_dir(root, args.topic_class, args.topic)
    ensure_base_workspace(workspace)
    if args.extended:
        ensure_extended_dirs(workspace)
        ensure_topic_file(workspace / "claims.md", "# Claims\n\n")
        ensure_topic_file(workspace / "leads.md", "# Leads\n\n")
    index = workspace / "index.md"
    if not index.exists():
        index.write_text(topic_index_text(root, workspace, args.title or args.topic), encoding="utf-8")
    print(f"ok: initialized {workspace}")
    return 0


def ensure_topic_file(path: Path, text: str) -> None:
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")


def add_source_card(args: argparse.Namespace) -> int:
    root = resolve_root(args.root)
    workspace = require_workspace(root, args.topic_class, args.topic)
    ensure_base_workspace(workspace)
    target = workspace / "originals" / f"{slugify(args.source_id)}.md"
    metadata = [
        f"- id: `{args.source_id}`",
        f"- url: `{args.url}`",
        f"- published: `{args.published or 'unknown'}`",
        f"- authority: `{args.authority}`",
    ]
    if args.pass_id:
        metadata.append(f"- pass: `{args.pass_id}`")
    if args.track_id:
        metadata.append(f"- track: `{args.track_id}`")
    if args.source_role:
        metadata.append(f"- source role: `{args.source_role}`")
    if args.scope_fit:
        metadata.append(f"- scope fit: `{args.scope_fit}`")
    lines = [
        f"# {args.title}",
        "",
        "## Source",
        "",
        *metadata,
        "",
        "## Why It Matters",
        "",
        args.why or "<why this source matters>",
    ]
    if args.limitations:
        lines.extend(["", "## Limitations", *bullet_lines(args.limitations, "<limitation>")])
    lines.append("")
    write_file(target, "\n".join(lines), force=args.force)
    print(f"ok: wrote {repo_rel(root, target)}")
    return 0


def add_summary(args: argparse.Namespace) -> int:
    root = resolve_root(args.root)
    workspace = require_workspace(root, args.topic_class, args.topic)
    ensure_base_workspace(workspace)
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
    print(f"ok: wrote {repo_rel(root, target)}")
    return 0


def refresh_index(args: argparse.Namespace) -> int:
    root = resolve_root(args.root)
    workspace = require_workspace(root, args.topic_class, args.topic)
    index = workspace / "index.md"
    title = args.title or workspace.name.replace("-", " ").title()
    if args.force_rewrite or not index.exists():
        index.write_text(topic_index_text(root, workspace, title), encoding="utf-8")
    text = index.read_text(encoding="utf-8")
    if args.title and not args.force_rewrite:
        if re.search(r"^# .+$", text, re.MULTILINE):
            text = re.sub(r"^# .+$", f"# {args.title}", text, count=1, flags=re.MULTILINE)
        else:
            text = f"# {args.title}\n\n{text}"
    index.write_text(update_all_managed_sections(root, workspace, text), encoding="utf-8")
    print(f"ok: refreshed {repo_rel(root, index)}")
    return 0


def plan_pass(args: argparse.Namespace) -> int:
    root = resolve_root(args.root)
    workspace = require_workspace(root, args.topic_class, args.topic)
    planned_tracks = [parse_track_spec(raw) for raw in args.track]
    target_paths = [workspace / "passes" / f"{slugify(args.pass_id)}.md"]
    target_paths.extend(workspace / "tracks" / f"{slugify(track_id)}.md" for track_id, _question, _source_range in planned_tracks)
    seen_targets: set[Path] = set()
    for target_path in target_paths:
        if target_path in seen_targets:
            raise SystemExit(f"error: duplicate plan-pass target: {target_path}")
        seen_targets.add(target_path)
        if target_path.exists() and not args.force:
            raise SystemExit(f"error: already exists: {target_path}")

    ensure_base_workspace(workspace)
    ensure_extended_dirs(workspace)
    ensure_topic_file(workspace / "claims.md", "# Claims\n\n")
    ensure_topic_file(workspace / "leads.md", "# Leads\n\n")

    charter = workspace / "charter.md"
    if not charter.exists() or args.force_charter:
        charter.write_text(charter_text(args), encoding="utf-8")

    pass_path = workspace / "passes" / f"{slugify(args.pass_id)}.md"
    write_file(pass_path, pass_text(args, planned_tracks), force=args.force)

    for track_id, question, track_source_range in planned_tracks:
        track_path = workspace / "tracks" / f"{slugify(track_id)}.md"
        write_file(
            track_path,
            track_text(
                track_id=track_id,
                pass_id=args.pass_id,
                charter_ref="charter.md",
                question=question,
                required_source_type=args.required_source_type,
                preferred_source=[],
                disallowed_source=[],
                source_id_range=track_source_range or args.source_id_range,
                owned_output=[f"tracks/{slugify(track_id)}.md"],
                minimum_evidence=args.evidence_threshold,
                lead_policy=args.lead_policy,
                drift_check=args.drift_check,
                merge_note=args.merge_expectation,
            ),
            force=args.force,
        )

    print(f"ok: wrote {repo_rel(root, pass_path)}")
    return 0


def plan_survey(args: argparse.Namespace) -> int:
    root = resolve_root(args.root)
    workspace = require_workspace(root, args.topic_class, args.topic)
    target = workspace / "surveys" / f"{slugify(args.survey_id)}.md"
    if target.exists() and not args.force:
        raise SystemExit(f"error: already exists: {target}")

    ensure_base_workspace(workspace)
    (workspace / "surveys").mkdir(parents=True, exist_ok=True)

    charter = workspace / "charter.md"
    if (not charter.exists() or args.force_charter) and args.charter_question:
        charter.write_text(charter_text(args), encoding="utf-8")
    elif args.force_charter:
        raise SystemExit("error: --force-charter with plan-survey requires --charter-question")
    elif not charter.exists():
        print("warning: charter.md missing; plan-survey did not create one without --charter-question", file=sys.stderr)

    write_file(target, survey_text(args), force=args.force)
    print(f"ok: wrote {repo_rel(root, target)}")
    return 0


def add_track(args: argparse.Namespace) -> int:
    root = resolve_root(args.root)
    workspace = require_workspace(root, args.topic_class, args.topic)
    ensure_extended_dirs(workspace)
    pass_id = args.pass_id or "unassigned"
    if not args.pass_id:
        print("warning: --pass-id not provided; using `unassigned`", file=sys.stderr)
    pass_path = workspace / "passes" / f"{slugify(pass_id)}.md"
    if args.pass_id and not pass_path.exists():
        print(f"warning: parent pass missing: {repo_rel(root, pass_path)}", file=sys.stderr)
    target = workspace / "tracks" / f"{slugify(args.track_id)}.md"
    text = track_text(
        track_id=args.track_id,
        pass_id=pass_id,
        charter_ref=args.charter_ref,
        question=args.question,
        required_source_type=args.required_source_type,
        preferred_source=args.preferred_source,
        disallowed_source=args.disallowed_source,
        source_id_range=args.source_id_range,
        owned_output=args.owned_output,
        minimum_evidence=args.minimum_evidence,
        lead_policy=args.lead_policy,
        drift_check=args.drift_check,
        merge_note=args.merge_note,
    )
    write_file(target, text, force=args.force)
    print(f"ok: wrote {repo_rel(root, target)}")
    return 0


def list_tracks(args: argparse.Namespace) -> int:
    root = resolve_root(args.root)
    workspace = require_workspace(root, args.topic_class, args.topic)
    tracks = markdown_file_list(workspace, "tracks")
    if not tracks:
        print("no tracks found")
        return 0
    for track in tracks:
        text = track.read_text(encoding="utf-8", errors="replace")
        parent_pass = field_value(text, "parent pass") or "unknown"
        print(f"{track.stem}\t{parent_pass}\t{repo_rel(root, track)}")
    return 0


def add_claim(args: argparse.Namespace) -> int:
    root = resolve_root(args.root)
    workspace = require_workspace(root, args.topic_class, args.topic)
    if not args.statement:
        raise SystemExit("error: add-claim requires --statement")
    target = workspace / "claims.md"
    append_entry(target, "Claims", args.claim_id, claim_entry_text(args), force=args.force)
    print(f"ok: updated {repo_rel(root, target)}")
    return 0


def add_insight(args: argparse.Namespace) -> int:
    root = resolve_root(args.root)
    workspace = require_workspace(root, args.topic_class, args.topic)
    ensure_extended_dirs(workspace)
    target = workspace / "insights" / f"{slugify(args.insight_id)}.md"
    write_file(target, insight_text(args), force=args.force)
    print(f"ok: wrote {repo_rel(root, target)}")
    return 0


def add_lead(args: argparse.Namespace) -> int:
    root = resolve_root(args.root)
    workspace = require_workspace(root, args.topic_class, args.topic)
    if not args.hypothesis:
        raise SystemExit("error: add-lead requires --hypothesis")
    target = workspace / "leads.md"
    append_entry(target, "Leads", args.lead_id, lead_entry_text(args), force=args.force)
    print(f"ok: updated {repo_rel(root, target)}")
    return 0


def replace_heading_section(text: str, heading: str, body: str, level: int = 3) -> str:
    hashes = "#" * level
    pattern = re.compile(
        rf"(^{re.escape(hashes)} {re.escape(heading)}\s*$\n)(.*?)(?=^{re.escape(hashes)} |\Z)",
        re.MULTILINE | re.DOTALL,
    )
    if pattern.search(text):
        return pattern.sub(lambda match: f"{match.group(1)}\n{body.strip()}\n", text)
    return text.rstrip() + f"\n\n{hashes} {heading}\n\n{body.strip()}\n"


def resolve_lead(args: argparse.Namespace) -> int:
    root = resolve_root(args.root)
    workspace = require_workspace(root, args.topic_class, args.topic)
    target = workspace / "leads.md"
    if not target.is_file():
        raise SystemExit(f"error: leads file missing: {target}")
    text = target.read_text(encoding="utf-8")
    pattern = re.compile(
        rf"(^## {re.escape(args.lead_id)}\s*$\n)(.*?)(?=^## |\Z)",
        re.MULTILINE | re.DOTALL,
    )
    match = pattern.search(text)
    if not match:
        raise SystemExit(f"error: lead not found: {args.lead_id}")
    section = match.group(1) + match.group(2)
    if re.search(r"^- status:\s*.+$", section, re.MULTILINE):
        section = re.sub(r"^- status:\s*.+$", f"- status: `{args.status}`", section, count=1, flags=re.MULTILINE)
    else:
        section = section.replace(match.group(1), match.group(1) + f"\n- status: `{args.status}`\n", 1)
    if args.outcome:
        section = replace_heading_section(section, "Outcome", args.outcome, level=3)
    text = text[: match.start()] + section.rstrip() + "\n\n" + text[match.end() :].lstrip()
    target.write_text(text.rstrip() + "\n", encoding="utf-8")
    print(f"ok: updated {repo_rel(root, target)}")
    return 0


def new_synthesis(args: argparse.Namespace) -> int:
    root = resolve_root(args.root)
    workspace = require_workspace(root, args.topic_class, args.topic)
    ensure_base_workspace(workspace)
    target = workspace / "summaries" / f"{slugify(args.synthesis_id)}.md"
    write_file(target, synthesis_text(args), force=args.force)
    print(f"ok: wrote {repo_rel(root, target)}")
    return 0


def render_handoff_content(kind: str, root: Path, workspace: Path) -> str:
    topic_path = repo_rel(root, workspace)
    purpose = {
        "selector": "Task-local skill selection and execution evidence.",
        "evolver": "Optional repository-evolution context.",
        "living-knowledge": "Reviewed intake candidate for shared knowledge.",
    }[kind]
    lines = [
        f"# {kind.replace('-', ' ').title()} Handoff",
        "",
        "## Purpose",
        "",
        purpose,
        "",
        "## Topic Workspace",
        "",
        f"- topic: `{topic_path}`",
        "- boundary: researcher prepares evidence only; downstream promotion remains explicit",
        "",
    ]
    for section in MANAGED_SECTION_ORDER:
        lines.extend([managed_section_body(root, workspace, section), ""])
    return "\n".join(lines).rstrip() + "\n"


def render_handoff(args: argparse.Namespace) -> int:
    root = resolve_root(args.root)
    workspace = require_workspace(root, args.topic_class, args.topic)
    ensure_extended_dirs(workspace)
    filename = f"{slugify(args.handoff_id)}.md" if args.handoff_id else HANDOFF_FILES[args.kind]
    target = workspace / "handoffs" / filename
    write_file(target, render_handoff_content(args.kind, root, workspace), force=args.force)
    print(f"ok: wrote {repo_rel(root, target)}")
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
            print(f"{topic_class}/{workspace.name}\t{repo_rel(root, index)}")
    if not found:
        print("no research topics found")
    return 0


def validate_workspace(root: Path, workspace: Path) -> list[str]:
    issues: list[str] = []
    rel = repo_rel(root, workspace)
    if not (workspace / "index.md").is_file():
        issues.append(f"missing index.md: {rel}")
    if not (workspace / "originals").is_dir():
        issues.append(f"missing originals/: {rel}")
    if not (workspace / "summaries").is_dir():
        issues.append(f"missing summaries/: {rel}")
    return issues


def source_card_warnings(root: Path, workspace: Path) -> list[str]:
    warnings: list[str] = []
    for card in markdown_file_list(workspace, "originals"):
        text = card.read_text(encoding="utf-8", errors="replace")
        rel = repo_rel(root, card)
        if missing_value(field_value(text, "url")):
            warnings.append(f"{rel}: source card missing url")
        if missing_value(field_value(text, "authority")):
            warnings.append(f"{rel}: source card missing authority")
        if not section_has_content(text, "Why It Matters"):
            warnings.append(f"{rel}: source card missing why-kept text")
    return warnings


def collect_quality_warnings(root: Path, workspace: Path) -> list[str]:
    warnings = source_card_warnings(root, workspace)
    originals = {path.stem for path in markdown_file_list(workspace, "originals")}
    summaries = {path.stem for path in markdown_file_list(workspace, "summaries") if "synthesis" not in path.stem}
    for source_id in sorted(originals - summaries):
        warnings.append(f"{repo_rel(root, workspace)}: source card `{source_id}` has no matching summary")
    for source_id in sorted(summaries - originals):
        warnings.append(f"{repo_rel(root, workspace)}: summary `{source_id}` has no matching source card")

    all_topic_text = "\n".join(
        path.read_text(encoding="utf-8", errors="replace")
        for dirname in ("originals", "summaries")
        for path in markdown_file_list(workspace, dirname)
    )
    for track in markdown_file_list(workspace, "tracks"):
        track_text_content = track.read_text(encoding="utf-8", errors="replace")
        owned_outputs = [
            normalize_markdown_value(line)
            for line in markdown_section(track_text_content, "Owned Output Files").splitlines()
            if line.strip().startswith("- ") and not placeholder_line(line)
        ]
        missing_outputs = [
            output
            for output in owned_outputs
            if not output.startswith("tracks/")
            and output != repo_rel(root, track)
            and output not in all_topic_text
            and Path(output).name not in all_topic_text
        ]
        if missing_outputs:
            warnings.append(
                f"{repo_rel(root, track)}: owned outputs have no produced source or summary reference: {', '.join(missing_outputs)}"
            )

    index = workspace / "index.md"
    index_text = index.read_text(encoding="utf-8", errors="replace") if index.is_file() else ""
    for survey in markdown_file_list(workspace, "surveys"):
        survey_text_content = survey.read_text(encoding="utf-8", errors="replace")
        rel_survey = repo_rel(root, survey)
        required_sections = [
            "Why Survey Is Needed",
            "Problem Decomposition",
            "Source Landscape",
            "Ranking And Seed List Strategy",
            "Source Quality Heuristics",
            "Retrieval Plan Sketch",
            "Stop Or Handback Conditions",
            "Drift Check",
            "Handoff Target",
        ]
        for heading in required_sections:
            if not section_has_content(survey_text_content, heading):
                warnings.append(f"{rel_survey}: survey missing {heading.lower()}")
        for quadrant in ("known_known", "known_unknown", "unknown_known", "unknown_unknown"):
            if not section_has_content(survey_text_content, quadrant, level=3):
                warnings.append(f"{rel_survey}: survey missing consensus quadrant {quadrant}")
        if survey.name not in index_text and f"surveys/{survey.name}" not in index_text:
            warnings.append(f"{rel_survey}: survey missing from index")

    for research_pass in markdown_file_list(workspace, "passes"):
        if research_pass.name not in index_text and f"passes/{research_pass.name}" not in index_text:
            warnings.append(f"{repo_rel(root, research_pass)}: pass missing from index")

    if markdown_file_list(workspace, "passes"):
        synthesis_files = [
            path
            for path in markdown_file_list(workspace, "summaries")
            if "synthesis" in path.stem or "synthesis" in title_of(path).lower()
        ]
        if not synthesis_files:
            warnings.append(f"{repo_rel(root, workspace)}: latest synthesis missing")
    return warnings


def claim_sections(path: Path) -> list[tuple[str, str]]:
    if not path.is_file():
        return []
    text = path.read_text(encoding="utf-8", errors="replace")
    matches = list(re.finditer(r"^## (.+?)\s*$", text, re.MULTILINE))
    sections: list[tuple[str, str]] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        sections.append((match.group(1).strip(), text[match.end() : end]))
    return sections


def source_scope_by_id(workspace: Path) -> dict[str, str]:
    scopes: dict[str, str] = {}
    for card in markdown_file_list(workspace, "originals"):
        text = card.read_text(encoding="utf-8", errors="replace")
        source_id = field_value(text, "id") or card.stem
        scopes[source_id] = (field_value(text, "scope fit") or "").strip().lower()
        scopes[card.stem] = scopes[source_id]
    return scopes


def normalized_ref_tokens(refs: str) -> set[str]:
    tokens: set[str] = set()
    for raw_line in refs.splitlines():
        line = normalize_markdown_value(raw_line)
        if placeholder_line(line):
            continue
        for raw_token in re.split(r"[\s,]+", line):
            token = raw_token.strip().strip("`'\"()[]{}<>")
            if not token:
                continue
            tokens.add(token)
            path_token = Path(token.split("#", 1)[0])
            tokens.add(path_token.name)
            tokens.add(path_token.stem)
    return tokens


def topic_rel(root: Path, workspace: Path, relpath: str) -> str:
    return f"{repo_rel(root, workspace)}/{relpath}"


def first_nonempty_line(text: str) -> str:
    for line in text.splitlines():
        value = line.strip()
        if value and not value.startswith("#") and not value.startswith("- "):
            return value
    return ""


def collect_topic_record(root: Path, topic_class: str, workspace: Path) -> dict[str, object]:
    index = workspace / "index.md"
    rel_workspace = repo_rel(root, workspace)
    title = title_of(index) if index.is_file() else workspace.name.replace("-", " ").title()
    synthesis_files = [
        path
        for path in markdown_file_list(workspace, "summaries")
        if "synthesis" in path.stem or "synthesis" in title_of(path).lower()
    ]
    source_count = len(markdown_file_list(workspace, "originals"))
    summary_count = len(markdown_file_list(workspace, "summaries"))
    survey_count = len(markdown_file_list(workspace, "surveys"))
    claim_ids = second_level_ids(workspace / "claims.md")
    insight_count = len(markdown_file_list(workspace, "insights"))
    lead_count = len(second_level_ids(workspace / "leads.md"))
    current_view = first_nonempty_line(markdown_section(index.read_text(encoding="utf-8", errors="replace"), "Current View")) if index.is_file() else ""
    return {
        "class": topic_class,
        "slug": workspace.name,
        "title": title,
        "rel": rel_workspace,
        "index": posix_join(rel_workspace, "index.md"),
        "synthesis": posix_join(rel_workspace, "summaries", synthesis_files[0].name) if synthesis_files else "",
        "source_count": source_count,
        "summary_count": summary_count,
        "survey_count": survey_count,
        "claim_count": len(claim_ids),
        "insight_count": insight_count,
        "lead_count": lead_count,
        "current_view": current_view,
    }


def collect_topic_records(root: Path) -> list[dict[str, object]]:
    return [collect_topic_record(root, topic_class, workspace) for topic_class, workspace in iter_topics(root) or []]


def render_researcher_frontdoor(root: Path, records: list[dict[str, object]], title: str) -> str:
    lines = [
        f"# {title}",
        "",
        "## Purpose",
        "",
        "This is the researcher-local frontdoor for research evidence.",
        "",
        "It is a navigation layer over topic workspaces. It is not the shared",
        "checked-in knowledge root and it is not repository evolution memory.",
        "",
        "## Boundary",
        "",
        "- source of truth: `topics/<topic-class>/<topic>/`",
        "- semantic frontdoor: `wiki/`",
        "- shared knowledge promotion remains explicit outside researcher",
        "",
        "## Wiki Pages",
        "",
        "- [wiki/README.md](wiki/README.md)",
        "- [wiki/concepts/research-topics.md](wiki/concepts/research-topics.md)",
        "- [wiki/questions/open-questions.md](wiki/questions/open-questions.md)",
        "- [wiki/claims/supported-claims.md](wiki/claims/supported-claims.md)",
        "",
        "## Topic Index",
    ]
    if records:
        for record in records:
            line = (
                f"- `{record['class']}/{record['slug']}` — "
                f"[{record['title']}]({record['index']})"
            )
            if record["synthesis"]:
                line += f"; synthesis: [{Path(str(record['synthesis'])).name}]({record['synthesis']})"
            counts = (
                f"sources={record['source_count']}, summaries={record['summary_count']}, "
                f"surveys={record['survey_count']}, "
                f"claims={record['claim_count']}"
            )
            line += f" ({counts})"
            lines.append(line)
    else:
        lines.append("- none yet")
    lines.extend(
        [
            "",
            "## Status",
            "",
            "- local researcher synthesis",
            "- derived from topic artifacts",
            "- not promoted shared knowledge",
            "",
        ]
    )
    return "\n".join(lines)


def render_wiki_readme(records: list[dict[str, object]]) -> str:
    lines = [
        "# Researcher Wiki",
        "",
        "This wiki is a researcher-local semantic frontdoor.",
        "",
        "Rules:",
        "",
        "- topics remain the evidence source of truth",
        "- wiki pages must cite topic-local evidence paths",
        "- wiki pages are not shared knowledge until explicitly promoted",
        "- update this surface with `refresh-wiki`",
        "",
        "## Pages",
        "",
        "- [concepts/research-topics.md](concepts/research-topics.md)",
        "- [questions/open-questions.md](questions/open-questions.md)",
        "- [claims/supported-claims.md](claims/supported-claims.md)",
        "",
        "## Topic Coverage",
    ]
    if records:
        lines.extend([f"- `{record['class']}/{record['slug']}` — `{record['index']}`" for record in records])
    else:
        lines.append("- none yet")
    lines.append("")
    return "\n".join(lines)


def render_research_topics_page(records: list[dict[str, object]]) -> str:
    lines = [
        "# Research Topics",
        "",
        "Status: research-local semantic index.",
        "",
        "This page groups topic workspaces without replacing their evidence.",
        "",
        "## Topics",
    ]
    if records:
        for record in records:
            lines.extend(
                [
                    f"### {record['title']}",
                    "",
                    f"- topic: `{record['class']}/{record['slug']}`",
                    f"- evidence: `{record['index']}`",
                    f"- synthesis: `{record['synthesis'] or 'none recorded'}`",
                    f"- counts: sources={record['source_count']}, summaries={record['summary_count']}, surveys={record['survey_count']}, claims={record['claim_count']}",
                    "",
                ]
            )
    else:
        lines.append("- none yet")
    return "\n".join(lines).rstrip() + "\n"


def render_open_questions_page(records: list[dict[str, object]]) -> str:
    lines = [
        "# Open Questions",
        "",
        "Status: research-local semantic index.",
        "",
        "Open leads and unresolved questions should stay attached to topic evidence.",
        "",
        "## Topic Leads",
    ]
    any_leads = False
    for record in records:
        if int(record["lead_count"]) > 0:
            any_leads = True
            lead_ref = posix_join(record["rel"], "leads.md")
            lines.append(f"- `{record['class']}/{record['slug']}` — leads: `{lead_ref}`")
    if not any_leads:
        lines.append("- none yet")
    lines.extend(["", "## Topic Coverage"])
    if records:
        lines.extend([f"- `{record['class']}/{record['slug']}` — `{record['index']}`" for record in records])
    else:
        lines.append("- none yet")
    lines.append("")
    return "\n".join(lines)


def render_supported_claims_page(root: Path, records: list[dict[str, object]]) -> str:
    lines = [
        "# Supported Claims",
        "",
        "Status: research-local semantic index.",
        "",
        "Claims listed here are pointers into topic claim ledgers.",
        "",
        "## Claims",
    ]
    found = False
    for record in records:
        claims = researcher_root_dir(root) / "topics" / str(record["class"]) / str(record["slug"]) / "claims.md"
        for claim_id, body in claim_sections(claims):
            status = field_value(body, "status") or "open"
            if status not in {"supported", "promoted"}:
                continue
            found = True
            statement = markdown_section(body, "Statement", level=3).replace("\n", " ").strip()
            rel = f"{posix_join(record['rel'], 'claims.md')}#{slugify(claim_id)}"
            lines.append(f"- `{rel}` — {status}: {statement or claim_id}")
    if not found:
        lines.append("- none yet")
    lines.extend(["", "## Topic Coverage"])
    if records:
        lines.extend([f"- `{record['class']}/{record['slug']}` — `{record['index']}`" for record in records])
    else:
        lines.append("- none yet")
    lines.append("")
    return "\n".join(lines)


def refresh_wiki(args: argparse.Namespace) -> int:
    root = resolve_root(args.root)
    research_root = researcher_root_dir(root)
    records = collect_topic_records(root)
    wiki = research_root / "wiki"
    for dirname in WIKI_DIRS:
        (wiki / dirname).mkdir(parents=True, exist_ok=True)
    (research_root / "index.md").write_text(
        render_researcher_frontdoor(root, records, args.title or "Researcher Frontdoor"),
        encoding="utf-8",
    )
    (wiki / "README.md").write_text(render_wiki_readme(records), encoding="utf-8")
    (wiki / "concepts" / "research-topics.md").write_text(render_research_topics_page(records), encoding="utf-8")
    (wiki / "questions" / "open-questions.md").write_text(render_open_questions_page(records), encoding="utf-8")
    (wiki / "claims" / "supported-claims.md").write_text(render_supported_claims_page(root, records), encoding="utf-8")
    print(f"ok: refreshed {repo_rel(root, research_root / 'index.md')} and {repo_rel(root, wiki)}")
    return 0


def collect_wiki_warnings(root: Path) -> list[str]:
    warnings: list[str] = []
    research_root = researcher_root_dir(root)
    wiki = research_root / "wiki"
    required = [
        research_root / "index.md",
        wiki / "README.md",
        wiki / "concepts" / "research-topics.md",
        wiki / "questions" / "open-questions.md",
        wiki / "claims" / "supported-claims.md",
    ]
    for path in required:
        if not path.is_file():
            warnings.append(f"{repo_rel(root, path)}: wiki/frontdoor file missing")
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        absolute_markers = ("/" + "Users", "/" + "var/folders", "file" + "://")
        if any(marker in text for marker in absolute_markers):
            warnings.append(f"{repo_rel(root, path)}: wiki/frontdoor contains absolute path marker")
    if (research_root / "index.md").is_file():
        frontdoor = (research_root / "index.md").read_text(encoding="utf-8", errors="replace")
        if "topics/" not in frontdoor:
            warnings.append(f"{repo_rel(root, research_root / 'index.md')}: frontdoor has no topic evidence refs")
        if "not the shared" not in frontdoor.lower():
            warnings.append(f"{repo_rel(root, research_root / 'index.md')}: frontdoor missing shared-knowledge boundary")
    for page in sorted(wiki.rglob("*.md")) if wiki.is_dir() else []:
        if page.name == "README.md":
            continue
        text = page.read_text(encoding="utf-8", errors="replace")
        if "topics/" not in text and ".bagakit/researcher/topics" not in text:
            warnings.append(f"{repo_rel(root, page)}: wiki page has no topic evidence ref")
    return warnings


def collect_drift_warnings(root: Path, workspace: Path) -> list[str]:
    warnings: list[str] = []
    rel_workspace = repo_rel(root, workspace)
    if not (workspace / "charter.md").is_file():
        warnings.append(f"{rel_workspace}: topic has no charter.md")

    for track in markdown_file_list(workspace, "tracks"):
        text = track.read_text(encoding="utf-8", errors="replace")
        if not section_has_content(text, "Owned Output Files"):
            warnings.append(f"{repo_rel(root, track)}: track lacks explicit output ownership")

    for card in markdown_file_list(workspace, "originals"):
        text = card.read_text(encoding="utf-8", errors="replace")
        rel = repo_rel(root, card)
        if missing_value(field_value(text, "source role")):
            warnings.append(f"{rel}: source card missing source role")
        if missing_value(field_value(text, "scope fit")):
            warnings.append(f"{rel}: source card missing scope fit")

    scopes = source_scope_by_id(workspace)
    for claim_id, body in claim_sections(workspace / "claims.md"):
        rel_claim = f"{rel_workspace}{'/'}claims.md#{slugify(claim_id)}"
        evidence = markdown_section(body, "Evidence Refs", level=3)
        counterevidence = markdown_section(body, "Counterevidence Refs", level=3)
        kind = field_value(body, "kind") or "unknown"
        if not section_has_content(body, "Evidence Refs", level=3):
            warnings.append(f"{rel_claim}: claim has no evidence refs")
        if kind == "recommendation" and not section_has_content(body, "Counterevidence Refs", level=3):
            warnings.append(f"{rel_claim}: recommendation lacks counterevidence handling")
        if kind == "recommendation":
            evidence_refs = normalized_ref_tokens(evidence)
            for source_id, scope in scopes.items():
                if scope in {"context", "deferred"} and source_id in evidence_refs:
                    warnings.append(f"{rel_claim}: recommendation uses {scope} source `{source_id}`")
        if kind == "recommendation" and "none recorded" in counterevidence.lower():
            warnings.append(f"{rel_claim}: recommendation records no counterevidence")

    for insight in markdown_file_list(workspace, "insights"):
        text = insight.read_text(encoding="utf-8", errors="replace")
        source_claims = [
            line
            for line in markdown_section(text, "Source Claims").splitlines()
            if line.strip().startswith("- ") and "none recorded" not in line.lower()
        ]
        confidence = markdown_section(text, "Confidence").strip().lower()
        if len(source_claims) <= 1 and confidence not in {"low", "speculative"}:
            warnings.append(f"{repo_rel(root, insight)}: insight has only one source claim without low/speculative confidence")

    for lead_id, body in claim_sections(workspace / "leads.md"):
        rel_lead = f"{rel_workspace}{'/'}leads.md#{slugify(lead_id)}"
        status = field_value(body, "status") or "unknown"
        if not section_has_content(body, "Expected Value", level=3):
            warnings.append(f"{rel_lead}: lead has no expected value")
        if not section_has_content(body, "Stop Rule", level=3):
            warnings.append(f"{rel_lead}: lead has no stop rule")
        if status == "pursued" and not section_has_content(body, "Outcome", level=3):
            warnings.append(f"{rel_lead}: pursued lead has no outcome")
    return warnings


def selected_workspaces(root: Path, args: argparse.Namespace) -> tuple[list[str], list[Path]]:
    issues: list[str] = []
    workspaces: list[Path] = []
    if args.topic_class and args.topic:
        workspace = workspace_dir(root, args.topic_class, args.topic)
        if not workspace.exists():
            issues.append(f"missing topic workspace: {repo_rel(root, workspace)}")
        else:
            workspaces.append(workspace)
    else:
        for _topic_class, workspace in iter_topics(root) or []:
            workspaces.append(workspace)
        if not workspaces:
            issues.append("no researcher topics found under the configured researcher root")
    return issues, workspaces


def doctor(args: argparse.Namespace) -> int:
    root = resolve_root(args.root)
    issues, workspaces = selected_workspaces(root, args)
    for workspace in workspaces:
        issues.extend(validate_workspace(root, workspace))

    if issues:
        for issue in issues:
            print(issue, file=sys.stderr)
        return 1

    warnings: list[str] = []
    if args.quality:
        for workspace in workspaces:
            warnings.extend(collect_quality_warnings(root, workspace))
    if args.drift:
        for workspace in workspaces:
            warnings.extend(collect_drift_warnings(root, workspace))
    if args.wiki:
        warnings.extend(collect_wiki_warnings(root))

    for warning in warnings:
        print(f"warning: {warning}", file=sys.stderr)
    if warnings:
        print(f"research workspace check passed with {len(warnings)} warning(s)")
    else:
        print("research workspace check passed")
    return 0


def add_topic_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--root", default=".")
    parser.add_argument("--topic-class", required=True)
    parser.add_argument("--topic", required=True)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Bagakit local-first research workspace helper")
    sub = parser.add_subparsers(dest="command", required=True)

    init_p = sub.add_parser("init-topic", help="initialize one topic workspace under the configured researcher root")
    add_topic_args(init_p)
    init_p.add_argument("--title")
    init_p.add_argument("--extended", action="store_true", help="create optional parallel-research surfaces")
    init_p.set_defaults(func=init_topic)

    card_p = sub.add_parser("add-source-card", help="write one source card under originals/")
    add_topic_args(card_p)
    card_p.add_argument("--source-id", required=True)
    card_p.add_argument("--title", required=True)
    card_p.add_argument("--url", required=True)
    card_p.add_argument("--authority", required=True)
    card_p.add_argument("--published")
    card_p.add_argument("--why")
    card_p.add_argument("--pass-id")
    card_p.add_argument("--track-id")
    card_p.add_argument("--source-role")
    card_p.add_argument("--scope-fit")
    card_p.add_argument("--limitations", action="append", default=[])
    card_p.add_argument("--force", action="store_true")
    card_p.set_defaults(func=add_source_card)

    summary_p = sub.add_parser("add-summary", help="write one reusable summary under summaries/")
    add_topic_args(summary_p)
    summary_p.add_argument("--source-id", required=True)
    summary_p.add_argument("--title", required=True)
    summary_p.add_argument("--why-matters")
    summary_p.add_argument("--borrow", action="append", default=[])
    summary_p.add_argument("--avoid", action="append", default=[])
    summary_p.add_argument("--implication", action="append", default=[])
    summary_p.add_argument("--force", action="store_true")
    summary_p.set_defaults(func=add_summary)

    refresh_p = sub.add_parser("refresh-index", help="refresh one topic index")
    add_topic_args(refresh_p)
    refresh_p.add_argument("--title")
    refresh_p.add_argument("--force-rewrite", action="store_true", help="rewrite the generated index before refreshing managed sections")
    refresh_p.set_defaults(func=refresh_index)

    wiki_p = sub.add_parser("refresh-wiki", help="refresh researcher-local wiki/frontdoor pages")
    wiki_p.add_argument("--root", default=".")
    wiki_p.add_argument("--title")
    wiki_p.set_defaults(func=refresh_wiki)

    pass_p = sub.add_parser("plan-pass", help="create one bounded research pass and optional track contracts")
    add_topic_args(pass_p)
    pass_p.add_argument("--pass-id", required=True)
    pass_p.add_argument("--question", required=True)
    pass_p.add_argument("--title")
    pass_p.add_argument("--charter-question")
    pass_p.add_argument("--decision-use")
    pass_p.add_argument("--output-shape")
    pass_p.add_argument("--in-scope", action="append", default=[])
    pass_p.add_argument("--out-of-scope", action="append", default=[])
    pass_p.add_argument("--source-priority", action="append", default=[])
    pass_p.add_argument("--evidence-threshold")
    pass_p.add_argument("--stop-condition", action="append", default=[])
    pass_p.add_argument("--drift-sentinel", action="append", default=[])
    pass_p.add_argument("--source-class", action="append", default=[])
    pass_p.add_argument("--track", action="append", default=[], metavar="TRACK_ID:QUESTION")
    pass_p.add_argument("--required-source-type", action="append", default=[])
    pass_p.add_argument("--source-id-range")
    pass_p.add_argument("--budget")
    pass_p.add_argument("--merge-expectation", action="append", default=[])
    pass_p.add_argument("--synthesis-target")
    pass_p.add_argument("--lead-policy")
    pass_p.add_argument("--drift-check")
    pass_p.add_argument("--force", action="store_true")
    pass_p.add_argument("--force-charter", action="store_true")
    pass_p.set_defaults(func=plan_pass)

    survey_p = sub.add_parser("plan-survey", help="create one pre-retrieval survey packet")
    add_topic_args(survey_p)
    survey_p.add_argument("--survey-id", required=True)
    survey_p.add_argument("--question", required=True)
    survey_p.add_argument("--title")
    survey_p.add_argument("--charter-ref", default="charter.md")
    survey_p.add_argument("--charter-question")
    survey_p.add_argument("--decision-use")
    survey_p.add_argument("--output-shape")
    survey_p.add_argument("--in-scope", action="append", default=[])
    survey_p.add_argument("--out-of-scope", action="append", default=[])
    survey_p.add_argument("--source-priority", action="append", default=[])
    survey_p.add_argument("--evidence-threshold")
    survey_p.add_argument("--why-needed")
    survey_p.add_argument("--problem-dimension", action="append", default=[])
    survey_p.add_argument("--known-known", action="append", default=[])
    survey_p.add_argument("--known-unknown", action="append", default=[])
    survey_p.add_argument("--unknown-known", action="append", default=[])
    survey_p.add_argument("--unknown-unknown", action="append", default=[])
    survey_p.add_argument("--source-landscape", action="append", default=[])
    survey_p.add_argument("--ranking-lead", action="append", default=[])
    survey_p.add_argument("--quality-heuristic", action="append", default=[])
    survey_p.add_argument("--seed-query", action="append", default=[])
    survey_p.add_argument("--stop-condition", action="append", default=[])
    survey_p.add_argument("--drift-sentinel", action="append", default=[])
    survey_p.add_argument("--drift-check")
    survey_p.add_argument("--handoff-target")
    survey_p.add_argument("--force", action="store_true")
    survey_p.add_argument("--force-charter", action="store_true")
    survey_p.set_defaults(func=plan_survey)

    track_p = sub.add_parser("add-track", help="write one parallel research track contract")
    add_topic_args(track_p)
    track_p.add_argument("--track-id", required=True)
    track_p.add_argument("--pass-id", dest="pass_id")
    track_p.add_argument("--question", required=True)
    track_p.add_argument("--charter-ref", default="charter.md")
    track_p.add_argument("--required-source-type", action="append", default=[])
    track_p.add_argument("--preferred-source", action="append", default=[])
    track_p.add_argument("--disallowed-source", action="append", default=[])
    track_p.add_argument("--source-id-range")
    track_p.add_argument("--owned-output", action="append", default=[])
    track_p.add_argument("--minimum-evidence")
    track_p.add_argument("--lead-policy")
    track_p.add_argument("--drift-check")
    track_p.add_argument("--merge-note", action="append", default=[])
    track_p.add_argument("--force", action="store_true")
    track_p.set_defaults(func=add_track)

    list_tracks_p = sub.add_parser("list-tracks", help="list track contracts for one topic")
    add_topic_args(list_tracks_p)
    list_tracks_p.set_defaults(func=list_tracks)

    claim_p = sub.add_parser("add-claim", help="append one claim entry to claims.md")
    add_topic_args(claim_p)
    claim_p.add_argument("--claim-id", required=True)
    claim_p.add_argument("--statement", required=True)
    claim_p.add_argument("--kind", choices=["observation", "inference", "recommendation"], required=True)
    claim_p.add_argument("--evidence-ref", action="append", default=[])
    claim_p.add_argument("--counterevidence-ref", action="append", default=[])
    claim_p.add_argument("--confidence", choices=["high", "medium", "low", "speculative"], default="low")
    claim_p.add_argument("--status", choices=["open", "supported", "contradicted", "superseded", "promoted"], default="open")
    claim_p.add_argument("--implication")
    claim_p.add_argument("--force", action="store_true")
    claim_p.set_defaults(func=add_claim)

    insight_p = sub.add_parser("add-insight", help="write one cross-source insight card")
    add_topic_args(insight_p)
    insight_p.add_argument("--insight-id", required=True)
    insight_p.add_argument("--title")
    insight_p.add_argument("--insight", required=True)
    insight_p.add_argument("--source-claim", action="append", default=[])
    insight_p.add_argument("--counterclaim", action="append", default=[])
    insight_p.add_argument("--confidence", choices=["high", "medium", "low", "speculative"], default="low")
    insight_p.add_argument("--why-matters")
    insight_p.add_argument("--borrow", action="append", default=[])
    insight_p.add_argument("--avoid", action="append", default=[])
    insight_p.add_argument("--implication", action="append", default=[])
    insight_p.add_argument("--next-action")
    insight_p.add_argument("--force", action="store_true")
    insight_p.set_defaults(func=add_insight)

    lead_p = sub.add_parser("add-lead", help="append one proactive mining lead")
    add_topic_args(lead_p)
    lead_p.add_argument("--lead-id", required=True)
    lead_p.add_argument("--originating-artifact", required=True)
    lead_p.add_argument("--hypothesis", required=True)
    lead_p.add_argument("--expected-value")
    lead_p.add_argument("--suggested-query")
    lead_p.add_argument("--status", choices=["open", "pursued", "rejected", "deferred", "promoted"], default="open")
    lead_p.add_argument("--stop-rule")
    lead_p.add_argument("--outcome")
    lead_p.add_argument("--force", action="store_true")
    lead_p.set_defaults(func=add_lead)

    resolve_lead_p = sub.add_parser("resolve-lead", help="update lead status and optional outcome")
    add_topic_args(resolve_lead_p)
    resolve_lead_p.add_argument("--lead-id", required=True)
    resolve_lead_p.add_argument("--status", choices=["open", "pursued", "rejected", "deferred", "promoted"], required=True)
    resolve_lead_p.add_argument("--outcome")
    resolve_lead_p.set_defaults(func=resolve_lead)

    synthesis_p = sub.add_parser("new-synthesis", help="write one synthesis summary under summaries/")
    add_topic_args(synthesis_p)
    synthesis_p.add_argument("--synthesis-id", required=True)
    synthesis_p.add_argument("--title")
    synthesis_p.add_argument("--what")
    synthesis_p.add_argument("--claim-ref", action="append", default=[])
    synthesis_p.add_argument("--insight-ref", action="append", default=[])
    synthesis_p.add_argument("--finding", action="append", default=[])
    synthesis_p.add_argument("--risk", action="append", default=[])
    synthesis_p.add_argument("--next-action")
    synthesis_p.add_argument("--force", action="store_true")
    synthesis_p.set_defaults(func=new_synthesis)

    handoff_p = sub.add_parser("render-handoff", help="write an optional downstream handoff artifact")
    add_topic_args(handoff_p)
    handoff_p.add_argument("--kind", choices=sorted(HANDOFF_FILES), required=True)
    handoff_p.add_argument("--handoff-id")
    handoff_p.add_argument("--force", action="store_true")
    handoff_p.set_defaults(func=render_handoff)

    list_p = sub.add_parser("list-topics", help="list researcher topics")
    list_p.add_argument("--root", default=".")
    list_p.set_defaults(func=list_topics)

    doctor_p = sub.add_parser("doctor", help="validate one topic or every researcher topic workspace")
    doctor_p.add_argument("--root", default=".")
    doctor_p.add_argument("--topic-class")
    doctor_p.add_argument("--topic")
    doctor_p.add_argument("--quality", action="store_true", help="print warning-only quality findings")
    doctor_p.add_argument("--drift", action="store_true", help="print warning-only research drift findings")
    doctor_p.add_argument("--wiki", action="store_true", help="print warning-only wiki/frontdoor findings")
    doctor_p.set_defaults(func=doctor)

    return parser


def main(argv: list[str]) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
