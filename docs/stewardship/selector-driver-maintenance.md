# Selector Driver Maintenance

Use this note when maintaining selector-loadable reporting rules for Bagakit
skills.

The stable contract lives in:

- `docs/specs/selector-driver-contract.md`

This note is only for maintainer practice.

## Maintainer Rule

When one Bagakit skill wants selector-aware reporting guidance:

- keep the runtime payload inside the skill directory
- declare the file in `SKILL.md` frontmatter with
  `metadata.bagakit.selector_driver_file`
- store the file as a small TOML payload, typically under `references/`
- let `bagakit-skill-selector` load and render the task-local driver pack
  instead of copying the same guidance into task prose by hand
- treat the driver as guidance after selector is already in use, not as a rule
  that every task must invoke selector

## Writing Rule

Keep selector driver files narrow.

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
  - evolver-owned specs and runtime surfaces, not selector drivers

## Sync Rule

When a skill changes its task-reporting contract:

- update the skill prose and the selector driver file in the same change
- if the frontmatter declaration changes, update the referenced path in the
  same change
- if a skill no longer needs selector-loaded reporting, remove the frontmatter
  declaration instead of leaving a stale reference

## Selector-Owned Retry Discipline

`bagakit-skill-selector` itself owns the retry/backoff reporting rule for task
loops.

Peer skill drivers must not override selector's retry threshold.

Maintainer expectation:

- repeated concrete work should be grouped by `attempt_key`
- retries after the first one should surface a visible `try-<n>` count
- when the same attempt key reaches the configured threshold without success,
  selector should force a step-back and method change instead of silent
  repetition

If that rule changes:

- update the selector driver file
- update the selector skill docs and task-log spec
- update the smoke validation that exercises retry backoff
