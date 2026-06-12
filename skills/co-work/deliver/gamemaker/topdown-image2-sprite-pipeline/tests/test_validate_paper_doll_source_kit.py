from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "validate_paper_doll_source_kit.py"
SPEC = importlib.util.spec_from_file_location("validate_paper_doll_source_kit", SCRIPT_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def default_manifest() -> dict[str, object]:
    return {
        "core": {
            "size": [96, 48],
            "slots": [
                {"index": 0, "part": "head", "code": "HD", "box": [0, 0, 28, 48]},
                {"index": 1, "part": "torso", "code": "TR", "box": [34, 0, 62, 48]},
                {"index": 2, "part": "pelvis", "code": "PL", "box": [68, 0, 96, 48]},
            ],
        }
    }


class PaperDollValidatorTests(unittest.TestCase):
    def make_workspace(
        self,
        *,
        multiple_components: bool = False,
        touching_boundary: bool = False,
        guide_residue: bool = False,
        missing_slot: bool = False,
        outside_slot_pixels: bool = False,
        incomplete_manual_gates: bool = False,
    ) -> Path:
        root = Path(tempfile.mkdtemp(prefix="paper-doll-validator-"))
        manifest = default_manifest()
        (root / "slot-manifest.json").write_text(json.dumps(manifest), encoding="utf-8")

        sheet = Image.new("RGBA", (96, 48), (0, 0, 0, 0))
        draw = ImageDraw.Draw(sheet)
        colors = [(220, 70, 80, 255), (60, 140, 220, 255), (80, 180, 100, 255)]
        slot_boxes = [tuple(slot["box"]) for slot in manifest["core"]["slots"]]  # type: ignore[index]
        for index, (left, top, right, bottom) in enumerate(slot_boxes):
            if missing_slot and index == 2:
                continue
            margin = 0 if touching_boundary and index == 0 else 6
            if multiple_components and index == 1:
                draw.rectangle((left + 10, top + 10, right - 6, bottom - 6), fill=colors[index])
            else:
                draw.rectangle((left + margin, top + 6, right - 6, bottom - 6), fill=colors[index])
            if multiple_components and index == 1:
                draw.rectangle((left + 4, top + 4, left + 7, top + 7), fill=colors[index])
        if outside_slot_pixels:
            draw.rectangle((30, 20, 32, 22), fill=(255, 255, 0, 255))
        sheet.save(root / "core.png")

        guide = Image.new("RGBA", (96, 48), (255, 255, 255, 255))
        guide_draw = ImageDraw.Draw(guide)
        guide_draw.rectangle((0, 0, 27, 47), outline=(255, 0, 0, 255), width=1)
        guide.save(root / "core-guide.png")
        if guide_residue:
            residue_sheet = Image.open(root / "core.png").convert("RGBA")
            residue_draw = ImageDraw.Draw(residue_sheet)
            residue_draw.rectangle((0, 0, 27, 47), outline=(255, 0, 0, 255), width=1)
            residue_sheet.save(root / "core.png")

        manual_gates = {
            "exact_part_ownership": "pass",
            "hidden_mating_surface_completeness": "pass",
            "identity_style_consistency": "pass",
            "camera_material_coherence": "pass",
        }
        if incomplete_manual_gates:
            del manual_gates["camera_material_coherence"]
        (root / "manual-gates.json").write_text(json.dumps({"gates": manual_gates}), encoding="utf-8")
        (root / "provenance.json").write_text(
            json.dumps(
                {
                    "core": {
                        "raw_png": "raw/core.png",
                        "raw_sha256": "a" * 64,
                        "generated_sha256": "b" * 64,
                        "byte_equal": True,
                    }
                }
            ),
            encoding="utf-8",
        )
        return root

    def validate(self, root: Path) -> dict[str, object]:
        return MODULE.validate_paper_doll_source_kit(
            slot_manifest_path=root / "slot-manifest.json",
            sheet_paths={"core": root / "core.png"},
            guide_paths={"core": root / "core-guide.png"},
            manual_gates_path=root / "manual-gates.json",
            provenance_path=root / "provenance.json",
            reserved_chroma_hex=None,
            chroma_tolerance=8,
            max_chroma_pixels=0,
            max_guide_residue_pixels=0,
            min_margin=4,
        )

    def test_pass_with_complete_manual_gates(self) -> None:
        report = self.validate(self.make_workspace())
        self.assertEqual(report["verdict"], "pass")
        self.assertFalse(report["promotionBlocked"])

    def test_fail_when_slot_touches_boundary(self) -> None:
        report = self.validate(self.make_workspace(touching_boundary=True))
        self.assertEqual(report["verdict"], "fail")
        self.assertIn("core:slot:head:touches-boundary", report["checks"]["machineValidation"]["errors"])

    def test_fail_when_slot_has_multiple_components(self) -> None:
        report = self.validate(self.make_workspace(multiple_components=True))
        self.assertEqual(report["verdict"], "fail")
        self.assertIn("core:slot:torso:component-count", report["checks"]["machineValidation"]["errors"])

    def test_fail_when_guide_residue_remains(self) -> None:
        report = self.validate(self.make_workspace(guide_residue=True))
        self.assertEqual(report["verdict"], "fail")
        self.assertEqual(report["sheets"][0]["guideResidue"]["status"], "fail")

    def test_fail_when_slot_is_missing(self) -> None:
        report = self.validate(self.make_workspace(missing_slot=True))
        self.assertEqual(report["verdict"], "fail")
        self.assertIn("core:slot:pelvis:missing-foreground", report["checks"]["machineValidation"]["errors"])

    def test_fail_when_pixels_exist_outside_slots(self) -> None:
        report = self.validate(self.make_workspace(outside_slot_pixels=True))
        self.assertEqual(report["verdict"], "fail")
        self.assertIn("core:outside-slot-pixels", report["checks"]["machineValidation"]["errors"])

    def test_conditional_when_manual_gates_are_incomplete(self) -> None:
        report = self.validate(self.make_workspace(incomplete_manual_gates=True))
        self.assertEqual(report["verdict"], "conditional")
        self.assertTrue(report["promotionBlocked"])
        self.assertEqual(report["checks"]["manualGates"]["status"], "conditional")


if __name__ == "__main__":
    unittest.main()
