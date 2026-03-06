# Canonical Capability Ladder

This document defines the capability-claim ladder for the canonical Bagakit
skills monorepo.

Purpose:

- give one shared meaning to capability claims
- prevent vague claims such as "advanced" or "leading"
- separate minimum onboarding from comparative strength and system flywheel

## Scope Rule

Every claim must name its scope:

- repository
- family
- installable skill source

Rules:

- a higher claim inherits the lower claim requirements
- do not claim a higher level without the required evidence
- if evidence becomes stale or contradictory, downgrade the claim

## Graduation

`graduation` is the minimum bar for calling a repository surface canonically
onboarded.

Required evidence:

- canonical identity is discoverable through the directory protocol under
  `skills/<family>/<skill-id>/` with `SKILL.md`
- required validation and smoke checks pass
- link and package behavior work from the canonical directory-is-payload model
- docs and gates do not disagree on onboarding status

Typical failures:

- documentation says onboarding is incomplete while the gate still passes
- packaging or install only works through compatibility-only entrypoints

## Frontier

`frontier` means graduation is already satisfied and Bagakit wins against a
named comparison set on a shared benchmark.

Required evidence:

- the comparison set is explicit
- the benchmark task set is explicit
- primary metrics are explicit before the run
- repeated benchmark runs show Bagakit ahead on the chosen primary metrics
- known loss cases are recorded instead of hidden

Evidence placement:

- benchmark assets belong under `gate_eval/`
- durable benchmark observations and claim rationale belong under
  `mem/benchmarks/`

Claim rule:

- do not call something `frontier` based on anecdote, one-off demos, or
  unstated competitors

## Flywheel

`flywheel` is Bagakit shorthand for "far beyond frontier."

`flywheel` means frontier is already satisfied and the system improves itself in
repeated cycles.

Required evidence:

- important failures or benchmark misses are converted into shared improvements
- those improvements land in at least one of:
  - `docs/specs/`
  - `gate_validation/`
  - `gate_eval/`
  - reusable maintainer tooling under `dev/`
- later review rounds show measurable benefit from those improvements
- adding one installable skill source or one resolved failure improves future work beyond
  the local case

Claim rule:

- do not call something `flywheel` unless the feedback loop has already been
  observed, not merely planned

## Evidence Freshness

`graduation` stays valid only while the required gates and metadata remain
consistent.

`frontier` and `flywheel` should be re-reviewed after major changes to any of
the following:

- benchmark task set
- comparison set
- packaging or install model
- validation architecture
- skill runtime contract

## Related Procedures

- maintainer review procedure:
  - `docs/stewardship/sop/capability-review-sop.md`
