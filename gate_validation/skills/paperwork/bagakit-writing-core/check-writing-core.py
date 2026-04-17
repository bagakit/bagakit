"""Validate bagakit-writing-core public behavior."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path


SKILL_DIR = Path("skills/paperwork/bagakit-writing-core")


def run(cmd: list[str], root: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=root,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def require(condition: bool, message: str, failures: list[str]) -> None:
    if not condition:
        failures.append(message)


def load_json(stdout: str, label: str, failures: list[str]) -> dict:
    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError as exc:
        failures.append(f"{label} did not emit valid JSON: {exc}")
        return {}
    if not isinstance(payload, dict):
        failures.append(f"{label} JSON payload must be an object")
        return {}
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="Repository root")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    failures: list[str] = []

    cli = SKILL_DIR / "scripts/bagakit-writing-core-cli.sh"
    lint_script = SKILL_DIR / "scripts/writing_core_lint.py"
    route_script = SKILL_DIR / "scripts/writing_core_route_tools.py"
    review_template = SKILL_DIR / "references/review/REVIEW_PACKET_TEMPLATE.md"
    anti_rationalization = SKILL_DIR / "references/review/ANTI_RATIONALIZATION_TABLE.md"
    de_ai_cli = Path("skills/paperwork/bagakit-writing-de-ai-tone/scripts/bagakit-writing-de-ai-tone-cli.sh")
    readme = SKILL_DIR / "README.md"

    for path in [
        SKILL_DIR / "SKILL.md",
        readme,
        SKILL_DIR / "references/README.md",
        cli,
        lint_script,
        route_script,
        review_template,
        anti_rationalization,
        Path("skills/paperwork/bagakit-writing-de-ai-tone/references/lexicon.json"),
        de_ai_cli,
    ]:
        require((root / path).is_file(), f"missing required file: {path}", failures)

    if failures:
        for failure in failures:
            print(f"error: {failure}")
        return 1

    cli_validate = run(["bash", str(cli), "validate"], root)
    require(cli_validate.returncode == 0, "skill CLI validate failed", failures)

    de_ai_proc = run(["bash", str(cli), "de-ai-tone", "describe"], root)
    require(de_ai_proc.returncode == 0, "writing-core de-ai-tone dispatch failed", failures)
    require(
        "bagakit-writing-de-ai-tone" in de_ai_proc.stdout,
        "writing-core de-ai-tone dispatch did not reach de-AI-tone primitive",
        failures,
    )

    readme_text = (root / readme).read_text(encoding="utf-8")
    for token in [
        "L1 paperwork core",
        "not a book exporter",
        "Commands",
        "core should not silently inherit an L2",
        "core MUST run the de-AI-tone pass",
    ]:
        require(token in readme_text, f"README missing boundary token: {token}", failures)

    reference_text = "\n".join(
        path.read_text(encoding="utf-8")
        for path in (root / SKILL_DIR / "references").rglob("*")
        if path.is_file() and path.suffix in {".md", ".json", ".toml"}
    )
    for forbidden in ["花叔", "橙皮书", "DeerFlow", "公众号", "飞书"]:
        require(
            forbidden not in reference_text,
            f"writing-core references should not carry L2 or borrowed-source token: {forbidden}",
            failures,
        )

    review_proc = run(["bash", str(cli), "print-review-packet-template"], root)
    require(review_proc.returncode == 0, "print-review-packet-template failed", failures)
    for token in [
        "skill: `bagakit-writing-core`",
        "Evidence And Sample Boundary",
        "counterevidence",
        "reviewer_ownership",
        "docs/specs/review-packet-contract.md",
    ]:
        require(token in review_proc.stdout, f"review packet template missing token: {token}", failures)

    anti_proc = run(["bash", str(cli), "print-anti-rationalization-table"], root)
    require(anti_proc.returncode == 0, "print-anti-rationalization-table failed", failures)
    for token in [
        "Rationalization",
        "Required Action",
        "The model knows the tool or API",
        "accepted deviation",
    ]:
        require(token in anti_proc.stdout, f"anti-rationalization table missing token: {token}", failures)

    tmp_parent = root / ".bagakit" / "tmp"
    tmp_parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="writing-core-gate-", dir=tmp_parent) as tmp_dir:
        tmp = Path(tmp_dir)
        route = tmp / "route.md"
        route.write_text(
            "\n".join(
                [
                    "# Route",
                    "",
                    "- title_promise: A title must make a judgment.",
                    "- first_question: What should the reader decide first?",
                    "- evidence_movement: Start from claim, then evidence.",
                    "- chapter_movement: Move from problem to mechanism to action.",
                    "- exit_move: Decide the next writing action.",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        route_proc = run(["bash", str(cli), "route", "check-foundation", str(route)], root)
        require(route_proc.returncode == 0, f"route check failed: {route_proc.stderr}", failures)
        route_payload = load_json(route_proc.stdout, "route check", failures)
        require(route_payload.get("stable") is True, "route check should mark fixture stable", failures)

        incomplete_handoff = tmp / "incomplete-handoff.md"
        incomplete_handoff.write_text(
            "\n".join(
                [
                    "# Handoff",
                    "",
                    "- title_promise: A title must make a judgment.",
                    "- first_question: What should the reader decide first?",
                    "- evidence_movement: Start from claim, then evidence.",
                    "- chapter_movement: Move from problem to mechanism to action.",
                    "- exit_move: Decide the next writing action.",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        derive_proc = run(["bash", str(cli), "route", "derive-route", str(incomplete_handoff)], root)
        require(derive_proc.returncode == 2, "derive-route should reject incomplete handoff", failures)
        derive_payload = load_json(derive_proc.stdout, "derive-route incomplete handoff", failures)
        require(derive_payload.get("stable") is False, "derive-route error should mark handoff unstable", failures)
        require(
            derive_payload.get("error") == "missing_required_fields",
            "derive-route error should be structured",
            failures,
        )
        missing = set(derive_payload.get("missingFields", []))
        for expected_missing in [
            "promoted_claim",
            "chosen_viewpoint",
            "hard_boundary",
            "evidence_pack",
            "return_gate_passed_because",
        ]:
            require(
                expected_missing in missing,
                f"derive-route missingFields should include {expected_missing}",
                failures,
            )

        draft = tmp / "draft.md"
        draft.write_text(
            "\n".join(
                [
                    "# Title With A Claim",
                    "",
                    "## First Claim",
                    "",
                    "本文将通过多个步骤从而进而说明这个问题。",
                    "",
                    "- one",
                    "- two",
                    "- three",
                    "- four",
                    "",
                    "## Second Claim",
                    "",
                    "The next action is check.",
                    "",
                    "## Third Claim",
                    "",
                    "Goal, status, next step.",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        lint_proc = run(["bash", str(cli), "lint", "--fail-on", "none", str(draft)], root)
        require(lint_proc.returncode == 0, f"lint command failed: {lint_proc.stderr}", failures)
        lint_payload = load_json(lint_proc.stdout, "lint", failures)
        require("findings" in lint_payload, "lint output missing findings", failures)
        require("proseMechanics" in lint_payload, "lint output missing proseMechanics", failures)
        codes = {str(item.get("code")) for item in lint_payload.get("findings", [])}
        require(
            "AI_PATTERNS" in codes or "LIST_BLOCK_CLUSTER" in codes,
            "lint fixture should produce a writing signal",
            failures,
        )

    if failures:
        print("writing-core gate failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print("ok: writing-core gate passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
