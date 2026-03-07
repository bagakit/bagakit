# bagakit-skill-selector

Task-level or host-level skill coverage preflight, explicit composition, usage
evidence, and task-local evaluation for concrete work.

This skill is not the same as `bagakit-skill-evolver`.
Stable boundary meaning lives in `docs/specs/selector-evolver-boundary.md`.

Split:

- `bagakit-skill-evolver`
  - repository-evolution topics under `.bagakit/evolver/`
- `bagakit-skill-selector`
  - task-level skill selection and usage evidence under `.bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml`

## When To Use

For substantial work, the default is to consider selector preflight first.
For trivial one-step work, selector should not become mandatory ceremony.

Use selector when:

- skill coverage is uncertain
- multiple local, external, or research candidates may be tried
- one task intentionally composes multiple harness skills
- retries, evaluation, or handoff evidence matter

Skip selector when the work is trivial, obvious, and unlikely to benefit from
comparative skill evidence.

When selector is used, preflight should settle one typed route decision:

- `direct_execute`
- `compare_then_execute`
- `compose_then_execute`
- `review_loop`

## Why This Exists

This skill exists so that task-level practice evidence does not have to be
forced into repository-level `evolver` topics.

It also owns `recipes/` as the explicit knowledge surface for standard
multi-skill combinations.

It helps answer:

- which skills or references were considered for this task
- which ones were actually used
- what helped
- what failed
- what repeated failure now deserves repository-level review
- what should remain host-local adoption knowledge
- what may later be useful upstream

That makes it an adoption loop, not a repository evolution loop.

The output of this skill is often an input to later routing:

- `host`
- `upstream`
- `split`

But it should not assume that every task insight deserves an upstream evolver
topic.

## Composition And Task-Local Surfaces

`bagakit-skill-selector` is also the explicit composition entrypoint for
coupled-but-independently-distributable harness participants.

Current important case:

- `bagakit-living-knowledge`
- `bagakit-researcher`

These two may compose tightly for one task loop, but that coupling must stay
visible and optional.

Rule:

- explicit composition should be orchestrated through `bagakit-skill-selector`
- the pairing should normally be logged in `.bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml`
- if a standard selector recipe was used, record it in `[[recipe_log]]`
- selector-loaded drivers are task-local reporting guidance, not repository
  policy
- neither side should become a hidden hard dependency of the other
- each side must remain standalone-first with simplified behavior when the peer
  is absent

The task log still uses the historical field name `skill_id`, but the
composed participants should use canonical runtime skill ids when one exists.

Why the operator is now TypeScript:

- the selector loop now lives on the same `node --experimental-strip-types`
  runtime track as the rest of the repo
- the implementation is split into reusable local `scripts/lib/` modules instead
  of growing one more long Python file
- the append-friendly TOML contract stays intact while the engineering surface
  gets stronger

Current operator status:

- the canonical operator is now `scripts/skill_selector.ts`
- it can append `[[recipe_log]]` entries for standard selector recipes
- it can append `[[error_pattern_log]]` entries for repeated task-local failure
  clustering
- it can append `[[evolver_signal_log]]` entries for explicit repository-review
  suggestions
- it can derive a task-local `skill-ranking.md` report
- it can export or bridge those review suggestions into evolver intake without
  turning selector into a repository-level control plane
- it renders task-local driver packs for Bagakit skills that declare
  `metadata.bagakit.selector_driver_file`
- it counts repeated concrete attempts and forces selector-visible backoff once
  one method is stalling

`recipes/` is selector's composition knowledge surface, not a runtime hard
dependency control plane.
`evolver` remains the repository-level learning and promotion surface, and
selector drivers do not change that boundary.

Authority references:

- `docs/specs/selector-evolver-boundary.md`

Recipes should stay structured enough to compare. In practice that means fit
signals, non-fit signals, execution order, required/optional steps, synthesis
artifact, evidence hooks, and fallback guidance should all be explicit.

## Naming Status

This skill now uses a clearer task-layer name:

- `bagakit-skill-selector`

That leaves:

- `bagakit-skill-evolver`
  - reserved for the repository-system learning surface

The older standalone repo name `bagakit-skill-evolve` should now be treated as
legacy naming rather than the canonical monorepo name.
