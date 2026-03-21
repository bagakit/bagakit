"""Brainstorm artifact manager for bagakit-brainstorm."""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from string import Formatter


STATUS_RE = re.compile(r"(?im)^-\s*Status:\s*(pending|in_progress|complete|blocked)\s*$")
CLARIFICATION_STATUS_RE = re.compile(r"(?im)^-\s*Clarification status:\s*(pending|in_progress|complete|blocked)\s*$")
LEGACY_STATUS_RE = re.compile(r"(?im)\*\*Status:\*\*\s*(pending|in_progress|complete|blocked)\s*$")
FRONTMATTER_STATUS_RE = re.compile(r"(?im)^stage_status:\s*(pending|in_progress|complete|blocked)\s*$")
PLANNING_ENTRY_HANDOFF_SCHEMA = "bagakit/planning-entry-handoff/v1"
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
YEAR_OR_DATE_RE = re.compile(r"^\d{4}(?:-\d{2}-\d{2})?$")
SEMANTIC_VERSION_DIR_RE = re.compile(r"^v([1-9][0-9]*)-[A-Za-z0-9\u4e00-\u9fff]+(?:-[A-Za-z0-9\u4e00-\u9fff]+)*$")
PLAIN_VERSION_DIR_RE = re.compile(r"^v([1-9][0-9]*)$")
LEGACY_CANDIDATE_FILE_RE = re.compile(r"(?i)^candidate-v([1-9][0-9]*)\.md$")
REQUIRED_STAGES: tuple[tuple[str, str], ...] = (
    ("input_and_qa", "input_and_qa.md"),
    ("finding_and_analyze", "finding_and_analyze.md"),
    ("expert_forum_review", "expert_forum.md"),
    ("outcome_and_handoff", "outcome_and_handoff.md"),
)
REQUIRED_SUPPORT_FILES: tuple[tuple[str, str], ...] = (
    ("raw_discussion_log", "raw_discussion_log.md"),
)
OPTIONAL_STAGES: tuple[tuple[str, str], ...] = (
    ("related_insights", "related_insights.md"),
    ("review_quality", "review_quality.md"),
    ("eval_effect_review", "eval_effect_review.md"),
)
ARTIFACT_PLACEHOLDER_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("example.* URL", re.compile(r"\bexample\.[A-Za-z0-9.-]+\b", re.IGNORECASE)),
    ("placeholder token", re.compile(r"\{\{[^{}\n]+\}\}")),
    ("TBD marker", re.compile(r"\bTBD\b", re.IGNORECASE)),
    ("TODO marker", re.compile(r"\bTODO\b", re.IGNORECASE)),
    ("待补充 marker", re.compile(r"待补充")),
    ("frontier prompt marker", re.compile(r"^\s*-\s*Recent frontier signal \d+.*:\s*$", re.IGNORECASE)),
    ("frontier prompt marker", re.compile(r"^\s*-\s*Optional frontier signal \d+.*:\s*$", re.IGNORECASE)),
    ("frontier prompt marker", re.compile(r"^\s*-\s*Known failure case or anti-pattern:\s*$", re.IGNORECASE)),
    ("frontier prompt marker", re.compile(r"^\s*-\s*Why this frontier context changes the option space:\s*$", re.IGNORECASE)),
    ("boundary prompt marker", re.compile(r"^\s*-\s*专家[A-Z]：\s*$")),
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def utc_day() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def utc_compact_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")
    if not value:
        raise SystemExit("error: slug became empty after normalization")
    return value


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def rel(root: Path, path: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)


def brainstorm_root(root: Path) -> Path:
    return root / ".bagakit" / "brainstorm"


def runs_root(root: Path) -> Path:
    return brainstorm_root(root) / "runs"


def archive_root(root: Path) -> Path:
    return brainstorm_root(root) / "archive"


def classify_artifact_scope(root: Path, artifact_dir: Path) -> str:
    if archive_root(root) in artifact_dir.parents:
        return "archive"
    if runs_root(root) in artifact_dir.parents:
        return "runs"
    return "external"


def ensure_unique_dir(path: Path) -> Path:
    if not path.exists():
        return path
    index = 2
    while True:
        candidate = path.with_name(f"{path.name}-{index}")
        if not candidate.exists():
            return candidate
        index += 1


def resolve_latest_artifact(root: Path, include_archive: bool = False) -> Path:
    run_candidates: list[Path] = []
    base_runs = runs_root(root)
    if base_runs.is_dir():
        run_candidates = [p for p in base_runs.iterdir() if p.is_dir()]
    if run_candidates:
        run_candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        return run_candidates[0]

    if include_archive:
        archive_candidates: list[Path] = []
        base_archive = archive_root(root)
        if base_archive.is_dir():
            archive_candidates = [p for p in base_archive.iterdir() if p.is_dir()]
        if archive_candidates:
            archive_candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
            return archive_candidates[0]

    raise SystemExit(f"error: no artifact directory under {brainstorm_root(root)}")


def resolve_archived_counterpart(root: Path, artifact_name: str) -> Path | None:
    candidate = archive_root(root) / artifact_name
    if candidate.is_dir():
        return candidate
    return None


def resolve_artifact_dir(root: Path, dir_arg: str | None, allow_archive_lookup: bool) -> Path:
    if not dir_arg:
        return resolve_latest_artifact(root, include_archive=allow_archive_lookup)

    candidate = Path(dir_arg).expanduser().resolve()
    if candidate.is_dir():
        return candidate

    if allow_archive_lookup:
        archived = resolve_archived_counterpart(root, candidate.name)
        if archived is not None:
            return archived

    raise SystemExit(f"error: artifact directory not found: {candidate}")


def split_legacy_artifact_name(name: str) -> tuple[str, str]:
    parts = name.split("-", 3)
    if len(parts) >= 4 and DATE_RE.match("-".join(parts[:3])):
        return "-".join(parts[:3]), parts[3]
    return utc_day(), name


def artifact_slug(artifact_name: str) -> str:
    if "--" in artifact_name:
        candidate = artifact_name.split("--", 1)[1].strip()
        if candidate:
            return candidate
    _, fallback_slug = split_legacy_artifact_name(artifact_name)
    return fallback_slug


def render_template(src: Path, dst: Path, replacements: dict[str, str]) -> None:
    text = read_text(src)
    for key, value in replacements.items():
        text = text.replace(key, value)
    write_text(dst, text)


def extract_frontmatter(text: str) -> str | None:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return None
    for index, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            return "\n".join(lines[1:index])
    return None


def markdown_body_without_frontmatter(text: str) -> str:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return text
    for index, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            return "\n".join(lines[index + 1 :])
    return text


def frontmatter_scalar(frontmatter: str, key: str) -> str | None:
    pattern = re.compile(rf"(?im)^{re.escape(key)}:\s*(.*?)\s*$")
    match = pattern.search(frontmatter)
    if not match:
        return None
    return match.group(1).strip()


def frontmatter_list_count(frontmatter: str, key: str) -> int:
    lines = frontmatter.splitlines()
    count = 0
    collecting = False
    key_indent = 0
    for line in lines:
        if not collecting:
            key_match = re.match(rf"^(\s*){re.escape(key)}:\s*$", line)
            if key_match:
                collecting = True
                key_indent = len(key_match.group(1))
            continue

        if not line.strip():
            continue

        indent = len(line) - len(line.lstrip(" "))
        if indent <= key_indent and re.match(r"^\s*[A-Za-z0-9_-]+\s*:", line):
            break
        if re.match(r"^\s*-\s+", line):
            count += 1
    return count


def frontmatter_named_values(frontmatter: str, nested_key: str) -> list[str]:
    return [match.group(1).strip() for match in re.finditer(rf"(?im)^\s*{re.escape(nested_key)}:\s*(.+?)\s*$", frontmatter)]


def heading_exists(text: str, heading: str) -> bool:
    return re.search(rf"(?im)^#{{1,6}}\s+{re.escape(heading)}\s*$", text) is not None


def heading_section(text: str, heading: str) -> str:
    match = re.search(rf"(?ims)^##\s+{re.escape(heading)}\s*$\n(.*?)(?=^##\s+|\Z)", text)
    if not match:
        return ""
    return match.group(1)


def third_level_blocks(text: str) -> list[tuple[str, str]]:
    return [
        (match.group(1).strip(), match.group(2))
        for match in re.finditer(r"(?ms)^###\s+(.+?)\s*$\n(.*?)(?=^###\s+|\Z)", text)
    ]


def block_scalar(block: str, label: str) -> str | None:
    match = re.search(rf"(?im)^-\s*{re.escape(label)}(?:\:|：)\s*(.*?)\s*$", block)
    if not match:
        return None
    return match.group(1).strip()


def markdown_table_rows(text: str) -> list[list[str]]:
    rows: list[list[str]] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped.startswith("|"):
            continue
        if re.match(r"^\|\s*[-:| ]+\|?\s*$", stripped):
            continue
        cells = [cell.strip() for cell in stripped.strip("|").split("|")]
        if not any(cells):
            continue
        rows.append(cells)
    return rows


def data_table_rows(text: str) -> list[list[str]]:
    rows = markdown_table_rows(text)
    if len(rows) <= 1:
        return []
    return rows[1:]


def score_row_count(text: str) -> int:
    return len(re.findall(r"(?m)^\|\s*[^|\n]+\s*\|\s*[^|\n]+\s*\|\s*(?:10|[0-9])(?:\.[0-9]+)?\s*\|", text))


def url_count(text: str) -> int:
    return len(re.findall(r"https?://[^\s)]+", text))


def artifact_markdown_files(artifact_dir: Path) -> list[Path]:
    files: list[Path] = []
    for _, file_name in REQUIRED_STAGES:
        path = artifact_dir / file_name
        if path.is_file():
            files.append(path)
    for _, file_name in REQUIRED_SUPPORT_FILES:
        path = artifact_dir / file_name
        if path.is_file():
            files.append(path)
    for _, file_name in OPTIONAL_STAGES:
        path = artifact_dir / file_name
        if path.is_file():
            files.append(path)
    return files


def artifact_placeholder_hard_issues(artifact_dir: Path) -> list[str]:
    issues: list[str] = []
    for path in artifact_markdown_files(artifact_dir):
        for line_number, line in enumerate(read_text(path).splitlines(), start=1):
            for label, pattern in ARTIFACT_PLACEHOLDER_PATTERNS:
                if pattern.search(line):
                    issues.append(f"{path.name}:{line_number} contains {label}")
                    break
    return issues


def experiment_count(artifact_dir: Path) -> int:
    experimental_root = artifact_dir / "experimental"
    if not experimental_root.is_dir():
        return 0
    return sum(1 for path in experimental_root.iterdir() if path.is_dir())


def experiment_bonus_points(artifact_dir: Path) -> int:
    count = experiment_count(artifact_dir)
    if count <= 0:
        return 0
    return min(5, count)


def semantic_version_index(dir_name: str) -> int | None:
    match = SEMANTIC_VERSION_DIR_RE.match(dir_name)
    if not match:
        return None
    return int(match.group(1))


def version_delta_scalar(text: str, key: str) -> str | None:
    match = re.search(rf"(?im)^-\s*{re.escape(key)}:\s*(.+?)\s*$", text)
    if not match:
        return None
    return match.group(1).strip()


