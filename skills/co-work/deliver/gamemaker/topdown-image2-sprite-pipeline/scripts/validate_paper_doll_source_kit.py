"""Validate a paper-doll source kit before any rig preview or animation."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

try:
    from PIL import Image
except ModuleNotFoundError as exc:
    raise SystemExit("Missing dependency: Pillow. Install it with `python -m pip install Pillow`.") from exc


MANUAL_GATE_FIELDS = (
    "exact_part_ownership",
    "hidden_mating_surface_completeness",
    "identity_style_consistency",
    "camera_material_coherence",
)
PASSING_MANUAL_VALUE = "pass"
COMPONENT_RATIO_FLOOR = 0.002
MIN_COMPONENT_AREA = 16
DEFAULT_MIN_MARGIN = 4


def parse_mapping_arg(value: str) -> tuple[str, Path]:
    if "=" not in value:
        raise argparse.ArgumentTypeError(f"expected NAME=PATH, got {value!r}")
    name, raw_path = value.split("=", 1)
    name = name.strip()
    if not name:
        raise argparse.ArgumentTypeError(f"missing NAME in mapping {value!r}")
    return name, Path(raw_path).expanduser().resolve()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    match = re.fullmatch(r"#?([0-9a-fA-F]{6})", value.strip())
    if not match:
        raise ValueError(f"invalid hex color: {value!r}")
    text = match.group(1)
    return tuple(int(text[index:index + 2], 16) for index in (0, 2, 4))


def color_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> int:
    return max(abs(a[0] - b[0]), abs(a[1] - b[1]), abs(a[2] - b[2]))


def build_foreground_mask(
    image: Image.Image,
    *,
    reserved_chroma_rgb: tuple[int, int, int] | None,
    chroma_tolerance: int,
) -> list[list[bool]]:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    mask: list[list[bool]] = []
    for y in range(rgba.height):
        row: list[bool] = []
        for x in range(rgba.width):
            r, g, b, a = pixels[x, y]
            keep = a > 0
            if keep and reserved_chroma_rgb is not None:
                keep = color_distance((r, g, b), reserved_chroma_rgb) > chroma_tolerance
            row.append(keep)
        mask.append(row)
    return mask


def bbox_from_mask(mask: list[list[bool]]) -> list[int] | None:
    if not mask or not mask[0]:
        return None
    height = len(mask)
    width = len(mask[0])
    min_x = width
    min_y = height
    max_x = -1
    max_y = -1
    for y, row in enumerate(mask):
        for x, value in enumerate(row):
            if not value:
                continue
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)
    if max_x < 0:
        return None
    return [min_x, min_y, max_x + 1, max_y + 1]


def count_true(mask: list[list[bool]]) -> int:
    return sum(1 for row in mask for value in row if value)


def connected_components(mask: list[list[bool]]) -> list[dict[str, int | list[int]]]:
    height = len(mask)
    width = len(mask[0]) if height else 0
    seen = [[False for _ in range(width)] for _ in range(height)]
    components: list[dict[str, int | list[int]]] = []
    for y in range(height):
        for x in range(width):
            if not mask[y][x] or seen[y][x]:
                continue
            stack = [(x, y)]
            seen[y][x] = True
            min_x = max_x = x
            min_y = max_y = y
            area = 0
            while stack:
                current_x, current_y = stack.pop()
                area += 1
                min_x = min(min_x, current_x)
                min_y = min(min_y, current_y)
                max_x = max(max_x, current_x)
                max_y = max(max_y, current_y)
                for next_x, next_y in (
                    (current_x + 1, current_y),
                    (current_x - 1, current_y),
                    (current_x, current_y + 1),
                    (current_x, current_y - 1),
                ):
                    if 0 <= next_x < width and 0 <= next_y < height and mask[next_y][next_x] and not seen[next_y][next_x]:
                        seen[next_y][next_x] = True
                        stack.append((next_x, next_y))
            components.append({
                "area": area,
                "bbox": [min_x, min_y, max_x + 1, max_y + 1],
            })
    components.sort(key=lambda item: int(item["area"]), reverse=True)
    return components


def read_manual_gates(path: Path | None) -> tuple[dict[str, Any], dict[str, Any]]:
    if path is None:
        return {}, {}
    payload = load_json(path)
    gates = payload.get("gates", payload)
    if not isinstance(payload, dict) or not isinstance(gates, dict):
        raise ValueError("manual gates payload must be a JSON object")
    return payload, gates


def evaluate_manual_gates(raw_payload: dict[str, Any], gates: dict[str, Any]) -> dict[str, Any]:
    items: dict[str, Any] = {}
    missing_fields: list[str] = []
    failing_fields: list[str] = []
    for field in MANUAL_GATE_FIELDS:
        raw_value = gates.get(field)
        normalized = str(raw_value).strip().lower() if raw_value is not None else "missing"
        complete = raw_value is not None and normalized != "missing"
        passing = normalized == PASSING_MANUAL_VALUE
        if not complete:
            missing_fields.append(field)
        elif not passing:
            failing_fields.append(field)
        items[field] = {
            "status": "pass" if passing else ("conditional" if not complete else "fail"),
            "value": raw_value if raw_value is not None else "missing",
            "complete": complete,
            "passing": passing,
        }
    all_complete = not missing_fields
    all_passing = all_complete and not failing_fields
    if all_passing:
        status = "pass"
    elif missing_fields:
        status = "conditional"
    else:
        status = "fail"
    return {
        "status": status,
        "review": raw_payload or None,
        "items": items,
        "missingFields": missing_fields,
        "failingFields": failing_fields,
        "complete": all_complete,
        "passing": all_passing,
        "promotionBlocked": not all_passing,
    }


def validate_provenance_fields(path: Path | None) -> dict[str, Any]:
    if path is None:
        return {
            "status": "conditional",
            "supplied": False,
            "missingFields": [],
            "items": {},
            "reason": "no-provenance-file-supplied",
        }
    payload = load_json(path)
    if not isinstance(payload, dict):
        raise ValueError("provenance payload must be a JSON object keyed by sheet name")
    required = ("raw_png", "raw_sha256", "generated_sha256", "byte_equal")
    missing: list[str] = []
    for sheet_name, item in payload.items():
        if not isinstance(item, dict):
            missing.append(f"{sheet_name}:not-an-object")
            continue
        for field in required:
            if field not in item or item[field] in ("", None):
                missing.append(f"{sheet_name}:{field}")
    status = "pass" if not missing else "fail"
    return {
        "status": status,
        "supplied": True,
        "missingFields": missing,
        "items": payload,
        "reason": "complete" if not missing else "missing-required-fields",
    }


def annotation_mask_from_guide(guide: Image.Image) -> tuple[list[list[bool]], int]:
    rgba = guide.convert("RGBA")
    pixels = rgba.load()
    mask: list[list[bool]] = []
    count = 0
    for y in range(rgba.height):
        row: list[bool] = []
        for x in range(rgba.width):
            r, g, b, a = pixels[x, y]
            annotated = a > 0 and not (r >= 245 and g >= 245 and b >= 245)
            if annotated:
                count += 1
            row.append(annotated)
        mask.append(row)
    return mask, count


def validate_sheet(
    *,
    sheet_name: str,
    slot_spec: dict[str, Any],
    image_path: Path,
    guide_path: Path | None,
    reserved_chroma_rgb: tuple[int, int, int] | None,
    chroma_tolerance: int,
    max_chroma_pixels: int,
    max_guide_residue_pixels: int,
    min_margin: int,
) -> dict[str, Any]:
    expected_size = list(slot_spec.get("size", []))
    slots = list(slot_spec.get("slots", []))
    report: dict[str, Any] = {
        "sheet": sheet_name,
        "path": str(image_path),
        "expectedSize": expected_size,
        "exists": image_path.exists(),
        "slotCount": len(slots),
        "slots": [],
        "errors": [],
    }
    if not image_path.exists():
        report["errors"].append("missing-sheet")
        return report

    image = Image.open(image_path).convert("RGBA")
    report["actualSize"] = list(image.size)
    if report["actualSize"] != expected_size:
        report["errors"].append("wrong-dimensions")

    fg_mask = build_foreground_mask(
        image,
        reserved_chroma_rgb=reserved_chroma_rgb,
        chroma_tolerance=chroma_tolerance,
    )
    pixels = image.load()
    outside_slot_pixels = 0
    chroma_pixels = 0
    slot_box_mask = [[False for _ in range(image.width)] for _ in range(image.height)]

    for slot in slots:
        left, top, right, bottom = slot["box"]
        for y in range(top, bottom):
            for x in range(left, right):
                if 0 <= x < image.width and 0 <= y < image.height:
                    slot_box_mask[y][x] = True

    for y in range(image.height):
        for x in range(image.width):
            if fg_mask[y][x] and not slot_box_mask[y][x]:
                outside_slot_pixels += 1
            if reserved_chroma_rgb is not None:
                r, g, b, a = pixels[x, y]
                if a > 0 and color_distance((r, g, b), reserved_chroma_rgb) <= chroma_tolerance:
                    chroma_pixels += 1

    slot_reports: list[dict[str, Any]] = []
    for slot in slots:
        left, top, right, bottom = slot["box"]
        local_mask = [row[left:right] for row in fg_mask[top:bottom]]
        bbox = bbox_from_mask(local_mask)
        components = connected_components(local_mask)
        significant_threshold = max(MIN_COMPONENT_AREA, int((right - left) * (bottom - top) * COMPONENT_RATIO_FLOOR))
        significant = [item for item in components if int(item["area"]) >= significant_threshold]
        slot_report: dict[str, Any] = {
            "index": slot.get("index"),
            "part": slot.get("part"),
            "code": slot.get("code"),
            "box": slot["box"],
            "bbox": bbox,
            "rawComponentCount": len(components),
            "significantComponentCount": len(significant),
            "significantComponentAreaMin": significant_threshold,
            "marginOk": False,
            "touchesBoundary": False,
            "pass": False,
        }
        slot_reports.append(slot_report)
    report["slots"] = slot_reports
    for slot_report, slot in zip(slot_reports, slots):
        left, top, right, bottom = slot["box"]
        bbox = slot_report["bbox"]
        if bbox is None:
            slot_report["errors"] = ["missing-slot-foreground"]
            report["errors"].append(f"slot:{slot.get('part')}:missing-foreground")
            continue
        left_margin = bbox[0]
        top_margin = bbox[1]
        right_margin = (right - left) - bbox[2]
        bottom_margin = (bottom - top) - bbox[3]
        touches_boundary = min(left_margin, top_margin, right_margin, bottom_margin) < min_margin
        slot_report["margins"] = {
            "left": left_margin,
            "top": top_margin,
            "right": right_margin,
            "bottom": bottom_margin,
        }
        slot_report["marginOk"] = not touches_boundary
        slot_report["touchesBoundary"] = touches_boundary
        slot_errors: list[str] = []
        if slot_report["significantComponentCount"] != 1:
            slot_errors.append(f"significant-component-count-{slot_report['significantComponentCount']}-expected-1")
            report["errors"].append(f"slot:{slot.get('part')}:component-count")
        if touches_boundary:
            slot_errors.append("subject-touches-slot-boundary")
            report["errors"].append(f"slot:{slot.get('part')}:touches-boundary")
        slot_report["errors"] = slot_errors
        slot_report["pass"] = not slot_errors

    guide_report: dict[str, Any]
    if guide_path is None:
        guide_report = {
            "status": "not_applicable",
            "supplied": False,
            "path": None,
            "annotationPixels": 0,
            "residuePixels": 0,
            "maxAllowedResiduePixels": max_guide_residue_pixels,
        }
    else:
        if not guide_path.exists():
            report["errors"].append("missing-guide-image")
            guide_report = {
                "status": "fail",
                "supplied": True,
                "path": str(guide_path),
                "reason": "missing-guide-image",
                "annotationPixels": 0,
                "residuePixels": 0,
                "maxAllowedResiduePixels": max_guide_residue_pixels,
            }
        else:
            guide = Image.open(guide_path).convert("RGBA")
            if guide.size != image.size:
                report["errors"].append("guide-size-mismatch")
                guide_report = {
                    "status": "fail",
                    "supplied": True,
                    "path": str(guide_path),
                    "reason": "guide-size-mismatch",
                    "annotationPixels": 0,
                    "residuePixels": 0,
                    "maxAllowedResiduePixels": max_guide_residue_pixels,
                }
            else:
                guide_mask, annotation_pixels = annotation_mask_from_guide(guide)
                guide_pixels = guide.load()
                residue_pixels = 0
                for y in range(image.height):
                    for x in range(image.width):
                        if not guide_mask[y][x]:
                            continue
                        if pixels[x, y][3] == 0:
                            continue
                        guide_rgb = tuple(guide_pixels[x, y][:3])
                        output_rgb = tuple(pixels[x, y][:3])
                        if color_distance(guide_rgb, output_rgb) <= chroma_tolerance:
                            residue_pixels += 1
                if residue_pixels > max_guide_residue_pixels:
                    report["errors"].append("guide-residue")
                guide_report = {
                    "status": "pass" if residue_pixels <= max_guide_residue_pixels else "fail",
                    "supplied": True,
                    "path": str(guide_path),
                    "strategy": "guide-annotation-residue",
                    "annotationPixels": annotation_pixels,
                    "residuePixels": residue_pixels,
                    "maxAllowedResiduePixels": max_guide_residue_pixels,
                }

    if outside_slot_pixels > 0:
        report["errors"].append("outside-slot-pixels")
    if reserved_chroma_rgb is not None and chroma_pixels > max_chroma_pixels:
        report["errors"].append("reserved-chroma-leakage")

    report["outsideSlotPixels"] = outside_slot_pixels
    report["outsideSlotPixelsPass"] = outside_slot_pixels == 0
    report["reservedChroma"] = {
        "status": "not_applicable" if reserved_chroma_rgb is None else ("pass" if chroma_pixels <= max_chroma_pixels else "fail"),
        "hex": None if reserved_chroma_rgb is None else "#{:02X}{:02X}{:02X}".format(*reserved_chroma_rgb),
        "opaquePixels": chroma_pixels,
        "maxAllowedOpaquePixels": max_chroma_pixels,
    }
    report["guideResidue"] = guide_report
    report["sheetPass"] = not report["errors"]
    return report


def validate_paper_doll_source_kit(
    *,
    slot_manifest_path: Path,
    sheet_paths: dict[str, Path],
    guide_paths: dict[str, Path],
    manual_gates_path: Path | None,
    provenance_path: Path | None,
    reserved_chroma_hex: str | None,
    chroma_tolerance: int,
    max_chroma_pixels: int,
    max_guide_residue_pixels: int,
    min_margin: int,
) -> dict[str, Any]:
    manifest = load_json(slot_manifest_path)
    if not isinstance(manifest, dict):
        raise ValueError("slot manifest must be a JSON object keyed by sheet name")
    manual_payload, manual_gate_values = read_manual_gates(manual_gates_path)
    manual_gates = evaluate_manual_gates(manual_payload, manual_gate_values)
    provenance = validate_provenance_fields(provenance_path)
    reserved_chroma_rgb = hex_to_rgb(reserved_chroma_hex) if reserved_chroma_hex else None

    expected_sheet_names = sorted(manifest.keys())
    supplied_sheet_names = sorted(sheet_paths.keys())
    missing_sheets = sorted(name for name in expected_sheet_names if name not in sheet_paths)
    unexpected_sheets = sorted(name for name in supplied_sheet_names if name not in manifest)
    sheet_reports: list[dict[str, Any]] = []
    machine_errors: list[str] = []

    for sheet_name in expected_sheet_names:
        if sheet_name not in sheet_paths:
            machine_errors.append(f"missing-sheet:{sheet_name}")
            continue
        slot_spec = manifest[sheet_name]
        if not isinstance(slot_spec, dict):
            machine_errors.append(f"invalid-sheet-manifest:{sheet_name}")
            continue
        sheet_report = validate_sheet(
            sheet_name=sheet_name,
            slot_spec=slot_spec,
            image_path=sheet_paths[sheet_name],
            guide_path=guide_paths.get(sheet_name),
            reserved_chroma_rgb=reserved_chroma_rgb,
            chroma_tolerance=chroma_tolerance,
            max_chroma_pixels=max_chroma_pixels,
            max_guide_residue_pixels=max_guide_residue_pixels,
            min_margin=min_margin,
        )
        sheet_reports.append(sheet_report)
        machine_errors.extend(f"{sheet_name}:{item}" for item in sheet_report["errors"])

    if unexpected_sheets:
        machine_errors.extend(f"unexpected-sheet:{name}" for name in unexpected_sheets)
    if provenance["status"] == "fail":
        machine_errors.extend(f"provenance:{item}" for item in provenance["missingFields"])

    machine_status = "pass" if not machine_errors and not missing_sheets and not unexpected_sheets else "fail"
    if machine_status == "fail":
        verdict = "fail"
    elif manual_gates["status"] == "pass":
        verdict = "pass"
    elif manual_gates["status"] == "conditional":
        verdict = "conditional"
    else:
        verdict = "fail"
    report = {
        "validator": "scripts/validate_paper_doll_source_kit.py",
        "verdict": verdict,
        "promotionBlocked": verdict != "pass",
        "semanticRiggabilityClaim": {
            "status": "unsupported",
            "reason": "Pixels alone cannot prove semantic riggability. Manual gates must be complete and pass before promotion.",
        },
        "contract": {
            "slotManifest": str(slot_manifest_path),
            "expectedSheets": expected_sheet_names,
            "suppliedSheets": {name: str(path) for name, path in sheet_paths.items()},
            "suppliedGuides": {name: str(path) for name, path in guide_paths.items()},
            "reservedChromaStrategy": {
                "hex": reserved_chroma_hex,
                "tolerance": chroma_tolerance,
                "maxOpaquePixels": max_chroma_pixels,
            },
            "maxGuideResiduePixels": max_guide_residue_pixels,
            "minMarginPixels": min_margin,
        },
        "checks": {
            "expectedSheetsAndSlots": {
                "status": "pass" if not missing_sheets and not unexpected_sheets else "fail",
                "missingSheets": missing_sheets,
                "unexpectedSheets": unexpected_sheets,
                "expectedSlotCounts": {
                    name: len(manifest[name].get("slots", [])) if isinstance(manifest[name], dict) else 0
                    for name in expected_sheet_names
                },
            },
            "machineValidation": {
                "status": machine_status,
                "errors": machine_errors,
            },
            "manualGates": manual_gates,
            "provenance": provenance,
        },
        "sheets": sheet_reports,
    }
    return report


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slot-manifest", required=True, help="JSON manifest keyed by sheet name with size and slot boxes.")
    parser.add_argument(
        "--sheet",
        action="append",
        default=[],
        type=parse_mapping_arg,
        help="Repeated NAME=PATH mapping for each generated sheet.",
    )
    parser.add_argument(
        "--guide",
        action="append",
        default=[],
        type=parse_mapping_arg,
        help="Optional repeated NAME=PATH mapping for slot guide images.",
    )
    parser.add_argument("--manual-gates", help="Optional JSON file with explicit manual gate verdicts.")
    parser.add_argument("--provenance", help="Optional JSON file with source/byte provenance per sheet.")
    parser.add_argument("--reserved-chroma-hex", help="Reserved chroma color to reject when it leaks into opaque output.")
    parser.add_argument("--chroma-tolerance", type=int, default=8)
    parser.add_argument("--max-chroma-pixels", type=int, default=0)
    parser.add_argument("--max-guide-residue-pixels", type=int, default=0)
    parser.add_argument("--min-margin", type=int, default=DEFAULT_MIN_MARGIN)
    parser.add_argument("--report-out", help="Optional path to write the JSON report.")
    return parser


def main() -> int:
    parser = build_arg_parser()
    args = parser.parse_args()
    report = validate_paper_doll_source_kit(
        slot_manifest_path=Path(args.slot_manifest).expanduser().resolve(),
        sheet_paths=dict(args.sheet),
        guide_paths=dict(args.guide),
        manual_gates_path=Path(args.manual_gates).expanduser().resolve() if args.manual_gates else None,
        provenance_path=Path(args.provenance).expanduser().resolve() if args.provenance else None,
        reserved_chroma_hex=args.reserved_chroma_hex,
        chroma_tolerance=args.chroma_tolerance,
        max_chroma_pixels=args.max_chroma_pixels,
        max_guide_residue_pixels=args.max_guide_residue_pixels,
        min_margin=args.min_margin,
    )
    encoded = json.dumps(report, indent=2)
    if args.report_out:
        Path(args.report_out).expanduser().resolve().write_text(encoded + "\n", encoding="utf-8")
    print(encoded)
    if report["verdict"] == "pass":
        return 0
    if report["verdict"] == "conditional":
        return 3
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
