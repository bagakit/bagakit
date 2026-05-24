# Evolver Skill Promotion Review

This specification defines the model-fit review required before Evolver
accepts a durable `skill` promotion for landing.

## First Principle

A skill promotion should give the target model only the structure that still
protects a real boundary or measured failure.

The review must distinguish:

- work the target model can own, such as intermediate planning, context
  selection, or flexible tool orchestration
- work the harness must own, such as authority, durable state, isolation,
  verification, recovery, or irreversible-action boundaries

The goal is not minimum text or minimum code by itself. The goal is the lowest
stable harness entropy that preserves the intended behavior and proof.

## Scope

This contract applies only to Evolver promotions with `surface = skill`.

It does not apply to:

- `spec` or `stewardship` promotions
- task-local Selector decisions
- exploratory Researcher evidence
- skill implementation or scaffolding
- model training or hidden chain-of-thought inspection

Evolver owns the review record and readiness decision. The target skill owner
still owns design and implementation.

## Topic State

A skill promotion may carry one `model_fit_review` object:

- `disposition`
  - `passed`
  - `blocked`
- `reviewed_promotion_hash`
  - deterministic digest of the reviewed promotion surface, target, and
    summary
  - used to make semantic invalidation enforceable even after direct state
    edits
- `model_floor`
  - concise description of the model class or capability floor used for the
    review
  - model names are evidence, not permanent enums
- `model_owned`
  - bounded statement of the flexible reasoning or orchestration left to the
    model
- `harness_owned`
  - bounded statement of the hard boundaries retained in the skill or harness
- `entropy_disposition`
  - `reduced`
  - `neutral`
  - `increased_with_evidence`
- `entropy_rationale`
  - bounded explanation of removals, retained structure, or justified new
    structure
- `obsolete_compensation_disposition`
  - `removed`
  - `retained_with_evidence`
  - `none_found`
- `evidence_refs[]`
  - one or more unique repo-relative refs supporting the review
- `reviewed_at`
  - review timestamp

The record is embedded in the existing promotion object. It does not create a
new runtime surface or a second promotion control plane.

## Transition Rule

A skill promotion may be proposed without a model-fit review.

Before it moves to `accepted_for_landing` or `landed_verified`:

- the review must exist
- `disposition` must be `passed`
- every evidence ref must resolve to a current file

Changing the promotion's `surface`, `target`, or `summary` invalidates the
prior review. The stored semantic digest must match during validation,
readiness, and archive. Status, landing-ref, or proof-ref updates do not
invalidate it when the reviewed intent is unchanged.

A `blocked` review preserves the decision and evidence but cannot authorize
landing.

## Evidence Rule

The review should use the smallest proof-bearing evidence set available.

Good evidence includes:

- representative skill eval or validation output
- current model-owner guidance preserved through a source-bound local artifact
- a before/after prompt, context, schema, token, cost, or intervention measure
- a reproduced failure showing why retained harness structure is necessary

Researcher workspaces may be cited but are not required. Evolver must remain
self-contained when no Researcher workspace exists.

The review does not prove that one model or architecture is universally best.
It proves only that the proposed skill boundary is justified for the named
model floor and evidence set.

## Derived Artifact Rule

Evolver reports, handoffs, readiness output, and archive receipts should expose
the model-fit disposition and entropy decision for skill promotions.

These views remain derived from `topic.json`.