def section_bullets(text: str, heading: str) -> list[str]:
    match = re.search(rf"(?ims)^##\s+{re.escape(heading)}\s*$\n(.*?)(?=^##\s+|\Z)", text)
    if not match:
        return []
    return [item.group(1).strip() for item in re.finditer(r"(?m)^\s*-\s+(.+?)\s*$", match.group(1))]


def nested_bullets_after_label(section_text: str, label: str) -> list[str]:
    lines = section_text.splitlines()
    collecting = False
    bullets: list[str] = []
    for line in lines:
        stripped = line.rstrip()
        if not collecting:
            if re.match(rf"^\s*-\s*{re.escape(label)}(?:\:|：)\s*$", stripped):
                collecting = True
            continue
        if not stripped.strip():
            if bullets:
                break
            continue
        nested = re.match(r"^\s{2,}-\s+(.+?)\s*$", stripped)
        if nested:
            bullets.append(nested.group(1).strip())
            continue
        if re.match(r"^\s*-\s+", stripped) or re.match(r"^##\s+", stripped):
            break
    return bullets


def labeled_scalar_or_nested_bullets(section_text: str, label: str) -> list[str]:
    nested = nested_bullets_after_label(section_text, label)
    if nested:
        return nested
    match = re.search(rf"(?im)^\s*-\s*{re.escape(label)}(?:\:|：)\s*(.+?)\s*$", section_text)
    if not match:
        return []
    value = match.group(1).strip()
    return [value] if value else []


def first_question_card_ref(text: str) -> str:
    match = re.search(r"\bQ-\d{3}\b", text)
    if not match:
        return "input_and_qa.md#Goal-Snapshot"
    return f"input_and_qa.md#{match.group(0)}"


def has_relative_optimizations(text: str) -> bool:
    return len(section_bullets(text, "Relative Optimizations")) > 0


def references_prior_version(bullets: list[str], previous_version_name: str) -> bool:
    previous_hint = previous_version_name.lower()
    return any(previous_hint in bullet.lower() for bullet in bullets)


def has_technique_keyword(text: str) -> bool:
    lower = text.lower()
    return "technique" in lower or "summary" in lower or "技巧" in text or "总结" in text


def evidence_rows(body_text: str) -> list[list[str]]:
    return data_table_rows(heading_section(body_text, "专家检索与证据陈述"))


def current_utc_year() -> int:
    return datetime.now(timezone.utc).year


