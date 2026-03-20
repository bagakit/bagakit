#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from functools import lru_cache
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

GENERIC_HEADINGS = {
    "问题陈述",
    "问题诊断",
    "方案设计",
    "总结",
    "结论",
}
PLACEHOLDER_PATTERNS = [
    re.compile(r"\bTODO\b", re.IGNORECASE),
    re.compile(r"\bTBD\b", re.IGNORECASE),
    re.compile(r"\{\{.*?\}\}"),
    re.compile(r"待补充"),
]
DEFAULT_AI_TONE_PHRASES = ["打稳", "抓手", "返工机器", "接得住", "赋能", "锁死", "拉齐", "打通", "打穿"]
EXAMPLE_MARKERS = ["例如", "比如", "case", "before", "after"]
CASE_MARKERS = ["例如", "比如", "case", "before", "after", "场景", "示例", "样例"]
ANTI_PATTERN_MARKERS = ["反模式", "anti-pattern", "踩坑", "failure mode"]
OPERATIONAL_SIGNAL_MARKERS = [
    "验证信号",
    "通过信号",
    "pass threshold",
    "threshold",
    "下一步",
    "next action",
    "清单",
    "checklist",
]
PROCESS_SCAFFOLD_LINE_PATTERNS = {
    "READER_CONTRACT": re.compile(r"^\s*###\s+Reader contract\s*$", re.IGNORECASE),
    "TASK_AFTER_READING": re.compile(r"^\s*-\s*Task after reading\s*:", re.IGNORECASE),
    "OUT_OF_SCOPE": re.compile(r"^\s*-\s*Out of scope\s*:", re.IGNORECASE),
    "SUCCESS_SIGNAL": re.compile(r"^\s*-\s*Success signal\s*:", re.IGNORECASE),
}
EXECUTION_FIELD_TOKENS = [
    "discussion_clear",
    "user_review_status",
    "claim_validation",
    "tool_usability",
    "handoff_destination",
]
SCOPE_CUT_MARKERS = ["scope cut", "范围收缩", "摘要版", "简版", "scope narrowed"]
LONG_SAMPLE_MIN_LINES = 12
H2_RESTATEMENT_MAX_UNITS = 16
SHORT_ANCHOR_MIN_UNITS = 8
SHORT_ANCHOR_MAX_UNITS = 20
SHORT_BREAK_MIN_UNITS = 10
SHORT_BREAK_MAX_UNITS = 16
LONG_SENTENCE_MAX_UNITS = 40
MEMORY_HOOK_MIN_UNITS = 8
MEMORY_HOOK_MAX_UNITS = 28
TABLE_SEPARATOR_PATTERN = re.compile(r"^\s*\|?(?:\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$")
SAMPLING_METADATA_PATTERNS: dict[str, list[re.Pattern[str]]] = {
    "sampling_object": [
        re.compile(r"采样对象"),
        re.compile(r"sample object", re.IGNORECASE),
        re.compile(r"样本对象"),
    ],
    "sampling_size": [
        re.compile(r"样本量"),
        re.compile(r"样本数"),
        re.compile(r"\bn\s*=\s*\d+", re.IGNORECASE),
        re.compile(r"sample size", re.IGNORECASE),
    ],
    "sampling_window": [
        re.compile(r"时间窗口"),
        re.compile(r"采样窗口"),
        re.compile(r"time window", re.IGNORECASE),
        re.compile(r"\bwindow\b", re.IGNORECASE),
    ],
    "sampling_review_role": [
        re.compile(r"评审角色"),
        re.compile(r"评审人"),
        re.compile(r"review role", re.IGNORECASE),
        re.compile(r"reviewer", re.IGNORECASE),
    ],
}
MECHANICAL_SHORT_SENTENCE_RE = re.compile(
    r"^(先|再|然后|最后|第一步|第二步|第三步|第一|第二|第三)[^，,:：]{0,14}$"
)
MECHANICAL_SHORT_SENTENCE_MAX_UNITS = 18
FRAGMENT_SENTENCE_MAX_UNITS = 6
PROFILE_RULES: dict[str, dict[str, int]] = {
    "general": {
        "min_words": 0,
        "min_case_markers": 0,
        "min_mermaid_diagrams": 0,
        "min_table_count": 0,
        "min_full_sample_anchor": 0,
    },
    "brainstorm": {
        "min_words": 320,
        "min_case_markers": 2,
        "min_mermaid_diagrams": 1,
        "min_table_count": 0,
        "min_full_sample_anchor": 0,
        "require_h2_restatement": 1,
        "require_anchor_loop": 1,
        "short_break_words_per_anchor": 450,
        "memory_hook_words_per_hint": 400,
        "max_long_sentence_ratio": 25,
        "warn_avg_sentence_units": 34,
        "warn_ending_memory_closure": 1,
        "sampling_meta_warn_floor": 3,
    },
    "protocol": {
        "min_words": 420,
        "min_case_markers": 2,
        "min_mermaid_diagrams": 0,
        "min_table_count": 0,
        "min_full_sample_anchor": 1,
        "require_h2_restatement": 1,
        "require_anchor_loop": 1,
        "short_break_words_per_anchor": 450,
        "memory_hook_words_per_hint": 400,
        "max_long_sentence_ratio": 25,
        "warn_avg_sentence_units": 34,
        "warn_ending_memory_closure": 1,
    },
    "infrastructure": {
        "min_words": 420,
        "min_case_markers": 2,
        "min_mermaid_diagrams": 0,
        "min_table_count": 0,
        "min_full_sample_anchor": 1,
        "require_h2_restatement": 1,
        "require_anchor_loop": 1,
        "short_break_words_per_anchor": 450,
        "memory_hook_words_per_hint": 400,
        "max_long_sentence_ratio": 25,
        "warn_avg_sentence_units": 34,
        "warn_ending_memory_closure": 1,
    },
}


