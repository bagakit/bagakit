# Feature Tracker Contract

This document defines the stable runtime and planning contract for
`bagakit-feature-tracker`.

## Scope

This contract covers:

- tracker runtime surfaces
- closeout storage surfaces
- local-only issuer boundary
- source-of-truth rules
- dependency projection semantics

This contract does not define the public feature-id shape.

That belongs to:

- `docs/specs/feature-tracker-id-issuance.md`

## Runtime Surfaces

Stable tracker-owned runtime files live under:

- `.bagakit/feature-tracker/index/features.json`
- `.bagakit/feature-tracker/runtime-policy.json`
- `.bagakit/feature-tracker/features/<feature-id>/state.json`
- `.bagakit/feature-tracker/features/<feature-id>/tasks.json`
- optional `.bagakit/feature-tracker/features/<feature-id>/goal.md`
- `.bagakit/feature-tracker/features/<feature-id>/owner-receipt.json` for
  reviewed execution or Goal continuation
- `.bagakit/feature-tracker/features-archived/<feature-id>/`
- `.bagakit/feature-tracker/features-discarded/<feature-id>/`
- `.bagakit/feature-tracker/local/issuer.json`

Tracked planning truth lives under:

- `features/`
- `index/features.json`
- `runtime-policy.json`

Closed planning truth lives under:

- `features-archived/`
- `features-discarded/`

## Local-Only Issuer Boundary

The tracker may use local-only issuer state to mint new feature ids.

That local issuer state is not canonical planning truth.

Required boundary:

- local issuer state must remain outside tracked tracker truth
- local guard material must remain git-local
- active and closed feature records must stay valid when local issuer state is
  absent on another machine

Stable local issuer surfaces are:

- `.bagakit/feature-tracker/local/issuer.json`
- one git-local config key owned by the tracker implementation

## Source-Of-Truth Rule

- `features.json` owns the ordered feature index and tracked issuance cursor.
- `state.json` owns one feature's lifecycle and workspace truth.
- `tasks.json` owns one feature's task truth.
- `goal.md`, when present, owns one feature's stable long-running Agent control
  contract: final outcome, invariants, final acceptance, authority, durable
  orchestration principles, and bounded context references.
- `runtime-policy.json` owns tracker policy defaults, gate policy, and doctor
  thresholds.
- `show-feature-dag` computes a read-only dependency projection on demand from
  canonical feature state; no projection file owns additional truth.
- archive and discard directories own closed feature records after closeout.

Implications:

- `tasks.json` is the only task source of truth
- the default feature directory contains `state.json`, `tasks.json`, and
  optional canonical `goal.md`; reviewed execution or Goal continuation also
  derives `owner-receipt.json`
- `state.json.goal_contract` binds the exact Goal schema, repo-relative path,
  and SHA-256 revision; `state.json.goal` remains only a concise index summary
- Feature Tracker validates Goal identity, binding, content presence, and
  portability; authoring headings, prose order, and semantic quality remain
  `bagakit-set-loop-goal` concerns
- Goal must not own a second lifecycle, task plan, dependency graph, blocker,
  event stream, completion evidence, review state, or archive
- `state.json` may also carry runtime-owner semantics such as `runtime_role`,
  `blocked_reason_class`, and `runtime_relations`; when present,
  `index/features.json` should project those fields as read-optimized index
  state rather than inventing them independently
- root-level helper markdown files such as `proposal.md`, `spec-delta.md`, and
  `verification.md` are optional operator aids, not authoritative task state
- local issuer state may help create new ids but may not redefine tracked
  feature truth
- external bridges may read tracker truth but do not become tracker truth

## Feature Family And Task Boundary

Feature is the stable goal boundary. Task is the extension mechanism inside
that boundary.

Rules:

- normalized `state.json.slug` is the deterministic family key among active
  Features
- at most one non-closed Feature may own a family key
- `create-feature` without reviewed tasks is idempotent for an existing family
  and must return the existing Feature without mutating state or allocating an
  id
- reviewed work aimed at an existing family must use `set-task-plan` with the
  current revision; create must not silently merge, renumber, or discard Task
  semantics
- create a different Feature only when the goal, protected invariants, or
  acceptance boundary is materially different
- archived and discarded Features are immutable history and do not reserve the
  family key for a future lifecycle
- family matching is exact after slug normalization; the deterministic tracker
  must not perform fuzzy or embedding-based semantic merges

Planning-entry handoffs that resolve to an existing active family must stop and
route their extension through that Feature's Task plan.


## Runtime Ownership Split Contract

Some features are runtime frontdoors only.
Others own the currently executing lane.

The tracker may represent that distinction in canonical feature state.

Stable runtime-owner fields:

