# Brainstorm With Research

## Fit Signals

Use this recipe when the task needs stronger external or frontier grounding
before option generation and handoff.

Good fit:

- early exploration where unsupported ideation would be low-signal
- problem framing that depends on recent patterns, examples, or failure cases
- option work that benefits from evidence before debate

## Non-Fit Signals

Do not use this recipe when:

- the user only wants quick ideation from local Markdown context
- the task is already well-bounded and research would be overhead
- one quick lookup is enough and does not justify a research workspace

## Participants

- `bagakit-researcher`
- `bagakit-brainstorm`
- optional: `bagakit-skill-selector` as the explicit task-level composition
  entrypoint and evidence log owner

## Execution Order

1. `bagakit-researcher`
   Capture source cards, reusable summaries, and a refreshed topic index.
2. `bagakit-brainstorm`
   Use the research outputs as evidence-bearing context for options,
   trade-offs, and handoff artifacts.
3. `bagakit-skill-selector`
   Record the recipe choice, participating skills, concrete usage evidence, and
   whether the combination actually helped.

## Required Steps

- one explicit research topic with reusable evidence
- one brainstorm run that cites or incorporates the research outputs

## Optional Steps

- additional benchmark or feedback capture in selector
- downstream promotion into knowledge or evolver, decided outside this recipe

## Skill Responsibilities

- `bagakit-researcher`
  - owns evidence production
  - does not decide promotion or silently call brainstorm
- `bagakit-brainstorm`
  - owns option generation, expert-forum review, and handoff packaging
  - does not silently call researcher
- `bagakit-skill-selector`
  - owns explicit composition visibility and task-level comparison evidence

## Inputs

- task objective
- topic scope
- available Markdown context

## Outputs

- researcher topic artifacts under the configured researcher root
- brainstorm handoff artifacts under `.bagakit/brainstorm/`
- selector task record under `.bagakit/skill-selector/tasks/<task-slug>/`

## Synthesis Artifact

Recommended synthesis artifact:

- one brainstorm handoff package that explicitly cites the research evidence it
  used

## Evidence To Record In `skill-usage.toml`

- one `[[recipe_log]]` entry for `brainstorm-with-research`
- `[[skill_plan]]` entries for `bagakit-researcher` and `bagakit-brainstorm`
- `[[usage_log]]` showing:
  - research evidence was produced
  - brainstorm consumed that evidence
- `[[feedback_log]]` or `[[benchmark_log]]` when the task needs comparison or
  quality judgment

## Fallback And Degrade

- if research signal is weak, stop after a thin research pass and record the
  gap explicitly before deeper brainstorm work
- if brainstorm scope shrinks enough, drop back to standalone brainstorm and log
  the recipe as `skipped` or `rejected`

## When It Is Not Worth It

Skip this recipe when the extra research loop costs more than the likely
decision improvement.
