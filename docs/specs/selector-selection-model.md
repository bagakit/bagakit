# Selector Selection Model

This document defines when `bagakit-skill-selector` should participate in a
task and how it distinguishes candidate visibility, availability, selection,
and use.

It is the source of truth for selector entry and persistence policy. Exact
episode fields live in
`skills/co-work/orchestrate/execution/bagakit-skill-selector/references/skill-usage-file-spec.md`;
repository-level learning remains governed by
`docs/specs/selector-evolver-boundary.md`.

## First principle

Selector exists to improve a real skill-route decision. It is not an execution
tax or proof that an Agent read its instructions.

Invoke selector when at least one of these can change the next action:

- two or more plausible candidates need comparison;
- several independently distributable skills need explicit composition;
- a repeated failure requires a different method or candidate;
- a maintainer explicitly requests reusable selection or evaluation evidence.

For an obvious route with no meaningful selector decision, execute directly.
Task size alone is not a trigger.

## Entry modes

Use the lightest mode that preserves the needed outcome:

1. **Direct execution** — no selector call and no selector file for an obvious
   route.
2. **Ephemeral preflight** — return a typed route in the current session but do
   not create task state.
3. **Persisted episode** — create `skill-usage.toml` only when the choice,
   composition, recovery evidence, audit, or evaluation is worth retaining.

The typed route is one of:

- `direct_execute`
- `compare_then_execute`
- `compose_then_execute`
- `review_loop`

Installing a skill or rendering its frontdoor declaration does not execute any
of these modes. The host or Agent invokes them explicitly.

## Selective persistence

A persisted selector episode is opt-in. It should contain decision-bearing
facts, not a narration of the Agent's work.

Persist an episode when it protects at least one of:

- candidate or composition rationale that a later action must audit;
- retry or recovery history that changed the method;
- verified candidate evidence useful to a later selection;
- an explicit maintainer/eval sampling request.

Do not persist merely because:

- work is non-trivial or spans several steps;
- one obvious skill was used as instructed;
- the host already has a transcript, command trace, test result, or final
  response containing the relevant operational facts;
- selector needs to prove its own invocation.

For a persisted episode, `receipt_only` remains a compact close disposition for
a direct route with no material signals. `full_episode` is required when the
episode actually contains comparison, composition, recovery, or reusable
evidence. `audit_sample` is an explicit maintainer choice.

History is not automatically useful. A task log has selection value only when
some consumer can use its decision or verified result. Raw Agent self-ratings
and duplicated progress prose are advisory at best and must not become a hard
gate.

## Candidate states

| State | Meaning |
| --- | --- |
| `visible` | selector knows the candidate exists and it is relevant enough to compare |
| `available` | the current host or session can actually use the candidate |
| `selected` | selector chose the candidate for this task |
| `used` | the candidate was invoked for a concrete step |

Rules:

- a candidate may be visible without being available;
- a candidate may be available without being selected;
- a used candidate should already be selected;
- task-local availability must not be inferred from repository visibility.

When an episode is persisted, explicit candidates live in `[[skill_plan]]` and
concrete use lives in `[[usage_log]]`. Derived surveys and rankings are views,
not additional sources of truth.

## Candidate scope

Compare only candidates capable of changing the route. The set may include:

- repository-visible Bagakit skills;
- host-installed skills or tools;
- external utilities;
- research references when discovery is the next action.

Bagakit candidates may receive a preference when fit and availability are
comparable, but Bagakit membership is not an exclusion rule. Optional project
preferences are hints; they do not override availability or task-local
judgment.

## Composition

Intentional multi-skill composition uses selector as an explicit entrypoint.
Every participant remains independently useful, and composed peers stay
standalone-first. Use a recipe only when its order or fallback guidance reduces
real coordination work.

## Retry and recovery

Selector may count attempts inside a persisted episode and require a method
change after the configured retry threshold. This is task-local recovery, not
automatic repository learning.

A retry or failure may justify an explicit Evolver signal, but selector must
not automatically open an Evolver topic, select a repository route, or promote
a conclusion. Automatic task-local signal suggestion is disabled by default.

## Authority

- `docs/specs/selector-selection-model.md` owns selector entry and candidate
  semantics.
- `skills/co-work/orchestrate/execution/bagakit-skill-selector/` owns installed runtime behavior.
- `docs/specs/selector-evolver-boundary.md` owns the selector/Evolver split.
- the host owns invocation and any automatic trace collection.
- Evolver owns repository topic, route, decision, and promotion state.

Frontmatter and driver files may declare or render guidance. They do not create
a hidden mandatory-invocation control plane.
