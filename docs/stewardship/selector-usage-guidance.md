# Selector Usage Guidance

Use this note when deciding whether a piece of work should explicitly go through
`bagakit-skill-selector`.

This note is maintainer guidance for selective selector use. It is not a
hidden second control plane.

## First Principle

`bagakit-skill-selector` exists to improve task-level skill choice,
composition visibility, and execution evidence.

Selector should be used when a real route decision or reusable evidence needs
it. It does not exist to wrap every non-trivial task in ceremony.

## Default Rule

Use selector when at least one of:

- two or more plausible candidates can change the route
- multiple skills need explicit composition
- a retry or failure requires a method change
- a maintainer explicitly requests reusable selection/evaluation evidence

Direct execution is appropriate when:

- the route is obvious
- no meaningful candidate or composition decision exists
- existing host trace/test output already carries the needed evidence

## Practical Rule

Ask one simple classification question: can selector change the next action or
preserve evidence that someone will reuse? If not, act directly. If yes, use
the lightest mode: an ephemeral typed preflight, or a persisted episode when
the decision or outcome has reuse value.

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
- selector-loaded Bagakit drivers
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

When a persisted episode is justified, record explicit task-local availability
in `[[skill_plan]]` instead of leaving it implicit in prose.

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
- Bagakit driver file path

It must not be treated as the surface that creates a hidden selector policy.
Entry and persistence guidance belongs in the owning selector spec and
bootstrap, not in hidden metadata.

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
