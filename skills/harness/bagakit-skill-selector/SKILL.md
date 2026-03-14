---
name: bagakit-skill-selector
description: Meta-skill for task-level or host-level skill coverage preflight, explicit composition, usage tracking, and task-local evaluation. Substantial tasks should consider selector preflight before major implementation, but trivial or obvious work does not need a selector wrapper.
metadata:
  bagakit:
    harness_layer: l1-execution
---

# bagakit-skill-selector

Use this skill for a task-level skill lifecycle loop:

1. Preflight: ask whether skill coverage is sufficient.
2. Plan: list local skills plus best external/research candidates.
3. Execute: record what each skill actually did.
4. Evaluate: score quality with evidence and feedback.
5. Iterate: if quality/feedback is weak, trigger a focused new search loop.

This skill is intentionally neutral at the task layer. It keeps one structured
task log without turning every task into a repository-evolution topic.

It also owns the explicit recipe surface for standard multi-skill combinations
under `recipes/`.

Stable selector-versus-evolver meaning lives in:

- `docs/specs/selector-evolver-boundary.md`
- `docs/specs/selector-selection-model.md`

Default stance:

- for substantial tasks, consider selector preflight first
- for trivial one-step work, do not add selector ceremony without a real reason

## Positioning

This skill is for task-level or host-level adoption evidence.

Authority references:

- `docs/specs/selector-evolver-boundary.md`
- `docs/specs/selector-selection-model.md`

Use selector when one or more of these are true:

- skill coverage is uncertain
- multiple local, external, or research candidates may be tried
- one task needs explicit multi-skill composition
- retries, evaluation, or evidence-preserving handoff matter

You may skip selector when the task is trivial, obvious, and unlikely to
benefit from comparative skill evidence.

It is useful when you need to know:

- whether current skill coverage was enough for one concrete task
- which candidate skills or references were tried
- what they actually did in execution
- whether the resulting learning should stay host-side or later inform
  upstream Bagakit evolution
- whether one task should explicitly compose multiple coupled harness skills
  without turning them into hidden hard dependencies
- whether task-local evaluation should happen before any repository-level
  evolver topic is considered
- whether repeated task-local failures should be surfaced for repository-level
  review without auto-opening an evolver topic

This is not the same thing as repository-level `evolver`.

Think of the split as:

- `bagakit-skill-evolver`
  - repository evolution
- `bagakit-skill-selector`
  - task-level skill selection and usage evidence

The current monorepo name is already the clearer task-layer name.
The older standalone repo name `bagakit-skill-evolve` should be treated as
legacy naming.

## Selection Scope Rule

Selector compares all visible candidates that matter for the task, not just
Bagakit.

Keep these states distinct:

- `visible`
- `available`
- `selected`

Bagakit skills should usually get preference when fit is comparable and the
skill is available, because Bagakit exposes stronger recipes, drivers, and
task-local evidence surfaces.

That is a preference rule, not an exclusion rule.

Repo-visible does not mean host-available.
Frontmatter may declare selector metadata, but it must not silently force
selector invocation.

Full candidate-scope semantics live in:

- `docs/specs/selector-selection-model.md`

## Composition Entry Rule

`bagakit-skill-selector` is the explicit composition entrypoint for coupled
harness participants.

Use it when one task intentionally wants a composed loop such as:

- `bagakit-living-knowledge`
- `bagakit-researcher`

and you need that coupling to remain:

- explicit
- auditable
- optional
- standalone-first for each participating skill

That means:

- the composition decision should be logged in `.bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml`
- the entrypoint should be `bagakit-skill-selector`
- each composed peer should still declare a standalone-first fallback
- `bagakit-living-knowledge` and `bagakit-researcher` may compose tightly, but they must not
  become silent mutual hard dependencies

The file keeps the historical field name `skill_id`, but a composed peer may
still be:

- one runtime skill id
- one external tool id

## Output Contract

For each task that intentionally uses selector, maintain one structured TOML
file.

Recommended path:

- `.bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml`

Required behavior:

- the file must exist before major implementation starts
- it must be append-updated during execution
- it must include explicit evaluation before task close
- selected local candidates should carry explicit `availability` instead of
  leaving host readiness implicit in prose
