# Review Packet Contract

This document defines the shared Bagakit shape for paired or independent review
packets.

It is not a new runtime surface. Each skill decides when a packet is required
and stores the packet in that skill's normal output location.

## Purpose

Bagakit uses review packets when a result needs another agent or reviewer to
judge it without relying on chat memory.

Use a packet when at least one condition holds:

- independent review can catch a material failure
- two reviewers need disjoint ownership
- a warning, deviation, or counterevidence decision may outlive the session
- the output is high-impact enough that "looks good" is not sufficient

Do not use a packet for trivial one-step work.

## Required Fields

Every packet must include:

- `packet_id`
  - short stable id for the review packet
- `skill`
  - skill id that owns the packet
- `objective`
  - what the reviewer is being asked to decide
- `review_scope`
  - artifacts, files, screenshots, reports, or source refs the reviewer may use
- `out_of_scope`
  - what the reviewer must not judge or mutate
- `owner`
  - author or operator role that produced the candidate
- `reviewer_role`
  - reviewer type or role, not a machine-local identity
- `verdict`
  - one of `pass`, `conditional`, `fail`, `blocked`, or `not_reviewed`
- `evidence_refs`
  - repo-relative paths, logical artifact names, or external source ids
- `counterevidence`
  - conflicting evidence, missing evidence, or `none`
- `accepted_deviations`
  - warnings or deviations accepted with rationale, or `none`
- `rejected_deviations`
  - warnings that require repair or regeneration, or `none`
- `confidence`
  - one of `high`, `medium`, `low`, or `unknown`
- `unresolved_risks`
  - remaining risks and owner, or `none`
- `next_action`
  - deterministic next action after the review

## Paired Review Fields

When two or more reviewers are used, add:

- `reviewer_ownership`
  - each reviewer role and the artifacts or dimensions they own
- `merge_rule`
  - how conflicting verdicts are resolved
- `synthesis_artifact`
  - final aggregation artifact path or `none`

## Counterevidence Rule

Recommendation-bearing reviews must record counterevidence explicitly.

`counterevidence: none` is acceptable only when the reviewer checked for
conflicting evidence and did not find any material conflict.

## Path Rule

Durable packets must not store machine-local absolute paths. Use repo-relative
paths, logical artifact names, external source ids, or placeholders.

## Template

```markdown
# Review Packet

## Identity

- packet_id:
- skill:
- objective:
- owner:
- reviewer_role:
- verdict: `pass|conditional|fail|blocked|not_reviewed`
- confidence: `high|medium|low|unknown`

## Scope

- review_scope:
- out_of_scope:

## Evidence

- evidence_refs:
- counterevidence:

## Deviation Decisions

- accepted_deviations:
- rejected_deviations:

## Paired Review

- reviewer_ownership:
- merge_rule:
- synthesis_artifact:

## Risks And Next Action

- unresolved_risks:
- next_action:
```

## Boundary

This contract defines review packet shape only.

It does not define:

- whether a skill must use paired review for every task
- subjective scoring rubrics
- release-blocking policy
- where a skill stores its normal output artifacts
