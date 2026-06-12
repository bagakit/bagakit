---
name: bagakit-feature-tracker
description: Track feature and task planning truth with explicit workspace modes, JSON SSOT transitions, task-level gate evidence, and archive or discard lifecycle. Use when a repository needs a durable planning surface before repeated flow execution.
metadata:
  bagakit:
    harness_layer: l1-execution
---

# Bagakit Feature Tracker

## Route

Use this skill when work needs durable Feature identity, a reviewed Task plan,
workspace assignment, task-gate evidence, or explicit archive/discard closeout.

Do not create Tracker state for a tiny single-shot change. Use
`bagakit-flow-runner` when canonical planning truth already exists and the need
is repeated execution rather than planning ownership.

## Ownership And Truth

Feature Tracker owns:

- Feature identity, lifecycle, workspace assignment, and dependencies
- reviewed Task-plan revisions, Task dependencies, and Task progression
- task gates and blocker evidence
- optional Feature-owned `goal.md` for restart, compact, handoff, or supervision
- archive and discard publication

Canonical truth is deliberately small:

- `state.json`: Feature lifecycle and workspace truth
- `tasks.json`: the only Task dependency, status, and closeout-review truth
- optional `goal.md`: stable Agent control truth, not another lifecycle
- `owner-receipt.json`: derived content binding, never Task truth

Keep these invariants:

- reuse an active Feature with the same normalized slug; revise its reviewed
  plan instead of creating a parallel same-class Feature
- an Agent may draft requirements, but only user-confirmed discussion or an
  explicitly delegated review decision may authorize the reviewed plan
- execution cannot start before reviewed Task truth and workspace assignment
- missing `depends_on` means a graph root; Task ids and array order never imply
  sequencing
- runnable and active Task sets are derived from `tasks.json`; different
  runnable Tasks may be active together
- Git commits, branches, merges, and cleanup remain Git truth, not Tracker truth
- helper Markdown and HTML projections never become editable mirrors of JSON
- exact SHAs, current phase, next action, and rebase checkpoints are mutable
  execution context; never keep them in stable `goal.md`
- the first reviewed execution Task should close the smallest end-to-end
  acceptance path before broad cross-tree coverage or cleanup

## Golden Path

Resolve the installed skill directory, then initialize once:

```bash
export BAGAKIT_FEATURE_TRACKER_SKILL_DIR="<path-to-bagakit-feature-tracker-skill>"

bash "$BAGAKIT_FEATURE_TRACKER_SKILL_DIR/scripts/feature-tracker.sh" \
  initialize-tracker --root .
```

Create or reuse a proposal before planning:

```bash
bash "$BAGAKIT_FEATURE_TRACKER_SKILL_DIR/scripts/feature-tracker.sh" \
  create-feature \
  --root . \
  --title "<feature-title>" \
  --slug "<feature-family-slug>" \
  --goal "<user goal>" \
  --workspace-mode proposal_only
```

After the user confirms the plan, materialize it and assign a workspace:

```bash
bash "$BAGAKIT_FEATURE_TRACKER_SKILL_DIR/scripts/feature-tracker.sh" \
  set-task-plan \
  --root . \
  --feature <feature-id> \
  --tasks-file <reviewed-task-plan.json> \
  --expected-revision <current-revision>

bash "$BAGAKIT_FEATURE_TRACKER_SKILL_DIR/scripts/feature-tracker.sh" \
  assign-feature-workspace \
  --root . \
  --feature <feature-id> \
  --workspace-mode <current_tree|worktree>
```

When the implementation worktree already exists, adopt or rebind it instead of
creating another one:

```bash
bash "$BAGAKIT_FEATURE_TRACKER_SKILL_DIR/scripts/feature-tracker.sh" \
  adopt-feature-worktree \
  --root . \
  --feature <feature-id> \
  --worktree-path <existing-worktree-path> \
  --branch <exact-checked-out-branch>
```

Execute any runnable Task through the public state machine:

```text
start-task -> run-task-gate -> finish-task
```