def prompt_bullet_is_filled(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return False
    if re.search(r":\s*$", stripped):
        return False
    return True


def experiment_version_policy_hard_issues(artifact_dir: Path) -> list[str]:
    experimental_root = artifact_dir / "experimental"
    if not experimental_root.is_dir():
        return []

    issues: list[str] = []
    experiment_dirs = sorted([path for path in experimental_root.iterdir() if path.is_dir()], key=lambda p: p.name)
    for experiment_dir in experiment_dirs:
        versions_dir = experiment_dir / "versions"
        if versions_dir.is_dir():
            issues.append(
                f"{rel(artifact_dir, versions_dir)} is not allowed; place version folders directly under {rel(artifact_dir, experiment_dir)} using vN-semantic naming"
            )

        for entry in sorted(experiment_dir.iterdir(), key=lambda p: p.name):
            if entry.is_file() and LEGACY_CANDIDATE_FILE_RE.match(entry.name):
                issues.append(
                    f"{rel(artifact_dir, entry)} uses legacy candidate-vN file naming; use direct child folders such as v1-semantic-description or v2-semantic-description instead"
                )

        direct_semantic_versions: list[tuple[int, Path]] = []
        direct_plain_versions: list[Path] = []
        for entry in sorted(experiment_dir.iterdir(), key=lambda p: p.name):
            if not entry.is_dir():
                continue
            index = semantic_version_index(entry.name)
            if index is not None:
                direct_semantic_versions.append((index, entry))
                continue
            if PLAIN_VERSION_DIR_RE.match(entry.name):
                direct_plain_versions.append(entry)

        for plain_dir in direct_plain_versions:
            issues.append(
                f"{rel(artifact_dir, plain_dir)} must include semantic suffix; expected format: vN-semantic-description"
            )

        nested_version_dirs = sorted(
            [
                path
                for path in experiment_dir.rglob("*")
                if path.is_dir()
                and path.parent != experiment_dir
                and (semantic_version_index(path.name) is not None or PLAIN_VERSION_DIR_RE.match(path.name) is not None)
            ],
            key=lambda p: str(p),
        )
        for path in nested_version_dirs:
            issues.append(
                f"{rel(artifact_dir, path)} must be moved to {rel(artifact_dir, experiment_dir)}/ as a direct child directory"
            )

        if not direct_semantic_versions:
            continue

        direct_semantic_versions.sort(key=lambda item: (item[0], item[1].name))
        indexes = [item[0] for item in direct_semantic_versions]
        if indexes[0] != 1:
            issues.append(
                f"{rel(artifact_dir, experiment_dir)} version chain must start at v1-semantic-description"
            )
        for prev_idx, curr_idx in zip(indexes, indexes[1:]):
            if curr_idx != prev_idx + 1:
                issues.append(
                    f"{rel(artifact_dir, experiment_dir)} version numbers must be contiguous; found gap between v{prev_idx} and v{curr_idx}"
                )

        seen_indexes: set[int] = set()
        for index in indexes:
            if index in seen_indexes:
                issues.append(
                    f"{rel(artifact_dir, experiment_dir)} has duplicate semantic directories for v{index}; keep one directory per version number"
                )
            seen_indexes.add(index)

        semantic_by_index = {index: path for index, path in direct_semantic_versions}
        for index, version_dir in direct_semantic_versions:
            delta_file = version_dir / "version_delta.md"
            if not delta_file.is_file():
                issues.append(f"missing required file: {rel(artifact_dir, delta_file)}")
                continue

            delta_text = read_text(delta_file)
            declared_version = version_delta_scalar(delta_text, "version")
            if declared_version != version_dir.name:
                issues.append(
                    f"{rel(artifact_dir, delta_file)} must declare '- version: {version_dir.name}'"
                )

            declared_based_on = version_delta_scalar(delta_text, "based_on")
            if index == 1:
                if declared_based_on is None or declared_based_on.lower() != "none":
                    issues.append(
                        f"{rel(artifact_dir, delta_file)} must declare '- based_on: none' for v1 baseline"
                    )
            else:
                previous_dir = semantic_by_index.get(index - 1)
                if previous_dir is None:
                    issues.append(
                        f"{rel(artifact_dir, delta_file)} cannot validate based_on because v{index-1} directory is missing"
                    )
                elif declared_based_on != previous_dir.name:
                    issues.append(
                        f"{rel(artifact_dir, delta_file)} must declare '- based_on: {previous_dir.name}'"
                    )
                baseline_bullets = section_bullets(delta_text, "Baseline Techniques Read")
                if not baseline_bullets:
                    issues.append(
                        f"{rel(artifact_dir, delta_file)} must include '## Baseline Techniques Read' with at least one bullet"
                    )
                elif previous_dir is not None and not references_prior_version(baseline_bullets, previous_dir.name):
                    issues.append(
                        f"{rel(artifact_dir, delta_file)} Baseline Techniques Read must reference {previous_dir.name} baseline artifact"
                    )
                if not section_bullets(delta_text, "New Techniques Introduced"):
                    issues.append(
                        f"{rel(artifact_dir, delta_file)} must include '## New Techniques Introduced' with at least one bullet"
                    )
                if not has_relative_optimizations(delta_text):
                    issues.append(
                        f"{rel(artifact_dir, delta_file)} must include '## Relative Optimizations' with at least one bullet"
                    )
                if not section_bullets(delta_text, "No-Regression Guards"):
                    issues.append(
                        f"{rel(artifact_dir, delta_file)} must include '## No-Regression Guards' with at least one bullet"
                    )
                if not section_bullets(delta_text, "Regression Check"):
                    issues.append(
                        f"{rel(artifact_dir, delta_file)} must include '## Regression Check' with at least one bullet"
                    )

    return issues


def experiment_version_policy_warn_issues(artifact_dir: Path) -> list[str]:
    experimental_root = artifact_dir / "experimental"
    if not experimental_root.is_dir():
        return []

    warns: list[str] = []
    experiment_dirs = sorted([path for path in experimental_root.iterdir() if path.is_dir()], key=lambda p: p.name)
    for experiment_dir in experiment_dirs:
        semantic_versions = [
            (semantic_version_index(entry.name), entry)
            for entry in sorted(experiment_dir.iterdir(), key=lambda p: p.name)
            if entry.is_dir() and semantic_version_index(entry.name) is not None
        ]
        semantic_versions = [(index, path) for index, path in semantic_versions if index is not None]
        if not semantic_versions:
            continue
        semantic_versions.sort(key=lambda item: (item[0], item[1].name))
        semantic_by_index = {index: path for index, path in semantic_versions}

        for index, version_dir in semantic_versions:
            if index <= 1:
                continue
            previous_dir = semantic_by_index.get(index - 1)
            if previous_dir is None:
                continue
            delta_file = version_dir / "version_delta.md"
            if not delta_file.is_file():
                continue
            baseline_bullets = section_bullets(read_text(delta_file), "Baseline Techniques Read")
            if not baseline_bullets:
                continue
            if not any(has_technique_keyword(item) for item in baseline_bullets):
                warns.append(
                    f"{rel(artifact_dir, delta_file)} Baseline Techniques Read does not explicitly mention techniques summary keywords; verify baseline mapping in agent review"
                )

    return warns


def expert_forum_hard_gate_issues(expert_forum_file: Path, artifact_dir: Path) -> list[str]:
    if not expert_forum_file.is_file():
        return [f"missing required file {expert_forum_file.name}"]

    text = read_text(expert_forum_file)
    frontmatter = extract_frontmatter(text)
    if frontmatter is None:
        return ["missing yaml frontmatter in expert_forum.md"]
    body_text = markdown_body_without_frontmatter(text)

    issues: list[str] = []
    stage_status = frontmatter_scalar(frontmatter, "stage_status")
    if stage_status not in {"pending", "in_progress", "complete", "blocked"}:
        issues.append("frontmatter stage_status is missing or invalid")

    forum_mode = frontmatter_scalar(frontmatter, "forum_mode")
    valid_modes = {"deep_dive_forum", "lightning_talk_forum", "industry_readout_forum"}
    if forum_mode is None:
        issues.append("frontmatter forum_mode is missing")
        forum_mode = ""
    elif forum_mode not in valid_modes:
        issues.append("frontmatter forum_mode must be deep_dive_forum, lightning_talk_forum, or industry_readout_forum")

    discussion_clear = frontmatter_scalar(frontmatter, "discussion_clear")
    if discussion_clear is None:
        issues.append("frontmatter discussion_clear is missing")
    elif discussion_clear.lower() != "true":
        issues.append("frontmatter discussion_clear must be true")

    user_review_status = frontmatter_scalar(frontmatter, "user_review_status")
    valid_user_review_status = {"pending", "approved", "changes_requested"}
    if user_review_status is None:
        issues.append("frontmatter user_review_status is missing")
    else:
        normalized_status = user_review_status.lower()
        if normalized_status not in valid_user_review_status:
            issues.append("frontmatter user_review_status must be pending, approved, or changes_requested")
        elif normalized_status != "approved":
            issues.append("frontmatter user_review_status must be approved before completion")

    final_one_liner = frontmatter_scalar(frontmatter, "final_one_liner")
    if final_one_liner is None:
        issues.append("frontmatter final_one_liner is missing")
    elif final_one_liner.strip() in {"", '""', "''", "TBD", "tbd"}:
        issues.append("frontmatter final_one_liner must be a concrete sentence")

    participants_count = frontmatter_list_count(frontmatter, "participants")
    if participants_count < 3:
        issues.append("participants must contain at least 3 experts")
    for participant_field in ("domain_identity", "frontier_focus", "decision_frame", "thinking_tilt"):
        if len(frontmatter_named_values(frontmatter, participant_field)) < participants_count:
            issues.append(f"participants must provide {participant_field} for each expert")

    key_issues_count = frontmatter_list_count(frontmatter, "key_issues")
    if key_issues_count < 1:
        issues.append("key_issues must contain at least 1 item")

    key_insights_count = frontmatter_list_count(frontmatter, "key_insights")
    if key_insights_count < 1:
        issues.append("key_insights must contain at least 1 item")

    for required_heading in ("详细结论", "背景和专家组介绍", "讨论过程"):
        if not heading_exists(body_text, required_heading):
            issues.append(f"required heading missing: {required_heading}")
    if not heading_exists(body_text, "用户评判与确认"):
        issues.append("required heading missing: 用户评判与确认")

    deep_or_lightning = forum_mode in {"deep_dive_forum", "lightning_talk_forum"}
    if deep_or_lightning:
        if not heading_exists(body_text, "专家检索与证据陈述"):
            issues.append("deep_dive_forum/lightning_talk_forum must include heading: 专家检索与证据陈述")
        if not heading_exists(body_text, "交叉评分（0~10）"):
            issues.append("deep_dive_forum/lightning_talk_forum must include heading: 交叉评分（0~10）")
        if not heading_exists(body_text, "实验设计与本地 MVP"):
            issues.append("deep_dive_forum/lightning_talk_forum must include heading: 实验设计与本地 MVP")
        if not heading_exists(body_text, "MVP验证结果（观点成立与工具可用）"):
            issues.append("deep_dive_forum or lightning_talk_forum must include heading: MVP验证结果（观点成立与工具可用）")
        if not heading_exists(body_text, "实验改动边界（强制）"):
            issues.append("deep_dive_forum/lightning_talk_forum must include heading: 实验改动边界（强制）")
        if not heading_exists(body_text, "认知边界声明"):
            issues.append("deep_dive_forum/lightning_talk_forum must include heading: 认知边界声明")
        evidence_data_rows = evidence_rows(body_text)
        if len(evidence_data_rows) < max(1, participants_count):
            issues.append("deep_dive_forum/lightning_talk_forum require one evidence row per participant")
        for row in evidence_data_rows:
            if len(row) < 6:
                issues.append("deep_dive_forum/lightning_talk_forum evidence rows must include published_at and authority columns")
                continue
            published_at = row[3].strip()
            authority = row[4].strip().lower()
            if not published_at or not YEAR_OR_DATE_RE.match(published_at):
                issues.append("deep_dive_forum/lightning_talk_forum evidence rows must provide published_at as YYYY or YYYY-MM-DD")
                break
            if not authority:
                issues.append("deep_dive_forum/lightning_talk_forum evidence rows must provide authority")
                break
        boundary_section = heading_section(body_text, "认知边界声明")
        participant_names = frontmatter_named_values(frontmatter, "name")
        for name in participant_names:
            if name and name not in boundary_section:
                issues.append(f"认知边界声明 must mention participant: {name}")
        if url_count(body_text) < max(1, participants_count):
            issues.append("deep_dive_forum/lightning_talk_forum require at least one cited URL per participant")
        if score_row_count(body_text) < max(1, participants_count):
            issues.append("deep_dive_forum/lightning_talk_forum require peer scoring rows with 0~10 scores")

    if experiment_bonus_points(artifact_dir) > 0 and not heading_exists(body_text, "实验附加分（1~5）"):
        issues.append("local experiments detected, but heading missing: 实验附加分（1~5）")

    return issues


def expert_forum_warn_issues(expert_forum_file: Path) -> list[str]:
    if not expert_forum_file.is_file():
        return []

    text = read_text(expert_forum_file)
    frontmatter = extract_frontmatter(text)
    if frontmatter is None:
        return []
    body_text = markdown_body_without_frontmatter(text)

    warns: list[str] = []
    personas = [match.group(1).strip().lower() for match in re.finditer(r"(?im)^\s*persona:\s*(.+?)\s*$", frontmatter)]
    thinking_tilts = [match.group(1).strip().lower() for match in re.finditer(r"(?im)^\s*thinking_tilt:\s*(.+?)\s*$", frontmatter)]
    persona_categories: set[str] = set()
    for label in [*personas, *thinking_tilts]:
        if any(keyword in label for keyword in ("deep", "rigor", "system", "research", "first-principles")):
            persona_categories.add("deep")
        if any(keyword in label for keyword in ("creative", "idea", "explore", "frontier", "design", "opportunity")):
            persona_categories.add("creative")
        if any(keyword in label for keyword in ("challeng", "critic", "devil", "skeptic", "risk", "red-team", "boundary")):
            persona_categories.add("challenger")
        if any(keyword in label for keyword in ("operator", "builder", "practice")):
            persona_categories.add("operator")
    if len(persona_categories) < 3:
        warns.append("thinking diversity heuristic detected fewer than 3 distinct expert modes; verify panel quality in agent review")

    participant_names = frontmatter_named_values(frontmatter, "name")
    for name in participant_names:
        if name and name not in body_text:
            warns.append(f"participant name not referenced in report body: {name}")
        if re.fullmatch(r"专家[A-Z]", name):
            warns.append(f"participant name still looks like a generic placeholder: {name}")

    forum_mode = frontmatter_scalar(frontmatter, "forum_mode")
    deep_or_lightning = forum_mode in {"deep_dive_forum", "lightning_talk_forum"}
    if deep_or_lightning:
        evidence_data_rows = evidence_rows(body_text)
        recommended_authorities = {"paper", "official_doc", "practice_report", "blog", "social"}
        present_authorities = {row[4].strip().lower() for row in evidence_data_rows if len(row) >= 5 and row[4].strip()}
        if present_authorities and present_authorities <= {"blog", "social"}:
            warns.append("no high-authority sources detected; verify paper/official_doc/practice_report coverage in agent review")
        unknown_authorities = sorted(present_authorities - recommended_authorities)
        if unknown_authorities:
            warns.append(f"authority values outside recommended set: {', '.join(unknown_authorities)}")
        recent_cutoff = current_utc_year() - 1
        has_recent_evidence = False
        for row in evidence_data_rows:
            if len(row) < 4:
                continue
            published_at = row[3].strip()
            if YEAR_OR_DATE_RE.match(published_at):
                if int(published_at[:4]) >= recent_cutoff:
                    has_recent_evidence = True
                    break
        if evidence_data_rows and not has_recent_evidence:
            warns.append("no clearly recent evidence rows detected; verify time-bound claims in agent review")
        if "源文改动：禁止" not in body_text and "源文改动: 禁止" not in body_text:
            warns.append("source-edit prohibition phrase not found verbatim; verify experiment boundary statement in agent review")
        if "仅限 `experimental/`" not in body_text and "仅限 experimental/" not in body_text:
            warns.append("experimental-only phrase not found verbatim; verify experiment boundary statement in agent review")
        if "观点成立验证" not in body_text:
            warns.append("claim validation phrase not found verbatim; verify evidence mapping in agent review")
        if "工具可用验证" not in body_text:
            warns.append("tool usability phrase not found verbatim; verify evidence mapping in agent review")
        boundary_section = heading_section(body_text, "认知边界声明")
        if boundary_section and not any(keyword in boundary_section for keyword in ("失效", "边界", "不确定", "前提", "条件")):
            warns.append("认知边界声明 section lacks explicit boundary keywords; verify failure-condition clarity in agent review")

    return warns


def read_status(path: Path) -> str:
    if not path.is_file():
        return "missing"
    text = read_text(path)
    frontmatter = extract_frontmatter(text)
    if frontmatter is not None:
        match = FRONTMATTER_STATUS_RE.search(frontmatter)
        if match:
            return match.group(1)
    match = STATUS_RE.search(text)
    if match:
        return match.group(1)
    legacy = LEGACY_STATUS_RE.search(text)
    if legacy:
        return legacy.group(1)
    return "unknown"


def clarification_status(path: Path) -> str:
    if not path.is_file():
        return "missing"
    text = read_text(path)
    match = CLARIFICATION_STATUS_RE.search(text)
    if not match:
        return "unknown"
    return match.group(1)


def question_card_blocks(input_text: str) -> list[tuple[str, str]]:
    section = heading_section(input_text, "Question Cards")
    cards: list[tuple[str, str]] = []
    current_id: str | None = None
    current_lines: list[str] = []
    for raw_line in section.splitlines():
        line = raw_line.rstrip()
        match = re.match(r"^\s*-\s+\*\*(Q-[0-9]+)\*\*:\s*(.*?)\s*$", line)
        if match:
            if current_id is not None:
                cards.append((current_id, "\n".join(current_lines).strip()))
            current_id = match.group(1).strip()
            current_lines = [match.group(2).strip()]
            continue
        if current_id is not None:
            current_lines.append(line)
    if current_id is not None:
        cards.append((current_id, "\n".join(current_lines).strip()))
    return cards


def question_card_header(card_block: str) -> str:
    lines = [line.strip() for line in card_block.splitlines()]
    if not lines:
        return ""
    header_lines: list[str] = []
    for line in lines:
        if not line:
            continue
        if line.startswith(">"):
            break
        if line == "---":
            continue
        header_lines.append(line)
    return " ".join(header_lines).strip()


def question_card_quote(card_block: str) -> str:
    quote_lines = []
    for line in card_block.splitlines()[1:]:
        stripped = line.strip()
        if stripped.startswith(">"):
            quote_lines.append(stripped[1:].strip())
    return "\n".join(item for item in quote_lines if item).strip()


def question_card_quote_lines(card_block: str) -> list[str]:
    return [
        stripped[1:].strip()
        for line in card_block.splitlines()[1:]
        if (stripped := line.strip()).startswith(">")
    ]


def no_question_reason(input_text: str) -> str:
    section = heading_section(input_text, "No-Question Path")
    value = block_scalar(section, "No clarification questions needed because")
    return value or ""


def raw_discussion_entry_blocks(raw_text: str) -> list[tuple[str, str]]:
    section = heading_section(raw_text, "Discussion Log")
    return [
        (title, block)
        for title, block in third_level_blocks(section)
        if title.startswith("Entry")
    ]


def raw_discussion_qa_bundles(raw_text: str) -> list[tuple[str, str]]:
    section = heading_section(raw_text, "Clarification QA Bundles")
    return [
        (title, block)
        for title, block in third_level_blocks(section)
        if title.startswith("Q-")
    ]


def require_filled_bullets(issues: list[str], block_name: str, block: str, labels: tuple[str, ...]) -> None:
    for label in labels:
        value = block_scalar(block, label)
        if value is None or not prompt_bullet_is_filled(value):
            issues.append(f"{block_name} missing filled field: {label}")


def input_and_qa_gate_issues(input_and_qa_file: Path) -> list[str]:
    if not input_and_qa_file.is_file():
        return [f"missing required file {input_and_qa_file.name}"]

    text = read_text(input_and_qa_file)
    issues: list[str] = []
    status = clarification_status(input_and_qa_file)
    if status == "unknown":
        issues.append("input_and_qa Clarification status is missing or invalid")
    elif status != "complete":
        issues.append("input_and_qa Clarification status must be complete before completion")

    if not heading_exists(text, "Clarification Loop"):
        issues.append("input_and_qa missing required heading: Clarification Loop")
    if not heading_exists(text, "Questioning Strategy"):
        issues.append("input_and_qa missing required heading: Questioning Strategy")
    if not heading_exists(text, "Question Cards"):
        issues.append("input_and_qa missing required heading: Question Cards")
    if not heading_exists(text, "No-Question Path"):
        issues.append("input_and_qa missing required heading: No-Question Path")

    cards = question_card_blocks(text)
    no_question = no_question_reason(text)
    question_cards_section = heading_section(text, "Question Cards")
    if cards and "[[Brainstorm]]" not in question_cards_section:
        issues.append("input_and_qa Question Cards missing [[Brainstorm]] marker")
    if not cards and not prompt_bullet_is_filled(no_question):
        issues.append("input_and_qa requires at least one question card or a filled No-Question Path rationale")
    strategy_section = heading_section(text, "Questioning Strategy")
    for expected_hint in ("Clarification gate", "First ask core framing questions", "Then ask dependency-unlocking questions"):
        if expected_hint not in strategy_section:
            issues.append(f"input_and_qa Questioning Strategy missing guidance: {expected_hint}")

    for title, block in cards:
        header = question_card_header(block)
        if not prompt_bullet_is_filled(header):
            issues.append(f"{title} missing readable question text")
        quote_lines = question_card_quote_lines(block)
        if not quote_lines:
            issues.append(f"{title} missing explanatory blockquote")
            continue
        if not any(line.startswith("问这个是因为") for line in quote_lines):
            issues.append(f"{title} missing '问这个是因为' line")
        if not any(line.startswith("得到答案后") for line in quote_lines):
            issues.append(f"{title} missing '得到答案后' line")
    return issues


def raw_discussion_log_gate_issues(raw_discussion_file: Path) -> list[str]:
    if not raw_discussion_file.is_file():
        return [f"missing required file {raw_discussion_file.name}"]

    text = read_text(raw_discussion_file)
    issues: list[str] = []
    if not heading_exists(text, "Capture Rules"):
        issues.append("raw_discussion_log missing required heading: Capture Rules")
    if not heading_exists(text, "Clarification QA Bundle Template"):
        issues.append("raw_discussion_log missing required heading: Clarification QA Bundle Template")
    if not heading_exists(text, "Clarification QA Bundles"):
        issues.append("raw_discussion_log missing required heading: Clarification QA Bundles")
    if not heading_exists(text, "Discussion Entry Template"):
        issues.append("raw_discussion_log missing required heading: Discussion Entry Template")
    if not heading_exists(text, "Discussion Log"):
        issues.append("raw_discussion_log missing required heading: Discussion Log")

    qa_bundles = raw_discussion_qa_bundles(text)
    entries = raw_discussion_entry_blocks(text)
    if not qa_bundles:
        issues.append("raw_discussion_log requires at least one Clarification QA bundle before completion")
    if not entries:
        issues.append("raw_discussion_log requires at least one Discussion Log entry before completion")

    for title, block in qa_bundles:
        require_filled_bullets(
            issues,
            title,
            block,
            (
                "Bundle kind",
                "Question pass",
                "Decision at stake",
                "Current hypotheses",
                "Asked at",
                "Asked by",
                "User-facing question",
                "Suggested answer shape",
                "Why this question was asked",
                "What this unlocks next",
                "Current answer",
                "Answered at",
                "Answered by",
                "Answer evidence",
                "State update",
                "Confidence after",
                "Question useful",
                "Answer useful",
                "Memory-safe restatement",
                "Canonical entities",
                "Resolved references",
                "Time anchors",
                "Source refs",
                "Next action",
            ),
        )
        bundle_kind = (block_scalar(block, "Bundle kind") or "").strip("` ").lower()
        if bundle_kind and bundle_kind not in {"clarification", "exploration", "diagnosis", "risk"}:
            issues.append(f"{title} has invalid Bundle kind: {bundle_kind}")
        question_pass = (block_scalar(block, "Question pass") or "").strip("` ").lower()
        if question_pass and question_pass not in {
            "frame",
            "blockers",
            "branch_splitters",
            "detail_expansion",
            "final_confirmation",
        }:
            issues.append(f"{title} has invalid Question pass: {question_pass}")

    for title, block in entries:
        if "<id>" in title.lower():
            issues.append("raw_discussion_log Discussion Log entry still uses placeholder id")
        require_filled_bullets(
            issues,
            title,
            block,
            (
                "Timestamp",
                "Recorder",
                "Stage",
                "Participants",
                "Entry type",
                "Speaker id",
                "Raw content (keep original wording as faithfully as practical)",
                "Memory-safe restatement",
                "Canonical entities",
                "Resolved references",
                "Time anchors",
                "Source refs",
                "Decision impact",
            ),
        )
        stage = (block_scalar(block, "Stage") or "").strip("` ").lower()
        if stage and stage not in {
            "input_and_qa",
            "finding_and_analyze",
            "expert_forum_review",
            "outcome_and_handoff",
        }:
            issues.append(f"{title} has invalid Stage: {stage}")
        entry_type = (block_scalar(block, "Entry type") or "").strip("` ").lower()
        if entry_type and entry_type not in {
            "user_question",
            "user_answer",
            "expert_claim",
            "expert_challenge",
            "convergence",
            "decision_update",
        }:
            issues.append(f"{title} has invalid Entry type: {entry_type}")
    return issues


def raw_discussion_log_warn_issues(raw_discussion_file: Path) -> list[str]:
    if not raw_discussion_file.is_file():
        return []

    text = read_text(raw_discussion_file)
    warns: list[str] = []
    qa_bundle_ids = [title for title, _ in raw_discussion_qa_bundles(text)]
    if not qa_bundle_ids:
        warns.append("raw_discussion_log does not yet record any QA bundle; verify clarification capture")
    entry_types = {
        (block_scalar(block, "Entry type") or "").strip("` ").lower()
        for _, block in raw_discussion_entry_blocks(text)
    }
    if entry_types and "decision_update" not in entry_types:
        warns.append("raw_discussion_log does not yet record a decision_update entry; verify final decision traceability")
    if entry_types and "expert_challenge" not in entry_types:
        warns.append("raw_discussion_log does not yet record an expert_challenge entry; verify disagreement capture")
    return warns


def source_trace_memory_warn_issues(path: Path, *, heading: str, labels: tuple[str, ...], scope_name: str) -> list[str]:
    if not path.is_file():
        return []

    text = read_text(path)
    if not heading_exists(text, heading):
        return [f"{scope_name} missing heading: {heading}"]

    section = heading_section(text, heading)
    warns: list[str] = []
    for label in labels:
        value = block_scalar(section, label)
        if value is None or not prompt_bullet_is_filled(value):
            warns.append(f"{scope_name} missing filled field under {heading}: {label}")
    return warns


def finding_and_analyze_warn_issues(finding_file: Path) -> list[str]:
    if not finding_file.is_file():
        return []

    text = read_text(finding_file)
    warns: list[str] = []
    frontier_bullets = section_bullets(text, "Frontier Context")
    filled_frontier_bullets = [item for item in frontier_bullets if prompt_bullet_is_filled(item)]
    if len(filled_frontier_bullets) < 3:
        warns.append("Frontier Context has fewer than 3 filled bullets; verify recent signals and failure case coverage")
    if not any(any(keyword in item.lower() for keyword in ("failure", "anti-pattern")) or "反例" in item or "失败" in item or "失效" in item for item in filled_frontier_bullets):
        warns.append("Frontier Context does not clearly record a failure case or anti-pattern")
    if re.search(r"(?im)^-\s*Primary:\s*$", text):
        warns.append("Recommended Direction primary choice is still empty")
    if re.search(r"(?im)^-\s*Fallback:\s*$", text):
        warns.append("Recommended Direction fallback choice is still empty")
    if re.search(r"(?im)^-\s*Why:\s*$", text):
        warns.append("Recommended Direction rationale is still empty")
    return warns


@dataclass
class StageItem:
    name: str
    file_name: str
    required: bool
    status: str


@dataclass
class StageSummary:
    items: list[StageItem]
    required_total: int
    required_complete: int
    next_stage: str


@dataclass
class ActionAdapter:
    adapter_id: str
    source_file: Path
    priority: int
    path_template: str
    target_template: str
    required_meta: tuple[str, ...]
    when_paths_exist: tuple[str, ...]


def summarize_stages(artifact_dir: Path) -> StageSummary:
    items: list[StageItem] = []
    for name, file_name in REQUIRED_STAGES:
        items.append(StageItem(name=name, file_name=file_name, required=True, status=read_status(artifact_dir / file_name)))
    for name, file_name in OPTIONAL_STAGES:
        status = read_status(artifact_dir / file_name)
        if status != "missing":
            items.append(StageItem(name=name, file_name=file_name, required=False, status=status))

    required_total = sum(1 for item in items if item.required)
    required_complete = sum(1 for item in items if item.required and item.status == "complete")
    next_stage = "all_required_stages_complete"
    for item in items:
        if item.required and item.status != "complete":
            next_stage = item.name
            break

    return StageSummary(items=items, required_total=required_total, required_complete=required_complete, next_stage=next_stage)


def parse_meta_entries(entries: list[str] | None) -> dict[str, str]:
    result: dict[str, str] = {}
    for raw in entries or []:
        if "=" not in raw:
            raise SystemExit(f"error: invalid --meta '{raw}', expected key=value")
        key, value = raw.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            raise SystemExit(f"error: invalid --meta '{raw}', key cannot be empty")
        result[key] = value
    return result


def template_fields(template: str) -> tuple[str, ...]:
    fields: list[str] = []
    for _, field_name, _, _ in Formatter().parse(template):
        if field_name:
            fields.append(field_name)
    seen: dict[str, None] = {}
    for item in fields:
        seen[item] = None
    return tuple(seen.keys())


def adapter_registry_dir(root: Path) -> Path:
    return brainstorm_root(root) / "adapters" / "action"


def load_action_adapters(root: Path) -> list[ActionAdapter]:
    registry = adapter_registry_dir(root)
    if not registry.is_dir():
        return []

    adapters: list[ActionAdapter] = []
    seen_ids: dict[str, Path] = {}
    for manifest in sorted(registry.glob("*.json")):
        try:
            data = json.loads(read_text(manifest))
        except json.JSONDecodeError:
            continue
        if not isinstance(data, dict):
            continue

        adapter_id = data.get("id")
        path_template = data.get("path_template")
        if not isinstance(adapter_id, str) or not adapter_id.strip():
            continue
        normalized_adapter_id = adapter_id.strip()
        if normalized_adapter_id in seen_ids:
            raise SystemExit(
                f"error: duplicate adapter id {normalized_adapter_id} declared in "
                f"{seen_ids[normalized_adapter_id]} and {manifest}"
            )
        seen_ids[normalized_adapter_id] = manifest
        if not isinstance(path_template, str) or not path_template.strip():
            continue

        priority_raw = data.get("priority", 100)
        try:
            priority = int(priority_raw)
        except (TypeError, ValueError):
            priority = 100

        target_template = data.get("target_template", adapter_id)
        if not isinstance(target_template, str) or not target_template.strip():
            target_template = adapter_id

        required_meta_raw = data.get("required_meta", [])
        required_meta: list[str] = []
        if isinstance(required_meta_raw, list):
            for item in required_meta_raw:
                if isinstance(item, str) and item.strip():
                    required_meta.append(item.strip())

        when_paths_exist_raw = data.get("when_paths_exist", [])
        when_paths_exist: list[str] = []
        if isinstance(when_paths_exist_raw, list):
            for item in when_paths_exist_raw:
                if isinstance(item, str) and item.strip():
                    when_paths_exist.append(item.strip())

        adapters.append(
            ActionAdapter(
                adapter_id=normalized_adapter_id,
                source_file=manifest,
                priority=priority,
                path_template=path_template.strip(),
                target_template=target_template.strip(),
                required_meta=tuple(required_meta),
                when_paths_exist=tuple(when_paths_exist),
            )
        )

    adapters.sort(key=lambda item: (-item.priority, item.adapter_id))
    return adapters


def resolve_action_adapter(
    adapter: ActionAdapter,
    root: Path,
    slug: str,
    topic: str,
    meta: dict[str, str],
) -> tuple[str | None, Path | None, list[str]]:
    issues: list[str] = []
    for raw_path in adapter.when_paths_exist:
        candidate = (root / raw_path).resolve()
        if not candidate.exists():
            issues.append(
                f"adapter {adapter.adapter_id} inactive: required path missing ({raw_path})"
            )

    missing_meta = [key for key in adapter.required_meta if not meta.get(key)]
    if missing_meta:
        issues.append(
            f"adapter {adapter.adapter_id} missing required meta: {', '.join(sorted(missing_meta))}"
        )

    context = {"slug": slug, "topic": topic, **meta}
    unresolved_fields: set[str] = set()
    for field in template_fields(adapter.path_template) + template_fields(adapter.target_template):
        value = context.get(field)
        if value is None or str(value).strip() == "":
            unresolved_fields.add(field)
    if unresolved_fields:
        issues.append(
            f"adapter {adapter.adapter_id} unresolved template field(s): {', '.join(sorted(unresolved_fields))}"
        )

    if issues:
        return None, None, issues

    try:
        path_rendered = adapter.path_template.format_map(context)
        target_rendered = adapter.target_template.format_map(context)
    except KeyError as exc:
        return None, None, [f"adapter {adapter.adapter_id} unresolved template field: {exc.args[0]}"]

    destination = Path(path_rendered)
    if not destination.is_absolute():
        destination = (root / destination).resolve()

    return target_rendered, destination, []


def load_topic(artifact_dir: Path, fallback_slug: str) -> str:
    input_file = artifact_dir / "input_and_qa.md"
    if input_file.is_file():
        lines = read_text(input_file).splitlines()
        if lines:
            first_line = lines[0].strip()
            if first_line.startswith("# Input and QA:"):
                candidate = first_line.replace("# Input and QA:", "", 1).strip()
                if candidate and not candidate.startswith("{{"):
                    return candidate

    legacy_task_plan = artifact_dir / "task_plan.md"
    if legacy_task_plan.is_file():
        lines = read_text(legacy_task_plan).splitlines()
        if lines:
            first_line = lines[0].strip()
            if first_line.startswith("# Task Plan:"):
                candidate = first_line.replace("# Task Plan:", "", 1).strip()
                if candidate and not candidate.startswith("{{"):
                    return candidate
    return fallback_slug.replace("-", " ")


def choose_local_action_path(root: Path, slug: str) -> Path:
    return brainstorm_root(root) / "outcome" / f"brainstorm-handoff-{slug}.md"


def choose_local_memory_path(root: Path, slug: str) -> Path:
    return brainstorm_root(root) / "outcome" / f"brainstorm-summary-{slug}.md"


def write_local_outcome(action_path: Path, topic: str, root: Path, artifact_dir: Path) -> None:
    outcome_source = artifact_dir / "outcome_and_handoff.md"
    analysis_source = artifact_dir / "finding_and_analyze.md"
    forum_source = artifact_dir / "expert_forum.md"
    input_source = artifact_dir / "input_and_qa.md"
    raw_discussion_source = artifact_dir / "raw_discussion_log.md"
    outcome_body = read_text(outcome_source) if outcome_source.is_file() else "No outcome_and_handoff.md found in artifact source."
    content = (
        f"# Brainstorm Handoff ({topic})\n\n"
        f"> Generated by bagakit-brainstorm fallback route.\n"
        f"> Source artifact: `{rel(root, artifact_dir)}`\n"
        "> Completion scope: analysis_and_handoff_only\n\n"
        "## Source Files\n"
        f"- input_and_qa: `{rel(root, input_source)}`\n"
        f"- raw_discussion_log: `{rel(root, raw_discussion_source)}`\n"
        f"- finding_and_analyze: `{rel(root, analysis_source)}`\n"
        f"- expert_forum: `{rel(root, forum_source)}`\n"
        f"- outcome_and_handoff: `{rel(root, outcome_source)}`\n\n"
        f"## Outcome and Handoff\n\n{outcome_body}\n"
        "## Memory Summary\n"
        "- Original discussion and raw turns were preserved in raw_discussion_log.md.\n"
        "- Input assumptions and constraints were captured and clarified.\n"
        "- Options were compared with a decision matrix and explicit fallback.\n"
        "- Expert forum evidence, scoring, and MVP notes were recorded.\n"
        "- Handoff destinations and completion gates were archived.\n"
    )
    write_text(action_path, content)


def write_driver_handoff(action_path: Path, topic: str, root: Path, artifact_dir: Path, target: str) -> None:
    outcome_source = artifact_dir / "outcome_and_handoff.md"
    finding_source = artifact_dir / "finding_and_analyze.md"
    forum_source = artifact_dir / "expert_forum.md"
    raw_discussion_source = artifact_dir / "raw_discussion_log.md"
    content = (
        f"# Brainstorm Handoff ({topic})\n\n"
        f"- Target: `{target}`\n"
        f"- Source outcome: `{rel(root, outcome_source)}`\n"
        f"- Source analysis: `{rel(root, finding_source)}`\n\n"
        f"- Source forum: `{rel(root, forum_source)}`\n\n"
        f"- Source raw discussion: `{rel(root, raw_discussion_source)}`\n\n"
        "## Checklist\n"
        "- [ ] Confirm scope boundaries and assumptions\n"
        "- [ ] Review raw_discussion_log.md for original question/answer and challenge context\n"
        "- [ ] Confirm expert forum conclusion and scoring rationale\n"
        "- [ ] Consume handoff checklist in outcome file\n"
        "- [ ] Feed execution results back to durable memory\n"
    )
    write_text(action_path, content)


def write_local_summary(memory_path: Path, topic: str, root: Path, artifact_dir: Path) -> None:
    outcome_source = artifact_dir / "outcome_and_handoff.md"
    analysis_source = artifact_dir / "finding_and_analyze.md"
    forum_source = artifact_dir / "expert_forum.md"
    raw_discussion_source = artifact_dir / "raw_discussion_log.md"
    content = (
        f"# Brainstorm Summary ({topic})\n\n"
        f"- Source outcome: `{rel(root, outcome_source)}`\n"
        f"- Source analysis: `{rel(root, analysis_source)}`\n\n"
        f"- Source forum: `{rel(root, forum_source)}`\n\n"
        f"- Source raw discussion: `{rel(root, raw_discussion_source)}`\n\n"
        "## Key Points\n"
        "- Raw discussion trail preserved for later audit and replay.\n"
        "- Input and constraints validated.\n"
        "- Options compared with an explicit decision matrix.\n"
        "- Expert forum reviewed references and cross-scoring.\n"
        "- Outcome/handoff documented with explicit destination.\n"
    )
    write_text(memory_path, content)


def resolve_archive_json_path(root: Path, artifact_dir: Path) -> Path:
    direct = artifact_dir / "archive.json"
    if direct.is_file():
        return direct
    counterpart = archive_root(root) / artifact_dir.name / "archive.json"
    return counterpart


def load_existing_archive_payload(root: Path, artifact_dir: Path) -> dict[str, object] | None:
    archive_json = resolve_archive_json_path(root, artifact_dir)
    if not archive_json.is_file():
        return None
    try:
        payload = json.loads(read_text(archive_json))
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, dict):
        return None
    return payload


