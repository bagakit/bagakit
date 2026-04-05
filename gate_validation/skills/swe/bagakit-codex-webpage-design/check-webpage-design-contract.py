"""Check bagakit-codex-webpage-design wording contract anchors."""

from __future__ import annotations

import argparse
from pathlib import Path


REQUIRED_PHRASES = {
    "skills/swe/bagakit-codex-webpage-design/SKILL.md": [
        "reference-context-first webpage design engineering workflow",
        "Do not start implementation with no design reference",
        "thin operating protocol",
        "historical failures live in `gate_eval/`",
        "prefer adding or updating a bench case",
        "`design-brief`",
        "`reference-intent`",
        "`image-prompt` and `design-reference`",
        "`state-reference-set`",
        "`visual-decomposition`",
        "`ambition-bar`",
        "`information-architecture-map`, `workflow-model`",
        "`workflow-model`, `control-surface-map`, and `interaction-model`",
        "`capability-route`",
        "`affordance-inventory`, `behavior-matrix`, `visual-bug-ledger`",
        "`canvas-stability-report`, `visual-parity-ledger`",
        "`visual-judge-scorecards`",
        "`judge-aggregation`",
        "`code-quality-review`, and `handoff`",
        "Image2 design generation is mandatory before coding",
        "failed or under-review implementation screenshot must not become",
        "Product Model Before Pixels",
        "Unexplained duplicate controls block acceptance",
        "Automation is execution evidence, not visual parity proof",
        "before, mid-drag, and after-drag motion-frame evidence",
        "safe zones and meet mobile touch expectations",
        "visual-bug-ledger` has zero blockers",
        "nice but not surprising",
        "Failure Learning",
        "fake or unverified visible controls",
        "missing information architecture",
        "duplicated or conflicting mode controls that make the business flow unclear",
        "sellable product MVP",
        "toy single-page experiments",
        "references/implementation-loop.md",
        "references/visual-quality-rubric.md",
        "references/artifact-contract.md",
    ],
    "skills/swe/bagakit-codex-webpage-design/README.md": [
        "reference-context-first",
        "image2 is the default reference",
        "Do not implement from text requirements with no design reference",
        "machine validation is not enough",
        "canvas safe zones",
        "artifact freshness",
    ],
    "skills/swe/bagakit-codex-webpage-design/references/image-prompt-guide.md": [
        "Image2 is the default reference generator",
        "Do not implement directly from text requirements with no design reference",
        "Do not use screenshots of a failed or under-review implementation",
        "State set:",
        "Negative constraints:",
        "coherent set of frames",
        "Did the generated board drift toward a failed implementation",
        "verify current OpenAI image generation",
    ],
    "skills/swe/bagakit-codex-webpage-design/references/implementation-loop.md": [
        "Do not enter this loop until `reference-intent.md` exists",
        "Do not enter this loop until `visual-decomposition.md` exists",
        "Do not implement meaningful branch states until `state-reference-set.md` exists",
        "Product Workflow Gate",
        "Control Surface Gate",
        "Information Architecture Gate",
        "information-architecture-map.md",
        "object taxonomy",
        "page region responsibilities",
        "progressive disclosure",
        "information scent",
        "can falsify the skill",
        "MVP Experiment Gate",
        "sellable product MVP",
        "single static page can be a smoke test",
        "workflow-model.md",
        "control-surface-map.md",
        "one canonical owner region",
        "mirrored shortcut",
        "Interaction Model Gate",
        "Affordance Inventory Gate",
        "reference-coverage-matrix",
        "reference-visible affordance",
        "Missing reference controls are blockers",
        "Capability Route Gate",
        "prefer a proven library or host component",
        "canvas-stability-report.md",
        "before, mid-drag, and after-drag frame evidence",
        "final-position assertion after mouseup is not enough",
        "Library defaults are suspect until proven in screenshots",
        "pre-judge interaction-logic sanity check",
        "duplicate control is redundant or conflicting",
        "Do not treat automated validation as a substitute for visual review",
        "Refresh artifacts after each iteration",
    ],
    "skills/swe/bagakit-codex-webpage-design/references/visual-quality-rubric.md": [
        "Start by checking reference intent",
        "Reject state boards that copy visual drift",
        "Cannot pixel-align",
        "Interaction Fit",
        "Workflow Legibility",
        "Control Architecture",
        "Information Architecture",
        "information scent",
        "mvp complexity",
        "State Parity",
        "Code Craft",
        "Behavior Proof",
        "Affordance Honesty",
        "Reference Coverage",
        "reference coverage matrix",
        "Canvas Stability",
        "Motion-Frame Stability",
        "duplicate mode controls",
        "business workflow",
        "Visual Gate Protocol",
        "quiet-room judges",
        "visual-judge-scorecard",
        "judge-aggregation",
        "craft median >= 4.2",
        "nice but not surprising",
        "Do not average away blockers",
        "workflow legibility",
        "information architecture",
        "control architecture and duplicate controls",
        "toy single-page prototype",
        "polished static composition",
    ],
    "skills/swe/bagakit-codex-webpage-design/references/artifact-contract.md": [
        ".bagakit/codex-webpage-design/<task-slug>/",
        "information-architecture-map.md",
        "mvp-experiment-plan.md",
        "reference-coverage-matrix.md",
        "workflow-model.md",
        "control-surface-map.md",
        "blocking artifacts",
        "Unexplained duplicate controls are blockers",
        "Drag and pan stability require motion-frame evidence",
        "execution evidence, not visual parity evidence",
        "Artifact freshness is required for completion",
        "User-reported visible errors invalidate the prior visual gate decision",
        "Workflow model: <ref or not_needed_static_page>",
        "Control surface map: <ref or not_needed_static_page>",
        "Information architecture map: <ref or not_needed_simple_page>",
        "MVP experiment plan: <ref or not_needed_not_skill_experiment>",
        "information architecture review: <passed|partial|blocked|not_applicable with evidence ref>",
        "MVP complexity gate: <passed|partial|blocked|not_applicable with evidence ref>",
        "can falsify the skill",
        "Information scent must be checked in the rendered screenshots",
        "A page that only inventories what it happened to implement has not proven reference coverage.",
        "workflow legibility: <passed|partial|blocked|not_applicable with evidence ref>",
        "control surface review: <passed|partial|blocked|not_applicable with evidence ref>",
    ],
    "skills/swe/bagakit-codex-webpage-design/references/bagakit-driver.toml": [
        "WebpageDesign",
        "InformationArchitecture=<information-architecture-map ref or none>",
        "Workflow=<workflow-model ref or none>",
        "ControlSurface=<control-surface-map ref or none>",
        "MVPExperiment=<mvp-experiment-plan ref or not_applicable>",
        "VisualJudges=<visual-judge-scorecards ref or not_needed>",
        "JudgeAggregation=<pass|needs_iteration|blocked|not_needed and ref>",
        "Parity=<match|acceptable_delta|needs_iteration>",
    ],
    "gate_eval/skills/swe/bagakit-codex-webpage-design/suite.ts": [
        "historical failure bench",
        "historical-failures.json",
        "must_find",
        "expected_blockers",
    ],
    "gate_eval/skills/swe/bagakit-codex-webpage-design/cases/historical-failures.json": [
        "no-reference-direct-code",
        "state-board-copies-failed-implementation",
        "fake-visible-controls-pass-happy-path",
        "reference-controls-missing-from-implementation",
        "drag-final-position-hides-flicker",
        "automation-passes-visual-blockers-remain",
        "nice-clean-but-not-surprising",
        "duplicated-mode-controls-unclear-flow",
        "missing-information-architecture-map",
        "weak-information-scent-polished-panels",
        "toy-single-page-false-mvp-proof",
    ],
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository root")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    missing: list[str] = []

    for rel_path, phrases in REQUIRED_PHRASES.items():
        path = root / rel_path
        if not path.is_file():
            missing.append(f"{rel_path}: missing file")
            continue
        text = path.read_text(encoding="utf-8")
        normalized_text = " ".join(text.split())
        for phrase in phrases:
            normalized_phrase = " ".join(phrase.split())
            if normalized_phrase not in normalized_text:
                missing.append(f"{rel_path}: missing phrase: {phrase}")

    if missing:
        print("webpage design contract check failed:")
        for item in missing:
            print(f"- {item}")
        return 1

    print("ok: webpage design wording contract anchors present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
