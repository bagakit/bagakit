# Planning Entry: Brainstorm, Feature, Flow

## Fit Signals

Use this recipe when substantial delivery work is both:

- still ambiguous enough to need structured option shaping
- likely to continue through repeated bounded execution after planning truth is created

Good fit:

- large feature delivery with early uncertainty and expected multi-round execution
- work where ambiguity reduction, canonical planning, and execution flow all
  matter in one contiguous route

## Non-Fit Signals

Do not use this recipe when:

- the task only needs analysis
- the task is already clear enough to skip brainstorm
- repeated execution is not expected

## Participants

- `bagakit-brainstorm`
- `bagakit-feature-tracker`
- `bagakit-flow-runner`
- optional: `bagakit-skill-selector`

## Execution Order

1. `bagakit-skill-selector`
   Record the full planning-entry route.
2. `bagakit-brainstorm`
   Reduce ambiguity and produce a delivery-facing handoff.
3. `bagakit-feature-tracker`
   Materialize canonical planning truth.
4. `bagakit-flow-runner`
   Ingest the planned work and expose bounded execution flow.

## Required Steps

- one brainstorm handoff artifact
- one created tracker feature
- one flow-runner ingest or next-action artifact

## Optional Steps

- selector benchmark notes comparing this full route with shorter routes
- user or operator feedback on whether the extra brainstorm step paid off

## Skill Responsibilities

- `bagakit-skill-selector`
  - owns explicit route visibility and evidence logging
- `bagakit-brainstorm`
  - owns ambiguity reduction and handoff packaging
- `bagakit-feature-tracker`
  - owns canonical planning truth
- `bagakit-flow-runner`
  - owns bounded execution flow

## Inputs

- substantial delivery objective
- local context or notes
- route reason

## Outputs

- brainstorm handoff artifacts
- tracker planning truth
- flow-runner execution surfaces
- selector task record

## Synthesis Artifact

Recommended synthesis artifact:

- one route chain that ends in flow-runner-ready execution while keeping the
  upstream brainstorm and feature artifacts explicit

## Evidence To Record In `skill-usage.toml`

- one `[[recipe_log]]` entry for `planning-entry-brainstorm-feature-flow`
- `[[skill_plan]]` entries for all three runtime participants
- `[[usage_log]]` showing:
  - brainstorm produced the handoff artifact
  - feature-tracker created canonical planning truth
  - flow-runner ingested or selected the resulting work item

## Fallback And Degrade

- if brainstorm resolves that direct delivery is enough, switch to
  `planning-entry-feature-to-flow`
- if the task ends after planning truth creation, keep flow-runner skipped and
  log that explicitly

## When It Is Not Worth It

Do not use this recipe when one shorter route already matches the task shape
cleanly.