`start-task` atomically claims one Task after all direct dependencies are done.
Use the exact next command emitted by the operator. A blocked finish must carry
its canonical blocker class and reason in the same transition; unrelated
runnable or active Tasks may continue.

Use `finish-task --result blocked` only for a real internal or external
execution blocker. When a current Task is intentionally abandoned or replaced,
use `finish-task --result cancelled --cancel-reason ...`; it preserves history,
does not satisfy dependents, and reports the Feature as `replanning` rather than
as execution-blocked until a reviewed successor plan is installed.

Use `finish-task --result failed --failure-assumption ... --failure-reason ...`
when evidence disproves the Task's approach. `blocked` is reserved for an
approach that remains viable but cannot proceed within the current authority
and resources. Prefer `--blocked-owner` and `--blocked-resume-when` so the
projection names who or what can change it and what evidence permits resumption;
missing values are rendered as `unspecified` and remain visible as an
observability gap. An ordinary defect, failed gate, difficult optimization, or
untried approach is not enough. A failed node is terminal evidence, stays in
history, and requires a reviewed successor revision that declares `supersedes`.
The command emits `replan_required_from`; independent active or runnable Tasks
may continue while the owner reviews descendants. Chat or a progress receipt
alone does not count as replanning.

When a Feature is partially complete and its remaining scope is deliberately
reorganized into another reviewed Feature, create the successor with one or
more `--transferred-from <feature-id>` references, then run
`transfer-feature --feature <old-id> --replacement <new-id>` with the closeout
review. The old Feature becomes terminal `transferred` and records
`transferred_to`: done Tasks remain `done`, while unfinished current-plan Tasks
become `transferred`. Transferred Tasks are historical work, not runnable work
and never satisfy a dependency; the successor Feature owns any regrouping.
Replacing a Task is also a dependency-review trigger: inspect every
not-yet-started downstream descendant and retain only edges that the successor
still makes necessary. Do not mechanically inherit the old Task's dependency
shape; use [Bounded Convergence Review](references/convergence-review.md) for
the audit and any safe provisional lane.

`run-task-gate` executes the current Task's `verification` mappings with
`kind=command`, in their declared order, and records the same command results
in both `tasks.json.last_gate_commands` and
`state.json.gate.last_check_commands`. Runtime policy does not choose Task
completion commands. A reviewed Task without an executable command
verification fails closed when it is being started or gated; artifact, manual,
and owner-receipt mappings remain additional evidence routes and are not
silently treated as a passing command gate. Existing reviewed plans that only
contain those non-command mappings remain readable as historical truth, but
cannot start or finish a new execution Task until their reviewed plan is
revised with an executable command. `finish-task --result done` also rejects a
stale receipt whose command list no longer matches the current Task plan, even
if an old `pass` value is present. This transition check is deliberately not a
retroactive migration: historical completed Tasks remain readable without
claiming that their older gate receipts satisfy the new proof rule.

When the last current-plan Task finishes, `finish-task` reports
`feature_completion: pending_closeout`, `closeout_required: true`, and a
machine-readable `next_action_kind`. Treat that result as an unfinished Feature
until `closeout-feature` has completed and the Feature is `archived` or
`discarded`; do not report Feature completion from `feat_status: done` alone.

When implementation is delegated, the Owner or Supervisor maintains Feature,
workspace, Goal, and Task transitions. The implementation Worker consumes the
current receipt and Task, produces code and evidence, and does not repeatedly
replan or rewrite control state unless a user-confirmed requirement changes.

## Task Decomposition And Parallelism

Plan-shaping guidance: read [references/plan-shaping/GUIDE.md](references/plan-shaping/GUIDE.md) while drafting `tasks.json`, before `set-task-plan`.

Treat one Feature as one user goal, then make its Task plan as fine-grained as
the acceptance evidence allows:

- split work at independently implementable and independently verifiable
  outcomes; a Task must not be larger than one independently closable
  substructure, and should be small enough to close in one bounded execution
  loop rather than a broad phase such as “finish the backend”
