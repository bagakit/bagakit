# Feature Tracker Projection Surfaces

This document defines the stable boundary for derived projection surfaces around
`bagakit-feature-tracker`.

## Scope

This spec covers:

- the meaning of the tracker dependency projection
- the boundary between dependency projection and execution planning
- the boundary between dependency projection and runtime history

This spec does not redefine canonical feature truth.

Canonical feature truth remains in:

- `docs/specs/feature-tracker-contract.md`

## First Principle

One tracker surface should not carry four meanings at once.

Keep these layers distinct:

1. canonical dependency truth
2. generated dependency projection
3. policy-resolved execution planning
4. runtime history or resume state

## Canonical Dependency Truth

Canonical dependency truth lives in feature-owned state:

- `features/<feature-id>/state.json`
  - `depends_on`

That truth may be edited through tracker commands.
It must not be inferred backward from generated projection output.

## Dependency Projection

The stable dependency projection is the output of:

- `feature-tracker.sh show-feature-dag`

It is computed on demand from canonical Feature state and is not persisted as
tracker truth or cache.

Purpose:

- expose the current active feature dependency graph
- expose derived dependents
- expose pure topological layers

It should answer:

- what depends on what
- what other active features each feature unlocks
- how the active graph layers topologically
- whether canonical dependency state forms a valid active graph

It should not answer:

- which execution mode is active
- how many items should run in parallel today
- what the current retry or scheduling policy is
- what happened in the last runtime attempt

A Task dependency is a start-time prerequisite as well as a reviewed correctness relationship: `start-task` will not release the target until every direct dependency is done. If only a later final acceptance consumes an integration result, keep an isolated preview independent and attach the dependency to that final acceptance Task.

## Execution Planning Boundary

Policy-resolved execution planning is conceptually separate from the dependency
projection.

Examples:

- chosen parallel limit
- selected batch or execution order under policy
- next runnable items under current scheduling rules

If Bagakit later stabilizes one execution-plan surface, that surface must be
defined independently instead of being added ad hoc to dependency projection
output.

## Runtime History Boundary

Runtime history is also separate.

Examples:

- checkpoints
- attempt receipts
- incidents
- replay or resume artifacts

If such a surface becomes stable, it must remain distinct from both:

- canonical dependency truth
- generated dependency projection

## Human Status Projection

The topology toolbar provides one-click PNG and SVG downloads of the full
current graph, independent of the viewport. Exports preserve grouping, expanded
members, link visibility and pinned selection; styles are embedded and motion
is frozen. Controls and the inspector are excluded. A header carries Feature
identity, plan revision and capture time; SVG metadata additionally carries
graph revision, counts and view choices under
`bagakit.feature-topology-export.v1`. Export captures are disposable records,
never canonical Tracker state. PNG targets 2× logical size with a 32 MP / 8192px
per-side cap; SVG has no raster limit. The UI reports generation failures and
the actual PNG dimensions instead of claiming that a blocked download saved.

`feature-tracker.sh show-feature-status --format html` emits a disposable,
read-only status page on stdout. `--output <path>` instead writes the same page
atomically and prints its local file URI so a Host can present it to a human.
The browser document title is derived from the observing repository's final
directory name (`project · Feature Tracker Status`); it is presentation-only
and is not stored in Tracker state, so simultaneous project pages remain
distinguishable.

For the HTML projection, `--feature <feature-id>` is a focus selector: the
page still renders every non-closed Feature plus compact closed-history rows,
and opens the selected Feature in its read-only details panel. A closed Feature
uses its preserved `state.json` and `tasks.json` from the status-specific
history directory, so its Task topology remains inspectable after archive,
discard, or transfer without becoming runnable again.
The text and JSON forms keep their single-Feature detail meaning. A malformed
active Feature is represented by a minimal repair-needed card with canonical
links so one bad record does not hide the rest of the overview; `validate-tracker`
remains the strict diagnostic surface.

The outer board is part of the same information design as the map. It shows a
current-focus Feature with labelled done/total Task completion, compact
Feature-stage totals, and comparison cards separating goals/progress from
active/runnable work. Empty stages remain represented as short summaries after
populated stages instead of full-height empty columns. Filtering must hide
nonmatching stages and the focus card. Completion percentages describe Task
counts, not an inferred schedule or a Feature-closeout promise.