@dataclass
class Issue:
    level: str
    code: str
    message: str
    line: int | None = None


@lru_cache(maxsize=1)
def ai_tone_lexicon() -> tuple[str, ...]:
    lexicon_path = Path(__file__).resolve().parents[1] / "references" / "ai-tone-terms.txt"
    if lexicon_path.is_file():
        terms: list[str] = []
        for raw in lexicon_path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            terms.append(line)
        if terms:
            dedup: list[str] = []
            seen: set[str] = set()
            for term in terms:
                key = term.lower()
                if key in seen:
                    continue
                seen.add(key)
                dedup.append(term)
            return tuple(dedup)
    return tuple(DEFAULT_AI_TONE_PHRASES)


def count_long_list_runs(text: str) -> int:
    runs: list[int] = []
    run = 0
    for line in text.splitlines():
        if re.match(r"^\s*(?:[-*]|\d+\.)\s+", line):
            run += 1
        else:
            if run:
                runs.append(run)
            run = 0
    if run:
        runs.append(run)
    return sum(1 for size in runs if size > 5)


def extract_non_code_lines(lines: Iterable[str]) -> list[tuple[int, str]]:
    kept: list[tuple[int, str]] = []
    in_fence = False
    for lineno, line in enumerate(lines, start=1):
        if re.match(r"^\s*```", line):
            in_fence = not in_fence
            continue
        if not in_fence:
            kept.append((lineno, line))
    return kept


def fenced_block_lengths(text: str) -> list[int]:
    lengths: list[int] = []
    in_fence = False
    current_len = 0
    for line in text.splitlines():
        if re.match(r"^\s*```", line):
            if in_fence:
                lengths.append(current_len)
                in_fence = False
                current_len = 0
            else:
                in_fence = True
                current_len = 0
            continue
        if in_fence and line.strip():
            current_len += 1
    return lengths


def count_mermaid_diagrams(text: str) -> int:
    return len(re.findall(r"(?mi)^\s*```mermaid\s*$", text))


def count_markdown_tables(lines: Iterable[str]) -> int:
    rows = list(lines)
    table_count = 0
    for idx in range(1, len(rows)):
        if "|" not in rows[idx - 1]:
            continue
        if TABLE_SEPARATOR_PATTERN.match(rows[idx]):
            table_count += 1
    return table_count


def count_case_markers(text: str) -> int:
    lower = text.lower()
    return sum(lower.count(marker.lower()) for marker in CASE_MARKERS)


def normalize_line_for_sentence(line: str) -> str:
    cleaned = line.strip()
    cleaned = re.sub(r"^\s*[-*]\s+", "", cleaned)
    cleaned = re.sub(r"^\s*\d+\.\s+", "", cleaned)
    cleaned = re.sub(r"^\s*>\s*", "", cleaned)
    cleaned = re.sub(r"^\s*\|\s*", "", cleaned)
    return cleaned


def split_sentences_with_punct(text: str) -> list[str]:
    normalized = text.replace("\r\n", "\n")
    chunks = [chunk.strip() for chunk in re.split(r"\n+", normalized) if chunk and chunk.strip()]
    sentences: list[str] = []
    for chunk in chunks:
        parts = re.findall(r"[^。！？!?；;]+[。！？!?；;]?", chunk)
        if not parts:
            sentences.append(chunk)
            continue
        for part in parts:
            sentence = part.strip()
            if sentence:
                sentences.append(sentence)
    return sentences


def split_sentences(text: str) -> list[str]:
    stripped: list[str] = []
    for sentence in split_sentences_with_punct(text):
        normalized = re.sub(r"[。！？!?；;]+$", "", sentence).strip()
        if normalized:
            stripped.append(normalized)
    return stripped


def sentence_units(sentence: str) -> int:
    compact = re.sub(r"\s+", "", sentence)
    units = len(re.findall(r"[\u4e00-\u9fffA-Za-z0-9]", compact))
    if units > 0:
        return units
    return len(compact)


def build_body_text(non_code_lines: list[tuple[int, str]]) -> str:
    body_lines: list[str] = []
    for _, raw_line in non_code_lines:
        if re.match(r"^#{1,6}\s+", raw_line):
            continue
        if TABLE_SEPARATOR_PATTERN.match(raw_line):
            continue
        normalized = normalize_line_for_sentence(raw_line)
        if normalized:
            body_lines.append(normalized)
    return "\n".join(body_lines)


def analyze_sentence_rhythm(body_text: str) -> tuple[int, float, int, float]:
    sentences = split_sentences(body_text)
    units: list[int] = []
    for sentence in sentences:
        if not sentence:
            continue
        unit = sentence_units(sentence)
        if unit > 0:
            units.append(unit)
    total = len(units)
    if total == 0:
        return 0, 0.0, 0, 0.0
    long_count = sum(1 for unit in units if unit > LONG_SENTENCE_MAX_UNITS)
    average = round(sum(units) / total, 2)
    ratio = round(long_count / total, 4)
    return total, average, long_count, ratio


