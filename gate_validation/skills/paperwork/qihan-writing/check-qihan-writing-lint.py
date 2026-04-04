"""Regression checks for qihan_write_lint.py advisory metrics."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


PROSE_SHAPE_CODES = {
    "LIST_DENSITY_ADVISORY",
    "LIST_BLOCK_CLUSTER",
    "OPENING_MANUAL_FEEL",
    "SECTION_LIST_DOMINANT",
}
PROSE_MECHANICS_CODES = {
    "COHESION_DEBT_ADVISORY",
    "CUE_FLATNESS_ADVISORY",
    "META_WRITING_ADVISORY",
    "READER_MOVEMENT_ADVISORY",
    "SEMANTIC_REPETITION_ADVISORY",
}

ABSOLUTE_ROOT_NAMES = (
    "Users",
    "private",
    "home",
    "var",
    "tmp",
    "opt",
    "mnt",
    "Volumes",
    "workspace",
    "workspaces",
    "data",
    "srv",
)

FORBIDDEN_FIXTURE_TOKENS = (
    *(f"/{name}/" for name in ABSOLUTE_ROOT_NAMES[:3]),
    "~/",
    "$HOME/",
    "${HOME}/",
    "file" + "://",
    "ssh" + "://",
    "git@",
    "github.com/",
    "http://",
    "https://",
    "harness-devloop",
    "larkvc",
    "bytedance",
    "廖家",
)
FORBIDDEN_FIXTURE_TOKENS_LOWER = tuple(
    token.lower() for token in FORBIDDEN_FIXTURE_TOKENS
)

FORBIDDEN_FIXTURE_PATTERNS = (
    re.compile(r"(?i)\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b"),
    re.compile(r"(?<!\w)(?:~|\$HOME|\$\{HOME\})/[\w./-]+"),
    re.compile(r"\b(?:[A-Za-z]:\\|/(?:"
               + "|".join(re.escape(name) for name in ABSOLUTE_ROOT_NAMES)
               + r")/)\S+"),
    re.compile(r"(?<!\w)/(?:[A-Za-z0-9_.-]+/){2,}[A-Za-z0-9_.-]+"),
    re.compile(r"\b(?:ssh|git|https?)://\S+", re.I),
    re.compile(r"\bgit@[A-Za-z0-9_.-]+:[^\s]+"),
    re.compile(r"\b(?:[a-z0-9-]+\.)+(?:com|cn|net|org|io|dev)\b", re.I),
)


def run_lint(root: Path, fixture: Path, *, fail_on: str = "none") -> tuple[int, dict]:
    lint_script = root / "skills/paperwork/qihan-writing/scripts/qihan_write_lint.py"
    proc = subprocess.run(
        [sys.executable, str(lint_script), "--fail-on", fail_on, str(fixture)],
        cwd=root,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if proc.returncode != 0:
        raise AssertionError(
            f"qihan_write_lint.py failed for {fixture}: {proc.stderr.strip()}"
        )
    return proc.returncode, json.loads(proc.stdout)


def run_lint_allow_exit(root: Path, fixture: Path, *, fail_on: str = "warn") -> tuple[int, dict]:
    lint_script = root / "skills/paperwork/qihan-writing/scripts/qihan_write_lint.py"
    proc = subprocess.run(
        [sys.executable, str(lint_script), "--fail-on", fail_on, str(fixture)],
        cwd=root,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if proc.stdout.strip():
        return proc.returncode, json.loads(proc.stdout)
    raise AssertionError(
        f"qihan_write_lint.py produced no JSON for {fixture}: {proc.stderr.strip()}"
    )


def finding_codes(report: dict) -> set[str]:
    return {str(finding.get("code")) for finding in report.get("findings", [])}


def findings_by_code(report: dict, code: str) -> list[dict]:
    return [
        finding
        for finding in report.get("findings", [])
        if finding.get("code") == code
    ]


def finding_codes_from_directory(report: dict) -> set[str]:
    codes: set[str] = set()
    for file_report in report.get("files", []):
        codes.update(finding_codes(file_report))
    return codes


def assert_metric_shape(report: dict) -> None:
    ratios = report.get("ratios", {})
    list_blocks = report.get("listBlocks", {})
    prose_shape = report.get("proseShape", {})
    opening = prose_shape.get("opening", {})
    section_list = prose_shape.get("sectionList", {})

    required_ratio_keys = {
        "nonblankLines",
        "contentLineCount",
        "proseLineCount",
        "structuralLineCount",
        "listLineCount",
        "bulletLineCount",
        "orderedListLineCount",
        "listLineRatioNonblank",
        "listLineRatioContent",
    }
    missing_ratio_keys = sorted(required_ratio_keys - set(ratios))
    if missing_ratio_keys:
        raise AssertionError(f"missing ratio metrics: {missing_ratio_keys}")

    required_block_keys = {
        "listBlockLengths",
        "mediumListBlocks",
        "listBlocksOver3",
        "adjacentListBlockPairs",
        "maxAdjacentListBlockRun",
    }
    missing_block_keys = sorted(required_block_keys - set(list_blocks))
    if missing_block_keys:
        raise AssertionError(f"missing list block metrics: {missing_block_keys}")

    if not {"windowEndLine", "listLineRatioContent"} <= set(opening):
        raise AssertionError("missing opening prose-shape metrics")
    if not {
        "dominantSectionCount",
        "dominantSections",
        "maxSectionListLineRatioContent",
    } <= set(section_list):
        raise AssertionError("missing section list dominance metrics")


def assert_mechanics_shape(report: dict) -> None:
    mechanics = report.get("proseMechanics", {})
    required = {
        "cohesion",
        "cueFlatness",
        "metaWriting",
        "readerMovement",
        "semanticRepetition",
    }
    missing = sorted(required - set(mechanics))
    if missing:
        raise AssertionError(f"missing prose mechanics metrics: {missing}")

    if "bridgeParagraphRatio" not in mechanics["cohesion"]:
        raise AssertionError("missing cohesion bridge ratio")
    if "flatRuns" not in mechanics["cueFlatness"]:
        raise AssertionError("missing cue flatness runs")
    if "hits" not in mechanics["metaWriting"]:
        raise AssertionError("missing meta-writing hits")
    if "missingSignals" not in mechanics["readerMovement"]:
        raise AssertionError("missing reader movement signals")
    if "nearRepeats" not in mechanics["semanticRepetition"]:
        raise AssertionError("missing semantic repetition groups")


def assert_expected_advisory(report: dict, code: str) -> None:
    matches = findings_by_code(report, code)
    if not matches:
        raise AssertionError(f"report missed {code}")
    bad_levels = sorted(
        str(finding.get("level"))
        for finding in matches
        if finding.get("level") != "ADVISORY"
    )
    if bad_levels:
        raise AssertionError(f"{code} should stay ADVISORY, got {bad_levels}")


def assert_fixture_desensitized(fixture: Path) -> None:
    text = fixture.read_text(encoding="utf-8")
    lower_text = text.lower()
    leaked = [
        token
        for token, lower_token in zip(
            FORBIDDEN_FIXTURE_TOKENS,
            FORBIDDEN_FIXTURE_TOKENS_LOWER,
        )
        if lower_token in lower_text
    ]
    if leaked:
        raise AssertionError(f"fixture contains non-desensitized tokens: {leaked}")
    pattern_hits = [
        pattern.pattern
        for pattern in FORBIDDEN_FIXTURE_PATTERNS
        if pattern.search(text)
    ]
    if pattern_hits:
        raise AssertionError(f"fixture contains leak-like patterns: {pattern_hits}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="Repository root")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    fixtures_dir = (
        root / "gate_validation/skills/paperwork/qihan-writing/fixtures/prose-shape"
    )
    mechanics_dir = (
        root / "gate_validation/skills/paperwork/qihan-writing/fixtures/prose-mechanics"
    )
    mechanical = fixtures_dir / "mechanical-guide.md"
    balanced = fixtures_dir / "balanced-note.md"
    advisory_only = fixtures_dir / "advisory-only.md"
    mechanics_cases = {
        "cohesion-debt.md": "COHESION_DEBT_ADVISORY",
        "cue-flatness.md": "CUE_FLATNESS_ADVISORY",
        "meta-writing.md": "META_WRITING_ADVISORY",
        "reader-movement.md": "READER_MOVEMENT_ADVISORY",
        "semantic-repetition.md": "SEMANTIC_REPETITION_ADVISORY",
        "semantic-near-repeat.md": "SEMANTIC_REPETITION_ADVISORY",
    }
    mechanics_clean = mechanics_dir / "clean-longform.md"

    for fixture in (mechanical, balanced, advisory_only, *(
        mechanics_dir / name for name in mechanics_cases
    ), mechanics_clean):
        assert_fixture_desensitized(fixture)

    _, mechanical_report = run_lint(root, mechanical)
    assert_metric_shape(mechanical_report)
    assert_mechanics_shape(mechanical_report)
    mechanical_codes = finding_codes(mechanical_report)
    missing_codes = sorted(PROSE_SHAPE_CODES - mechanical_codes)
    if missing_codes:
        raise AssertionError(f"mechanical fixture missed advisory codes: {missing_codes}")
    if "LIST_HEAVY" in mechanical_codes:
        raise AssertionError("mechanical fixture should avoid the legacy LIST_HEAVY rule")
    if mechanical_report["ratios"]["listLineRatio"] >= 0.25:
        raise AssertionError("mechanical fixture should stay clearly below legacy ratio")

    _, balanced_report = run_lint(root, balanced)
    assert_metric_shape(balanced_report)
    assert_mechanics_shape(balanced_report)
    if balanced_report["ratios"]["listLineCount"] != 2:
        raise AssertionError("balanced fixture should ignore list-like lines inside code fences")
    balanced_codes = finding_codes(balanced_report)
    unexpected_codes = sorted(PROSE_SHAPE_CODES & balanced_codes)
    if unexpected_codes:
        raise AssertionError(f"balanced fixture got prose-shape warnings: {unexpected_codes}")
    unexpected_mechanics = sorted(PROSE_MECHANICS_CODES & balanced_codes)
    if unexpected_mechanics:
        raise AssertionError(
            f"balanced fixture got prose-mechanics advisories: {unexpected_mechanics}"
        )

    default_exit, advisory_report = run_lint_allow_exit(root, advisory_only)
    assert_metric_shape(advisory_report)
    assert_mechanics_shape(advisory_report)
    advisory_codes = finding_codes(advisory_report)
    missing_advisory_codes = sorted(PROSE_SHAPE_CODES - advisory_codes)
    if missing_advisory_codes:
        raise AssertionError(f"advisory-only fixture missed codes: {missing_advisory_codes}")
    blocking_levels = {
        finding.get("level")
        for finding in advisory_report.get("findings", [])
        if finding.get("level") != "ADVISORY"
    }
    if blocking_levels:
        raise AssertionError(f"advisory-only fixture has blocking findings: {blocking_levels}")
    if default_exit != 0:
        raise AssertionError("advisory-only findings should not make default lint fail")

    for file_name, expected_code in mechanics_cases.items():
        fixture = mechanics_dir / file_name
        exit_code, report = run_lint_allow_exit(root, fixture)
        assert_metric_shape(report)
        assert_mechanics_shape(report)
        codes = finding_codes(report)
        if expected_code not in codes:
            raise AssertionError(f"{file_name} missed {expected_code}")
        assert_expected_advisory(report, expected_code)
        if exit_code != 0 and not any(
            finding.get("level") in {"WARN", "FAIL"}
            for finding in report.get("findings", [])
        ):
            raise AssertionError(
                f"{file_name} has only advisory findings but default lint failed"
            )

    _, reader_report = run_lint(root, mechanics_dir / "reader-movement.md")
    missing_signals = set(
        reader_report["proseMechanics"]["readerMovement"]["missingSignals"]
    )
    if "action" not in missing_signals:
        raise AssertionError("reader-movement fixture should cover missing action")

    _, near_report = run_lint(root, mechanics_dir / "semantic-near-repeat.md")
    repetition = near_report["proseMechanics"]["semanticRepetition"]
    if repetition["exactRepeatCount"] != 0 or repetition["maxNearRepeatGroup"] < 4:
        raise AssertionError("semantic near-repeat fixture should cover near-only repeats")

    _, clean_report = run_lint(root, mechanics_clean)
    assert_metric_shape(clean_report)
    assert_mechanics_shape(clean_report)
    clean_codes = finding_codes(clean_report)
    clean_mechanics = sorted(PROSE_MECHANICS_CODES & clean_codes)
    if clean_mechanics:
        raise AssertionError(
            f"clean mechanics fixture got prose-mechanics advisories: {clean_mechanics}"
        )

    _, mechanics_report = run_lint(root, mechanics_dir)
    mechanics_codes = finding_codes_from_directory(mechanics_report)
    missing_mechanics = sorted(PROSE_MECHANICS_CODES - mechanics_codes)
    if missing_mechanics:
        raise AssertionError(f"mechanics directory missed codes: {missing_mechanics}")

    _, directory_report = run_lint(root, fixtures_dir)
    summary = directory_report.get("summary", {})
    if summary.get("filesWithAdvisoryOnlyFindings", 0) < 1:
        raise AssertionError("directory summary should count advisory-only files")
    if "blockingFindings" not in summary:
        raise AssertionError("directory summary should expose blocking finding counts")

    print("ok: qihan-writing lint advisory metrics regression passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
