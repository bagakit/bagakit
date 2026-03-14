# Planning Entry: Brainstorm To Feature

## Fit Signals

Use this recipe when a request is headed toward implementation, but the scope
or decision surface is still unstable enough that direct feature creation would
be premature.

Good fit:

- new feature requests with unclear trade-offs
- product or architecture asks that still need option shaping
- work that should end in canonical feature tracking after one analysis pass

## Non-Fit Signals

Do not use this recipe when:

- the request is already crisp enough for direct feature creation
- the task only needs analysis and no delivery handoff
- the task already has feature-tracker truth

## Participants

- `bagakit-brainstorm`
- `bagakit-feature-tracker`
- optional: `bagakit-skill-selector`

## Execution Order

1. `bagakit-skill-selector`
   Record the composed planning-entry route.
2. `bagakit-brainstorm`
   Reduce ambiguity, compare options, and produce a delivery-facing handoff.
3. `bagakit-feature-tracker`
   Materialize canonical feature and task planning truth from the handoff.

## Required Steps

- one brainstorm handoff artifact
- one created feature in tracker

## Optional Steps

- selector feedback capture
- selector benchmark notes on whether the brainstorm step was worth the extra cost

## Skill Responsibilities

- `bagakit-skill-selector`
  - owns explicit route visibility and composition logging
- `bagakit-brainstorm`
  - owns ambiguity reduction, option generation, and handoff packaging
  - does not become the canonical planning truth owner
- `bagakit-feature-tracker`
  - owns canonical feature and task planning truth
  - does not absorb brainstorm review semantics into its runtime

## Inputs

- task objective
- local Markdown context or request text
- route reason

## Outputs

- brainstorm handoff artifacts under `.bagakit/brainstorm/`
- feature-tracker runtime truth under `.bagakit/feature-tracker/`
- selector task record under `.bagakit/skill-selector/tasks/<task-slug>/`

## Synthesis Artifact

Recommended synthesis artifact:

- one created feature plus one tracker-facing planning summary derived from the
  brainstorm handoff

## Evidence To Record In `skill-usage.toml`

- one `[[recipe_log]]` entry for `planning-entry-brainstorm-to-feature`
- `[[skill_plan]]` entries for `bagakit-brainstorm` and
  `bagakit-feature-tracker`
- `[[usage_log]]` showing:
  - brainstorm produced the handoff artifact
  - feature-tracker created canonical planning state from that handoff

## Fallback And Degrade

- if brainstorm converges that no tracked delivery should happen, stop after
  brainstorm and log the recipe as `used` with tracker skipped
- if the request becomes obviously executable before brainstorm starts, switch
  to `planning-entry-feature-to-flow`

## When It Is Not Worth It

Do not use this recipe when the work is already clear enough for direct feature
creation.
