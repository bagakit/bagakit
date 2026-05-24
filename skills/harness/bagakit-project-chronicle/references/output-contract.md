# Project Chronicle Output Contract

This contract defines one run at:

```text
.bagakit/project-chronicle/runs/<run-id>/
```

The root is project-local reviewable state. It does not become shared truth or
repository evolution state merely because validation passes.

## Artifact Set

```text
run.json
source-census.json
session-cards/<session-id>.json
lineage.json
cast.json
chronicle.md
evolution-ledger.json
review.json
```

Raw transcripts are forbidden inside the run.

## Evidence References

Use one of:

- `session:<session-id>#<bounded-locator>`
- a repo-relative artifact path with an optional fragment

Never persist an absolute machine path. A host-session source ref may be an
opaque host id, but reusable claims should cite a bounded session locator.

## Source Census

`source-census.json` owns the “all sessions” claim.

It contains:

- `scope.statement`
- `scope.session_definition`
- `coverage.status`
  - `open`, `complete`, or `partial`
- `coverage.adapters[]`
- `coverage.gaps[]`
- derived coverage counts
- one registration for every discovered session

`partial` requires at least one gap. `complete` requires at least one adapter
and a reason for every excluded or unreadable session.

## Session Cards

Every included session has one card containing:

- summary and intent
- observed outcomes
- turning points
- belief updates
- leverage points
- counterevidence
- evidence spans with bounded locators and claims

Cards compress evidence; they do not preserve transcripts.

## Lineage And Cast

`lineage.json` contains:

- epochs with baseline before, pressure, intervention, observed delta, baseline
  after, remaining tensions, member sessions, and evidence refs
- generation links with inheritance, mutation, ratchet, and evidence refs

`cast.json` contains roles with epithet, operational function, member session
ids, fit rationale, and evidence refs. Every included session must appear in at
least one role before final validation.

## Evolution Ledger

Each entry contains:

- `insight_id`
- `kind`
  - `success-principle`, `corrected-belief`, `quality-ratchet`,
    `friction-lever`, `cost-lever`, or `unresolved-tension`
- `epistemic_status`
  - `observed`, `inferred`, `reviewed`, or `accepted`
- `what`
- `why`
- `intended_generalization`
- `failure_boundary`
- `behavior_examples[]`
- `transfer_checks[]`
- `evidence_refs[]`
- `counterevidence_refs[]`
- `confidence`

All entries need evidence. Reviewed or accepted reusable claims need at least
one transfer check. Acceptance is a run-level editorial disposition, not
promotion authority.

## Review

`review.json` contains these gates:

- `coverage_honesty`
- `evidence_fidelity`
- `contradiction_handling`
- `epic_without_fabrication`
- `generational_delta`
- `harness_value`
- `privacy_and_retention`

Each gate is `pending`, `pass`, or `fail` with a note. Final acceptance requires
all gates to pass, a reviewer, and a rationale.

## Validation Boundary

Draft validation proves file and schema coherence.

Final validation additionally proves:

- the census is sealed
- included sessions have substantive cards
- lineage and cast cover known sessions
- generational claims cite evidence
- ledger entries preserve intent and transfer boundaries
- the chronicle has no unresolved template tokens
- review status is accepted and every gate passes

It does not prove:

- that an inaccessible host returned every historical session
- that a causal inference is universally true
- literary excellence
- permission to publish private content
- readiness for repository promotion
