"""Compare record diagnostics on fixed cases; never grade research semantics."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile


def run(script: Path) -> dict:
    cases_path = Path(__file__).parent / "cases/process-metrics.json"
    data = json.loads(cases_path.read_text())
    results = []
    with tempfile.TemporaryDirectory(prefix="researcher-metric-probes-") as temp:
        root = Path(temp)
        topic = root / ".bagakit/researcher/topics/eval/probes"
        for directory in ("originals", "summaries", "passes", "evaluations"):
            (topic / directory).mkdir(parents=True, exist_ok=True)
        (topic / "index.md").write_text("# Probe fixtures\n")
        (topic / "originals/source.md").write_text(
            "# Source\n\n## Evidence\nA measured latency reduction occurred in one local trial.\n"
        )
        (topic / "passes/stop.md").write_text(
            "# Stop receipt\nA second bounded query found the same source; stop this route.\n"
        )
        for case in data["cases"]:
            (topic / "summaries/result.md").write_text(
                "# Result\n" + case.get("result", "One local trial improved latency; transfer is untested.") + "\n"
            )
            fields = {
                "evaluation id": case["id"], "session ref": "fixture:bounded-task",
                "bounded task": "Compare the trial with the control and state transfer limits.",
                "question": "What can this trial support?",
                "task shape": case.get("task_shape", "bounded-pass"),
                "budget": case.get("budget", "At most two source reads."),
                "stop reason": case.get("stop_reason", "completed"),
                "steps": case.get("steps", "4"),
                "elapsed seconds": case.get("elapsed_seconds", "120"),
                "cost": case.get("cost", "tokens=1200;usd=0.01"),
            }
            sections = {
                "Outcome": "A bounded finding with explicit transfer limits.",
                "Artifact Delta": case.get("artifact_delta", "A sourced comparison with limitations."),
                "Cost Signal": case.get("cost_signal", "Two reads recorded in the fixture."),
                "Resource Use": "- steps: `" + fields["steps"] + "`\n- elapsed seconds: `" + fields["elapsed seconds"] + "`\n- cost: `" + fields["cost"] + "`",
                "Evaluation Protocol": "Fixture-author annotation; deterministic record checks, no human calibration.",
                "Limitations": "Single constructed example; labels alone do not prove research quality.",
                "Next Action": "Review semantic support before reuse.",
            }
            ratings = dict.fromkeys(("grounding", "coverage", "efficiency", "drift", "durable value", "validity"), "strong")
            ratings.update(case.get("ratings", {}))
            omitted = case.get("omit", [])
            lines = ["# Evaluation", "", "## Session Evaluation", ""]
            lines += [f"- {key}: `{value}`" for key, value in fields.items() if key not in omitted]
            for key, value in sections.items():
                if key not in omitted:
                    lines += ["", f"## {key}", "", value]
            lines += ["", "## Quality Dimensions", ""]
            lines += [f"- {key}: `{value}`" for key, value in ratings.items()]
            for heading, refs in (
                ("Evidence Refs", case.get("evidence_refs", ["originals/source.md#evidence"])),
                ("Artifact Refs", case.get("artifact_refs", ["summaries/result.md"])),
                ("Coverage Refs", case.get("coverage_refs", [])),
                ("Decision Refs", case.get("decision_refs", [])),
            ):
                lines += ["", f"## {heading}"] + ["- " + ref for ref in refs]
            (topic / "evaluations/probe.md").write_text("\n".join(lines) + "\n")
            proc = subprocess.run(
                [sys.executable, str(script), "doctor", "--root", str(root), "--topic-class", "eval", "--topic", "probes", "--process"],
                capture_output=True, text=True, timeout=20,
            )
            warnings = [line for line in proc.stderr.splitlines() if line.startswith("warning:")]
            observed = bool(warnings)
            match = observed == case["warning"] and (not case.get("diagnostic") or case["diagnostic"] in proc.stderr)
            results.append({
                "id": case["id"], "expected_warning": case["warning"], "observed_warning": observed,
                "exit_code": proc.returncode, "matches_record_oracle": match and proc.returncode == 0,
                "semantic_control": case.get("semantic_control", False),
                "semantic_verdict": case["semantic_verdict"],
                "warnings": warnings, "output": proc.stdout.strip(),
            })
    diagnostic = [r for r in results if not r["semantic_control"]]
    return {
        "protocol": data["protocol"], "script_sha256": hashlib.sha256(script.read_bytes()).hexdigest(),
        "cases_sha256": hashlib.sha256(cases_path.read_bytes()).hexdigest(),
        "annotation": data["provenance"],
        "counts": {
            "diagnostic_cases": len(diagnostic),
            "true_positive": sum(r["expected_warning"] and r["observed_warning"] for r in diagnostic),
            "false_negative": sum(r["expected_warning"] and not r["observed_warning"] for r in diagnostic),
            "false_positive": sum(not r["expected_warning"] and r["observed_warning"] for r in diagnostic),
            "true_negative": sum(not r["expected_warning"] and not r["observed_warning"] for r in diagnostic),
            "semantic_controls": sum(r["semantic_control"] for r in results),
        },
        "cases": results,
        "does_not_prove": "Diagnostic sensitivity on author-labelled fixtures is not semantic grading accuracy, inter-rater reliability, a blind study, or improved research outcomes.",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--researcher", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    packet = run(args.researcher.resolve())
    rendered = json.dumps(packet, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered)
    print(json.dumps(packet["counts"]))
    print(packet["does_not_prove"])
    sys.exit(0 if all(r["matches_record_oracle"] for r in packet["cases"]) else 1)