def cmd_init(args: argparse.Namespace) -> int:
    topic = args.topic.strip()
    if not topic:
        raise SystemExit("error: --topic is required")

    slug = args.slug or slugify(topic)
    goal = args.goal or f"Deliver a validated brainstorm analysis and handoff for {topic}."
    source_hint = args.source_hint or "Provide markdown files or inline snippets."
    date = utc_day()

    root = Path(args.root).expanduser().resolve()
    artifact_name = f"{utc_compact_stamp()}--{slug}"
    artifact_dir = ensure_unique_dir(runs_root(root) / artifact_name)
    artifact_dir.mkdir(parents=True, exist_ok=False)

    replacements = {
        "{{TOPIC}}": topic,
        "{{GOAL}}": goal,
        "{{SOURCE_HINT}}": source_hint,
        "{{DATE}}": date,
    }
    template_dir = Path(__file__).resolve().parents[1] / "references" / "tpl"
    created_files: list[Path] = []
    for template_name, output_name in (
        ("input_and_qa.md", "input_and_qa.md"),
        ("raw_discussion_log.md", "raw_discussion_log.md"),
        ("finding_and_analyze.md", "finding_and_analyze.md"),
        ("expert_forum.md", "expert_forum.md"),
        ("outcome_and_handoff.md", "outcome_and_handoff.md"),
    ):
        output = artifact_dir / output_name
        render_template(template_dir / template_name, output, replacements)
        created_files.append(output)

    if args.with_related_insights:
        output = artifact_dir / "related_insights.md"
        render_template(template_dir / "related_insights.md", output, replacements)
        created_files.append(output)
    if args.with_review_quality:
        output = artifact_dir / "review_quality.md"
        render_template(template_dir / "review_quality.md", output, replacements)
        created_files.append(output)
    if args.with_eval_effect_review:
        output = artifact_dir / "eval_effect_review.md"
        render_template(template_dir / "eval_effect_review.md", output, replacements)
        created_files.append(output)
    print(f"created={artifact_dir}")
    print("files:")
    for file in created_files:
        print(f"  - {file}")
    print(
        "next=fill input_and_qa.md, append raw_discussion_log.md as discussion happens, then finding_and_analyze.md, then expert_forum.md, then outcome_and_handoff.md"
    )
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    root = Path(args.root).expanduser().resolve()
    artifact_dir = resolve_artifact_dir(root, args.dir, allow_archive_lookup=True)
    summary = summarize_stages(artifact_dir)
    expert_forum_file = artifact_dir / "expert_forum.md"
    input_and_qa_file = artifact_dir / "input_and_qa.md"
    raw_discussion_file = artifact_dir / "raw_discussion_log.md"
    expert_forum_hard_issues = expert_forum_hard_gate_issues(artifact_dir / "expert_forum.md", artifact_dir)
    expert_forum_warns = expert_forum_warn_issues(artifact_dir / "expert_forum.md")
    input_and_qa_issues = input_and_qa_gate_issues(input_and_qa_file)
    raw_discussion_issues = raw_discussion_log_gate_issues(raw_discussion_file)
    raw_discussion_warns = raw_discussion_log_warn_issues(raw_discussion_file)
    finding_warns = finding_and_analyze_warn_issues(artifact_dir / "finding_and_analyze.md")
    finding_memory_warns = source_trace_memory_warn_issues(
        artifact_dir / "finding_and_analyze.md",
        heading="Source Trace and Memory Safety",
        labels=("Question cards", "Raw discussion entry refs", "Canonical entity names", "Time anchors or absolute dates"),
        scope_name="finding_and_analyze",
    )
    forum_memory_warns = source_trace_memory_warn_issues(
        artifact_dir / "expert_forum.md",
        heading="Source Trace And Memory Safety",
        labels=(
            "原始讨论条目引用（`Entry ###`）",
            "关键 question card 引用（`Q-###`）",
            "关键实体的 canonical 名称与消歧说明",
            "相对时间短语及其绝对锚点",
            "引述与转述说明（quote / paraphrase）",
        ),
        scope_name="expert_forum",
    )
    outcome_memory_warns = source_trace_memory_warn_issues(
        artifact_dir / "outcome_and_handoff.md",
        heading="Memory and Provenance",
        labels=(
            "Raw discussion entry refs",
            "Question card refs",
            "Forum refs",
            "Canonical entity names",
            "Time anchors or absolute dates",
            "Quote/paraphrase note",
        ),
        scope_name="outcome_and_handoff",
    )
    clarification = clarification_status(input_and_qa_file)
    experiment_items = experiment_count(artifact_dir)
    bonus_points = experiment_bonus_points(artifact_dir)
    version_policy_hard_issues = experiment_version_policy_hard_issues(artifact_dir)
    version_policy_warns = experiment_version_policy_warn_issues(artifact_dir)
    placeholder_hard_issues = artifact_placeholder_hard_issues(artifact_dir)
    forum_mode = "unknown"
    user_review_status = "unknown"
    if expert_forum_file.is_file():
        frontmatter = extract_frontmatter(read_text(expert_forum_file))
        if frontmatter is not None:
            forum_mode = frontmatter_scalar(frontmatter, "forum_mode") or "unknown"
            user_review_status = frontmatter_scalar(frontmatter, "user_review_status") or "unknown"
    archive_json = resolve_archive_json_path(root, artifact_dir)
    archive_status = "missing"
    if archive_json.is_file():
        try:
            archive_status = str(json.loads(read_text(archive_json)).get("status", "unknown"))
        except json.JSONDecodeError:
            archive_status = "invalid-json"

    print(f"artifact_dir={artifact_dir}")
    print(f"artifact_scope={classify_artifact_scope(root, artifact_dir)}")
    print(f"required_total={summary.required_total}")
    print(f"required_complete={summary.required_complete}")
    print(f"next_stage={summary.next_stage}")
    print(f"input_and_qa_clarification_status={clarification}")
    print(f"input_and_qa_gate={'pass' if not input_and_qa_issues else 'fail'}")
    for issue in input_and_qa_issues:
        print(f"input_and_qa_issue={issue}")
    for item in summary.items:
        print(f"stage_{item.name}={item.status}")
    print(f"support_raw_discussion_log={read_status(raw_discussion_file)}")
    print(f"raw_discussion_log_gate={'pass' if not raw_discussion_issues else 'fail'}")
    for issue in raw_discussion_issues:
        print(f"raw_discussion_log_issue={issue}")
    print(f"raw_discussion_log_warn_count={len(raw_discussion_warns)}")
    for warn in raw_discussion_warns:
        print(f"raw_discussion_log_warn={warn}")
    print(f"finding_and_analyze_warn_count={len(finding_warns)}")
    for warn in finding_warns:
        print(f"finding_and_analyze_warn={warn}")
    print(f"memory_quality_warn_count={len(finding_memory_warns) + len(forum_memory_warns) + len(outcome_memory_warns)}")
    for warn in finding_memory_warns:
        print(f"memory_quality_warn={warn}")
    for warn in forum_memory_warns:
        print(f"memory_quality_warn={warn}")
    for warn in outcome_memory_warns:
        print(f"memory_quality_warn={warn}")
    print(f"expert_forum_mode={forum_mode}")
    print(f"expert_forum_user_review_status={user_review_status}")
    print(f"expert_forum_gate={'pass' if not expert_forum_hard_issues else 'fail'}")
    for issue in expert_forum_hard_issues:
        print(f"expert_forum_issue={issue}")
    print(f"expert_forum_warn_count={len(expert_forum_warns)}")
    for warn in expert_forum_warns:
        print(f"expert_forum_warn={warn}")
    print(f"experiment_count={experiment_items}")
    print(f"experiment_bonus_points={bonus_points}")
    print(f"experiment_version_policy={'pass' if not version_policy_hard_issues else 'fail'}")
    for issue in version_policy_hard_issues:
        print(f"experiment_version_issue={issue}")
    print(f"experiment_version_warn_count={len(version_policy_warns)}")
    for warn in version_policy_warns:
        print(f"experiment_version_warn={warn}")
    print(f"artifact_content_gate={'pass' if not placeholder_hard_issues else 'fail'}")
    for issue in placeholder_hard_issues:
        print(f"artifact_content_issue={issue}")
    print(f"archive_status={archive_status}")
    return 0