It may present canonical Feature identity, lifecycle status, workspace,
active and runnable Tasks, Task blockers, cancelled and transferred Tasks, dependencies, Task counts, and
current-plan Task detail. When a reviewed Task plan exists, the Feature details
panel should also render its derived Task topology: roots, dependency
edges, convergence points, and each Task's current derived status. Selecting a
topology node opens its collapsible Task detail before scrolling to that Task's
acceptance and verification detail. The
topology is shown directly in the near-viewport Feature details panel; no
separate fullscreen surface is required to inspect larger graphs. The graph labels
each derived execution wave (`W01`, `W02`, …) on its nodes. Wave is dependency
depth, not a dispatch barrier or a fixed row/column in the canvas.
Its runtime legend and node labels distinguish active, runnable, waiting,
blocked, failed/replan, cancelled, transferred, and done Tasks primarily with text badges and
border or fill treatment; color is auxiliary rather than the sole status
signal. The graph shows each Task's gate state and direct dependency summary.
When every current Task has an explicit Agent-hour estimate, the projection
may highlight one deterministic longest estimated dependency chain as the
critical path and show its total estimated Agent hours. If an estimate is
missing, it must show that the path is unavailable rather than infer duration
from Task count, array order, or wall-clock timestamps. This is an observation
of the reviewed plan, not a scheduler promise or persisted priority.
For every Task with direct dependencies, that summary includes derived
ready/total progress; a waiting Task also names its unfinished predecessors
(including blocked, cancelled, or transferred status when applicable) and shows
the earliest graph wave in which it could become eligible when those
predecessors remain potentially runnable. A terminal or real blocker suppresses
the eligibility forecast and remains visible as the blocker source. These are
read-time projections, not persisted unlock promises.
The graph viewport provides bounded zoom controls and
preserves its horizontal/vertical scroll and zoom position when the live
projection refreshes; these are display state only and never Tracker truth.
The bundled offline Dagre engine owns layered node placement. Tracker projects
node semantics and all declared dependencies; browser state never becomes
planning truth. Edge routes pass through bounded rank gutters and avoid opaque
cards. A cross-layer dependency traverses local free corridors, rather than
allocating a full-canvas outside rail per edge.

For more than 24 Tasks, three or more tasks with identical direct predecessors,
identical direct successors, and the same Wave may form one reversible parallel
group. The card shows member count, common title, Wave, and status counts. Its
member panel links every Task to acceptance/proof and can expand just that group
in the graph. An all-groups control restores individual nodes. Groups and
aggregated paths retain membership in the original task/edge model.
Node and group selection opens a visible inspector beside the canvas, rather
than only expanding a Task list below the viewport. The inspector exposes the
complete title, acceptance, verification and prompt actions, and supports
returning from a group member to its group. Task-id/title lookup locates the
owning node or group and opens the selected Task. Initial focus on large plans
shows current work at a readable scale; Overview remains the full-plan locator.
A minimap renders the same projected nodes and viewport bounds. Pointer or
keyboard navigation moves the camera without reordering the plan. Camera
transitions are bounded, interruptible by drag/wheel, and instantaneous under
reduced motion. Pinned node/group selection distinguishes upstream and
downstream paths with both text counts and color; hover alone never dims the
entire plan. Inspector entrance and actual status-change feedback must not
replay on unchanged polls or unrelated updates.
Groups have an explicit stacked collection silhouette, group header, and a
larger layout footprint than a single Task. Completion is done/total, excluding
cancelled and transferred from the numerator. Text counts accompany the status
distribution. The card highlights failed/blocked members, shared upstream and
downstream counts when space permits, and explicit bound activity separately
from active status. Its member panel puts exceptions first. Mixed group/Task
sizes must preserve card clearance and correct edge endpoints.

The default edge projection is the transitive reduction of declared
`depends_on` edges: a redundant direct edge is hidden only when another directed
path already reaches that target. `Show all links` restores every declaration.
The layout remains fixed when toggling link visibility. Edge count reduction
is explicitly reported and never deletes or rewrites canonical dependencies.
Proof/validation mappings remain in Task detail, not a second dependency graph.

Hover highlights the incident path and exposes a fixed-height inspector; it
must not fade and restore the whole canvas at each child-element boundary.
Clicking or keyboard-activating a connection pins its path and endpoints until
cancelled. Pinned trace motion means visual tracing, not execution. Bound
`session_status=progress` activity on an active Task separately permits an
execution-flow stroke. Unbound or historical receipts never imply live work.
Group expansion can animate node relocation; routine polls do not replay entry
animations. All motion stops under `prefers-reduced-motion`.

