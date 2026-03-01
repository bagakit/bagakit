# Selector Usage Guidance

Use this note when deciding whether a piece of work should explicitly go through
`bagakit-skill-selector`.

This note is maintainer guidance, not a runtime hard gate.

## First Principle

`bagakit-skill-selector` exists to improve task-level skill choice,
composition visibility, and execution evidence.

It does not exist to wrap every tiny action in ceremony.

## Default Rule

For substantial tasks, default to considering selector preflight first.

Substantial usually means at least one of:

- the task is likely to take multiple concrete steps
- the task may need more than one skill or tool
- the task has non-trivial quality or evidence expectations
- the task may benefit from explicit comparison, retry discipline, or
  composition logging

For trivial work, do not force selector overhead.

Trivial usually means:

- one obvious single-step action
- no meaningful multi-skill decision
- no real need to preserve task-local telemetry

## Practical Rule

Ask one simple question:

- would this task benefit from explicit preflight, usage evidence, or
  composition visibility?

If yes, use selector.
If no, act directly.

## Boundary Rule

Selector owns:

- task-level or host-level skill choice
- explicit multi-skill composition
- task-local retry/backoff telemetry
- task-local ranking and repeated-failure evidence

Selector does not own:

- repository-level promotion decisions
- durable repository evolution memory
- long-lived topic state across many sessions

Those belong to:

- `bagakit-skill-evolver`

## Legacy Absorption Rule

Legacy `bagakit-skill-evolve` features that are still task-local should migrate
into selector, not evolver.

Good selector-side examples:

- skill planning
- usage evidence
- feedback and benchmark telemetry
- repeated failure clustering
- task-local skill ranking

Do not promote those directly into evolver unless they have already been
compressed into reusable repository learning.