- prefer substructures that take about 30 minutes or less of focused Agent
  work; when any substructure is expected to take longer than 30 minutes,
  provide `estimate_hours` as a positive numeric estimate in Agent execution
  hours (not human hours or wall-clock time). When it is genuinely indivisible,
  also set `heavy: true`, provide `heavy_reason`, and keep the estimate in the
  same Task plan. Use that signal when choosing execution waves, concurrency,
  and any explicitly labelled estimated chain; do not use it as a second
  lifecycle or gate truth
- declare only real prerequisites in `depends_on`; do not add edges merely to
  preserve the order in which Tasks were written
- inspect the derived runnable frontier before each claim and start independent
  runnable Tasks concurrently when the Host or Supervisor can safely support
  them
- when branches must share an implementation result or joint verification,
  add one explicit downstream integration Task that depends on those branches
- when similar cases become numerous enough that one topology is hard to read,
  group them by independently closable work package or acceptance boundary;
  expand a case into Tasks only when it needs its own worker, dependency, or
  executable proof, and use a group/join rather than empty per-case stages
- do not split work into ceremony-only Tasks or force parallel edits to the
  same artifact; isolation and merge order remain Host/Supervisor decisions

The target is the smallest set of independently closable Tasks that exposes
real parallelism, not the largest possible Task count.

## Mid-Run Concurrency Review

Do not treat the initial Task DAG as immutable scheduling advice. During
execution, proactively recompute the derived frontier after a progress
checkpoint, Task completion or blocker, and whenever an Agent discovers a new
independent change surface. Start newly runnable Tasks promptly when the Host
or Supervisor can safely absorb them.

Use [Bounded Convergence Review](references/convergence-review.md) when a
successor replacement, waiting edge, or repeated serialization concern needs a
fresh decision. It defines the bounded counterfactual and the
`start-now / rejoin-later` admission boundary; this section only routes the
review and records its triggers.

Open a bounded plan review when any of these signals appears:

- an active Task exceeds its Agent-hour estimate or remains active across two
  bounded progress checkpoints;
- active Tasks exist while remaining work is waiting behind a dependency that
  no longer represents a real prerequisite;
- a new independently verifiable substructure is discovered that can proceed
  without the active Task's result;
- a successor replacement may have changed whether a downstream edge is still
  required;
- an isolated, candidate-bound preview may provide useful value before a
  waiting predecessor finishes.

For a review, read the current `state.json` and `tasks.json`, preserve useful
active work, and prepare a reviewed `set-task-plan` revision. A mid-run
revision may add or rewire only not-yet-started Tasks; every active Task must
remain present with identical objective, outcome, acceptance, verification,
supersession lineage, and `depends_on`. Do not turn an implementation
discovery into an unconfirmed requirement. If the change crosses the reviewed
requirement boundary, obtain the user's or delegated review owner's
confirmation before publishing it. After publication, recompute the frontier,
claim the new runnable Tasks, and refresh the stable topology link.

The public `review-task-plan --feature <feature-id> --json` command is the
read-only checkpoint for this review. It lists every waiting dependency edge,
marks each edge `decision=review_required`, and reports failed assumptions.
Use it before claiming work when a plan may be over-serialized, and include
the resulting edge decision in the reviewed plan evidence. The command never
removes an edge or schedules an Agent by itself.

This is a proactive review loop, not an automatic scheduler: Tracker remains
the SSOT for the reviewed DAG, while Host/Supervisor still owns Worker
assignment, concurrency limits, worktrees, and merge order. A provisional lane
is never a second Task status or dependency graph; it cannot satisfy a
dependent or close a Task until the reviewed exact-candidate join and gate
pass.

## Human Visibility

After Feature creation, a Host should present one stable, disposable status
page through the loopback-only server below whenever a browser is available.
This is the preferred human-observation route because it reads canonical files
on each refresh while keeping the page read-only. A static HTML snapshot is the
fallback for environments that cannot use a loopback server or when the user
explicitly asks for an export. Clicking a Feature card opens a details panel
with the same file-derived Task topology and links its nodes to acceptance and
proof detail:

