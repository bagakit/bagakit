# bagakit-skill-selector

Task-level or host-level skill coverage preflight, explicit composition, usage
evidence, and task-local evaluation for concrete work.

This skill is not the same as `bagakit-skill-evolver`.
Stable boundary meaning lives in `docs/specs/selector-evolver-boundary.md`.
Selector candidate-scope semantics live in
`docs/specs/selector-selection-model.md`.
Planning-entry route semantics live in
`docs/specs/selector-planning-entry-routes.md`.
Project-local preference-hint semantics live in
`docs/specs/selector-preference-surface.md`.

Split:

- `bagakit-skill-evolver`
  - repository-evolution topics under `.bagakit/evolver/`
- `bagakit-skill-selector`
  - task-level skill selection and usage evidence under `.bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml`

## When To Use

For non-trivial Bagakit-shaped work, selector preflight is mandatory before
major implementation.
For trivial one-step work, selector should not become mandatory ceremony.

Mandatory preflight may legitimately end in `direct_execute` when current
coverage is already sufficient or no better candidate exists.

To satisfy that gate:

- initialize `.bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml`
- record one typed preflight decision before major implementation begins

Private day-scoped selector memory may also live under:

- `.bagakit/skill-selector/daily/<yyyy-mm-dd>.md`

Rules:

- daily notes are private sidecar memory, not task SSOT
- daily notes are intentionally day-based rather than task-based
- daily notes must stay separate from `skill-usage.toml`
- selector should install a local git-exclude rule for that directory by
  default

The fuller selector loop matters most when:

- skill coverage is uncertain
- multiple local, external, or research candidates may be tried
- one task intentionally composes multiple harness skills
- retries, evaluation, or handoff evidence matter

Skip selector when the work is trivial, obvious, and unlikely to benefit from
comparative skill evidence.

Planning-entry recipes are a narrower subset of this rule.
Use them when preflight identifies substantial planning work that benefits from
explicit route selection across canonical Bagakit planning surfaces.

When selector is used, preflight should settle one typed route decision:

- `direct_execute`
- `compare_then_execute`
- `compose_then_execute`
- `review_loop`

Selector compares all visible candidates that matter for the task, not only
Bagakit skills.

Important state split:

- `visible`
  - selector can see the candidate and compare it
- `available`
  - the candidate is usable in the current host
- `selected`
  - the candidate is chosen into this task's plan

Bagakit skills should usually get preference when fit is comparable and the
skill is available, because they expose stronger recipes, drivers, and
task-local evidence surfaces.

That is a preference rule, not an exclusivity rule.
Repo-visible does not automatically mean host-available.

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

It should also be the explicit task-local place where substantial planning work
is routed into:

- `bagakit-brainstorm`
- `bagakit-feature-tracker`
- `bagakit-flow-runner`

through standard planning-entry recipes when that route is worth making
explicit.

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
- selector-loaded Bagakit drivers are task-local reporting guidance, not repository
  policy
- frontmatter declarations are metadata; mandatory non-trivial Bagakit-shaped
  preflight
  belongs in bootstrap and shared spec surfaces, not in a hidden "always use
  selector first" rule
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
- it can record typed task-local candidate availability in `[[skill_plan]]`
- it can append `[[error_pattern_log]]` entries for repeated task-local failure
  clustering
- it can append `[[evolver_signal_log]]` entries for explicit repository-review
  suggestions
- it can initialize one private date-based selector daily note under
  `.bagakit/skill-selector/daily/` without mixing that content into
  `skill-usage.toml`
- it can initialize optional host-local `project-preferences.toml`
- it can derive a task-local `candidate-survey.md` report from explicit plans,
  project hints, and repo-visible canonical skills
- it can derive a task-local `skill-ranking.md` report
- it can emit structured json for `candidate-survey` and `skill-ranking` when
  eval or validation wants semantic assertions without scraping markdown
- it can export or bridge those review suggestions into evolver intake without
  turning selector into a repository-level control plane
- it renders task-local driver packs for Bagakit skills that expose the
  conventional driver payload at `references/bagakit-driver.toml`
- it counts repeated concrete attempts and forces selector-visible backoff once
  one method is stalling

`recipes/` is selector's composition knowledge surface, not a runtime hard
dependency control plane.
`evolver` remains the repository-level learning and promotion surface, and
Bagakit drivers do not change that boundary.
`project-preferences.toml` remains an optional host-local hint surface, not a
repository policy surface.

Authority references:

- `docs/specs/selector-evolver-boundary.md`

Recipes should stay structured enough to compare. In practice that means fit
signals, non-fit signals, execution order, required/optional steps, synthesis
artifact, evidence hooks, and fallback guidance should all be explicit.

Current planning-entry recipes:

- `planning-entry-brainstorm-only`
- `planning-entry-brainstorm-to-feature`
- `planning-entry-feature-to-flow`
- `planning-entry-brainstorm-feature-flow`

## Naming Status

This skill now uses a clearer task-layer name:

- `bagakit-skill-selector`

That leaves:

- `bagakit-skill-evolver`
  - reserved for the repository-system learning surface

The older standalone repo name `bagakit-skill-evolve` should now be treated as
legacy naming rather than the canonical monorepo name.
