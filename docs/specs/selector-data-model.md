# Selector Data Model

This document defines the stable Bagakit vocabulary for selector-owned
task-local selection evidence.

It is the SSOT for:

- the selector data-model layers
- the names `selection_episode`, `task_signal`, `candidate`,
  `selection_lesson`, `composition_pattern`, `candidate_result`,
  `lesson_update`, and `evolver_signal`
- how selector evidence stays useful for later repository learning without
  becoming repository-level learning itself

It is not the SSOT for:

- selector candidate visibility and availability semantics
- selector-versus-evolver authority
- exact `skill-usage.toml` field syntax
- evolver intake, routing, or promotion

Those belong respectively in:

- `docs/specs/selector-selection-model.md`
- `docs/specs/selector-evolver-boundary.md`
- `skills/harness/bagakit-skill-selector/references/skill-usage-file-spec.md`
- `docs/specs/evolver-memory.md`

## First Principle

Selector is a task-local selection evidence engine.

It should not only answer which skill was picked. It should record enough
structured evidence for the next selector pass, and for optional later evolver
review, to understand:

- why selector was needed
- what candidates were considered
- why one candidate or composition was chosen
- what result the chosen candidate produced
- how this episode changed prior task-local lessons
- whether any evidence deserves repository-level review

Selector still does not own repository-level adoption, routing, or promotion.

## Layer Model

One selector task is represented as a `selection_episode`.

```text
selection_episode
├── task_signal
├── candidate
├── selection_lesson
├── composition_pattern
├── candidate_result
├── lesson_update
└── evolver_signal
```

These layers are conceptual. One runtime file may represent more than one layer
through the same TOML table when that keeps the contract simpler.

## `selection_episode`

A `selection_episode` is one task-local selector decision loop.

It owns:

- task preflight
- task signals
- candidate planning and comparison
- explicit composition choice
- usage and result evidence
- task-local evaluation
- optional evolver review suggestions

It does not own:

- repository-level route decisions
- evolver topic state
- durable promotion decisions

Runtime mapping:

- one `selection_episode` is normally one
  `.bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml`

## `task_signal`

A `task_signal` explains why selector attention is useful for this task.

Typical kinds:

- `error`
- `capability_gap`
- `workflow_friction`
- `benchmark_gap`
- `user_preference`
- `opportunity`
- `stale_lesson`
- `abstention`

A task signal should be compact and evidence-backed.

It should identify:

- the pressure or gap
- the task cluster or repeated context when known
- the evidence reference
- the confidence of the signal

It should not store a raw transcript when a compact signal would preserve the
decision-relevant evidence.

## `candidate`

A `candidate` is one visible option selector may compare.

A candidate may be:

- one local Bagakit skill
- one external tool or skill
- one research or practice reference
- one selector recipe
- one explicit composition participant

Candidate evidence should distinguish:

- visibility
- availability
- selection
- usage

The stable visibility and availability semantics live in:

- `docs/specs/selector-selection-model.md`

Selector should preserve negative candidate evidence when it matters, including:

- why a visible candidate was rejected
- what evidence would be needed to reconsider it
- which failure mode was expected or observed

## `selection_lesson`

A `selection_lesson` is task-local reusable guidance learned from prior
selection evidence.

It says:

- when one task signal appears
- which candidate or composition has worked or failed before
- what confidence or limitation applies
- what evidence could invalidate the lesson

Selection lessons are not repository-level rules.

They may guide a later selector episode, but they become repository-level
learning only after explicit evolver review and routing.

## `composition_pattern`

A `composition_pattern` is a task-local choice to use several participants
together.

It may reference:

- a selector recipe
- a participant set
- one `composition_id`
- activation mode
- fallback strategy

Composition patterns must remain explicit.

Rules:

- `bagakit-skill-selector` is the composition entrypoint
- composed peers must remain standalone-first
- recipes recommend patterns but do not create hard dependencies

## `candidate_result`

A `candidate_result` is the verified result of using one candidate in this
episode.

The name is intentionally narrower than task result.

It should answer:

- what candidate was used
- what action it performed
- whether the candidate result was `success`, `partial`, `failed`, or
  `inconclusive`
- what verification, benchmark, or review evidence supports that result
- what feedback was observed
- what cost, latency, or effort signal matters

`candidate_result` should not replace `usage_log`.

Relationship:

- `usage_log` records that selector used or skipped one candidate for one
  action
- `candidate_result` records the verified consequence of that use when the
  result matters for future selection or evolver review

For simple tasks, one `usage_log.result` may be enough.
Use an explicit `candidate_result` shape when future selection needs stronger
evidence than `usage_log` can carry cleanly.

## `lesson_update`

A `lesson_update` records how one episode changes a prior selection lesson.

Typical actions:

- `confirm`
- `weaken`
- `invalidate`
- `supersede`
- `abstain`

Use `lesson_update` when selector evidence shows that a prior lesson should no
longer influence future selection in the same way.

This protects selector from becoming a stale advice store.

## `evolver_signal`

An `evolver_signal` is a task-local suggestion that evidence may deserve
repository-level review.

Selector may produce it when evidence crosses a threshold such as:

- repeated failure
- repeated positive result in one task cluster
- failed benchmark
- negative feedback
- stale lesson invalidation
- manual review

An `evolver_signal` is not:

- a route decision
- an evolver topic
- a promotion

The bridge and authority rules live in:

- `docs/specs/selector-evolver-boundary.md`

## Evaluation Implications

Selector evaluation should test whether the data model improves future task
selection.

Useful eval dimensions:

- acquisition
  - did selector capture the right task signal before execution
- selection impact
  - did prior selector evidence improve a later candidate choice
- negative evidence
  - did selector avoid a candidate with relevant prior failure evidence
- update and conflict
  - did contradictory feedback weaken or supersede a prior lesson
- selective forgetting
  - did stale lessons stop influencing selection
- abstention
  - did selector avoid confident reuse or escalation when evidence was weak
- cost
  - did collection overhead stay proportionate to the avoided failure

Recall of prior logs is not enough to prove selector evidence quality.
