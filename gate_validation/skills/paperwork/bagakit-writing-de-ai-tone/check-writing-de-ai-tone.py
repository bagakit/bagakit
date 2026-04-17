"""Validate bagakit-writing-de-ai-tone public behavior."""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path


SKILL_DIR = Path("skills/paperwork/bagakit-writing-de-ai-tone")
FIXTURE_DIR = Path("gate_validation/skills/paperwork/bagakit-writing-de-ai-tone/fixtures")


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


def codes(payload: dict) -> set[str]:
    return {
        str(item.get("code"))
        for item in payload.get("findings", [])
        if isinstance(item, dict)
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="Repository root")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    failures: list[str] = []
    cli = SKILL_DIR / "scripts/bagakit-writing-de-ai-tone-cli.sh"
    core_cli = Path("skills/paperwork/bagakit-writing-core/scripts/bagakit-writing-core-cli.sh")

    for path in [
        SKILL_DIR / "SKILL.md",
        SKILL_DIR / "references/patterns.md",
        SKILL_DIR / "references/rewrite-protocol.md",
        SKILL_DIR / "references/context-profiles.toml",
        SKILL_DIR / "references/lexicon.json",
        SKILL_DIR / "references/frontdoor-rule.toml",
        SKILL_DIR / "references/skill-cli.toml",
        SKILL_DIR / "scripts/de_ai_tone_lint.py",
        cli,
    ]:
        require((root / path).is_file(), f"missing required file: {path}", failures)

    if failures:
        for failure in failures:
            print(f"error: {failure}")
        return 1

    validate = run(["bash", str(cli), "validate"], root)
    require(validate.returncode == 0, f"CLI validate failed: {validate.stderr}", failures)

    describe = run(["bash", str(cli), "describe"], root)
    require(describe.returncode == 0, "describe failed", failures)
    require("bagakit-writing-de-ai-tone" in describe.stdout, "describe missing skill id", failures)

    protocol = run(["bash", str(cli), "print-rewrite-protocol"], root)
    require(protocol.returncode == 0, "print-rewrite-protocol failed", failures)
    for token in ["Detect Mode", "Rewrite Mode", "Second-pass audit"]:
        require(token in protocol.stdout, f"rewrite protocol missing token: {token}", failures)

    zh = run(
        [
            "bash",
            str(cli),
            "lint",
            "--profile",
            "blog",
            "--fail-on",
            "none",
            str(FIXTURE_DIR / "ai-tone-zh.md"),
        ],
        root,
    )
    require(zh.returncode == 0, f"zh lint failed: {zh.stderr}", failures)
    zh_payload = load_json(zh.stdout, "zh lint", failures)
    zh_codes = codes(zh_payload)
    for expected in [
        "P1_FORMULAIC_OPENING",
        "P1_PROCESS_FILLER",
        "P1_LEXICON_ALWAYS",
        "P1_FAKE_CONTRAST",
        "P0_VAGUE_AUTHORITY",
        "P0_SIGNIFICANCE_INFLATION",
    ]:
        require(expected in zh_codes, f"zh fixture missed {expected}", failures)

    conflict = run(
        [
            "bash",
            str(cli),
            "lint",
            "--profile",
            "blog",
            "--fail-on",
            "none",
            str(FIXTURE_DIR / "conflict-bait.md"),
        ],
        root,
    )
    require(conflict.returncode == 0, f"conflict-bait lint failed: {conflict.stderr}", failures)
    conflict_payload = load_json(conflict.stdout, "conflict-bait lint", failures)
    conflict_codes = codes(conflict_payload)
    for expected in [
        "P1_CONFLICT_BAIT_BINARY",
        "P1_UNSUPPORTED_PEOPLE_GENERALIZATION",
    ]:
        require(expected in conflict_codes, f"conflict-bait fixture missed {expected}", failures)

    tech = run(
        [
            "bash",
            str(cli),
            "lint",
            "--profile",
            "technical",
            "--fail-on",
            "none",
            str(FIXTURE_DIR / "technical-exemption.md"),
        ],
        root,
    )
    require(tech.returncode == 0, f"technical lint failed: {tech.stderr}", failures)
    tech_payload = load_json(tech.stdout, "technical lint", failures)
    require(
        "P1_LEXICON_ALWAYS" not in codes(tech_payload),
        "technical profile should exempt precise technical terms in fixture",
        failures,
    )

    advisory = run(
        [
            "bash",
            str(cli),
            "lint",
            "--profile",
            "blog",
            str(FIXTURE_DIR / "advisory-only.md"),
        ],
        root,
    )
    advisory_payload = load_json(advisory.stdout, "advisory lint", failures)
    require(advisory.returncode == 0, "advisory-only fixture should not fail default lint", failures)
    require(
        advisory_payload.get("summary", {}).get("advisory", 0) > 0,
        "advisory-only fixture should produce advisory findings",
        failures,
    )

    core = run(
        [
            "bash",
            str(core_cli),
            "de-ai-tone",
            "lint",
            "--profile",
            "blog",
            "--fail-on",
            "none",
            str(FIXTURE_DIR / "ai-tone-zh.md"),
        ],
        root,
    )
    require(core.returncode == 0, f"writing-core de-ai-tone dispatch failed: {core.stderr}", failures)
    core_payload = load_json(core.stdout, "core de-ai-tone dispatch", failures)
    require(core_payload.get("schema") == "bagakit.de_ai_tone_lint.v1", "core dispatch should return de-AI-tone lint schema", failures)

    if failures:
        print("writing de-AI-tone gate failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print("ok: writing de-AI-tone gate passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