When unfinished work exists, the projection may derive a `stable done` set:
completed Tasks that are outside every unfinished Task's dependency cone. A
human may de-emphasize that set to focus on open work, but the nodes and edges
remain in the same graph and can be restored immediately. This display choice
is browser state only; it never deletes historical proof or changes Task truth.
Mixed CJK/Latin Task titles are wrapped to the node's display width, while the
full title and evidence-backed node statistics remain available through the SVG
tooltip. A node may show gate progress, a compact verification-kind cue, an
explicit Agent-hour estimate,
observed Flow Runner checkpoint span, and checkpoint count. Missing evidence is
shown as `—` or omitted; the projection never infers execution duration from
wall-clock or file timestamps. Cards keep status, dependency, gate, proof,
effort, and activity data available in the node, inspector, and full-title
metadata. `Overview` fits both dimensions for whole-graph navigation; it can
zoom below 30% when needed rather than leaving the graph clipped.
Zoom changes the SVG layout dimensions as well as its visual scale, so the
scroll viewport remains truthful. `Fit` fits the graph horizontally; `Overview` fits both dimensions to give a
bounded whole-graph locator for large plans. Neither action opens a second
surface.
It must derive planning and lifecycle facts directly from
`index/features.json`, `state.json`, and `tasks.json` on each invocation. When
the optional Flow Runner surface exists, it may also read the latest
`items/feature-<feature-id>/progress.ndjson` receipt as a clearly labelled
read-only execution overlay. An explicit receipt `task_ref` is the only valid
binding to a Task; an omitted or unmatched binding stays Feature-wide and is
never guessed from free-form text. The projection keeps the latest receipt per
bound Task, so parallel Task activity remains visible instead of being hidden
by one Feature-level "last update". This overlay is informational and cannot
change Task status, gate evidence, or closeout truth.

Receipt provenance is shown as a repository-relative `progress.ndjson` path in
the read-only page. It is an identity cue, not a browser file link: exported
snapshots and loopback pages must not emit `file://` anchors for local receipt
files.

Host-only `worker-v1` messages and `agent-loop` session observations are not
scraped into this page: they are delivery or host-exhaust surfaces, not a
durable Task binding. A Worker report becomes visible here only when its
execution owner records a Flow Runner progress receipt with `task_ref`.

The default human overview places proposals before execution statuses. A
`replanning` Feature is shown separately from a real `blocked` Feature so a
failed or cancelled node awaiting a reviewed successor is not presented as an execution
blocker. Failed nodes show their disproved assumption and reason; the next
reviewed revision is the only source of successor links. A terminal `transferred` Feature is kept in closed history with its
`transferred_to` successor link; its unfinished current-plan Tasks are shown as `transferred`,
not as todo work. A successor Feature may carry a `transferred_from` list of
source Feature ids for lineage display; this
does not create an execution dependency. Feature
cards and closed-history rows stay compact; clicking either opens one read-only
details panel showing
the derived Tracker Name (`Feature-Tracker-<feature-id>`) with a copy action,
current-plan objectives, outcomes, acceptance, verification, and links to
canonical files. Closed-history details show a historical/read-only note and
do not expose claim or Goal-setting actions. Tracker Name is derived
presentation text, not a new state field. The default surface stays light and
visually quiet instead of
following the host into a dark, heavily outlined dashboard. Feature Details
uses a flat reading surface with only the modal boundary and semantic section
dividers; nested bordered cards are avoided when they do not carry meaning.
The top of the details panel leads with one derived current-state signal and a
compact metric strip for total Tasks, active, runnable, waiting, and done work;
workspace, Tracker Name, runtime role, lineage, and Feature prompts remain
secondary context. An active-state pulse may provide a small temporal cue, but
it is paired with text and has a reduced-motion fallback; no motion is required
to understand the state.

The overview may derive one current-focus strip above the grouped board. It
selects at most one Feature by current execution urgency—active work, real
blocker, replanning, runnable work, then closeout—and shows only the immediate
action plus a compact frontier summary. This is a projection over canonical
state, not a persisted priority, recommendation score, or second scheduler.

The overview provides a client-side read-only search over Feature ids, titles,
goals, and current Task titles, plus a lifecycle-status filter.

