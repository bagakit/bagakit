# Brainstorm Review Loop

## Fit Signals

Use this recipe when a brainstorm run exists and the next question is whether
its own quality or eval stack should be reviewed explicitly.

Good fit:

- the brainstorm output is high-stakes enough to justify an extra review pass
- the team wants to inspect whether the current evaluation method helped
- the task needs a review artifact before accepting the brainstorm handoff

## Non-Fit Signals

Do not use this recipe when:

- the brainstorm run is still incomplete
- the task does not justify extra review overhead
- simple user approval is enough without structured review artifacts

## Participants

- `bagakit-brainstorm`
- optional selector-recognized review artifacts:
  - `review_quality.md`
  - `eval_effect_review.md`
- optional: `bagakit-skill-selector`

## Execution Order

1. `bagakit-brainstorm`
   Finish the core brainstorm flow first.
2. Review loop
   Add `review_quality.md` and/or `eval_effect_review.md` when the task
   warrants it.
3. `bagakit-skill-selector`
   Record whether the extra review pass improved confidence or only added
   weight.

## Required Steps

- one completed or near-complete brainstorm run

## Optional Steps

- `review_quality.md`
- `eval_effect_review.md`
- selector feedback or benchmark entries when comparing reviewed versus
  unreviewed runs

## Skill Responsibilities

- `bagakit-brainstorm`
  - owns the brainstorm run and its optional review artifacts
  - does not silently bind itself to other runtime skills for this loop
- `bagakit-skill-selector`
  - owns the explicit decision to use the review loop and the task-level record

## Inputs

- one brainstorm artifact directory
- one review goal, such as output quality or eval usefulness

## Outputs

- updated brainstorm artifact set
- selector task record showing whether the review loop paid off

## Synthesis Artifact

Recommended synthesis artifact:

- one finalized brainstorm handoff artifact plus any explicit review packet that
  changed the decision

## Evidence To Record In `skill-usage.toml`

- one `[[recipe_log]]` entry for `brainstorm-review-loop`
- one `[[skill_plan]]` entry for `bagakit-brainstorm`
- `[[usage_log]]` showing:
  - brainstorm artifact completion
  - review artifact creation or explicit skip
- `[[feedback_log]]` when the extra review changed user or operator confidence

## Fallback And Degrade

- if the task is already clear enough after core brainstorm, stop before review
  and record the recipe as `skipped`
- if review finds blocking issues, keep the recipe `used` and open a new
  selector search or retry path instead of forcing closure

## When It Is Not Worth It

Do not attach a review loop to every brainstorm by default.
Use it when the extra audit signal is worth the time.