def is_memory_hook_candidate(sentence_with_punct: str) -> bool:
    plain = re.sub(r"[。！？!?；;]+$", "", sentence_with_punct).strip()
    units = sentence_units(plain)
    if units < MEMORY_HOOK_MIN_UNITS or units > MEMORY_HOOK_MAX_UNITS:
        return False
    # Keep this heuristic generic. Final memory quality judgment belongs to agent gate review.
    if len(re.findall(r"[？?]", sentence_with_punct)) >= 1:
        return True
    if units <= 16 and not re.search(r"[，,:：;；]", sentence_with_punct):
        return True
    return False


def count_memory_hooks(body_text: str) -> int:
    return sum(1 for sentence in split_sentences_with_punct(body_text) if is_memory_hook_candidate(sentence))


def analyze_sampling_metadata(text: str) -> tuple[int, int, int, int, int]:
    flags: dict[str, int] = {}
    for key, patterns in SAMPLING_METADATA_PATTERNS.items():
        flags[key] = int(any(pattern.search(text) for pattern in patterns))
    score = sum(flags.values())
    return (
        score,
        flags.get("sampling_object", 0),
        flags.get("sampling_size", 0),
        flags.get("sampling_window", 0),
        flags.get("sampling_review_role", 0),
    )


def analyze_mechanical_short_sentence_run(body_text: str) -> int:
    run = 0
    max_run = 0
    for sentence in split_sentences(body_text):
        plain = sentence.strip()
        if not plain:
            run = 0
            continue
        if sentence_units(plain) <= MECHANICAL_SHORT_SENTENCE_MAX_UNITS and MECHANICAL_SHORT_SENTENCE_RE.match(plain):
            run += 1
            max_run = max(max_run, run)
            continue
        run = 0
    return max_run


def analyze_fragment_sentences(body_text: str) -> tuple[int, float]:
    units = [sentence_units(sentence) for sentence in split_sentences(body_text) if sentence.strip()]
    if not units:
        return 0, 0.0
    fragment_count = sum(1 for unit in units if 1 <= unit <= FRAGMENT_SENTENCE_MAX_UNITS)
    fragment_ratio = round(fragment_count / len(units), 4)
    return fragment_count, fragment_ratio


def analyze_ending_memory_closure(body_text: str) -> int:
    sentences = split_sentences_with_punct(body_text)
    if not sentences:
        return 0
    tail_size = max(3, math.ceil(len(sentences) * 0.2))
    tail = sentences[-tail_size:]
    has_tri_question = any(len(re.findall(r"[？?]", sentence)) >= 2 for sentence in tail)
    has_goal_state_next = any(
        all(token in sentence for token in ["目标", "状态", "下一步"])
        for sentence in tail
    )
    has_recap = any(re.search(r"(一句话|核心|结论|复述|本质|总之)", sentence) for sentence in tail)
    return int(has_tri_question or has_goal_state_next or has_recap)


def collect_ai_tone_hits(text: str) -> list[str]:
    hits: list[str] = []
    lower = text.lower()
    for phrase in ai_tone_lexicon():
        if phrase.lower() in lower:
            hits.append(phrase)
    return hits


def analyze_h2_restatement(non_code_lines: list[tuple[int, str]]) -> tuple[int, int]:
    sections: list[list[str]] = []
    current: list[str] | None = None
    for _, raw_line in non_code_lines:
        if re.match(r"^##\s+", raw_line):
            if current is not None:
                sections.append(current)
            current = []
            continue
        if current is not None:
            current.append(raw_line)
    if current is not None:
        sections.append(current)

    required = len(sections)
    passed = 0
    for lines in sections:
        section_lines: list[str] = []
        for line in lines:
            if re.match(r"^##\s+", line):
                continue
            section_lines.append(normalize_line_for_sentence(line))
        first_sentence = next((s for s in split_sentences("\n".join(section_lines)) if s), "")
        units = sentence_units(first_sentence) if first_sentence else 0
        if 1 <= units <= H2_RESTATEMENT_MAX_UNITS:
            passed += 1
    return required, passed


def analyze_anchor_loop(non_code_text: str) -> tuple[int, int, int, int]:
    sentences = split_sentences(non_code_text)
    if not sentences:
        return 0, 0, 0, 0
    short_idxs = [
        idx
        for idx, sentence in enumerate(sentences)
        if SHORT_ANCHOR_MIN_UNITS <= sentence_units(sentence) <= SHORT_ANCHOR_MAX_UNITS
    ]
    if not short_idxs:
        return 0, 0, 0, 0
    total = len(sentences)
    has_open = int(any(idx < total * 0.3 for idx in short_idxs))
    has_mid = int(any(total * 0.3 <= idx < total * 0.7 for idx in short_idxs))
    has_end = int(any(idx >= total * 0.7 for idx in short_idxs))
    return has_open, has_mid, has_end, has_open + has_mid + has_end


def count_short_break_sentences(non_code_text: str) -> int:
    sentences = split_sentences(non_code_text)
    return sum(
        1
        for sentence in sentences
        if SHORT_BREAK_MIN_UNITS <= sentence_units(sentence) <= SHORT_BREAK_MAX_UNITS
    )


