# Selector And Evolver Boundary

This document defines the stable Bagakit boundary between
`bagakit-skill-selector` and `bagakit-skill-evolver`.

The goal is to keep task-local skill usage evidence from being confused with
repository-level learning and promotion control.

## Purpose

Use this spec when deciding:

- whether a finding is still task-local evidence or already repository-level
  learning
- whether recipes or selector drivers are staying inside task-local scope
- where task-level selection and evaluation belong

This file is the SSOT for stable meaning of that split.

It is not the SSOT for:

- full cross-layer flow design
- maintainer operating procedure
- runtime command examples

Those belong respectively in:

- `docs/architecture/`
- `docs/stewardship/`
- `skills/harness/bagakit-skill-selector/`

## First-Principles Split

| Surface | Primary question | Owns | Does not own |
| --- | --- | --- | --- |
| `bagakit-skill-selector` | "Do we have enough skill coverage for this task, and what actually happened when we tried it?" | task-local or host-local coverage preflight, candidate planning, explicit composition, usage evidence, task-local evaluation, task-local recipes, selector-loaded drivers | repository-level decision memory, durable promotion routing, repository-level handoff/archive artifacts, evolver topic state |
| `bagakit-skill-evolver` | "Which lessons are reusable at repository scope, and what route and durable surface should they take?" | repository-level topic memory, candidate comparison, routing decisions, decision memory, promotion routing, promotion state, durable promotion preparation, repository-level handoff/archive artifacts | raw per-task selector logs, task-local composition control, mandatory wrappers around ordinary work |

The split is about authority, not importance.

Task-level evidence is often the input to later repository learning, but that
does not make task logs part of evolver.

## Selector Preflight Concept

Selector preflight is the task-local coverage check that happens before major
execution when a task chooses selector.

It answers questions such as:

- is current skill coverage sufficient
- do we need explicit comparison or composition
- do we expect retries, evaluation, or evidence worth preserving

The detailed heuristic for when operators should invoke selector belongs in:

- runtime selector docs
- maintainer stewardship guidance

This spec only defines the meaning of selector preflight, not the full
operator playbook for invoking it.

## Why Task-Level Selection And Evaluation Belong To Selector

Legacy task-level skill selection and evaluation belong to selector because
they answer a different question from evolver.

Selector answers:

- which skills or references were considered for this task
- which ones were actually used
- what helped, failed, or stalled
- whether this task should stay host-local or later inform upstream work

Evolver answers:

- which lessons have repository-level value
- which candidates or decisions need durable memory beyond one task
- which durable surface should receive the promoted conclusion

If raw task-level selection and evaluation are forced into evolver, three
things go wrong:

1. repository decision memory fills with short-lived task noise
2. evolver becomes a silly wrapper around trivial or one-off work
3. task-local evaluation gets confused with repository-level promotion

So the correct flow is:

1. keep raw task-level selection and evaluation in selector
2. hand off the likely routing outcome as `host`, `upstream`, or `split`
3. only then open or update evolver when repository-level learning is real

Selector may record that later routing is likely needed.

Selector must not become the owner of:

- repository-level route decisions
- evolver promotion readiness
- repository-level handoff or archive receipts

## Recipe And Driver Rule

Selector-owned recipes and selector-loaded drivers are task-local aids.

They may define:

- standard task-local composition patterns
- task-local evidence prompts
- task-local retry or reporting guidance

They must not define:

- evolver topic creation policy
- repository-level route decisions
- repository-level promotion readiness
- durable repository decision memory
- a blanket rule that every task must use selector

Recipes and drivers live with selector because they shape one task loop at a
time, not the repository learning system as a whole.

## Authority Split

Use these surfaces in this order:

- `docs/specs/selector-evolver-boundary.md`
  - stable meaning of the selector-versus-evolver split
- `skills/harness/bagakit-skill-selector/`
  - runtime-facing selector instructions and operator usage
- `docs/stewardship/selector-recipe-maintenance.md`
  - maintainer guidance for selector recipes
- `docs/stewardship/selector-driver-maintenance.md`
  - maintainer guidance for selector drivers

If a change proposes a new selector or evolver rule, decide first whether it
is:

- stable shared meaning
- runtime skill instruction
- maintainer practice

Then place it in the matching surface instead of repeating the same rule in
all three.
