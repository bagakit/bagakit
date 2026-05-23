"""Validate source sprite sheet layout before alpha removal and packing."""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass
from pathlib import Path

try:
    from PIL import Image
except ModuleNotFoundError as exc:
    raise SystemExit("Missing dependency: Pillow. Install it with `python -m pip install Pillow`.") from exc


@dataclass(frozen=True)
class SourceSpec:
    name: str
    frames: int
    action: str
    view: str


SPECS = [
    SourceSpec("idle-front-source.png", 6, "idle", "front"),
    SourceSpec("idle-back-source.png", 6, "idle", "back"),
    SourceSpec("walk-front-source.png", 8, "walk", "front"),
    SourceSpec("walk-back-source.png", 8, "walk", "back"),
    SourceSpec("shoot-front-source.png", 6, "shoot", "front"),
    SourceSpec("shoot-back-source.png", 6, "shoot", "back"),
    SourceSpec("hit-front-source.png", 4, "hit", "front"),
    SourceSpec("hit-back-source.png", 4, "hit", "back"),
]


GRID_CANDIDATES = {
    8: [(8, 1), (4, 2), (2, 4)],
    6: [(6, 1), (3, 2), (2, 3)],
    4: [(4, 1), (2, 2)],
}


def is_chroma_green(r: int, g: int, b: int) -> bool:
    return g >= 135 and g >= r + 52 and g >= b + 52 and r <= 125 and b <= 125


def to_alpha(im: Image.Image) -> Image.Image:
    rgba = im.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = pixels[x, y]
            if a == 0 or is_chroma_green(r, g, b):
                pixels[x, y] = (0, 0, 0, 0)
            else:
                pixels[x, y] = (r, g, b, 255)
    return rgba


def connected_components(rgba: Image.Image, sample: int = 2) -> list[dict[str, object]]:
    alpha = rgba.getchannel("A")
    sw = math.ceil(rgba.width / sample)
    sh = math.ceil(rgba.height / sample)
    pix = alpha.load()
    foreground: set[tuple[int, int]] = set()

    for sy in range(sh):
        y = min(sy * sample, rgba.height - 1)
        for sx in range(sw):
            x = min(sx * sample, rgba.width - 1)
            if pix[x, y] > 0:
                foreground.add((sx, sy))

    seen: set[tuple[int, int]] = set()
    comps: list[dict[str, object]] = []
    for start in list(foreground):
        if start in seen:
            continue
        stack = [start]
        seen.add(start)
        minx = maxx = start[0]
        miny = maxy = start[1]
        count = 0
        while stack:
            x, y = stack.pop()
            count += 1
            minx = min(minx, x)
            maxx = max(maxx, x)
            miny = min(miny, y)
            maxy = max(maxy, y)
            for nb in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if nb in foreground and nb not in seen:
                    seen.add(nb)
                    stack.append(nb)
        box = (
            minx * sample,
            miny * sample,
            min((maxx + 1) * sample, rgba.width),
            min((maxy + 1) * sample, rgba.height),
        )
        comps.append({
            "area": count * sample * sample,
            "bbox": list(box),
            "width": box[2] - box[0],
            "height": box[3] - box[1],
        })
    comps.sort(key=lambda c: int(c["area"]), reverse=True)
    return comps


