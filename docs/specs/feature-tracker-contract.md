# Feature Tracker Contract

This document defines the stable runtime and commit contract for
`bagakit-feature-tracker`.

## Scope

This contract covers:

- tracker runtime surfaces
- closeout storage surfaces
- local-only issuer boundary
- source-of-truth rules
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
- `FEATURES_DAG.json` owns the latest dependency projection, not the feature
  records themselves.
- archive and discard directories own closed feature records after closeout.

Implications:

- markdown task lists are projections of `tasks.json`
- local issuer state may help create new ids but may not redefine tracked
  feature truth
- external bridges may read tracker truth but do not become tracker truth

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

## Closeout Rule

`archive-feature` and `discard-feature` are public closeout commands.

Stable closeout expectations:

- archived features move into `features-archived/`
- discarded features move into `features-discarded/`
- closeout summaries live with the closed feature directory
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
- External bridge logic does not ship inside the canonical tracker contract.
