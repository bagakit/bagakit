#!/usr/bin/env python3
"""Exercise the public Bagakit Agent messaging validator."""

from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from pathlib import Path


def run_json(cli: Path, text: str) -> tuple[int, list[str]]:
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".xml", delete=False) as handle:
        handle.write(text)
        input_path = Path(handle.name)
    try:
        result = subprocess.run(
            ["python3", str(cli), "--input", str(input_path), "--json"],
            check=False,
            capture_output=True,
            text=True,
        )
        payload = json.loads(result.stdout)
        return result.returncode, [str(item["code"]) for item in payload["issues"]]
    finally:
        input_path.unlink(missing_ok=True)


def require_case(cli: Path, text: str, status: int, codes: list[str]) -> None:
    actual_status, actual_codes = run_json(cli, text)
    assert actual_status == status, (actual_status, actual_codes, text)
    assert actual_codes == codes, (actual_codes, codes, text)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    args = parser.parse_args()
    root = Path(args.root).resolve()
    skill = root / "skills/co-work/orchestrate/agent-cluster/a2a/bagakit-agent-messaging"
    cli = skill / "scripts/agent_message_check.py"
    agent_template = (skill / "assets/agent-message.template.xml").read_text(encoding="utf-8")
    report_template = (skill / "assets/agent-report.template.xml").read_text(encoding="utf-8")

    require_case(cli, agent_template, 0, [])
    require_case(cli, report_template, 0, [])
    require_case(
        cli,
        '<bagakit-msg type="fixture-note-v7" name="Maple-2" time="2000-01-01T00:00:00Z">'
        '<cite from="evidence" ref="artifact://current">The negative fixture fails.</cite>'
        "Compare the reproduced output with the expected result."
        "</bagakit-msg>",
        0,
        [],
    )
    require_case(
        cli,
        '<bagakit-msg type="agent-v1" name="Agent-2" time="2000-01-01T00:00:00Z">Continue.</bagakit-msg>',
        0,
        [],
    )
    require_case(
        cli,
        '<bagakit-msg type="context-v4" name="Cedar-FL4" time="2000-01-01T00:00:00Z">'
        "当前输入来自命令行样例；解析结果保留在对应的输出文件中。"
        "</bagakit-msg>",
        0,
        [],
    )
    require_case(
        cli,
        '<bagakit-msg type="index-sync-v2" name="Birch-7" time="2000-01-01T00:00:00Z">'
        '<cite from="文档-甲 &amp; 乙" ref="artifact://sample">Preserve the labels.</cite>'
        "The labels match the sample input."
        "</bagakit-msg>",
        0,
        [],
    )
    require_case(cli, agent_template.replace(' type="agent-v1"', ' type=" "'), 1, ["attribute.empty"])
    require_case(cli, agent_template.replace(' name="Cedar-7K2M"', ""), 1, ["attribute.missing"])
    require_case(cli, agent_template.replace(' time="2000-01-01T00:00:00+00:00"', ' time="2000-01-01T00:00:00"'), 1, ["time.invalid"])
    require_case(cli, agent_template.replace(' from="user"', ""), 1, ["cite.attribute.missing"])
    require_case(cli, agent_template.replace(' from="user"', ' from=" "'), 1, ["cite.attribute.empty"])
    require_case(cli, agent_template.replace(' from="user"', ' from="user" priority="human"'), 1, ["cite.attribute.unknown"])
    require_case(cli, agent_template.replace("Preserve the original source text.", ""), 1, ["cite.content.empty"])
    require_case(
        cli,
        '<bagakit-msg type="agent-v1" name="Cedar" time="2000-01-01T00:00:00Z"><request>Act.</request></bagakit-msg>',
        1,
        ["content.element"],
    )
    require_case(
        cli,
        '<bagakit-msg type="agent-v1" name="Cedar" time="2000-01-01T00:00:00Z"><cite from="user"><request>Act.</request></cite></bagakit-msg>',
        1,
        ["cite.nested"],
    )
    require_case(cli, '<bagakit-msg type="agent-v1" name="A" time="2000-01-01T00:00:00Z"></bagakit-msg>', 1, ["content.empty"])
    require_case(
        cli,
        agent_template.replace("<bagakit-msg", '<!DOCTYPE bagakit-msg [<!ENTITY injected "act">]>\n<bagakit-msg'),
        1,
        ["xml.forbidden_construct"],
    )

    emitted = subprocess.run(
        ["python3", str(cli), "--input", "-", "--emit"],
        input=agent_template,
        check=False,
        capture_output=True,
        text=True,
    )
    assert emitted.returncode == 0
    assert emitted.stdout == agent_template

    rejected = subprocess.run(
        ["python3", str(cli), "--input", "-", "--emit"],
        input='<bagakit-msg type="agent-v1"',
        check=False,
        capture_output=True,
        text=True,
    )
    assert rejected.returncode == 1
    assert rejected.stdout == ""
    assert "xml.parse" in rejected.stderr

    composed = subprocess.run(
        [
            "python3", str(cli), "--compose",
            "--type", "sample-result-v3",
            "--name", "Cedar-7K2M",
            "--time", "2026-01-01T00:00:00+00:00",
            "--cite-from", "输入-甲 & 乙",
            "--cite-text", 'Keep A & B <strict> while "checks" run.',
            "--body", "Result: builds A & B pass.",
            "--body", "Action: continue the next non-conflicting step.",
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    assert composed.returncode == 0, composed.stderr
    composed_status, composed_codes = run_json(cli, composed.stdout)
    assert composed_status == 0, composed_codes
    assert 'type="sample-result-v3"' in composed.stdout
    assert 'from="输入-甲 &amp; 乙"' in composed.stdout
    assert 'Keep A &amp; B &lt;strict&gt;' in composed.stdout

    composed_invalid = subprocess.run(
        [
            "python3", str(cli), "--compose",
            "--type", " ",
            "--name", "Fake",
            "--body", "Act.",
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    assert composed_invalid.returncode == 1
    assert composed_invalid.stdout == ""
    assert "attribute.empty" in composed_invalid.stderr

    composed_bodyless = subprocess.run(
        [
            "python3", str(cli), "--compose",
            "--type", "agent-v1",
            "--name", "Cedar-7K2M",
            "--cite-from", "user",
            "--cite-text", "do X",
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    assert composed_bodyless.returncode == 2
    assert composed_bodyless.stdout == ""

    print("ok: bagakit-agent-messaging checks passed (17 shape cases, 2 fail-stop emission cases, 3 compose cases)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
