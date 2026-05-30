"""Author Feature-owned Bagakit Goal contracts."""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path, PurePosixPath
from string import Template
from typing import Iterable

sys.dont_write_bytecode = True

FEATURE_ID_RE = re.compile(r"^f-[23456789abcdefghjkmnpqrstuvwxyz]{9}$")
TEMPLATE_TOKEN_RE = re.compile(r"<[^>\n]+>|\$\{[a-z_]+\}")
CONVERGENCE_RE = re.compile(r"^Convergence: `(terminal|frontier)`$", re.MULTILINE)
CLOSURE_RE = re.compile(r"^Closure: `(state|threshold|budget|ratchet)`$", re.MULTILINE)
VALID_CLOSURES = {
    "terminal": {"state", "threshold", "budget"},
    "frontier": {"ratchet"},
}
WRAPPER_PATH = PurePosixPath(
    ".bagakit", "feature-tracker", "features", "{feature_id}", "goal.md"
).as_posix()
WRAPPER = f"""@./{WRAPPER_PATH}
Read this Feature Goal first; follow only the Feature owner, current task, and continuation it resolves.

Context may be stale or belong to another Feature; recover from this file before acting.
"""


def skill_root() -> Path:
    return Path(__file__).resolve().parent.parent


def require_feature_id(raw: str) -> str:
    value = raw.strip()
    if not FEATURE_ID_RE.fullmatch(value):
        raise SystemExit("error: feature id must use the canonical Feature Tracker id format")
    return value


def resolve_feature_tracker_cli(explicit: str) -> Path:
    candidates: list[Path] = []
    if explicit:
        candidates.append(Path(explicit))
    env_cli = os.environ.get("BAGAKIT_FEATURE_TRACKER_CLI", "").strip()
    if env_cli:
        candidates.append(Path(env_cli))
    candidates.append(skill_root().parent / "bagakit-feature-tracker" / "scripts" / "feature-tracker.sh")
    for candidate in candidates:
        resolved = candidate.expanduser().resolve()
        if resolved.is_file():
            return resolved
    raise SystemExit(
        "error: bagakit-feature-tracker CLI is required; install the peer skill or pass --feature-tracker-cli"
    )


def run_feature_tracker(cli: Path, args: list[str]) -> int:
    completed = subprocess.run(["bash", str(cli), *args], check=False)
    return completed.returncode


def goal_template_source() -> str:
    return (skill_root() / "references" / "goal-template.md").read_text(encoding="utf-8")


def require_convergence_pair(convergence: str, closure: str) -> tuple[str, str]:
    mode = convergence.strip().lower()
    kind = closure.strip().lower()
    if mode not in VALID_CLOSURES:
        raise SystemExit("error: convergence must be terminal or frontier")
    if kind not in VALID_CLOSURES[mode]:
        allowed = ", ".join(sorted(VALID_CLOSURES[mode]))
        raise SystemExit(f"error: {mode} convergence requires closure: {allowed}")
    return mode, kind


def render_goal_template(feature_id: str, title: str, convergence: str, closure: str) -> str:
    clean_title = title.strip()
    if not clean_title:
        raise SystemExit("error: title must be non-empty")
    mode, kind = require_convergence_pair(convergence, closure)
    return Template(goal_template_source()).substitute(
        title=clean_title,
        feature_id=feature_id,
        convergence=mode,
        closure=kind,
    )


def require_resolved_goal_file(root: str, raw_path: str) -> None:
    path = Path(raw_path)
    if not path.is_absolute():
        path = Path(root).resolve() / path
    path = path.resolve()
    if not path.is_file():
        raise SystemExit(f"error: goal file does not exist: {path}")
    text = path.read_text(encoding="utf-8")
    unresolved = sorted(set(TEMPLATE_TOKEN_RE.findall(text)))
    if unresolved:
        raise SystemExit("error: goal file contains unresolved template placeholders: " + ", ".join(unresolved))
    convergence = CONVERGENCE_RE.findall(text)
    closure = CLOSURE_RE.findall(text)
    if len(convergence) != 1:
        raise SystemExit("error: goal file must declare exactly one Convergence: `terminal|frontier` marker")
    if len(closure) != 1:
        raise SystemExit("error: goal file must declare exactly one Closure: `state|threshold|budget|ratchet` marker")
    require_convergence_pair(convergence[0], closure[0])


