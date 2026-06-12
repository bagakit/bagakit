---
name: bagakit-set-loop-goal
description: Create or revise a compact Agent Goal inside a Feature Tracker feature when restart, handoff, supervision, or convergence needs a fixed prompt.
metadata:
  bagakit:
    harness_layer: l1-execution
---

# Bagakit Set Loop Goal

Create one optional `goal.md` inside an existing Feature Tracker feature:

```text
.bagakit/feature-tracker/features/<feature-id>/goal.md
```

The Goal defines stable intent, principles, and how to obtain current state;
it never embeds the retrieved state. Feature Tracker remains the only owner of
lifecycle, tasks, workspace, dependencies, blockers, evidence, and closeout.

Core contract:

- Depend on `bagakit-feature-tracker`; create or resolve the Feature first.
- This is an ownership dependency, not a best-effort fallback. `render-template`
  and `render-wrapper` may produce draft text without a live Tracker, but
  `validate-goal` and `set-goal` must delegate to a compatible Feature Tracker
  CLI and fail closed when its owner surface is unavailable or uninitialized.
  Manual writes to `.bagakit/feature-tracker` are unsupported.
- Classify the Goal as `terminal` or `frontier` and name its closure oracle or
  ratchet before drafting. If it cannot be classified, inspect first and Grill
  the unresolved decisions; do not activate it.
- Bind only the smallest independently closable Feature. A parent program,
  multiple verticals, or open-ended improvement without a ratchet is context
  or Feature topology, not one executable Goal.
- Keep only final outcome and importance, protected invariants and non-goals,
  convergence and stop rules, authority boundaries, durable orchestration
  principles, state-recovery methods, and bounded context references in `goal.md`.
- Label every requirement by provenance: user Goal, reviewed Feature Task,
  derived plan hypothesis, or environment observation. Only user Goal and
  reviewed Feature Task truth may define acceptance; a plan hypothesis is not
  a new requirement until it is promoted through the reviewed Feature path.
- Before activation, run a contradiction preflight across outcome, invariants,
  non-goals, acceptance, authority, and environment assumptions. Grill or hand
  back unresolved conflicts instead of activating an optimistic interpretation.
- During execution, keep one bounded plan committed until closure evidence, a
  falsifying signal, or a declared effort threshold. Re-plan only on an
  explicit trigger and within a budget; record the reason and preserve the last
  valid state when the budget is exhausted.
- Treat plan depth, retries, extra agents, and extra tools as budgeted choices
  that need an expected decision or verification payoff. They are not
  convergence evidence.
- Put current state, next action, decisions, questions, waits, assignments,
  progress, packets, and execution evidence in Feature Tracker or its Runner.
- Admit only durable direction or a repeatable recovery rule. Exclude current
  and historical snapshots even if dated, sourced, or still factually true.
- Use `bagakit-grill` only when outcome, invariant, acceptance, authority, or
  irreversible-risk meaning remains unresolved after local inspection.
- Give the user a plain-language alignment recap before first activation or a
  direction-changing Goal revision.
- Before any new optimization or implementation, check the request against the
  Goal and current Feature task truth for drift. Record each accepted new
  requirement in the appropriate reviewed Feature Task before acting.
- Install or revise `goal.md` only through Feature Tracker's
  `set-feature-goal` command with an expected revision. Never write Feature
  runtime state directly.
- Author from `references/goal-template.md` and preserve its required metadata,
  state-recovery section, and section order. A free-form paragraph or custom
  layout is invalid even when it contains the convergence markers.
- Distinguish authored, Feature-bound, and host-activated. A successful write
  is not activation. Set the host Agent Goal to the exact wrapper, then verify
  it through the host or obtain explicit user confirmation before claiming the
  Goal is active.
- One host thread has at most one active Feature Goal. Rebind or clear stale
  native Goal text when switching Features. Different Features may run in
  separate threads; there is no repository-global foreground Goal.
- Let Feature Tracker archive or discard the entire Feature directory,
  including `goal.md`. Do not create `.bagakit/goal/`.

Minimal workflow:
1. Resolve an existing Feature or create one with `bagakit-feature-tracker`.
2. Read `references/convergence-contract.md`, classify the Goal, and split any
   program-sized scope before authoring.
3. Read `references/goal-file-contract.md`, then draft with `render-template`.
   Describe where and how to recover state; keep query results in Feature evidence.
4. Run the contradiction and provenance preflight from the references. If the
   candidate adds requirements during planning, route them through the
   requirement-intake gate before treating them as binding.
5. Run `validate-goal` for authoring version, convergence markers, Feature
   binding, portability, and owner consistency. Review semantic fitness; a
   marker alone does not prove a real oracle, ratchet, or snapshot-free Goal.
6. Explain the Goal in plain language and reconcile user corrections.
7. Run `set-goal --expected-revision <none|sha256>`. Feature Tracker writes the
   file, updates `state.json.goal_contract`, and refreshes the content-bound
   owner receipt.
8. Emit the fixed wrapper from `render-wrapper`; activate that exact text with
   the host's Goal setter when available and verify the resulting native Goal.
   During execution, recover through `goal.md`, `owner-receipt.json`,
   `state.json`, and `tasks.json`.
9. Apply the requirement-intake gate in `references/goal-file-contract.md`
   before executing a newly introduced requirement.
10. Update `goal.md` only for durable direction changes. Feature task progress
   must never trigger routine Goal rewrites.

Read references only when needed:

- `references/goal-file-contract.md`: ownership, content, recovery, revision,
  supervision, and wrapper contract.
- `references/convergence-contract.md`: mode taxonomy, Goal sizing, stopping,
  scope expansion, vertical-first execution, and engineering entropy rules.
- `references/goal-template.md`: canonical authoring template.
