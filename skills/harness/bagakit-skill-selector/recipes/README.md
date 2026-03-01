# Selector Recipes

`recipes/` is the explicit composition knowledge surface for
`bagakit-skill-selector`.

It exists to capture standard multi-skill combinations without turning them
into hidden runtime dependencies.

## What A Recipe Is

A recipe is:

- task-level composition guidance
- owned by selector
- explicit and reviewable
- standalone-first for every participating skill

A recipe is not:

- a hard dependency control plane
- permission for one skill to silently call another
- repository-level evolver policy

## When To Use A Recipe

Use a recipe when:

- a task shape already has a known high-value multi-skill pattern
- you want explicit order, evidence expectations, and fallback guidance
- you want to compare whether one standard combination actually helped

Do not use a recipe when:

- one skill already covers the task cleanly
- the combination is still one-off and unstable
- the extra process is heavier than the task needs

## Logging Rule

If one task intentionally uses a standard recipe:

1. append `[[recipe_log]]` to `.bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml`
2. log every participating skill explicitly in `[[skill_plan]]`
3. record execution evidence in `[[usage_log]]`, plus benchmark/search/feedback
   entries when the task actually needs them

Minimal example:

```toml
[[recipe_log]]
timestamp = "2026-04-19T00:00:00Z"
recipe_id = "brainstorm-with-research"
source = "skills/harness/bagakit-skill-selector/recipes/brainstorm-with-research.md"
why = "Need evidence-grounded option generation before decision handoff"
status = "selected"
notes = "Use only the required path first"
```

Selector command example:

```bash
node --experimental-strip-types scripts/skill_selector.ts recipe \
  --file .bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml \
  --recipe-id brainstorm-with-research \
  --source skills/harness/bagakit-skill-selector/recipes/brainstorm-with-research.md \
  --why "Need evidence-grounded option generation before decision handoff" \
  --status selected
```

## Standardization Rule

Promote a combination into `recipes/` only when:

- it repeats across multiple concrete tasks
- its order and boundaries are stable enough to teach
- its evidence and fallback expectations are worth standardizing

Keep it out of `recipes/` when it is still only:

- one-off
- host-specific
- unstable in sequencing
- unclear in evidence expectations

## Current Recipes

- `brainstorm-with-research.md`
- `research-to-knowledge.md`
- `brainstorm-review-loop.md`
