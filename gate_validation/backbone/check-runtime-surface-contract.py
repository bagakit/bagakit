"""Check runtime-surface contract alignment across docs, skills, and local roots."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover
    import tomli as tomllib  # type: ignore[no-redef]


EXPECTED_SURFACES = {
    ".bagakit/researcher/surface.toml": {
        "surface_id": "researcher-runtime",
        "surface_root": ".bagakit/researcher",
        "owner_kind": "skill",
        "owner_id": "bagakit-researcher",
        "lifecycle_class": "durable_state",
        "edit_policy": "mixed",
        "cleanup_safe": False,
        "source_of_truth": [
            "docs/specs/runtime-surface-contract.md",
            "skills/harness/bagakit-researcher/SKILL.md",
            ".bagakit/researcher/README.md",
        ],
    },
    ".bagakit/evolver/surface.toml": {
        "surface_id": "evolver-runtime",
        "surface_root": ".bagakit/evolver",
        "owner_kind": "skill",
        "owner_id": "bagakit-skill-evolver",
        "lifecycle_class": "durable_state",
        "edit_policy": "mixed",
        "cleanup_safe": False,
        "source_of_truth": [
            "docs/specs/runtime-surface-contract.md",
            "docs/specs/evolver-memory.md",
            "skills/harness/bagakit-skill-evolver/SKILL.md",
            ".bagakit/evolver/README.md",
        ],
    },
    ".bagakit/skill-selector/surface.toml": {
        "surface_id": "skill-selector-runtime",
        "surface_root": ".bagakit/skill-selector",
        "owner_kind": "skill",
        "owner_id": "bagakit-skill-selector",
        "lifecycle_class": "durable_state",
        "edit_policy": "mixed",
        "cleanup_safe": False,
        "source_of_truth": [
            "docs/specs/runtime-surface-contract.md",
            "skills/harness/bagakit-skill-selector/SKILL.md",
            ".bagakit/skill-selector/README.md",
        ],
    },
    ".bagakit/living-knowledge/surface.toml": {
        "surface_id": "living-knowledge-local-state",
        "surface_root": ".bagakit/living-knowledge",
        "owner_kind": "skill",
        "owner_id": "bagakit-living-knowledge",
        "lifecycle_class": "generated_state",
        "edit_policy": "generated_only",
        "cleanup_safe": True,
        "source_of_truth": [
            "docs/specs/runtime-surface-contract.md",
            "docs/specs/living-knowledge-system.md",
            "skills/harness/bagakit-living-knowledge/SKILL.md",
            ".bagakit/living-knowledge/README.md",
        ],
    },
}

EXPECTED_TEXT_TOKENS = {
    "docs/specs/runtime-surface-contract.md": [
        "surface.toml",
        "lifecycle_class",
        "edit_policy",
        "README.md",
        "AGENTS.md",
        ".bagakit/researcher/",
        ".bagakit/evolver/",
        ".bagakit/skill-selector/",
        ".bagakit/living-knowledge/",
    ],
    "docs/skill-development.md": [
        "Runtime Surface Declaration Policy",
        "docs/specs/runtime-surface-contract.md",
        "persistent runtime surface by default",
    ],
    ".bagakit/README.md": [
        "surface.toml",
        ".bagakit/skill-selector/",
        ".bagakit/living-knowledge/",
        "docs/specs/runtime-surface-contract.md",
    ],
    ".bagakit/researcher/README.md": [
        "surface.toml",
        ".bagakit/evolver/",
        ".bagakit/skill-selector/",
    ],
    ".bagakit/evolver/README.md": [
        "surface.toml",
        "topics/<topic>/README.md",
    ],
    ".bagakit/skill-selector/README.md": [
        ".bagakit/evolver/",
        ".bagakit/researcher/",
        "Task-local skill usage truth belongs here",
    ],
    ".bagakit/living-knowledge/README.md": [
        ".generated/",
        ".bagakit/knowledge_conf.toml",
        "docs/",
    ],
    ".bagakit/researcher/AGENTS.md": [
        "bagakit-researcher",
        "docs/specs/runtime-surface-contract.md",
    ],
    ".bagakit/evolver/AGENTS.md": [
        "bagakit-skill-evolver",
        "docs/specs/evolver-memory.md",
    ],
    ".bagakit/skill-selector/AGENTS.md": [
        "bagakit-skill-selector",
        "tasks/<task-slug>/skill-usage.toml",
    ],
    "skills/harness/bagakit-brainstorm/README.md": [
        "## Runtime Surface Declaration",
        ".bagakit/brainstorm/",
        ".bagakit/planning-entry/handoffs/",
        "docs/specs/runtime-surface-contract.md",
    ],
    "skills/harness/bagakit-brainstorm/SKILL.md": [
        "## Runtime Surface Declaration",
        ".bagakit/brainstorm/",
        ".bagakit/planning-entry/handoffs/",
        "docs/specs/runtime-surface-contract.md",
    ],
    "skills/harness/bagakit-feature-tracker/README.md": [
        "## Runtime Surface Declaration",
        ".bagakit/feature-tracker/",
        ".bagakit/planning-entry/handoffs/",
        "docs/specs/runtime-surface-contract.md",
    ],
    "skills/harness/bagakit-feature-tracker/SKILL.md": [
        "## Runtime Surface Declaration",
        ".bagakit/feature-tracker/",
        ".bagakit/planning-entry/handoffs/",
        "docs/specs/runtime-surface-contract.md",
    ],
    "skills/harness/bagakit-flow-runner/README.md": [
        "## Runtime Surface Declaration",
        ".bagakit/flow-runner/",
        "docs/specs/runtime-surface-contract.md",
    ],
    "skills/harness/bagakit-flow-runner/SKILL.md": [
        "## Runtime Surface Declaration",
        ".bagakit/flow-runner/",
        "docs/specs/runtime-surface-contract.md",
    ],
    "skills/harness/bagakit-living-knowledge/README.md": [
        "## Runtime Surface Declaration",
        ".bagakit/living-knowledge/",
        ".bagakit/knowledge_conf.toml",
        "docs/specs/runtime-surface-contract.md",
    ],
    "skills/harness/bagakit-living-knowledge/SKILL.md": [
        "## Runtime Surface Declaration",
        ".bagakit/living-knowledge/",
        ".bagakit/knowledge_conf.toml",
        "docs/specs/runtime-surface-contract.md",
    ],
    "skills/harness/bagakit-researcher/README.md": [
        "## Runtime Surface Declaration",
        ".bagakit/researcher/",
        ".bagakit/knowledge_conf.toml",
        "docs/specs/runtime-surface-contract.md",
    ],
    "skills/harness/bagakit-researcher/SKILL.md": [
        "## Runtime Surface Declaration",
        ".bagakit/researcher/",
        ".bagakit/knowledge_conf.toml",
        "docs/specs/runtime-surface-contract.md",
    ],
    "skills/harness/bagakit-skill-evolver/README.md": [
        "## Runtime Surface Declaration",
        ".bagakit/evolver/",
        ".mem_inbox/",
        "docs/specs/runtime-surface-contract.md",
    ],
    "skills/harness/bagakit-skill-evolver/SKILL.md": [
        "## Runtime Surface Declaration",
        ".bagakit/evolver/",
        ".mem_inbox/",
        "docs/specs/runtime-surface-contract.md",
    ],
    "skills/harness/bagakit-skill-selector/README.md": [
        "## Runtime Surface Declaration",
        ".bagakit/skill-selector/",
        "docs/specs/runtime-surface-contract.md",
    ],
    "skills/harness/bagakit-skill-selector/SKILL.md": [
        "## Runtime Surface Declaration",
        ".bagakit/skill-selector/",
        "docs/specs/runtime-surface-contract.md",
    ],
    "skills/swe/bagakit-git-message-craft/README.md": [
        "## Runtime Surface Declaration",
        ".bagakit/git-message-craft/",
        "docs/specs/runtime-surface-contract.md",
    ],
    "skills/swe/bagakit-git-message-craft/SKILL.md": [
        "## Runtime Surface Declaration",
        ".bagakit/git-message-craft/",
        "docs/specs/runtime-surface-contract.md",
    ],
    "skills/paperwork/qihan-writing/README.md": [
        "## Runtime Surface Declaration",
        "none by default",
        "docs/specs/runtime-surface-contract.md",
    ],
    "skills/paperwork/qihan-writing/SKILL.md": [
        "## Runtime Surface Declaration",
        "none by default",
        "docs/specs/runtime-surface-contract.md",
    ],
    "skills/paperwork/bagakit-paperwork-technical-writing/SKILL.md": [
        "## Runtime Surface Declaration",
        "none by default",
        "docs/specs/runtime-surface-contract.md",
    ],
}


def load_toml(path: Path) -> dict:
    with path.open("rb") as handle:
        return tomllib.load(handle)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, help="repo root")
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    failures: list[str] = []

    for rel, expected in EXPECTED_SURFACES.items():
        path = root / rel
        if not path.is_file():
            failures.append(f"missing surface marker: {rel}")
            continue
        try:
            data = load_toml(path)
        except Exception as exc:  # pragma: no cover
            failures.append(f"failed to parse {rel}: {exc}")
            continue
        for key, expected_value in expected.items():
            actual_value = data.get(key)
            if actual_value != expected_value:
                failures.append(
                    f"{rel} field {key!r} mismatch: expected {expected_value!r}, got {actual_value!r}"
                )
        if data.get("schema_version") != 1:
            failures.append(f"{rel} schema_version must be 1")
        if not isinstance(data.get("reviewable_outputs"), list):
            failures.append(f"{rel} reviewable_outputs must be an array")

    for rel, tokens in EXPECTED_TEXT_TOKENS.items():
        path = root / rel
        if not path.is_file():
            failures.append(f"missing required file: {rel}")
            continue
        text = path.read_text(encoding="utf-8")
        for token in tokens:
            if token not in text:
                failures.append(f"{rel} missing token: {token}")

    if failures:
        for failure in failures:
            print(f"error: {failure}", file=sys.stderr)
        return 1

    print("ok: runtime-surface contract is aligned across docs, skill docs, and materialized local roots")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
