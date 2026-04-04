# Principle Layer Contract

This spec defines the shared Bagakit rule for preserving intent before
behavior recipes.

It is a workflow and documentation contract, not a model-training method.

## Purpose

Use this contract when one Bagakit output is meant to influence later choices,
skill behavior, feature planning, or shared knowledge beyond the current turn.

The goal is to keep the next operator from inheriting only examples of what to
do, while losing the reason the behavior should transfer.

## Boundary

This contract owns:

- shared vocabulary for intent-bearing records
- minimum fields for principle-layer handoff
- transfer-check discipline before broad claims
- adoption guidance for Bagakit harness skills

It does not own:

- task-local selector schema
- researcher source-card schema
- feature-tracker lifecycle state
- living-knowledge path protocol
- model training, preference optimization, or hosted evaluation

Owning skills may implement this contract through their existing artifact
shapes instead of adding a new runtime surface.

## Principle Layer

A principle layer is the intent-bearing layer that should exist before a
behavior recipe when the result is expected to generalize.

It records:

- `what`
  - the target value, behavior, capability, or decision principle
- `why`
  - the reason this behavior matters, including the problem or conflict it
    resolves
- `intended_generalization`
  - the situations where the principle should transfer
- `failure_boundary`
  - the situations where it should not transfer, where it is risky, or where it
    remains a non-goal
- `behavior_examples`
  - examples, commands, task patterns, or output shapes that show how the
    principle appears in practice
- `transfer_checks`
  - near-miss, counterexample, out-of-distribution, or regression checks that
    would reveal shallow imitation
- `evidence_refs`
  - source, claim, task, validation, or decision refs that justify the record

The field names above are canonical vocabulary. A skill may use local headings
or TOML keys, but the meaning must stay mappable to this list.

## When Required

Apply the principle layer when any of these are true:

- a feature request will drive implementation across more than one task
- a selector lesson may affect future skill choice
- a researcher synthesis makes a Bagakit-facing inference from source evidence
- a brainstorm or spark outcome becomes a handoff, snapshot, or feature input
- a living-knowledge page records a reusable norm or decision
- an evolver topic promotes a lesson into specs, skills, gates, evals, or
  stewardship docs

For trivial one-step work, do not add ceremony. A sentence that clearly names
the `why` and boundary is enough.

## Evidence Discipline

Separate three things:

- observed source claims
- Bagakit-facing inferences
- chosen behavior recipes

Do not present a behavior example as proof that the principle transfers.

Before claiming broad transfer, include at least one transfer check that is not
just another example of the preferred behavior.

Good transfer checks include:

- a near-miss where the surface action looks similar but the reason differs
- a counterexample where the principle should not apply
- a stale or conflicting prior decision that the principle must handle
- an out-of-distribution task that tests whether the `why` survives a new
  setting

## Skill Adoption

`bagakit-skill-evolver`:

- record the principle layer in candidate and decision rationale before
  promotion
- promotions should cite evidence refs and name transfer limits

`bagakit-skill-selector`:

- record why selected and rejected candidates differ
- selection lessons should state intended generalization and failure boundary

`bagakit-researcher`:

- keep source-bound claims separate from Bagakit-facing inferences
- synthesis should name why the inference transfers and where it may fail

`bagakit-brainstorm`:

- handoffs should preserve the problem reason, success principle, non-goals,
  and checks instead of only the recommended option

`bagakit-spark`:

- accepted snapshots should include the user's reason for acceptance, the
  principle under the decision, and portability boundaries when they affect
  later work

`bagakit-living-knowledge`:

- reusable norms should carry why, intended reuse, and failure boundaries
  before becoming shared truth

`bagakit-feature-tracker`:

- non-trivial feature proposals should distinguish acceptance criteria from
  rationale, intended generalization, non-goals, and verification checks

## Promotion Rule

A principle-layer record can guide local execution when it is clear enough for
the next operator to act.

It can justify a durable repository change only when it also has:

- evidence refs
- explicit failure boundaries
- at least one transfer check when a broad or reusable claim is made

Higher capability claims still follow
`docs/specs/canonical-capability-ladder.md`.
