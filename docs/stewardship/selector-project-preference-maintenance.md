# Selector Project Preference Maintenance

Use this note when maintaining `.bagakit/skill-selector/project-preferences.toml`.

The stable meaning of this surface lives in:

- `docs/specs/selector-preference-surface.md`

## Maintainer Rule

Keep project-local selector preferences:

- optional
- coarse
- manually curated

Good entries say:

- this host usually prefers one skill when fit is comparable
- this host usually avoids one skill unless there is a specific reason

Bad entries try to say:

- every task must use this skill
- this repository has now decided the permanent policy
- this hint should promote itself into evolver

## Writing Rule

Prefer exact stable skill ids.

Keep reasons short and concrete.

Avoid:

- score weights
- policy DSLs
- route decisions
- hidden mandatory defaults

## Review Rule

When a preference hint starts doing too much, move the real decision to the
right owning surface:

- task-local decision
  - `skill-usage.toml`
- repository-level learning
  - evolver-owned surfaces
- stable shared semantics
  - `docs/specs/`