- if the task chooses explicit multi-skill composition, that composition must be
  logged through `[[skill_plan]]` composition fields rather than hidden in prose
- if the task intentionally follows one standard selector recipe, that choice
  should also be logged through `[[recipe_log]]`
- if repeated failure or backoff suggests repository-level review, that
  suggestion should be visible through `[[evolver_signal_log]]` instead of
  being hidden inside notes

Recommended derived outputs:

- `.bagakit/skill-selector/tasks/<task-slug>/candidate-survey.md`
  - compare visible candidates, recorded availability, and project-local
    preference hints
- `.bagakit/skill-selector/tasks/<task-slug>/bagakit-drivers.md`
  - render Bagakit driver guidance from selected local Bagakit skills

## Operator

Low-level operator:

- `scripts/skill_selector.ts`

Examples:

```bash
node --experimental-strip-types scripts/skill_selector.ts init \
  --file .bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml \
  --task-id <stable-task-id> \
  --objective "<task objective>" \
  --owner "<operator>"

node --experimental-strip-types scripts/skill_selector.ts preflight \
  --file .bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml \
  --answer partial \
  --gap-summary "Need stronger memory benchmark coverage" \
  --decision "compare_then_execute" \
  --status in_progress

node --experimental-strip-types scripts/skill_selector.ts plan \
  --file .bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml \
  --skill-id "<skill-or-reference-id>" \
  --kind local \
  --source "<path-or-url>" \
  --why "<selection reason>" \
  --expected-impact "<expected contribution>" \
  --availability available \
  --availability-detail "<host check result>"

node --experimental-strip-types scripts/skill_selector.ts availability \
  --file .bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml \
  --skill-id "<skill-or-reference-id>" \
  --availability available \
  --availability-detail "<host check result>"

node --experimental-strip-types scripts/skill_selector.ts recipe \
  --file .bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml \
  --recipe-id brainstorm-with-research \
  --source skills/harness/bagakit-skill-selector/recipes/brainstorm-with-research.md \
  --why "Need evidence-grounded option generation before decision handoff" \
  --synthesis-artifact .bagakit/brainstorm/outcome/brainstorm-handoff-new-feature.md \
  --status selected

node --experimental-strip-types scripts/skill_selector.ts usage \
  --file .bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml \
  --skill-id "<skill-or-reference-id>" \
  --phase execution \
  --attempt-key "<stable-sub-problem-token>" \
  --action "<what was done>" \
  --result success \
  --evidence "<file/test/log reference>"

node --experimental-strip-types scripts/skill_selector.ts feedback \
  --file .bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml \
  --skill-id "<skill-or-reference-id>" \
  --channel user \
  --signal positive \
  --detail "<feedback detail>"

node --experimental-strip-types scripts/skill_selector.ts search \
  --file .bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml \
  --reason "insufficient feedback" \
  --query "<what to search next>" \
  --source-scope hybrid

node --experimental-strip-types scripts/skill_selector.ts benchmark \
  --file .bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml \
  --benchmark-id "memory-recall-latency" \
  --metric "p95_latency_ms" \
  --baseline 420 \
  --candidate 360 \
  --no-higher-is-better \
  --notes "candidate reduces latency"

node --experimental-strip-types scripts/skill_selector.ts error-pattern \
  --file .bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml \
  --error-type "search_failure" \
  --message-pattern "web search returned empty results" \
  --skill-id bagakit-researcher \
  --resolution "fallback to local topic summaries"

node --experimental-strip-types scripts/skill_selector.ts evolver-signal \
  --file .bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml \
  --signal-id repeated-search-failure \
  --kind gotcha \
  --trigger retry_backoff \
  --skill-id bagakit-researcher \
  --title "Repeated search failure deserves repo review" \
  --summary "the same search failure hit selector backoff and may reflect a reusable repository-level gap" \
  --scope-hint upstream \
  --attempt-key search-failure \
  --occurrence-index 3 \
  --evidence-ref .bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml

node --experimental-strip-types scripts/skill_selector.ts evolver-export \
  --file .bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml \
  --output .bagakit/skill-selector/tasks/<task-slug>/evolver-signals.json \
  --mark-exported

node --experimental-strip-types scripts/skill_selector.ts evolver-bridge \
  --file .bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml \
  --root . \
  --output .bagakit/skill-selector/tasks/<task-slug>/evolver-signals.json

node --experimental-strip-types scripts/skill_selector.ts skill-ranking \
  --file .bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml \
  --output .bagakit/skill-selector/tasks/<task-slug>/skill-ranking.md

node --experimental-strip-types scripts/skill_selector.ts preferences-init \
  --file .bagakit/skill-selector/project-preferences.toml

node --experimental-strip-types scripts/skill_selector.ts candidate-survey \
  --file .bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml \
  --root . \
  --output .bagakit/skill-selector/tasks/<task-slug>/candidate-survey.md

node --experimental-strip-types scripts/skill_selector.ts evaluate \
  --file .bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml \
  --quality-score 0.86 \
  --evidence-score 0.80 \
  --feedback-score 0.72 \
  --overall pass \
  --summary "usable with minor follow-up" \
  --status completed

node --experimental-strip-types scripts/skill_selector.ts validate \
  --file .bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml \
  --strict

node --experimental-strip-types scripts/skill_selector.ts drivers \
  --file .bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml \
  --root . \
  --output .bagakit/skill-selector/tasks/<task-slug>/bagakit-drivers.md
```