def cmd_archive(args: argparse.Namespace) -> int:
    root = Path(args.root).expanduser().resolve()
    artifact_dir = resolve_artifact_dir(root, args.dir, allow_archive_lookup=True)
    artifact_scope_before = classify_artifact_scope(root, artifact_dir)

    missing_required = [file_name for _, file_name in REQUIRED_STAGES if not (artifact_dir / file_name).is_file()]
    missing_required.extend(
        file_name for _, file_name in REQUIRED_SUPPORT_FILES if not (artifact_dir / file_name).is_file()
    )
    if missing_required:
        raise SystemExit(f"error: missing required artifact file(s): {', '.join(missing_required)}")

    slug = args.slug or artifact_slug(artifact_dir.name)
    topic = args.topic or load_topic(artifact_dir, slug)
    adapters = load_action_adapters(root)
    adapter_ids = [adapter.adapter_id for adapter in adapters]
    meta = parse_meta_entries(args.meta)

    selected_driver = args.driver
    resolved_driver = selected_driver
    route_kind = "adapter" if selected_driver == "adapter" else "local"

    unresolved_reasons: list[str] = []
    non_blocking_warnings: list[str] = []
    action_target = "<unresolved>" if selected_driver == "adapter" else "local-outcome"
    action_path: Path | None = None
    resolved_adapter_id: str | None = None
    stage_summary = summarize_stages(artifact_dir)
    required_stages_complete = stage_summary.required_complete == stage_summary.required_total
    if not required_stages_complete:
        unresolved_reasons.append(
            f"required stages incomplete: {stage_summary.required_complete}/{stage_summary.required_total}"
        )
        for item in stage_summary.items:
            if item.required and item.status != "complete":
                unresolved_reasons.append(f"required stage not complete: {item.name}={item.status}")
    input_and_qa_issues = input_and_qa_gate_issues(artifact_dir / "input_and_qa.md")
    input_and_qa_clear = not input_and_qa_issues
    for issue in input_and_qa_issues:
        unresolved_reasons.append(f"input_and_qa_gate: {issue}")
    raw_discussion_issues = raw_discussion_log_gate_issues(artifact_dir / "raw_discussion_log.md")
    raw_discussion_clear = not raw_discussion_issues
    raw_discussion_warns = raw_discussion_log_warn_issues(artifact_dir / "raw_discussion_log.md")
    for issue in raw_discussion_issues:
        unresolved_reasons.append(f"raw_discussion_log_gate: {issue}")
    expert_forum_hard_issues = expert_forum_hard_gate_issues(artifact_dir / "expert_forum.md", artifact_dir)
    expert_forum_clear = not expert_forum_hard_issues
    expert_forum_warns = expert_forum_warn_issues(artifact_dir / "expert_forum.md")
    finding_warns = finding_and_analyze_warn_issues(artifact_dir / "finding_and_analyze.md")
    finding_memory_warns = source_trace_memory_warn_issues(
        artifact_dir / "finding_and_analyze.md",
        heading="Source Trace and Memory Safety",
        labels=("Question cards", "Raw discussion entry refs", "Canonical entity names", "Time anchors or absolute dates"),
        scope_name="finding_and_analyze",
    )
    forum_memory_warns = source_trace_memory_warn_issues(
        artifact_dir / "expert_forum.md",
        heading="Source Trace And Memory Safety",
        labels=(
            "原始讨论条目引用（`Entry ###`）",
            "关键 question card 引用（`Q-###`）",
            "关键实体的 canonical 名称与消歧说明",
            "相对时间短语及其绝对锚点",
            "引述与转述说明（quote / paraphrase）",
        ),
        scope_name="expert_forum",
    )
    outcome_memory_warns = source_trace_memory_warn_issues(
        artifact_dir / "outcome_and_handoff.md",
        heading="Memory and Provenance",
        labels=(
            "Raw discussion entry refs",
            "Question card refs",
            "Forum refs",
            "Canonical entity names",
            "Time anchors or absolute dates",
            "Quote/paraphrase note",
        ),
        scope_name="outcome_and_handoff",
    )
    user_review_approved = False
    expert_forum_file = artifact_dir / "expert_forum.md"
    if expert_forum_file.is_file():
        frontmatter = extract_frontmatter(read_text(expert_forum_file))
        if frontmatter is not None:
            user_review_approved = (frontmatter_scalar(frontmatter, "user_review_status") or "").lower() == "approved"
    for issue in expert_forum_hard_issues:
        unresolved_reasons.append(f"expert_forum_gate: {issue}")
    for warn in finding_warns:
        non_blocking_warnings.append(f"finding_and_analyze_warn: {warn}")
    for warn in finding_memory_warns:
        non_blocking_warnings.append(f"memory_quality_warn: {warn}")
    for warn in raw_discussion_warns:
        non_blocking_warnings.append(f"raw_discussion_log_warn: {warn}")
    for warn in expert_forum_warns:
        non_blocking_warnings.append(f"expert_forum_warn: {warn}")
    for warn in forum_memory_warns:
        non_blocking_warnings.append(f"memory_quality_warn: {warn}")
    for warn in outcome_memory_warns:
        non_blocking_warnings.append(f"memory_quality_warn: {warn}")

    version_policy_hard_issues = experiment_version_policy_hard_issues(artifact_dir)
    version_policy_warns = experiment_version_policy_warn_issues(artifact_dir)
    for issue in version_policy_hard_issues:
        unresolved_reasons.append(f"experiment_version_policy: {issue}")
    for warn in version_policy_warns:
        non_blocking_warnings.append(f"experiment_version_warn: {warn}")
    placeholder_hard_issues = artifact_placeholder_hard_issues(artifact_dir)
    for issue in placeholder_hard_issues:
        unresolved_reasons.append(f"artifact_content_gate: {issue}")

    if selected_driver == "auto":
        for adapter in adapters:
            target, path, issues = resolve_action_adapter(adapter, root, slug, topic, meta)
            if issues:
                for issue in issues:
                    non_blocking_warnings.append(f"auto route: {issue}; fallback to next adapter")
                continue
            if target is None or path is None:
                continue
            action_target = target
            action_path = path
            resolved_driver = "adapter"
            route_kind = "adapter"
            resolved_adapter_id = adapter.adapter_id
            break
        if action_path is None:
            action_target = "local-outcome"
            action_path = choose_local_action_path(root, slug)
            resolved_driver = "local"
    elif selected_driver == "adapter":
        resolved_driver = "adapter"
        adapter_id = (args.adapter_id or "").strip()
        if not adapter_id:
            unresolved_reasons.append("driver adapter selected but --adapter-id is missing")
        else:
            candidate = next((item for item in adapters if item.adapter_id == adapter_id), None)
            if candidate is None:
                unresolved_reasons.append(f"adapter {adapter_id} not found under {rel(root, adapter_registry_dir(root))}")
            else:
                target, path, issues = resolve_action_adapter(candidate, root, slug, topic, meta)
                if issues:
                    for issue in issues:
                        unresolved_reasons.append(f"adapter route: {issue}")
                elif target is not None and path is not None:
                    action_target = target
                    action_path = path
                    resolved_adapter_id = candidate.adapter_id
                    route_kind = "adapter"
    else:
        resolved_driver = "local"
        action_target = "local-outcome"
        action_path = choose_local_action_path(root, slug)

    memory_path: Path | None
    if route_kind == "local":
        memory_target = "local-outcome-unified"
        memory_path = action_path if action_path is not None else choose_local_action_path(root, slug)
    elif action_path is None:
        memory_target = "<unresolved>"
        memory_path = None
    else:
        memory_target = "local-summary"
        memory_path = choose_local_memory_path(root, slug)

    target_dir: Path | None = None
    if not unresolved_reasons and artifact_scope_before != "archive":
        candidate = archive_root(root) / artifact_dir.name
        if candidate.exists():
            unresolved_reasons.append(f"archive destination already exists: {candidate}")
        else:
            target_dir = candidate

    moved = False
    original_artifact = artifact_dir
    if not unresolved_reasons and target_dir is not None:
        target_dir.parent.mkdir(parents=True, exist_ok=True)
        artifact_dir.rename(target_dir)
        artifact_dir = target_dir
        moved = True

    if action_path is not None and not unresolved_reasons:
        if route_kind == "local":
            write_local_outcome(action_path, topic, root, artifact_dir)
        else:
            write_driver_handoff(action_path, topic, root, artifact_dir, action_target)

    if not unresolved_reasons and route_kind != "local":
        write_local_summary(memory_path, topic, root, artifact_dir)

    complete = not unresolved_reasons and action_path is not None and memory_path is not None and memory_path.is_file()

    status = "complete" if complete else "blocked"
    action_path_str = rel(root, action_path) if action_path else "<unresolved>"
    memory_path_str = rel(root, memory_path) if memory_path is not None else "<unresolved>"
    action_destination_resolved = action_path is not None
    memory_destination_resolved = memory_path is not None and memory_path.is_file()
    experiment_items = experiment_count(artifact_dir)
    bonus_points = experiment_bonus_points(artifact_dir)
    existing_archive_payload = load_existing_archive_payload(root, artifact_dir) if artifact_scope_before == "archive" else None
    source_artifact_value = rel(root, original_artifact)
    if existing_archive_payload is not None:
        previous_source_artifact = existing_archive_payload.get("source_artifact")
        if isinstance(previous_source_artifact, str) and previous_source_artifact.strip():
            source_artifact_value = previous_source_artifact

    archive_md = artifact_dir / "archive.md"
    archive_json = artifact_dir / "archive.json"
    md_lines = [
        f"# Brainstorm Archive ({topic})",
        "",
        f"- status: `{status}`",
        f"- source_artifact: `{source_artifact_value}`",
        f"- archived_artifact: `{rel(root, artifact_dir)}`",
        f"- artifact_moved: `{str(moved).lower()}`",
        f"- selected_driver: `{selected_driver}`",
        f"- resolved_driver: `{resolved_driver}`",
        f"- resolved_adapter: `{resolved_adapter_id or 'none'}`",
        f"- detected_adapters: `{', '.join(adapter_ids) if adapter_ids else 'none'}`",
        "",
        "## Action Handoff",
        f"- target: `{action_target}`",
        f"- destination: `{action_path_str}`",
        "",
        "## Memory Handoff",
        f"- target: `{memory_target}`",
        f"- destination: `{memory_path_str}`",
        f"- policy: `{'single local handoff under .bagakit/brainstorm/outcome/' if route_kind == 'local' else ('local summary fallback under .bagakit/brainstorm/outcome/' if memory_path is not None else 'adapter route unresolved; no fallback published')}`",
        "",
        "## Completion Definition",
        "- Brainstorm completion means analysis and handoff are complete.",
        "- Execution of downstream implementation is out of scope for this completion gate.",
        "",
        "## Archive Gate Checklist",
        f"- [x] Required stages complete: `{str(required_stages_complete).lower()}`",
        f"- [x] Input clarification gate clear: `{str(input_and_qa_clear).lower()}`",
        f"- [x] Raw discussion log gate clear: `{str(raw_discussion_clear).lower()}`",
        f"- [x] Expert forum gate clear: `{str(expert_forum_clear).lower()}`",
        f"- [x] User review approved: `{str(user_review_approved).lower()}`",
        f"- [x] Action destination resolved: `{str(action_destination_resolved).lower()}`",
        f"- [x] Memory destination resolved: `{str(memory_destination_resolved).lower()}`",
        "- [x] Archive record written: `true`",
        f"- [x] Artifact moved to archive on complete: `{str(complete and moved).lower()}`",
        f"- [x] Local experiment count: `{experiment_items}`",
        f"- [x] Experiment bonus points (1~5): `{bonus_points}`",
    ]
    if unresolved_reasons:
        md_lines.extend(["", "## Blocking Reasons", *[f"- {item}" for item in unresolved_reasons]])
    if non_blocking_warnings:
        md_lines.extend(["", "## Non-Blocking Warnings", *[f"- {item}" for item in non_blocking_warnings]])
    write_text(archive_md, "\n".join(md_lines) + "\n")

    payload = {
        "version": 2,
        "status": status,
        "topic": topic,
        "source_artifact": source_artifact_value,
        "archived_artifact": rel(root, artifact_dir),
        "artifact_moved": moved,
        "driver": {
            "selected": selected_driver,
            "resolved": resolved_driver,
            "resolved_adapter": resolved_adapter_id,
            "route_kind": route_kind,
            "detected_adapters": adapter_ids,
            "meta": meta,
        },
        "handoff": {
            "action": {"target": action_target, "path": action_path_str},
            "memory": {"target": memory_target, "path": memory_path_str},
        },
        "checks": {
            "required_stages_complete": required_stages_complete,
            "input_and_qa_gate_clear": input_and_qa_clear,
            "raw_discussion_log_gate_clear": raw_discussion_clear,
            "expert_forum_gate_clear": expert_forum_clear,
            "experiment_version_policy_clear": not version_policy_hard_issues,
            "artifact_content_gate_clear": not placeholder_hard_issues,
            "user_review_approved": user_review_approved,
            "action_destination_resolved": action_destination_resolved,
            "memory_destination_resolved": memory_destination_resolved,
            "archive_written": True,
            "artifact_moved_on_complete": complete and (moved or classify_artifact_scope(root, artifact_dir) == "archive"),
            "experiment_count": experiment_items,
            "experiment_bonus_points": bonus_points,
        },
        "blocking_reasons": unresolved_reasons,
        "non_blocking_warnings": non_blocking_warnings,
    }
    write_text(archive_json, json.dumps(payload, indent=2, ensure_ascii=False) + "\n")

    print(f"archive_dir={artifact_dir}")
    print(f"status={status}")
    print(f"artifact_moved={str(moved).lower()}")
    print(f"action_target={action_target}")
    print(f"action_path={action_path_str}")
    print(f"selected_driver={selected_driver}")
    print(f"resolved_driver={resolved_driver}")
    print(f"resolved_adapter={resolved_adapter_id or 'none'}")
    print(f"memory_target={memory_target}")
    print(f"memory_path={memory_path_str}")
    print(f"experiment_count={experiment_items}")
    print(f"experiment_bonus_points={bonus_points}")
    print(f"warning_count={len(non_blocking_warnings)}")
    for warn in non_blocking_warnings:
        print(f"warn={warn}")
    if unresolved_reasons:
        for reason in unresolved_reasons:
            print(f"blocked_reason={reason}")
        return 1
    return 0


