#!/usr/bin/env python3
"""Run a bounded, non-gating Auto Research comparison for researcher policies.

The runner owns only record-level comparison. It does not execute providers,
edit the researcher runtime, or claim semantic research improvement.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any


SCHEMA = "bagakit.researcher-autoresearch/v1"
DATASET_SCHEMA = "bagakit.eval-dataset/v1"
QUALITY_MAX = (
    "key_source_recall",
    "citation_precision",
    "counterevidence_coverage",
    "insight_utility",
    "depth",
    "handoff_actionability",
)
RESOURCE_MIN = (
    "steps",
    "elapsed_seconds",
    "tokens",
    "usd",
    "duplicate_rate",
    "unsupported_claim_rate",
)
HARD_FLOORS = {"grounding": 0.8, "validity": 0.8, "drift": 0.8}
HARD_CAPS = {"unsupported_claim_rate": 0.2}


def record(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object")
    return value


def finite_number(value: Any, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{label} must be a finite number")
    return float(value)


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"cannot read JSON {path}: {exc}") from exc
    return record(value, str(path))


def validate_cases(path: Path) -> dict[str, dict[str, Any]]:
    packet = load_json(path)
    if packet.get("schema") != DATASET_SCHEMA:
        raise ValueError(f"{path}.schema must be {DATASET_SCHEMA}")
    items = packet.get("items")
    if not isinstance(items, list) or not items:
        raise ValueError(f"{path}.items must be a non-empty array")
    by_id: dict[str, dict[str, Any]] = {}
    for index, raw in enumerate(items):
        item = record(raw, f"{path}.items[{index}]")
        case_id = item.get("id")
        if not isinstance(case_id, str) or not case_id.strip() or case_id in by_id:
            raise ValueError(f"{path}.items[{index}].id must be unique and non-empty")
        metadata = record(item.get("metadata", {}), f"{path}.items[{index}].metadata")
        task_shape = metadata.get("task_shape")
        if not isinstance(task_shape, str) or not task_shape:
            raise ValueError(f"{path}.items[{index}].metadata.task_shape is required")
        if item.get("split") not in {"baseline", "holdout"}:
            raise ValueError(f"{path}.items[{index}].split must be baseline or holdout")
        by_id[case_id] = item
    return by_id


def validate_vector(raw: Any, label: str) -> dict[str, dict[str, float]]:
    value = record(raw, label)
    quality = record(value.get("quality"), f"{label}.quality")
    resource = record(value.get("resource"), f"{label}.resource")
    hard = record(value.get("hard"), f"{label}.hard")
    for name in QUALITY_MAX:
        finite_number(quality.get(name), f"{label}.quality.{name}")
    for name in RESOURCE_MIN:
        finite_number(resource.get(name), f"{label}.resource.{name}")
    for name in (*HARD_FLOORS, *HARD_CAPS):
        finite_number(hard.get(name), f"{label}.hard.{name}")
    return {"quality": quality, "resource": resource, "hard": hard}


def dominates(left: dict[str, dict[str, float]], right: dict[str, dict[str, float]]) -> bool:
    no_worse = True
    strictly_better = False
    for name in QUALITY_MAX:
        lv = float(left["quality"][name])
        rv = float(right["quality"][name])
        if lv < rv:
            no_worse = False
        if lv > rv:
            strictly_better = True
    for name in RESOURCE_MIN:
        lv = float(left["resource"][name])
        rv = float(right["resource"][name])
        if lv > rv:
            no_worse = False
        if lv < rv:
            strictly_better = True
    return no_worse and strictly_better


def hard_failures(vector: dict[str, dict[str, float]]) -> list[str]:
    failures = []
    for name, floor in HARD_FLOORS.items():
        if vector["hard"][name] < floor:
            failures.append(f"{name} below floor {floor}")
    for name, cap in HARD_CAPS.items():
        if vector["hard"][name] > cap:
            failures.append(f"{name} above cap {cap}")
    return failures


def hard_regressions(candidate: dict[str, dict[str, float]], baseline: dict[str, dict[str, float]]) -> list[str]:
    return [
        f"{name} regressed from {baseline['hard'][name]} to {candidate['hard'][name]}"
        for name in HARD_FLOORS
        if candidate["hard"][name] < baseline["hard"][name]
    ]


def vector_delta(candidate: dict[str, dict[str, float]], baseline: dict[str, dict[str, float]]) -> dict[str, float]:
    delta: dict[str, float] = {}
    for name in QUALITY_MAX:
        delta[name] = candidate["quality"][name] - baseline["quality"][name]
    for name in RESOURCE_MIN:
        delta[name] = candidate["resource"][name] - baseline["resource"][name]
    return delta


def validate_trial(raw: Any, index: int, case_ids: set[str]) -> dict[str, Any]:
    trial = record(raw, f"trials[{index}]")
    required = ("trial_id", "parent_ref", "hypothesis", "axis", "changed_surface", "budget", "evaluator_ref", "cases", "baseline", "candidate", "holdout")
    for key in required:
        if key not in trial:
            raise ValueError(f"trials[{index}] missing {key}")
    trial_id = trial["trial_id"]
    if not isinstance(trial_id, str) or not trial_id.strip():
        raise ValueError(f"trials[{index}].trial_id must be non-empty")
    cases = trial["cases"]
    if not isinstance(cases, list) or not cases or any(case_id not in case_ids for case_id in cases):
        raise ValueError(f"trials[{index}].cases must reference known non-empty case ids")
    if len(set(cases)) != len(cases):
        raise ValueError(f"trials[{index}].cases must not contain duplicate ids")
    budget = record(trial["budget"], f"trials[{index}].budget")
    for name in ("max_steps", "max_elapsed_seconds", "max_tokens", "max_usd"):
        if finite_number(budget.get(name), f"trials[{index}].budget.{name}") <= 0:
            raise ValueError(f"trials[{index}].budget.{name} must be positive")
    if not isinstance(trial["evaluator_ref"], str) or not trial["evaluator_ref"].strip():
        raise ValueError(f"trials[{index}].evaluator_ref must be non-empty")
    return {
        **trial,
        "baseline": validate_vector(trial["baseline"], f"trials[{index}].baseline"),
        "candidate": validate_vector(trial["candidate"], f"trials[{index}].candidate"),
        "holdout": validate_vector(trial["holdout"], f"trials[{index}].holdout"),
    }


def run(cases_path: Path, trials_path: Path) -> dict[str, Any]:
    cases = validate_cases(cases_path)
    packet = load_json(trials_path)
    if packet.get("schema") != SCHEMA:
        raise ValueError(f"{trials_path}.schema must be {SCHEMA}")
    raw_trials = packet.get("trials")
    if not isinstance(raw_trials, list) or not raw_trials:
        raise ValueError(f"{trials_path}.trials must be a non-empty array")
    trials = [validate_trial(raw, index, set(cases)) for index, raw in enumerate(raw_trials)]
    ids = [trial["trial_id"] for trial in trials]
    if len(set(ids)) != len(ids):
        raise ValueError("trial_id values must be unique")

    records: list[dict[str, Any]] = []
    candidate_vectors: list[tuple[str, dict[str, dict[str, float]]]] = []
    for trial in trials:
        candidate = trial["candidate"]
        baseline = trial["baseline"]
        holdout = trial["holdout"]
        baseline_failures = hard_failures(baseline)
        failures = hard_failures(candidate) + hard_regressions(candidate, baseline)
        holdout_failures = hard_failures(holdout) + hard_regressions(holdout, baseline)
        baseline_dominates = dominates(baseline, candidate)
        candidate_dominates_baseline = dominates(candidate, baseline)
        if not baseline_failures and not failures and not holdout_failures:
            candidate_vectors.append((trial["trial_id"], candidate))
        records.append(
            {
                "trial_id": trial["trial_id"],
                "parent_ref": trial["parent_ref"],
                "hypothesis": trial["hypothesis"],
                "axis": trial["axis"],
                "changed_surface": trial["changed_surface"],
                "cases": trial["cases"],
                "budget": trial["budget"],
                "evaluator_ref": trial["evaluator_ref"],
                "quality_vector": candidate["quality"],
                "resource_vector": candidate["resource"],
                "baseline_delta": vector_delta(candidate, baseline),
                "holdout_delta": vector_delta(holdout, baseline),
                "hard_failures": failures,
                "holdout_hard_failures": holdout_failures,
                "baseline_hard_failures": baseline_failures,
                "baseline_dominates_candidate": baseline_dominates,
                "candidate_dominates_baseline": candidate_dominates_baseline,
                "status": "pending",
            }
        )

    nondominated = {
        trial_id
        for trial_id, vector in candidate_vectors
        if not any(other_id != trial_id and dominates(other, vector) for other_id, other in candidate_vectors)
    }
    for result in records:
        if result["baseline_hard_failures"]:
            result["status"] = "discard-invalid-baseline"
        elif result["hard_failures"] or result["holdout_hard_failures"]:
            result["status"] = "discard-hard-regression"
        elif result["trial_id"] not in nondominated:
            result["status"] = "discard-dominated"
        elif result["baseline_dominates_candidate"]:
            result["status"] = "discard-no-improvement"
        else:
            result["status"] = "keep-pareto-candidate"

    return {
        "schema": SCHEMA,
        "protocol": "autoresearch-record-vector-v1",
        "cases_path": cases_path.name,
        "trials_path": trials_path.name,
        "case_counts": {
            "total": len(cases),
            "baseline": sum(item.get("split") == "baseline" for item in cases.values()),
            "holdout": sum(item.get("split") == "holdout" for item in cases.values()),
        },
        "trial_count": len(records),
        "nondominated_trial_ids": sorted(nondominated),
        "records": records,
        "proves": [
            "single-variable trial records are schema-valid",
            "candidate vectors can be compared with hard constraints and Pareto dominance",
            "holdout vectors can reject candidates with record-level regressions",
        ],
        "does_not_prove": [
            "semantic source recall or citation entailment",
            "human-rated insight novelty, depth, or downstream handoff value",
            "that numeric proxy values are calibrated or comparable across providers",
            "that a kept candidate improves open-world research outcomes",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    base = Path(__file__).resolve().parent
    parser.add_argument("--cases", type=Path, default=base / "cases/autoresearch-task-bank.json")
    parser.add_argument("--trials", type=Path, default=base / "cases/autoresearch-trials.json")
    parser.add_argument("--out", type=Path, required=True, help="directory for summary.json and records.jsonl")
    args = parser.parse_args()
    try:
        packet = run(args.cases.resolve(), args.trials.resolve())
    except ValueError as exc:
        parser.error(str(exc))
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "summary.json").write_text(json.dumps(packet, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with (args.out / "records.jsonl").open("w", encoding="utf-8") as handle:
        for record_item in packet["records"]:
            handle.write(json.dumps(record_item, ensure_ascii=False, sort_keys=True) + "\n")
    print(json.dumps({"trial_count": packet["trial_count"], "nondominated_trial_ids": packet["nondominated_trial_ids"], "out": args.out.as_posix()}, ensure_ascii=False))
    print("non-proof: " + "; ".join(packet["does_not_prove"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
