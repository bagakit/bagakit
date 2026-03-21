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
It must not be inferred backward from a generated DAG file.

## Dependency Projection

Current stable dependency projection:

- `.bagakit/feature-tracker/index/FEATURES_DAG.json`

Purpose:

- expose the current active feature dependency graph
- expose derived dependents
- expose pure topological layers

It should answer:

- what depends on what
- what other active features each feature unlocks
- how the active graph layers topologically
- whether the currently checked-in projection still matches canonical feature
  state

It should not answer:

- which execution mode is active
- how many items should run in parallel today
- what the current retry or scheduling policy is
- what happened in the last runtime attempt

## Execution Planning Boundary

Policy-resolved execution planning is conceptually separate from the dependency
projection.

Examples:

- chosen parallel limit
- selected batch or execution order under policy
- next runnable items under current scheduling rules

If Bagakit later stabilizes one execution-plan surface, that surface must be
defined independently instead of being added ad hoc into `FEATURES_DAG.json`.

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

## Quality Rule

A good projection boundary makes these statements true:

- truth can be edited without hand-editing the projection
- projection can be regenerated at any time
- graph-affecting commands can preflight the resulting projection before they
  perform destructive side effects
- commands that directly overwrite the current projection should also reject a
  missing DAG file or broken DAG target path up front and route recovery
  through `replan-features` while they are still mutating live feature state
- already-closed archive/discard reruns may heal a missing or malformed DAG
  path only after confirming the feature already lives in the matching closed
  directory
- already-closed archive/discard reruns do not rewrite a present schema-valid
  DAG surface just to clear drift
- if unrelated active-graph errors block recomputing a missing or malformed DAG
  surface, already-closed reruns warn and leave recovery to `replan-features`
- successful graph-affecting tracker commands refresh the current projection
- validation can detect projection drift
- validation fails when the projection file is missing instead of silently
  skipping graph checks
- users do not have to guess whether one field is graph truth or execution
  policy