def completion_gate_issues(root: Path, artifact_dir: Path) -> list[str]:
    issues: list[str] = []
    summary = summarize_stages(artifact_dir)
    if summary.required_total <= 0:
        issues.append("required stage count is zero")
        return issues
    if summary.required_complete != summary.required_total:
        issues.append(f"required stages incomplete: {summary.required_complete}/{summary.required_total}")
        for item in summary.items:
            if item.required and item.status != "complete":
                issues.append(f"required stage not complete: {item.name}={item.status}")

    issues.extend(f"input_and_qa_gate: {issue}" for issue in input_and_qa_gate_issues(artifact_dir / "input_and_qa.md"))
    issues.extend(
        f"raw_discussion_log_gate: {issue}"
        for issue in raw_discussion_log_gate_issues(artifact_dir / "raw_discussion_log.md")
    )
    issues.extend(
        f"expert_forum_gate: {issue}"
        for issue in expert_forum_hard_gate_issues(artifact_dir / "expert_forum.md", artifact_dir)
    )
    issues.extend(
        f"experiment_version_policy: {issue}"
        for issue in experiment_version_policy_hard_issues(artifact_dir)
    )
    issues.extend(
        f"artifact_content_gate: {issue}"
        for issue in artifact_placeholder_hard_issues(artifact_dir)
    )

    archive_json = resolve_archive_json_path(root, artifact_dir)
    if not archive_json.is_file():
        issues.append(f"missing archive record: {archive_json}")
        return issues
    try:
        archive = json.loads(read_text(archive_json))
    except json.JSONDecodeError:
        issues.append(f"invalid archive json: {archive_json}")
        return issues
    if archive.get("status") != "complete":
        issues.append(f"archive status is not complete: {archive.get('status', 'unknown')}")
        return issues
    checks = archive.get("checks")
    if not isinstance(checks, dict):
        issues.append("archive checks are missing or invalid")
        return issues
    required_archive_checks = (
        "required_stages_complete",
        "input_and_qa_gate_clear",
        "raw_discussion_log_gate_clear",
        "expert_forum_gate_clear",
        "action_destination_resolved",
        "memory_destination_resolved",
        "archive_written",
    )
    for key in required_archive_checks:
        if checks.get(key) is not True:
            issues.append(f"archive check failed: {key}={checks.get(key)}")
    archived_artifact = archive.get("archived_artifact")
    if not isinstance(archived_artifact, str) or not archived_artifact.strip():
        issues.append("archive archived_artifact is missing")
    else:
        archived_artifact_path = (root / archived_artifact).resolve()
        if not archived_artifact_path.is_dir():
            issues.append(f"archived artifact dir missing: {archived_artifact_path}")
    handoff = archive.get("handoff")
    if not isinstance(handoff, dict):
        issues.append("archive handoff is missing or invalid")
    else:
        for handoff_key in ("action", "memory"):
            handoff_entry = handoff.get(handoff_key)
            if not isinstance(handoff_entry, dict):
                issues.append(f"archive handoff {handoff_key} is missing or invalid")
                continue
            handoff_path = handoff_entry.get("path")
            if not isinstance(handoff_path, str) or not handoff_path.strip() or handoff_path == "<unresolved>":
                issues.append(f"archive handoff {handoff_key} path is unresolved")
                continue
            resolved_handoff_path = (root / handoff_path).resolve()
            if not resolved_handoff_path.is_file():
                issues.append(f"archive handoff {handoff_key} file missing: {resolved_handoff_path}")
    return issues