def cell_report(alpha: Image.Image, cols: int, rows: int) -> tuple[list[dict[str, object]], list[str]]:
    reports: list[dict[str, object]] = []
    errors: list[str] = []
    cell_w = alpha.width / cols
    cell_h = alpha.height / rows

    for row in range(rows):
        for col in range(cols):
            idx = row * cols + col
            left = round(col * cell_w)
            top = round(row * cell_h)
            right = round((col + 1) * cell_w)
            bottom = round((row + 1) * cell_h)
            cell = alpha.crop((left, top, right, bottom))
            bbox = cell.getchannel("A").getbbox()
            comps = [c for c in connected_components(cell) if int(c["area"]) >= 80]
            item: dict[str, object] = {
                "index": idx,
                "row": row,
                "col": col,
                "box": [left, top, right, bottom],
                "bbox": list(bbox) if bbox else None,
                "component_count": len(comps),
                "components": comps[:4],
            }
            if not bbox:
                errors.append(f"cell-{idx}:empty")
            else:
                bw = bbox[2] - bbox[0]
                bh = bbox[3] - bbox[1]
                item["bbox_width"] = bw
                item["bbox_height"] = bh
                if bw < 12 or bh < 24:
                    errors.append(f"cell-{idx}:foreground-too-small-{bw}x{bh}")
                if bw > (right - left) * 0.88 or bh > (bottom - top) * 0.94:
                    errors.append(f"cell-{idx}:foreground-touches-cell-boundary-{bw}x{bh}")
                bleft, btop, bright, bbottom = bbox
                edge_margin = 2
                if bleft <= edge_margin or btop <= edge_margin or bright >= cell.width - edge_margin or bbottom >= cell.height - edge_margin:
                    errors.append(f"cell-{idx}:bbox-on-cell-edge")
                if len(comps) != 1:
                    errors.append(f"cell-{idx}:component-count-{len(comps)}-expected-1")
            reports.append(item)
    return reports, errors


def score_candidate(alpha: Image.Image, cols: int, rows: int) -> dict[str, object]:
    cells, errors = cell_report(alpha, cols, rows)
    component_counts = [int(c["component_count"]) for c in cells]
    empty_count = sum(1 for c in cells if not c["bbox"])
    return {
        "grid": [cols, rows],
        "errors": errors,
        "empty_count": empty_count,
        "total_cell_components": sum(component_counts),
        "cells": cells,
        "accepted": not errors,
    }


def validate_one(path: Path, spec: SourceSpec) -> dict[str, object]:
    item: dict[str, object] = {
        "file": spec.name,
        "action": spec.action,
        "view": spec.view,
        "expected_frames": spec.frames,
        "exists": path.exists(),
        "errors": [],
        "warnings": [],
    }
    errors: list[str] = item["errors"]  # type: ignore[assignment]
    warnings: list[str] = item["warnings"]  # type: ignore[assignment]
    if not path.exists():
        errors.append("missing-source")
        return item

    image = Image.open(path)
    alpha = to_alpha(image)
    large_components = [c for c in connected_components(alpha) if int(c["area"]) >= 500]
    item["size"] = list(image.size)
    item["mode"] = image.mode
    item["large_component_count"] = len(large_components)
    item["large_components"] = large_components[:12]
    if len(large_components) != spec.frames:
        errors.append(f"large-component-count-{len(large_components)}-expected-{spec.frames}")

    candidates = [score_candidate(alpha, cols, rows) for cols, rows in GRID_CANDIDATES[spec.frames]]
    item["candidate_grids"] = candidates
    accepted = [c for c in candidates if c["accepted"]]
    if not accepted:
        errors.append("no-valid-grid")
    else:
        item["accepted_grid"] = accepted[0]["grid"]

    if spec.action == "shoot":
        warnings.append("semantic-check-required:no-bullets-no-muzzle-flash-no-projectile")
    if spec.action == "walk":
        warnings.append("semantic-check-required:visible-gait-not-turnaround")
    return item


def validate(root: Path) -> int:
    source = root / "source"
    report: dict[str, object] = {
        "validator": "scripts/validate_source_layout.py",
        "scope": "pre-processing source layout gate",
        "accepted_layouts": GRID_CANDIDATES,
        "sources": [],
        "errors": [],
        "warnings": [],
        "overall_status": "pass",
    }
    all_errors: list[str] = report["errors"]  # type: ignore[assignment]
    all_warnings: list[str] = report["warnings"]  # type: ignore[assignment]

    for spec in SPECS:
        item = validate_one(source / spec.name, spec)
        report["sources"].append(item)  # type: ignore[union-attr]
        for error in item["errors"]:  # type: ignore[index]
            all_errors.append(f"{spec.name}:{error}")
        for warning in item["warnings"]:  # type: ignore[index]
            all_warnings.append(f"{spec.name}:{warning}")

    report["overall_status"] = "fail" if all_errors else "pass"
    out = root / "source-layout-report.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 1 if all_errors else 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, help="Workspace containing source/")
    args = parser.parse_args()
    return validate(Path(args.root).resolve())


if __name__ == "__main__":
    raise SystemExit(main())
