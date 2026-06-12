#!/usr/bin/env bash
set -euo pipefail

ROOT="."
while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      if [[ $# -lt 2 ]]; then
        echo "error: --root requires a path" >&2
        exit 2
      fi
      ROOT="$2"
      shift 2
      ;;
    *)
      echo "error: unexpected argument: $1" >&2
      exit 2
      ;;
  esac
done

ROOT="$(cd "$ROOT" && pwd)"
SKILL_DIR="$ROOT/skills/co-work/orchestrate/execution/bagakit-feature-tracker"
LIB_DIR="$ROOT/gate_validation/skills/co-work/orchestrate/execution/bagakit-feature-tracker/lib"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
source "$LIB_DIR/feature-tracker-testlib.sh"

feature_tracker_init_temp_repo "$TMP_DIR"
bash "$SKILL_DIR/scripts/feature-tracker.sh" initialize-tracker --root "$TMP_DIR" >/dev/null

PLAN="$TMP_DIR/status-board-plan.json"
cat >"$PLAN" <<'JSON'
{
  "schema": "bagakit.feature-task-plan.v1",
  "review": {"status": "approved", "evidence_ref": "review/status-board"},
  "source_refs": ["test/status-board"],
  "tasks": [
    {
      "id": "T-003",
      "depends_on": ["T-001", "T-002"],
      "title": "Join the two status branches into one readable candidate",
      "objective": "Close the integrated status-board fixture.",
      "outcome": "The topology exposes a readable fan-in join.",
      "acceptance": ["The joined candidate has two incoming edges."],
      "verification": [{"kind": "command", "ref": "true", "proves": "The fixture gate is executable."}],
      "source_refs": ["test/status-board"],
      "supersedes": []
    },
    {
      "id": "T-001",
      "depends_on": [],
      "title": "Build the first status branch with a deliberately long title",
      "objective": "Close the first independent status branch.",
      "outcome": "The first branch is independently visible.",
      "acceptance": ["The first branch is visible in the topology."],
      "verification": [{"kind": "command", "ref": "true", "proves": "The fixture gate is executable."}],
      "source_refs": ["test/status-board"],
      "supersedes": []
    },
    {
      "id": "T-002",
      "depends_on": [],
      "title": "Build the second status branch with a deliberately long title",
      "objective": "Close the second independent status branch.",
      "outcome": "The second branch is independently visible.",
      "acceptance": ["The second branch is visible in the topology."],
      "verification": [{"kind": "command", "ref": "true", "proves": "The fixture gate is executable."}],
      "source_refs": ["test/status-board"],
      "supersedes": []
    },
    {
      "id": "T-004",
      "depends_on": ["T-001", "T-003"],
      "title": "Exercise an outside rail for a cross-layer dependency",
      "objective": "Prove that a dependency skipping a layer stays outside the node area.",
      "outcome": "The long edge is routed through a dedicated outside rail.",
      "acceptance": ["The cross-layer edge does not route through the intermediate node column."],
      "verification": [{"kind": "command", "ref": "true", "proves": "The fixture gate is executable."}],
      "source_refs": ["test/status-board"],
      "estimate_hours": 1.25,
      "heavy": true,
      "heavy_reason": "The cross-layer acceptance cannot be safely split.",
      "supersedes": []
    }
  ]
}
JSON

bash "$SKILL_DIR/scripts/feature-tracker.sh" create-feature \
  --root "$TMP_DIR" \
  --title "Status board fixture" \
  --slug "status-board-fixture" \
  --goal "Exercise stable status-board layout and readable topology routing." \
  --workspace-mode current_tree \
  --tasks-file "$PLAN" >/dev/null
FEATURE_ID="$(feature_tracker_feature_id_by_title "$TMP_DIR" "Status board fixture")"
bash "$SKILL_DIR/scripts/feature-tracker.sh" show-feature-status \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --format html >"$TMP_DIR/status-board.html"

python3 - "$TMP_DIR/status-board.html" "$FEATURE_ID" <<'PY'
import re
import sys
from pathlib import Path

html = Path(sys.argv[1]).read_text(encoding="utf-8")
feature_id = sys.argv[2]

# Every canonical status remains represented; empty stages are explicitly
# marked for compact display and completion is backed by actual Task counts.
assert html.count('class="status-column ') == 6
assert html.count('class="column-empty"') == 5
assert len(re.findall(r'<section\b[^>]+data-column-empty="true"', html)) == 5
assert 'data-column-empty="false"' in html
assert 'aria-label="任务完成 0 / 4"' in html
assert ".status-title { display:flex; align-items:center; gap:7px; }" in html
assert html.count('class="focus-strip focus-strip--ready"') == 1
assert "Claim a runnable Task" in html
assert f'data-feature-open="{feature_id}"' in html

# A focused Feature id is reflected in markup and targets the details panel.
assert f'data-focus-feature="{feature_id}"' in html
assert 'id="status-filter-input"' in html
assert 'id="status-filter-select"' in html
assert 'function applyStatusFilter' in html
assert 'data-feature-search=' in html
assert 'data-status-count' in html
assert 'data-prompt-copy="set_goal"' in html
assert 'data-prompt-copy="plan"' in html
assert 'async function copyPromptAction' in html
assert '<textarea class="task-prompt-output"' not in html
assert 'data-projection-signature="' in html
assert '· Feature Tracker Status</title>' in html
assert '<details class="feature-review" open>' not in html
assert f'data-feature-open="{feature_id}"' in html
assert 'id="feature-review-dialog"' in html
assert 'class="feature-review-template"' in html
assert 'class="review-overview"' in html
assert 'class="review-state-signal' in html
assert 'class="review-metric-strip"' in html
assert '@media (prefers-reduced-motion: reduce)' in html

# Feature and Task titles carry the same compact, copyable affordance.
assert html.count('class="copy-title"') == 5
assert 'aria-label="Copy Feature title"' in html
assert 'aria-label="Copy Task title"' in html
assert 'function copyTitle(button)' in html
assert "Tracker Name" in html
assert 'aria-label="Copy Tracker Name"' in html
assert 'copy-value' in html
assert 'id="file-preview-dialog"' in html
assert 'class="file-preview-trigger"' in html
assert 'data-preview-ref=".bagakit/feature-tracker/features/' in html
assert 'file:///' not in html

# Public projection preserves declared edges; browser geometry is verified by
# the layout oracle, rather than policing a private SVG route formula.
import html as html_lib
import json
model = json.loads(html_lib.unescape(re.search(r'<template data-topology-model>(.*?)</template>', html, re.S).group(1)))
assert {(edge["from"], edge["to"]) for edge in model["edges"]} == {
    ("T-001", "T-003"), ("T-002", "T-003"), ("T-001", "T-004"), ("T-003", "T-004")
}
assert len(model["nodes"]) == 4
assert {node["wave"] for node in model["nodes"]} == {"W01", "W02", "W03"}
assert all(node["stats"] and node["dependency"] for node in model["nodes"])
assert 'data-topology-zoom="fit"' in html
assert 'data-topology-export="png"' in html
assert 'data-topology-export="svg"' in html
assert 'data-topology-error' in html
assert 'Tracker topology projection failed' in html

# The query focus is also recoverable after a live content replacement.
assert 'window.__bagakitFocusFeature' in html
assert 'window.__bagakitBindTopologyControls(body)' in html
print("ok: status board layout and interaction projection")
PY

# A large staged delivery plan gets a compact 10×10 group overview without
# replacing the full DAG.  Each slot exposes its five derived stage chips.
python3 - "$SKILL_DIR/scripts/feature-tracker.py" <<'PY'
import importlib.util
import copy
import re
import sys
from pathlib import Path

module_path = Path(sys.argv[1])
spec = importlib.util.spec_from_file_location("feature_tracker", module_path)
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules[spec.name] = module
spec.loader.exec_module(module)

by_id = {}
frontier = {key: [] for key, _ in module.TASK_FRONTIER_LABELS}
task_number = 1
group_ids = []
for slot in range(1, 101):
    previous = None
    for stage, _, prefix in module.TOPOLOGY_STAGE_LABELS:
        task_id = f"T-{task_number:03d}"
        task_number += 1
        by_id[task_id] = {
            "id": task_id,
            "title": f"[{prefix}] MR-{slot:03d}",
            "status": "todo",
        }
        frontier["runnable" if previous is None else "waiting"].append(task_id)
        previous = task_id
for group in range(1, 11):
    task_id = f"T-{task_number:03d}"
    task_number += 1
    start = (group - 1) * 10 + 1
    end = group * 10
    by_id[task_id] = {
        "id": task_id,
        "title": f"[分组验收] G{group:02d} · MR-{start:03d}..MR-{end:03d}",
        "status": "todo",
    }
    frontier["waiting"].append(task_id)
    group_ids.append(task_id)

html = module.render_task_group_overview(by_id, frontier, feat_id="f-22238cmuw")
assert html.count('class="topology-group-card"') == 10
assert html.count('class="topology-slot-row"') == 100
assert html.count('topology-stage-chip topology-stage-chip--') == 500
assert "10 组 × 10 槽位 · 每槽位五阶段" in html
assert "找评 → 权责 → 开发 → 双审 → 交付" in html
large_by_id = {
    f"T-{index:03d}": {"id": f"T-{index:03d}", "title": f"Task {index}", "status": "todo"}
    for index in range(1, 13)
}
large_by_id["T-001"]["estimate_hours"] = 1.5
large_frontier = {key: [] for key, _ in module.TASK_FRONTIER_LABELS}
large_frontier["runnable"] = ["T-001", "T-002"]
large_frontier["waiting"] = [f"T-{index:03d}" for index in range(3, 13)]
wave_html = module.render_task_wave_overview(
    [["T-001", "T-002"], [f"T-{index:03d}" for index in range(3, 13)]],
    large_by_id,
    large_frontier,
    feat_id="f-22238cmuw",
)
assert wave_html.count('class="topology-group-card"') == 2
assert wave_html.count('class="topology-wave-row"') == 12
assert 'class="topology-wave-row" data-task-id="T-001"' in wave_html
large_tasks = [
    {
        "id": f"T-{index:03d}",
        "title": f"Task {index}",
        "objective": f"Close Task {index}.",
        "outcome": f"Task {index} is complete.",
        "acceptance": [f"Task {index} is observable."],
        "verification": [{"kind": "command", "ref": "true", "proves": "The fixture remains valid."}],
        "source_refs": ["test/status-board"],
        "depends_on": [],
        "supersedes": [],
        "introduced_in_revision": 1,
        "status": "todo",
        "gate_result": None,
        "last_gate_commands": [],
        "notes": [],
    }
    for index in range(1, 13)
]
large_tasks[0]["estimate_hours"] = 1.5
large_payload = {
    "version": 2,
    "feat_id": "f-22238cmuw",
    "plan_status": "reviewed",
    "plan_revision": 1,
    "supersedes_revision": None,
    "review_ref": "review/status-board",
    "source_refs": ["test/status-board"],
    "plan_history": [{
        "revision": 1,
        "supersedes_revision": None,
        "review_ref": "review/status-board",
        "source_refs": ["test/status-board"],
        "task_ids": [task["id"] for task in large_tasks],
        "superseded_task_ids": [],
        "supersedes_by_task": {},
    }],
    "tasks": large_tasks,
}
large_topology = module.render_task_topology_html(
    {"feat_id": "f-22238cmuw", "status": "ready"},
    large_payload,
)
assert 'topology-wave-overview' in large_topology
assert '<details class="topology-group-overview topology-wave-overview">' in large_topology
assert '<summary class="topology-wave-overview-summary">' in large_topology
assert 'class="task-topology-scroll"' in large_topology
assert 'class="topology-wave-marker"' in large_topology
assert 'data-wave="W01"' in large_topology
assert 'task-topology-full' not in large_topology
assert 'est 1.5h' in large_topology
assert 'proof cmd' in large_topology
assert 'data-task-dependency-summary=' in large_topology
assert 'data-task-evidence-summary=' in large_topology
assert large_topology.count('<tspan') >= 2
assert 'data-topology-zoom="overview"' in large_topology

# Three-line titles must not use the old two-line balance shortcut, which
# allowed the remaining text to escape a card on real long English titles.
wide_payload = copy.deepcopy(large_payload)
wide_payload["tasks"][0]["title"] = "[清理] Reconcile all Feature-owned preview resources after final refresh"
wide_html = module.render_task_topology_html({"feat_id": "f-22238cmuw", "status": "ready"}, wide_payload)
title = re.search(r'class="topology-node-title"[^>]*>(.*?)</text>', wide_html, re.S).group(1)
lines = re.findall(r'<tspan[^>]*>(.*?)</tspan>', title)
assert len(lines) == 3
assert all(sum(module.topology_character_width(c) for c in line) <= 36 for line in lines)

# Large projection keeps every Task and dependency edge in the public model.
# The separate geometry oracle verifies the browser layout at realistic scale.
compact_tasks = []
for index in range(1, 41):
    compact_tasks.append({
        "id": f"T-{index:03d}",
        "title": f"Compact Task {index}",
        "objective": f"Close compact Task {index}.",
        "outcome": f"Compact Task {index} is complete.",
        "acceptance": ["The compact fixture remains observable."],
        "verification": [{"kind": "command", "ref": "true", "proves": "The compact fixture is valid."}],
        "source_refs": ["test/status-board-compact"],
        "depends_on": [] if index <= 10 else [f"T-{((index - 1) % 10) + 1:03d}"],
        "supersedes": [],
        "introduced_in_revision": 1,
        "status": "todo",
        "gate_result": None,
        "last_gate_commands": [],
        "notes": [],
    })
compact_payload = {
    "version": 2,
    "feat_id": "f-compact",
    "plan_status": "reviewed",
    "plan_revision": 1,
    "supersedes_revision": None,
    "review_ref": "review/status-board-compact",
    "source_refs": ["test/status-board-compact"],
    "plan_history": [{
        "revision": 1,
        "supersedes_revision": None,
        "review_ref": "review/status-board-compact",
        "source_refs": ["test/status-board-compact"],
        "task_ids": [task["id"] for task in compact_tasks],
        "superseded_task_ids": [],
        "supersedes_by_task": {},
    }],
    "tasks": compact_tasks,
}
compact_topology = module.render_task_topology_html(
    {"feat_id": "f-compact", "status": "ready"},
    compact_payload,
)
import html as html_lib
import json
def graph_model(markup):
    return json.loads(html_lib.unescape(re.search(r'<template data-topology-model>(.*?)</template>', markup, re.S).group(1)))
compact_model = graph_model(compact_topology)
assert len(compact_model["nodes"]) == 40
assert len(compact_model["edges"]) == 30
assert all(node["wave"] in {"W01", "W02"} for node in compact_model["nodes"])
assert 'data-topology-wire-toggle' in compact_topology
assert 'data-topology-group-toggle' in compact_topology

# A waiting node names a real blocked predecessor instead of presenting a
# generic stalled state. This remains a derived projection over Task status.
blocked_payload = copy.deepcopy(large_payload)
blocked_payload["tasks"] = copy.deepcopy(large_tasks[:3])
blocked_payload["plan_history"][0]["task_ids"] = ["T-001", "T-002", "T-003"]
blocked_payload["tasks"][0]["status"] = "blocked"
blocked_payload["tasks"][0]["last_blocker"] = {
    "class": "internal_blocker",
    "reason": "The branch needs a code fix.",
}
blocked_payload["tasks"][1]["status"] = "todo"
blocked_payload["tasks"][2]["status"] = "todo"
blocked_payload["tasks"][2]["depends_on"] = ["T-001", "T-002"]
blocked_topology = module.render_task_topology_html(
    {"feat_id": "f-22238cmuw", "status": "blocked"},
    blocked_payload,
)
assert "blocked by T-001 (blocked)" in blocked_topology
assert "eligible W02" not in blocked_topology
assert graph_model(blocked_topology)["nodes"][0]["status"] == "blocked"

# With complete Agent-hour estimates the projection exposes a deterministic
# longest estimated chain without persisting a priority or scheduler state.
critical_payload = copy.deepcopy(large_payload)
for index, task in enumerate(critical_payload["tasks"], start=1):
    task["estimate_hours"] = 0.25
critical_payload["tasks"][0]["estimate_hours"] = 1
critical_payload["tasks"][1]["depends_on"] = ["T-001"]
critical_payload["tasks"][1]["estimate_hours"] = 0.5
critical_payload["tasks"][2]["depends_on"] = ["T-001"]
critical_payload["tasks"][2]["estimate_hours"] = 2
critical_payload["tasks"][3]["depends_on"] = ["T-002", "T-003"]
critical_payload["tasks"][3]["estimate_hours"] = 1
critical_topology = module.render_task_topology_html(
    {"feat_id": "f-22238cmuw", "status": "ready"},
    critical_payload,
)
assert "Critical path · 4h · 3 Tasks" in critical_topology
assert critical_topology.count("topology-node--critical") == 3
assert sum(edge["critical"] for edge in graph_model(critical_topology)["edges"]) == 2


assert len(graph_model(critical_topology)["edges"]) == 4
assert "transitive and proof/validation relations stay in Task details" in critical_topology

# xyflow-style motion is reserved for an explicitly bound, currently live
# Flow Runner receipt; an old report or an unbound Feature-wide report stays
# static and cannot make the topology look busy.
live_payload = copy.deepcopy(critical_payload)
live_payload["tasks"][0]["status"] = "done"
live_payload["tasks"][1]["status"] = "done"
live_payload["tasks"][2]["status"] = "done"
live_payload["tasks"][3]["status"] = "in_progress"
live_runtime = {
    "by_task": {
        "T-004": {
            "record": {"session_status": "progress", "task_ref": "T-004"},
            "bound_task_ref": "T-004",
        }
    }
}
live_topology = module.render_task_topology_html(
    {"feat_id": "f-22238cmuw", "status": "in_progress"},
    live_payload,
    live_runtime,
)
assert any(e["activity"] for e in graph_model(live_topology)["edges"])
assert any(n["activity"] for n in graph_model(live_topology)["nodes"])


stale_runtime = copy.deepcopy(live_runtime)
stale_runtime["by_task"]["T-004"]["record"]["session_status"] = "done"
stale_topology = module.render_task_topology_html(
    {"feat_id": "f-22238cmuw", "status": "in_progress"},
    live_payload,
    stale_runtime,
)
assert not any(e["activity"] for e in graph_model(stale_topology)["edges"])

# The semantic model preserves all incoming edges of a dense fan-in.
fan_in_payload = copy.deepcopy(large_payload)
fan_in_payload["tasks"][6]["depends_on"] = ["T-001"]
fan_in_payload["tasks"][7]["depends_on"] = ["T-002", "T-003", "T-004", "T-005", "T-006", "T-007"]
fan_in_topology = module.render_task_topology_html(
    {"feat_id": "f-22238cmuw", "status": "ready"},
    fan_in_payload,
)
assert len([e for e in graph_model(fan_in_topology)["edges"] if e["to"] == "T-008"]) == 6

# A completed Task outside every unfinished dependency cone can be visually
# de-emphasized on demand without deleting it or changing topology truth.
stable_payload = copy.deepcopy(critical_payload)
stable_payload["tasks"][4]["status"] = "done"
stable_topology = module.render_task_topology_html(
    {"feat_id": "f-22238cmuw", "status": "in_progress"},
    stable_payload,
)
assert sum(n["stable"] for n in graph_model(stable_topology)["nodes"]) == 1
assert stable_topology.count("topology-node--stable-done") == 1


# Effort signals are canonical Task-plan fields, not display-only hints.
candidate = {
    "schema": module.TASK_PLAN_SCHEMA,
    "review": {"status": "approved", "evidence_ref": "review/effort"},
    "source_refs": ["decision/effort"],
    "tasks": [{
        "id": "T-001",
        "title": "Heavy task",
        "objective": "Close one indivisible result.",
        "outcome": "The result is verified.",
        "acceptance": ["The result is present."],
        "verification": [{"kind": "command", "ref": "true", "proves": "The result is executable."}],
        "source_refs": ["decision/effort"],
        "estimate_hours": 1.5,
        "heavy": True,
        "heavy_reason": "The integration boundary cannot be split safely.",
    }],
}
parsed = module.parse_task_plan_candidate(candidate, root=Path("."), label="effort-plan")
task = parsed["tasks"][0]
assert task["estimate_hours"] == 1.5
assert task["heavy"] is True
assert task["heavy_reason"] == "The integration boundary cannot be split safely."
for invalid, expected in (
    ({**candidate, "tasks": [{**candidate["tasks"][0], "heavy_reason": ""}]}, "heavy_reason"),
    ({**candidate, "tasks": [{**candidate["tasks"][0], "estimate_hours": None}]}, "estimate_hours"),
    ({**candidate, "tasks": [{**candidate["tasks"][0], "estimate_hours": 0.5}]}, "greater than 0.5"),
):
    try:
        module.parse_task_plan_candidate(invalid, root=Path("."), label="invalid-effort-plan")
    except SystemExit as exc:
        assert expected in str(exc)
    else:
        raise AssertionError("invalid effort plan was accepted")
# A contracting successor plan keeps one current Task while exposing its
# immediate predecessor as folded, read-only formation history. Historical
# Tasks never re-enter current metrics or frontier semantics.
history_payload = copy.deepcopy(critical_payload)
history_payload["tasks"] = copy.deepcopy(history_payload["tasks"])
history_payload["plan_revision"] = 2
history_payload["supersedes_revision"] = 1
history_payload["review_ref"] = "review/r2"
history_payload["source_refs"] = ["test/r2"]
history_payload["plan_history"] = [
    {"revision": 1, "supersedes_revision": None, "review_ref": "review/r1", "source_refs": ["test/r1"],
     "task_ids": [task["id"] for task in history_payload["tasks"]], "superseded_task_ids": []},
    {"revision": 2, "supersedes_revision": 1, "review_ref": "review/r2", "source_refs": ["test/r2"],
     "task_ids": ["T-013"], "superseded_task_ids": [task["id"] for task in history_payload["tasks"]],
     "supersedes_by_task": {"T-013": [task["id"] for task in history_payload["tasks"]]}},
]
for task in history_payload["tasks"]:
    task["status"] = "done"
    task["gate_result"] = "pass"
    task["last_gate_commands"] = [{"command": "true", "status": "pass"}]
    task["superseded_by"] = ["T-013"]
history_payload["tasks"].append({
    "id": "T-013", "depends_on": [], "title": "Close through the successor feature",
    "objective": "Keep one current closure node.", "outcome": "The successor closes the feature.",
    "acceptance": ["The successor is complete."],
    "verification": [{"kind": "command", "ref": "true", "proves": "The successor is executable."}],
    "source_refs": ["test/r2"], "supersedes": [task["id"] for task in history_payload["tasks"]],
    "introduced_in_revision": 2, "status": "in_progress", "gate_result": None,
    "last_gate_commands": [], "notes": [],
})
history_state = {"feat_id": "f-22238cmuw", "status": "in_progress", "title": "History fixture",
                 "workspace_mode": "current_tree"}
history_markup = module.render_feature_review_html(module.HarnessPaths(Path(".")), history_state, history_payload)
assert 'aria-label="任务完成 0 / 1"' not in history_markup  # dialog metrics are numeric cards, not board progress
assert '<strong>1</strong><span>Tasks</span>' in history_markup, 'current Task metric drifted'
assert '形成当前节点的历史路径' in history_markup, 'formation history control missing'
assert 'r1 · 12 Tasks → r2 · 1 Task' in history_markup, 'revision transition missing'
assert '只读 · 不计入当前进度' in history_markup, 'read-only boundary missing'
assert 'href="#f-22238cmuw-task-T-001"' in history_markup, 'historical Task link missing'
assert 'id="f-22238cmuw-task-T-001"' in history_markup, 'historical Task anchor missing'
assert 'data-topology-error' in history_markup, 'topology error surface missing'
assert history_markup.count('<section class="task-topology') == 2, history_markup.count('<section class="task-topology')
assert 'task-topology task-topology--historical' in history_markup, 'historical topology missing'
assert len(graph_model(history_markup.split('plan-lineage-history', 1)[1])) == 2, graph_model(history_markup.split('plan-lineage-history', 1)[1]).keys()
assert len(graph_model(history_markup.split('plan-lineage-history', 1)[1])["nodes"]) == 12, len(graph_model(history_markup.split('plan-lineage-history', 1)[1])["nodes"])
assert len(module.current_plan_tasks(history_payload)) == 1
assert module.task_frontier(history_payload, feat_id="f-22238cmuw")["active"] == ["T-013"]

# If a superseded Task never produced execution evidence, its body may be
# absent. The history graph still preserves the reviewed ID and edge as an
# explicit, non-runnable placeholder rather than hiding or fabricating it.
missing_payload = copy.deepcopy(history_payload)
missing_payload["tasks"] = [task for task in missing_payload["tasks"] if task["id"] != "T-012"]
missing_payload["plan_history"][1]["dependency_changes"] = {
    "added": [], "removed": [
        {"from": "T-011", "to": "T-012"},
        {"from": "T-012", "to": "T-010"},
    ],
}
missing_graph, _, missing_statuses, omitted = module.historical_plan_graph(
    missing_payload, revision=1, feat_id="f-22238cmuw"
)
assert omitted == ["T-012"]
assert missing_graph["T-012"]["title"] == "未保留详情的历史节点"
assert missing_graph["T-012"]["depends_on"] == ["T-011"]
assert "T-012" in missing_graph["T-010"]["depends_on"]
assert missing_statuses["T-012"] == "transferred"

# A broken read-only topology must become an explicit projection message while
# the Feature's current Task proof remains rendered and addressable.
original_topology = module.render_task_topology_html
module.render_task_topology_html = lambda *args, **kwargs: (_ for _ in ()).throw(SystemExit("error: cycle in topology"))
error_markup = module.render_feature_review_html(module.HarnessPaths(Path(".")), history_state, history_payload)
module.render_task_topology_html = original_topology
assert "拓扑投影失败" in error_markup
assert "Task 详情与验收证据仍可查看" in error_markup
assert 'id="f-22238cmuw-task-T-013"' in error_markup

print("ok: generic large-plan wave overview")
print("ok: grouped staged topology overview")
print("ok: Task effort fields and proof cues")
print("ok: current-only metrics with read-only formation history")
PY

SERVER_OUT="$TMP_DIR/status-board-server.out"
bash "$SKILL_DIR/scripts/feature-tracker.sh" serve-feature-status \
  --root "$TMP_DIR" --feature "$FEATURE_ID" --port 0 --refresh-ms 1000 \
  >"$SERVER_OUT" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true; wait "$SERVER_PID" 2>/dev/null || true; rm -rf "$TMP_DIR"' EXIT
for _ in $(seq 1 30); do
  grep -q '^status_server: http://' "$SERVER_OUT" && break
  sleep 0.1
done
SERVER_URL="$(sed -n '1s/^status_server: //p' "$SERVER_OUT")"
test -n "$SERVER_URL"
python3 - "$SERVER_URL" <<'PY'
import sys
from urllib.request import urlopen

body = urlopen(sys.argv[1], timeout=5).read().decode("utf-8")
assert "__bagakitFocusFeature(nextContent, false)" in body
assert "window.__bagakitFocusFeature" in body
assert "data-projection-signature" in body
assert "No changes" in body
print("ok: live focus refresh hook")
PY
kill "$SERVER_PID"
wait "$SERVER_PID" 2>/dev/null || true

# The preferred route is the complete board, so a server without a focus
# selector must also serve successfully (rather than turning a None default
# into a feature id).
SERVER_OUT_ALL="$TMP_DIR/status-board-all-server.out"
bash "$SKILL_DIR/scripts/feature-tracker.sh" serve-feature-status \
  --root "$TMP_DIR" --port 0 --refresh-ms 1000 \
  >"$SERVER_OUT_ALL" 2>&1 &
SERVER_ALL_PID=$!
trap 'kill "$SERVER_ALL_PID" 2>/dev/null || true; wait "$SERVER_ALL_PID" 2>/dev/null || true; rm -rf "$TMP_DIR"' EXIT
for _ in $(seq 1 30); do
  grep -q '^status_server: http://' "$SERVER_OUT_ALL" && break
  sleep 0.1
done
SERVER_ALL_URL="$(sed -n '1s/^status_server: //p' "$SERVER_OUT_ALL")"
test -n "$SERVER_ALL_URL"
python3 - "$SERVER_ALL_URL" <<'PY'
import sys
from urllib.request import urlopen

with urlopen(sys.argv[1], timeout=5) as response:
    body = response.read().decode("utf-8")
    assert response.status == 200
    assert "Feature Tracker Status" in body
    assert "Live read-only view" in body
print("ok: live status server without feature focus")
PY
kill "$SERVER_ALL_PID"
wait "$SERVER_ALL_PID" 2>/dev/null || true

node "$ROOT/gate_validation/skills/co-work/orchestrate/execution/bagakit-feature-tracker/check-topology-layout.cjs"
python3 "$ROOT/gate_validation/skills/co-work/orchestrate/execution/bagakit-feature-tracker/check-renderer-bundle.py" "$SKILL_DIR" "$TMP_DIR"
echo "feature-tracker status board passed"