def derive_planning_entry_handoff_payload(
    *,
    root: Path,
    artifact_dir: Path,
    topic: str,
    slug: str,
    scene: str,
    recipe_id: str,
    title_override: str | None,
    goal_override: str | None,
    objective_override: str | None,
    demand_summary_override: str | None,
    handoff_id_override: str | None,
) -> dict[str, object]:
    input_text = read_text(artifact_dir / "input_and_qa.md")
    outcome_text = read_text(artifact_dir / "outcome_and_handoff.md")
    forum_text = read_text(artifact_dir / "expert_forum.md")

    goal_snapshot_bullets = section_bullets(input_text, "Goal Snapshot")
    goal_snapshot = goal_snapshot_bullets[0] if goal_snapshot_bullets else ""
    outcome_summary = heading_section(outcome_text, "Outcome Summary")
    chosen_direction = nested_bullets_after_label(outcome_summary, "Chosen direction")
    expected_outcome = nested_bullets_after_label(outcome_summary, "Expected outcome")
    scope_success_section = heading_section(input_text, "Scope and Success Criteria")
    assumptions_constraints_section = heading_section(input_text, "Assumptions and Constraints")
    success_criteria = labeled_scalar_or_nested_bullets(scope_success_section, "Success criteria")
    constraints = labeled_scalar_or_nested_bullets(assumptions_constraints_section, "Constraints")
    if not success_criteria:
        raise SystemExit("error: could not derive success criteria from input_and_qa.md")
    if not constraints:
        raise SystemExit("error: could not derive constraints from input_and_qa.md")

    clarification = clarification_status(artifact_dir / "input_and_qa.md")
    if clarification == "unknown":
        raise SystemExit("error: could not derive clarification status from input_and_qa.md")
    frontmatter = extract_frontmatter(forum_text)
    if frontmatter is None:
        raise SystemExit("error: expert_forum.md frontmatter is missing")
    discussion_clear = (frontmatter_scalar(frontmatter, "discussion_clear") or "").lower() == "true"
    user_review_status = frontmatter_scalar(frontmatter, "user_review_status") or "pending"

    title = (title_override or "").strip() or topic
    objective = (objective_override or "").strip() or goal_snapshot
    goal = (goal_override or "").strip() or (expected_outcome[0] if expected_outcome else objective)
    demand_summary = (demand_summary_override or "").strip() or (chosen_direction[0] if chosen_direction else goal_snapshot)
    if not objective:
        raise SystemExit("error: could not derive objective; pass --objective")
    if not goal:
        raise SystemExit("error: could not derive goal; pass --goal")
    if not demand_summary:
        raise SystemExit("error: could not derive demand summary; pass --demand-summary")

    return {
        "schema": PLANNING_ENTRY_HANDOFF_SCHEMA,
        "handoff_id": (handoff_id_override or "").strip() or f"peh-{slug}",
        "status": "approved",
        "producer_surface": "bagakit-brainstorm",
        "title": title,
        "goal": goal,
        "objective": objective,
        "demand_summary": demand_summary,
        "success_criteria": success_criteria,
        "constraints": constraints,
        "clarification_status": clarification,
        "discussion_clear": discussion_clear,
        "user_review_status": user_review_status,
        "recommended_route": {
            "scene": scene,
            "recipe_id": recipe_id,
        },
        "source_artifacts": [
            rel(root, artifact_dir / "input_and_qa.md"),
            rel(root, artifact_dir / "expert_forum.md"),
            rel(root, artifact_dir / "outcome_and_handoff.md"),
        ],
        "source_refs": [
            first_question_card_ref(input_text),
            "expert_forum.md#Decision-Target-And-Exit",
            "outcome_and_handoff.md#Outcome-Summary",
        ],
    }