- `state.json.runtime_role`
  - `standalone`
  - `frontdoor_context`
  - `execution_owner`
  - `foreground_owner`
- `state.json.blocked_reason_class`
  - `none`
  - `external_blocker`
  - `internal_blocker`
  - `parked_context`
- `state.json.runtime_relations`
  - list of typed feature-to-feature runtime links
  - stable relation values:
    - `frontdoor_for`
    - `handoff_from`

Projection rule:

- `state.json` remains canonical for these runtime-owner fields
- `index/features.json` may project them for list/read surfaces
- dependency projection output must not carry them because they are not
  dependency truth

Required invariants:

- non-`none` `blocked_reason_class` requires `status = blocked`
- `parked_context` requires `runtime_role = frontdoor_context`
- `frontdoor_context` features may only point outward with
  `runtime_relations[].relation = frontdoor_for`
- `execution_owner` features may only point outward with
  `runtime_relations[].relation = handoff_from`
- `foreground_owner` features may only point outward with
  `runtime_relations[].relation = handoff_from`
- cross-feature runtime links should stay symmetric:
  `frontdoor_for(A -> B)` requires `handoff_from(B -> A)`

These fields describe runtime ownership posture only.
They do not replace dependency truth, task truth, or closeout state.

## Planning Entry Handoff Consumption Rule

The tracker may materialize canonical planning truth from one approved
planning-entry handoff.

That handoff is an exchange surface, not new tracker truth by itself.

Allowed direction:

- approved planning-entry handoff -> tracker `state.json` and `tasks.json`

Forbidden direction:

- handoff prose or raw brainstorm logs becoming implicit tracker truth without
  explicit tracker materialization

Downstream trust gate:

- handoff `status` must be `approved`
- handoff `clarification_status` must be `complete`
- handoff `discussion_clear` must be `true`
- handoff `user_review_status` must be `approved`

Tracker may also project the consumed handoff into optional helper markdown such
as `proposal.md`, but those projections do not replace tracker JSON SSOT.

An approved handoff may carry an optional reviewed `task_plan` using
`bagakit.feature-task-plan.v1`.

- with `task_plan`, tracker may materialize reviewed task truth immediately
- without `task_plan`, tracker must create `proposal` + `proposal_only` state
- an approved handoff is not itself permission to invent executable tasks

## Semantic Task Plan Contract

Active Feature Tracker execution requires explicit version 2 task truth.

Draft `tasks.json` shape:

- `version = 2`
- `plan_status = draft`
- `plan_revision = 0`
- no executable tasks

Reviewed task-plan input schema:

- `schema = bagakit.feature-task-plan.v1`
- approved review evidence
- non-empty repo-relative source references
- one or more semantic tasks

Each reviewed task requires:

- `id`, `title`, `objective`, and `outcome`
- non-empty acceptance statements
- non-empty verification mappings with `kind`, repo-relative `ref`, and
  `proves`
- non-empty source references
- explicit `supersedes` lineage when it removes tasks from the prior current
  plan

Required behavior:

- `create-feature --tasks-file` materializes revision 1
- `set-task-plan --expected-revision <n>` fails on stale revision
- workspace assignment and task start fail closed without canonical reviewed
  version 2 task truth
- a task may be started only when it belongs to the latest reviewed plan
- a task already superseded by a later plan cannot be restarted
- plan replacement is rejected while a task is `in_progress`
- an accidentally started task may return to `todo` only when it has no gate
  evidence or prior blocked/done completion, its persisted owner receipt is
  current, its assigned execution worktree is clean, and its current Git HEAD
  matches the caller's expected HEAD
- blocked or done task records with execution evidence remain immutable and
  attributable when later plans supersede them
- later revisions compare against the immediately prior current-plan task ids,
  not every historical task record retained in `tasks.json`
- a retained current task may carry supersession lineage already attributed to
  that same task in an earlier revision; the new history entry records only
  tasks removed from the immediately prior current plan
- each revision records supersession ownership by current task; a retained
  owner cannot drop or transfer earlier edges, while replacing that owner
  leaves its earlier ownership immutable in historical revisions
- the expected-HEAD check is an optimistic current-state guard; it does not
  claim that no commit occurred since task start
- active features must use this explicit contract; closed historical features
  may retain their pre-v2 task shape

Normal `set-task-plan` replacement remains forbidden while a task is active.

Review, source, verification, and evidence references are portable
repo-relative paths. They must reject repository escape, URI paths, drive
absolute paths, and UNC paths.

Feature Tracker owns semantic planning truth and task gate evidence. It does
not own Flow Runner checkpoints, repeated execution scheduling, or normalized
outer-loop work-item history.

## Execution Owner Receipt