```bash
bash "$BAGAKIT_FEATURE_TRACKER_SKILL_DIR/scripts/feature-tracker.sh" \
  show-feature-status \
  --root . \
  --feature <feature-id> \
  --format html \
  --output .tmp/feature-tracker/status.html
```

The HTML `--feature` option focuses and opens one Feature's details panel while
retaining the complete active overview. It also accepts a closed Feature id and
opens its preserved historical Task topology from the status-specific history
directory; the closed panel is read-only and does not expose claim or Goal
setting actions. Text and JSON forms continue to inspect one Feature.
The overview may place one derived current-focus strip above the status board;
it is only a compact routing cue for the most urgent active, blocked,
replanning, runnable, or closeout state and never a second priority store.
The board also provides a read-only search over Feature and Task text plus a
lifecycle-status filter; filtering temporarily hides the unrelated focus cue
and empty status columns so a large plan is easier to scan, while clear/live
refresh restores the complete overview.
If one active record is malformed, the overview shows a minimal repair-needed
card with canonical links and leaves strict diagnosis to `validate-tracker`.
The page is a derived projection computed from canonical Tracker files plus an
optional latest Flow Runner progress overlay. Reuse the same URL across updates;
do not create a new page per mutation. Its Agent claim draft is a
Host-delivered `bagakit-agent-messaging` envelope; it grants no authority and
proves no delivery or claim. Opening an active Feature's details exposes its derived
Tracker Name (`Feature-Tracker-<feature-id>`) with a copy action, followed by
the Task topology; use the enlarged details panel for larger graphs and read the
node labels and legend for the derived runtime frontier, gate state, and direct
dependencies. Tracker Name is presentation-only and is not another state field.
When all current Tasks carry `estimate_hours`, the topology may highlight one
derived longest estimated dependency chain as the critical path; missing
estimates must yield an explicit unavailable cue, never an inferred duration.
This is a read-time planning observation, not a priority field or scheduler.
When completed Tasks sit outside every unfinished dependency cone, the page may
offer `Focus open work` to de-emphasize that stable completed subgraph. It must
keep those nodes in the same topology and restore them on demand; the control
is display state, not Task mutation or proof deletion.
Closed-history rows are compact and clickable; opening one exposes the same
read-only topology, Task acceptance, verification, and canonical-file previews
from its archived, discarded, or transferred record. The overview keeps only
the index row for non-focused closed Features and loads their full history on
demand, so a long archive does not inflate every page response. If a Feature has `transferred_from`, the details panel and Feature card show
the complete source count and clickable source Feature ids that focus closed
history; this is lineage context, not a dependency edge.
For a large reviewed plan, the details panel puts the dependency graph first. The state strip and one-click
prompt actions stay compact above it; planning history, canonical files, and
execution receipts collapse below the graph. A derived grouped acceptance or
execution-wave overview remains compact and collapsible. Group links still jump to the matching
Task detail. The graph itself labels each dependency layer as a derived wave
(`W01`, `W02`, …), so the wave model is visible in the topology and not only in
the summary. Runtime states are primarily distinguished by text badges and
border/fill treatment; color is auxiliary and never the sole status signal. For plans above 30 Tasks, the graph switches to compact node geometry and wraps evidence cues across two lines, keeping status, dependency progress, gate/proof, effort, and runtime activity available in the node and its tooltip. Use `Overview` to fit the whole graph when a large plan needs a bounded locator.
Every dependency edge has a wider transparent hit target and a source → target
tooltip. Hovering or focusing an edge dims unrelated edges and shows its direct
`depends_on` meaning plus target state in a compact inspector; hovering a node
isolates its incident edges. Keep permanent labels sparse: only critical or
waiting edges need a visible label.
Dense fan-in and fan-out use separate source and target approach lanes before
turning into a node, so parallel rails do not collapse into one ambiguous
vertical stroke. The interaction target stays narrower than the lane spacing;
tracing an edge also emphasizes its two endpoint Tasks.
For dense long-edge sets, keep the rails below the node grid so the initial
viewport presents Tasks before wiring; sparse graphs may balance rails above
and below.
Borrow the xyflow status-indicator pattern only as a derived cue: an active
Task with an explicit bound Flow Runner receipt whose latest
`session_status=progress` may receive a subtle activity ring, and only edges
entering that Task may use a directional animated stroke. This means execution
activity was reported; it is not a Worker heartbeat. Historical, blocked,
terminal, Feature-wide, stale, waiting, and unbound receipts stay static.
Labeled wave/group backdrops and node tooltips are presentation-only; they
must not create synthetic Tasks, edges, or a second status store. All motion
stops under `prefers-reduced-motion` and the text/border status remains
sufficient on its own.
Task review details are independently collapsible; active and blocked Tasks are
open by default while other Tasks stay compact in larger plans. Their browser
disclosure state is preserved exactly by live refresh—including explicitly
closed items—and is not Tracker truth. The Task list has its own scroll region;
selecting a topology node or wave row opens and scrolls only that list to the
matching Task and briefly highlights the target. Each Task detail exposes direct one-click copy actions for claiming the Task,
checking status, explaining the Task, and recovering its bounded Goal statement.
The Feature details panel exposes two Tracker-wide one-click copy actions for
setting the Feature Goal and explaining the whole reviewed plan's progress;
do not require a tab-then-copy sequence or repeat these actions per Task. Canonical file
controls open read-only in-page previews from repo-relative refs instead of
relying on `file://` links; JSON and Markdown previews use escaped,
lightweight syntax coloring without changing source bytes. Keep the Feature
details layout flat: use semantic dividers rather than nested borders when a
container does not carry an interaction or state meaning. Give the topology
the main vertical space in the details panel; do not require a separate
fullscreen surface to see the graph.
Prompt buttons copy directly on one click, report success or clipboard failure,
and point back to canonical SSOT without becoming tracker state.

