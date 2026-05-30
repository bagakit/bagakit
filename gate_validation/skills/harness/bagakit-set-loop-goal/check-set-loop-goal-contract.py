from __future__ import annotations

import argparse
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:  # Python 3.10 runtime
    import tomli as tomllib


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"error: {message}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    args = parser.parse_args()
    root = Path(args.root)
    skill_dir = root / "skills/harness/bagakit-set-loop-goal"

    skill = (skill_dir / "SKILL.md").read_text(encoding="utf-8")
    frontdoor = tomllib.loads(
        (skill_dir / "references/frontdoor-rule.toml").read_text(encoding="utf-8")
    )
    goal_cli = tomllib.loads(
        (skill_dir / "references/skill-cli.toml").read_text(encoding="utf-8")
    )
    tracker_cli = tomllib.loads(
        (root / "skills/harness/bagakit-feature-tracker/references/skill-cli.toml").read_text(
            encoding="utf-8"
        )
    )

    require(len(skill.splitlines()) <= 110, "SKILL.md must remain concise")
    goal_path = ".bagakit/feature-tracker/features/<feature-id>/goal.md"
    require(frontdoor.get("skill") == "bagakit-set-loop-goal", "frontdoor skill identity drifted")
    require(frontdoor.get("surface") == goal_path, "frontdoor Goal surface drifted")
    require(goal_cli.get("surface_refs") == [goal_path], "Goal CLI surface declaration drifted")

    expected_goal_commands = {
        "describe",
        "list-references",
        "validate",
        "render-template",
        "validate-goal",
        "set-goal",
        "render-wrapper",
    }
    goal_commands = {str(item.get("name")) for item in goal_cli.get("command", [])}
    require(goal_commands == expected_goal_commands, "Goal CLI public command set drifted")

    tracker_commands = {str(item.get("name")) for item in tracker_cli.get("command", [])}
    require(
        {"validate-feature-goal", "set-feature-goal"}.issubset(tracker_commands),
        "Feature Tracker Goal owner commands are missing",
    )
    print("bagakit-set-loop-goal contract passed")


if __name__ == "__main__":
    main()
