from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "validate_single_action_row.py"
SPEC = importlib.util.spec_from_file_location("validate_single_action_row", SCRIPT_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def make_frame(frame_width: int, frame_height: int, left: int, width: int, *, noise: bool = False, near_key: bool = False) -> Image.Image:
    image = Image.new("RGBA", (frame_width, frame_height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rectangle((left, 8, left + width, 56), fill=(20, 80, 200, 255))
    draw.rectangle((left + 6, 56, left + width - 6, 118), fill=(220, 180, 120, 255))
    draw.rectangle((left + width - 2, 24, min(frame_width - 1, left + width + 8), 52), fill=(20, 80, 200, 255))
    if noise:
        image.putpixel((2, 2), (255, 255, 255, 1))
        image.putpixel((frame_width - 3, 3), (255, 255, 255, 1))
    if near_key:
        for offset in range(5):
            image.putpixel((left + 1 + offset, 10), (255, 0, 255, 255))
    return image


class ValidateSingleActionRowTests(unittest.TestCase):
    def make_workspace(
        self,
        *,
        masked_strip: bool = False,
        include_pose: bool = False,
        near_key: bool = False,
        relative_paths: bool = False,
        omit_last_frame: bool = False,
        bad_strip_size: bool = False,
    ) -> Path:
        temp_root = Path(tempfile.mkdtemp(prefix="single-row-validator-"))
        frames_root = temp_root / "frames" / "running"
        frames_root.mkdir(parents=True)
        frames = [make_frame(32, 128, 5 + (index % 2), 18, noise=True, near_key=near_key) for index in range(8)]
        frame_total = 7 if omit_last_frame else 8
        for index, frame in enumerate(frames[:frame_total]):
            frame.save(frames_root / f"{index:02d}.png")
        strip = MODULE.concat_frames(frames, 32, 128)
        if masked_strip:
            altered = strip.copy()
            altered.putpixel((0, 0), (0, 0, 0, 1))
            strip = altered
        if bad_strip_size:
            strip = strip.crop((0, 0, strip.width - 1, strip.height))
        strip.save(temp_root / "strip.png")
        frame_refs = []
        for index in range(frame_total):
            path = frames_root / f"{index:02d}.png"
            frame_refs.append(str(path.relative_to(temp_root)) if relative_paths else str(path))
        (temp_root / "frames-manifest.json").write_text(
            json.dumps({"rows": [{"state": "running", "frames": frame_refs}]}),
            encoding="utf-8",
        )
        if include_pose:
            phases = ["contact", "recoil", "passing", "high-point", "contact", "recoil", "passing", "high-point"]
            sides = ["left", "right", "left", "right", "left", "right", "left", "right"]
            (temp_root / "pose.json").write_text(
                json.dumps({"rows": [{"state": "running", "phases": [{"phase": phase, "side": side} for phase, side in zip(phases, sides)]}]}),
                encoding="utf-8",
            )
        return temp_root

    def test_pass_with_pose_manifest_and_noise_ignored(self) -> None:
        root = self.make_workspace(include_pose=True)
        report = MODULE.validate_single_action_row(
            strip_path=root / "strip.png",
            frames_manifest_path=root / "frames-manifest.json",
            state="running",
            expected_frames=8,
            pose_manifest_path=root / "pose.json",
            near_key_hex="#FF00FF",
            near_key_threshold=0,
        )
        self.assertEqual(report["verdict"], "pass")
        self.assertEqual(report["checks"]["rowComponentCount"]["significant"], 8)
        self.assertEqual(report["checks"]["stripEquality"]["status"], "pass")

    def test_conditional_without_pose_manifest(self) -> None:
        root = self.make_workspace(include_pose=False)
        report = MODULE.validate_single_action_row(
            strip_path=root / "strip.png",
            frames_manifest_path=root / "frames-manifest.json",
            state="running",
            expected_frames=8,
            pose_manifest_path=None,
            near_key_hex="#FF00FF",
            near_key_threshold=0,
        )
        self.assertEqual(report["verdict"], "conditional")
        self.assertEqual(report["checks"]["poseLabels"]["status"], "conditional")

    def test_fail_when_strip_not_equal_or_key_leaks(self) -> None:
        root = self.make_workspace(masked_strip=True, include_pose=True, near_key=True)
        report = MODULE.validate_single_action_row(
            strip_path=root / "strip.png",
            frames_manifest_path=root / "frames-manifest.json",
            state="running",
            expected_frames=8,
            pose_manifest_path=root / "pose.json",
            near_key_hex="#FF00FF",
            near_key_threshold=0,
        )
        self.assertEqual(report["verdict"], "fail")
        self.assertEqual(report["checks"]["stripEquality"]["status"], "fail")
        self.assertEqual(report["checks"]["chromaLeakage"]["status"], "fail")

    def test_concat_frames_preserves_transparent_rgb_and_alpha_composite_would_not(self) -> None:
        frame = Image.new("RGBA", (4, 4), (0, 0, 0, 0))
        frame.putpixel((1, 1), (17, 23, 31, 0))
        direct = MODULE.concat_frames([frame], 4, 4)
        composed = Image.new("RGBA", (4, 4), (0, 0, 0, 0))
        composed.alpha_composite(frame, (0, 0))
        self.assertEqual(direct.getpixel((1, 1)), (17, 23, 31, 0))
        self.assertNotEqual(direct.getpixel((1, 1)), composed.getpixel((1, 1)))

    def test_relative_frame_paths_resolve_from_manifest_parent(self) -> None:
        root = self.make_workspace(include_pose=True, relative_paths=True)
        report = MODULE.validate_single_action_row(
            strip_path=root / "strip.png",
            frames_manifest_path=root / "frames-manifest.json",
            state="running",
            expected_frames=8,
            pose_manifest_path=root / "pose.json",
            near_key_hex="#FF00FF",
            near_key_threshold=0,
        )
        self.assertEqual(report["verdict"], "pass")
        self.assertTrue(all(Path(path).is_absolute() for path in report["rowFramePaths"]))

    def test_missing_row_returns_machine_readable_fail_json(self) -> None:
        root = self.make_workspace()
        report = MODULE.validate_single_action_row(
            strip_path=root / "strip.png",
            frames_manifest_path=root / "frames-manifest.json",
            state="missing-row",
            expected_frames=8,
            pose_manifest_path=None,
            near_key_hex="#FF00FF",
            near_key_threshold=0,
        )
        self.assertEqual(report["verdict"], "fail")
        self.assertEqual(report["checks"]["contract"]["reason"], "missing-row:missing-row")

    def test_frame_count_mismatch_returns_machine_readable_fail_json(self) -> None:
        root = self.make_workspace(omit_last_frame=True)
        report = MODULE.validate_single_action_row(
            strip_path=root / "strip.png",
            frames_manifest_path=root / "frames-manifest.json",
            state="running",
            expected_frames=8,
            pose_manifest_path=None,
            near_key_hex="#FF00FF",
            near_key_threshold=0,
        )
        self.assertEqual(report["verdict"], "fail")
        self.assertEqual(report["checks"]["contract"]["expectedFrames"], 8)
        self.assertEqual(report["checks"]["contract"]["actualFrames"], 7)

    def test_strip_size_mismatch_prints_machine_readable_fail_json(self) -> None:
        root = self.make_workspace(bad_strip_size=True)
        completed = subprocess.run(
            [
                sys.executable,
                str(SCRIPT_PATH),
                "--strip",
                str(root / "strip.png"),
                "--frames-manifest",
                str(root / "frames-manifest.json"),
                "--state",
                "running",
                "--expected-frames",
                "8",
                "--near-key-hex",
                "#FF00FF",
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(completed.returncode, 1)
        payload = json.loads(completed.stdout)
        self.assertEqual(payload["verdict"], "fail")
        self.assertEqual(payload["checks"]["contract"]["reason"], "strip-size-mismatch")


if __name__ == "__main__":
    unittest.main()