Feature Tracker writes `owner-receipt.json` beside canonical feature state only
for reviewed execution or Goal continuation. Proposal and draft state without a
Goal do not materialize a receipt.
The shared receipt shape is defined by:

- `docs/specs/execution-owner-receipt-contract.md`

Feature Tracker requirements:

- `owner_kind = feature_tracker`
- `evidence_refs` identify the feature's `state.json` and `tasks.json`
- when `goal_contract` exists, `evidence_refs` also identifies `goal.md`
- `evidence_hashes` bind each evidence ref to the SHA-256 digest of its final
  canonical file bytes
- `semantic_revision` is the SHA-256 digest of the compact canonical JSON over
  owner identity, lifecycle, continuation, current item, blocker,
  replacement ref, and `evidence_hashes`
- `save_feat` writes canonical state and tasks before refreshing the derived
  receipt
- a missing required receipt, stale receipt, or evidence hash drift fails
  closed
- `ready` and valid `in_progress` state map to `continue`
- missing reviewed plan or missing workspace maps to blocked continuation
- a replacement points to the repo-relative replacement owner receipt, not a
  bare feature id

The receipt is a derived owner handoff. It does not become task SSOT and does
not authorize a consumer to mutate Feature Tracker.

## Feature Root File Policy

Feature roots are not general-purpose documentation buckets.

Allowed live-feature root files:

- `state.json`
- `tasks.json`
- `owner-receipt.json`
- optional canonical `goal.md`
- optional `proposal.md`
- optional `spec-delta.md`
- optional `verification.md`

Allowed live-feature root directories:

- optional `artifacts/`

Allowed closeout-only root files:

- `summary.md`

Allowed canonical files in both live and closed feature roots:

- `goal.md` when `state.json.goal_contract` exists

Rules:

- unsupported feature-root files must be rejected by validation
- unsupported feature-root directories must be rejected by validation
- an orphan, missing, malformed, wrongly bound, or hash-drifted `goal.md` must
  be rejected by validation
- `summary.md` is a closeout artifact and must not appear in active feature
  roots
- closed feature roots must contain `summary.md`
- closeout keeps canonical `goal.md` at the closed Feature root and updates
  `goal_contract.ref` plus owner receipt hashes to the closed path
- live-feature helper files such as `proposal.md`, `spec-delta.md`, and
  `verification.md` are not valid in closed feature roots
- closeout should preserve legacy or live-only root entries by moving them
  under `artifacts/closeout-preserved-root/` before the feature is finalized
- if an active feature root already contains `summary.md`, closeout should
  preserve that operator-authored file under
  `artifacts/closeout-preserved-root/summary.md` before writing the canonical
  closed summary
- `PRD.md` and `Changelog.md` are not supported feature-root artifacts under
  the current contract
- feature intent or scope that would otherwise drift into `PRD.md` should route
  to `proposal.md` or an upstream planning artifact
- change history that would otherwise drift into `Changelog.md` should route to
  repo or release surfaces; feature closeout narrative belongs in `summary.md`
- `ui-verification.md` is retired; validation should point operators to
  `verification.md`
- if another artifact class becomes canonical later, it must be introduced
  through the contract instead of appearing ad hoc in feature roots

## Dependency Projection Contract

`show-feature-dag` emits an on-demand generated projection.

It is not:

- canonical feature truth
- an operator-edited planning file
- a runtime execution history surface
- a policy-resolved scheduling plan

Stable current payload shape:

- `version`
- `generated_by`
- `features`
  - `feat_id`
  - `depends_on`
  - `dependents`
  - `layer`
- `layers`
  - `layer`
  - `feat_ids`
- `notes`

Required generation rules:

- generate from active non-archived feature state
- use `state.json.depends_on` as canonical dependency truth
- `state.json.depends_on` must be a list when present
- derive dependents and pure topological layers from that truth
- treat archived dependencies as already satisfied and record that as a note
- fail closed on discarded dependencies
- record missing active dependencies as notes instead of silently inventing
  graph nodes

Forbidden content in dependency projection output:

- policy-resolved execution mode
- parallelism limits
- execution recommendations
- progress or resume cursors that belong to a separate execution-plan or
  runtime-history surface

Generation and mutation rule:

- the tracker must compute dependency projection directly from canonical
  feature state
- graph-affecting commands must validate the resulting active DAG before they
  persist canonical state changes or run destructive closeout cleanup
- `replan-features` must validate the complete proposed graph before persisting
  any changed `state.json.depends_on` values
- validation must recompute the active graph and reject invalid dependency
  values, discarded dependencies, and cycles
- projection output is disposable and must not be required for later mutation,
  validation, recovery, or closeout

## Workspace Mode Contract

Stable workspace modes are:

- `proposal_only`
- `current_tree`
- `worktree`

