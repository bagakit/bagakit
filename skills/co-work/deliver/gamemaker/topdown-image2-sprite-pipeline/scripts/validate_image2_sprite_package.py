"""Independently validate an image2 top-down sprite package."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

try:
    from PIL import Image
except ModuleNotFoundError as exc:
    raise SystemExit("Missing dependency: Pillow. Install it with `python -m pip install Pillow`.") from exc


SOURCE_FILES = [
    "model-sheet-source.png",
    "idle-front-source.png",
    "idle-back-source.png",
    "walk-front-source.png",
    "walk-back-source.png",
    "shoot-front-source.png",
    "shoot-back-source.png",
    "hit-front-source.png",
    "hit-back-source.png",
]

FINAL_SPECS = {
    "hero-image2-idle-front.png": 6,
    "hero-image2-idle-back.png": 6,
    "hero-image2-walk-front.png": 8,
    "hero-image2-walk-back.png": 8,
    "hero-image2-shoot-front.png": 6,
    "hero-image2-shoot-back.png": 6,
    "hero-image2-hit-front.png": 4,
    "hero-image2-hit-back.png": 4,
}

FRAME_W = 128
FRAME_H = 128


def alpha_corners_clear(image: Image.Image, margin: int = 3) -> bool:
    alpha = image.convert("RGBA").getchannel("A")
    points = []
    for x in range(margin):
        for y in range(margin):
            points.extend([(x, y), (image.width - 1 - x, y), (x, image.height - 1 - y), (image.width - 1 - x, image.height - 1 - y)])
    return all(alpha.getpixel(point) == 0 for point in points)


def green_ratio(image: Image.Image) -> float:
    total = 0
    green = 0
    rgba = image.convert("RGBA")
    data = rgba.get_flattened_data() if hasattr(rgba, "get_flattened_data") else rgba.getdata()
    for r, g, b, a in data:
        if a <= 0:
            continue
        total += 1
        if g > 200 and r < 90 and b < 90:
            green += 1
    return green / total if total else 0.0


def bbox_metrics(image: Image.Image, frames: int) -> tuple[list[dict[str, object]], dict[str, object]]:
    result = []
    centers = []
    widths = []
    heights = []
    bottoms = []
    for idx in range(frames):
        crop = image.crop((idx * FRAME_W, 0, (idx + 1) * FRAME_W, FRAME_H))
        bbox = crop.getchannel("A").getbbox()
        info: dict[str, object] = {"index": idx, "bbox": bbox}
        if bbox:
            left, top, right, bottom = bbox
            cx = (left + right) / 2
            centers.append(cx)
            widths.append(right - left)
            heights.append(bottom - top)
            bottoms.append(bottom)
            info.update({"centerX": round(cx, 2), "width": right - left, "height": bottom - top, "bottomY": bottom})
        result.append(info)
    drift: dict[str, object] = {}
    if centers:
        drift = {
            "centerXDrift": round(max(centers) - min(centers), 2),
            "widthDrift": max(widths) - min(widths),
            "heightDrift": max(heights) - min(heights),
            "groundYDrift": max(bottoms) - min(bottoms),
        }
    return result, drift


def validate(root: Path) -> int:
    source = root / "source"
    final = root / "final"
    report: dict[str, object] = {
        "sourceFiles": {},
        "finalSheets": [],
        "artifacts": {},
        "warnings": [],
    }
    warnings: list[str] = report["warnings"]  # type: ignore[assignment]

    for name in SOURCE_FILES:
        path = source / name
        exists = path.exists()
        item: dict[str, object] = {"exists": exists}
        if not exists:
            warnings.append(f"{name}:missing-source")
        else:
            image = Image.open(path)
            item.update({"size": list(image.size), "mode": image.mode, "bytes": path.stat().st_size})
            if path.stat().st_size < 100_000:
                warnings.append(f"{name}:source-too-small-for-image2-output")
        report["sourceFiles"][name] = item  # type: ignore[index]

    for name, frames in FINAL_SPECS.items():
        path = final / name
        item: dict[str, object] = {"file": name, "exists": path.exists(), "expectedFrames": frames, "warnings": []}
        sheet_warnings: list[str] = item["warnings"]  # type: ignore[assignment]
        if not path.exists():
            sheet_warnings.append("missing-final")
        else:
            image = Image.open(path).convert("RGBA")
            item["size"] = list(image.size)
            item["mode"] = image.mode
            item["alphaCornersClear"] = alpha_corners_clear(image)
            item["greenOpaqueRatio"] = round(green_ratio(image), 6)
            frames_info, drift = bbox_metrics(image, frames)
            item["frames"] = frames_info
            item.update(drift)
            if image.size != (frames * FRAME_W, FRAME_H):
                sheet_warnings.append(f"bad-size-{image.width}x{image.height}")
            if not item["alphaCornersClear"]:
                sheet_warnings.append("alpha-corners-not-clear")
            if item["greenOpaqueRatio"] > 0.01:
                sheet_warnings.append("green-leakage")
            if drift.get("centerXDrift", 0) > 24:
                sheet_warnings.append("center-x-drift-high")
            if drift.get("widthDrift", 0) > 42:
                sheet_warnings.append("width-drift-high")
            if drift.get("groundYDrift", 0) > 26:
                sheet_warnings.append("ground-y-drift-high")
        for warning in sheet_warnings:
            warnings.append(f"{name}:{warning}")
        report["finalSheets"].append(item)  # type: ignore[union-attr]

    for name in ["generation-log.md", "README.md", "preview-contact-sheet.png", "validation-report.json"]:
        exists = (root / name).exists()
        report["artifacts"][name] = exists  # type: ignore[index]
        if not exists:
            warnings.append(f"missing-artifact:{name}")

    report["rejectedSourcesKeptForEvidence"] = sorted(p.name for p in source.glob("*rejected*.png"))
    out = root / "independent-image2-validation-report.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 1 if warnings else 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, help="Workspace containing source/ and final/")
    args = parser.parse_args()
    return validate(Path(args.root).resolve())


if __name__ == "__main__":
    raise SystemExit(main())
