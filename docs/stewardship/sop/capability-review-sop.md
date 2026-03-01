# Capability Review SOP

This SOP defines how maintainers review `graduation`, `frontier`, and
`flywheel` capability claims for the canonical Bagakit skills monorepo.

Template:

- `docs/stewardship/capability-review-template.md`

## When To Run

Run this SOP when:

- promoting a skill into the canonical directory-protocol surface
- changing a claim level in docs or release surfaces
- asserting that a family or the repository has reached `frontier` or
  `flywheel`
- re-reviewing a claim after major benchmark, validation, or packaging changes

## Procedure

1. Name the review target.

Required fields:

- scope: `repository`, `family`, or `installable skill source`
- target id: repo name, family name, or skill id
- requested level: `graduation`, `frontier`, or `flywheel`

2. Collect the required evidence for the requested level.

Minimum checks:

- `graduation`
  - canonical directory-protocol path exists with `SKILL.md`
  - validation passes
  - package and link flow still match the directory-is-payload contract
- `frontier`
  - named comparison set exists
  - benchmark task set exists
  - primary metrics were declared before the run
  - repeated runs show a real win on the chosen metrics
- `flywheel`
  - `frontier` evidence exists
  - failures were converted into shared specs, gates, eval assets, or reusable
    tooling
  - a later round shows measurable benefit from those shared improvements

3. Record the result.

Use the repo surfaces that match the evidence:

- benchmark assets and repeatable tasks:
  - `gate_eval/`
- durable benchmark observations:
  - `mem/benchmarks/`
- durable review decisions:
  - `mem/decisions/`
- normative rule changes:
  - `docs/specs/`

4. Update durable repo surfaces only after the evidence is recorded.

Typical updates:

- runtime path or directory-protocol changes
- durable specs
- steward-facing guidance
- repo-level summaries such as `AGENTS.md` or `README.md`

5. Verify the final state.

Required baseline:

- `make validate-repo`

Add the relevant benchmark or owner-local checks when reviewing `frontier` or
`flywheel`.

## Review Outcomes

Allowed outcomes:

- approve the requested level
- keep the current lower level
- downgrade the claim because evidence is stale or contradictory

Rule:

- do not publish a higher-level claim first and collect evidence later
