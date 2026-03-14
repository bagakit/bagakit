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
- whether frontmatter is only declaration or a mandatory invocation policy
- how project-local selector preferences may bias comparison without becoming
  policy

This file is the SSOT for:

- selector candidate-scope semantics
- the terms `visible`, `available`, and `selected`
- Bagakit-aware preference rules inside selector

It is not the SSOT for:

- selector-versus-evolver boundary authority
- runtime command examples
- per-task file field contracts
- scoring heuristics or ranking formulas

Those belong respectively in:

- `docs/specs/selector-evolver-boundary.md`
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

## Frontmatter Rule

Selector may use skill frontmatter as declaration metadata.

Good uses include:

- identifying Bagakit-namespaced skills
- reading `metadata.bagakit.harness_layer`
- loading conventional Bagakit driver files when they exist

Frontmatter is not the place to impose a repository-wide mandatory rule such
as:

- every task must invoke selector first

Invocation remains an operator or task-level preflight decision.

So the correct rule is:

- selector should be considered first for substantial work
- selector should not become a universal mandatory wrapper
- frontmatter may declare capabilities, but it must not silently force
  selector invocation policy

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
