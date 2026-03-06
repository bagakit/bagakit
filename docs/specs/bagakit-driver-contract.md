# Bagakit Driver Contract

This document defines the stable contract that lets one Bagakit skill expose
runtime-distributable footer-driving guidance under the shared `[[BAGAKIT]]`
anchor.

## Purpose

The contract exists to keep five things true at the same time:

- Bagakit skills may ship their own reporting guidance as part of the skill
  payload
- that guidance stays independently distributable with the skill
- the mechanism is not owned by any one consumer such as `bagakit-skill-selector`
- all Bagakit-driven footer guidance stays under the same `[[BAGAKIT]]` anchor
- task-local reporting guidance does not get confused with repository-level
  evolver control

## Runtime Convention

A Bagakit-namespaced skill may expose one driver file at the conventional path:

- `references/bagakit-driver.toml`

Rules:

- the path is optional
- if the file is absent, the skill exposes no Bagakit driver payload
- if the file exists, it is part of the runtime payload and must remain valid
- the mechanism should prefer this convention path over frontmatter declarations
- consumers may load the conventional file without introducing a second control
  plane

Current consumer:

- `bagakit-skill-selector`
  - may load these files and render one task-local driver pack

Other consumers may load the same file later, but they must preserve the same
stable meaning.

## Driver File Format

The driver file must be TOML.

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
- `retry_backoff_threshold` is optional and is only meaningful for consumers
  that support retry discipline
- the file must remain installable as part of the skill payload
- directives may shape task-local or task-reporting guidance only
- the file must not encode evolver topic creation, repository routing, or
  durable promotion policy
- `retry_backoff_threshold` remains reserved for `bagakit-skill-selector`
  because selector owns retry/backoff control

## Consumer Loading Rule

Consumers may load Bagakit driver files only as runtime guidance.

That means the loading path must not become a second control plane for:

- repository-level promotion routing
- evolver topic state
- durable repository decision memory
- mandatory selector-preflight policy for non-trivial Bagakit-shaped work

Current selector rule:

1. inspect planned local skills from the task log
2. identify Bagakit-namespaced skills
3. if `references/bagakit-driver.toml` exists under the skill root, load it
4. render the loaded rules into a task-local driver pack

Selector is still allowed to skip:

- non-Bagakit skills
- non-local candidates
- Bagakit skills with no driver file

Mandatory selector preflight for non-trivial Bagakit-shaped work is declared
through shared bootstrap/spec surfaces such as `AGENTS.md` and
`docs/specs/selector-selection-model.md`; driver files must not redefine,
weaken, or recreate that policy.

## Failure Rules

- a conventional driver path that escapes the owning skill directory is invalid
- an invalid TOML driver file must fail the current consumer's driver load
- missing file is a no-op, not an error
- repository-level stable meaning belongs in this spec, not in per-skill prose