def apply_profile_gates(
    profile: str,
    metrics: dict[str, float | int],
    issues: list[Issue],
) -> None:
    if profile == "general":
        return

    rules = PROFILE_RULES.get(profile, PROFILE_RULES["general"])
    level = "error"

    checks: list[tuple[str, str, str]] = [
        ("word_count", "min_words", "PROFILE_WORD_FLOOR"),
        ("case_marker_hits", "min_case_markers", "PROFILE_CASE_FLOOR"),
        ("mermaid_diagram_count", "min_mermaid_diagrams", "PROFILE_DIAGRAM_FLOOR"),
        ("table_count", "min_table_count", "PROFILE_TABLE_FLOOR"),
        ("has_full_sample_anchor", "min_full_sample_anchor", "PROFILE_SAMPLE_FLOOR"),
    ]

    for metric_key, rule_key, code in checks:
        value = int(metrics.get(metric_key, 0))
        threshold = int(rules.get(rule_key, 0))
        if value < threshold:
            issues.append(
                Issue(
                    level,
                    code,
                    f"profile={profile}: {metric_key}={value} below required threshold {threshold}",
                )
            )

    if int(rules.get("require_h2_restatement", 0)) == 1:
        required = int(metrics.get("h2_restatement_required", 0))
        passed = int(metrics.get("h2_restatement_pass", 0))
        if required > 0 and passed < required:
            issues.append(
                Issue(
                    "error",
                    "PROFILE_RESTATEMENT_FLOOR",
                    f"profile={profile}: h2 restatement coverage {passed}/{required} below required full coverage",
                )
            )

    if int(rules.get("require_anchor_loop", 0)) == 1:
        anchor_score = int(metrics.get("anchor_loop_score", 0))
        if anchor_score < 3:
            issues.append(
                Issue(
                    "error",
                    "PROFILE_ANCHOR_LOOP",
                    f"profile={profile}: anchor loop coverage={anchor_score}/3; need opening+middle+ending short anchors",
                )
            )

    max_long_sentence_ratio = int(rules.get("max_long_sentence_ratio", 0))
    if max_long_sentence_ratio > 0:
        ratio = float(metrics.get("long_sentence_ratio", 0.0))
        max_ratio = max_long_sentence_ratio / 100
        if ratio > max_ratio:
            issues.append(
                Issue(
                    "error",
                    "PROFILE_LONG_SENTENCE_RATIO",
                    f"profile={profile}: long sentence ratio={ratio:.1%} above required <= {max_ratio:.0%}",
                )
            )

    words_per_anchor = int(rules.get("short_break_words_per_anchor", 0))
    if words_per_anchor > 0:
        words = int(metrics.get("word_count", 0))
        required_breaks = 0 if words < 350 else math.ceil(words / words_per_anchor)
        short_breaks = int(metrics.get("short_break_sentence_count", 0))
        metrics["required_short_break_sentence_count"] = required_breaks
        if short_breaks < required_breaks:
            issues.append(
                Issue(
                    "error",
                    "PROFILE_SHORT_BREAK_FLOOR",
                    f"profile={profile}: short break sentences={short_breaks} below required {required_breaks}",
                )
            )

    memory_hint_words = int(rules.get("memory_hook_words_per_hint", 0))
    if memory_hint_words > 0:
        words = int(metrics.get("word_count", 0))
        required_hooks = 0 if words < 300 else math.ceil(words / memory_hint_words)
        memory_hooks = int(metrics.get("memory_hook_candidate_count", 0))
        metrics["recommended_memory_hook_count"] = required_hooks
        if memory_hooks < required_hooks:
            issues.append(
                Issue(
                    "warning",
                    "MEMORY_HOOK_HINT_WEAK",
                    "memory-hook candidate density is low; ask agent gate to add restatable anchor lines",
                )
            )

    avg_sentence_warn = int(rules.get("warn_avg_sentence_units", 0))
    if avg_sentence_warn > 0:
        sentence_avg = float(metrics.get("sentence_units_avg", 0.0))
        if sentence_avg > avg_sentence_warn:
            issues.append(
                Issue(
                    "warning",
                    "RHYTHM_AVG_SENTENCE_HIGH",
                    f"profile={profile}: average sentence units={sentence_avg:.1f} above suggested <= {avg_sentence_warn}",
                )
            )

    if int(rules.get("warn_ending_memory_closure", 0)) == 1:
        ending_ok = int(metrics.get("ending_memory_closure_present", 0))
        if ending_ok == 0:
            issues.append(
                Issue(
                    "warning",
                    "ENDING_MEMORY_CLOSURE_WEAK",
                    "ending memory closure is weak; consider three-question close or one-line key-claim recap",
                )
            )

    sampling_warn_floor = int(rules.get("sampling_meta_warn_floor", 0))
    if sampling_warn_floor > 0:
        sampling_score = int(metrics.get("sampling_meta_score", 0))
        if sampling_score < sampling_warn_floor:
            issues.append(
                Issue(
                    "warning",
                    "BRAINSTORM_SAMPLING_META_WEAK",
                    "brainstorm article is missing sampling protocol metadata (object/sample-size/window/review-role)",
                )
            )


def detect_process_scaffold(lines: Iterable[tuple[int, str]]) -> list[Issue]:
    issues: list[Issue] = []
    for lineno, line in lines:
        for code, pattern in PROCESS_SCAFFOLD_LINE_PATTERNS.items():
            if pattern.match(line):
                issues.append(
                    Issue(
                        "warning",
                        "PROCESS_SCAFFOLD",
                        f"planning scaffold line detected ({code}); keep this in outline/review artifacts",
                        lineno,
                    )
                )
                break
    return issues


