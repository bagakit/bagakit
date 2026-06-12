#!/usr/bin/env python3
"""Aggregate candidate replay results without contacting a model provider."""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import defaultdict
from pathlib import Path
from statistics import mean
from typing import Any


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("results", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--baseline-id", default="baseline")
    parser.add_argument("--min-coverage", type=float, default=1.0)
    args = parser.parse_args()
    raw = args.results.read_bytes()
    groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    rows_by_candidate_episode: dict[tuple[str, str], dict[str, Any]] = {}
    errors: list[str] = []
    warnings: list[str] = []
    manifest: dict[str, Any] | None = None
    if args.manifest:
        try:
            manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"manifest: cannot read ({exc})")
        if manifest is not None:
            splits = manifest.get("splits", {})
            seen: dict[str, str] = {}
            for split, episode_ids in splits.items():
                if split not in {"dream", "holdout", "fresh"} or not isinstance(episode_ids, list):
                    errors.append(f"manifest: invalid split {split}")
                    continue
                for episode_id in episode_ids:
                    key = str(episode_id)
                    if key in seen:
                        errors.append(f"manifest: episode {key} appears in {seen[key]} and {split}")
                    seen[key] = split
    else:
        warnings.append("split manifest not supplied; coverage is unbounded")
    seen_rows: set[tuple[str, str, str]] = set()
    for line_no, line in enumerate(raw.splitlines(), 1):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as exc:
            errors.append(f"line {line_no}: invalid JSON ({exc.msg})")
            continue
        missing = [field for field in ("candidate_id", "episode_id", "split", "score") if field not in row]
        if missing:
            errors.append(f"line {line_no}: missing {','.join(missing)}")
            continue
        if row["split"] not in {"dream", "holdout", "fresh"}:
            errors.append(f"line {line_no}: unknown split {row['split']}")
            continue
        if not isinstance(row["score"], (int, float)):
            errors.append(f"line {line_no}: score must be numeric")
            continue
        row_key = (str(row["candidate_id"]), str(row["episode_id"]), row["split"])
        if row_key in seen_rows:
            errors.append(f"line {line_no}: duplicate candidate/episode/split result")
            continue
        seen_rows.add(row_key)
        if manifest is not None:
            expected_split = next((split for split, ids in manifest.get("splits", {}).items() if str(row["episode_id"]) in {str(value) for value in ids}), None)
            if expected_split != row["split"]:
                errors.append(f"line {line_no}: episode is not in manifest split {row['split']}")
        groups[(str(row["candidate_id"]), row["split"])].append(row)
        rows_by_candidate_episode[(str(row["candidate_id"]), str(row["episode_id"]))] = row
    summary: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    for (candidate, split), rows in sorted(groups.items()):
        scores = [float(row["score"]) for row in rows]
        summary[candidate][split] = {
            "episodes": len({row["episode_id"] for row in rows}),
            "mean_score": mean(scores),
            "min_score": min(scores),
            "max_score": max(scores),
            "cost": sum(float(row.get("cost", 0.0)) for row in rows),
        }
    candidates = sorted(summary)
    baseline = summary.get(args.baseline_id, {})
    regressions = []
    for candidate in candidates:
        if candidate == args.baseline_id:
            continue
        for split in ("holdout", "fresh"):
            if split in summary[candidate] and split in baseline:
                delta = summary[candidate][split]["mean_score"] - baseline[split]["mean_score"]
                if delta < 0:
                    regressions.append({"candidate_id": candidate, "split": split, "delta": delta})
    coverage = {candidate: {split: data["episodes"] for split, data in splits.items()} for candidate, splits in summary.items()}
    protected = set(manifest.get("protected_episodes", [])) if manifest else set()
    for candidate in candidates:
        if candidate == args.baseline_id:
            continue
        for episode_id in sorted(protected):
            base_row = rows_by_candidate_episode.get((args.baseline_id, str(episode_id)))
            candidate_row = rows_by_candidate_episode.get((candidate, str(episode_id)))
            if base_row and candidate_row and float(candidate_row["score"]) < float(base_row["score"]):
                regressions.append({"candidate_id": candidate, "episode_id": str(episode_id), "split": base_row["split"], "delta": float(candidate_row["score"]) - float(base_row["score"]), "protected": True})
    if manifest is not None:
        expected = {split: len(ids) for split, ids in manifest.get("splits", {}).items()}
        for candidate in candidates:
            for split, expected_count in expected.items():
                actual_count = coverage.get(candidate, {}).get(split, 0)
                rate = (actual_count / expected_count) if expected_count else 1.0
                coverage.setdefault(candidate, {})[split] = {"expected": expected_count, "actual": actual_count, "rate": rate}
                if expected_count and rate < args.min_coverage:
                    errors.append(f"coverage: {candidate}/{split} is {rate:.3f}, below {args.min_coverage:.3f}")
    hint = "insufficient"
    if not errors and "baseline" in summary:
        holdout_wins = [summary[c]["holdout"]["mean_score"] > baseline.get("holdout", {}).get("mean_score", float("-inf")) for c in candidates if c != "baseline" and "holdout" in summary[c]]
        if holdout_wins and all(holdout_wins) and not regressions:
            hint = "improves"
        elif regressions:
            hint = "regresses"
    receipt = {
        "schema": "bagakit.replay-receipt.v1",
        "input_digest": f"sha256:{hashlib.sha256(raw).hexdigest()}",
        "candidates": candidates,
        "baseline_id": args.baseline_id,
        "summary": summary,
        "coverage": coverage,
        "manifest": str(args.manifest) if args.manifest else None,
        "manifest_source_digest": manifest.get("source_digest") if manifest else None,
        "regressions": regressions,
        "errors": errors,
        "warnings": sorted(set(warnings)),
        "decision_hint": hint,
        "min_coverage": args.min_coverage,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), "candidates": candidates, "decision_hint": hint, "errors": len(errors), "regressions": len(regressions)}))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
