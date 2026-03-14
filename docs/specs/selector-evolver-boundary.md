# Selector And Evolver Boundary

This document defines the stable Bagakit boundary between
`bagakit-skill-selector` and `bagakit-skill-evolver`.

The goal is to keep task-local skill usage evidence from being confused with
repository-level learning and promotion control.

## Purpose

Use this spec when deciding:

- whether a finding is still task-local evidence or already repository-level
  learning
- whether recipes or Bagakit drivers are staying inside task-local scope
- whether repo-visible skill knowledge still belongs to selector rather than
  evolver
- how task-local repeated failures may be surfaced for repository-level review
- where task-level selection and evaluation belong

This file is the SSOT for stable meaning of that split.

It is not the SSOT for:

- selector candidate visibility or availability semantics
- full cross-layer flow design
- maintainer operating procedure
- runtime command examples

Those belong respectively in:

- `docs/specs/selector-selection-model.md`
- `docs/architecture/`
- `docs/stewardship/`
- `skills/harness/bagakit-skill-selector/`

## First-Principles Split

| Surface | Primary question | Owns | Does not own |
| --- | --- | --- | --- |
| `bagakit-skill-selector` | "Do we have enough skill coverage for this task, and what actually happened when we tried it?" | task-local or host-local coverage preflight, non-trivial task-entry preflight, repo-aware candidate discovery, candidate planning, explicit composition, usage evidence, task-local evaluation, task-local recipes, selector-loaded Bagakit drivers | repository-level decision memory, durable promotion routing, repository-level handoff/archive artifacts, evolver topic state |
| `bagakit-skill-evolver` | "Which lessons are reusable at repository scope, and what route and durable surface should they take?" | repository-level topic memory, candidate comparison, routing decisions, decision memory, promotion routing, promotion state, durable promotion preparation, repository-level handoff/archive artifacts | raw per-task selector logs, task-local composition control, selector entry policy for non-trivial tasks |

The split is about authority, not importance.

Task-level evidence is often the input to later repository learning, but that
does not make task logs part of evolver.

## Selector Preflight Concept

Selector preflight is the task-local coverage check that happens before major
execution for non-trivial Bagakit-shaped work, even when the eventual outcome
is `direct_execute`.

It answers questions such as:

- which candidates are visible for this task
- which visible candidates are actually available in this host
- is current skill coverage sufficient
- do we need explicit comparison or composition
- do we expect retries, evaluation, or evidence worth preserving

The detailed heuristic for when operators should invoke selector belongs in:

- `docs/specs/selector-selection-model.md`
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
2. when selector escalates one repository-review suggestion, record the likely
   routing outcome as `host`, `upstream`, or `split` through that signal's
   `scope_hint`
3. only then open or update evolver when repository-level learning is real

Selector may record that later routing is likely needed.

Selector must not become the owner of:

- repository-level route decisions
- evolver promotion readiness
- repository-level handoff or archive receipts

## Selector-To-Evolver Bridge

Selector may emit task-local repository-review suggestions when repeated
task-local evidence now looks large enough to deserve repository-level review.

That bridge exists so one task can clearly say:

- this is no longer just one local retry
- the repeated pattern may deserve repository-level attention

The bridge must keep authority split intact.

So the allowed bridge shape is:

1. selector records one task-local `[[evolver_signal_log]]`
2. selector may export or bridge those signals into evolver intake
3. evolver still decides:
   - whether a topic should exist
   - what route the topic takes
   - whether any durable promotion is ready

Preferred bridge rule:

- default to explicit contract export or explicit bridge commands
- do not hide repository-level review creation inside ordinary selector logging
  side effects

Mapping rule:

- selector-side `[[evolver_signal_log]]` is the task-local source shape
- evolver intake uses `bagakit.evolver.signal.v1`
- the bridge must normalize selector-only fields into the evolver signal
  contract explicitly instead of silently dropping them

Current normalization direction:

- `signal_id`
  - task-local stable id inside one selector task file
- exported evolver signal `id`
  - normalized from `<task-id>--<signal_id>`
- `kind`, `title`, `summary`, `topic_hint`, `confidence`
  - copied through
- `producer`
  - fixed to `bagakit-skill-selector`
- `source_channel`
  - fixed to `selector`
- selector-only provenance such as:
  - `trigger`
  - `skill_id`
  - `scope_hint`
  - `attempt_key`
  - `error_type`
  - `occurrence_index`
  should be preserved in the exported signal `evidence[]`
- task-local artifact refs should be normalized into exported `local_refs[]`
  from:
  - the selector task file
  - the derived selector ranking report when present
  - one optional explicit `evidence_ref`

This bridge is one-way normalization.
It is not selector taking ownership of evolver intake semantics.

Selector-side `[[evolver_signal_log]]` entries are:

- task-local review suggestions
- visible and auditable in the task file
- allowed to be auto-suggested by task-local retry or error-pattern logic when
  `[evolver_handoff_policy].enabled = true`

They are not:

- repository-level route decisions
- evolver topic state
- durable promotion state

Lifecycle rule:

- selector signal status is task-local:
  - `suggested`
  - `exported`
  - `imported`
  - `dismissed`
- evolver intake signal status is repository-level intake state:
  - `pending`
  - `adopted`
  - `dismissed`

Selector may mark that one signal was exported or bridged.

Evolver still owns whether the intake item is later adopted or dismissed.

No automatic back-sync is required from evolver intake status into the original
selector task log.
The selector log remains historical task-local evidence.

## Repeated-Failure Rule

Repeated task-local failures may be strong enough to justify one explicit
repository-level review suggestion.

Typical trigger shapes include:

- retry backoff threshold reached for one `attempt_key`
- one repeated `error_pattern_log` cluster
- repeated failed benchmark or negative feedback loops

Selector owns:

- detecting those task-local triggers
- making the review suggestion visible
- preserving the task-local evidence trail

Evolver owns:

- deciding whether the signal deserves topic adoption
- deciding whether the result stays `host`, goes `upstream`, or becomes
  `split`

This keeps “same problem repeated several times” visible without turning
selector into a hidden repository-level control plane.

## Recipe And Driver Rule

Selector-owned recipes and selector-loaded Bagakit drivers are task-local aids.

They may define:

- standard task-local composition patterns
- task-local evidence prompts
- task-local retry or reporting guidance

They must not define:

- evolver topic creation policy
- repository-level route decisions
- repository-level promotion readiness
- durable repository decision memory
- a blanket rule that every task including trivial one-step work must use
  selector
- mandatory selector entry policy through driver or recipe side effects

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
- `docs/stewardship/bagakit-driver-maintenance.md`
  - maintainer guidance for Bagakit driver files

If a change proposes a new selector or evolver rule, decide first whether it
is:

- stable shared meaning
- runtime skill instruction
- maintainer practice

Then place it in the matching surface instead of repeating the same rule in
all three.