def detect_internal_directives(lines: Iterable[tuple[int, str]]) -> list[Issue]:
    issues: list[Issue] = []
    for lineno, line in lines:
        if re.match(r"^\s*\[\[BAGAKIT\]\]\s*$", line):
            issues.append(
                Issue(
                    "error",
                    "INTERNAL_DIRECTIVE",
                    "internal directive '[[BAGAKIT]]' is not allowed in publish article",
                    lineno,
                )
            )
        if re.match(r"^\s*-\s*PaperworkWriting\s*:", line):
            issues.append(
                Issue(
                    "error",
                    "INTERNAL_DIRECTIVE",
                    "internal stage footer line is not allowed in publish article",
                    lineno,
                )
            )
    return issues


def compute_evidence_pack(text: str) -> dict[str, int]:
    lower = text.lower()
    has_example = int(any(marker.lower() in lower for marker in EXAMPLE_MARKERS))
    command_line_count = len(re.findall(r"(?mi)^\s*(?:bash|sh|python3?|git)\s+\S+", text))
    if command_line_count == 0 and re.search(r"`(?:bash|sh|python3?|git)\s+[^`\n]+`", text, re.IGNORECASE):
        command_line_count = 1
    hash_count = len(re.findall(r"\b[0-9a-f]{7,40}\b", text))
    path_ref_count = len(re.findall(r"`[^`\n]*(?:/[^`\n]*|\.[a-z0-9]{2,4}(?::\d+)?)`", text, re.IGNORECASE))
    block_lengths = fenced_block_lengths(text)
    code_fence_count = len(block_lengths)
    long_sample_block_count = sum(1 for n in block_lengths if n >= LONG_SAMPLE_MIN_LINES)
    checklist_item_count = len(re.findall(r"(?m)^\s*-\s*\[[ xX]\]\s+", text))
    anti_pattern_hits = sum(lower.count(marker) for marker in ANTI_PATTERN_MARKERS)
    artifact_richness = min(command_line_count, 3) + min(hash_count, 2) + min(path_ref_count, 3) + min(code_fence_count, 2)
    has_artifact_anchor = int(artifact_richness > 0)
    has_antipattern = int(anti_pattern_hits > 0)
    has_checklist = int(checklist_item_count > 0)
    has_full_sample_anchor = int(long_sample_block_count > 0 or command_line_count >= 3)
    has_hard_evidence_anchor = int(command_line_count >= 2 and (hash_count >= 1 or path_ref_count >= 2))
    has_operational_signal = int(
        bool(has_checklist)
        or any(marker in lower for marker in OPERATIONAL_SIGNAL_MARKERS)
    )
    score = (
        has_example
        + has_artifact_anchor
        + has_antipattern
        + has_operational_signal
        + has_full_sample_anchor
        + has_hard_evidence_anchor
    )
    return {
        "has_example_anchor": has_example,
        "has_artifact_anchor": has_artifact_anchor,
        "artifact_richness": artifact_richness,
        "checklist_item_count": checklist_item_count,
        "anti_pattern_hits": anti_pattern_hits,
        "long_sample_block_count": long_sample_block_count,
        "has_full_sample_anchor": has_full_sample_anchor,
        "has_hard_evidence_anchor": has_hard_evidence_anchor,
        "has_antipattern_anchor": has_antipattern,
        "has_operational_anchor": has_operational_signal,
        "evidence_pack_score": score,
    }


