#!/usr/bin/env python3
"""Apply the conservative, monotonic candidate adoption gate."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from typing import Any


REQUIRED_PROVENANCE = ("candidate_id", "artifact_digest", "analysis_id", "source_digest", "baseline_id", "rollback_ref", "evaluator_id", "environment_digest", "seed_policy", "holdout_access")
ALLOWED_SPLITS = {"dream", "holdout", "fresh"}


def resolve_reference(reference: str, candidate_path: Path) -> Path | None:
    path = Path(reference)
    choices = [path] if path.is_absolute() else [Path.cwd() / path, candidate_path.parent / path]
    for choice in choices:
        try:
            resolved = choice.resolve()
        except OSError:
            continue
        if resolved.exists():
            return resolved
    return None


def finite_number(value: Any) -> bool:
    return type(value) in (int, float) and math.isfinite(value)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("candidate", type=Path)
    parser.add_argument("receipt", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    candidate_raw = args.candidate.read_bytes()
    candidate = json.loads(candidate_raw)
    receipt = json.loads(args.receipt.read_text(encoding="utf-8"))
    if not isinstance(candidate, dict) or not isinstance(receipt, dict):
        parser.error("candidate and receipt must be JSON objects")
    missing = [field for field in REQUIRED_PROVENANCE if field not in candidate or candidate[field] in (None, "")]
    for field in ("candidate_id", "baseline_id", "rollback_ref"):
        if field in candidate and not isinstance(candidate[field], str):
            missing.append(f"{field} must be a string")
    required_splits = candidate.get("required_splits", ["dream", "holdout"])
    objective = candidate.get("objective", "score")
    if not isinstance(required_splits, list) or not required_splits or any(split not in ALLOWED_SPLITS for split in required_splits):
        missing.append("required_splits is a non-empty list of known splits")
        required_splits = []
    if not {"dream", "holdout"}.issubset(required_splits):
        missing.append("required_splits includes dream and holdout")
    if candidate.get("candidate_id") == candidate.get("baseline_id"):
        missing.append("candidate_id differs from baseline_id")
    summary = receipt.get("summary", {})
    if not isinstance(summary, dict):
        missing.append("replay summary object")
        summary = {}
    receipt_candidates = receipt.get("candidates", [])
    if not isinstance(receipt_candidates, list):
        missing.append("replay candidates list")
        receipt_candidates = []
    baseline = summary.get(candidate.get("baseline_id", "baseline"), summary.get("baseline", {}))
    candidate_summary = summary.get(candidate.get("candidate_id"), {})
    if not isinstance(baseline, dict):
        missing.append("baseline summary object")
        baseline = {}
    if not isinstance(candidate_summary, dict):
        missing.append("candidate summary object")
        candidate_summary = {}
    split_results = {}
    regressions = []
    gains = []
    if receipt.get("schema") != "bagakit.replay-receipt.v1":
        missing.append("replay receipt schema")
    if receipt.get("manifest") in (None, ""):
        missing.append("replay manifest")
    if receipt.get("baseline_id") != candidate.get("baseline_id"):
        missing.append("receipt baseline_id matches candidate")
    if candidate.get("candidate_id") not in receipt_candidates:
        missing.append("candidate appears in replay receipt")
    manifest_source = receipt.get("manifest_source_digest")
    if not manifest_source:
        missing.append("replay manifest source_digest")
    elif candidate.get("source_digest") != manifest_source:
        missing.append("source_digest matches replay manifest")
    for split in required_splits:
        if split not in candidate_summary or split not in baseline:
            split_results[split] = "missing"
            continue
        if not isinstance(candidate_summary[split], dict) or not isinstance(baseline[split], dict):
            split_results[split] = "missing"
            continue
        if not finite_number(candidate_summary[split].get("mean_score")) or not finite_number(baseline[split].get("mean_score")):
            split_results[split] = "missing"
            missing.append(f"finite mean score for {split}")
            continue
        delta = candidate_summary[split]["mean_score"] - baseline[split]["mean_score"]
        split_results[split] = {"delta": delta, "candidate": candidate_summary[split], "baseline": baseline[split]}
        if delta < 0:
            regressions.append({"split": split, "delta": delta})
        if split in {"holdout", "fresh"} and delta > 0:
            gains.append({"split": split, "delta": delta})
    if candidate.get("holdout_access") is not False:
        missing.append("holdout_access=false")
    rollback = resolve_reference(str(candidate.get("rollback_ref", "")), args.candidate)
    if rollback is None or rollback == args.candidate.resolve():
        missing.append("rollback_ref resolves to a prior artifact")
    protected = receipt.get("protected_episodes")
    retention = receipt.get("protected_retention")
    if not isinstance(protected, list) or not isinstance(retention, dict):
        missing.append("protected retention declaration")
    else:
        retained = retention.get(candidate.get("candidate_id"), {})
        if not isinstance(retained, dict) or retained.get("expected") != len(protected) or retained.get("actual") != len(protected):
            missing.append("protected episodes have complete candidate results")
        elif retained.get("regressions"):
            regressions.extend(retained["regressions"])
    if objective != "score" and not candidate.get("objective_evaluator"):
        missing.append("objective_evaluator for non-score objective")
    score_gain_missing = objective == "score" and not gains
    accepted = not missing and not regressions and not score_gain_missing and all(value != "missing" for value in split_results.values()) and receipt.get("errors") == [] and not receipt.get("warnings")
    status = "accepted" if accepted else ("proposed" if missing or any(value == "missing" for value in split_results.values()) else "rejected")
    output = {
        "schema": "bagakit.dreaming-ratchet-receipt.v1",
        "status": status,
        "candidate": candidate,
        "candidate_digest": f"sha256:{hashlib.sha256(candidate_raw).hexdigest()}",
        "replay_receipt": str(args.receipt),
        "rollback_resolved": str(rollback) if rollback else None,
        "split_results": split_results,
        "regressions": regressions,
        "gains": gains,
        "missing_provenance": missing,
        "reasons": (["missing provenance or independence declaration"] if missing else []) + (["required split unavailable"] if any(value == "missing" for value in split_results.values()) else []) + (["replay receipt has errors or unbounded coverage"] if receipt.get("errors") or receipt.get("warnings") else []) + (["split regression"] if regressions else []) + (["no positive holdout/fresh score gain"] if score_gain_missing else []),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), "status": status, "regressions": len(regressions), "missing_provenance": missing}))
    return 0 if status == "accepted" else 2


if __name__ == "__main__":
    raise SystemExit(main())
