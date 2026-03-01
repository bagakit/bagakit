# Selector Driver Contract

This document defines the stable contract that lets one Bagakit skill expose
selector-loadable reporting guidance for task loops driven by
`bagakit-skill-selector`.

## Purpose

The contract exists to keep three things true at the same time:

- Bagakit keeps the control plane under `.bagakit/skill-selector/`
- skills can still declare their own task-reporting guidance explicitly
- selector-loaded reporting rules do not hide inside prose-only instructions
- task-local reporting guidance does not get confused with repository-level
  evolver decision or promotion control
- selector-loaded guidance stays inside one task loop instead of becoming a
  repository policy surface

## Frontmatter Declaration

A Bagakit skill may declare a selector driver file in `SKILL.md` frontmatter:

```yaml
metadata:
  bagakit:
    selector_driver_file: references/selector-driver.toml
```

Rules:

- the field is optional
- the value must be a skill-root-relative path
- the resolved path must stay inside the owning skill directory
- Bagakit-namespaced skills may use this field to expose selector-loadable
  reporting rules
- if the field is absent, selector should treat that skill as having no extra
  driver payload

## Driver File Format

The declared driver file must be TOML.

Required fields:

```toml
version = 1
insert_target = "bagakit_footer"
summary_line = "- SkillArea: <deterministic footer line>"
```

Optional fields:

```toml
retry_backoff_threshold = 3

[[directive]]
id = "TOKEN"
when = "condition text"
instruction = "what to add or change in the [[BAGAKIT]] block"
```

Rules:

- `insert_target` currently allows only `bagakit_footer`
- `summary_line` is one concrete line intended for insertion inside the
  `[[BAGAKIT]]` block
- `[[directive]]` entries are short conditional reporting rules for the same
  block
- `retry_backoff_threshold` is optional and is only meaningful for skills that
  want selector-visible retry discipline
- the file must remain installable as part of the skill payload
- directives may shape task-local reporting or retry discipline only
- the file must not encode evolver topic creation, repository routing, or
  durable promotion policy
- `retry_backoff_threshold` is reserved for `bagakit-skill-selector` itself;
  peer skills must not try to override selector's backoff control

## Selector Loading Rules

When `bagakit-skill-selector` loads drivers for one task:

1. inspect planned local skills from the task log
2. read each skill's `SKILL.md` frontmatter
3. if the skill is Bagakit-namespaced and declares
   `metadata.bagakit.selector_driver_file`, load that file
4. render the loaded rules into a task-local driver pack

This loading path is task-local only.
It must not become a second control plane for:

- repository-level promotion routing
- evolver topic state
- durable repository decision memory
- blanket "every task must use selector" policy

Selector is allowed to skip:

- non-Bagakit skills
- non-local candidates
- skills with no selector driver declaration

## Failure Rules

- a driver path that escapes the owning skill directory is invalid
- an invalid TOML driver file must fail the selector driver load
- missing declaration is a no-op, not an error
- repo-level stable meaning belongs in this spec, not in per-skill prose
