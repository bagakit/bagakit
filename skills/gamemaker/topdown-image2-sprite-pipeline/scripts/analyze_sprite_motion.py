"""Analyze visual semantics of processed top-down image2 sprite sheets.

This script does not modify art. It computes motion/readability metrics that
catch common image2 sprite failures after mechanical PNG validation passes.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path

try:
    from PIL import Image
except ModuleNotFoundError as exc:
    raise SystemExit("Missing dependency: Pillow. Install it with `python -m pip install Pillow`.") from exc


FRAME_W = 128
FRAME_H = 128
LOWER_BODY_Y = 80


@dataclass(frozen=True)
class SheetSpec:
    action: str
    view: str
    frames: int
    final_name: str


SPECS = [
    SheetSpec("idle", "front", 6, "hero-image2-idle-front.png"),
    SheetSpec("idle", "back", 6, "hero-image2-idle-back.png"),
    SheetSpec("walk", "front", 8, "hero-image2-walk-front.png"),
    SheetSpec("walk", "back", 8, "hero-image2-walk-back.png"),
    SheetSpec("shoot", "front", 6, "hero-image2-shoot-front.png"),
    SheetSpec("shoot", "back", 6, "hero-image2-shoot-back.png"),
    SheetSpec("hit", "front", 4, "hero-image2-hit-front.png"),
    SheetSpec("hit", "back", 4, "hero-image2-hit-back.png"),
]


def image_data(channel):
    return channel.get_flattened_data() if hasattr(channel, "get_flattened_data") else channel.getdata()


def alpha_mask(image: Image.Image) -> list[int]:
    return [1 if a > 0 else 0 for a in image_data(image.getchannel("A"))]


def mask_diff_ratio(a: Image.Image, b: Image.Image) -> float:
    am = alpha_mask(a)
    bm = alpha_mask(b)
    return sum(1 for left, right in zip(am, bm) if left != right) / len(am)


def crop_cell(sheet: Image.Image, idx: int, y0: int = 0, y1: int = FRAME_H) -> Image.Image:
    return sheet.crop((idx * FRAME_W, y0, (idx + 1) * FRAME_W, y1)).convert("RGBA")


def bbox_metrics(cell: Image.Image) -> dict[str, object]:
    alpha = cell.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return {"bbox": None, "alphaArea": 0}
    left, top, right, bottom = bbox
    return {
        "bbox": [left, top, right, bottom],
        "bboxWidth": right - left,
        "bboxHeight": bottom - top,
        "alphaArea": sum(1 for a in image_data(alpha) if a > 0),
    }


def centroid_x(cell: Image.Image) -> float | None:
    alpha = cell.getchannel("A")
    total = 0
    weighted = 0
    for idx, value in enumerate(image_data(alpha)):
        if value > 0:
            total += 1
            weighted += idx % cell.width
    return weighted / total if total else None


def connected_components(cell: Image.Image, min_area: int = 20) -> list[dict[str, object]]:
    alpha = cell.getchannel("A")
    pix = alpha.load()
    seen: set[tuple[int, int]] = set()
    components: list[dict[str, object]] = []
    for y in range(cell.height):
        for x in range(cell.width):
            if pix[x, y] == 0 or (x, y) in seen:
                continue
            stack = [(x, y)]
            seen.add((x, y))
            area = 0
            minx = maxx = x
            miny = maxy = y
            while stack:
                cx, cy = stack.pop()
                area += 1
                minx = min(minx, cx)
                maxx = max(maxx, cx)
                miny = min(miny, cy)
                maxy = max(maxy, cy)
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < cell.width and 0 <= ny < cell.height and pix[nx, ny] > 0 and (nx, ny) not in seen:
                        seen.add((nx, ny))
                        stack.append((nx, ny))
            if area >= min_area:
                components.append(
                    {
                        "area": area,
                        "bbox": [minx, miny, maxx + 1, maxy + 1],
                        "width": maxx + 1 - minx,
                        "height": maxy + 1 - miny,
                    }
                )
    components.sort(key=lambda c: int(c["area"]), reverse=True)
    return components


def sheet_metrics(root: Path, spec: SheetSpec) -> dict[str, object]:
    path = root / "final" / spec.final_name
    item: dict[str, object] = {
        "file": spec.final_name,
        "action": spec.action,
        "view": spec.view,
        "expectedFrames": spec.frames,
        "exists": path.exists(),
        "warnings": [],
    }
    warnings: list[str] = item["warnings"]  # type: ignore[assignment]
    if not path.exists():
        warnings.append("missing-final")
        return item

    sheet = Image.open(path).convert("RGBA")
    item["size"] = list(sheet.size)
    if sheet.size != (spec.frames * FRAME_W, FRAME_H):
        warnings.append(f"bad-size-{sheet.width}x{sheet.height}")
        return item

    cells = [crop_cell(sheet, idx) for idx in range(spec.frames)]
    lower_cells = [crop_cell(sheet, idx, LOWER_BODY_Y, FRAME_H) for idx in range(spec.frames)]
    full_diffs = [mask_diff_ratio(cells[idx - 1], cells[idx]) for idx in range(1, spec.frames)]
    lower_diffs = [mask_diff_ratio(lower_cells[idx - 1], lower_cells[idx]) for idx in range(1, spec.frames)]
    lower_centroids = [centroid_x(cell) for cell in lower_cells]
    lower_centroid_values = [value for value in lower_centroids if value is not None]
    frames = []
    detached_component_frames = []
    for idx, cell in enumerate(cells):
        comps = connected_components(cell)
        frame_info = bbox_metrics(cell)
        frame_info["index"] = idx
        frame_info["components"] = comps[:6]
        frames.append(frame_info)
        if len(comps) > 1 and int(comps[1]["area"]) >= 24:
            detached_component_frames.append({"index": idx, "components": comps[:4]})

    item.update(
        {
            "frames": frames,
            "fullAdjacentAlphaDiff": [round(value, 5) for value in full_diffs],
            "fullAdjacentAlphaDiffMean": round(sum(full_diffs) / len(full_diffs), 5) if full_diffs else None,
            "lowerAdjacentAlphaDiff": [round(value, 5) for value in lower_diffs],
            "lowerAdjacentAlphaDiffMean": round(sum(lower_diffs) / len(lower_diffs), 5) if lower_diffs else None,
            "lowerCentroidX": [round(value, 3) if value is not None else None for value in lower_centroids],
            "lowerCentroidXDrift": round(max(lower_centroid_values) - min(lower_centroid_values), 3) if lower_centroid_values else None,
            "detachedComponentFrames": detached_component_frames,
        }
    )

    mean_lower_diff = item["lowerAdjacentAlphaDiffMean"]
    lower_x_drift = item["lowerCentroidXDrift"]
    if spec.action == "walk":
        if isinstance(mean_lower_diff, float) and mean_lower_diff < 0.018:
            warnings.append("walk-lower-body-motion-too-subtle")
        if isinstance(lower_x_drift, float) and lower_x_drift < 3.5:
            warnings.append("walk-lower-body-centroid-too-static")
    if spec.action == "shoot":
        if isinstance(lower_x_drift, float) and lower_x_drift > 6.0:
            warnings.append("shoot-lower-body-moves-like-walk")
    if detached_component_frames:
        warnings.append("detached-alpha-components-check-source-for-vfx-or-stray-pixels")
    return item


def compare_front_back(root: Path, action: str, frames: int) -> dict[str, object]:
    front = root / "final" / f"hero-image2-{action}-front.png"
    back = root / "final" / f"hero-image2-{action}-back.png"
    item: dict[str, object] = {"action": action, "warnings": []}
    warnings: list[str] = item["warnings"]  # type: ignore[assignment]
    if not front.exists() or not back.exists():
        warnings.append("missing-front-or-back")
        return item
    front_sheet = Image.open(front).convert("RGBA")
    back_sheet = Image.open(back).convert("RGBA")
    diffs = [mask_diff_ratio(crop_cell(front_sheet, idx), crop_cell(back_sheet, idx)) for idx in range(frames)]
    mean = sum(diffs) / len(diffs)
    item["frontBackAlphaDiff"] = [round(value, 5) for value in diffs]
    item["frontBackAlphaDiffMean"] = round(mean, 5)
    if mean < 0.02:
        warnings.append("front-back-silhouettes-too-similar")
    return item


def analyze(root: Path) -> int:
    report: dict[str, object] = {
        "contract": "image2 top-down sprite semantic metrics",
        "warningPolicy": "Warnings require visual review; they do not prove failure alone.",
        "sheets": [],
        "frontBackComparisons": [],
        "warnings": [],
    }
    warnings: list[str] = report["warnings"]  # type: ignore[assignment]

    for spec in SPECS:
        item = sheet_metrics(root, spec)
        report["sheets"].append(item)  # type: ignore[union-attr]
        for warning in item.get("warnings", []):
            warnings.append(f"{spec.final_name}:{warning}")

    for action, frames in (("idle", 6), ("walk", 8), ("shoot", 6), ("hit", 4)):
        item = compare_front_back(root, action, frames)
        report["frontBackComparisons"].append(item)  # type: ignore[union-attr]
        for warning in item.get("warnings", []):
            warnings.append(f"{action}:{warning}")

    out = root / "visual-metrics-report.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 1 if warnings else 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, help="Workspace containing final/*.png")
    args = parser.parse_args()
    return analyze(Path(args.root).resolve())


if __name__ == "__main__":
    raise SystemExit(main())
