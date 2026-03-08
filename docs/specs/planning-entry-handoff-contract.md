# Planning Entry Handoff Contract

This document defines the stable normalized exchange contract for one
planning-entry handoff.

## Purpose

Use this contract when one upstream planning surface has reduced ambiguity far
enough that downstream planning or execution surfaces need a compact,
machine-readable handoff instead of relying on free-form prose alone.

The contract exists to keep five things true at the same time:

- clarification and approval state can become durable exchange data
- brainstorm artifacts do not become hidden planning truth by accident
- feature-tracker can consume one approved planning handoff without scraping
  arbitrary markdown
- flow-runner does not bypass canonical planning truth
- the exchange remains smaller than the full raw discussion history

## First Principle

The planning-entry handoff is a bridge surface, not a new planning owner.

That means:

- the handoff owns normalized exchange data for one route boundary
- it does not replace raw brainstorm evidence
- it does not replace canonical tracker truth
- it does not replace canonical flow-runner truth

## Scope

This contract covers:

- normalized downstream-trustable planning-entry exchange fields
- approval and clarification readiness fields
- route recommendation fields
- source-trace fields back to upstream artifacts

This contract does not define:

- raw brainstorm transcript storage
- feature-tracker task truth
- flow-runner work-item truth
- host orchestration behavior

Those remain owned by:

- `bagakit-brainstorm`
- `bagakit-feature-tracker`
- `bagakit-flow-runner`
- outer-driver surfaces such as `dev/agent_loop/`

## Ownership Model

Boundary split:

- `bagakit-brainstorm`
  - owns ambiguity reduction, question capture, expert review, and durable raw
    discussion evidence
- planning-entry handoff
  - owns one normalized exchange packet that downstream surfaces may trust
- `bagakit-feature-tracker`
  - owns canonical planning truth after the handoff is materialized
- `bagakit-flow-runner`
  - owns canonical bounded execution truth after planning truth already exists

## Conventional Exchange Surface

When a repository chooses one conventional runtime path for this contract,
Bagakit should prefer:

- `.bagakit/planning-entry/handoffs/<handoff-id>.json`

Rules:

- the path is the conventional exchange surface for this contract
- the payload remains valid even if a temporary tool writes it elsewhere during
  migration
- downstream consumers should reason about the payload shape, not about one
  tool-specific filename convention

## Payload Contract

Current schema token:

- `bagakit/planning-entry-handoff/v1`

Current normalized payload shape:

```json
{
  "schema": "bagakit/planning-entry-handoff/v1",
  "handoff_id": "peh-new-feature-routing",
  "status": "approved",
  "producer_surface": "bagakit-brainstorm",
  "title": "Create canonical planning truth for the clarified feature request",
  "goal": "Turn one approved planning-entry handoff into canonical feature-tracker state.",
  "objective": "Turn one clarified request into canonical planning truth.",
  "demand_summary": "The request still needed structured clarification before feature creation.",
  "success_criteria": [
    "Canonical planning truth can be created without scraping brainstorm prose."
  ],
  "constraints": [
    "Do not create a second planning SSOT."
  ],
  "clarification_status": "complete",
  "discussion_clear": true,
  "user_review_status": "approved",
  "recommended_route": {
    "scene": "ambiguous_delivery",
    "recipe_id": "planning-entry-brainstorm-to-feature"
  },
  "source_artifacts": [
    ".bagakit/brainstorm/archive/brainstorm-new-feature/input_and_qa.md",
    ".bagakit/brainstorm/archive/brainstorm-new-feature/expert_forum.md",
    ".bagakit/brainstorm/archive/brainstorm-new-feature/outcome_and_handoff.md"
  ],
  "source_refs": [
    "input_and_qa.md#Q-001",
    "expert_forum.md#Decision-Target-And-Exit",
    "outcome_and_handoff.md#Outcome-Summary"
  ]
}
```

Required fields:

- `schema`
- `handoff_id`
- `status`
- `producer_surface`
- `title`
- `goal`
- `objective`
- `demand_summary`
- `success_criteria[]`
- `constraints[]`
- `clarification_status`
- `discussion_clear`
- `user_review_status`
- `recommended_route.scene`
- `recommended_route.recipe_id`
- `source_artifacts[]`
- `source_refs[]`

Normalized handoffs intentionally omit action-time fields.

## Field Rules

### `status`

Allowed values:

- `draft`
- `approved`
- `superseded`
- `applied`
- `rejected`

Meaning:

- `draft`
  - the normalized handoff exists but is not yet safe for downstream
    materialization
- `approved`
  - the handoff is ready for downstream materialization
- `superseded`
  - a newer handoff replaced this one
- `applied`
  - downstream planning truth has already been materialized from this handoff
- `rejected`
  - the handoff should not drive downstream materialization

### `producer_surface`

Current intended producer:

- `bagakit-brainstorm`

This field is explicit so later Bagakit planning surfaces can produce the same
contract without changing the meaning of the handoff itself.

### `clarification_status`

Allowed values currently mirror the upstream clarification lifecycle:

- `pending`
- `in_progress`
- `complete`
- `blocked`

Downstream trust rule:

- `clarification_status` must be `complete` before downstream materialization
  treats the handoff as ready

### `discussion_clear`

Meaning:

- whether upstream review converged enough for handoff

Downstream trust rule:

- `discussion_clear` must be `true` before downstream materialization treats
  the handoff as ready

### `user_review_status`

Allowed values:

- `pending`
- `approved`
- `changes_requested`

Downstream trust rule:

- `user_review_status` must be `approved` before downstream materialization
  treats the handoff as ready

### `recommended_route`

`recommended_route.scene` must use one scene from:

- `docs/specs/selector-planning-entry-routes.md`

`recommended_route.recipe_id` should use one standard planning-entry recipe id
when a standard route applies.

Current standard recipe ids include:

- `planning-entry-brainstorm-only`
- `planning-entry-brainstorm-to-feature`
- `planning-entry-feature-to-flow`
- `planning-entry-brainstorm-feature-flow`

## Trust Rule

Downstream planning surfaces may trust:

- `title`
- `goal`
- `objective`
- `demand_summary`
- `success_criteria`
- `constraints`
- `clarification_status`
- `discussion_clear`
- `user_review_status`
- `recommended_route`
- `source_artifacts`
- `source_refs`

They must not treat:

- unrelated brainstorm prose outside the normalized handoff
- raw transcript fragments
- tool stdout

as replacement control-plane truth.

## Materialization Rule

`bagakit-feature-tracker` may materialize canonical planning truth from a
planning-entry handoff only when all of these are true:

1. `status = approved`
2. `clarification_status = complete`
3. `discussion_clear = true`
4. `user_review_status = approved`

After successful materialization:

- downstream tooling may update the handoff `status` to `applied`
- tracker truth becomes canonical planning truth
- the handoff remains an exchange record, not the new owner

## Execution Boundary Rule

`bagakit-flow-runner` must not treat the planning-entry handoff as a
replacement for canonical planning truth.

Allowed direction:

- handoff -> tracker truth -> flow-runner execution truth

Forbidden direction:

- handoff -> flow-runner execution truth while bypassing canonical planning
  truth for routes that require tracker ownership

## Supersession Rule

If a newer handoff replaces an older one for the same demand:

- the older handoff should move to `status = superseded`
- downstream consumers should prefer the newer `approved` handoff
- source trace should remain intact for both payloads

## Non-Goals

This contract does not standardize:

- one generic checklist format
- brainstorm raw-log structure
- tracker task decomposition
- flow-runner checkpoint payloads
- host-side driver payloads

Those belong to their own contracts.
