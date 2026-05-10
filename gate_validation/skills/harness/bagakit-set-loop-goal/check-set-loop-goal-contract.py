from __future__ import annotations

import argparse
import re
from pathlib import Path


WITH_SUPERVISOR = """@./.bagakit/goal/current.md
Read current.md first; it resolves state.yaml, foreground_goal, and the active Goal.

@./.bagakit/goal/supervisor.md
Read supervisor.md when present; run checkpoint rules around bounded work.

Context may be stale or wrong; recover from these files before trusting prior context.
"""

WITHOUT_SUPERVISOR = """@./.bagakit/goal/current.md
Read current.md first; it resolves state.yaml, foreground_goal, and the active Goal.

Context may be stale or wrong; recover from this file before trusting prior context.
"""


def extract_code_block(text: str, marker: str) -> str:
    index = text.find(marker)
    if index == -1:
        raise SystemExit(f"error: could not find marker: {marker}")
    block_start = text.find("```text", index)
    if block_start == -1:
        raise SystemExit(f"error: could not find code block after marker: {marker}")
    content_start = text.find("\n", block_start) + 1
    content_end = text.find("```", content_start)
    if content_end == -1:
        raise SystemExit(f"error: unterminated code block after marker: {marker}")
    return text[content_start:content_end]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"error: {message}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    args = parser.parse_args()

    root = Path(args.root)
    skill = root / "skills/harness/bagakit-set-loop-goal/SKILL.md"
    contract = root / "skills/harness/bagakit-set-loop-goal/references/goal-file-contract.md"
    loop_off = root / "skills/harness/bagakit-set-loop-goal/references/loop-off-loop.md"
    frontdoor = root / "skills/harness/bagakit-set-loop-goal/references/frontdoor-rule.toml"
    skill_cli = root / "skills/harness/bagakit-set-loop-goal/references/skill-cli.toml"

    skill_text = skill.read_text(encoding="utf-8")
    contract_text = contract.read_text(encoding="utf-8")
    loop_text = loop_off.read_text(encoding="utf-8")
    frontdoor_text = frontdoor.read_text(encoding="utf-8")
    skill_cli_text = skill_cli.read_text(encoding="utf-8")

    contract_with = extract_code_block(contract_text, "With supervisor:")
    contract_without = extract_code_block(contract_text, "Without supervisor:")
    loop_with = extract_code_block(loop_text, "With supervisor:")
    loop_without = extract_code_block(loop_text, "Without supervisor:")

    require(contract_with == WITH_SUPERVISOR, "goal-file-contract with-supervisor wrapper drifted")
    require(contract_without == WITHOUT_SUPERVISOR, "goal-file-contract without-supervisor wrapper drifted")
    require(loop_with == WITH_SUPERVISOR, "loop-off-loop with-supervisor wrapper drifted")
    require(loop_without == WITHOUT_SUPERVISOR, "loop-off-loop without-supervisor wrapper drifted")

    require(".bagakit/goal/current.md" in frontdoor_text, "frontdoor rule must reference current.md")
    require(".bagakit/goal/state.yaml" in frontdoor_text, "frontdoor rule must reference state.yaml")
    require(".bagakit/goal/archive/" in frontdoor_text, "frontdoor rule must reference archive/")

    for command in [
        "initialize-surface",
        "upsert-goal",
        "set-foreground",
        "set-supervision",
        "relate-goals",
        "request-evolver-review",
        "record-evolver-review",
        "append-goal-event",
        "reconcile-goal",
        "render-wrapper",
        "fresh-check",
        "archive-goal",
        "show-surface",
    ]:
        require(f'name = "{command}"' in skill_cli_text, f"skill-cli.toml missing command entry: {command}")

    require(".bagakit/goal/current.md" in skill_text, "SKILL.md must reference current.md ownership")
    require(".bagakit/goal/state.yaml" in skill_text, "SKILL.md must reference state.yaml ownership")
    require("references/loop-off-loop.md" in skill_text, "SKILL.md must route to loop-off-loop reference")
    require("references/goal-file-contract.md" in skill_text, "SKILL.md must route to goal-file-contract reference")
    require("session-review intake" in loop_text, "loop-off-loop must define the Evolver handoff route")
    require("`session_end` is opportunistic only" in contract_text, "goal contract must keep session_end opportunistic")
    require(
        re.search(r"`stale` means expected\s+evidence is absent", contract_text) is not None,
        "goal contract must define stale as missing evidence",
    )
    require(".bagakit/goal/reviews/<review-id>.json" in frontdoor_text, "frontdoor rule must reference review receipts")

    print("bagakit-set-loop-goal contract passed")


if __name__ == "__main__":
    main()
