#!/usr/bin/env python3
"""qihan_write_lint.py

Static checks for qihan-writing outputs (Markdown / Lark-flavored Markdown).

Usage:
  python scripts/qihan_write_lint.py [--fail-on warn|fail|none] path/to/doc.md

Exit codes:
  0: pass
  2: warnings/failures found

No external deps.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path


AI_WORDS_ZH = [
    # high-risk generic words (context-dependent). Keep this list short to reduce false positives.
    # Expand only when we repeatedly see a word correlate with "AI smell" in your feedback.
    "赋能", "打造", "范式",
    # note: "构建/全面" are often legitimate in technical writing; do NOT flag by default.
    "挂起", "钉死", "挂出来",
]

AI_WORDS_EN = [
    "crucial", "vital", "pivotal", "robust", "seamless", "cutting-edge", "leverage", "delve",
]

AI_PATTERNS = [
    r"通过.+从而.+进而",
    r"到底是什么",
    r"本文将",
    r"这篇(总结|文章|稿子)(以|将|会|主要)",
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
    r"这种说(法|词)",
    r"接得住",
    r"被[^。！？\n]{0,10}接住",
]

NEGATION_PAIR_RE = re.compile(r"不是[^\n。！？!?；;]{0,80}而是")

PORTABILITY_PATTERNS = [
    r"/(?:[^/\s)]+/){2,}[^/\s)]+",
    r"file://",
]


@dataclass
class Finding:
    level: str  # INFO/WARN/FAIL
    code: str
    msg: str
    meta: dict


def read_text(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="ignore")


def strip_code_spans(text: str) -> str:
    return re.sub(r"`[^`\n]+`", " ", text)


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
    # paragraphs separated by blank lines; ignore headings, tables, list blocks, code blocks
    lines = md.splitlines()
    paras = []
    cur = []
    in_code = False
    for line in lines:
        s = line.rstrip("\n")
        if s.strip().startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        if not s.strip():
            if cur:
                paras.append("\n".join(cur).strip())
                cur = []
            continue
        if re.match(r"^#{1,6}\s+", s.strip()):
            if cur:
                paras.append("\n".join(cur).strip())
                cur = []
            continue
        if re.match(r"^\s*[-*+]\s+", s) or re.match(r"^\s*\d+\.\s+", s):
            # treat list lines as not paragraphs
            if cur:
                paras.append("\n".join(cur).strip())
                cur = []
            continue
        if s.strip().startswith("|") and s.strip().endswith("|"):
            if cur:
                paras.append("\n".join(cur).strip())
                cur = []
            continue
        if s.strip().startswith("<callout") or s.strip().startswith("</callout"):
            if cur:
                paras.append("\n".join(cur).strip())
                cur = []
            continue
        cur.append(s)
    if cur:
        paras.append("\n".join(cur).strip())

    sent_counts = [count_sentences(p) for p in paras]
    return {
        "paragraphs": len(paras),
        "avgSentPerPara": (sum(sent_counts) / len(sent_counts)) if sent_counts else 0,
        "sentPerPara": sent_counts,
    }


def line_ratios(md: str):
    lines = md.splitlines()
    total = len(lines)
    list_lines = sum(1 for l in lines if re.match(r"^\s*([-*+]\s+|\d+\.\s+)", l))
    hr = sum(1 for l in lines if l.strip() == "---")
    callout_open = sum(1 for l in lines if "<callout" in l)
    mermaid = sum(1 for l in lines if l.strip().startswith("```mermaid"))
    bold = sum(1 for l in lines if "**" in l)
    return {
        "lines": total,
        "listLineRatio": (list_lines / total) if total else 0,
        "hrCount": hr,
        "calloutCount": callout_open,
        "mermaidCount": mermaid,
        "boldLineRatio": (bold / total) if total else 0,
    }


def list_block_stats(md: str):
    blocks = []
    cur = 0
    in_code = False

    for line in md.splitlines():
        if line.strip().startswith("```"):
            in_code = not in_code
            if not in_code and cur:
                blocks.append(cur)
                cur = 0
            continue
        if in_code:
            continue
        if re.match(r"^\s*([-*+]\s+|\d+\.\s+)", line):
            cur += 1
            continue
        if cur:
            blocks.append(cur)
            cur = 0

    if cur:
        blocks.append(cur)

    return {
        "listBlockCount": len(blocks),
        "maxListBlock": max(blocks) if blocks else 0,
        "listBlocksOver7": sum(1 for b in blocks if b > 7),
        "listBlocksOver10": sum(1 for b in blocks if b > 10),
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
        findings.append(Finding("WARN", "AI_WORDS", "Hit AI-ish words", {"hits": sorted(set(hits))}))

    pat_hits = []
    for pat in AI_PATTERNS:
        if re.search(pat, text):
            pat_hits.append(pat)
    if pat_hits:
        findings.append(Finding("WARN", "AI_PATTERNS", "Hit AI-ish sentence patterns", {"patterns": pat_hits}))

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


def heading_rules(md: str):
    findings = []
    headings = list(iter_headings(md))
    nodes = build_heading_tree(headings)

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
    findings += ai_smells(md)
    findings += negation_checks(md)
    findings += semicolon_check(md)
    findings += portability_checks(md)

    ratios = line_ratios(md)
    list_blocks = list_block_stats(md)
    stats = paragraph_stats(md)

    # heuristics
    if ratios["hrCount"] > 8:
        findings.append(Finding("WARN", "HR_MANY", "Too many horizontal rules (---)", {"hrCount": ratios["hrCount"]}))
    if ratios["calloutCount"] > 8:
        findings.append(Finding("WARN", "CALLOUT_MANY", "Too many callouts", {"calloutCount": ratios["calloutCount"]}))
    if ratios["listLineRatio"] > 0.30:
        findings.append(Finding("WARN", "LIST_HEAVY", "List lines ratio high; may feel like enumerations", {"listLineRatio": ratios["listLineRatio"]}))
    if list_blocks["maxListBlock"] > 10:
        findings.append(Finding("WARN", "LIST_BLOCK_LONG", "A list block is too long; split, group, or convert to table/heading", list_blocks))
    if stats["avgSentPerPara"] and stats["avgSentPerPara"] < 1.3:
        findings.append(Finding("WARN", "PARA_SHORT", "Paragraphs too short on average; may feel choppy", stats))

    heading_count = sum(1 for _ in iter_headings(md))
    if heading_count and stats["paragraphs"] / heading_count < 1.4:
        findings.append(Finding("WARN", "SECTION_THIN", "Too few paragraphs per heading; avoid one-liner sections", {"paragraphs": stats["paragraphs"], "headings": heading_count}))

    return findings, ratios, list_blocks, stats


def parse_args(argv):
    parser = argparse.ArgumentParser(description="Static checks for qihan-writing markdown.")
    parser.add_argument("path", help="Path to the markdown file")
    parser.add_argument(
        "--fail-on",
        choices=("warn", "fail", "none"),
        default="warn",
        help="Exit with code 2 on warnings and failures, failures only, or never",
    )
    return parser.parse_args(argv[1:])


def main(argv):
    args = parse_args(argv)
    p = Path(args.path).expanduser()
    if not p.exists():
        print(f"file not found: {p}")
        return 2
    md = read_text(p)
    findings, ratios, list_blocks, stats = score(md)

    report = {
        "file": str(p),
        "ratios": ratios,
        "listBlocks": list_blocks,
        "paragraph": stats,
        "findings": [f.__dict__ for f in findings],
    }

    print(json.dumps(report, ensure_ascii=False, indent=2))

    has_fail = any(f.level == "FAIL" for f in findings)
    if args.fail_on == "none":
        return 0
    if args.fail_on == "fail":
        return 2 if has_fail else 0
    return 2 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