The document title is derived from the observing repository's final directory
name (`project · Feature Tracker Status`) so pages from multiple projects are
distinguishable; this name is presentation-only. Topology nodes may show
evidence-backed gate progress, an explicit Agent-hour estimate, an observed
Flow Runner checkpoint span, and checkpoint count. Omit unavailable values or
show `—`; never infer duration from wall-clock or file timestamps.

For a live local view, use the loopback-only read-only server first and share
the printed URL with the user:

```bash
bash "$BAGAKIT_FEATURE_TRACKER_SKILL_DIR/scripts/feature-tracker.sh" \
  serve-feature-status \
  --root . \
  --feature <feature-id>
```

The server regenerates the same projection from `state.json`, `tasks.json`,
and `index/features.json` on each browser refresh. If Flow Runner is present,
it also reads the latest `progress.ndjson` receipt for the mirrored Feature;
only an explicit `task_ref` can attach that informational activity to a Task.
Receipt provenance is shown as a repository-relative path in the page rather
than a `file://` link, so static exports remain portable and do not depend on
browser access to local files.
The page's JavaScript only fetches and replaces the status region; it does not
read browser-local files, mutate Tracker state, or provide a write endpoint.
When canonical content is unchanged it leaves the status DOM in place to avoid
flashing dialogs or disclosures. It preserves the selected Feature details
panel while showing refresh state (`Updating`, `Updated`, `No changes`, or
`Update failed`), and preserves topology scroll and
zoom position and the board's horizontal scroll position across those
replacements. The topology controls have a bounded zoom range, an explicit Fit
action, and pointer-drag panning on the empty canvas; the SVG's layout
dimensions stay synchronized with zoom, so scrolling does not expose a clipped
visual transform. Stop the server when the observation
session ends. Do not replace this route with a `file://` page when a loopback
server can be started: browsers commonly restrict local-file automation and a
file snapshot cannot observe changes.

When the observer has a terminal but no browser, render the same projection in
place:

```bash
bash "$BAGAKIT_FEATURE_TRACKER_SKILL_DIR/scripts/feature-tracker.sh" \
  watch-feature-status \
  --root . \
  --feature <feature-id>
```

