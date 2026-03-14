# Planning Entry: Feature To Flow

## Fit Signals

Use this recipe when the request is already clear enough for canonical feature
tracking and the next expected step is repeated bounded execution.

Good fit:

- a delivery request already has stable scope and clear next tasks
- one tracked feature should quickly hand off into bounded execution
- the main open problem is execution pacing, not problem framing

## Non-Fit Signals

Do not use this recipe when:

- the task still needs strong option generation or review
- the task does not justify repeated execution flow
- the task already has an active flow-runner item and only needs continuation

## Participants

- `bagakit-feature-tracker`
- `bagakit-flow-runner`
- optional: `bagakit-skill-selector`

## Execution Order

1. `bagakit-skill-selector`
   Record the route choice and planned participants.
2. `bagakit-feature-tracker`
   Create or refresh canonical feature planning truth.
3. `bagakit-flow-runner`
   Ingest that planning truth and expose the bounded execution loop.

## Required Steps

- one created or refreshed tracker feature
- one flow-runner ingest or next-action surface

## Optional Steps

- selector feedback capture
- selector benchmark notes on whether execution flow added value over direct
  tracker-only work

## Skill Responsibilities

- `bagakit-skill-selector`
  - owns explicit route logging
- `bagakit-feature-tracker`
  - owns canonical planning truth
- `bagakit-flow-runner`
  - owns bounded execution flow over normalized work items

## Inputs

- stable delivery objective
- route reason
- tracker-ready planning scope

## Outputs

- feature-tracker runtime truth
- flow-runner runtime truth
- selector task record

## Synthesis Artifact

Recommended synthesis artifact:

- one flow-runner next-action or resume-candidate surface tied to one tracked
  feature

## Evidence To Record In `skill-usage.toml`

- one `[[recipe_log]]` entry for `planning-entry-feature-to-flow`
- `[[skill_plan]]` entries for `bagakit-feature-tracker` and
  `bagakit-flow-runner`
- `[[usage_log]]` showing:
  - tracker planning truth exists
  - flow-runner ingested or selected the resulting work item

## Fallback And Degrade

- if execution does not need repeated bounded flow, stop at feature-tracker and
  log flow-runner as skipped
- if the request becomes ambiguous after all, switch upward to
  `planning-entry-brainstorm-to-feature`

## When It Is Not Worth It

Do not use this recipe when the task only needs planning truth without repeated
execution.