`evolver-bridge` is only the selector-side convenience wrapper.
The canonical evolver intake surface remains evolver-owned `bridge-signals`.

Isolation rule for fair multi-skill comparison:

- run each candidate in a fresh agent session
- do not reuse one long-lived agent across candidates

## Workflow Rules

### 1) Preflight

Before major implementation, substantial tasks should consider whether selector
is warranted at all:

- do we have enough good skills now
- do we need explicit composition or comparative evidence

If the task is trivial or obviously covered, you may skip selector and execute
directly.

Once a task chooses selector, set a concrete answer for coverage:

- do we have enough good skills now
- if not, what is missing
- which missing area needs local search vs external search
- whether a known selector recipe already fits the task shape

Then choose one typed selector-preflight route:

- `direct_execute`
- `compare_then_execute`
- `compose_then_execute`
- `review_loop`

Do not leave preflight decision in `pending` once execution starts.

For substantial work, selector preflight is the default consideration path.
For trivial one-step work, direct execution is still acceptable when the extra
selector loop would add no real value.

### 2) Recipe selection

Before inventing a fresh multi-skill bundle:

- inspect `recipes/`
- prefer a standard recipe when the task shape already matches one
- keep recipes explicit in `[[recipe_log]]` rather than hiding them inside one
  skill's prose
- do not treat recipe use as permission to create hard dependencies between
  skills
- keep recipe shape explicit enough to compare:
  - fit signals
  - non-fit signals
  - execution order
  - required/optional steps
  - synthesis artifact
  - fallback guidance

### 3) Candidate planning

Treat these as candidate types:

- local skills
- external skills/tools
- research/practice references

Use `kind` to distinguish source class: `local | external | research | custom`.

Start from all visible candidates that matter for the task.

Before assuming one repo-visible local candidate can execute:

- check whether it is actually available in the current host
- if not, keep the candidate visible in the comparison set but log the gap
  explicitly through `skill_plan.availability`, `skill_plan.availability_detail`,
  preflight rationale, or fallback choice

For `kind=research`, add at least one benchmark log to avoid “only narrative,
no evidence”.

If one plan is a composed harness bundle:

- log `bagakit-skill-selector` as the `composition_entrypoint`
- log each composed peer explicitly with its canonical runtime skill id when one
  exists
- keep each peer on `fallback_strategy = "standalone_first"`

### 4) In-flight usage tracking

Append a usage event whenever a candidate is:

- selected
- used for a concrete sub-step
- skipped
- failed
- replaced

When one concrete sub-problem is retried:

- keep the same `attempt_key`
- selector will count retries and surface `try-<n>` through `attempt_index`
- if the same `attempt_key` reaches the configured threshold without success,
  selector should force a step-back and method change instead of silent retry
- when the same `attempt_key` reaches the configured threshold without success,
  selector should also create or refresh a visible `[[evolver_signal_log]]`
  suggestion when `[evolver_handoff_policy].enabled = true`, unless that signal
  was already explicitly dismissed

