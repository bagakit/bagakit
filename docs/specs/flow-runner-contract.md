# Flow Runner Contract

This document defines the stable runtime contract for `bagakit-flow-runner`.

## Scope

This contract covers:

- work-item runtime state
- next-action payloads
- checkpoint receipts
- resume-candidate payloads
- snapshot metadata
- incident and plan-revision sidecars

This contract does not define feature planning truth. That remains owned by
`bagakit-feature-tracker`.

## Runtime Surfaces

Stable runtime files live under:

- `.bagakit/flow-runner/policy.json`
- `.bagakit/flow-runner/recipe.json`
- `.bagakit/flow-runner/items/<item-id>/state.json`
- `.bagakit/flow-runner/items/<item-id>/checkpoints.ndjson`
- `.bagakit/flow-runner/items/<item-id>/progress.ndjson`
- `.bagakit/flow-runner/items/<item-id>/handoff.md`
- `.bagakit/flow-runner/items/<item-id>/plan-revisions/`
- `.bagakit/flow-runner/items/<item-id>/incidents/`
- `.bagakit/flow-runner/archive/<item-id>/`
- `.bagakit/flow-runner/backups/`
- `.bagakit/flow-runner/next-action.json`
- `.bagakit/flow-runner/resume-candidates.json`

`items/` is the active tree.

`archive/` is the closed tree.

## Source-of-Truth Rule

- `bagakit-flow-runner` owns runner-local work-item truth.
- `bagakit-feature-tracker` owns feature and task lifecycle truth.
- `feature-tracker` sourced runner items are mirrors, not owner records.

Implications:

- the runner may ingest and mirror source state
- the runner may not archive or close tracker-sourced items by itself
- tracker closeout must be reflected into runner state through source refresh

## Fail-Closed Rules

- multiple active `in_progress` items are an error
- legacy tracker layouts are an error
- invalid checkpoint stage is an error
- invalid status or resolution combinations are an error
- duplicate active/archive item ids are an error

These are invariants, not policy toggles.

`policy.json` is reserved for lightweight runner-safety behavior that may be
adjusted without changing ownership or state semantics.

## Policy Contract

`policy.json` currently uses schema `bagakit/flow-runner/policy/v2`.

Supported fields:

- `safety.snapshot_before_session`
- `safety.checkpoint_before_stop`
- `safety.persist_state_before_stop`

These fields tune session safety only.

They do not redefine ownership, archive authority, or source-of-truth rules.

## Recipe Contract

`recipe.json` currently uses schema `bagakit/flow-runner/recipe/v2`.

Supported fields:

- `recipe_id`
- `recipe_version`
- `stage_chain[]`

Each `stage_chain` entry must contain:

- `stage_key`
- `goal`

The recipe defines the bounded-session stage vocabulary used by item state,
checkpoint receipts, and next-action payloads.

## Payload Rule

Hosts should trust:

- `state.json`
- `next-action.json`
- `resume-candidates.json`
- checkpoint and progress receipts

Hosts should not infer authority from raw command stdout beyond those payloads.

## Ownership Overlay Rule

For `feature-tracker` sourced items:

- source refresh may update source-derived fields only
- source refresh may explicitly close runner-local incidents when tracker closeout
  becomes authoritative
- runner-local incidents may temporarily keep an item blocked until they are
  resolved
- source closeout still wins over runner-local liveliness

Source-derived fields are:

- `title`
- `source_ref`
- the mirror lifecycle baseline derived from feature-tracker status

Runner-owned fields for tracker-sourced items are:

- `current_stage`
- `current_step_status`
- `runtime.*`
- `steps[]`
- checkpoint, progress, plan-revision, incident, handoff, and snapshot sidecars

## Runner-Owned Item Rule

For items whose `source_kind` is not `feature-tracker`:

- the runner owns live state and archive closeout
- `archive-item` is the only closeout command that moves the item into `archive/`
- `next-action.json` may recommend closeout, but it does not archive by itself
