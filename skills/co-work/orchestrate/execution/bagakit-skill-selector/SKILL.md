---
name: bagakit-skill-selector
description: Select or compose skills only when a real candidate set, composition, repeated failure, or explicit reusable evidence can change the route; direct one-step work skips it.
metadata:
  bagakit:
    harness_layer: l1-execution
---

# bagakit-skill-selector

Use this skill only when it changes a task decision:

- compare a real set of visible candidates;
- compose independently distributable skills;
- recover from a repeated failure or retry loop; or
- preserve task evidence that a maintainer explicitly wants to reuse.

For an obvious one-step route, execute directly. Do not create a selector
episode just to prove that selector was considered.

## Invocation Contract

- **Input:** a real candidate set, composition request, repeated failure, or
  explicit reuse request with comparable fit evidence.
- **Output:** an ephemeral typed preflight or persisted usage episode naming
  candidates, route, evidence, and disposition.
- **Error:** an empty/non-comparable candidate set or conflicting operation
  fails without partial task-state mutation; selector does not invent a route.
- **Stop:** skip and stop for an obvious one-step route; otherwise close only
  after the smallest valid disposition (`receipt_only`, `audit_sample`, or
  `full_episode`).

## Frontdoor

Installing or listing this skill never invokes it. The host or Agent decides
whether the task has a decision-bearing selector problem.

Use the lightest entry that fits:

1. run `preflight --ephemeral` when a typed route is useful but no history is
   needed;
2. initialize a task episode only when the choice, composition, failure, or
   requested audit needs durable evidence;
3. close a persisted episode with the smallest valid disposition.

The policy contract is in
`references/policy-contract.toml`. It is conditional guidance, not a hidden
control plane.

## Persistence boundary

An Agent must not manually log every action. A persisted
`.bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml` is an opt-in task
episode and its source of truth when it exists.

Record only decision-bearing facts:

- the selected candidate or composition and why;
- a failed or retried route when the method changed;
- a verified result that can affect a later choice; or
- an explicit maintainer/eval request.

Routine progress, raw transcripts, and obvious direct execution stay in the
host's normal trace or the final response. `receipt_only` is available for a
small direct episode; `full_episode` and `audit_sample` are for material
evidence.

When a persisted episode records a usage event, the CLI derives retry counts
and backoff state. Do not hand-maintain per-attempt lines in the `[[BAGAKIT]]`
footer.

## Candidate states

Keep these states distinct:

- `visible`: the candidate can be seen and compared;
- `available`: the current host can actually use it;
- `selected`: it was chosen for this task;
- `used`: it was invoked for a concrete step.

Repo-visible does not imply host-available. Candidate comparison is useful only
when it can change the route. Bagakit candidates may win a comparable fit, but
that is a preference rather than an exclusion rule.

## Composition

Use selector as the explicit entrypoint when a task intentionally composes
independently distributable skills. Keep each participant standalone-first and
make the composition visible in the persisted episode when one is created.
Do not introduce silent mutual dependencies.

Recipes live in `recipes/` and are optional. If one skill already covers the
task, skip the recipe.

## Evolver boundary

`bagakit-skill-evolver` is a separate, repository-level system. Selector does
not open topics, choose routes, or promote anything.

Task-local review suggestions are off by default. If a maintainer explicitly
enables `[evolver_handoff_policy]`, selector may suggest a signal after
repeated failure; exporting or bridging it still requires an explicit command,
and Evolver still decides whether to adopt it. Prefer an explicit
`evolver-signal` when a repository review is genuinely warranted.

## Operator

Use `scripts/skill_selector.ts` with the local contract in `references/`.
`preflight --ephemeral --json` returns a typed one-shot result without writing
task state. The task mutations, candidate survey, ranking, and optional bridge
commands operate on an initialized episode.

## Runtime Surface Declaration

When materialized, the runtime marker is
`.bagakit/skill-selector/surface.toml`; the runtime root is
`.bagakit/skill-selector/`. This host-local surface is not repository-level
learning memory.
The stable contract is `docs/specs/runtime-surface-contract.md`.

Canonical monorepo guidance, when available, is maintainer context only; the
installed skill remains usable from its own files.