def cmd_export_planning_entry_handoff(args: argparse.Namespace) -> int:
    root = Path(args.root).expanduser().resolve()
    artifact_dir = resolve_artifact_dir(root, args.dir, allow_archive_lookup=True)
    issues = completion_gate_issues(root, artifact_dir)
    if issues:
        for issue in issues:
            print(f"error: {issue}", file=sys.stderr)
        return 1

    topic = args.topic or load_topic(artifact_dir, artifact_slug(artifact_dir.name))
    slug = args.slug or artifact_slug(artifact_dir.name)
    payload = derive_planning_entry_handoff_payload(
        root=root,
        artifact_dir=artifact_dir,
        topic=topic,
        slug=slug,
        scene=args.scene,
        recipe_id=args.recipe_id,
        title_override=args.title,
        goal_override=args.goal,
        objective_override=args.objective,
        demand_summary_override=args.demand_summary,
        handoff_id_override=args.handoff_id,
    )
    output = Path(args.output).expanduser().resolve() if args.output else (root / ".bagakit" / "planning-entry" / "handoffs" / f"{slug}.json")
    if output.exists() and not args.force:
        raise SystemExit(f"error: output already exists: {output}; use --force to overwrite")
    write_text(output, json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(f"output={output}")
    print(f"artifact_dir={artifact_dir}")
    print(f"handoff_id={payload['handoff_id']}")
    print(f"recipe_id={args.recipe_id}")
    print(f"scene={args.scene}")
    return 0


def cmd_check_complete(args: argparse.Namespace) -> int:
    root = Path(args.root).expanduser().resolve()
    artifact_dir = resolve_artifact_dir(root, args.dir, allow_archive_lookup=True)
    issues = completion_gate_issues(root, artifact_dir)
    if issues:
        print("TASK NOT COMPLETE")
        for issue in issues:
            print(issue)
        return 1

    archive_json = resolve_archive_json_path(root, artifact_dir)
    archive = json.loads(read_text(archive_json))

    print("ALL REQUIRED STAGES COMPLETE")
    print(f"archive_status={archive.get('status')}")
    print("completion_scope=analysis_and_handoff_only")
    print(f"experiment_count={experiment_count(artifact_dir)}")
    print(f"experiment_bonus_points={experiment_bonus_points(artifact_dir)}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="bagakit-brainstorm artifact tooling")
    sub = parser.add_subparsers(dest="command", required=True)

    p_init = sub.add_parser("init", help="create brainstorm analysis artifacts from templates")
    p_init.add_argument("--topic", required=True, help="brainstorm topic")
    p_init.add_argument("--root", default=".", help="project root")
    p_init.add_argument("--slug", help="optional artifact slug")
    p_init.add_argument("--goal", help="optional goal text")
    p_init.add_argument("--source-hint", help="optional source hint")
    p_init.add_argument("--with-related-insights", action="store_true", help="include optional related insights file")
    p_init.add_argument("--with-review-quality", action="store_true", help="include optional review quality file")
    p_init.add_argument(
        "--with-eval-effect-review",
        action="store_true",
        help="include optional eval effectiveness review file",
    )
    p_init.add_argument(
        "--with-expert-panel",
        action="store_true",
        help="deprecated no-op: expert forum file is required and always generated",
    )
    p_init.set_defaults(func=cmd_init)

    p_status = sub.add_parser("status", help="show stage and archive status")
    p_status.add_argument("--dir", help="artifact directory")
    p_status.add_argument("--root", default=".", help="project root")
    p_status.set_defaults(func=cmd_status)

    p_archive = sub.add_parser("archive", help="resolve handoff routes, write archive record, and move artifact")
    p_archive.add_argument("--dir", help="artifact directory")
    p_archive.add_argument("--root", default=".", help="project root")
    p_archive.add_argument("--topic", help="topic override")
    p_archive.add_argument("--slug", help="slug override")
    p_archive.add_argument(
        "--driver",
        choices=["auto", "local", "adapter"],
        default="auto",
        help="action handoff route selector",
    )
    p_archive.add_argument("--adapter-id", help="adapter id when --driver adapter")
    p_archive.add_argument(
        "--meta",
        action="append",
        default=[],
        help="adapter template variable in key=value format (repeatable)",
    )
    p_archive.set_defaults(func=cmd_archive)

    p_export = sub.add_parser(
        "export-planning-entry-handoff",
        help="export one approved brainstorm artifact into planning-entry handoff json",
    )
    p_export.add_argument("--dir", help="artifact directory")
    p_export.add_argument("--root", default=".", help="project root")
    p_export.add_argument("--output", help="output json path")
    p_export.add_argument("--topic", help="topic override")
    p_export.add_argument("--slug", help="slug override")
    p_export.add_argument("--handoff-id", help="handoff id override")
    p_export.add_argument("--title", help="title override")
    p_export.add_argument("--goal", help="goal override")
    p_export.add_argument("--objective", help="objective override")
    p_export.add_argument("--demand-summary", help="demand summary override")
    p_export.add_argument("--scene", required=True, choices=["analysis_only", "ambiguous_delivery", "clear_delivery", "execution_ready"])
    p_export.add_argument(
        "--recipe-id",
        required=True,
        choices=[
            "planning-entry-brainstorm-only",
            "planning-entry-brainstorm-to-feature",
            "planning-entry-feature-to-flow",
            "planning-entry-brainstorm-feature-flow",
        ],
    )
    p_export.add_argument("--force", action="store_true", help="overwrite output if it already exists")
    p_export.set_defaults(func=cmd_export_planning_entry_handoff)

    p_complete = sub.add_parser("check-complete", help="require analysis stage completion + archive completion")
    p_complete.add_argument("--dir", help="artifact directory")
    p_complete.add_argument("--root", default=".", help="project root")
    p_complete.set_defaults(func=cmd_check_complete)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
