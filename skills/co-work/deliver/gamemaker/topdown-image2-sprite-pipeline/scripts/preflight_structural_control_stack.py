"""Offline preflight for an OpenPose + identity-conditioning sprite stack."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from PIL import Image


DEFAULT_GUIDES = ("contact", "recoil", "passing", "high-point")


def result(check_id: str, ok: bool, detail: str, *, required: bool = True) -> dict:
    return {"id": check_id, "ok": bool(ok), "required": required, "detail": detail}


def run_command(command: list[str], timeout: int = 30) -> tuple[bool, str]:
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=timeout, check=False)
    except (OSError, subprocess.SubprocessError) as exc:
        return False, str(exc)
    output = (completed.stdout or completed.stderr).strip()
    return completed.returncode == 0, output


def probe_python(binary: str) -> dict:
    resolved = shutil.which(binary) if "/" not in binary else binary
    if not resolved or not Path(resolved).exists():
        return result("python_3_11", False, f"not found: {binary}")
    ok, output = run_command([resolved, "--version"])
    return result("python_3_11", ok and output.startswith("Python 3.11"), output or resolved)


def probe_runtime(venv_python: Path, accelerator: str) -> list[dict]:
    if not venv_python.exists():
        return [
            result("venv", False, f"missing: {venv_python}"),
            result("torch", False, "not probed because venv is missing"),
            result("accelerator", False, "not probed because venv is missing"),
        ]
    script = (
        "import json, torch; "
        "print(json.dumps({'version': torch.__version__, "
        "'mps': bool(getattr(torch.backends, 'mps', None) and torch.backends.mps.is_available()), "
        "'cuda': torch.cuda.is_available()}))"
    )
    ok, output = run_command([str(venv_python), "-c", script])
    if not ok:
        return [
            result("venv", True, str(venv_python)),
            result("torch", False, output or "torch import failed"),
            result("accelerator", False, "not probed because torch import failed"),
        ]
    try:
        payload = json.loads(output)
    except json.JSONDecodeError:
        return [
            result("venv", True, str(venv_python)),
            result("torch", False, f"invalid probe output: {output}"),
            result("accelerator", False, "invalid torch probe output"),
        ]
    accelerator_ok = {
        "mps": bool(payload.get("mps")),
        "cuda": bool(payload.get("cuda")),
        "cpu": True,
        "auto": bool(payload.get("mps") or payload.get("cuda")),
    }[accelerator]
    return [
        result("venv", True, str(venv_python)),
        result("torch", True, payload.get("version", "unknown")),
        result("accelerator", accelerator_ok, json.dumps({"requested": accelerator, **payload}, sort_keys=True)),
    ]


def probe_models(comfy_root: Path, manifest: dict) -> list[dict]:
    checks = []
    for artifact in manifest.get("artifacts", []):
        path = comfy_root / artifact["target_path"]
        expected = int(float(artifact.get("approx_size_gib", 0)) * 1024**3)
        minimum = max(1024, int(expected * 0.5))
        size = path.stat().st_size if path.is_file() else 0
        checks.append(
            result(
                f"model:{artifact['role']}",
                path.is_file() and size >= minimum,
                f"{path} size={size} minimum={minimum}",
            )
        )
    return checks


def probe_guides(guides_dir: Path, guide_names: tuple[str, ...], expected_size: int) -> list[dict]:
    checks = []
    for name in guide_names:
        path = guides_dir / f"{name}.png"
        try:
            with Image.open(path) as image:
                dimensions = image.size
                ok = image.format == "PNG" and dimensions == (expected_size, expected_size)
        except (FileNotFoundError, OSError):
            dimensions = None
            ok = False
        checks.append(result(f"guide:{name}", ok, f"{path} size={dimensions}"))
    return checks


def build_report(
    *,
    comfy_root: Path,
    manifest_path: Path,
    canonical: Path,
    guides_dir: Path,
    guide_names: tuple[str, ...],
    guide_size: int,
    python_bin: str,
    accelerator: str,
    min_free_gib: float,
    runtime_probe: Callable[[Path, str], list[dict]] = probe_runtime,
) -> dict:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    checks = [
        result("comfy_root", (comfy_root / "main.py").is_file(), str(comfy_root / "main.py")),
        probe_python(python_bin),
    ]
    checks.extend(runtime_probe(comfy_root / ".venv" / "bin" / "python", accelerator))
    node = comfy_root / "custom_nodes" / "ComfyUI_IPAdapter_plus"
    checks.append(result("custom_node", node.is_dir(), str(node)))
    checks.extend(probe_models(comfy_root, manifest))

    disk_target = comfy_root if comfy_root.exists() else comfy_root.parent
    free_gib = shutil.disk_usage(disk_target).free / 1024**3
    checks.append(result("free_disk", free_gib >= min_free_gib, f"free_gib={free_gib:.2f} required={min_free_gib:.2f}"))

    canonical_ok = canonical.is_file()
    canonical_detail = str(canonical)
    if canonical_ok:
        try:
            with Image.open(canonical) as image:
                canonical_detail += f" size={image.size} format={image.format}"
        except OSError as exc:
            canonical_ok = False
            canonical_detail += f" unreadable={exc}"
    checks.append(result("canonical", canonical_ok, canonical_detail))
    checks.extend(probe_guides(guides_dir, guide_names, guide_size))

    blockers = [check["id"] for check in checks if check["required"] and not check["ok"]]
    return {
        "schema_version": "structural-control-preflight.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "network_used": False,
        "ready": not blockers,
        "status": "ready" if not blockers else "blocked",
        "blockers": blockers,
        "checks": checks,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--comfy-root", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--canonical", type=Path, required=True)
    parser.add_argument("--guides-dir", type=Path, required=True)
    parser.add_argument("--guide", action="append", dest="guides")
    parser.add_argument("--guide-size", type=int, default=512)
    parser.add_argument("--python-bin", default="python3.11")
    parser.add_argument("--accelerator", choices=("auto", "mps", "cuda", "cpu"), default="auto")
    parser.add_argument("--min-free-gib", type=float, default=20.0)
    parser.add_argument("--report-out", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report = build_report(
        comfy_root=args.comfy_root.resolve(),
        manifest_path=args.manifest.resolve(),
        canonical=args.canonical.resolve(),
        guides_dir=args.guides_dir.resolve(),
        guide_names=tuple(args.guides or DEFAULT_GUIDES),
        guide_size=args.guide_size,
        python_bin=args.python_bin,
        accelerator=args.accelerator,
        min_free_gib=args.min_free_gib,
    )
    args.report_out.parent.mkdir(parents=True, exist_ok=True)
    args.report_out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "blockers": report["blockers"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
