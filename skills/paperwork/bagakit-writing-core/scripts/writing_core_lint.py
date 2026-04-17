"""writing_core_lint.py

Static checks for bagakit-writing-core outputs (Markdown / Lark-flavored Markdown).

Usage:
  python scripts/writing_core_lint.py [--fail-on warn|fail|none] path/to/doc.md

Exit codes:
  0: pass
  2: blocking warnings/failures found

ADVISORY findings are reported in JSON but do not affect the default exit code.

No external deps.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
SKILL_DIR = SCRIPT_DIR.parent
AI_SMELL_LEXICON_REF = "references/writing/ai-smell-lexicon.json"
DE_AI_TONE_LEXICON_REF = "../bagakit-writing-de-ai-tone/references/lexicon.json"
AI_SMELL_LEXICON_PATH = SKILL_DIR.parent / "bagakit-writing-de-ai-tone/references/lexicon.json"
if not AI_SMELL_LEXICON_PATH.is_file():
    AI_SMELL_LEXICON_PATH = SKILL_DIR / AI_SMELL_LEXICON_REF


def load_ai_smell_lexicon() -> tuple[list[str], list[str], dict[str, list[str]]]:
    try:
        payload = json.loads(AI_SMELL_LEXICON_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise SystemExit(
            f"missing AI smell lexicon: {DE_AI_TONE_LEXICON_REF} or {AI_SMELL_LEXICON_REF}"
        ) from exc
    except json.JSONDecodeError as exc:
        raise SystemExit(
            f"invalid AI smell lexicon: {AI_SMELL_LEXICON_REF}:{exc.lineno}:{exc.colno}"
        ) from exc

    lint_terms: dict[str, list[str]] = {"zh": [], "en": []}
    suggestions: dict[str, list[str]] = {}

    for group in ("zh", "en"):
        entries = payload.get(group, [])
        if not isinstance(entries, list):
            raise SystemExit(f"invalid AI smell lexicon: `{group}` must be a list")
        for entry in entries:
            if not isinstance(entry, dict) or not entry.get("term"):
                raise SystemExit(f"invalid AI smell lexicon: `{group}` entries need `term`")
            term = str(entry["term"])
            replacement_terms = [str(item) for item in entry.get("suggestions", [])]
            if replacement_terms:
                suggestions[term] = replacement_terms
            if entry.get("lint", True):
                lint_terms[group].append(term)

    return lint_terms["zh"], lint_terms["en"], suggestions


AI_WORDS_ZH, AI_WORDS_EN, AI_WORD_SUGGESTIONS = load_ai_smell_lexicon()

AI_PATTERNS = [
    r"通过.+从而.+进而",
    r"到底是什么",
    r"本文将",
    r"这篇(总结|文章|稿子)(以|将|会|主要)",
    r"这篇文章(会先|先讲|后讲|分成|主要分为)",
    r"后文(会|将|分成|展开)",
    r"下面(先|再)解释(为什么这样写|写法|结构)",
    r"我在整理时",
    r"这里的推断",
    r"值得注意的是",
    r"我们可以看到",
    r"很硬的",
    r"更硬",
    r"要回答的问题更(具体|硬|前置)",
    r"最容易被[^\n，。,]{0,8}",
    r"说轻",
    r"钉住",
    r"最值钱",
    r"值钱的",
    r"立住",
    r"讲透",
    # `稳` is too generic for bare-word matching; only flag the common
    # judgment-smuggling forms that repeatedly correlate with writing feedback.
    r"更稳",
    r"稳很多",
    r"稳得多",
    r"稳感",
    r"稳劲",
    r"先稳住",
    r"立稳",
    r"这种说(法|词)",
    r"接得住",
    r"被[^。！？\n]{0,10}接住",
]

NEGATION_PAIR_RE = re.compile(r"不是[^\n。！？!?；;]{0,80}而是")

PORTABILITY_PATTERNS = [
    r"(?<![\w./-])/(Users|home|private|tmp|var|mnt|Volumes)/[^\s)]+",
    r"file://",
]

INLINE_CODE_RE = re.compile(r"`([^`\n]+)`")
LIST_ITEM_RE = re.compile(r"^\s*([-*+]\s+|\d+\.\s+)")
ORDERED_LIST_ITEM_RE = re.compile(r"^\s*\d+\.\s+")
HEADING_LINE_RE = re.compile(r"^(#{1,6})\s+(.*)$")
CODE_CONTEXT_HINTS = (
    "| Field |",
    "| Command |",
    "| Path |",
    "| Surface |",
    "| Class |",
    "| Layer |",
    "| Focus |",
    "主要 CLI",
    "顶层字段",
    "核心字段",
    "字段如下",
    "Command | Role",
    "Field | Meaning",
    "Path | Class",
)

SERIES_CONCEPT_RE = re.compile(r"\b[A-Za-z][A-Za-z0-9-]{2,}\b")
COMMON_HEADING_WORDS = {
    "about", "advanced", "after", "and", "appendix", "are", "as", "basic",
    "before", "best", "by", "case", "cases", "chapter", "checklist", "demo",
    "doc", "docs", "example", "examples", "faq", "for", "from", "getting",
    "guide", "how", "intro", "introduction", "into", "is", "loop", "next",
    "old", "new", "of", "on", "or", "overview", "part", "pattern",
    "patterns", "practice", "practices", "quick", "section", "start",
    "started", "step", "steps", "the", "to", "use", "using", "via", "vs",
    "what", "when", "where", "why", "with", "without", "workflow",
    "workflows",
    # Common implementation identities usually do not need first-use lint noise.
    "api", "cli", "css", "csv", "docx", "html", "http", "https", "json",
    "llm", "markdown", "md", "pdf", "sdk", "sql", "toml", "yaml", "yml",
}

LABEL_LIKE_TITLE_RE = re.compile(
    r"(介绍|说明|概览|指南|教程|手册|命令形状|使用方法|使用说明|附录|README|Overview|Guide|Intro|Introduction)$",
    re.IGNORECASE,
)

COHESION_BRIDGE_RE = re.compile(
    r"(因为|所以|因此|但是|但|然而|否则|同时|接着|于是|这意味着|换句话|例如|比如|具体来说|为了|从而|"
    r"\bbecause\b|\btherefore\b|\bhowever\b|\bbut\b|\bso\b|\bfor example\b|\bthis means\b)",
    re.IGNORECASE,
)
META_NARRATION_RE = re.compile(
    r"(本文|本节|这一节|这一段|这篇文章|这篇文档|后文|下面|接下来|前面|上一节|下一节)"
    r"[^。！？!?，,\n]{0,18}(会|将|先|再|分成|展开|解释|介绍|说明|讨论|回到|看到|进入)"
)
READER_PROBLEM_RE = re.compile(
    r"(问题|痛点|目标|为了|为什么|怎么|如何|需要解决|要解决|面对|卡住|risk|problem|goal|why|how)",
    re.IGNORECASE,
)
READER_CLAIM_RE = re.compile(
    r"(关键|核心|结论|判断|应该|必须|需要|意味着|不是|而是|结果|invariant|claim|should|must|means)",
    re.IGNORECASE,
)
READER_ACTION_RE = re.compile(
    r"(下一步|接下来|先|然后|进入|(?<!可)执行|使用|检查|验证|交付|next|run|use|check|verify)",
    re.IGNORECASE,
)
READER_OBJECT_RE = re.compile(
    r"(对象|读者|用户|系统|文档|任务|状态|协议|证据|surface|state|protocol|evidence|reader|user)",
    re.IGNORECASE,
)


@dataclass
class Finding:
    level: str  # ADVISORY/WARN/FAIL
    code: str
    msg: str
    meta: dict


def read_text(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="ignore")


def strip_code_spans(text: str) -> str:
    return re.sub(r"`[^`\n]+`", " ", text)


def compact_preview(text: str, limit: int = 90) -> str:
    cleaned = re.sub(r"\s+", " ", strip_code_spans(text)).strip()
    return cleaned[:limit]


def normalize_sentence_key(text: str) -> str:
    stripped = strip_code_spans(text).lower()
    stripped = re.sub(r"[\s`*_#>\-+|:：,，.。;；!?！？()\[\]{}<>《》\"“”'‘’/\\]+", "", stripped)
    return stripped


def semantic_repeat_prefix(key: str) -> str:
    if re.search(r"[a-z0-9]", key):
        return key[:14]
    return key[:8]


def strip_fenced_code(text: str, *, strip_inline: bool = False) -> str:
    cleaned = []
    in_code = False
    for line in text.splitlines():
        if line.strip().startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        cleaned.append(strip_code_spans(line) if strip_inline else line)
    return "\n".join(cleaned)


def is_list_line(line: str) -> bool:
    return bool(LIST_ITEM_RE.match(line))


def is_content_line(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    if is_list_line(line):
        return True
    if HEADING_LINE_RE.match(stripped):
        return False
    if stripped == "---":
        return False
    if stripped.startswith("<callout") or stripped.startswith("</callout"):
        return False
    if stripped.startswith("|") and stripped.endswith("|"):
        return False
    return True


def cue_prefix(text: str) -> str:
    cleaned = strip_code_spans(text).strip().lower()
    cleaned = re.sub(r"^\s*([-*+]\s+|\d+\.\s+)", "", cleaned)
    cleaned = re.sub(r"^[`*_#>\-+|:：,，.。;；!?！？()\[\]{}<>《》\"“”'‘’]+", "", cleaned)
    if not cleaned:
        return ""
    ascii_match = re.match(r"[a-z][a-z0-9-]{2,}", cleaned)
    if ascii_match:
        return ascii_match.group(0)
    return re.sub(r"\s+", "", cleaned)[:2]


def signal_present(pattern: re.Pattern, text: str) -> bool:
    for match in pattern.finditer(text):
        prefix = text[max(0, match.start() - 8):match.start()]
        if re.search(r"(没有|并未|并没有|未|不|无|缺少|缺失|还不知道)$", prefix):
            continue
        return True
    return False


def iter_non_code_lines(md: str, *, strip_inline: bool = False):
    in_code = False
    for i, line in enumerate(md.splitlines(), start=1):
        if line.strip().startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        yield i, strip_code_spans(line) if strip_inline else line


def iter_headings(md: str):
    for i, line in enumerate(md.splitlines(), start=1):
        m = re.match(r"^(#{2,4})\s+(.*)$", line.strip())
        if m:
            level = len(m.group(1))
            title = m.group(2).strip()
            yield i, level, title


def iter_title_and_headings(md: str):
    for i, line in enumerate(md.splitlines(), start=1):
        m = re.match(r"^(#{1,4})\s+(.*)$", line.strip())
        if m:
            level = len(m.group(1))
            title = m.group(2).strip()
            yield i, level, title


def build_heading_tree(headings):
    # nodes: idx -> {line, level, title, parent, children}
    nodes = []
    stack = []  # indices in nodes
    for line, level, title in headings:
        node = {"line": line, "level": level, "title": title, "children": []}
        while stack and nodes[stack[-1]]["level"] >= level:
            stack.pop()
        if stack:
            parent = stack[-1]
            node["parent"] = parent
            nodes[parent]["children"].append(len(nodes))
        else:
            node["parent"] = None
        nodes.append(node)
        stack.append(len(nodes) - 1)
    return nodes


def count_sentences(text: str) -> int:
    # naive sentence count: Chinese punctuation + period/question/exclamation
    # ignore code fences
    t = strip_fenced_code(text, strip_inline=True)
    # remove xml-ish tags
    t = re.sub(r"<[^>]+>", " ", t)
    parts = re.split(r"[。！？!?]+", t)
    return sum(1 for p in parts if p.strip())


def paragraph_stats(md: str):
    paras = paragraph_items(md)
    sent_counts = [item["sentences"] for item in paras]
    return {
        "paragraphs": len(paras),
        "avgSentPerPara": (sum(sent_counts) / len(sent_counts)) if sent_counts else 0,
        "sentPerPara": sent_counts,
    }


def paragraph_items(md: str):
    # paragraphs separated by blank lines; ignore headings, tables, list blocks, code blocks
    lines = md.splitlines()
    paras = []
    cur = []
    cur_start = 0
    in_code = False
    for line_no, line in enumerate(lines, start=1):
        s = line.rstrip("\n")
        if s.strip().startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        if not s.strip():
            if cur:
                text = "\n".join(cur).strip()
                paras.append({
                    "line": cur_start,
                    "text": text,
                    "sentences": count_sentences(text),
                })
                cur = []
                cur_start = 0
            continue
        if re.match(r"^#{1,6}\s+", s.strip()):
            if cur:
                text = "\n".join(cur).strip()
                paras.append({
                    "line": cur_start,
                    "text": text,
                    "sentences": count_sentences(text),
                })
                cur = []
                cur_start = 0
            continue
        if re.match(r"^\s*[-*+]\s+", s) or re.match(r"^\s*\d+\.\s+", s):
            # treat list lines as not paragraphs
            if cur:
                text = "\n".join(cur).strip()
                paras.append({
                    "line": cur_start,
                    "text": text,
                    "sentences": count_sentences(text),
                })
                cur = []
                cur_start = 0
            continue
        if s.strip().startswith("|") and s.strip().endswith("|"):
            if cur:
                text = "\n".join(cur).strip()
                paras.append({
                    "line": cur_start,
                    "text": text,
                    "sentences": count_sentences(text),
                })
                cur = []
                cur_start = 0
            continue
        if s.strip().startswith("<callout") or s.strip().startswith("</callout"):
            if cur:
                text = "\n".join(cur).strip()
                paras.append({
                    "line": cur_start,
                    "text": text,
                    "sentences": count_sentences(text),
                })
                cur = []
                cur_start = 0
            continue
        if not cur:
            cur_start = line_no
        cur.append(s)
    if cur:
        text = "\n".join(cur).strip()
        paras.append({
            "line": cur_start,
            "text": text,
            "sentences": count_sentences(text),
        })

    return paras


def line_ratios(md: str):
    lines = md.splitlines()
    total = len(lines)
    list_lines = sum(1 for l in lines if is_list_line(l))
    hr = sum(1 for l in lines if l.strip() == "---")
    callout_open = sum(1 for l in lines if "<callout" in l)
    mermaid = sum(1 for l in lines if l.strip().startswith("```mermaid"))
    bold = sum(1 for l in lines if "**" in l)

    nonblank_lines = 0
    non_code_list_lines = 0
    bullet_list_lines = 0
    ordered_list_lines = 0
    content_lines = 0
    prose_lines = 0
    structural_lines = 0
    for _, line in iter_non_code_lines(md):
        if not line.strip():
            continue
        nonblank_lines += 1
        if is_list_line(line):
            content_lines += 1
            non_code_list_lines += 1
            if ORDERED_LIST_ITEM_RE.match(line):
                ordered_list_lines += 1
            else:
                bullet_list_lines += 1
            continue
        if is_content_line(line):
            content_lines += 1
            prose_lines += 1
        else:
            structural_lines += 1

    return {
        "lines": total,
        "listLineRatio": (list_lines / total) if total else 0,
        "nonblankLines": nonblank_lines,
        "contentLineCount": content_lines,
        "proseLineCount": prose_lines,
        "structuralLineCount": structural_lines,
        "listLineCount": non_code_list_lines,
        "bulletLineCount": bullet_list_lines,
        "orderedListLineCount": ordered_list_lines,
        "listLineRatioNonblank": (
            non_code_list_lines / nonblank_lines
        ) if nonblank_lines else 0,
        "listLineRatioContent": (
            non_code_list_lines / content_lines
        ) if content_lines else 0,
        "hrCount": hr,
        "calloutCount": callout_open,
        "mermaidCount": mermaid,
        "boldLineRatio": (bold / total) if total else 0,
    }


def list_block_stats(md: str):
    blocks = []
    cur = 0
    cur_start = 0
    cur_end = 0
    in_code = False
    section_index = 0

    def flush_block():
        nonlocal cur, cur_start, cur_end
        if cur:
            blocks.append({
                "length": cur,
                "startLine": cur_start,
                "endLine": cur_end,
                "sectionIndex": section_index,
            })
            cur = 0
            cur_start = 0
            cur_end = 0

    for line_no, line in enumerate(md.splitlines(), start=1):
        stripped = line.strip()
        if stripped.startswith("```"):
            flush_block()
            in_code = not in_code
            continue
        if in_code:
            continue
        if HEADING_LINE_RE.match(stripped):
            flush_block()
            section_index += 1
            continue
        if is_list_line(line):
            if not cur:
                cur_start = line_no
            cur += 1
            cur_end = line_no
            continue
        flush_block()

    flush_block()

    lengths = [block["length"] for block in blocks]
    adjacent_pairs = 0
    max_adjacent_run = 0
    current_run = 0
    previous = None
    for block in blocks:
        if (
            previous
            and block["sectionIndex"] == previous["sectionIndex"]
            and block["startLine"] - previous["endLine"] <= 6
        ):
            adjacent_pairs += 1
            current_run = max(2, current_run + 1)
        else:
            current_run = 1 if blocks else 0
        max_adjacent_run = max(max_adjacent_run, current_run)
        previous = block

    return {
        "listBlockCount": len(lengths),
        "listBlockLengths": lengths,
        "maxListBlock": max(lengths) if lengths else 0,
        "mediumListBlocks": sum(1 for b in lengths if 4 <= b <= 7),
        "listBlocksOver3": sum(1 for b in lengths if b > 3),
        "listBlocksOver7": sum(1 for b in lengths if b > 7),
        "listBlocksOver10": sum(1 for b in lengths if b > 10),
        "adjacentListBlockPairs": adjacent_pairs,
        "maxAdjacentListBlockRun": max_adjacent_run,
    }


def opening_shape_stats(md: str):
    lines = md.splitlines()
    if not lines:
        return {
            "windowEndLine": 0,
            "nonblankLines": 0,
            "contentLineCount": 0,
            "listLineCount": 0,
            "listLineRatioNonblank": 0,
            "listLineRatioContent": 0,
        }

    raw_window_end = min(len(lines), max(20, min(60, int(len(lines) * 0.30))))
    max_window_end = min(len(lines), 60)
    window_end = raw_window_end
    nonblank_lines = 0
    content_lines = 0
    list_lines = 0
    in_code = False
    for line_no, line in enumerate(lines, start=1):
        if line_no > raw_window_end and content_lines >= 12:
            break
        if line_no > max_window_end:
            break
        window_end = line_no
        if line.strip().startswith("```"):
            in_code = not in_code
            continue
        if in_code or not line.strip():
            continue
        nonblank_lines += 1
        if is_list_line(line):
            list_lines += 1
        if is_content_line(line):
            content_lines += 1

    return {
        "windowEndLine": window_end,
        "nonblankLines": nonblank_lines,
        "contentLineCount": content_lines,
        "listLineCount": list_lines,
        "listLineRatioNonblank": (list_lines / nonblank_lines) if nonblank_lines else 0,
        "listLineRatioContent": (list_lines / content_lines) if content_lines else 0,
    }


def section_list_stats(md: str):
    sections = []
    current = {
        "title": "(preamble)",
        "headingLevel": 0,
        "line": 1,
        "nonblankLines": 0,
        "contentLineCount": 0,
        "listLineCount": 0,
        "proseLineCount": 0,
        "tableLineCount": 0,
    }
    in_code = False

    def flush_section():
        if current["nonblankLines"]:
            nonblank_ratio = current["listLineCount"] / current["nonblankLines"]
            content_ratio = (
                current["listLineCount"] / current["contentLineCount"]
                if current["contentLineCount"]
                else 0
            )
            sections.append({
                **current,
                "listLineRatioNonblank": nonblank_ratio,
                "listLineRatioContent": content_ratio,
            })

    for line_no, line in enumerate(md.splitlines(), start=1):
        stripped = line.strip()
        if stripped.startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue

        heading = HEADING_LINE_RE.match(stripped)
        heading_level = len(heading.group(1)) if heading else 0
        if heading and 2 <= heading_level <= 3:
            flush_section()
            current = {
                "title": heading.group(2).strip(),
                "headingLevel": heading_level,
                "line": line_no,
                "nonblankLines": 0,
                "contentLineCount": 0,
                "listLineCount": 0,
                "proseLineCount": 0,
                "tableLineCount": 0,
            }
            continue

        if not stripped or heading or stripped == "---":
            continue

        current["nonblankLines"] += 1
        if is_list_line(line):
            current["contentLineCount"] += 1
            current["listLineCount"] += 1
        elif stripped.startswith("|") and stripped.endswith("|"):
            current["tableLineCount"] += 1
        else:
            current["contentLineCount"] += 1
            current["proseLineCount"] += 1

    flush_section()

    dominant_sections = [
        section
        for section in sections
        if section["contentLineCount"] >= 8
        and section["listLineCount"] >= 6
        and section["listLineRatioContent"] >= 0.35
        and section["listLineCount"] > section["proseLineCount"]
    ]

    return {
        "sectionCount": len(sections),
        "dominantSectionCount": len(dominant_sections),
        "maxSectionListLineRatioNonblank": max(
            (section["listLineRatioNonblank"] for section in sections),
            default=0,
        ),
        "maxSectionListLineRatioContent": max(
            (section["listLineRatioContent"] for section in sections),
            default=0,
        ),
        "dominantSections": dominant_sections[:10],
    }


def prose_shape_stats(md: str):
    return {
        "opening": opening_shape_stats(md),
        "sectionList": section_list_stats(md),
    }


def cohesion_stats(md: str):
    paragraphs = paragraph_items(md)
    bridge_count = 0
    short_runs = []
    current_run = []
    bridge_gaps = []
    bridge_gap_runs = []
    current_gap_run = []

    for item in paragraphs:
        text = item["text"]
        has_bridge = bool(COHESION_BRIDGE_RE.search(text))
        if has_bridge:
            bridge_count += 1
            if current_gap_run:
                bridge_gap_runs.append(current_gap_run)
                current_gap_run = []
        else:
            current_gap_run.append(item)
        if item["sentences"] <= 1:
            current_run.append(item)
        else:
            if len(current_run) >= 3:
                short_runs.append(current_run)
            current_run = []
        if not has_bridge:
            bridge_gaps.append({
                "line": item["line"],
                "text": compact_preview(text),
                "sentences": item["sentences"],
            })
    if len(current_run) >= 3:
        short_runs.append(current_run)
    if current_gap_run:
        bridge_gap_runs.append(current_gap_run)

    sent_counts = [item["sentences"] for item in paragraphs]

    return {
        "paragraphCount": len(paragraphs),
        "bridgeParagraphCount": bridge_count,
        "bridgeParagraphRatio": bridge_count / len(paragraphs) if paragraphs else 0,
        "avgSentencesPerParagraph": (sum(sent_counts) / len(sent_counts)) if sent_counts else 0,
        "shortParagraphRunCount": len(short_runs),
        "maxShortParagraphRun": max((len(run) for run in short_runs), default=0),
        "bridgeGapCount": len(bridge_gaps),
        "maxBridgeGapRun": max((len(run) for run in bridge_gap_runs), default=0),
        "bridgeGapSamples": bridge_gaps[:8],
    }


def cue_flatness_stats(md: str):
    cue_lines = []
    segment = 0
    for line_no, line in iter_non_code_lines(md, strip_inline=True):
        stripped = line.strip()
        if not stripped:
            continue
        kind = ""
        label = ""
        if is_list_line(line):
            kind = "list"
            label = cue_prefix(line)
        else:
            heading = HEADING_LINE_RE.match(stripped)
            if heading:
                kind = f"h{len(heading.group(1))}"
                label = cue_prefix(heading.group(2))
            elif item := re.match(r"^(?:Step|步骤|阶段|动作|检查|确认|记录|验证)\s*[\w一二三四五六七八九十0-9.-]*", stripped, re.I):
                kind = "formula"
                label = cue_prefix(item.group(0))
        if kind:
            cue_lines.append({
                "line": line_no,
                "kind": kind,
                "label": label,
                "segment": segment,
                "text": compact_preview(stripped),
            })
        else:
            segment += 1

    flat_runs = []
    current = []
    for item in cue_lines:
        if (
            current
            and item["kind"] == current[-1]["kind"]
            and item["segment"] == current[-1]["segment"]
        ):
            current.append(item)
        else:
            if len(current) >= 5:
                flat_runs.append(current)
            current = [item]
    if len(current) >= 5:
        flat_runs.append(current)

    prefix_counts: dict[str, int] = {}
    prefix_samples: dict[str, list[dict]] = {}
    for item in cue_lines:
        key = item["label"]
        if not key:
            continue
        prefix_counts[key] = prefix_counts.get(key, 0) + 1
        prefix_samples.setdefault(key, []).append(item)

    repeated_prefixes = [
        {
            "prefix": prefix,
            "count": count,
            "samples": prefix_samples[prefix][:4],
        }
        for prefix, count in sorted(prefix_counts.items(), key=lambda pair: (-pair[1], pair[0]))
        if count >= 4
    ]

    return {
        "cueLineCount": len(cue_lines),
        "flatRunCount": len(flat_runs),
        "maxFlatRun": max((len(run) for run in flat_runs), default=0),
        "flatRuns": [
            {
                "kind": run[0]["kind"],
                "startLine": run[0]["line"],
                "endLine": run[-1]["line"],
                "length": len(run),
            }
            for run in flat_runs[:8]
        ],
        "repeatedPrefixCount": len(repeated_prefixes),
        "repeatedPrefixes": repeated_prefixes[:8],
    }


def meta_writing_stats(md: str):
    hits = []
    for line_no, line in iter_non_code_lines(md, strip_inline=True):
        stripped = line.strip()
        if not stripped or is_list_line(stripped) or HEADING_LINE_RE.match(stripped):
            continue
        for match in META_NARRATION_RE.finditer(stripped):
            hits.append({
                "line": line_no,
                "text": compact_preview(stripped),
                "match": compact_preview(match.group(0), limit=50),
            })
            break
    return {
        "hitCount": len(hits),
        "hits": hits[:10],
    }


def reader_movement_stats(md: str):
    items = []
    seen_h2 = False
    for line_no, line in iter_non_code_lines(md, strip_inline=True):
        stripped = line.strip()
        heading = HEADING_LINE_RE.match(stripped)
        if heading and len(heading.group(1)) == 2:
            seen_h2 = True
            if items:
                break
            continue
        if seen_h2 and items:
            break
        if not stripped or is_list_line(line) or HEADING_LINE_RE.match(stripped):
            continue
        items.append({"line": line_no, "text": stripped})
        if len(items) >= 6:
            break

    opening_text = "\n".join(item["text"] for item in items)
    signals = {
        "object": signal_present(READER_OBJECT_RE, opening_text),
        "problem": signal_present(READER_PROBLEM_RE, opening_text),
        "claim": signal_present(READER_CLAIM_RE, opening_text),
        "action": signal_present(READER_ACTION_RE, opening_text),
    }
    missing = [name for name, present in signals.items() if not present]

    return {
        "openingParagraphCount": len(items),
        "signals": signals,
        "missingSignals": missing,
        "openingSamples": [
            {"line": item["line"], "text": compact_preview(item["text"])}
            for item in items[:4]
        ],
    }


def semantic_repetition_stats(md: str):
    units = []
    for line_no, line in iter_non_code_lines(md, strip_inline=True):
        stripped = line.strip()
        if not stripped:
            continue
        heading = HEADING_LINE_RE.match(stripped)
        if heading:
            text = heading.group(2).strip()
            kind = f"h{len(heading.group(1))}"
        elif is_list_line(line):
            text = re.sub(LIST_ITEM_RE, "", stripped, count=1).strip()
            kind = "list"
        else:
            text = stripped
            kind = "paragraph"
        key = normalize_sentence_key(text)
        if len(key) < 8:
            continue
        units.append({
            "line": line_no,
            "kind": kind,
            "key": key,
            "prefix": semantic_repeat_prefix(key),
            "text": compact_preview(text),
        })

    exact: dict[str, list[dict]] = {}
    prefixes: dict[str, list[dict]] = {}
    for unit in units:
        exact.setdefault(unit["key"], []).append(unit)
        prefixes.setdefault(unit["prefix"], []).append(unit)

    def public_sample(unit: dict) -> dict:
        return {
            "line": unit["line"],
            "kind": unit["kind"],
            "prefix": unit["prefix"],
            "text": unit["text"],
        }

    exact_repeats = [
        {"count": len(items), "samples": [public_sample(item) for item in items[:4]]}
        for items in exact.values()
        if len(items) >= 2
    ]
    prefix_repeats = [
        {
            "prefix": prefix,
            "count": len(items),
            "samples": [public_sample(item) for item in items[:4]],
        }
        for prefix, items in prefixes.items()
        if len(items) >= 3 and len({item["key"] for item in items}) >= 2
    ]

    max_near_repeat_group = max((item["count"] for item in prefix_repeats), default=0)

    return {
        "unitCount": len(units),
        "exactRepeatCount": len(exact_repeats),
        "nearRepeatCount": len(prefix_repeats),
        "maxNearRepeatGroup": max_near_repeat_group,
        "exactRepeats": exact_repeats[:8],
        "nearRepeats": sorted(prefix_repeats, key=lambda item: -item["count"])[:8],
    }


def prose_mechanics_stats(md: str):
    return {
        "cohesion": cohesion_stats(md),
        "cueFlatness": cue_flatness_stats(md),
        "metaWriting": meta_writing_stats(md),
        "readerMovement": reader_movement_stats(md),
        "semanticRepetition": semantic_repetition_stats(md),
    }


def ai_smells(md: str):
    findings = []
    text = strip_fenced_code(md, strip_inline=True)
    lower = text.lower()
    hits = []
    for w in AI_WORDS_ZH:
        if w in text:
            hits.append(w)
    for w in AI_WORDS_EN:
        if w in lower:
            hits.append(w)
    if hits:
        unique_hits = sorted(set(hits))
        suggestions = {w: AI_WORD_SUGGESTIONS[w] for w in unique_hits if w in AI_WORD_SUGGESTIONS}
        findings.append(
            Finding(
                "WARN",
                "AI_WORDS",
                "Hit AI-ish words; suggested replacements are advisory",
                {"hits": unique_hits, "suggestions": suggestions},
            )
        )

    pat_hits = []
    for pat in AI_PATTERNS:
        if re.search(pat, text):
            pat_hits.append(pat)
    if pat_hits:
        pattern_suggestions = {
            term: suggestions
            for term, suggestions in AI_WORD_SUGGESTIONS.items()
            if any(term in pattern for pattern in pat_hits)
        }
        meta = {"patterns": pat_hits}
        if pattern_suggestions:
            meta["suggestions"] = pattern_suggestions
        findings.append(Finding("WARN", "AI_PATTERNS", "Hit AI-ish sentence patterns", meta))

    return findings


def line_introduces_concept(line: str, term: str) -> bool:
    escaped = re.escape(term)
    patterns = [
        rf"`?{escaped}`?\s*(是|指|表示|意味着|称为)",
        rf"`?{escaped}`?\s*(叫|用于|负责|面向|只管|只负责)",
        rf"`?{escaped}`?\s*(在这里|这里|本文中)?\s*指",
        rf"(这里的|本文中的|所谓)\s*`?{escaped}`?",
        rf"`?{escaped}`?\s*[：:]\s*\S+",
        rf">.*`?{escaped}`?",
    ]
    return any(re.search(pattern, line, flags=re.IGNORECASE) for pattern in patterns)


def series_concept_checks(md: str):
    findings = []
    heading_terms = []
    seen = set()

    for line_no, _level, title in iter_title_and_headings(md):
        stripped_title = strip_code_spans(title)
        for match in SERIES_CONCEPT_RE.finditer(stripped_title):
            term = match.group(0)
            normalized = term.lower()
            if re.fullmatch(r"[a-z]\d+", normalized):
                continue
            if normalized in COMMON_HEADING_WORDS or normalized.isdigit():
                continue
            if len(normalized) <= 2 or normalized in seen:
                continue
            seen.add(normalized)
            heading_terms.append({"line": line_no, "term": term, "heading": title})

    if not heading_terms:
        return findings

    introduced = set()
    for _line_no, line in iter_non_code_lines(md, strip_inline=False):
        for item in heading_terms:
            normalized = item["term"].lower()
            if normalized in introduced:
                continue
            if line_introduces_concept(line, item["term"]):
                introduced.add(normalized)

    missing = [item for item in heading_terms if item["term"].lower() not in introduced]
    if missing:
        findings.append(
            Finding(
                "WARN",
                "SERIES_CONCEPT_FIRST_USE",
                "Heading/title introduces a specialized concept without onsite definition; introduce it before use or add a quote note",
                {"items": missing[:12]},
            )
        )

    return findings


def negation_checks(md: str):
    findings = []
    pair_hits = []
    negation_lines = []
    heading_hits = []

    for line_no, raw_line in iter_non_code_lines(md, strip_inline=True):
        line = raw_line.strip()
        if not line:
            continue

        if re.match(r"^#{2,4}\s+", line) and "不是" in line:
            heading_hits.append({"line": line_no, "title": re.sub(r"^#{2,4}\s+", "", line)})

        pair_count = len(NEGATION_PAIR_RE.findall(line))
        if pair_count:
            pair_hits.append({"line": line_no, "count": pair_count, "text": line[:160]})

        if "不是" in line:
            negation_lines.append({"line": line_no, "text": line[:160]})

    if pair_hits:
        findings.append(
            Finding(
                "WARN",
                "NEGATION_PAIR",
                "Found `不是…而是…` contrast pattern; prefer direct positive claims unless contrast is necessary",
                {
                    "count": sum(item["count"] for item in pair_hits),
                    "items": pair_hits[:12],
                },
            )
        )

    if len(negation_lines) > 3:
        findings.append(
            Finding(
                "WARN",
                "NEGATION_HEAVY",
                "Negation-heavy draft; run a full sweep for `不是`-style contrast and rewrite to direct claims where possible",
                {
                    "count": len(negation_lines),
                    "items": negation_lines[:12],
                },
            )
        )

    if heading_hits:
        findings.append(
            Finding(
                "WARN",
                "HEADING_NEGATION",
                "Heading uses negation; prefer proposition-style headings when possible",
                {"items": heading_hits[:12]},
            )
        )

    return findings


def portability_checks(md: str):
    findings = []
    hits = []
    for pat in PORTABILITY_PATTERNS:
        if re.search(pat, md):
            hits.append(pat)
    if hits:
        findings.append(Finding("WARN", "PORTABILITY_LINKS", "Found likely machine-local link patterns; verify target audience and link layer", {"patterns": hits}))
    return findings


def looks_codeish(span: str) -> bool:
    if any(ch in span for ch in "/\\._:=()[]{}@#"):
        return True
    if span.startswith("--"):
        return True
    if re.fullmatch(r"[A-Z][A-Z0-9_]*", span):
        return True
    if re.fullmatch(r"[A-Za-z0-9_:-]+", span) and ("_" in span or any(ch.isdigit() for ch in span)):
        return True
    if re.search(r"[a-z][A-Z]", span):
        return True
    if re.search(r"\.(md|txt|py|json|yaml|yml|toml|ts|tsx|js|jsx|sh|go|rs)$", span):
        return True
    if span.lower() in {"api", "cli", "sdk", "sql", "json", "yaml", "toml", "csv", "http", "https"}:
        return True
    return False


def line_has_code_context(line: str, prev_nonempty: str) -> bool:
    haystacks = (line, prev_nonempty)
    if any(hint in text for text in haystacks for hint in CODE_CONTEXT_HINTS):
        return True
    if any(marker in line for marker in (".py", ".md", ".json", ".toml", "*.json", "*.md", "cli.py")):
        return True
    return False


def inline_code_checks(md: str):
    findings = []
    hits = []
    prev_nonempty = ""
    table_code_context = False
    for line_no, raw_line in iter_non_code_lines(md, strip_inline=False):
        stripped = raw_line.strip()
        if stripped.startswith("|") and stripped.count("|") >= 2:
            if any(hint in raw_line for hint in CODE_CONTEXT_HINTS):
                table_code_context = True
            elif re.fullmatch(r"\|\s*-+\s*(\|\s*-+\s*)+\|?", stripped):
                pass
            context_codeish = table_code_context or line_has_code_context(raw_line, prev_nonempty)
        else:
            if stripped:
                table_code_context = False
            context_codeish = line_has_code_context(raw_line, prev_nonempty)
        for match in INLINE_CODE_RE.finditer(raw_line):
            span = match.group(1).strip()
            if not span or looks_codeish(span):
                continue
            if context_codeish and re.fullmatch(r"[a-z0-9-]+", span):
                continue
            if re.fullmatch(r"[A-Za-z][A-Za-z0-9-]*", span) and len(span) <= 3:
                continue
            if re.fullmatch(r"[A-Za-z][A-Za-z0-9-]*", span) and span.lower() in {"api", "cli", "sdk", "sql", "json", "yaml", "toml"}:
                continue
            if re.fullmatch(r"[\u4e00-\u9fffA-Za-z][\u4e00-\u9fffA-Za-z \-]{1,80}", span):
                hits.append({"line": line_no, "text": span})
                continue
            if " " in span and not looks_codeish(span):
                hits.append({"line": line_no, "text": span})
        if raw_line.strip():
            prev_nonempty = raw_line
    if hits:
        findings.append(
            Finding(
                "WARN",
                "INLINE_CODE_PLAIN",
                "Inline code used for plain-language concepts; prefer prose or bold unless the code identity matters",
                {"items": hits[:20]},
            )
        )
    return findings


def heading_rules(md: str):
    findings = []
    headings = list(iter_headings(md))
    all_headings = list(iter_title_and_headings(md))
    nodes = build_heading_tree(headings)
    ratios = line_ratios(md)

    h1 = [item for item in all_headings if item[1] == 1]
    if len(h1) != 1:
        findings.append(
            Finding(
                "WARN",
                "H1_COUNT",
                "Document should have exactly one H1 title",
                {"h1Count": len(h1)},
            )
        )
    elif LABEL_LIKE_TITLE_RE.search(h1[0][2].strip()):
        findings.append(
            Finding(
                "WARN",
                "TITLE_LABEL_LIKE",
                "H1 reads like a draft label; prefer a publication-style proposition title",
                {"line": h1[0][0], "title": h1[0][2]},
            )
        )

    # no parentheses in headings
    bad = []
    for n in nodes:
        if re.search(r"[()（）]", n["title"]):
            bad.append({"line": n["line"], "title": n["title"]})
    if bad:
        findings.append(Finding("FAIL", "HEADING_PARENS", "Headings must not contain parentheses", {"items": bad}))

    # H2 count must be 3-7 for long-form docs (heuristic)
    h2 = [n for n in nodes if n["level"] == 2]
    if len(h2) and (len(h2) < 3 or len(h2) > 7):
        findings.append(Finding("WARN", "H2_COUNT", "H2 count should usually be 3–7", {"h2Count": len(h2)}))

    h3 = [n for n in nodes if n["level"] == 3]
    if ratios["contentLineCount"] >= 25 and len(h2) >= 3 and not h3:
        findings.append(
            Finding(
                "WARN",
                "HEADING_DEPTH",
                "Long-form docs should usually have H2 main beams plus at least one H3 layer; avoid flat one-level outlines",
                {
                    "contentLineCount": ratios["contentLineCount"],
                    "h2Count": len(h2),
                    "h3Count": 0,
                },
            )
        )

    # pyramid 3-7 for each parent (only enforced when a parent actually uses sub-headings)
    viol = []
    for n in nodes:
        c = len(n["children"])
        if c == 0:
            continue
        if c < 3 or c > 7:
            viol.append({"line": n["line"], "title": n["title"], "childCount": c})
    if viol:
        findings.append(Finding("WARN", "PYRAMID_3_7", "Some headings violate 3–7 child rule", {"items": viol}))

    # ensure there is at least one H2
    if not any(n["level"] == 2 for n in nodes):
        findings.append(Finding("WARN", "NO_H2", "Document should usually have H2 headings", {}))

    return findings


def semicolon_check(md: str):
    findings = []
    count = md.count("；")
    if count:
        findings.append(Finding("WARN", "SEMICOLON", "Prefer causal/rounded sentences over semicolon joins", {"count": count}))
    return findings


def score(md: str):
    findings = []
    findings += heading_rules(md)
    findings += series_concept_checks(md)
    findings += ai_smells(md)
    findings += negation_checks(md)
    findings += semicolon_check(md)
    findings += portability_checks(md)
    findings += inline_code_checks(md)

    ratios = line_ratios(md)
    list_blocks = list_block_stats(md)
    prose_shape = prose_shape_stats(md)
    prose_mechanics = prose_mechanics_stats(md)
    stats = paragraph_stats(md)

    # heuristics
    if ratios["hrCount"] > 8:
        findings.append(Finding("WARN", "HR_MANY", "Too many horizontal rules (---)", {"hrCount": ratios["hrCount"]}))
    if ratios["calloutCount"] > 8:
        findings.append(Finding("WARN", "CALLOUT_MANY", "Too many callouts", {"calloutCount": ratios["calloutCount"]}))
    if ratios["listLineRatio"] > 0.30:
        findings.append(Finding("WARN", "LIST_HEAVY", "List lines ratio high; may feel like enumerations", {"listLineRatio": ratios["listLineRatio"]}))
    if ratios["listLineCount"] >= 12 and ratios["listLineRatioContent"] > 0.25:
        findings.append(
            Finding(
                "ADVISORY",
                "LIST_DENSITY_ADVISORY",
                "List density is high among content lines; review whether lists are replacing connective explanation",
                {
                    "listLineCount": ratios["listLineCount"],
                    "contentLineCount": ratios["contentLineCount"],
                    "listLineRatioContent": ratios["listLineRatioContent"],
                },
            )
        )
    if list_blocks["maxListBlock"] > 10:
        findings.append(Finding("WARN", "LIST_BLOCK_LONG", "A list block is too long; split, group, or convert to table/heading", list_blocks))
    if list_blocks["mediumListBlocks"] >= 4 or list_blocks["adjacentListBlockPairs"] >= 3:
        findings.append(
            Finding(
                "ADVISORY",
                "LIST_BLOCK_CLUSTER",
                "Multiple medium list blocks appear close together; review whether the section reads like repeated checklists",
                {
                    "listBlockCount": list_blocks["listBlockCount"],
                    "mediumListBlocks": list_blocks["mediumListBlocks"],
                    "adjacentListBlockPairs": list_blocks["adjacentListBlockPairs"],
                    "maxAdjacentListBlockRun": list_blocks["maxAdjacentListBlockRun"],
                },
            )
        )
    opening = prose_shape["opening"]
    if opening["contentLineCount"] >= 12 and opening["listLineCount"] >= 6 and opening["listLineRatioContent"] > 0.30:
        findings.append(
            Finding(
                "ADVISORY",
                "OPENING_MANUAL_FEEL",
                "Opening section leans on list lines; review whether the reader gets a narrative entry before checklist mode",
                opening,
            )
        )
    section_list = prose_shape["sectionList"]
    if section_list["dominantSectionCount"]:
        findings.append(
            Finding(
                "ADVISORY",
                "SECTION_LIST_DOMINANT",
                "At least one section is dominated by list lines; review whether it needs connective prose or a table",
                section_list,
            )
        )
    cohesion = prose_mechanics["cohesion"]
    if (
        cohesion["paragraphCount"] >= 6
        and cohesion["bridgeParagraphRatio"] < 0.25
        and (
            cohesion["maxShortParagraphRun"] >= 4
            or (
                cohesion["maxBridgeGapRun"] >= 6
                and cohesion["avgSentencesPerParagraph"] < 1.8
            )
        )
    ):
        findings.append(
            Finding(
                "ADVISORY",
                "COHESION_DEBT_ADVISORY",
                "Paragraphs have weak connective movement; review whether causal or contrast links need to be written in",
                cohesion,
            )
        )
    cue_flatness = prose_mechanics["cueFlatness"]
    if cue_flatness["maxFlatRun"] >= 7 or cue_flatness["repeatedPrefixCount"] >= 2:
        findings.append(
            Finding(
                "ADVISORY",
                "CUE_FLATNESS_ADVISORY",
                "Repeated cue shapes make the surface feel flat; review whether hierarchy or prose movement is missing",
                cue_flatness,
            )
        )
    meta_writing = prose_mechanics["metaWriting"]
    if meta_writing["hitCount"] >= 3:
        findings.append(
            Finding(
                "ADVISORY",
                "META_WRITING_ADVISORY",
                "Draft narrates its own writing process; review whether those sentences should state the object or claim directly",
                meta_writing,
            )
        )
    reader_movement = prose_mechanics["readerMovement"]
    if (
        reader_movement["openingParagraphCount"] >= 2
        and len(reader_movement["missingSignals"]) >= 2
    ):
        findings.append(
            Finding(
                "ADVISORY",
                "READER_MOVEMENT_ADVISORY",
                "Opening lacks enough reader movement signals; review whether object, problem, claim, and next action are visible",
                reader_movement,
            )
        )
    semantic_repetition = prose_mechanics["semanticRepetition"]
    if (
        semantic_repetition["exactRepeatCount"] >= 1
        or semantic_repetition["nearRepeatCount"] >= 2
        or semantic_repetition["maxNearRepeatGroup"] >= 4
    ):
        findings.append(
            Finding(
                "ADVISORY",
                "SEMANTIC_REPETITION_ADVISORY",
                "Repeated statements or near-repeated starts may be padding; review whether each section adds new information",
                semantic_repetition,
            )
        )
    if stats["avgSentPerPara"] and stats["avgSentPerPara"] < 1.3:
        findings.append(Finding("WARN", "PARA_SHORT", "Paragraphs too short on average; may feel choppy", stats))

    heading_count = sum(1 for _ in iter_headings(md))
    if heading_count and stats["paragraphs"] / heading_count < 1.4:
        findings.append(Finding("WARN", "SECTION_THIN", "Too few paragraphs per heading; avoid one-liner sections", {"paragraphs": stats["paragraphs"], "headings": heading_count}))

    return findings, ratios, list_blocks, prose_shape, prose_mechanics, stats


def parse_args(argv):
    parser = argparse.ArgumentParser(description="Static checks for bagakit-writing-core markdown.")
    parser.add_argument("path", help="Path to the markdown file or directory")
    parser.add_argument(
        "--fail-on",
        choices=("warn", "fail", "none"),
        default="warn",
        help="Exit with code 2 on warnings and failures, failures only, or never",
    )
    return parser.parse_args(argv[1:])


def summarize_findings(findings: list[Finding]) -> dict:
    by_level: dict[str, int] = {}
    by_code: dict[str, int] = {}
    for finding in findings:
        by_level[finding.level] = by_level.get(finding.level, 0) + 1
        by_code[finding.code] = by_code.get(finding.code, 0) + 1
    return {
        "total": len(findings),
        "byLevel": by_level,
        "byCode": dict(sorted(by_code.items())),
    }


def blocking_findings(findings: list[Finding]) -> list[Finding]:
    return [finding for finding in findings if finding.level in {"WARN", "FAIL"}]


def lint_one_file(p: Path) -> tuple[dict, list[Finding]]:
    md = read_text(p)
    findings, ratios, list_blocks, prose_shape, prose_mechanics, stats = score(md)
    report = {
        "file": str(p),
        "ratios": ratios,
        "listBlocks": list_blocks,
        "proseShape": prose_shape,
        "proseMechanics": prose_mechanics,
        "paragraph": stats,
        "findings": [f.__dict__ for f in findings],
    }
    return report, findings


def lint_directory(p: Path) -> tuple[dict, list[Finding]]:
    files = sorted(
        candidate for candidate in p.rglob("*.md")
        if candidate.is_file()
    )
    reports = []
    all_findings: list[Finding] = []
    all_blocking_findings: list[Finding] = []
    files_with_findings = 0
    files_with_blocking_findings = 0
    files_with_advisory_only_findings = 0
    for file_path in files:
        report, findings = lint_one_file(file_path)
        blocking = blocking_findings(findings)
        reports.append(report)
        all_findings.extend(findings)
        all_blocking_findings.extend(blocking)
        if findings:
            files_with_findings += 1
        if blocking:
            files_with_blocking_findings += 1
        elif findings:
            files_with_advisory_only_findings += 1
    summary = {
        "path": str(p),
        "filesScanned": len(files),
        "filesWithFindings": files_with_findings,
        "filesWithBlockingFindings": files_with_blocking_findings,
        "filesWithAdvisoryOnlyFindings": files_with_advisory_only_findings,
        "findings": summarize_findings(all_findings),
        "blockingFindings": summarize_findings(all_blocking_findings),
    }
    return {"path": str(p), "summary": summary, "files": reports}, all_findings


def main(argv):
    args = parse_args(argv)
    p = Path(args.path).expanduser()
    if not p.exists():
        print(f"file not found: {p}")
        return 2

    if p.is_dir():
        report, findings = lint_directory(p)
    else:
        report, findings = lint_one_file(p)

    print(json.dumps(report, ensure_ascii=False, indent=2))

    has_fail = any(f.level == "FAIL" for f in findings)
    has_blocking_warn = any(f.level == "WARN" for f in findings)
    if args.fail_on == "none":
        return 0
    if args.fail_on == "fail":
        return 2 if has_fail else 0
    return 2 if has_fail or has_blocking_warn else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
