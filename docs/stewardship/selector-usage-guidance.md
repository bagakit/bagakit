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

## Selection Scope Rule

Selector should compare all visible candidates that matter for the task, not
just Bagakit skills.

That comparison set may include:

- repo-visible canonical Bagakit skills
- currently installed host skills or tools
- external utilities
- research or practice references

Bagakit skills should usually get preference when fit is comparable and the
skill is actually available, because Bagakit can offer:

- richer metadata
- selector recipes
- selector-loaded drivers
- stronger task-local evidence surfaces

This is a preference rule, not an exclusion rule.

If the best fit is non-Bagakit or mixed, selector should say so explicitly.

## Availability Rule

Repo-visible does not mean host-available.

So selector should separate:

- `visible`
  - the candidate exists and is relevant enough to compare
- `available`
  - the candidate is usable in the current host or session
- `selected`
  - the candidate is chosen for this task

If a canonical Bagakit skill is visible in the repository but not available in
the current host, keep it in the comparison picture but do not pretend it is
executable.

When selector is already in use, record explicit task-local availability in
`[[skill_plan]]` instead of leaving it implicit in prose.

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

## Frontmatter Rule

Skill frontmatter may declare selector-relevant metadata such as:

- Bagakit namespace identity
- harness layer
- selector driver file path

It must not be treated as a hidden mandatory rule that every task must invoke
selector first.

Invocation remains a task-level decision.

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

## Self-Discipline Rule

When an operator is already doing selector-oriented work, the same discipline
still applies:

- before doing a substantial subtask directly, ask whether a better-fit skill
  should be used

Example:

- if the next subtask is research-heavy, consider a research-oriented skill
  before treating selector as a reason to do the work ad hoc

## Project-Local Preference Rule

If project-local selector preference artifacts are later maintained under
`.bagakit/skill-selector/`, treat them as:

- host-local hints
- comparison accelerators
- optional input to derived candidate survey output

Do not treat them as:

- repository-level policy
- evolver topic state
- a reason to skip fresh task-level judgment

Recommended companion artifact:

- `.bagakit/skill-selector/tasks/<task-slug>/candidate-survey.md`
  - derived comparison view only
  - not a second task SSOT
