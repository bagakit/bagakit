# Research To Knowledge

## Fit Signals

Use this recipe when research outputs may deserve promotion into shared
knowledge, but that promotion should remain an explicit outer decision.

Good fit:

- repeated questions are starting to recur
- the research output is stable enough to become shared project knowledge
- the task needs a clean handoff from evidence production into knowledge

## Non-Fit Signals

Do not use this recipe when:

- the research output is still exploratory or unstable
- the result is only useful for one narrow task
- the work belongs in repository-level evolver rather than host-side knowledge

## Participants

- `bagakit-researcher`
- `bagakit-living-knowledge`
- optional: `bagakit-skill-selector`

## Execution Order

1. `bagakit-researcher`
   Produce the topic evidence first.
2. Outer decision
   Decide explicitly whether the result is mature enough for shared knowledge.
3. `bagakit-living-knowledge`
   Ingest or normalize the promoted result into the shared knowledge surface.
4. `bagakit-skill-selector`
   Record that the recipe was used and whether the promotion step was worth it.

## Required Steps

- research evidence exists first
- the promotion decision is explicit, not hidden inside researcher

## Optional Steps

- selector benchmarking or feedback capture
- leaving the result as research-only and skipping the knowledge step

## Skill Responsibilities

- `bagakit-researcher`
  - owns evidence production
  - does not silently bind itself to knowledge promotion
- `bagakit-living-knowledge`
  - owns shared knowledge normalization, indexing, and recall
  - does not silently pull from researcher on its own
- `bagakit-skill-selector`
  - owns task-level composition visibility and evidence logging

## Inputs

- one researcher topic with source cards and summaries
- one explicit promotion decision

## Outputs

- researcher topic artifacts
- shared knowledge updates when promotion is chosen
- selector task record that shows whether the combination was useful

## Synthesis Artifact

Recommended synthesis artifact:

- one shared knowledge page or ingest target that captures the promoted result,
  or one explicit “promotion skipped” note

## Evidence To Record In `skill-usage.toml`

- one `[[recipe_log]]` entry for `research-to-knowledge`
- `[[skill_plan]]` entries for the participating skills
- `[[usage_log]]` showing:
  - research topic creation or refresh
  - knowledge ingest or recall/index refresh when promotion happens
- if promotion is skipped, record that as explicit usage or notes instead of
  leaving it implicit

## Fallback And Degrade

- if the evidence is not mature enough, keep the result in researcher only and
  log the recipe as `used` with a skipped promotion step
- if the knowledge surface already has the answer, stop the recipe and use
  standalone living-knowledge recall instead

## When It Is Not Worth It

Do not run this recipe just to move one short-lived note into shared knowledge.
