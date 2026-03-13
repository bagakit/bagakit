# Feature Tracker Contract

This document defines the stable runtime and commit contract for
`bagakit-feature-tracker`.

## Scope

This contract covers:

- tracker runtime surfaces
- closeout storage surfaces
- local-only issuer boundary
- source-of-truth rules
- dependency projection semantics
- task commit contract

This contract does not define the public feature-id shape.

That belongs to:

- `docs/specs/feature-tracker-id-issuance.md`

## Runtime Surfaces

Stable tracker-owned runtime files live under:

- `.bagakit/feature-tracker/index/features.json`
- `.bagakit/feature-tracker/index/FEATURES_DAG.json`
- `.bagakit/feature-tracker/runtime-policy.json`
- `.bagakit/feature-tracker/features/<feature-id>/state.json`
- `.bagakit/feature-tracker/features/<feature-id>/tasks.json`
- `.bagakit/feature-tracker/features-archived/<feature-id>/`
- `.bagakit/feature-tracker/features-discarded/<feature-id>/`
- `.bagakit/feature-tracker/local/issuer.json`

Tracked planning truth lives under:

- `features/`
- `index/features.json`
- `runtime-policy.json`

Tracked projections live under:

- `index/FEATURES_DAG.json`

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
- `runtime-policy.json` owns tracker policy defaults, gate policy, and doctor
  thresholds.
- `FEATURES_DAG.json` owns the latest generated dependency projection, not the
  feature records themselves and not policy-resolved execution planning.
- archive and discard directories own closed feature records after closeout.

Implications:

- `tasks.json` is the only task source of truth
- the default feature directory contains only `state.json` and `tasks.json`
- root-level helper markdown files such as `proposal.md`, `spec-delta.md`, and
  `verification.md` are optional operator aids, not authoritative task state
- local issuer state may help create new ids but may not redefine tracked
  feature truth
- external bridges may read tracker truth but do not become tracker truth

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

## Feature Root File Policy

Feature roots are not general-purpose documentation buckets.

Allowed live-feature root files:

- `state.json`
- `tasks.json`
- optional `proposal.md`
- optional `spec-delta.md`
- optional `verification.md`

Allowed live-feature root directories:

- optional `artifacts/`

Allowed closeout-only root files:

- `summary.md`

Rules:

- unsupported feature-root files must be rejected by validation
- unsupported feature-root directories must be rejected by validation
- `summary.md` is a closeout artifact and must not appear in active feature
  roots
- closed feature roots must contain `summary.md`
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

`FEATURES_DAG.json` is a generated projection.

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

Forbidden content in `FEATURES_DAG.json`:

- policy-resolved execution mode
- parallelism limits
- execution recommendations
- progress or resume cursors that belong to a separate execution-plan or
  runtime-history surface

Freshness rule:

- the tracker must be able to recompute `FEATURES_DAG.json` from canonical
  feature state
- graph-affecting commands must validate the resulting active DAG before they
  persist canonical state changes or run destructive closeout cleanup
- direct graph-affecting commands that overwrite `FEATURES_DAG.json` should also
  fail before mutation when the current DAG file is missing or the current DAG
  path is not a writable regular file while they are still mutating live
  feature state; use `replan-features` to recover missing or malformed DAG
  targets first
- already-closed `archive-feature` and `discard-feature` reruns may repair a
  missing or malformed `FEATURES_DAG.json` only after they verify the feature
  already lives in the matching closed directory with its closed summary
- already-closed closeout reruns must not overwrite a present schema-valid DAG
  surface just to clear projection drift
- if unrelated active feature state prevents recomputing a missing or malformed
  DAG surface, already-closed closeout reruns should warn and leave recovery to
  `replan-features` instead of failing the rerun itself
- successful graph-affecting tracker commands such as `create-feature`,
  `archive-feature`, `discard-feature`, and `replan-features` should refresh the
  current `FEATURES_DAG.json`
- validation must fail if `FEATURES_DAG.json` is missing
- validation must be able to detect when the checked-in DAG projection has
  drifted from that recomputed result

## Workspace Mode Contract

Stable workspace modes are:

- `proposal_only`
- `current_tree`
- `worktree`

Required invariants:

- `proposal_only` carries no dedicated branch or worktree assignment
- `current_tree` carries no dedicated branch or worktree assignment
- `worktree` carries branch, worktree name, and worktree path together

The mode set is part of tracker contract, not a transient implementation detail.

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

`archive-feature` and `discard-feature` are public closeout commands.

Stable closeout expectations:

- archived features move into `features-archived/`
- discarded features move into `features-discarded/`
- closeout summaries live with the closed feature directory
- live-only or unsupported legacy root entries should be preserved under
  `artifacts/closeout-preserved-root/`
- archive and discard must validate the post-closeout active DAG before they
  remove worktrees, delete branches, or move the feature directory
- archive/discard idempotent reruns must fail closed when directory placement
  disagrees with the claimed closed status
- closed features must not remain in `features/`

The tracker must fail closed if active and closed directory placement disagree
with indexed feature status.

## Commit Contract

Required subject format:

`feature(<feature-id>): task(<task-id>) <summary>`

Required body sections:

- `Plan:`
- `Check:`
- `Learn:`

Required trailers:

- `Feature-ID: <feature-id>`
- `Task-ID: <task-id>`
- `Gate-Result: pass|fail`
- `Task-Status: done|blocked`

`Task-Status: done` requires `Gate-Result: pass`.

## Protected Boundaries

This contract intentionally rejects several easier but lower-quality shortcuts.

- Feature ids do not carry slug or timestamp semantics.
- Local issuer state does not become tracked planning truth.
- DAG output does not replace feature state.
- DAG output must not embed policy-resolved execution planning.
- Unsupported feature-root prose files must not become shadow tracker truth.
- External bridge logic does not ship inside the canonical tracker contract.