Blocked Task cards show the blocker class and reason together with an unblock owner and resume condition. Missing recovery metadata is rendered as `unspecified`, so a blocked record cannot look like a guaranteed future resolution.

A failed current Task is presented with its disproved assumption and reason, and the Feature focus points to the reviewed replan action. Once a successor revision is installed, the failed node remains visible as immutable history and the replacement edge is rendered through the existing supersession lineage. Filtering hides
the two cases distinctly: `FAILED/REPLAN` means no successor is installed and the
frontier is waiting for owner replanning; `FAILED→NEXT` means the failed node is
historical and its reviewed successor is already installed. A successor or an
independent branch may continue while the failed history remains visible; the
failed node itself never satisfies a dependency.
non-matching columns and the derived current-focus strip while leaving
canonical counts and the live refresh route intact; clearing the filter
restores the full board.

Within the Feature details panel, each reviewed Task is an independent
collapsible detail. Active and blocked Tasks open by default; larger plans
leave the other Task details collapsed, and the user may open any Task without
changing Tracker state. The Task list is an independent scroll region, and a
topology-node or wave-row selection opens and scrolls that region to the
matching Task rather than moving the whole panel; the target receives a
transient location highlight. A `transferred from` label shows its complete
source count and makes each source id clickable, focusing the matching
closed-history row without treating lineage as a dependency. The live route
preserves the selected Feature panel,
exact Task disclosure choices, and Task-list scroll position across refreshes.
When the current plan is large, the panel puts the dependency graph first; planning history, canonical files, and
execution receipts stay collapsed below it. A compact derived grouped acceptance
or execution-wave overview may appear after the graph.
Group and wave links still target the matching Task detail. Each expanded Task
detail exposes direct one-click copy actions for claim Task, check status, explain
the Task, and recover its bounded Goal statement. The Feature details panel
exposes two Tracker-wide one-click copy actions for setting the Feature Goal and
explaining the whole reviewed plan's progress, rather than requiring a
tab-then-copy sequence. The copy action uses the browser clipboard and reports
failure without claiming success. All prompts point to SSOT and are not persisted. Canonical file
controls open a read-only in-page preview of repo-relative `state.json`,
`tasks.json`, `goal.md`, and verification files, avoiding `file://` navigation
that browsers may block. JSON and Markdown previews apply lightweight syntax
coloring after escaping source text; preview styling is derived presentation
and never alters canonical bytes.

A relative `--output` path resolves from `--root`. The recommended stable
scratch path is `.tmp/feature-tracker/status.html`. The operator must reject an
output path inside `.bagakit/feature-tracker/`; a generated page is never
tracker state. The file is a static snapshot, so current status requires
rerunning the command against canonical files and reloading the page.

`feature-tracker.sh serve-feature-status` is the preferred human observation
route when a browser is available. It binds only to loopback, serves no mutation endpoint, and regenerates
the same HTML from canonical files on each request. Its bounded page JavaScript
fetches the current projection and replaces only the status-content region,
preserving the selected Feature details panel and anchors while showing an
updating/updated/unchanged/error indicator. When the canonical projection is
served, its Python renderer and bundled JS/CSS belong to one immutable process
build. Runtime asset edits take effect only after server restart. Responses
carry a UI revision distinct from data revision; a client receiving a new UI
build reloads once rather than mixing new markup with old handlers. Failure to
initialize the graph must not prevent the Feature dialog and Task proof from
opening; show an explicit graph error. When canonical data is
unchanged, it reports `No changes` and leaves the status DOM in place—including
dialogs, disclosure, and scroll context—instead of replacing it. It also preserves each topology viewport and
the topology scroll/zoom position, as well as the board's
horizontal scroll position, across those content updates,
with a non-native-dialog fallback for hosts that expose the page without
`HTMLDialogElement`. It does not read browser-local files or create a second
state surface. When present, Flow Runner progress receipts are reread with the
same request and become visible without a second event log or a write-back into
Tracker state. The server is an observation process and must be stopped when
the observation session ends. A static `file://` snapshot is a fallback for
hosts that cannot start loopback or when the user explicitly requests an
export; it cannot observe changes.

For human-visible work, the first useful publication point is after
`create-feature` creates or reuses the Feature and before planning continues.
The calling Agent should start the loopback server and include its stable URL
in that start update when a browser is available; otherwise it may present the
static fallback. It should reuse and refresh the same path at
meaningful lifecycle breakpoints: reviewed-plan confirmation, execution start,
blocker change, closeout, or an explicit status request. It must not publish a
link before the Feature exists or emit a new link for every tracker mutation.
The Host still owns presentation and delivery.

