# Status surface

The read-only page is a projection of `state.json`, `tasks.json`, and the
Feature index. The topology is the primary detail surface; a compact state
strip and direct-copy prompts precede it. Planning history, files, and execution
receipts are folded below. Task details remain independently collapsible.

The whole page uses an editorial layout: a current-focus Feature, a labelled
done/total Task measure, compact project-stage totals, stage sections, and
comparison cards separating goal/progress from current work. Empty stages
remain represented as short summaries after populated stages. Search hides
nonmatching stages and the focus card. The entire site supports light and dark palettes, including the board, map,
inspectors and file previews. The first visit follows the system preference;
a direct toggle persists the chosen palette when browser storage is available.
Switching themes must preserve layout, camera, selection and task truth.
Styling must prioritize reading and comparison in both themes.

## Observe and navigate

- Prefer `serve-feature-status --root . --feature <feature-id>` and reuse its
  loopback URL. Stop an observation server you own when its session ends.
- For an explicit static export, use `show-feature-status --format html
  --output <path>`. The graph engine is embedded; no CDN is needed.
- Without a browser, `watch-feature-status` displays the same derived frontier
  in the terminal. It is not another planning store.
- Closed Features retain their topology and proof, without execution actions.
- Node and group-member links open the matching Task's acceptance and proof.
  Canonical-file buttons provide read-only in-page previews.
- Selection opens a visible inspector beside the graph. Task-id/title lookup
  locates a Task even inside a collapsed group; `工作焦点` returns to current work.
- Feature IDs are directly clickable to copy on the focus strip, active cards, closed-history rows and repair cards; Task and prompt buttons copy directly and report clipboard failure.
- `高清 PNG` downloads the full current graph in one click, independent of
  camera zoom. `SVG` downloads a scalable, self-contained vector snapshot.
  Both preserve the current theme, open-work filter, grouping, expanded members,
  link mode and pinned selection;
  they omit controls and the inspector and freeze motion. The image header
  identifies the Feature, plan revision and capture time; SVG metadata also
  records the graph revision and view choices. These are records, not Tracker
  truth. PNG targets 2× logical resolution, capped at 32 MP and 8192px per side;
  use SVG when an unusually large plan needs unrestricted scaling.

## Read a large plan

Wave means longest dependency depth plus one. It never obliges the Host to
finish a batch before dispatching another runnable Task. Dagre computes node
coordinates from relationships instead of putting each Wave into a fixed grid.

Large plans group three or more Tasks only when their direct predecessors,
direct successors, and Wave are identical. Groups show counts and retain every
member. Inspect a group's member list, expand that group, or expand all groups.
`Focus open work` hides done, cancelled and transferred members before layout,
including members of an expanded group; waiting, failed and blocked Tasks remain.
The page counts hidden Tasks, keeps original dependency evidence in details,
and preserves group expansion when `Show all Tasks` restores the full view.
Searching for a hidden Task restores the full view automatically.
This changes browser presentation only; it does not create an execution Task.
Group cards use a distinct stacked collection shape, a group label, and a
larger measured footprint. They show completed/total and percent, the full
status distribution, shared dependency counts where space permits, and a
priority attention cue for failed or blocked members. Cancelled/transferred
members remain separate and never count as completed. Progress-report counts
require an explicit activity binding on an active member; being active alone
does not imply a progress report. The member panel lists exceptions first.

The default link view hides a declared edge only if another directed path
already connects its endpoints. The page reports how many edges were hidden.
`Show all links` reveals every original dependency without changing positions.
Ports and rank gutters keep routing within the node area without a wall of
outside rails. Hover shows source/target or node context in the fixed inspector;
clicking a connection pins the trace. Click empty canvas or press Escape to
release it. Drag empty space to pan; use zoom controls or Ctrl/Command-wheel
around the pointer. `Fit` fits width; `Overview` fits the full graph.
The minimap shows the whole dependency graph and viewport rectangle; click it
or use its arrow keys to navigate. Camera transitions stop immediately on drag
or wheel input. Selecting a Task or group traces its upstream and downstream
paths, with text counts and distinct colors; Escape releases the selection.

## Evidence and continuity

Status badges distinguish active, runnable, waiting, blocked, failed, cancelled,
transferred, and done. Done uses a solid completion badge and check; waiting
uses a clock badge and dashed card boundary. Labels and essential metadata
retain readable contrast in both palettes and when a different path is selected;
neither color alone nor reduced whole-card opacity may carry task status. Nodes expose dependency progress, gate/proof, explicit
Agent-hour estimates, and attributable execution activity. Missing estimates
make the estimated critical path unavailable. Do not infer duration from
timestamps or infer Task bindings from free text.

Flow Runner activity attaches only through an explicit `task_ref`; only a
bound progress receipt on an active Task supports execution motion. A pinned
path may move to aid tracing, with no execution claim. Group expansion uses a
short position transition. Reduced-motion preferences suppress both.
Inspector entry and camera navigation may animate for a direct user action.
Actual status changes receive local feedback; unrelated updates never replay
entry animations. No decorative motion may imply execution without evidence.

Unchanged polls leave the DOM intact. Actual updates reconcile the open detail
surface and preserve the SVG, matching node identities, group expansion, pinned
trace, disclosures, and camera. Do not refocus the dialog or replay selected
Task scrolling on background updates. Hover must not change inspector height,
route geometry, or other nodes' opacity repeatedly. Geometry/clearance checks
and browser interaction evidence are required; element counts alone do not
prove readable or stable interaction.

The observation process freezes its renderer and browser assets together.
After upgrading the skill, restart the observation server to load the new UI
build. The page detects UI-build changes separately from data updates and
reloads once to keep markup and handlers consistent. An explicit graph error
must leave the Feature and its proof accessible.

## Follow the plan that formed the current node

The current topology and its metrics always use only the latest reviewed plan.
When a later revision contracts a larger plan into a successor or closure node,
the detail surface also exposes the immediately preceding reviewed DAG in a
collapsed **formation history** section. This is a read-only explanation of how
the current node was reached: its Tasks never re-enter current counts, frontier,
claim, runnable, or dispatch semantics.

The revision strip states the transition explicitly (for example,
`r292 · 175 Tasks → r293 · 1 Task`). The historical graph is derived from the
preserved `plan_history` and historical Task records. If the Tracker correctly
discarded an unevidenced superseded Task body, the surface keeps its reviewed ID
and dependency edges in an explicit “details not retained” placeholder; it does
not fabricate a title, acceptance, or evidence. Current work stays visually
primary and the history stays folded until a reader asks for it.
