"""Validate the shared page host contract."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import subprocess

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover
    tomllib = None


SKILL_ROOT = Path("skills/harness/bagakit-pageville")
CONTRACT = SKILL_ROOT / "references/pageville-contract.toml"
SKILL = SKILL_ROOT / "SKILL.md"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    args = parser.parse_args()
    root = Path(args.root).resolve()
    failures: list[str] = []
    contract_path = root / CONTRACT
    if not contract_path.is_file():
        failures.append(f"missing contract: {CONTRACT}")
        data = {}
    elif tomllib is None:
        parser_source = """
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.argv[1];
const contractPath = process.argv[2];
const parserPath = path.resolve(root, 'dev', 'validator', 'src', 'lib', 'toml.ts');
const parser = await import(pathToFileURL(parserPath).href);
process.stdout.write(JSON.stringify(parser.parseTomlFile(contractPath)));
"""
        try:
            completed = subprocess.run(
                [
                    "node",
                    "--experimental-strip-types",
                    "--input-type=module",
                    "-e",
                    parser_source,
                    str(root),
                    str(contract_path),
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            data = json.loads(completed.stdout)
        except (OSError, subprocess.CalledProcessError, json.JSONDecodeError) as exc:
            failures.append(f"contract parse failed: {exc}")
            data = {}
    else:
        try:
            data = tomllib.loads(contract_path.read_text(encoding="utf-8"))
        except (OSError, tomllib.TOMLDecodeError) as exc:
            failures.append(f"contract parse failed: {exc}")
            data = {}

    if data.get("version") != 1:
        failures.append("contract version must be 1")
    if data.get("skill_id") != "bagakit-pageville":
        failures.append("contract skill_id mismatch")
    if data.get("contract_kind") != "pageville_runtime_contract":
        failures.append("contract_kind mismatch")
    if data.get("owner") != str(SKILL_ROOT):
        failures.append("contract owner mismatch")

    runtime = data.get("runtime_surface", {})
    for key, expected in {
        "root": ".bagakit/pageville",
        "marker": "surface.toml",
        "registry": "registry.json",
        "server_state": "server.json",
    }.items():
        if runtime.get(key) != expected:
            failures.append(f"runtime_surface.{key} mismatch")

    registry = data.get("registry", {})
    if registry.get("schema_version") != 1:
        failures.append("registry schema_version must be 1")
    for key in ("identity_fields", "version_fields", "rules"):
        if not isinstance(registry.get(key), list) or not registry[key]:
            failures.append(f"registry.{key} must be non-empty")
    if set(registry.get("statuses", [])) != {"active", "archived"}:
        failures.append("registry statuses must be active and archived")

    hosting = data.get("hosting", {})
    if hosting.get("bind") != "127.0.0.1":
        failures.append("hosting must bind to loopback")
    if hosting.get("adapter") != "loopback_v0":
        failures.append("hosting must identify the loopback_v0 adapter")
    if hosting.get("one_server_per_root") is not True:
        failures.append("hosting must declare one_server_per_root")
    if hosting.get("http_mutation") != "shutdown_only_with_host_token":
        failures.append("hosting HTTP mutation boundary mismatch")
    if hosting.get("semantic_route_stability") != "path is independent of deployment origin":
        failures.append("hosting must keep semantic route paths independent of origin")

    annotation = data.get("annotation", {})
    if annotation.get("storage") != "append_only_jsonl_per_page_version":
        failures.append("annotation storage must be append-only JSONL per version")
    if "annotation_id" not in annotation.get("required_fields", []):
        failures.append("annotation required_fields must include annotation_id")
    if not isinstance(annotation.get("truth_boundary"), str) or "never" not in annotation["truth_boundary"]:
        failures.append("annotation truth boundary must keep annotations out of source truth")

    commands = data.get("commands", {}).get("required", [])
    expected_commands = {"init", "start", "stop", "status", "publish", "link", "list", "get", "versions", "fetch", "annotate", "archive"}
    missing_commands = sorted(expected_commands - set(commands))
    if missing_commands:
        failures.append(f"missing required commands: {missing_commands}")

    safety = data.get("safety", {}).get("requirements", [])
    for phrase in ("path traversal", "registered copied content", "host token", "non-absolute"):
        if not any(phrase in str(item) for item in safety):
            failures.append(f"safety requirements missing: {phrase}")

    skill_text = (root / SKILL).read_text(encoding="utf-8") if (root / SKILL).is_file() else ""
    for phrase in ("semantic links", "immutable versions", "append-only annotations", "loopback", "deployment location"):
        if phrase not in skill_text:
            failures.append(f"SKILL.md missing contract phrase: {phrase}")

    if failures:
        print("pageville contract check failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1
    print("ok: pageville contract is aligned")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
