---
name: bagakit-set-loop-goal
description: Create, review, revise, or bind a compact long-running Agent Goal inside one Bagakit Feature Tracker feature. Use when a Feature needs restart, compact, handoff, loop supervision, or a fixed Goal prompt. This skill depends on bagakit-feature-tracker and does not own a separate Goal runtime, lifecycle, topology, event stream, archive, or legacy migration surface.
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
- Keep only final outcome and importance, protected invariants and non-goals,
  final acceptance and insufficiency rules, authority boundaries, durable
  orchestration principles, and bounded context references in `goal.md`.
- Put current state, next action, decisions, questions, waits, assignments,
  progress, packets, and execution evidence in Feature Tracker or its Runner.
- Admit a Goal statement only when normal successful execution would not make
  it false.
- Use `bagakit-grill` only when outcome, invariant, acceptance, authority, or
  irreversible-risk meaning remains unresolved after local inspection.
- Give the user a plain-language alignment recap before first activation or a
  direction-changing Goal revision.
- Install or revise `goal.md` only through Feature Tracker's
  `set-feature-goal` command with an expected revision. Never write Feature
  runtime state directly.
- Set the Agent Goal to the exact Feature path. Different Features may run
  concurrently; there is no global foreground Goal.
- Let Feature Tracker archive or discard the entire Feature directory,
  including `goal.md`. Do not create `.bagakit/goal/`.

Minimal workflow:

1. Resolve an existing Feature or create one with `bagakit-feature-tracker`.
2. Read `references/goal-file-contract.md`, then draft from
   `references/goal-template.md` or `render-template`.
3. Run `validate-goal` for schema, Feature binding, portability, and owner
   consistency. It does not prove semantic Goal quality; review the Kernel and
   Grill only unresolved decision-bearing meaning.
4. Explain the Goal in plain language and reconcile user corrections.
5. Run `set-goal --expected-revision <none|sha256>`. Feature Tracker writes the
   file, updates `state.json.goal_contract`, and refreshes the content-bound
   owner receipt.
6. Emit the fixed wrapper from `render-wrapper`. During execution, read
   `goal.md`, verify `owner-receipt.json`, then recover current work from
   `state.json` and `tasks.json`.
7. Update `goal.md` only for durable direction changes. Feature task progress
   must never trigger routine Goal rewrites.

Read references only when needed:

- `references/goal-file-contract.md`: ownership, content, recovery, revision,
  supervision, and wrapper contract.
- `references/goal-template.md`: canonical authoring template.
