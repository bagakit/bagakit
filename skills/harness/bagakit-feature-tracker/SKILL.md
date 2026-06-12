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

Before each `set-task-plan`, perform a scope boundary check against the existing
Goal: confirm the same user outcome, protected invariants, acceptance boundary,
and target environment. A revision may repair a failed assumption or regroup
dependencies, but it must not quietly combine a new product line, release
campaign, route migration, or unrelated cleanup into the same Feature. If the
goal boundary changed, or revision/task/failure growth is being used to carry a
second delivery line, install a reviewed successor and use `transfer-feature`
instead of extending the old plan indefinitely.

## Golden Path

Before the first dispatch, and at a completion, blocker, or plan revision that
changes the frontier, dependencies, assumptions, or candidate, run
`review-task-plan --feature <feature-id> --json` and dispatch the available
independent frontier. **Wave is DAG depth, never a batch barrier.** Coalesce
simultaneous completions into one owner review; reuse the audit while its plan
revision and frontier are unchanged instead of re-auditing per Worker or
observation tick.
Do not wait for an entire Wave, review, or test phase to finish before starting
work whose actual inputs are ready. User-confirmed ample test capacity removes
an assumed resource bottleneck; do not silently reintroduce it.

### Convergence controls

Every bounded execution session must name one Task, one owner, and one close
condition. For an expensive, externally visible, or final-candidate lane, also
name the current workspace, candidate or input reference, next action, wait
deadline, and cleanup state. A repeated summary, context recovery, or
unchanged poll is not progress. Two unchanged bounded checkpoints are a
review trigger; they are not an automatic failure. If no active wait is still
within its deadline, run `review-task-plan` and then revise, block, fail, or
transfer the Task with evidence.

Freeze a clean, gated restore ref before any expensive replay, external
mutation, rollout, route switch, or final-candidate gate. Tracker's built-in
receipt binds the committed HEAD, tracked worktree diff, verification artifact,
plan revision, and command fingerprint. External input, data-window,
configuration, image, generation, and publication-root identity belongs in the
Task's artifact receipt; a changed external input invalidates that receipt.
These identities belong in receipts and logs, not in Goal or reviewed Task
semantics.

Use a cheap, production-shaped counterexample or preflight before an expensive
gate. It must identify the failing stage and failure class and leave a bounded
artifact. Keep one write owner for the Task, one current candidate, and one
independent read-only audit unless a new failure mechanism is observed. A
successful receipt is consumed by the final join; later Tasks must not rerun
the same expensive proof merely to restate it.

Keep release, route/browser acceptance, MR merge, and Feature closeout as
separate acceptance boundaries. A single terminal Task may join their receipts,
but it must not own all external side effects and publication decisions at once.

For each material waiting edge, distinguish **inputs needed to start** from
**evidence needed to sign off**. Review preparation, incremental code review,
isolated tests, and farm shards can produce useful evidence before final
integration. A final acceptance that consumes the exact joined candidate keeps
its real dependencies. If one Task mixes both, use a reviewed split into an
independently useful evidence Task and its final join, or the bounded
provisional route in [convergence review](references/convergence-review.md).
Do not merely say “these can run in parallel”: record the edge decision,
install any authorized revision, then dispatch it. Preserve completed history
and active Task semantics. Never remove an edge just because a title says
“review”, “test”, or “acceptance”.

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
`state.json.gate.last_check_commands`. The receipt also binds the candidate
HEAD, tracked worktree diff, verification-artifact digest, plan revision, and a
deduplication key. The latest passing receipt for the same fingerprint is
reused; an
identical failed attempt requires an explicit `--rerun --rerun-reason <reason>`
decision; the reason is recorded in Feature history. Runtime
policy does not choose Task
completion commands. A reviewed Task without an executable command
verification fails closed when it is being started or gated; artifact, manual,
and owner-receipt mappings remain additional evidence routes and are not
silently treated as a passing command gate. Existing reviewed plans that only
contain those non-command mappings remain readable as historical truth, but
cannot start or finish a new execution Task until their reviewed plan is
revised with an executable command. `finish-task --result done` also rejects a
stale receipt whose command list, candidate, worktree, or verification input
no longer matches the current Task plan, even if an old `pass` value is
present. This transition check is deliberately not a
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
Use it at the dispatch and progress checkpoints above, and include
the resulting edge decision in the reviewed plan evidence. The command never
removes an edge or schedules an Agent by itself.

This is a proactive review loop, not an automatic scheduler: Tracker remains
the SSOT for the reviewed DAG, while Host/Supervisor still owns Worker
assignment, concurrency limits, worktrees, and merge order. A provisional lane
is never a second Task status or dependency graph; it cannot satisfy a
dependent or close a Task until the reviewed exact-candidate join and gate
pass.

## Human Visibility

Use the read-only loopback page for a browser observer:

```bash
bash "$BAGAKIT_FEATURE_TRACKER_SKILL_DIR/scripts/feature-tracker.sh" \
  serve-feature-status --root . --feature <feature-id>
```

Keep the topology central, the summary compact, and prompts one-click copy.
The page derives status from Tracker, and optional activity only from explicitly
Task-bound Flow Runner receipts. Dagre lays out the graph; Wave remains a depth
label. Large plans can fold tasks with identical upstream/downstream sets and
hide transitive-redundant declared edges without changing canonical truth.
Expand groups or `Show all links` to inspect the full plan. Repeated hover and
unchanged polls must not rebuild the canvas. Motion should explain a selected
path, a layout transition, or evidence-backed activity, and obey reduced-motion
preferences.

Read [Status surface](references/status-surface.md) for static export, terminal
observation, grouping, interaction, and refresh details. Keep those display
mechanics out of the execution and concurrency rules above.

Maintainer rationale and verified optimization trade-offs are recorded in
[optimization notes](references/optimization-notes.md). They are learning
history, not a second source of planning truth.

## Progress Publication

When reporting progress for a tracked Feature, refresh or serve its human
status projection when the user asks for a visual status link, when the
topology materially changed, or when no stable observer link exists and one is
useful. Otherwise report the result and current frontier directly; do not
render a page for every small status update:

- static route: rerun `show-feature-status --format html --output <stable-path>`
- live route: reuse the `serve-feature-status` loopback URL
- terminal route: `watch-feature-status` when the observer has no browser
- keep the link stable across updates; do not create a new page per mutation
- let the page carry the complete topology; the progress message should give
  only the result, current exception or blocker, and the link
- if no route can be presented, include a compact derived frontier summary
  (`active`, `runnable`, `blocked`, `cancelled`, `waiting`) and state that the topology page
  is unavailable

Reuse an existing stable link across updates. This publication rule applies to
user-facing progress messages when a projection is useful, not every internal
state mutation or Worker heartbeat.

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
Resolve the three closeout review items, then run `closeout-feature --execute`
with their dispositions, rationales, and evidence. Use a dry-run only when the
transition or missing review inputs are unclear; it is not an additional
mandatory gate and cannot itself archive a Feature:

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
