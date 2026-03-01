---
name: bagakit-skill-evolver
description: Use when a repository evolution topic is long-lived, spans multiple candidates or decisions, and needs structured memory beyond a one-off note. Use to decide whether to open an evolver topic, record candidates or decisions, and attach optional local context refs without making hidden docs workspaces a hard dependency.
metadata:
  bagakit:
    harness_layer: l2-behavior
---

# Bagakit Skill Evolver

Use this skill only for high-value repository evolution topics.

Good fit:

- the topic will span multiple sessions
- there are multiple candidates to compare
- the decision rationale needs to survive beyond the current chat
- the topic may point to local hidden docs research workspaces as optional
  context

Do not use this skill for:

- one-off implementation tasks
- short-lived local notes
- simple explanations that the agent can just write directly

## Boundary

This skill is the agent-facing behavioral layer.

It does:

- decide when evolver tracking is worth using
- record `preflight` decisions before a topic grows
- record repository-level route decisions:
  - `host`
  - `upstream`
  - `split`
- structure the topic, candidate, decision, and status loop
- record sources, summaries, feedback, benchmarks, and promotions
- optionally attach weak local context refs to researcher-owned workspaces
- maintain derived steward-facing topic reports from topic state
- maintain derived next-session handoff artifacts from topic state
- maintain archive receipts for archived topics
- keep durable promotions typed by repository surface
- keep promotion intent distinct from landed durable changes
- keep promotion identities stable across updates

It does not:

- run the repository's research workflow itself
- treat hidden docs workspaces as required inputs
- own raw per-task selector logs
- own task-local evaluation
- replace ordinary docs or straightforward execution

Conceptually, `evolver` contains two planes:

- `memory plane`
  - repository-evolution intake, linking, indexing, retrieval, and archive
    behavior
- `decision plane`
  - candidate comparison, decision memory, promotion tracking, and durable
    surface upgrades

`researcher` should stay separate.
It produces research evidence that `evolver` may later consume, but it should
not be folded into the evolver skill itself.

## Runtime Contract

Primary state lives under:

- `.bagakit/evolver/`

Optional local context may live under:

- `.bagakit/researcher/topics/<topic-class>/<topic>/`
- or the standalone fallback `docs/.<topic-class>/<topic>/`

Those local docs paths are weak references only.

## Four-Layer Rule

Think in these layers:

1. hidden research
   - local evidence under researcher-owned workspaces or the standalone hidden-docs fallback
2. structured decision memory
   - topic-local state under `.bagakit/evolver/topics/<slug>/`
3. project runtime state
   - repository-wide evolver state under `.bagakit/evolver/`
4. durable repository surfaces
   - `docs/specs/`, `docs/stewardship/`, and `skills/`

Do not collapse these into one giant memory bucket.

## Recommended Flow

1. Decide whether this topic deserves evolver tracking.
   If it is single-session or single-decision, do not use evolver.

2. If yes, open or update one topic in `.bagakit/evolver/`.

3. Add candidates only when comparison is real.

4. Record source, summary, feedback, and benchmark evidence when they are
   materially useful.

   Research evidence may be produced elsewhere, for example by a separate
   `researcher` system.
   `evolver` does not need to own that workflow.

5. Record decisions only when the rationale is worth preserving.

6. Record one repository-level route decision when the topic is mature enough to
   decide:
   - `host`
   - `upstream`
   - `split`

   Do not force selector-owned task evidence to impersonate this decision.

7. Add `local_context_refs` only as optional repo-relative pointers.

8. Promote stable conclusions upward:
   - stable repository rules -> `docs/specs/`
   - maintainer procedures -> `docs/stewardship/`
   - runtime-facing capabilities -> `skills/`

9. Use the steward-facing topic report plus the next-session handoff artifact as
   the compression layer before durable
   promotion.

## Operator Preference

Low-level operator:

- `scripts/evolver.ts`

Use `node --experimental-strip-types scripts/evolver.ts ...` for state changes.

If the operator cannot be used:

- edit `.bagakit/evolver/` minimally and carefully
- keep the same weak-link boundary
- do not make hidden docs paths mandatory

## Quality Rule

A good evolver topic should answer:

- what is the topic
- whether it passed `preflight`
- what candidates exist
- what evidence exists
- what decisions were made
- what route was chosen and why
- what status the topic is in
- which local context refs are useful, if any
- what durable surface, if any, the topic is ready to promote into
- what the next steward should do if the topic stays open

A bad evolver topic is one that duplicates ordinary notes without adding
structured decision value.

## Current Optimization Queue

The current implementation direction after this baseline is:

1. harden route and promotion-readiness workflow
2. add stronger promotion workflows into stable repository surfaces
3. keep handoff and archive ergonomics derived from topic SSOT instead of
   adding ad hoc side channels
