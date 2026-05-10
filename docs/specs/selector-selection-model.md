# Selector Selection Model

This document defines the stable Bagakit meaning of selector candidate scope.

Its job is to make selector's selection loop precise without confusing:

- repo-visible skill knowledge
- host-available execution capability
- task-local selection authority

## Purpose

Use this spec when deciding:

- what candidate set selector should consider
- how repo-visible skills differ from host-available skills
- why Bagakit skills may be preferred without becoming exclusive
- where mandatory selector preflight policy lives and why frontmatter stays
  declaration-only
- how project-local selector preferences may bias comparison without becoming
  policy

This file is the SSOT for:

- selector candidate-scope semantics
- the terms `visible`, `available`, and `selected`
- Bagakit-aware preference rules inside selector
- mandatory selector preflight for non-trivial Bagakit-shaped work

It is not the SSOT for:

- the full selector evidence data model
- selector-versus-evolver boundary authority
- runtime command examples
- per-task file field contracts
- scoring heuristics or ranking formulas

Those belong respectively in:

- `docs/specs/selector-data-model.md`
- `docs/specs/selector-evolver-boundary.md`
- `docs/specs/selector-planning-entry-routes.md`
- `docs/specs/selector-preference-surface.md`
- `skills/harness/bagakit-skill-selector/`
- `skills/harness/bagakit-skill-selector/references/skill-usage-file-spec.md`
- runtime selector docs and eval assets

## First Principle

`bagakit-skill-selector` owns one task-local question:

- what is the best explicit skill choice or composition for this task

To answer that question well, selector may be repo-aware.

That means selector may know:

- which canonical Bagakit skills exist in this repository
- which skills expose conventional Bagakit driver files
- which standard selector recipes already describe common combinations

Repo awareness does not mean selector assumes those skills are executable in
the current host.

Repo awareness is a task aid, not a repository-level control plane.

The broader selector evidence vocabulary is defined in:

- `docs/specs/selector-data-model.md`

In that vocabulary, one selector task is a `selection_episode` containing
task signals, candidates, selection lessons, composition patterns,
candidate results, lesson updates, and optional evolver signals.

## Mandatory Preflight Rule

For non-trivial Bagakit-shaped work, selector preflight is mandatory before
major implementation starts.

This rule means:

- mandatory preflight is the required entry gate for non-trivial
  Bagakit-shaped work
- preflight may still conclude `direct_execute`
- preflight may still conclude that current coverage is already sufficient or
  that no better candidate exists
- trivial one-step work may execute directly without selector ceremony

Mandatory preflight therefore does not mean:

- every task must compare multiple candidates
- every task must compose multiple skills
- every task must enter one planning-entry recipe
- every routine `direct_execute` task must manufacture a full planning, usage,
  and evaluation episode after the required preflight receipt exists

## Post-Run Disposition Rule

Selector keeps mandatory entry evidence cheap and makes deeper persistence
signal-driven.

Every selector task that reaches post-run close should persist one typed
disposition in its task-local `skill-usage.toml`:

- `receipt_only`
  - routine `direct_execute`
  - no comparison, composition, review, failure, retry, feedback, benchmark,
    learning, or other material selector signal
- `full_episode`
  - mandatory when any material selector signal exists
  - specifically mandatory for `compare_then_execute`,
    `compose_then_execute`, and `review_loop`
- `audit_sample`
  - deliberate full-record sampling of an otherwise routine direct route

The mandatory minimum is still the preflight receipt created before major
implementation. `receipt_only` reduces post-run ceremony; it does not weaken
the frontdoor rule.

`audit_sample` is not an escape from evidence requirements. It satisfies the
same complete-record and strict close checks as `full_episode`. If material
signals are present, the disposition must be exactly `full_episode` so the
reason for retention remains explicit.

The per-task field contract and deterministic close command live in:

- `skills/harness/bagakit-skill-selector/references/skill-usage-file-spec.md`
- `skills/harness/bagakit-skill-selector/scripts/skill_selector.ts`

## Candidate States

Selector should distinguish these states:

| State | Meaning |
| --- | --- |
| `visible` | selector knows the candidate exists and is relevant enough to compare |
| `available` | selector has enough evidence that the candidate is usable in the current host, session, or workspace |
| `selected` | selector has chosen the candidate as part of this task's explicit plan |
| `used` | the candidate was actually invoked for a concrete task step |

State rules:

- every `selected` candidate must first be `visible`
- every `used` candidate should already be `selected`
- a candidate may be `visible` without being `available`
- a candidate may be `available` and still not be `selected`

Task-local runtime rule:

- explicit task candidates belong in `[[skill_plan]]`
- `selected` is recorded directly in `[[skill_plan]]`
- task-local availability judgment is recorded directly in `[[skill_plan]]`
- `used` is still recorded through `[[usage_log]]`
- broader comparison views such as `candidate-survey.md` are derived reports,
  not second task SSOT files

