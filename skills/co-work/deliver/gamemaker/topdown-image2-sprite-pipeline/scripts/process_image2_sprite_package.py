"""Process image2 source strips into runtime sprite sheets.

This script is intentionally limited to chroma removal, equal strip slicing,
foreground crop, normalization, sheet assembly, preview, README, and validation
report generation. It does not draw or synthesize character pixels.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from dataclasses import dataclass
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ModuleNotFoundError as exc:
    raise SystemExit("Missing dependency: Pillow. Install it with `python -m pip install Pillow`.") from exc


FRAME_W = 128
FRAME_H = 128
GROUND_X = 64
GROUND_Y = 112


@dataclass(frozen=True)
class SheetSpec:
    action: str
    view: str
    frames: int
    source_name: str
    final_name: str


SPECS = [
    SheetSpec("idle", "front", 6, "idle-front-source.png", "hero-image2-idle-front.png"),
    SheetSpec("idle", "back", 6, "idle-back-source.png", "hero-image2-idle-back.png"),
    SheetSpec("walk", "front", 8, "walk-front-source.png", "hero-image2-walk-front.png"),
    SheetSpec("walk", "back", 8, "walk-back-source.png", "hero-image2-walk-back.png"),
    SheetSpec("shoot", "front", 6, "shoot-front-source.png", "hero-image2-shoot-front.png"),
    SheetSpec("shoot", "back", 6, "shoot-back-source.png", "hero-image2-shoot-back.png"),
    SheetSpec("hit", "front", 4, "hit-front-source.png", "hero-image2-hit-front.png"),
    SheetSpec("hit", "back", 4, "hit-back-source.png", "hero-image2-hit-back.png"),
]

REQUIRED_SOURCES = ["model-sheet-source.png", *[spec.source_name for spec in SPECS]]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def is_chroma_green(r: int, g: int, b: int) -> bool:
    return g >= 135 and g >= r + 52 and g >= b + 52 and r <= 125 and b <= 125


def chroma_to_alpha(rgb: Image.Image) -> Image.Image:
    rgba = rgb.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, _ = pixels[x, y]
            if is_chroma_green(r, g, b):
                pixels[x, y] = (0, 0, 0, 0)
            else:
                pixels[x, y] = (r, g, b, 255)
    return rgba


def chroma_scrub_rgba(im: Image.Image) -> Image.Image:
    rgba = im.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = pixels[x, y]
            if a == 0 or is_chroma_green(r, g, b):
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def alpha_bbox(im: Image.Image, threshold: int = 0) -> tuple[int, int, int, int] | None:
    mask = im.getchannel("A").point(lambda a: 255 if a > threshold else 0)
    return mask.getbbox()


def expand_box(box: tuple[int, int, int, int], pad: int, bounds: tuple[int, int]) -> tuple[int, int, int, int]:
    w, h = bounds
    left, top, right, bottom = box
    return max(0, left - pad), max(0, top - pad), min(w, right + pad), min(h, bottom + pad)


def equal_cells(im: Image.Image, frames: int):
    for idx in range(frames):
        left = round(idx * im.width / frames)
        right = round((idx + 1) * im.width / frames)
        yield idx, im.crop((left, 0, right, im.height))


def component_boxes(rgba: Image.Image, sample: int = 3) -> list[dict[str, object]]:
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
        comps.append(
            {
                "sampled_area": count * sample * sample,
                "bbox": list(box),
                "width": box[2] - box[0],
                "height": box[3] - box[1],
            }
        )
    comps.sort(key=lambda c: int(c["sampled_area"]), reverse=True)
    return comps


def compute_sheet_scale(cells: list[Image.Image]) -> float:
    widths: list[int] = []
    heights: list[int] = []
    for cell in cells:
        rgba = chroma_to_alpha(cell)
        bbox = alpha_bbox(rgba)
        if not bbox:
            continue
        crop_box = expand_box(bbox, 8, rgba.size)
        widths.append(crop_box[2] - crop_box[0])
        heights.append(crop_box[3] - crop_box[1])
    if not heights:
        raise ValueError("no foreground detected in source sheet")
    return min(104 / max(heights), 118 / max(widths), 1.0)


def normalize_frame(cell: Image.Image, scale: float) -> tuple[Image.Image, dict[str, object]]:
    rgba = chroma_to_alpha(cell)
    bbox = alpha_bbox(rgba)
    if not bbox:
        raise ValueError("source cell has no non-green foreground pixels")

    crop_box = expand_box(bbox, 8, rgba.size)
    cropped = rgba.crop(crop_box)
    out_w = max(1, round(cropped.width * scale))
    out_h = max(1, round(cropped.height * scale))
    resized = cropped.resize((out_w, out_h), Image.Resampling.LANCZOS)
    resized = chroma_scrub_rgba(resized)
    rbbox = alpha_bbox(resized)
    if not rbbox:
        raise ValueError("resized cell has no foreground pixels")
    resized = resized.crop(rbbox)

    frame = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
    bw, bh = resized.size
    paste_x = max(0, min(FRAME_W - bw, GROUND_X - bw // 2))
    paste_y = max(0, min(FRAME_H - bh, GROUND_Y - bh))
    frame.alpha_composite(resized, (paste_x, paste_y))
    frame = chroma_scrub_rgba(frame)

    final_box = alpha_bbox(frame)
    return frame, {
        "source_cell_size": list(cell.size),
        "source_foreground_bbox": list(bbox),
        "crop_box": list(crop_box),
        "scale": scale,
        "normalized_foreground_bbox": list(final_box) if final_box else None,
    }


def compose_sheet(frames: list[Image.Image]) -> Image.Image:
    sheet = Image.new("RGBA", (len(frames) * FRAME_W, FRAME_H), (0, 0, 0, 0))
    for idx, frame in enumerate(frames):
        sheet.alpha_composite(frame, (idx * FRAME_W, 0))
    return sheet


def green_leak_pixels(im: Image.Image) -> int:
    rgba = im.convert("RGBA")
    data = rgba.get_flattened_data() if hasattr(rgba, "get_flattened_data") else rgba.getdata()
    return sum(1 for r, g, b, a in data if a > 0 and is_chroma_green(r, g, b))


def alpha_bbox_for_cell(sheet: Image.Image, idx: int) -> list[int] | None:
    cell = sheet.crop((idx * FRAME_W, 0, (idx + 1) * FRAME_W, FRAME_H))
    box = alpha_bbox(cell)
    return list(box) if box else None


def frame_semantic_warnings(spec: SheetSpec, frame_meta: list[dict[str, object]]) -> list[str]:
    warnings: list[str] = []
    for meta in frame_meta:
        box = meta.get("normalized_foreground_bbox")
        if not box:
            warnings.append(f"{spec.source_name} frame {meta['frame_index']}: empty normalized frame")
            continue
        left, top, right, bottom = [int(v) for v in box]
        width = right - left
        height = bottom - top
        if height < 64 or width < 28:
            warnings.append(f"{spec.source_name} frame {meta['frame_index']}: small foreground bbox {width}x{height}")
    return warnings


def make_contact_sheet(root: Path, processed: list[dict[str, object]]) -> None:
    final = root / "final"
    scale = 2
    label_h = 24
    row_w = max(int(entry["expected_width"]) for entry in processed)
    canvas = Image.new("RGBA", (row_w * scale, len(processed) * (FRAME_H * scale + label_h)), (26, 28, 32, 255))
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()
    y = 0
    for entry in processed:
        sheet = Image.open(final / str(entry["final_name"])).convert("RGBA")
        preview = sheet.resize((sheet.width * scale, sheet.height * scale), Image.Resampling.NEAREST)
        canvas.alpha_composite(preview, (0, y))
        draw.text((4, y + FRAME_H * scale + 6), str(entry["final_name"]), fill=(235, 235, 235), font=font)
        y += FRAME_H * scale + label_h
    canvas.save(root / "preview-contact-sheet.png")


def write_readme(root: Path, report: dict[str, object]) -> None:
    lines = [
        "# Image2 Processed Runtime Sprite Sheets",
        "",
        "This package was processed from image2-generated source PNG strips in `source/`.",
        "The processor only removed chroma-key background, sliced source strips, cropped foreground, normalized into 128x128 frames, assembled sheets, and validated outputs.",
        "",
        "## Outputs",
        "",
    ]
    for entry in report["sheets"]:
        lines.append(
            f"- `final/{entry['final_name']}`: {entry['frames']} frames, "
            f"{entry['actual_size'][0]}x{entry['actual_size'][1]}, source `{entry['source_name']}`"
        )
    lines.extend(
        [
            "",
            "## Validation",
            "",
            f"- Overall status: `{report['overall_status']}`",
            f"- Frame size: {FRAME_W}x{FRAME_H}",
            "- Background: alpha PNG; chroma-green leakage is checked per final sheet.",
            "- Provenance: `validation-report.json` includes source existence, SHA-256 hashes, and source-to-final mappings.",
            f"- Source semantic warnings: {len(report['source_semantic_warnings'])}",
            "",
            "## Notes",
            "",
            "- No procedural character drawing or replacement is performed by this processor.",
            "- Keep rejected source attempts as `source/*rejected*.png`; they are evidence, not active inputs.",
        ]
    )
    (root / "README.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def collect_file_record(root: Path, rel: str) -> dict[str, object]:
    path = root / rel
    record: dict[str, object] = {"path": rel, "exists": path.exists()}
    if path.exists():
        with Image.open(path) as im:
            record.update({"size": list(im.size), "mode": im.mode, "sha256": sha256(path)})
    return record


def process(root: Path) -> int:
    source = root / "source"
    final = root / "final"
    final.mkdir(parents=True, exist_ok=True)

    required_sources = [collect_file_record(root, f"source/{name}") for name in REQUIRED_SOURCES]
    rejected_sources = [collect_file_record(root, f"source/{p.name}") for p in sorted(source.glob("*rejected*.png"))]
    processed: list[dict[str, object]] = []
    warnings: list[str] = []
    semantic_warnings: list[str] = []
    errors: list[str] = []

    for spec in SPECS:
        source_path = source / spec.source_name
        if not source_path.exists():
            errors.append(f"missing source/{spec.source_name}")
            continue

        src_rgb = Image.open(source_path).convert("RGB")
        src_rgba = chroma_to_alpha(src_rgb)
        detectable = [c for c in component_boxes(src_rgba) if int(c["sampled_area"]) >= 1000]
        if len(detectable) != spec.frames:
            warnings.append(f"{spec.source_name}: detected {len(detectable)} large components for {spec.frames}; used equal slicing")

        cells = [cell for _, cell in equal_cells(src_rgb, spec.frames)]
        scale = compute_sheet_scale(cells)
        frames: list[Image.Image] = []
        frame_meta: list[dict[str, object]] = []
        for idx, cell in enumerate(cells):
            frame, meta = normalize_frame(cell, scale)
            meta["frame_index"] = idx
            frames.append(frame)
            frame_meta.append(meta)
        semantic_warnings.extend(frame_semantic_warnings(spec, frame_meta))

        sheet = compose_sheet(frames)
        out_path = final / spec.final_name
        sheet.save(out_path)

        expected_size = [spec.frames * FRAME_W, FRAME_H]
        actual_size = list(sheet.size)
        leak = green_leak_pixels(sheet)
        nonempty = sum(1 for i in range(spec.frames) if alpha_bbox_for_cell(sheet, i))
        ok = actual_size == expected_size and sheet.mode == "RGBA" and leak == 0 and nonempty == spec.frames
        if not ok:
            errors.append(f"{spec.final_name}: validation failed")

        processed.append(
            {
                "action": spec.action,
                "view": spec.view,
                "source_name": spec.source_name,
                "source_sha256": sha256(source_path),
                "final_name": spec.final_name,
                "final_sha256": sha256(out_path),
                "frames": spec.frames,
                "expected_size": expected_size,
                "actual_size": actual_size,
                "expected_width": expected_size[0],
                "mode": sheet.mode,
                "alpha_png": sheet.mode == "RGBA",
                "nonempty_frames": nonempty,
                "green_leak_pixels": leak,
                "detected_large_components": len(detectable),
                "detected_components": detectable[:12],
                "slicing_method": "equal_source_cell_slicing",
                "character_pixels_source": "source image2 PNG cells after chroma alpha removal",
                "procedural_character_drawing": False,
                "frame_foreground_bboxes": [alpha_bbox_for_cell(sheet, i) for i in range(spec.frames)],
                "frame_processing": frame_meta,
                "ok": ok,
            }
        )

    if processed:
        make_contact_sheet(root, processed)

    report = {
        "contract": "asset-contract.md",
        "processor": "scripts/process_image2_sprite_package.py",
        "processing_scope": [
            "alpha removal",
            "equal source strip slicing",
            "foreground crop",
            "normalization to 128x128 frames",
            "runtime sheet assembly",
            "preview contact sheet generation",
            "validation report generation",
        ],
        "non_procedural_character_constraint": {
            "procedural_character_drawing": False,
            "source_art_origin_claim": "image2-generated source art per generation-log.md",
            "derived_from_source_files": True,
        },
        "required_sources": required_sources,
        "rejected_source_evidence": rejected_sources,
        "sheets": processed,
        "warnings": warnings,
        "source_semantic_warnings": semantic_warnings,
        "errors": errors,
        "overall_status": "pass" if not errors else "fail",
    }
    (root / "validation-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    write_readme(root, report)

    for warning in warnings + semantic_warnings:
        print(f"WARNING: {warning}")
    for error in errors:
        print(f"ERROR: {error}")
    print(f"Processed image2 source strips in {root}")
    print(f"Validation status: {report['overall_status']}")
    return 1 if errors else 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, help="Workspace containing source/ and final/")
    args = parser.parse_args()
    return process(Path(args.root).resolve())


if __name__ == "__main__":
    raise SystemExit(main())