Required invariants:

- `proposal_only` carries no dedicated branch or worktree assignment
- `current_tree` carries no dedicated branch or worktree assignment
- `worktree` carries branch, worktree name, and worktree path together

Workspace assignment determines the execution root for task gates:

- `worktree` features execute task gates from the assigned worktree path
- `current_tree` features execute task gates from the repository root supplied
  to the tracker command
- `proposal_only` features must not run task gates against a hidden
  implementation tree

The mode set is part of tracker contract, not a transient implementation detail.

## Concurrency Contract

Tracker state mutation must be serialized at the repository level.

Required behavior:

- concurrent tracker commands must not corrupt `features.json`, `state.json`,
  or `tasks.json`
- long-running task-gate execution must not hold the global tracker
  state lock for the whole external command duration
- task-gate commands must capture the feature workspace assignment
  before executing external commands and revalidate that assignment before
  writing results back to tracker state
- workspace assignment must not be changed while a feature has an `in_progress`
  task
- feature discard must not close or clean up a feature while a task is
  `in_progress`; the active task must be finished first
- worktree execution must verify that the assigned worktree path is a registered
  Git worktree and that its checked-out branch matches feature state

Concurrency does not mean multiple simultaneous implementation tasks inside one
feature. A feature still has at most one `current_task_id`; parallel work should
be represented as independent features or independent worktrees.

## Optional Artifact Rule

The tracker may materialize optional helper files from canonical templates.

Current optional helper artifacts are:

- `proposal.md`
- `spec-delta.md`
- `verification.md`

Rules:

- none of these files are required in the default feature layout
- their presence must not redefine `state.json` or `tasks.json`
- `verification.md` is generic evidence, not a UI-only special case
- closed features must not materialize or retain these live-feature helper files
  at the feature root
- the default gate policy is `verification_policy = on_demand`, which means
  `verification.md` is only checked when the file exists unless a stricter
  policy is configured

Materialize `verification.md` when:

- a task needs manual checks that are not already captured by automated
  commands
- screenshots, interactive review notes, rollout observations, or residual risk
  notes matter to acceptance
- tracker policy is configured to require explicit verification evidence

Keep evidence only in `tasks.json` and gate logs when:

- all acceptance checks are already covered by automated commands
- no additional human evidence is needed beyond pass/fail command output

Migration note:

- `ui-verification.md` is superseded by `verification.md`
- current tracker contract expects `verification.md`
- active feature roots carrying the old filename should rename it before
  rerunning gate
- closed feature roots should preserve legacy `ui-verification.md` under
  `artifacts/closeout-preserved-root/` instead of restoring it at the root
- tracker validation should provide a direct rename hint for this migration

## Closeout Rule

`archive-feature`, `discard-feature`, and `closeout-feature` are public
closeout commands.

Runtime truth and Git truth are separate surfaces:

- tracker commands may mutate tracker runtime state
- Feature Tracker does not generate commit prose, execute Git commits, or
  persist commit identity; ordinary Git or `bagakit-git-message-craft` owns
  those concerns
- a code commit is not the tracked feature completion boundary

Stable closeout expectations:

- `diagnose-tracker --closeout-plan` remains read-only and emits loadable
  closeout candidates even when validation finds unrelated active-state errors;
  the command must still return non-zero while those errors remain
- `closeout-feature` defaults to a dry-run plan and requires `--execute` before
  it changes tracker state
- tracked feature completion means the feature reaches `archived` or
  `discarded`, or the operator leaves an explicit active reason such as
  `blocked`
- archived features move into `features-archived/`
- discarded features move into `features-discarded/`
- closeout summaries live with the closed feature directory
- live-only or unsupported legacy root entries should be preserved under
  `artifacts/closeout-preserved-root/`
- archive and discard must validate the post-closeout active DAG before they
  remove worktrees, delete branches, or move the feature directory
- `current_tree` archive may proceed with unrelated non-harness repo changes
  because archive only closes tracker metadata and does not preserve or delete
  implementation files
- `current_tree` discard must still fail closed on non-harness repo changes
  because discard can otherwise hide unpreserved work
- archive/discard idempotent reruns must fail closed when directory placement
  disagrees with the claimed closed status
- closed features must not remain in `features/`

The tracker must fail closed if active and closed directory placement disagree
with indexed feature status.

## Protected Boundaries

This contract intentionally rejects several easier but lower-quality shortcuts.

- Feature ids do not carry slug or timestamp semantics.
- Local issuer state does not become tracked planning truth.
- Dependency projection output does not replace feature state or embed
  policy-resolved execution planning.
- Unsupported feature-root prose files must not become shadow tracker truth.
- External bridge logic does not ship inside the canonical tracker contract.
