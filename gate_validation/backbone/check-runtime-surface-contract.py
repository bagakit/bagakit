"""Check runtime-surface contract alignment across docs, skills, and optional local roots."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover
    tomllib = None  # type: ignore[assignment]


OPTIONAL_SURFACES = {
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
    ".bagakit/design/surface.toml": {
        "surface_id": "design-runtime",
        "surface_root": ".bagakit/design",
        "owner_kind": "skill",
        "owner_id": "bagakit-design-core",
        "lifecycle_class": "durable_state",
        "edit_policy": "mixed",
        "cleanup_safe": False,
        "source_of_truth": [
            "docs/specs/runtime-surface-contract.md",
            "skills/design/bagakit-design-core/SKILL.md",
            ".bagakit/design/README.md",
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
        "`.bagakit/` is local runtime state by default",
        "A host repository may ignore the",
        "Default repository validation must not require a fresh checkout",
        "lifecycle_class",
        "edit_policy",
        "README.md",
        "AGENTS.md",
        ".bagakit/researcher/",
        ".bagakit/evolver/",
        ".bagakit/skill-selector/",
        ".bagakit/design/",
        ".bagakit/living-knowledge/",
    ],
    "docs/skill-development.md": [
        "Runtime Surface Declaration Policy",
        "docs/specs/runtime-surface-contract.md",
        "persistent runtime surface by default",
        "host repositories may ignore `.bagakit/` by default",
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
    "skills/design/bagakit-design-core/README.md": [
        "## Runtime Surface Declaration",
        ".bagakit/design/",
        "docs/specs/runtime-surface-contract.md",
    ],
    "skills/design/bagakit-design-core/SKILL.md": [
        "## Runtime Surface Declaration",
        ".bagakit/design/",
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
    "skills/paperwork/bagakit-writing-core/README.md": [
        "## Runtime Surface Declaration",
        "none by default",
        "docs/specs/runtime-surface-contract.md",
    ],
    "skills/paperwork/bagakit-writing-core/SKILL.md": [
        "## Runtime Surface Declaration",
        "none by default",
        "docs/specs/runtime-surface-contract.md",
    ],
    "skills/paperwork/bagakit-writing-de-ai-tone/SKILL.md": [
        "## Runtime Surface Declaration",
        "none by default",
        "docs/specs/runtime-surface-contract.md",
    ],
    "skills/paperwork/bagakit-paperwork-technical-writing/SKILL.md": [
        "## Runtime Surface Declaration",
        "none by default",
        "docs/specs/runtime-surface-contract.md",
    ],
    "skills/gamemaker/topdown-image2-sprite-pipeline/SKILL.md": [
        "## Runtime Surface Declaration",
        "no persistent Bagakit runtime surface by default",
        "docs/specs/runtime-surface-contract.md",
        "review-disposition.md",
    ],
}


def parse_surface_toml(text: str) -> dict:
    data: dict[str, object] = {}
    current_array_key: str | None = None
    current_array: list[str] = []

    def finish_array() -> None:
        nonlocal current_array_key, current_array
        if current_array_key is not None:
            data[current_array_key] = current_array
            current_array_key = None
            current_array = []

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if current_array_key is not None:
            if line == "]":
                finish_array()
                continue
            current_array.append(line.rstrip(",").strip().strip('"'))
            continue
        key, sep, value = line.partition("=")
        if not sep:
            raise ValueError(f"unsupported TOML line: {raw_line}")
        key = key.strip()
        value = value.strip()
        if value == "[":
            current_array_key = key
            current_array = []
            continue
        if value.startswith('"') and value.endswith('"'):
            data[key] = value.strip('"')
            continue
        if value == "true":
            data[key] = True
            continue
        if value == "false":
            data[key] = False
            continue
        try:
            data[key] = int(value)
        except ValueError as exc:
            raise ValueError(f"unsupported TOML value for {key}: {value}") from exc

    finish_array()
    return data


def load_toml(path: Path) -> dict:
    if tomllib is None:
        return parse_surface_toml(path.read_text(encoding="utf-8"))
    with path.open("rb") as handle:
        return tomllib.load(handle)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, help="repo root")
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    failures: list[str] = []

    for rel, expected in OPTIONAL_SURFACES.items():
        path = root / rel
        if not path.is_file():
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

    print("ok: runtime-surface contract is aligned across docs, skill docs, and optional local roots")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
