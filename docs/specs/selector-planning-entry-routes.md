# Selector Planning Entry Routes

This document defines the stable Bagakit meaning of selector-supported
planning-entry routes.

Its job is to answer one question:

- when substantial work first arrives, which canonical planning surface should
  selector route the task into

## Purpose

Use this spec when deciding:

- whether one planning request should start in `bagakit-brainstorm`
- whether one request is already ready for `bagakit-feature-tracker`
- whether repeated bounded execution should move into `bagakit-flow-runner`
- how mandatory selector preflight for non-trivial work still allows a clean
  `direct_execute` exit
- how selector should prefer canonical Bagakit planning routes over generic
  host note-taking patterns when fit is comparable

This file is the SSOT for:

- planning-entry scene names
- standard selector recipe ids for planning entry
- route boundaries between brainstorm, feature-tracker, and flow-runner

It is not the SSOT for:

- task-local TOML field definitions
- repository-level evolver routing
- outer-driver host orchestration
- one skill silently invoking another

Those belong respectively in:

- `skills/harness/bagakit-skill-selector/references/skill-usage-file-spec.md`
- `docs/specs/selector-evolver-boundary.md`
- `docs/specs/harness-concepts.md`
- selector recipes and runtime docs

## First Principle

Selector owns explicit task-entry routing.

It does not own hidden auto-execution.

That means selector may decide and log:

- which planning route fits
- which recipe should be used
- which skills participate

It must not:

- silently create generic planning files as canonical truth
- silently call downstream skills without explicit task-local evidence
- turn route choice into repository-level policy

## Entry Gate Rule

For non-trivial Bagakit-shaped work, selector preflight is the required entry
gate before:

- choosing one canonical planning route
- inventing one new planning surface
- starting major implementation without route evidence

That gate may still conclude:

- `direct_execute`

Mandatory preflight does not mean every non-trivial task must use one
planning-entry recipe. It means route choice or direct execution must be made
explicitly first.

## Planning Entry Scenes

Selector should distinguish these scenes:

| Scene | Meaning |
| --- | --- |
| `analysis_only` | the task still needs option generation, framing, or review, but not delivery binding yet |
| `ambiguous_delivery` | the request is headed toward implementation, but scope, shape, or trade-offs are still unstable |
| `clear_delivery` | the request is already clear enough to become tracked feature work |
| `execution_ready` | the task already has canonical planning truth and now needs bounded execution flow |

## Standard Planning Entry Recipes

Selector should use these standard recipe ids when one planning-entry route is
chosen explicitly:

| Recipe Id | Scene | Participants |
| --- | --- | --- |
| `planning-entry-brainstorm-only` | `analysis_only` | `bagakit-brainstorm` |
| `planning-entry-brainstorm-to-feature` | `ambiguous_delivery` | `bagakit-brainstorm`, `bagakit-feature-tracker` |
| `planning-entry-feature-to-flow` | `clear_delivery` or `execution_ready` | `bagakit-feature-tracker`, `bagakit-flow-runner` |
| `planning-entry-brainstorm-feature-flow` | `ambiguous_delivery` with clear expectation of repeated bounded execution | `bagakit-brainstorm`, `bagakit-feature-tracker`, `bagakit-flow-runner` |

## Scene Mapping Rule

Preferred mapping:

- if the task still needs framing, option generation, or explicit review:
  - start with `bagakit-brainstorm`
- if the task is already executable feature work:
  - start with `bagakit-feature-tracker`
- if the task already has canonical planning truth and now needs repeated
  bounded execution:
  - move into `bagakit-flow-runner`

Selector should prefer these canonical routes over generic host note-taking
patterns when fit is comparable.

Generic note-taking may still be:

- visible
- host-available
- locally useful

But it should not outrank Bagakit canonical planning surfaces for substantial
Bagakit-shaped delivery work.

## Route Boundary Rule

The route boundary is:

- `bagakit-brainstorm`
  - ambiguity reduction, option generation, review, and handoff
- `bagakit-feature-tracker`
  - canonical feature and task planning truth
- `bagakit-flow-runner`
  - bounded execution flow over already-normalized work items

Selector should preserve that split.

It must not:

- treat brainstorm as the planning truth owner
- treat feature-tracker as the repeated execution driver
- treat flow-runner as the upstream planning surface

## Logging Rule

When selector preflight concludes that one planning-entry route is the right
next step:

1. record the route through `[[recipe_log]]`
2. record every participating skill through `[[skill_plan]]`
3. keep preflight decision explicit
4. record concrete execution evidence through `[[usage_log]]`

Recommended preflight mapping:

- `analysis_only`
  - usually `compare_then_execute`
- `ambiguous_delivery`
  - usually `compose_then_execute`
- `clear_delivery`
  - usually `direct_execute` or `compose_then_execute`
- `execution_ready`
  - usually `direct_execute`

Those are recommendations, not new top-level enum tokens.

## Non-Goals

This spec does not define:

- host auto-routing
- outer-driver scheduling
- heartbeat or inbox behavior
- one universal all-tasks rule that even trivial one-step work must invoke
  selector first

Those belong above selector, not inside it.
