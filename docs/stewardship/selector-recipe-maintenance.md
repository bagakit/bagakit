# Selector Recipe Maintenance

Use this note when maintaining standard multi-skill recipes under
`skills/harness/bagakit-skill-selector/recipes/`.

This note is maintainer guidance, not runtime control logic.

## Purpose

Recipes exist so high-value multi-skill combinations stay:

- explicit
- reviewable
- comparable across tasks
- standalone-first for every participating skill

Recipes do not exist to:

- create hidden hard dependencies
- move repository-level evolver control into selector
- replace task-level judgment with one fixed workflow
- turn selector into a blanket wrapper for trivial work

## What Belongs In A Recipe

A standard recipe should explain:

- which task shape it fits
- which task shape it does not fit
- when the task should use the recipe instead of staying simpler
- which skills participate
- which steps are required versus optional
- what evidence should be recorded back into `skill-usage.toml`
- how to degrade or stop when the recipe is too heavy

Keep recipes focused on composition knowledge.

Do not put these into recipes:

- detailed internal runbooks for one skill
- hidden cross-skill call assumptions
- repository-level promotion rules
- "every substantial task must use this recipe" claims

Those belong respectively in:

- the owning skill
- `docs/stewardship/`
- `bagakit-skill-evolver` and repository-level surfaces

## Promotion Rule

Promote a composition into a standard recipe only when the pattern is more than
one-off.

Good promotion signals:

- the same combination keeps recurring across concrete tasks
- the order of operations is stable enough to teach
- the evidence and fallback expectations are worth standardizing
- the combination is still useful after removing host-local trivia

Keep it as one-off task usage when:

- only one task used it
- the task order is still unstable
- the combination is mostly ad hoc human preference
- the evidence model is not yet clear

## Logging Rule

When a task intentionally uses a standard recipe:

- record a `[[recipe_log]]` entry in `.bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml`
- still log participating skills explicitly in `[[skill_plan]]`
- still record real execution evidence in `[[usage_log]]`, `[[benchmark_log]]`,
  `[[feedback_log]]`, and `[[search_log]]` as needed

`recipe_log` is the composition label.
It must not replace the actual execution evidence.

## Boundary Rule

Keep the selector-versus-evolver split clear:

- `bagakit-skill-selector`
  - task-level composition choice and usage evidence
- `bagakit-skill-evolver`
  - repository-level learning, promotion, and durable evolution state

Recipes live with selector because they are task-level composition knowledge.
They must not quietly become evolver policy or a repository-wide mandatory
wrapper.
