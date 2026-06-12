"""Build and compare lightweight no-regression inventories for markdown prose."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


INLINE_CODE_RE = re.compile(r"`([^`]+)`")
URL_RE = re.compile(r"https?://[^\s)>\"]+")
PATH_RE = re.compile(r"(?:^|\s)([A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)+)")
METRIC_RE = re.compile(r"\b\d+(?:\.\d+)?\s?(?:%|ms|s|MB|GB|tokens?|次|个|条|人|天)\b", re.I)
VERSION_RE = re.compile(r"\bv?\d+\.\d+(?:\.\d+)?\b")
HEADING_RE = re.compile(r"^#{1,6}\s+(.+?)\s*$")

CATEGORY_PATTERNS = {
    "claims": re.compile(r"(结论|判断|主张|说明|意味着|should|must|is |are |needs? to|需要|应该|必须|不能)", re.I),
    "evidence": re.compile(r"(证据|来源|引用|样本|数据|source|evidence|example|case|benchmark|fixture|http)", re.I),
    "constraints": re.compile(r"(约束|边界|禁止|不得|不能|必须|除非|non-goal|must not|required|unless|except)", re.I),
    "actions": re.compile(r"(下一步|执行|运行|验收|触发|owner|metric|action|next|run|check|validate)", re.I),
    "risks": re.compile(r"(风险|反例|缺口|失败|阻塞|counterevidence|risk|failure|blocker|limitation)", re.I),
}


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def clean_line(line: str) -> str:
    return re.sub(r"\s+", " ", line.strip())


def non_code_lines(text: str) -> list[str]:
    lines: list[str] = []
    in_code = False
    for raw in text.splitlines():
        if raw.strip().startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        line = clean_line(raw)
        if line:
            lines.append(line)
    return lines


def add_sample(items: list[str], line: str, limit: int) -> None:
    sample = line[:180]
    if sample not in items and len(items) < limit:
        items.append(sample)


def technical_tokens(text: str) -> list[str]:
    tokens: list[str] = []
    for pattern in (INLINE_CODE_RE, URL_RE, PATH_RE, METRIC_RE, VERSION_RE):
        for match in pattern.finditer(text):
            value = match.group(1) if match.lastindex else match.group(0)
            value = value.strip()
            if value and value not in tokens:
                tokens.append(value)
    return tokens


def build_inventory(path: Path, sample_limit: int = 8) -> dict:
    text = read_text(path)
    lines = non_code_lines(text)
    categories: dict[str, dict[str, object]] = {
        name: {"count": 0, "samples": []}
        for name in ["claims", "evidence", "constraints", "actions", "risks", "technical_details"]
    }
    headings: list[str] = []
    for line in lines:
        heading = HEADING_RE.match(line)
        if heading:
            headings.append(heading.group(1))
            categories["claims"]["count"] = int(categories["claims"]["count"]) + 1
            add_sample(categories["claims"]["samples"], line, sample_limit)  # type: ignore[arg-type]
        for name, pattern in CATEGORY_PATTERNS.items():
            if pattern.search(line):
                categories[name]["count"] = int(categories[name]["count"]) + 1
                add_sample(categories[name]["samples"], line, sample_limit)  # type: ignore[arg-type]
    tech = technical_tokens(text)
    categories["technical_details"]["count"] = len(tech)
    categories["technical_details"]["samples"] = tech[:sample_limit]
    return {
        "schema": "bagakit.writing_core_inventory.v1",
        "file": str(path),
        "headings": headings[:sample_limit],
        "categories": categories,
        "protected_like_tokens": tech[:50],
    }


def compare_inventories(source: dict, rewrite: dict) -> dict:
    missing_categories: list[dict[str, object]] = []
    source_categories = source.get("categories", {})
    rewrite_categories = rewrite.get("categories", {})
    for name, source_entry in source_categories.items():
        source_count = int(source_entry.get("count", 0))
        rewrite_count = int(rewrite_categories.get(name, {}).get("count", 0))
        if source_count > 0 and rewrite_count == 0:
            missing_categories.append({
                "category": name,
                "source_count": source_count,
                "rewrite_count": rewrite_count,
                "source_samples": source_entry.get("samples", []),
            })
    source_tokens = set(source.get("protected_like_tokens", []))
    rewrite_tokens = set(rewrite.get("protected_like_tokens", []))
    missing_tokens = sorted(source_tokens - rewrite_tokens)
    risk = bool(missing_categories or missing_tokens)
    return {
        "schema": "bagakit.writing_core_inventory_compare.v1",
        "status": "risk" if risk else "pass",
        "regressionRisk": risk,
        "missingCategories": missing_categories,
        "missingProtectedLikeTokens": missing_tokens[:50],
        "source": source,
        "rewrite": rewrite,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)
    inv = sub.add_parser("inventory", help="Emit a no-regression inventory for one artifact")
    inv.add_argument("path")
    inv.add_argument("--sample-limit", type=int, default=8)
    cmp_p = sub.add_parser("compare", help="Compare source and rewrite inventories")
    cmp_p.add_argument("source")
    cmp_p.add_argument("rewrite")
    cmp_p.add_argument("--fail-on", choices=("none", "risk"), default="none")
    return parser


def main(argv: list[str]) -> int:
    parser = build_parser()
    args = parser.parse_args(argv[1:])
    if args.cmd == "inventory":
        path = Path(args.path)
        if not path.is_file():
            print(json.dumps({"ok": False, "error": f"file not found: {path}"}, indent=2))
            return 2
        print(json.dumps(build_inventory(path, args.sample_limit), ensure_ascii=False, indent=2))
        return 0
    if args.cmd == "compare":
        source_path = Path(args.source)
        rewrite_path = Path(args.rewrite)
        if not source_path.is_file() or not rewrite_path.is_file():
            print(json.dumps({"ok": False, "error": "source or rewrite file not found"}, indent=2))
            return 2
        report = compare_inventories(build_inventory(source_path), build_inventory(rewrite_path))
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 2 if args.fail_on == "risk" and report["regressionRisk"] else 0
    parser.print_help()
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