Candidate state is intentionally split across concerns:

- visibility and availability answer whether the candidate can be considered
- selection answers whether selector chose it for this episode
- usage and candidate result answer what happened after it was tried

For richer task evidence, use the data-model concepts:

- `candidate`
- `candidate_result`
- `selection_lesson`
- `lesson_update`

from `docs/specs/selector-data-model.md`.

## Selection Scope Rule

Selector's comparison set should include all visible candidates that matter for
the task.

Typical visible candidates include:

- repo-visible canonical Bagakit skills
- host-visible installed skills or tools
- explicit external skills or utilities
- research or practice references when the task still needs discovery

Selector therefore is not limited to Bagakit-only candidates.

Bagakit is the preferred family when fit is comparable, because Bagakit skills
often provide:

- clearer runtime boundaries
- selector recipes
- selector-loadable drivers
- stronger task-local evidence hooks
- standalone-first composition contracts

That is a preference rule, not an exclusion rule.

If a non-Bagakit candidate, an external tool, or a mixed bundle is the better
fit, selector should say so explicitly and log it.

## Project-Local Preference Rule

Selector may read optional host-local hints from:

- `.bagakit/skill-selector/project-preferences.toml`

That surface is defined in:

- `docs/specs/selector-preference-surface.md`

These hints may bias comparison or annotate a derived candidate survey.

They must not:

- override task-local availability truth
- replace task-local candidate planning
- become repository policy

## Availability Rule

Repo-visible does not mean host-available.

Selector may inspect a canonical repo skill and still conclude:

- the skill is not installed in this host
- the host lacks the needed runtime or dependency
- the skill is visible but should only be treated as a comparison reference

Required behavior:

- check availability before assuming a candidate can execute
- keep visibility and availability separate in reasoning and reporting
- if one repo-visible candidate is not host-available, keep the gap explicit in
  preflight, plan rationale, or notes

This separation is what lets selector both:

- understand the Bagakit repository as a skill catalog
- remain honest about what the current host can actually do

## Metadata Rule

Selector may use skill frontmatter as declaration metadata.

Good uses include:

- identifying Bagakit-namespaced skills
- reading `metadata.bagakit.harness_layer`
- discovering conventional Bagakit driver files when they exist
- choosing one standard planning-entry recipe when substantial work should move
  into canonical Bagakit planning surfaces

Frontmatter is not the place to impose a repository-wide mandatory rule such
as:

- every task must invoke selector first
- this one skill silently forces selector entry policy

Mandatory selector preflight policy belongs in shared specs and workspace
bootstrap guidance, not in per-skill frontmatter.

So the correct rule is:

- selector preflight is mandatory for non-trivial Bagakit-shaped work
- trivial one-step work may bypass selector
- mandatory preflight may legitimately end in `direct_execute`
- frontmatter may declare capabilities, but it must not silently force
  selector invocation policy

## Frontdoor Rule

Skill installation and skill frontmatter are discovery mechanisms, not a
reliable execution frontdoor.

For a project to actually enforce selector entry, the rule must appear in that
project's root bootstrap guidance such as `AGENTS.md` or an equivalent managed
instruction block.

The active frontdoor text should preserve these semantics:

- non-trivial Bagakit-shaped work starts with selector preflight
- the preflight result may be `direct_execute`
- trivial one-step work may skip selector
- selector runtime evidence belongs under
  `.bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml`
- the project frontdoor points to this spec instead of copying a full selector
  playbook

When a project uses the grouped Bagakit frontdoor format, selector's root rule
should be rendered as a `<bagakit-rule skill="bagakit-skill-selector">` item in
the `BAGAKIT:FRONTDOOR` managed region. That rendered format is defined in:

- `docs/specs/frontdoor-index-contract.md`

This keeps the mandatory policy visible to host agents without turning
frontmatter into a hidden control plane.

## Composition Rule

Selector's scope includes explicit multi-skill composition.

That means selector may choose:

- one standalone skill
- one external tool
- one mixed bundle of several skills and tools

Bagakit composition rules remain:

- composition should stay explicit
- participating skills should remain standalone-first
- recipes describe recommended compositions, not hard dependencies

## Planning Entry Rule

For non-trivial Bagakit-shaped planning work that reaches route selection,
selector should prefer the standard planning-entry recipes defined in:

- `docs/specs/selector-planning-entry-routes.md`

That means generic host note-taking patterns may remain visible, but they
should not outrank canonical Bagakit planning routes when fit is comparable.

## Boundary Reminder

Selector-owned project state under `.bagakit/skill-selector/` remains:

- task-local
- host-local
- adoption-oriented

It must not silently become:

- repository-level decision memory
- repository-level route authority
- evolver topic state

Those remain evolver-owned concerns.
