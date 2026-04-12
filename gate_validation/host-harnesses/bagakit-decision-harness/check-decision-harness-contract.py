"""Validate the bagakit-decision-harness L4 host-harness contract."""

from __future__ import annotations

import argparse
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover
    tomllib = None


SOURCE = Path("host-harnesses/bagakit-decision-harness")
REQUIRED_HOST_DIRS = {
    "inbox",
    "signals",
    "decisions",
    "reviews",
    "patterns",
    "drills",
    "ai-updates",
    "metrics",
    "principles",
    "projects",
    "exports",
}


def parse_scalar(value: str) -> object:
    value = value.strip()
    if value.startswith('"') and value.endswith('"'):
        return value[1:-1]
    if value.isdigit():
        return int(value)
    if value == "true":
        return True
    if value == "false":
        return False
    return value


def load_toml_fallback(path: Path) -> dict:
    root: dict[str, object] = {}
    current: dict[str, object] = root
    lines = path.read_text(encoding="utf-8").splitlines()
    index = 0
    while index < len(lines):
        raw = lines[index]
        line = raw.strip()
        index += 1
        if not line or line.startswith("#"):
            continue
        if line.startswith("[") and line.endswith("]"):
            table = line[1:-1].strip()
            current = {}
            root[table] = current
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if value == "[":
            items: list[object] = []
            while index < len(lines):
                item_line = lines[index].strip()
                index += 1
                if item_line == "]":
                    break
                if not item_line or item_line.startswith("#"):
                    continue
                if item_line.endswith(","):
                    item_line = item_line[:-1].strip()
                items.append(parse_scalar(item_line))
            current[key] = items
            continue
        current[key] = parse_scalar(value)
    return root


def load_toml(path: Path) -> dict:
    if tomllib is None:
        return load_toml_fallback(path)
    with path.open("rb") as handle:
        data = tomllib.load(handle)
    if not isinstance(data, dict):
        raise ValueError("TOML root must be a table")
    return data


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository root")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    failures: list[str] = []

    source_dir = root / SOURCE
    harness_path = source_dir / "harness.toml"
    template_path = source_dir / "host-template" / "harness.toml"
    skill_path = source_dir / "SKILL.md"
    spec_path = root / "docs/specs/host-harness-contract.md"

    for path in [harness_path, template_path, skill_path, spec_path]:
        if not path.is_file():
            failures.append(f"missing required file: {path.relative_to(root)}")

    if harness_path.is_file():
        try:
            harness = load_toml(harness_path)
        except Exception as exc:  # noqa: BLE001
            failures.append(f"failed to parse {harness_path.relative_to(root)}: {exc}")
            harness = {}
        expected = {
            "schema_version": 1,
            "harness_id": "bagakit-decision-harness",
            "harness_kind": "host_harness",
            "bagakit_layer": "l4-host-harness",
            "host_mode": "dedicated_workspace",
            "agent_entrypoint": "SKILL.md",
            "host_template": "host-template",
        }
        for key, value in expected.items():
            if harness.get(key) != value:
                failures.append(f"harness.toml {key} must be {value!r}")
        owned = harness.get("owned_host_directories")
        if not isinstance(owned, list) or not REQUIRED_HOST_DIRS.issubset(set(owned)):
            failures.append("harness.toml owned_host_directories missing required host dirs")
        if harness.get("runtime_surface") != ".bagakit/decision-harness":
            failures.append("harness.toml runtime_surface must be .bagakit/decision-harness")

    if template_path.is_file():
        try:
            template = load_toml(template_path)
        except Exception as exc:  # noqa: BLE001
            failures.append(f"failed to parse {template_path.relative_to(root)}: {exc}")
            template = {}
        if template.get("harness_kind") != "host_harness_instance":
            failures.append("host-template/harness.toml must declare host_harness_instance")
        if template.get("bagakit_layer") != "l4-host-harness":
            failures.append("host-template/harness.toml must declare l4-host-harness")
        paths = template.get("paths")
        if not isinstance(paths, dict):
            failures.append("host-template/harness.toml must include [paths]")
        else:
            for required in REQUIRED_HOST_DIRS:
                key = required.replace("-", "_")
                if paths.get(key) != required:
                    failures.append(f"host-template paths.{key} must be {required!r}")
            if paths.get("runtime") != ".bagakit/decision-harness":
                failures.append("host-template paths.runtime must be .bagakit/decision-harness")

    if skill_path.is_file():
        skill_text = skill_path.read_text(encoding="utf-8")
        required_phrases = [
            "L4 host harness",
            "not a normal L1-L3 skill",
            "host root",
            ".bagakit/decision-harness",
        ]
        for phrase in required_phrases:
            if phrase not in skill_text:
                failures.append(f"SKILL.md must mention {phrase!r}")

    if not source_dir.is_dir() or source_dir.parent != root / "host-harnesses":
        failures.append("bagakit-decision-harness must live directly under host-harnesses/")

    if failures:
        print("decision harness contract check failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print("ok: decision harness L4 contract is aligned")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
