from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) == 4:
        mode = "success"
        repo_root = Path(sys.argv[1]).resolve()
        brief_path = Path(sys.argv[2]).resolve()
        runner_result_path = Path(sys.argv[3]).resolve()
    elif len(sys.argv) == 5:
        mode = sys.argv[1]
        repo_root = Path(sys.argv[2]).resolve()
        brief_path = Path(sys.argv[3]).resolve()
        runner_result_path = Path(sys.argv[4]).resolve()
    else:
        raise SystemExit("usage: fake_runner.py [mode] <repo-root> <session-brief> <runner-result>")

    brief = json.loads(brief_path.read_text(encoding="utf-8"))
    if mode == "invalid":
        runner_result_path.write_text("{not valid json}\n", encoding="utf-8")
        return 0
    if mode == "cancelled":
        runner_result_path.write_text(
            json.dumps(
                {
                    "schema": "bagakit/agent-loop/runner-result/v1",
                    "session_id": brief["session_id"],
                    "status": "operator_cancelled",
                    "checkpoint_written": False,
                    "note": "runner stopped before checkpoint",
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        return 0

    flow_runner_command = brief["flow_runner_command"]
    item = brief["item"]
    item_id = item["item_id"]
    source_kind = item["source_kind"]

    checkpoint_cmd = [
        *flow_runner_command,
        "checkpoint",
        "--root",
        ".",
        "--item",
        item_id,
        "--stage",
        "review",
        "--session-status",
        "gate_passed",
        "--objective",
        "Review one bounded session",
        "--attempted",
        "Drive agent-loop smoke coverage",
        "--result",
        "Ready for closeout",
        "--next-action",
        "Move to closeout handling",
        "--clean-state",
        "yes",
        "--json",
    ]
    if source_kind != "feature-tracker":
        checkpoint_cmd.extend(["--item-status", "completed"])

    subprocess.run(checkpoint_cmd, cwd=repo_root, check=True)
    runner_result_path.write_text(
        json.dumps(
            {
                "schema": "bagakit/agent-loop/runner-result/v1",
                "session_id": brief["session_id"],
                "status": "completed",
                "checkpoint_written": True,
                "note": "fake runner completed one bounded session",
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
