"""Validate a single action row without requiring a full multi-state package."""

from __future__ import annotations

import argparse
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


@dataclass(frozen=True)
class Thresholds:
    min_row_component_area: int = 512
    min_frame_component_area: int = 96
    max_near_key_pixels_per_frame: int = 4
    max_bbox_width_drift: int = 56
    max_bbox_height_drift: int = 18
    max_baseline_drift: int = 8
    max_scale_ratio_delta: float = 0.26
    min_heading_offset_px: float = 1.5
    min_heading_confidence_frames: int = 4


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_hex_color(value: str) -> tuple[int, int, int]:
    raw = value.strip().lstrip("#")
    if len(raw) != 6:
        raise ValueError(f"invalid hex color: {value}")
    return int(raw[0:2], 16), int(raw[2:4], 16), int(raw[4:6], 16)


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").getbbox()


def crop_frame(sheet: Image.Image, index: int, frame_width: int, frame_height: int) -> Image.Image:
    return sheet.crop((index * frame_width, 0, (index + 1) * frame_width, frame_height)).convert("RGBA")


def concat_frames(frames: list[Image.Image], frame_width: int, frame_height: int) -> Image.Image:
    strip = Image.new("RGBA", (len(frames) * frame_width, frame_height), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.paste(frame.convert("RGBA"), (index * frame_width, 0))
    return strip


def images_equal(left: Image.Image, right: Image.Image) -> bool:
    return left.size == right.size and list(left.getdata()) == list(right.getdata())


def connected_components(image: Image.Image) -> list[dict[str, object]]:
    alpha = image.getchannel("A")
    pix = alpha.load()
    seen: set[tuple[int, int]] = set()
    components: list[dict[str, object]] = []
    for y in range(image.height):
        for x in range(image.width):
            if pix[x, y] == 0 or (x, y) in seen:
                continue
            stack = [(x, y)]
            seen.add((x, y))
            area = 0
            min_x = max_x = x
            min_y = max_y = y
            while stack:
                cx, cy = stack.pop()
                area += 1
                min_x = min(min_x, cx)
                max_x = max(max_x, cx)
                min_y = min(min_y, cy)
                max_y = max(max_y, cy)
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < image.width and 0 <= ny < image.height and pix[nx, ny] > 0 and (nx, ny) not in seen:
                        seen.add((nx, ny))
                        stack.append((nx, ny))
            components.append(
                {
                    "area": area,
                    "bbox": [min_x, min_y, max_x + 1, max_y + 1],
                    "width": max_x + 1 - min_x,
                    "height": max_y + 1 - min_y,
                }
            )
    components.sort(key=lambda item: int(item["area"]), reverse=True)
    return components


def near_key_pixel_count(image: Image.Image, key_rgb: tuple[int, int, int], threshold: int) -> int:
    total = 0
    key_r, key_g, key_b = key_rgb
    for r, g, b, a in image.convert("RGBA").getdata():
        if a == 0:
            continue
        if abs(r - key_r) <= threshold and abs(g - key_g) <= threshold and abs(b - key_b) <= threshold:
            total += 1
    return total


def load_manifest(path: Path) -> dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


def fail_report(
    *,
    strip_path: Path,
    frames_manifest_path: Path,
    state: str,
    reason: str,
    expected_frames: int | None = None,
    actual_frames: int | None = None,
    strip_size: list[int] | None = None,
    expected_strip_size: list[int] | None = None,
) -> dict[str, object]:
    return {
        "verdict": "fail",
        "state": state,
        "strip": {
            "path": str(strip_path),
            "sha256": sha256(strip_path) if strip_path.exists() else None,
            "size": strip_size,
        },
        "framesManifest": str(frames_manifest_path),
        "frameCount": expected_frames,
        "checks": {
            "contract": {
                "status": "fail",
                "reason": reason,
                "expectedFrames": expected_frames,
                "actualFrames": actual_frames,
                "stripSize": strip_size,
                "expectedStripSize": expected_strip_size,
            }
        },
        "frames": [],
        "rowComponents": {"raw": None, "significant": None},
        "poseManifest": None,
        "poseLabels": None,
        "actionableReasons": [f"contract:{reason}"],
    }


def load_pose_manifest(path: Path | None, state: str, expected_frames: int) -> tuple[list[dict[str, object]], list[str]]:
    if path is None:
        return [], ["pose-label-manifest-missing"]
    payload = load_manifest(path)
    rows = payload.get("rows", payload)
    if isinstance(rows, dict):
        row = rows.get(state)
    else:
        row = next((item for item in rows if isinstance(item, dict) and item.get("state") == state), None)
    if not isinstance(row, dict):
        return [], [f"pose-label-row-missing:{state}"]
    phases = row.get("phases")
    if not isinstance(phases, list):
        return [], [f"pose-label-phases-missing:{state}"]
    reasons: list[str] = []
    if len(phases) != expected_frames:
        reasons.append(f"pose-label-count-mismatch:{len(phases)}-expected-{expected_frames}")
    return [item for item in phases if isinstance(item, dict)], reasons


def summarize_pose_labels(phases: list[dict[str, object]], expected_frames: int) -> dict[str, object]:
    labels = [str(item.get("phase", "")).strip().lower() for item in phases]
    sides = [str(item.get("side", "")).strip().lower() for item in phases]
    required = {"contact", "recoil", "passing", "high-point"}
    present = {label for label in labels if label}
    missing = sorted(required - present)
    alternating = bool(sides) and all(side in {"left", "right"} for side in sides) and all(
        sides[index] != sides[index - 1] for index in range(1, len(sides))
    )
    cyclic = len(labels) == expected_frames and labels[:4] == ["contact", "recoil", "passing", "high-point"] and labels[4:] == labels[:4]
    return {
        "complete": len(phases) == expected_frames and not missing,
        "labels": labels,
        "sides": sides,
        "missingRequiredPhases": missing,
        "leftRightAlternation": alternating,
        "cyclicOrdering": cyclic,
    }


def infer_heading(frames: list[Image.Image], frame_boxes: list[tuple[int, int, int, int] | None], thresholds: Thresholds) -> dict[str, object]:
    offsets: list[float] = []
    for frame, box in zip(frames, frame_boxes):
        if box is None:
            continue
        left, _, right, _ = box
        center = (left + right) / 2
        alpha = frame.getchannel("A")
        width = frame.width
        total_x = 0.0
        total = 0
        for index, value in enumerate(alpha.getdata()):
            if value > 0:
                total += 1
                total_x += index % width
        if total:
            offsets.append((total_x / total) - center)
    positives = sum(1 for value in offsets if value > thresholds.min_heading_offset_px)
    negatives = sum(1 for value in offsets if value < -thresholds.min_heading_offset_px)
    if positives >= thresholds.min_heading_confidence_frames:
        heading = "right"
    elif negatives >= thresholds.min_heading_confidence_frames:
        heading = "left"
    else:
        heading = "unclear"
    return {"heading": heading, "offsets": [round(value, 3) for value in offsets]}


def validate_single_action_row(
    *,
    strip_path: Path,
    frames_manifest_path: Path,
    state: str,
    expected_frames: int | None,
    pose_manifest_path: Path | None,
    near_key_hex: str | None,
    near_key_threshold: int | None,
) -> dict[str, object]:
    thresholds = Thresholds()
    strip = Image.open(strip_path).convert("RGBA")
    manifest = load_manifest(frames_manifest_path)
    rows = manifest.get("rows", [])
    row = next((item for item in rows if isinstance(item, dict) and item.get("state") == state), None)
    if not isinstance(row, dict):
        return fail_report(
            strip_path=strip_path,
            frames_manifest_path=frames_manifest_path,
            state=state,
            reason=f"missing-row:{state}",
            expected_frames=expected_frames,
            strip_size=[strip.width, strip.height],
        )
    manifest_parent = frames_manifest_path.parent
    frame_paths = []
    for path in row.get("frames", []):
        candidate = Path(path)
        if not candidate.is_absolute():
            candidate = (manifest_parent / candidate).resolve()
        frame_paths.append(candidate)
    frame_count = expected_frames or len(frame_paths)
    frame_images = [Image.open(path).convert("RGBA") for path in frame_paths]
    if len(frame_images) != frame_count:
        return fail_report(
            strip_path=strip_path,
            frames_manifest_path=frames_manifest_path,
            state=state,
            reason=f"frame-count-mismatch:{len(frame_images)}-expected-{frame_count}",
            expected_frames=frame_count,
            actual_frames=len(frame_images),
            strip_size=[strip.width, strip.height],
        )
    frame_width = frame_images[0].width
    frame_height = frame_images[0].height
    if strip.size != (frame_width * frame_count, frame_height):
        return fail_report(
            strip_path=strip_path,
            frames_manifest_path=frames_manifest_path,
            state=state,
            reason="strip-size-mismatch",
            expected_frames=frame_count,
            actual_frames=len(frame_images),
            strip_size=[strip.width, strip.height],
            expected_strip_size=[frame_width * frame_count, frame_height],
        )

    row_components = connected_components(strip)
    significant_row_components = [item for item in row_components if int(item["area"]) >= thresholds.min_row_component_area]
    frame_boxes = [alpha_bbox(frame) for frame in frame_images]
    widths = [box[2] - box[0] for box in frame_boxes if box]
    heights = [box[3] - box[1] for box in frame_boxes if box]
    baselines = [box[3] for box in frame_boxes if box]
    scales = [round(width / height, 4) for width, height in zip(widths, heights) if height]
    heading = infer_heading(frame_images, frame_boxes, thresholds)
    concat_equals_strip = images_equal(strip, concat_frames(frame_images, frame_width, frame_height))
    key_rgb = parse_hex_color(near_key_hex) if near_key_hex else None
    near_key_threshold_value = near_key_threshold if near_key_threshold is not None else int(
        manifest.get("chroma_key", {}).get("threshold", 0)
    )

    frame_reports: list[dict[str, object]] = []
    for index, frame in enumerate(frame_images):
        components = connected_components(frame)
        significant_frame_components = [item for item in components if int(item["area"]) >= thresholds.min_frame_component_area]
        near_key_pixels = near_key_pixel_count(frame, key_rgb, near_key_threshold_value) if key_rgb else 0
        frame_reports.append(
            {
                "index": index,
                "file": str(frame_paths[index]),
                "bbox": list(frame_boxes[index]) if frame_boxes[index] else None,
                "rawComponentCount": len(components),
                "significantComponentCount": len(significant_frame_components),
                "nearKeyPixels": near_key_pixels,
            }
        )

    pose_entries, pose_reasons = load_pose_manifest(pose_manifest_path, state, frame_count)
    pose_summary = summarize_pose_labels(pose_entries, frame_count) if pose_entries else {
        "complete": False,
        "labels": [],
        "sides": [],
        "missingRequiredPhases": ["contact", "recoil", "passing", "high-point"],
        "leftRightAlternation": False,
        "cyclicOrdering": False,
    }

    checks = {
        "singleActionScope": {"status": "pass", "reason": "validated one row only"},
        "frameCount": {
            "status": "pass" if len(frame_images) == frame_count else "fail",
            "expected": frame_count,
            "actual": len(frame_images),
        },
        "rowComponentCount": {
            "status": "pass" if len(significant_row_components) == frame_count else "fail",
            "raw": len(row_components),
            "significant": len(significant_row_components),
            "expected": frame_count,
        },
        "chromaLeakage": {
            "status": "pass"
            if all(item["nearKeyPixels"] <= thresholds.max_near_key_pixels_per_frame for item in frame_reports)
            else "fail",
            "thresholdPerFrame": thresholds.max_near_key_pixels_per_frame,
            "frameCounts": [item["nearKeyPixels"] for item in frame_reports],
        },
        "stripEquality": {"status": "pass" if concat_equals_strip else "fail"},
    }

    if widths and heights and baselines and scales:
        checks["bboxConsistency"] = {
            "status": "pass"
            if max(widths) - min(widths) <= thresholds.max_bbox_width_drift
            and max(heights) - min(heights) <= thresholds.max_bbox_height_drift
            else "fail",
            "widthDrift": max(widths) - min(widths),
            "heightDrift": max(heights) - min(heights),
        }
        checks["baselineConsistency"] = {
            "status": "pass" if max(baselines) - min(baselines) <= thresholds.max_baseline_drift else "fail",
            "baselineDrift": max(baselines) - min(baselines),
        }
        checks["scaleConsistency"] = {
            "status": "pass"
            if max(scales) - min(scales) <= thresholds.max_scale_ratio_delta
            else "fail",
            "scaleRatioDelta": round(max(scales) - min(scales), 4),
        }
    else:
        checks["bboxConsistency"] = {"status": "fail", "reason": "missing-frame-bbox"}
        checks["baselineConsistency"] = {"status": "fail", "reason": "missing-frame-bbox"}
        checks["scaleConsistency"] = {"status": "fail", "reason": "missing-frame-bbox"}

    expected_heading = "right" if state.endswith("right") else "left" if state.endswith("left") else "unknown"
    checks["headingConsistency"] = {
        "status": "pass"
        if expected_heading == "unknown" or heading["heading"] == expected_heading
        else "conditional",
        "expected": expected_heading,
        "observed": heading["heading"],
        "offsets": heading["offsets"],
    }
    checks["poseLabels"] = {
        "status": "pass"
        if pose_summary["complete"] and pose_summary["leftRightAlternation"] and pose_summary["cyclicOrdering"]
        else "conditional",
        "missingRequiredPhases": pose_summary["missingRequiredPhases"],
        "leftRightAlternation": pose_summary["leftRightAlternation"],
        "cyclicOrdering": pose_summary["cyclicOrdering"],
        "reasons": pose_reasons,
    }

    hard_fail = [name for name, value in checks.items() if value["status"] == "fail"]
    conditional = [name for name, value in checks.items() if value["status"] == "conditional"]
    if hard_fail:
        verdict = "fail"
    elif conditional:
        verdict = "conditional"
    else:
        verdict = "pass"

    reasons = [f"{name}:{checks[name]['status']}" for name in hard_fail + conditional]
    return {
        "verdict": verdict,
        "state": state,
        "strip": {"path": str(strip_path), "sha256": sha256(strip_path), "size": [strip.width, strip.height]},
        "framesManifest": str(frames_manifest_path),
        "rowFramePaths": [str(path) for path in frame_paths],
        "frameSize": [frame_width, frame_height],
        "frameCount": frame_count,
        "checks": checks,
        "frames": frame_reports,
        "rowComponents": {"raw": len(row_components), "significant": len(significant_row_components)},
        "poseManifest": str(pose_manifest_path) if pose_manifest_path else None,
        "poseLabels": pose_summary,
        "actionableReasons": reasons,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--strip", required=True, help="RGBA strip PNG")
    parser.add_argument("--frames-manifest", required=True, help="frames-manifest.json for the extracted row")
    parser.add_argument("--state", required=True, help="row/state name, for example running-right")
    parser.add_argument("--expected-frames", type=int, default=None)
    parser.add_argument("--pose-manifest", default=None, help="optional pose-label manifest JSON")
    parser.add_argument("--near-key-hex", default=None, help="optional declared chroma key such as #FF00FF")
    parser.add_argument("--near-key-threshold", type=int, default=None)
    parser.add_argument("--output", default=None, help="optional JSON output path")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    report = validate_single_action_row(
        strip_path=Path(args.strip).resolve(),
        frames_manifest_path=Path(args.frames_manifest).resolve(),
        state=args.state,
        expected_frames=args.expected_frames,
        pose_manifest_path=Path(args.pose_manifest).resolve() if args.pose_manifest else None,
        near_key_hex=args.near_key_hex,
        near_key_threshold=args.near_key_threshold,
    )
    payload = json.dumps(report, indent=2)
    if args.output:
        Path(args.output).write_text(payload + "\n", encoding="utf-8")
    print(payload)
    return 1 if report["verdict"] == "fail" else 0


if __name__ == "__main__":
    raise SystemExit(main())
