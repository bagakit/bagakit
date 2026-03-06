# Bagakit Driver Maintenance

Use this note when maintaining Bagakit driver files for runtime skills.

The stable contract lives in:

- `docs/specs/bagakit-driver-contract.md`

This note is only for maintainer practice.

## Maintainer Rule

When one Bagakit skill wants Bagakit footer-driving guidance:

- keep the runtime payload inside the skill directory
- place the file at the conventional path:
  - `references/bagakit-driver.toml`
- let current consumers such as `bagakit-skill-selector` load and render the
  task-local driver pack instead of copying the same guidance into task prose
  by hand
- treat the driver as guidance after a consumer is already in use, not as a
  rule that every task must invoke that consumer

## Writing Rule

Keep Bagakit driver files narrow.

Good driver files contain:

- one footer summary line for `[[BAGAKIT]]`
- a few conditional directives at most
- deterministic placeholders instead of long narrative guidance

Do not put these into the driver file:

- full runbooks
- maintainer-only rationale
- repository-level stable semantics
- evolver promotion or decision rules
- policy about when the repository must open evolver topics

Put them in the right owning surface instead:

- full runbooks or maintainer-only rationale
  - `docs/stewardship/`
- repository-level stable semantics
  - `docs/specs/`
- evolver promotion or decision rules
  - evolver-owned specs and runtime surfaces, not Bagakit drivers

## Sync Rule

When a skill changes its task-reporting contract:

- update the skill prose and the Bagakit driver file in the same change
- if a skill no longer needs Bagakit footer-driving guidance, remove the
  conventional driver file instead of leaving a stale payload behind

## Selector-Owned Retry Discipline

`bagakit-skill-selector` itself owns the retry/backoff reporting rule for task
loops.

Peer skill driver files must not override selector's retry threshold.

Maintainer expectation:

- repeated concrete work should be grouped by `attempt_key`
- retries after the first one should surface a visible `try-<n>` count
- when the same attempt key reaches the configured threshold without success,
  selector should force a step-back and method change instead of silent
  repetition

If that rule changes:

- update the selector Bagakit driver file
- update the selector skill docs and task-log spec
- update the smoke validation that exercises retry backoff