def analyze(
    text: str,
    min_h2: int,
    max_h2: int,
    baseline_text: str | None,
    shrink_threshold: float,
    profile: str,
) -> tuple[dict[str, float | int], list[Issue]]:
    lines = text.splitlines()
    lower_text = text.lower()
    non_code_lines = extract_non_code_lines(lines)
    non_code_text = "\n".join(line for _, line in non_code_lines)
    non_code_only_lines = [line for _, line in non_code_lines]
    body_text = build_body_text(non_code_lines)
    h1 = [ln for ln in non_code_only_lines if re.match(r"^#\s+", ln)]
    h2 = [ln for ln in non_code_only_lines if re.match(r"^##\s+", ln)]
    h3 = [ln for ln in non_code_only_lines if re.match(r"^###\s+", ln)]
    words = re.findall(r"\b\w+\b", text)

    metrics = {
        "h1_count": len(h1),
        "h2_count": len(h2),
        "h3_count": len(h3),
        "word_count": len(words),
        "char_count": len(text),
        "long_list_runs_over_5": count_long_list_runs(text),
        "profile": profile,
        "case_marker_hits": count_case_markers(text),
        "mermaid_diagram_count": count_mermaid_diagrams(text),
        "table_count": count_markdown_tables(non_code_only_lines),
    }
    metrics.update(compute_evidence_pack(text))
    h2_required, h2_pass = analyze_h2_restatement(non_code_lines)
    metrics["h2_restatement_required"] = h2_required
    metrics["h2_restatement_pass"] = h2_pass
    open_anchor, mid_anchor, end_anchor, anchor_score = analyze_anchor_loop(body_text)
    metrics["anchor_opening_present"] = open_anchor
    metrics["anchor_middle_present"] = mid_anchor
    metrics["anchor_ending_present"] = end_anchor
    metrics["anchor_loop_score"] = anchor_score
    metrics["short_break_sentence_count"] = count_short_break_sentences(body_text)
    total_sentences, avg_sentence_units, long_sentence_count, long_sentence_ratio = analyze_sentence_rhythm(body_text)
    metrics["sentence_count"] = total_sentences
    metrics["sentence_units_avg"] = avg_sentence_units
    metrics["long_sentence_count"] = long_sentence_count
    metrics["long_sentence_ratio"] = long_sentence_ratio
    metrics["long_sentence_threshold"] = LONG_SENTENCE_MAX_UNITS
    metrics["memory_hook_candidate_count"] = count_memory_hooks(body_text)
    metrics["ending_memory_closure_present"] = analyze_ending_memory_closure(body_text)
    (
        sampling_meta_score,
        sampling_object_present,
        sampling_size_present,
        sampling_window_present,
        sampling_review_role_present,
    ) = analyze_sampling_metadata(text)
    metrics["sampling_meta_score"] = sampling_meta_score
    metrics["sampling_object_present"] = sampling_object_present
    metrics["sampling_size_present"] = sampling_size_present
    metrics["sampling_window_present"] = sampling_window_present
    metrics["sampling_review_role_present"] = sampling_review_role_present
    metrics["mechanical_short_sentence_run"] = analyze_mechanical_short_sentence_run(body_text)
    fragment_count, fragment_ratio = analyze_fragment_sentences(body_text)
    metrics["fragment_sentence_count"] = fragment_count
    metrics["fragment_sentence_ratio"] = fragment_ratio

    issues: list[Issue] = []

    if len(h1) != 1:
        issues.append(Issue("error", "H1_COUNT", "article must contain exactly one H1 heading"))

    if not (min_h2 <= len(h2) <= max_h2):
        issues.append(
            Issue(
                "error",
                "H2_RANGE",
                f"H2 count must be between {min_h2} and {max_h2}; got {len(h2)}",
            )
        )

    for pattern in PLACEHOLDER_PATTERNS:
        if pattern.search(text):
            issues.append(Issue("error", "PLACEHOLDER", f"unresolved placeholder matched: {pattern.pattern}"))

    issues.extend(detect_internal_directives(non_code_lines))

    for ln in h2 + h3:
        heading = re.sub(r"^#{2,3}\s+", "", ln).strip()
        if heading in GENERIC_HEADINGS:
            issues.append(
                Issue(
                    "warning",
                    "GENERIC_HEADING",
                    f"heading '{heading}' is too generic for publish-quality scanning",
                )
            )

    if metrics["long_list_runs_over_5"] > 0:
        issues.append(
            Issue(
                "warning",
                "LIST_OVERLOAD",
                f"found {metrics['long_list_runs_over_5']} list block(s) longer than 5 items",
            )
        )

    if not any(marker.lower() in text.lower() for marker in EXAMPLE_MARKERS):
        issues.append(Issue("warning", "NO_EXAMPLE", "no explicit example marker found in article body"))

    ai_tone_hits = collect_ai_tone_hits(text)
    metrics["ai_tone_hit_count"] = len(ai_tone_hits)
    if ai_tone_hits:
        issues.append(
            Issue(
                "warning",
                "AI_TONE_LEXICON",
                "AI-tone lexicon hits detected (" + ", ".join(ai_tone_hits) + "); warning-level lint only, final judgment stays in agent gate review",
            )
        )

    if int(metrics.get("mechanical_short_sentence_run", 0)) >= 3:
        issues.append(
            Issue(
                "warning",
                "MECHANICAL_SHORT_SENTENCE",
                "detected 3+ consecutive short sequence-style sentences (for example '先X。再Y。'); add causal detail or merge for natural rhythm",
            )
        )

    if int(metrics.get("fragment_sentence_count", 0)) >= 4 and float(metrics.get("fragment_sentence_ratio", 0.0)) >= 0.15:
        issues.append(
            Issue(
                "warning",
                "FRAGMENT_SENTENCE_DENSE",
                "fragment-like short sentences are dense; clean residual fragments and restore coherent sentence flow",
            )
        )

    issues.extend(detect_process_scaffold(non_code_lines))

    execution_field_hits = sorted(
        {token for token in EXECUTION_FIELD_TOKENS if re.search(rf"\b{re.escape(token)}\b", non_code_text)}
    )
    if len(execution_field_hits) >= 2:
        issues.append(
            Issue(
                "warning",
                "EXECUTION_FIELD_LEAK",
                "execution-only fields detected in publish article: " + ", ".join(execution_field_hits),
            )
        )

    if int(metrics.get("evidence_pack_score", 0)) < 3:
        issues.append(
            Issue(
                "warning",
                "EVIDENCE_PACK_THIN",
                "evidence pack is thin; add concrete artifact/anti-pattern/operational anchors",
            )
        )

    apply_profile_gates(profile, metrics, issues)

    if baseline_text is not None:
        baseline_evidence = compute_evidence_pack(baseline_text)
        baseline_words = re.findall(r"\b\w+\b", baseline_text)
        baseline_word_count = len(baseline_words)
        baseline_char_count = len(baseline_text)
        metrics["baseline_word_count"] = baseline_word_count
        metrics["baseline_char_count"] = baseline_char_count
        metrics["baseline_evidence_pack_score"] = baseline_evidence["evidence_pack_score"]
        metrics["baseline_artifact_richness"] = baseline_evidence["artifact_richness"]
        metrics["baseline_has_full_sample_anchor"] = baseline_evidence["has_full_sample_anchor"]
        metrics["baseline_has_hard_evidence_anchor"] = baseline_evidence["has_hard_evidence_anchor"]
        metrics["baseline_has_antipattern_anchor"] = baseline_evidence["has_antipattern_anchor"]
        metrics["baseline_has_operational_anchor"] = baseline_evidence["has_operational_anchor"]
        current_evidence_score = int(metrics.get("evidence_pack_score", 0))
        if baseline_evidence["evidence_pack_score"] >= 2 and current_evidence_score < baseline_evidence["evidence_pack_score"]:
            issues.append(
                Issue(
                    "warning",
                    "EVIDENCE_PACK_DROP",
                    "evidence pack weaker than baseline; restore key concrete anchors or explain scope cut",
                )
            )
        class_drop_pairs = [
            ("has_full_sample_anchor", "baseline_has_full_sample_anchor", "FULL_SAMPLE_DROP", "full sample anchor"),
            ("has_hard_evidence_anchor", "baseline_has_hard_evidence_anchor", "HARD_EVIDENCE_DROP", "hard evidence chain"),
            ("has_antipattern_anchor", "baseline_has_antipattern_anchor", "ANTIPATTERN_DROP", "anti-pattern block"),
            ("has_operational_anchor", "baseline_has_operational_anchor", "ROLLOUT_DROP", "rollout/checklist anchor"),
        ]
        dropped_classes: list[str] = []
        for current_key, baseline_key, code, label in class_drop_pairs:
            if int(metrics.get(baseline_key, 0)) == 1 and int(metrics.get(current_key, 0)) == 0:
                dropped_classes.append(label)
                issues.append(
                    Issue(
                        "warning",
                        code,
                        f"baseline has {label} but rewrite dropped it; recover or document explicit scope cut",
                    )
                )
        metrics["baseline_dropped_evidence_classes"] = len(dropped_classes)
        if baseline_word_count > 0:
            shrink_ratio = 1 - (metrics["word_count"] / baseline_word_count)
            metrics["word_shrink_ratio"] = round(shrink_ratio, 4)
            has_scope_cut_marker = any(marker in lower_text for marker in SCOPE_CUT_MARKERS)
            metrics["has_scope_cut_marker"] = int(has_scope_cut_marker)
            if shrink_ratio > shrink_threshold:
                issues.append(
                    Issue(
                        "warning",
                        "CONTENT_SHRINK",
                        f"word count dropped by {shrink_ratio:.0%} vs baseline (threshold {shrink_threshold:.0%}); verify no regression",
                    )
                )
            if shrink_ratio > 0.45 and baseline_word_count >= 500 and not has_scope_cut_marker:
                issues.append(
                    Issue(
                        "error",
                        "BASELINE_OVER_COMPRESSION",
                        "rewrite compressed >45% on high-content baseline without explicit scope-cut note",
                    )
                )
            if shrink_ratio > 0.35 and dropped_classes:
                issues.append(
                    Issue(
                        "warning",
                        "REGRESSION_RISK",
                        "rewrite is both compressed and evidence-class reduced vs baseline",
                    )
                )
            if shrink_ratio > 0.45 and len(dropped_classes) >= 2:
                issues.append(
                    Issue(
                        "error",
                        "BASELINE_REGRESSION",
                        "high-compression rewrite dropped multiple baseline evidence classes",
                    )
                )
            current_artifact_richness = int(metrics.get("artifact_richness", 0))
            baseline_artifact_richness = int(metrics.get("baseline_artifact_richness", 0))
            if (
                shrink_ratio > 0.5
                and baseline_artifact_richness >= 4
                and current_artifact_richness + 1 < baseline_artifact_richness
            ):
                issues.append(
                    Issue(
                        "warning",
                        "EVIDENCE_ARTIFACT_DROP",
                        "high-compression rewrite drops concrete artifact density vs baseline",
                    )
                )

    return metrics, issues