def require_active_installed_goal_if_present(root: str, feature_id: str) -> None:
    goal_path = (
        Path(root).resolve()
        / ".bagakit"
        / "feature-tracker"
        / "features"
        / feature_id
        / "goal.md"
    )
    if goal_path.is_file():
        require_resolved_goal_file(root, str(goal_path))


def cmd_describe(_args: argparse.Namespace) -> int:
    print(
        "bagakit-set-loop-goal: author one convergence-directed Agent Goal "
        "inside a Feature Tracker owner."
    )
    return 0


def cmd_list_references(_args: argparse.Namespace) -> int:
    for path in sorted((skill_root() / "references").glob("*")):
        if path.is_file():
            print(path.name)
    return 0


def cmd_validate(_args: argparse.Namespace) -> int:
    required = [
        skill_root() / "SKILL.md",
        skill_root() / "agents" / "openai.yaml",
        skill_root() / "references" / "frontdoor-rule.toml",
        skill_root() / "references" / "convergence-contract.md",
        skill_root() / "references" / "goal-file-contract.md",
        skill_root() / "references" / "goal-template.md",
        skill_root() / "references" / "skill-cli.toml",
        skill_root() / "scripts" / "bagakit-set-loop-goal-cli.sh",
        skill_root() / "scripts" / "bagakit-set-loop-goal.py",
    ]
    missing = [path.relative_to(skill_root()).as_posix() for path in required if not path.is_file()]
    if missing:
        raise SystemExit("error: missing skill assets: " + ", ".join(missing))
    print("skill assets present")
    return 0


def cmd_render_template(args: argparse.Namespace) -> int:
    print(
        render_goal_template(
            require_feature_id(args.feature),
            args.title,
            args.convergence,
            args.closure,
        ),
        end="",
    )
    return 0


def cmd_validate_goal(args: argparse.Namespace) -> int:
    cli = resolve_feature_tracker_cli(args.feature_tracker_cli)
    feature_id = require_feature_id(args.feature)
    command = [
        "validate-feature-goal",
        "--root",
        args.root,
        "--feature",
        feature_id,
    ]
    if args.goal_file:
        require_resolved_goal_file(args.root, args.goal_file)
        command.extend(["--goal-file", args.goal_file])
    else:
        require_active_installed_goal_if_present(args.root, feature_id)
    return run_feature_tracker(cli, command)


def cmd_set_goal(args: argparse.Namespace) -> int:
    cli = resolve_feature_tracker_cli(args.feature_tracker_cli)
    require_resolved_goal_file(args.root, args.goal_file)
    return run_feature_tracker(
        cli,
        [
            "set-feature-goal",
            "--root",
            args.root,
            "--feature",
            require_feature_id(args.feature),
            "--goal-file",
            args.goal_file,
            "--expected-revision",
            args.expected_revision,
        ],
    )


def cmd_render_wrapper(args: argparse.Namespace) -> int:
    print(WRAPPER.format(feature_id=require_feature_id(args.feature)), end="")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Bagakit Feature-owned Goal authoring operator")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("describe").set_defaults(func=cmd_describe)
    sub.add_parser("list-references").set_defaults(func=cmd_list_references)
    sub.add_parser("validate").set_defaults(func=cmd_validate)

    command = sub.add_parser("render-template")
    command.add_argument("--feature", required=True)
    command.add_argument("--title", required=True)
    command.add_argument("--convergence", choices=sorted(VALID_CLOSURES), required=True)
    command.add_argument(
        "--closure",
        choices=sorted({kind for kinds in VALID_CLOSURES.values() for kind in kinds}),
        required=True,
    )
    command.set_defaults(func=cmd_render_template)

    command = sub.add_parser("validate-goal")
    command.add_argument("--root", default=".")
    command.add_argument("--feature", required=True)
    command.add_argument("--goal-file", default="")
    command.add_argument("--feature-tracker-cli", default="")
    command.set_defaults(func=cmd_validate_goal)

    command = sub.add_parser("set-goal")
    command.add_argument("--root", default=".")
    command.add_argument("--feature", required=True)
    command.add_argument("--goal-file", required=True)
    command.add_argument("--expected-revision", required=True)
    command.add_argument("--feature-tracker-cli", default="")
    command.set_defaults(func=cmd_set_goal)

    command = sub.add_parser("render-wrapper")
    command.add_argument("--feature", required=True)
    command.set_defaults(func=cmd_render_wrapper)
    return parser


def main(argv: Iterable[str] | None = None) -> int:
    args = build_parser().parse_args(list(argv) if argv is not None else None)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
