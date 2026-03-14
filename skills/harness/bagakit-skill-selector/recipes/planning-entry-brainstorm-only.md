# Planning Entry: Brainstorm Only

## Fit Signals

Use this recipe when the task still needs framing, option generation, or
decision-quality review, but is not yet ready to become canonical feature work.

Good fit:

- user asks for brainstorming from Markdown or partial notes
- the outcome should be a handoff package, not immediate tracked delivery
- the main uncertainty is conceptual, not executional

## Non-Fit Signals

Do not use this recipe when:

- the request is already clear enough to create a feature directly
- the task already has canonical planning truth
- repeated bounded execution is the immediate next problem

## Participants

- `bagakit-brainstorm`
- optional: `bagakit-skill-selector`

## Execution Order

1. `bagakit-skill-selector`
   Record the route choice and planned participant.
2. `bagakit-brainstorm`
   Run clarification, analysis, review, and handoff.

## Required Steps

- one explicit selector route choice
- one brainstorm run that reaches handoff-ready state

## Optional Steps

- selector feedback capture
- selector benchmark notes for whether brainstorm paid off

## Skill Responsibilities

- `bagakit-skill-selector`
  - owns explicit route visibility
  - does not silently turn brainstorm artifacts into canonical planning truth
- `bagakit-brainstorm`
  - owns ambiguity reduction, option generation, and handoff packaging
  - does not silently create feature-tracker state

## Inputs

- task objective
- local Markdown context when available
- explicit route reason

## Outputs

- brainstorm artifact set under `.bagakit/brainstorm/`
- selector task record under `.bagakit/skill-selector/tasks/<task-slug>/`

## Synthesis Artifact

Recommended synthesis artifact:

- one brainstorm handoff artifact under `.bagakit/brainstorm/`

## Evidence To Record In `skill-usage.toml`

- one `[[recipe_log]]` entry for `planning-entry-brainstorm-only`
- one `[[skill_plan]]` entry for `bagakit-brainstorm`
- `[[usage_log]]` showing brainstorm execution and resulting handoff artifact

## Fallback And Degrade

- if the task becomes clearly executable during clarification, stop and switch
  to `planning-entry-brainstorm-to-feature`
- if the task shrinks to trivial scope, log the recipe as `skipped`

## When It Is Not Worth It

Do not use this recipe for work that is already ready to become tracked
delivery.