def build_report(input_path: Path, metrics: dict[str, float | int], issues: list[Issue]) -> str:
    lines = [
        f"# Review Report: {input_path.name}",
        "",
        "## Metrics",
        f"- Profile: {metrics.get('profile', 'general')}",
        f"- H1 count: {metrics['h1_count']}",
        f"- H2 count: {metrics['h2_count']}",
        f"- H3 count: {metrics['h3_count']}",
        f"- Word count: {metrics['word_count']}",
        f"- Char count: {metrics['char_count']}",
        f"- Long list blocks (>5): {metrics['long_list_runs_over_5']}",
        f"- Evidence pack score: {metrics['evidence_pack_score']}",
        f"- Artifact richness: {metrics['artifact_richness']}",
        f"- Long sample blocks: {metrics.get('long_sample_block_count', 0)}",
        f"- Checklist items: {metrics.get('checklist_item_count', 0)}",
        f"- Anti-pattern hits: {metrics.get('anti_pattern_hits', 0)}",
        f"- Full sample anchor: {metrics.get('has_full_sample_anchor', 0)}",
        f"- Hard evidence anchor: {metrics.get('has_hard_evidence_anchor', 0)}",
        f"- Mermaid diagrams: {metrics.get('mermaid_diagram_count', 0)}",
        f"- Markdown tables: {metrics.get('table_count', 0)}",
        f"- Case marker hits: {metrics.get('case_marker_hits', 0)}",
        f"- H2 restatement coverage: {metrics.get('h2_restatement_pass', 0)}/{metrics.get('h2_restatement_required', 0)}",
        f"- Anchor loop score: {metrics.get('anchor_loop_score', 0)}/3",
        f"- Short break sentences (10-16 units): {metrics.get('short_break_sentence_count', 0)}",
        f"- Required short break sentences: {metrics.get('required_short_break_sentence_count', 0)}",
        f"- Sentence count: {metrics.get('sentence_count', 0)}",
        f"- Average sentence units: {metrics.get('sentence_units_avg', 0)}",
        (
            "- Long sentence ratio (> "
            + str(metrics.get("long_sentence_threshold", LONG_SENTENCE_MAX_UNITS))
            + " units): "
            + f"{float(metrics.get('long_sentence_ratio', 0.0)):.1%}"
        ),
        f"- Memory-hook candidate count: {metrics.get('memory_hook_candidate_count', 0)}",
        f"- Recommended memory-hook count: {metrics.get('recommended_memory_hook_count', 0)}",
        f"- Ending memory closure present: {metrics.get('ending_memory_closure_present', 0)}",
        f"- Sampling metadata score: {metrics.get('sampling_meta_score', 0)}",
        f"- Sampling object present: {metrics.get('sampling_object_present', 0)}",
        f"- Sampling size present: {metrics.get('sampling_size_present', 0)}",
        f"- Sampling window present: {metrics.get('sampling_window_present', 0)}",
        f"- Sampling review role present: {metrics.get('sampling_review_role_present', 0)}",
        f"- AI-tone lexicon hit count: {metrics.get('ai_tone_hit_count', 0)}",
        f"- Mechanical short-sentence run: {metrics.get('mechanical_short_sentence_run', 0)}",
        f"- Fragment sentence count: {metrics.get('fragment_sentence_count', 0)}",
        f"- Fragment sentence ratio: {float(metrics.get('fragment_sentence_ratio', 0.0)):.1%}",
    ]

    if "baseline_word_count" in metrics:
        lines.extend(
            [
                f"- Baseline word count: {metrics['baseline_word_count']}",
                f"- Baseline char count: {metrics['baseline_char_count']}",
                f"- Baseline evidence pack score: {metrics.get('baseline_evidence_pack_score', 0)}",
                f"- Baseline artifact richness: {metrics.get('baseline_artifact_richness', 0)}",
                f"- Baseline full sample anchor: {metrics.get('baseline_has_full_sample_anchor', 0)}",
                f"- Baseline hard evidence anchor: {metrics.get('baseline_has_hard_evidence_anchor', 0)}",
                f"- Baseline anti-pattern anchor: {metrics.get('baseline_has_antipattern_anchor', 0)}",
                f"- Baseline operational anchor: {metrics.get('baseline_has_operational_anchor', 0)}",
                f"- Dropped evidence classes: {metrics.get('baseline_dropped_evidence_classes', 0)}",
                f"- Scope cut marker present: {metrics.get('has_scope_cut_marker', 0)}",
                f"- Word shrink ratio: {metrics.get('word_shrink_ratio', 0)}",
            ]
        )

    lines.extend(["", "## Issues"])

    if not issues:
        lines.append("- none")
    else:
        for issue in issues:
            if issue.line is None:
                lines.append(f"- [{issue.level}] {issue.code}: {issue.message}")
            else:
                lines.append(f"- [{issue.level}] {issue.code} (line {issue.line}): {issue.message}")

    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Check technical article structure and quality signals.")
    parser.add_argument("--input", required=True, help="input markdown file")
    parser.add_argument("--strict", action="store_true", help="exit non-zero when any error exists")
    parser.add_argument("--report", help="optional markdown report output path")
    parser.add_argument("--json", dest="json_out", action="store_true", help="print JSON result")
    parser.add_argument("--baseline", help="optional baseline markdown file for regression signals")
    parser.add_argument(
        "--shrink-threshold",
        type=float,
        default=0.35,
        help="warning threshold for baseline shrink ratio (default: 0.35)",
    )
    parser.add_argument(
        "--profile",
        choices=sorted(PROFILE_RULES.keys()),
        default="general",
        help="content profile for first-draft density checks",
    )
    parser.add_argument("--min-h2", type=int, default=3)
    parser.add_argument("--max-h2", type=int, default=5)
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    if not input_path.is_file():
        print(f"error: input file not found: {input_path}", file=sys.stderr)
        return 2

    baseline_text: str | None = None
    baseline_path: Path | None = None
    if args.baseline:
        baseline_path = Path(args.baseline).resolve()
        if not baseline_path.is_file():
            print(f"error: baseline file not found: {baseline_path}", file=sys.stderr)
            return 2
        baseline_text = baseline_path.read_text(encoding="utf-8")

    text = input_path.read_text(encoding="utf-8")
    metrics, issues = analyze(
        text,
        args.min_h2,
        args.max_h2,
        baseline_text,
        args.shrink_threshold,
        args.profile,
    )
    errors = [i for i in issues if i.level == "error"]

    payload = {
        "input": str(input_path),
        "baseline": str(baseline_path) if baseline_path else None,
        "metrics": metrics,
        "issues": [i.__dict__ for i in issues],
        "error_count": len(errors),
        "warning_count": len(issues) - len(errors),
        "status": "fail" if errors else "pass",
    }

    if args.report:
        report_path = Path(args.report).resolve()
        report_path.write_text(build_report(input_path, metrics, issues), encoding="utf-8")

    if args.json_out:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(f"status={payload['status']}")
        print(f"errors={payload['error_count']}")
        print(f"warnings={payload['warning_count']}")

    if args.strict and errors:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
