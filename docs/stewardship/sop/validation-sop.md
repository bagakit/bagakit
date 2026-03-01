# Validation SOP

## Purpose

This SOP explains how to add or extend repository validation without collapsing
tool semantics, skill semantics, and framework mechanics into one place.

## Default Procedure

1. Decide whether the new check is release-blocking validation or non-gating
   evaluation.
2. If it is release-blocking, place it under `gate_validation/`.
3. If it is informative, comparative, or benchmark-oriented, place it under
   `gate_eval/`.
4. Register new validation through one `validation.toml` under the matching
   `gate_validation/` subtree.
5. Prefer built-in validator runners first.
6. Only add a script extension when the built-in runners are clearly not enough.

## Path Selection

Use these path rules:

- repo backbone rules -> `gate_validation/backbone/`
- maintainer tool validation -> `gate_validation/dev/<tool-id>/`
- skill validation -> `gate_validation/skills/<family>/<skill-id>/`

Do not place release-blocking validation scripts inside `dev/` or `skills/`
unless that script is also a real runtime dependency of the owning skill.

User-facing command-language target:

- `gate validate`
- `gate eval`

Implementation remains under `dev/validator/`.

## Preferred Progression

Prefer this order:

1. `validation.toml` with built-in `fs`
2. `validation.toml` with built-in `command`
3. a helper script under the same `gate_validation/` subtree, called by a
   `command` suite

Avoid reaching immediately for ad hoc files like:

- `validate.sh`
- `validation.py`
- `check_repo.py`

Those patterns are acceptable only when the validator framework boundary is
insufficient and the owning registration still lives under `gate_validation/`.

## Steward Rule

When adding a validation extension:

- keep the framework generic
- keep repo-owned semantics in `gate_validation/backbone/`
- keep tool- or skill-specific semantics out of `dev/validator/`
- keep eval assets out of `gate_validation/`
- keep compatibility logic out of the validation architecture
