"""Explicit OpenSpec bridge for bagakit-feature-tracker."""

from __future__ import annotations

import argparse
import importlib.util
import os
import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True

TASK_LINE_RE = re.compile(r"^- \[( |x)\]\s*(.+)$")


def resolve_tracker_skill_dir(raw: str | None) -> Path:
    candidates: list[Path] = []
    if raw:
        candidates.append(Path(raw))
    env_value = os.environ.get("BAGAKIT_FEATURE_TRACKER_SKILL_DIR", "").strip()
    if env_value:
        candidates.append(Path(env_value))
    candidates.append(Path(__file__).resolve().parents[2] / "bagakit-feature-tracker")

    for candidate in candidates:
        resolved = candidate.expanduser().resolve()
        if (resolved / "scripts" / "feature-tracker.py").exists():
            return resolved
    raise SystemExit(
        "error: cannot resolve bagakit-feature-tracker skill dir; set "
        "--tracker-skill-dir or BAGAKIT_FEATURE_TRACKER_SKILL_DIR"
    )


def load_tracker_runtime(skill_dir: Path):
    runtime_path = skill_dir / "scripts" / "feature-tracker.py"
    spec = importlib.util.spec_from_file_location("bagakit_feature_tracker_runtime", runtime_path)
    if spec is None or spec.loader is None:
        raise SystemExit(f"error: cannot load tracker runtime: {runtime_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def parse_tasks_md(path: Path, utc_now) -> list[dict[str, object]]:
    items: list[dict[str, object]] = []
    idx = 1
    for line in path.read_text(encoding="utf-8").splitlines():
        match = TASK_LINE_RE.match(line.strip())
        if not match:
            continue
        checked, text = match.groups()
        status = "done" if checked == "x" else "todo"
        items.append(
            {
                "id": f"T-{idx:03d}",
                "title": text,
                "status": status,
                "summary": text,
                "gate_result": "pass" if status == "done" else None,
                "last_gate_at": None,
                "last_gate_commands": [],
                "last_commit_hash": None,
                "started_at": None,
                "finished_at": None,
                "updated_at": utc_now(),
                "notes": [],
            }
        )
        idx += 1
    if items:
        return items
    return [
        {
            "id": "T-001",
            "title": "Imported placeholder task",
            "status": "todo",
            "summary": "No task checkbox detected in OpenSpec tasks.md",
            "gate_result": None,
            "last_gate_at": None,
            "last_gate_commands": [],
            "last_commit_hash": None,
            "started_at": None,
            "finished_at": None,
            "updated_at": utc_now(),
            "notes": [],
        }
    ]


def cmd_import_change(args: argparse.Namespace) -> int:
    tracker_skill_dir = resolve_tracker_skill_dir(args.tracker_skill_dir)
    runtime = load_tracker_runtime(tracker_skill_dir)

    root = Path(args.root).resolve()
    paths = runtime.HarnessPaths(root)
    change_dir = root / "openspec" / "changes" / args.change
    if not change_dir.exists():
        raise SystemExit(f"error: change not found: {change_dir}")

    runtime.ensure_git_repo(root)
    if not paths.harness_dir.exists():
        raise SystemExit(
            "error: tracker missing. run feature-tracker.sh initialize-tracker first"
        )

    feat_id = args.feature_id.strip() if args.feature_id else f"f-{runtime.utc_day()}-{runtime.slugify(args.change)}"
    if not runtime.FEAT_ID_RE.match(feat_id):
        raise SystemExit(f"error: invalid feat-id: {feat_id}")
    if paths.feat_dir(feat_id).exists() or paths.feat_dir(feat_id, status="archived").exists():
        raise SystemExit(f"error: feat already exists: {feat_id}")

    branch = f"feat/{feat_id}"
    wt_name = f"wt-{feat_id}"
    wt_rel = Path(".worktrees") / wt_name
    wt_abs = root / wt_rel
    base_ref = runtime.pick_base_branch(root)

    runtime.ensure_worktrees_ignored(root)
    (root / ".worktrees").mkdir(parents=True, exist_ok=True)
    cp = runtime.run_cmd(
        [
            "git",
            "-C",
            str(root),
            "worktree",
            "add",
            str(wt_abs),
            "-b",
            branch,
            base_ref,
        ]
    )
    if cp.returncode != 0:
        raise SystemExit(cp.stderr.strip() or cp.stdout.strip() or "error: failed to create worktree")

    feat_dir = paths.feat_dir(feat_id)
    feat_dir.mkdir(parents=True, exist_ok=False)
    (feat_dir / "spec-deltas").mkdir(parents=True, exist_ok=True)
    (feat_dir / "artifacts").mkdir(parents=True, exist_ok=True)
    (feat_dir / "gate").mkdir(parents=True, exist_ok=True)

    proposal_src = change_dir / "proposal.md"
    tasks_src = change_dir / "tasks.md"
    proposal_text = proposal_src.read_text(encoding="utf-8") if proposal_src.exists() else f"# Imported Proposal: {args.change}\n"
    tasks_text = tasks_src.read_text(encoding="utf-8") if tasks_src.exists() else "# Imported Tasks\n- [ ] T-001 Imported task\n"
    (feat_dir / "proposal.md").write_text(proposal_text, encoding="utf-8")
    (feat_dir / "tasks.md").write_text(tasks_text, encoding="utf-8")

    spec_src_dir = change_dir / "specs"
    if spec_src_dir.exists():
        for capability_dir in spec_src_dir.iterdir():
            if not capability_dir.is_dir():
                continue
            spec_src = capability_dir / "spec.md"
            if spec_src.exists():
                spec_dst = feat_dir / "spec-deltas" / f"{capability_dir.name}.md"
                spec_dst.write_text(spec_src.read_text(encoding="utf-8"), encoding="utf-8")

    state = {
        "version": 1,
        "feat_id": feat_id,
        "title": f"Imported: {args.change}",
        "slug": runtime.slugify(args.change),
        "goal": f"Imported from openspec/changes/{args.change}",
        "status": "ready",
        "workspace_mode": "worktree",
        "base_ref": base_ref,
        "branch": branch,
        "worktree_name": wt_name,
        "worktree_path": str(wt_rel),
        "created_at": runtime.utc_now(),
        "updated_at": runtime.utc_now(),
        "current_task_id": None,
        "counters": {
            "gate_fail_streak": 0,
            "no_progress_rounds": 0,
            "round_count": 0,
        },
        "gate": {
            "last_result": None,
            "last_task_id": None,
            "last_checked_at": None,
            "last_check_commands": [],
            "last_log_path": None,
        },
        "history": [
            {"at": runtime.utc_now(), "action": "import_openspec", "detail": args.change}
        ],
    }
    tasks = {
        "version": 1,
        "feat_id": feat_id,
        "updated_at": runtime.utc_now(),
        "tasks": parse_tasks_md(feat_dir / "tasks.md", runtime.utc_now),
    }

    runtime.save_feat(paths, feat_id, state, tasks)
    print(f"ok: imported {args.change} -> {feat_id}")
    return 0


def cmd_export_feature(args: argparse.Namespace) -> int:
    tracker_skill_dir = resolve_tracker_skill_dir(args.tracker_skill_dir)
    runtime = load_tracker_runtime(tracker_skill_dir)

    root = Path(args.root).resolve()
    paths = runtime.HarnessPaths(root)
    if not paths.harness_dir.exists():
        raise SystemExit(
            "error: tracker missing. run feature-tracker.sh initialize-tracker first"
        )

    state, tasks = runtime.load_feat(paths, args.feature)
    feat_dir = paths.feat_dir(args.feature, status=str(state.get("status") or ""))
    change_name = args.change_name.strip() or runtime.slugify(args.feature)
    change_dir = root / "openspec" / "changes" / change_name

    if change_dir.exists() and not args.overwrite:
        raise SystemExit(f"error: target change already exists: {change_dir} (use --overwrite)")

    (change_dir / "specs").mkdir(parents=True, exist_ok=True)

    proposal_src = feat_dir / "proposal.md"
    proposal_dst = change_dir / "proposal.md"
    if proposal_src.exists():
        proposal_dst.write_text(proposal_src.read_text(encoding="utf-8"), encoding="utf-8")
    else:
        proposal_dst.write_text(f"# Exported Proposal\n\nFrom feat {args.feature}\n", encoding="utf-8")

    lines = [f"# Implementation Tasks ({args.feature})", ""]
    for task in tasks.get("tasks", []):
        checked = "x" if task.get("status") == "done" else " "
        lines.append(f"- [{checked}] {task.get('title', task.get('id', 'task'))}")
    lines.append("")
    lines.append(f"<!-- Exported at {runtime.utc_now()} -->")
    (change_dir / "tasks.md").write_text("\n".join(lines), encoding="utf-8")

    spec_delta_dir = feat_dir / "spec-deltas"
    if spec_delta_dir.exists():
        for spec_src in spec_delta_dir.glob("*.md"):
            capability = runtime.slugify(spec_src.stem)
            capability_dir = change_dir / "specs" / capability
            capability_dir.mkdir(parents=True, exist_ok=True)
            (capability_dir / "spec.md").write_text(spec_src.read_text(encoding="utf-8"), encoding="utf-8")

    print(f"ok: exported {args.feature} -> openspec/changes/{change_name}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Explicit OpenSpec bridge for bagakit-feature-tracker")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("import-change", help="import one OpenSpec change into tracker feature state")
    sp.add_argument("--root", default=".")
    sp.add_argument("--tracker-skill-dir", default="")
    sp.add_argument("--change", required=True)
    sp.add_argument("--feature-id", default="")
    sp.set_defaults(func=cmd_import_change)

    sp = sub.add_parser("export-feature", help="export one tracked feature into an OpenSpec change directory")
    sp.add_argument("--root", default=".")
    sp.add_argument("--tracker-skill-dir", default="")
    sp.add_argument("--feature", required=True)
    sp.add_argument("--change-name", default="")
    sp.add_argument("--overwrite", action="store_true")
    sp.set_defaults(func=cmd_export_feature)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
