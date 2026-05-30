---
name: bagakit-set-loop-goal
description: Create, review, revise, or activate a compact convergence-directed Agent Goal inside one Bagakit Feature Tracker feature. Use when a Feature needs restart, compact, handoff, loop supervision, or a fixed Goal prompt. This skill depends on bagakit-feature-tracker and does not own a separate Goal runtime, lifecycle, topology, event stream, archive, or legacy migration surface.
metadata:
  bagakit:
    harness_layer: l1-execution
---

# Bagakit Set Loop Goal

Create one optional `goal.md` inside an existing Feature Tracker feature:

```text
.bagakit/feature-tracker/features/<feature-id>/goal.md
```

The Goal is a stable Agent control contract. Feature Tracker remains the only
owner of lifecycle, tasks, workspace, dependencies, blockers, evidence,
receipts, and closeout.

Core contract:

- Depend on `bagakit-feature-tracker`; create or resolve the Feature first.
- Classify the Goal as `terminal` or `frontier` and name its closure oracle or
  ratchet before drafting. If it cannot be classified, inspect first and Grill
  the unresolved decisions; do not activate it.
- Bind only the smallest independently closable Feature. A parent program,
  multiple verticals, or open-ended improvement without a ratchet is context
  or Feature topology, not one executable Goal.
- Keep only final outcome and importance, protected invariants and non-goals,
  convergence and stop rules, authority boundaries, durable orchestration
  principles, and bounded context references in `goal.md`.
- Put current state, next action, decisions, questions, waits, assignments,
  progress, packets, and execution evidence in Feature Tracker or its Runner.
- Admit a Goal statement only when normal successful execution would not make
  it false.
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
4. Run `validate-goal` for authoring version, convergence markers, Feature
   binding, portability, and owner consistency. Review semantic fitness; a
   marker alone does not prove that its oracle or ratchet is real.
5. Explain the Goal in plain language and reconcile user corrections.
6. Run `set-goal --expected-revision <none|sha256>`. Feature Tracker writes the
   file, updates `state.json.goal_contract`, and refreshes the content-bound
   owner receipt.
7. Emit the fixed wrapper from `render-wrapper`; activate that exact text with
   the host's Goal setter when available and verify the resulting native Goal.
   During execution, recover through `goal.md`, `owner-receipt.json`,
   `state.json`, and `tasks.json`.
8. Apply the requirement-intake gate in `references/goal-file-contract.md`
   before executing a newly introduced requirement.
9. Update `goal.md` only for durable direction changes. Feature task progress
   must never trigger routine Goal rewrites.

Read references only when needed:

- `references/goal-file-contract.md`: ownership, content, recovery, revision,
  supervision, and wrapper contract.
- `references/convergence-contract.md`: mode taxonomy, Goal sizing, stopping,
  scope expansion, vertical-first execution, and engineering entropy rules.
- `references/goal-template.md`: canonical authoring template.