This is the same derived frontier and Task topology as the other two routes, not
a second projection: it renders `feature_task_frontier` and
`task_topology_layers` over the same canonical files and holds no tracker lock.
`--feature` targets one Feature's topology while keeping the full active board,
and a malformed active record shows the same repair-needed line rather than
disappearing from the board. On each refresh it recomputes the whole projection,
reports `updated`, and on a transient read error keeps the last good frame and
reports the failure instead of blanking the view. It also marks the time the
canonical content last changed, derived from content rather than file
timestamps, so a change that happened while the observer looked away stays
visible. Prefer the loopback server when a browser is available: only the page
carries the full interactive graph.

## Progress Publication

When reporting progress for a tracked Feature, the Agent must first refresh or
serve its human status projection and include the same stable topology link in
that progress message:

- static route: rerun `show-feature-status --format html --output <stable-path>`
- live route: reuse the `serve-feature-status` loopback URL
- terminal route: `watch-feature-status` when the observer has no browser
- keep the link stable across updates; do not create a new page per mutation
- let the page carry the complete topology; the progress message should give
  only the result, current exception or blocker, and the link
- if no route can be presented, include a compact derived frontier summary
  (`active`, `runnable`, `blocked`, `cancelled`, `waiting`) and state that the topology page
  is unavailable

This publication rule applies to user-facing progress messages, not every
internal state mutation or Worker heartbeat.

When the Feature is executed through `bagakit-flow-runner`, a bounded session
about one Task should record the exact Task id with checkpoint's optional
`--task-ref <task-id>`. The status page then attaches the latest progress
receipt matching that Task. Feature-wide work or a session without a reliable Task
binding must omit it; the page keeps that activity Feature-wide rather than
guessing. This is a read-only overlay and never replaces `tasks.json` status or
gate evidence.
Host-only `worker-v1` messages and `agent-loop` observations are not scraped by
the page; when Task-level visibility matters, record the bounded execution
checkpoint through Flow Runner instead.

## Closeout

A code commit or a successful final `finish-task` is not Feature completion.
Run `closeout-feature` first as a dry-run, resolve the three review items it
prints, then rerun with `--execute`:

- documentation: update or verify only the owning SSOT; never turn Agent
  inference into requirements
- learning: summarize bounded mistakes, corrections, and useful methods; merge
  duplicates and keep them non-authoritative for requirements
- promotion: use an existing Chronicle, Evolver, Principle Layer, or Living
  Knowledge owner; do not create another store

The terminal lifecycle is `archived`, `discarded`, or `transferred`. Use
`discard-feature --reason invalid` only when a readable active Feature actually
fails its contract: Tracker rejects valid state, preserves the original
Feature-root files under `artifacts/invalid-source/`, and publishes a minimal
discarded tombstone without changing Git workspaces.

## Low-Frequency Paths

- `create-feature-from-planning-entry-handoff` consumes an approved planning
  handoff without making the handoff a second SSOT
- `set-feature-goal` is optional; use `bagakit-set-loop-goal` for Goal authoring
- `materialize-feature-artifact` creates optional proposal, spec-delta, or
  verification helpers only when they add evidence value
- `adopt-feature-worktree` binds or rebinds an existing registered worktree;
  it never creates, cleans, checks out, or removes the worktree
- `diagnose-tracker --closeout-plan` is the read-only cleanup entrypoint
- use `repair-reviewed-task-plan` only when the operator reports damaged
  reviewed lineage; do not invent another repair or compatibility path

The complete discovery inventory is
`references/skill-cli.toml`; argparse and the contracts own option semantics.

## Runtime Surface Declaration

- top-level runtime surface: `.bagakit/feature-tracker/`
- shared input not owned here: `.bagakit/planning-entry/handoffs/`
- stable surface contract: `docs/specs/runtime-surface-contract.md`
- a materialized top-level runtime surface should carry `surface.toml`

## Stable Contracts

- `docs/specs/feature-tracker-contract.md`
- `docs/specs/feature-tracker-id-issuance.md`
- `docs/specs/feature-tracker-projection-surfaces.md`
- `docs/specs/execution-owner-receipt-contract.md`
- `docs/specs/principle-layer-contract.md`

Read only the owning contract needed for a low-frequency decision. Do not copy
contract detail back into this entrypoint.
