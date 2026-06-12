#!/usr/bin/env python3
"""Apply the conservative, monotonic candidate adoption gate."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


REQUIRED_PROVENANCE = ("candidate_id", "artifact_digest", "analysis_id", "source_digest", "baseline_id", "rollback_ref", "evaluator_id", "environment_digest", "seed_policy", "holdout_access")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("candidate", type=Path)
    parser.add_argument("receipt", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    candidate_raw = args.candidate.read_bytes()
    candidate = json.loads(candidate_raw)
    receipt = json.loads(args.receipt.read_text(encoding="utf-8"))
    missing = [field for field in REQUIRED_PROVENANCE if field not in candidate or candidate[field] in (None, "")]
    required_splits = candidate.get("required_splits", ["dream", "holdout"])
    objective = candidate.get("objective", "score")
    baseline = receipt.get("summary", {}).get(candidate.get("baseline_id", "baseline"), receipt.get("summary", {}).get("baseline", {}))
    candidate_summary = receipt.get("summary", {}).get(candidate.get("candidate_id"), {})
    split_results = {}
    regressions = []
    gains = []
    for split in required_splits:
        if split not in candidate_summary or split not in baseline:
            split_results[split] = "missing"
            continue
        delta = candidate_summary[split]["mean_score"] - baseline[split]["mean_score"]
        split_results[split] = {"delta": delta, "candidate": candidate_summary[split], "baseline": baseline[split]}
        if delta < 0:
            regressions.append({"split": split, "delta": delta})
        if split in {"holdout", "fresh"} and delta > 0:
            gains.append({"split": split, "delta": delta})
    if candidate.get("holdout_access") is not False:
        missing.append("holdout_access=false")
    if candidate.get("source_digest") and receipt.get("manifest_source_digest") and candidate["source_digest"] != receipt["manifest_source_digest"]:
        missing.append("source_digest matches replay manifest")
    score_gain_missing = objective == "score" and not gains
    accepted = not missing and not regressions and not score_gain_missing and all(value != "missing" for value in split_results.values()) and receipt.get("errors") == [] and not receipt.get("warnings")
    status = "accepted" if accepted else ("proposed" if missing or any(value == "missing" for value in split_results.values()) else "rejected")
    output = {
        "schema": "bagakit.dreaming-ratchet-receipt.v1",
        "status": status,
        "candidate": candidate,
        "candidate_digest": f"sha256:{hashlib.sha256(candidate_raw).hexdigest()}",
        "replay_receipt": str(args.receipt),
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
