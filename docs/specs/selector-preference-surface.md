# Selector Preference Surface

This document defines the stable Bagakit meaning of project-local selector
preference hints.

## Purpose

Use this spec when deciding:

- what `.bagakit/skill-selector/project-preferences.toml` is allowed to express
- how project-local preference hints differ from task-local selector evidence
- why selector may read these hints without turning them into repository policy

This file is the SSOT for:

- the purpose of selector project-preference hints
- the ownership boundary of the preference file
- the rule that preference hints remain host-local and non-authoritative

It is not the SSOT for:

- task-local selector logs
- repository-level evolution memory
- ranking math
- evolver routing or promotion

Those belong respectively in:

- `skills/harness/bagakit-skill-selector/references/skill-usage-file-spec.md`
- `docs/specs/selector-evolver-boundary.md`
- runtime selector reports
- evolver-owned specs

## First Principle

Project-local selector preferences are optional host-local hints.

They exist to answer a small question:

- in this host or project, which candidates are usually worth preferring or
  avoiding when fit is otherwise comparable

They do not answer:

- which candidate is correct for every task
- which candidate is available in the current host
- which conclusion deserves repository-level promotion

## Runtime Surface

The optional preference file lives at:

- `.bagakit/skill-selector/project-preferences.toml`

The file is:

- host-local
- optional
- selector-readable
- manually maintained

The file is not:

- repository-level policy
- evolver topic memory
- a required repository artifact
- an automatically learned cache

Missing file rule:

- if the file is absent, selector should treat that as a no-op

## Allowed Meaning

The file may express coarse hints such as:

- prefer this skill in this host when it fits
- avoid this skill in this host unless there is a concrete reason

These hints are advisory only.

Selector may use them to:

- annotate candidate survey output
- bias shortlist ordering in a derived report
- explain why one candidate deserves closer comparison

Selector must not use them to:

- claim one task is already decided
- override explicit task-local availability evidence
- alter ranking math derived from execution evidence
- create evolver signals or promotion claims

## Boundary Rule

Preference hints stay outside task SSOT on purpose.

Task-local truth still belongs in:

- `.bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml`

That file records:

- explicit candidate planning
- explicit availability judgment
- actual usage
- actual feedback and task-local evaluation

The preference file stays narrower:

- only coarse host-local hints

That keeps selector DRY without creating split task truth.