### 5) Evaluation loop

At minimum, provide:

- objective evidence score
- output quality score
- feedback score
- short summary

If feedback is insufficient, set
`[next_actions].needs_feedback_confirmation = true` and append a search event.

If benchmark or feedback fails, append search follow-up in the same file.

Repeated clustered failures may also be logged through `[[error_pattern_log]]`
when that helps the next task-local selector decision.

If the repeated pattern now looks large enough to deserve repository-level
review:

- record or refresh `[[evolver_signal_log]]` when
  `[evolver_handoff_policy].enabled = true`
- keep that suggestion task-local until it is explicitly exported or bridged
  into evolver intake
- do not silently open an evolver topic from selector

### 6) Close gate

Before task close, run:

- `validate` for the minimum contract
- `validate --strict` for the recommended close gate

Strict mode enforces:

- research candidates require benchmark evidence
- failed usage, negative feedback, or failed benchmark must have search
  follow-up
- retry backoff threshold hits must also have explicit search follow-up

### 7) Recipe boundary rule

`recipes/` is selector's composition knowledge surface.

It is not:

- a runtime hard-dependency control plane
- permission for one skill to silently call another
- a repository-level evolver policy surface

Task-local ranking or repeated-failure telemetry also belongs here, not in
`evolver`, as long as it remains task-local evidence rather than durable
repository learning.

### 8) Driver loading rule

If one planned local skill is Bagakit-namespaced and exposes the conventional
driver payload at `references/bagakit-driver.toml`, selector may load that file
and render a task-local driver pack.

Recommended output path:

- `.bagakit/skill-selector/tasks/<task-slug>/bagakit-drivers.md`

This driver pack is only for task-local reporting guidance.
It must not become a hidden repository-level evolver surface.
It must not define evolver topic creation policy, repository-level route
decisions, or promotion-readiness rules.

### 9) Self-evolution rule

This meta-skill should evolve using the same process:

- log `bagakit-skill-selector` as a candidate
- record where it helped or failed
- use feedback and metrics to decide the next iteration

### 10) Routing handoff rule

Before turning task-level findings into repository-level change proposals,
record the likely routing direction for the later repository-level handoff:

- `host`
  - host-only adoption or workflow learning
- `upstream`
  - reusable Bagakit capability or contract learning
- `split`
  - one host-specific part plus one reusable upstream part

This selector-side handoff hint should be recorded through
`[[evolver_signal_log]].scope_hint` when one repository-review suggestion is
being surfaced. It is not a standalone repository-level route field.

Repository-level route state belongs to `bagakit-skill-evolver`.

Do not automatically turn task evidence into an upstream evolver topic.

### 11) Evolver review signal rule

Selector may emit one task-local `[[evolver_signal_log]]` when repeated task
evidence deserves repository-level review.

Good fit:

- retry backoff threshold reached for one `attempt_key`
- one error pattern keeps recurring
- repeated failed benchmark or negative feedback loops now look reusable

That signal is:

- visible in the task log
- exportable into one evolver signal contract
- bridgeable into evolver's current intake runtime under top-level `.mem_inbox/`
  through an explicit command

That signal is not:

- an evolver topic
- a repository-level route decision
- durable promotion state

The bridge uses explicit contract normalization.

Selector-side `signal_id` stays task-local.

Only selector-local `suggested` or `exported` review signals are bridgeable.

The exported evolver intake `id` is derived as:

- normalized from `<task-id>--<signal_id>`

That keeps the task log readable without forcing selector to own repository
identity rules.

Selector may prepare the exported contract, but evolver-owned `bridge-signals`
is the canonical intake command for accepting that contract into `.mem_inbox/`.

## Resources

- selector candidate-scope semantics: `docs/specs/selector-selection-model.md`
- project-local preference hints: `docs/specs/selector-preference-surface.md`
- schema and field semantics: `references/skill-usage-file-spec.md`
- project preference file contract: `references/project-preferences-file-spec.md`
- Bagakit driver payload: `references/bagakit-driver.toml`
- standard composition recipes: `recipes/`
- starter template: `assets/skill-usage.template.toml`
- project preference template: `assets/project-preferences.template.toml`
- CLI helper: `scripts/skill_selector.ts`
