from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image


SKILL_ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "preflight_structural_control_stack",
    SKILL_ROOT / "scripts" / "preflight_structural_control_stack.py",
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(MODULE)


def successful_runtime_probe(path: Path, accelerator: str) -> list[dict]:
    return [
        MODULE.result("venv", True, str(path)),
        MODULE.result("torch", True, "fixture"),
        MODULE.result("accelerator", True, accelerator),
    ]


class StructuralControlPreflightTests(unittest.TestCase):
    def make_fixture(self, root: Path, *, model_size: int = 2048) -> tuple[Path, Path, Path, Path]:
        comfy = root / "ComfyUI"
        (comfy / "custom_nodes" / "ComfyUI_IPAdapter_plus").mkdir(parents=True)
        (comfy / ".venv" / "bin").mkdir(parents=True)
        (comfy / "main.py").write_text("# fixture\n", encoding="utf-8")
        (comfy / ".venv" / "bin" / "python").write_text("fixture\n", encoding="utf-8")

        manifest = root / "manifest.json"
        manifest.write_text(
            json.dumps(
                {
                    "artifacts": [
                        {"role": "checkpoint", "target_path": "models/checkpoints/model.bin", "approx_size_gib": 0.000001}
                    ]
                }
            ),
            encoding="utf-8",
        )
        model = comfy / "models" / "checkpoints" / "model.bin"
        model.parent.mkdir(parents=True)
        model.write_bytes(b"x" * model_size)

        canonical = root / "canonical.png"
        Image.new("RGB", (64, 64), "white").save(canonical)
        guides = root / "guides"
        guides.mkdir()
        for name in MODULE.DEFAULT_GUIDES:
            Image.new("RGB", (512, 512), "black").save(guides / f"{name}.png")
        return comfy, manifest, canonical, guides

    def build(self, root: Path, *, model_size: int = 2048) -> dict:
        comfy, manifest, canonical, guides = self.make_fixture(root, model_size=model_size)
        return MODULE.build_report(
            comfy_root=comfy,
            manifest_path=manifest,
            canonical=canonical,
            guides_dir=guides,
            guide_names=MODULE.DEFAULT_GUIDES,
            guide_size=512,
            python_bin="python3.11",
            accelerator="mps",
            min_free_gib=0,
            runtime_probe=successful_runtime_probe,
        )

    def test_missing_stack_is_a_valid_blocked_report(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            manifest = root / "manifest.json"
            manifest.write_text('{"artifacts": []}', encoding="utf-8")
            report = MODULE.build_report(
                comfy_root=root / "missing",
                manifest_path=manifest,
                canonical=root / "missing.png",
                guides_dir=root / "guides",
                guide_names=MODULE.DEFAULT_GUIDES,
                guide_size=512,
                python_bin="definitely-not-python",
                accelerator="mps",
                min_free_gib=0,
            )
            self.assertEqual(report["status"], "blocked")
            self.assertFalse(report["ready"])
            self.assertFalse(report["network_used"])

    def test_complete_fixture_is_ready(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            report = self.build(Path(temp_dir))
            self.assertTrue(report["ready"], report["blockers"])

    def test_small_model_blocks_promotion(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            report = self.build(Path(temp_dir), model_size=16)
            self.assertIn("model:checkpoint", report["blockers"])

    def test_wrong_guide_dimensions_block_promotion(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            comfy, manifest, canonical, guides = self.make_fixture(root)
            Image.new("RGB", (256, 512), "black").save(guides / "passing.png")
            report = MODULE.build_report(
                comfy_root=comfy,
                manifest_path=manifest,
                canonical=canonical,
                guides_dir=guides,
                guide_names=MODULE.DEFAULT_GUIDES,
                guide_size=512,
                python_bin="python3.11",
                accelerator="mps",
                min_free_gib=0,
                runtime_probe=successful_runtime_probe,
            )
            self.assertIn("guide:passing", report["blockers"])


if __name__ == "__main__":
    unittest.main()
