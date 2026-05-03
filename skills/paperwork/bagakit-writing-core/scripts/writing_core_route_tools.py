"""writing_core_route_tools.py

Lightweight route tools for bagakit-writing-core.

Usage:
  python3 scripts/writing_core_route_tools.py check-foundation [--kind auto|route|handoff|packet] path/to/file.md
  python3 scripts/writing_core_route_tools.py review-foundation path/to/draft-or-route.md
  python3 scripts/writing_core_route_tools.py derive-route path/to/handoff.md [--output path/to/route-state.md]

Exit codes:
  0: check passed / derive succeeded
  2: unstable or invalid input
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


TOP_LEVEL_BULLET_RE = re.compile(r"^- ([A-Za-z0-9_]+):(.*)$")
H2_RE = re.compile(r"^##\s+(.+?)\s*$")
H3_RE = re.compile(r"^###\s+(.+?)\s*$")
QUESTION_RE = re.compile(r"[?？]|(first_question|第一问题|核心问题|要回答)", re.I)
EVIDENCE_RE = re.compile(r"(evidence|source|引用|证据|样本|数据|case|fixture|benchmark|http|`[^`]+`|\d+)", re.I)
SAMPLE_BOUNDARY_RE = re.compile(r"(sample|scope|boundary|window|样本|边界|范围|对象|口径)", re.I)
COUNTER_RE = re.compile(r"(counter|反例|反证|风险|限制|limitation|unless|except|除非|但|不过)", re.I)
ACTION_RE = re.compile(r"(next|action|owner|metric|acceptance|下一步|动作|触发|验收|负责人|指标|决策)", re.I)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def parse_top_level_fields(text: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        match = TOP_LEVEL_BULLET_RE.match(line)
        if not match:
            continue
        key = match.group(1).strip()
        value = match.group(2).strip()
        fields[key] = value
    return fields


def parse_sections(text: str) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {}
    current: str | None = None
    in_code = False
    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        if line.strip().startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        h2 = H2_RE.match(line)
        if h2:
            current = h2.group(1).strip()
            sections.setdefault(current, [])
            continue
        if H3_RE.match(line):
            continue
        if current is None:
            continue
        if line.strip():
            sections[current].append(line)
    return sections


def detect_kind(fields: dict[str, str], sections: dict[str, list[str]]) -> str:
    if "promoted_claim" in fields or "chosen_viewpoint" in fields:
        return "handoff"
    if "escalation_trigger" in fields or "Frontier Shortlist" in sections:
        return "packet"
    return "route"


def nonempty(value: str | None) -> bool:
    if value is None:
        return False
    normalized = value.strip()
    return bool(normalized and normalized not in {"-", "—", "TODO", "TBD"})


def required_fields_for(kind: str) -> list[str]:
    if kind == "route":
        return [
            "title_promise",
            "first_question",
            "evidence_movement",
            "chapter_movement",
            "exit_move",
        ]
    if kind == "handoff":
        return [
            "promoted_claim",
            "chosen_viewpoint",
            "title_promise",
            "first_question",
            "evidence_movement",
            "chapter_movement",
            "exit_move",
            "hard_boundary",
            "evidence_pack",
            "return_gate_passed_because",
        ]
    return [
        "draft_topic",
        "escalation_trigger",
        "draft_risk_if_skip",
    ]


def required_sections_for(kind: str) -> list[str]:
    if kind != "packet":
        return []
    return [
        "Frontier Shortlist",
        "Theory Basis",
        "Completed Reverse Outlines",
        "Synthesis Memo",
    ]


def next_action_for(kind: str, stable: bool) -> str:
    if kind == "route":
        return "angle_selection" if stable else "depth_escalation_or_insight_loop"
    if kind == "handoff":
        return "drafting" if stable else "return_to_depth_packet"
    return "fill_research_to_draft_handoff" if stable else "continue_research"


def visible_lines(text: str) -> list[str]:
    lines: list[str] = []
    in_code = False
    for raw in text.splitlines():
        if raw.strip().startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        line = raw.strip()
        if line:
            lines.append(line)
    return lines


def dimension(name: str, status: str, evidence: list[str], fix: str) -> dict:
    return {
        "name": name,
        "status": status,
        "evidence": evidence[:5],
        "smallestNextAction": fix,
    }


def foundation_review(path: Path) -> tuple[dict, int]:
    text = read_text(path)
    fields = parse_top_level_fields(text)
    lines = visible_lines(text)
    headings = [match.group(1).strip() for line in lines if (match := H2_RE.match(line) or H3_RE.match(line))]
    title_lines = [line for line in lines if line.startswith("# ")]

    object_evidence = []
    if nonempty(fields.get("title_promise")):
        object_evidence.append(f"title_promise: {fields['title_promise']}")
    object_evidence.extend(title_lines[:2])
    object_status = "stable" if object_evidence and not any("TODO" in item or "TBD" in item for item in object_evidence) else "missing"

    first_question_evidence = []
    if nonempty(fields.get("first_question")):
        first_question_evidence.append(f"first_question: {fields['first_question']}")
    first_question_evidence.extend([line for line in lines if QUESTION_RE.search(line)][:3])
    first_question_status = "stable" if first_question_evidence else "missing"

    evidence_lines = [line for line in lines if EVIDENCE_RE.search(line)]
    evidence_status = "stable" if len(evidence_lines) >= 2 else "partial" if evidence_lines else "missing"

    sample_lines = [line for line in lines if SAMPLE_BOUNDARY_RE.search(line)]
    sample_status = "stable" if sample_lines else "partial" if evidence_lines else "missing"

    counter_lines = [line for line in lines if COUNTER_RE.search(line)]
    counter_status = "stable" if counter_lines else "partial"

    action_lines = [line for line in lines if ACTION_RE.search(line)]
    action_status = "stable" if action_lines else "missing"

    dimensions = [
        dimension("object_boundary", object_status, object_evidence or headings, "Name the object and boundary in one sentence."),
        dimension("first_question", first_question_status, first_question_evidence, "Write the reader's first question before drafting."),
        dimension("evidence_shape", evidence_status, evidence_lines, "Name the evidence type: source, sample, command, metric, or example."),
        dimension("sample_boundary", sample_status, sample_lines, "State the sample/scope boundary or mark it unknown."),
        dimension("counterevidence", counter_status, counter_lines, "Add one counterexample, limitation, or falsifier."),
        dimension("reader_action", action_status, action_lines, "Add the next action, trigger, owner, metric, or acceptance condition."),
    ]
    critical_missing = [
        item["name"]
        for item in dimensions
        if item["name"] in {"object_boundary", "first_question", "evidence_shape", "reader_action"}
        and item["status"] == "missing"
    ]
    partial_count = sum(1 for item in dimensions if item["status"] == "partial")
    missing_count = sum(1 for item in dimensions if item["status"] == "missing")
    if critical_missing:
        status = "unstable"
    elif missing_count or partial_count > 2:
        status = "partial"
    else:
        status = "stable"
    next_action = "draft_or_rewrite" if status == "stable" else dimensions[0]["smallestNextAction"]
    for item in dimensions:
        if item["status"] in {"missing", "partial"}:
            next_action = item["smallestNextAction"]
            break
    report = {
        "schema": "bagakit.writing_core_foundation_review.v1",
        "file": str(path),
        "status": status,
        "stable": status == "stable",
        "dimensions": dimensions,
        "blockers": critical_missing,
        "smallestNextAction": next_action,
    }
    return report, 0 if status in {"stable", "partial"} else 2


def check_foundation(path: Path, forced_kind: str) -> tuple[dict, int]:
    text = read_text(path)
    fields = parse_top_level_fields(text)
    sections = parse_sections(text)
    kind = detect_kind(fields, sections) if forced_kind == "auto" else forced_kind

    required_fields = required_fields_for(kind)
    required_sections = required_sections_for(kind)
    missing_fields = [key for key in required_fields if not nonempty(fields.get(key))]
    missing_sections = [
        name for name in required_sections
        if not sections.get(name) or not any(item.strip() for item in sections[name])
    ]
    stable = not missing_fields and not missing_sections

    report = {
        "file": str(path),
        "kind": kind,
        "stable": stable,
        "requiredFields": required_fields,
        "requiredSections": required_sections,
        "missingFields": missing_fields,
        "missingSections": missing_sections,
        "nextAction": next_action_for(kind, stable),
    }
    return report, 0 if stable else 2


def derive_route(handoff_path: Path, output_path: Path | None) -> tuple[str, int]:
    text = read_text(handoff_path)
    fields = parse_top_level_fields(text)
    required_fields = required_fields_for("handoff")
    missing = [key for key in required_fields if not nonempty(fields.get(key))]
    if missing:
        return json.dumps(
            {
                "file": str(handoff_path),
                "kind": "handoff",
                "stable": False,
                "requiredFields": required_fields,
                "missingFields": missing,
                "error": "missing_required_fields",
                "message": "handoff is missing required fields for derive-route",
                "msg": "handoff is missing required fields for derive-route",
            },
            ensure_ascii=False,
            indent=2,
        ), 2

    route_state = "\n".join(
        [
            "# Derived Route State View",
            "",
            "- authority_note: non-authoritative view derived from the handoff below",
            f"- source_handoff: {handoff_path}",
            f"- promoted_claim: {fields['promoted_claim']}",
            f"- chosen_viewpoint: {fields['chosen_viewpoint']}",
            f"- title_promise: {fields['title_promise']}",
            f"- first_question: {fields['first_question']}",
            f"- evidence_movement: {fields['evidence_movement']}",
            f"- chapter_movement: {fields['chapter_movement']}",
            f"- exit_move: {fields['exit_move']}",
            f"- hard_boundary: {fields['hard_boundary']}",
            f"- evidence_pack: {fields['evidence_pack']}",
            f"- return_gate_passed_because: {fields['return_gate_passed_because']}",
            "",
        ]
    )

    if output_path is not None:
        output_path.write_text(route_state, encoding="utf-8")

    return route_state, 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Lightweight route tools for bagakit-writing-core.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    check = sub.add_parser("check-foundation", help="Check whether a route memo, handoff, or depth packet is stable enough.")
    check.add_argument("path", help="Path to a markdown artifact")
    check.add_argument("--kind", choices=("auto", "route", "handoff", "packet"), default="auto")

    review = sub.add_parser("review-foundation", help="Review content-aware foundation sufficiency for a draft or route artifact.")
    review.add_argument("path", help="Path to a markdown artifact")

    derive = sub.add_parser("derive-route", help="Derive a non-authoritative route-state view from a research-to-draft handoff.")
    derive.add_argument("path", help="Path to a handoff markdown file")
    derive.add_argument("--output", help="Optional output path for the derived route-state view")

    return parser


def main(argv: list[str]) -> int:
    parser = build_parser()
    args = parser.parse_args(argv[1:])

    if args.cmd == "check-foundation":
        path = Path(args.path).expanduser()
        if not path.exists():
            print(f"file not found: {path}")
            return 2
        report, exit_code = check_foundation(path, args.kind)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return exit_code

    if args.cmd == "review-foundation":
        path = Path(args.path).expanduser()
        if not path.exists():
            print(f"file not found: {path}")
            return 2
        report, exit_code = foundation_review(path)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return exit_code

    if args.cmd == "derive-route":
        path = Path(args.path).expanduser()
        if not path.exists():
            print(f"file not found: {path}")
            return 2
        output = Path(args.output).expanduser() if args.output else None
        rendered, exit_code = derive_route(path, output)
        print(rendered)
        return exit_code

    parser.print_help()
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