For every user-facing progress message about a tracked Feature, the Agent
should refresh the stable static page or reuse the live loopback URL and include
that same topology link. The message carries the result and any exception or
blocker; the page carries the full topology. If the page cannot be presented,
the Agent gives the compact derived frontier (`active`, `runnable`, `blocked`,
`cancelled`, `waiting`) and says that the topology page is unavailable. This
rule does not
apply to internal mutation logs or Worker heartbeats.

Every active Feature card may render one claim-message draft using the
`bagakit-agent-messaging` `agent-set-v1` envelope. The draft includes Feature
name and id, worktree or `none`, branch or `none`, lifecycle status, active and
runnable Task ids, and Task counts as a compact routing snapshot. It
then gives the ordered canonical refs where the Agent must recover Goal, Task
acceptance, blockers, authority, and next action. It must not copy Task
objective, outcome, acceptance, verification, release, or execution history
into the message.

The static page may use bounded client-side behavior only to preview, refresh
the display time immediately before copy/share, copy, or invoke the platform
share sheet. The live route may additionally fetch the current URL at its
configured interval and replace only its status-content region; it must not
read local files or mutate Tracker state. The
draft and page do not authenticate a sender, select a target, send a message,
assign Host authority, or prove delivery, consumption, claim, or effect. The
message states this boundary in plain language.

The human projection must not:

- persist a dashboard, cache, database, or editable mirror
- infer progress percentages, execution order, recommended parallelism, or
  scheduling policy beyond the deterministic runnable frontier
- treat a generated claim draft as authenticated assignment or authority
- become an input to tracker mutation, validation, recovery, or closeout
- load closed Feature detail merely to render active Feature cards; closed
  history rows may read their preserved records to provide an explicitly
  requested read-only topology view

Closed history uses the canonical index for compact row identity. It embeds a
detail template only for the explicitly focused closed Feature; other rows
navigate to the same `--feature` focus route so their status-specific
`state.json` and `tasks.json` are loaded on demand. These templates remain
read-only projections; a generated HTML file belongs outside tracker state and
can be deleted or regenerated without repair.

## Quality Rule

A good projection boundary makes these statements true:

- truth can be edited without hand-editing the projection
- projection can be computed at any time without a cache-repair step
- graph-affecting commands can preflight the resulting projection before they
  perform destructive side effects
- validation computes the graph from canonical state and rejects invalid
  dependency values, discarded dependencies, and cycles
- `replan-features` validates the complete proposed graph before persisting any
  dependency mutation
- users do not have to guess whether one field is graph truth or execution
  policy

### Site theme and status legibility

The read-only status site offers a one-click light/dark switch on both the
board and the Feature dialog. The first visit follows the system; an explicit
choice persists in browser storage when available. Theme changes only recolor
the existing view: layout, zoom, selection, inspectors and polling continuity
remain intact. Exports capture the current theme, including their header, and
record it in SVG metadata. Done and waiting use redundant status encoding
(check with solid badge versus clock with dashed card), with readable text in
both themes. Selection must not dim unrelated node text below readable contrast.

`Focus open work` is a member-level view filter before layout, not an opacity
effect on groups. It hides done/cancelled/transferred Tasks and their incident
edges; waiting/blocked/failed Tasks remain. Counts report the hidden records;
Task details retain the full canonical dependency evidence. Group identity and
expansion survive filtering, and `Show all Tasks` restores the complete graph.
Search for a hidden Task restores that graph before locating it. Edge reduction
must use paths in the visible graph so hidden Tasks cannot suppress a remaining
direct dependency. An empty focus view explicitly links back to full history.


### Outer board density

Empty lifecycle stages project as collapsed index rows with their label and zero count. They do not reserve card-grid space until a human explicitly expands one. Search and status filtering may hide nonmatching stages; populated stages remain fully visible. This is a presentation rule only and never changes Feature lifecycle truth.


### Cross-Feature board projection

The outer Feature surface uses a workspace-style board: a compact navigation rail, a filter toolbar, status columns with consistent Feature cards, and a contextual cross-Feature region. The cross-Feature region is centered on the current focus when one is selected; it shows only the dependency closure and reports independent Features as a count. It reads Feature index and `state.json.depends_on` directly and must not introduce a second planning store or synthetic status values.
