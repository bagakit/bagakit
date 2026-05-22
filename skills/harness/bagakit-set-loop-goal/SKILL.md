---
name: bagakit-set-loop-goal
description: Create, upgrade, or update high-quality Goal control files for long-running agent work. Use when a task needs restart, compact, handoff, loop supervision, sidecar analysis, multiple coexisting Goals, legacy or incomplete Goal recovery, protocol migration, or execution control through a compact steering index rather than a chat transcript, full plan, or log bucket.
metadata:
  bagakit:
    harness_layer: l1-execution
---

# Bagakit Set Loop Goal

Create a compact Goal Kernel that stays correct while execution changes. A
fresh executor recovers through one fixed chain:

```text
current.md -> state.yaml -> Goal Kernel -> execution_owner -> current owner task or receipt
```

Core contract:

- Lock the surface to `bagakit.goal.v.0.3`; inspect and upgrade older or
  incomplete Goals before normal mutation.
- Admit a statement to the Goal Kernel only when normal successful execution
  would not make it false.
- Keep only final outcome and importance, protected invariants and non-goals,
  acceptance and insufficiency rules, stop/escalation boundaries, durable
  authority/orchestration principles, and bounded context references.
- Every unarchived Goal has exactly one `execution_owner`. Reuse a compatible
  Spec, Feature, or equivalent owner; when none exists, create a Feature with
  `bagakit-feature-tracker`.
- Put current state, next actions, recent decisions, open questions, blockers,
  waits, assignments, HEAD/release/auth state, supervisor packets, and execution
  evidence in that owner. Use `bagakit-flow-runner` for repeated rounds.
- Keep `.bagakit/goal/current.md` as the executor entrypoint and
  `.bagakit/goal/state.yaml` as foreground, topology, lifecycle cache, owner
  pointer, and event cursor. Multiple incomplete Goals may coexist, but exactly
  one is foreground.
- Keep `supervisor.md` as stable checkpoint policy. Store live packets in the
  execution owner; the supervisor corrects owner truth or the Kernel and does
  not become another executor or a global synchronous barrier.
- Scale teams dynamically to independent branches. The Goal may define
  division-of-labor, output, audit, merge, and budget principles, but never a
  stale fixed roster or current assignment table.
- Treat new user ideas and sidecar analysis as candidate Kernel or owner
  deltas, never direct implementation authority.
- When required Kernel meaning is unresolved, inspect local evidence first.
  Use `bagakit-grill` as the default resolver only for remaining
  decision-bearing outcome, invariant, acceptance, authority, or risk gaps;
  repair deterministic formatting gaps without questioning the user.
- After nontrivial creation or direction changes, explain the Goal in plain
  language and route corrections back to the Kernel or owner.
- Archive complete or explicitly abandoned Goals so they cannot interfere with
  current execution. Never abandon an unfinished Goal merely because another
  Goal becomes foreground.
- When the user asks for Goal or Loop text, emit the fixed `current.md` wrapper
  and include `supervisor.md` when present; do not freestyle it.

Minimal workflow:

1. Inspect `current.md`, `state.yaml`, protocol version, foreground Goal, and
   candidate execution owners.
2. Create or select exactly one owner. If no compatible owner exists, create a
   Feature through `bagakit-feature-tracker` before writing the Goal.
3. Draft the five-section Kernel and apply the staleness admission test to
   every statement. Put explanatory context only in bounded references with a
   reason and read condition.
4. If a semantic Kernel gap remains, hand the concrete conflict packet to
   Grill. Ask one decision-bearing question at a time.
5. Upgrade or write the surface, then run `fresh-check`. Legacy dynamic truth
   must be classified in a hash-bound owner migration receipt before v0.3
   rewrites the Goal; the operator preserves a collision-checked pre-v0.3
   archive snapshot.
6. During execution, update the owner first. Append a Goal event only when a
   change affects Kernel direction, lifecycle, or a user gate, then reconcile
   the event cursor against owner evidence.
7. Run supervisor checkpoints without blocking unrelated safe work. Render
   Driver feedback from explicit owner evidence and report unknown rather than
   guessing progress or budget.
8. Mark `status: complete` only with completion evidence, archive the Goal, and
   select another foreground Goal when needed.

Read references only when needed:

- `references/goal-file-contract.md`: Kernel admission, owner contract,
  placement, recovery, alignment recap, wrapper, and template.
- `references/event-stream-contract.md`: Goal events versus owner state,
  reconciliation cursor semantics, and archive rules.
- `references/protocol-upgrade-contract.md`: version detection, legacy and
  incomplete-surface upgrades, conflict packets, and Grill routing.
- `references/bagakit-driver.toml`: event-driven Goal reporting, evidence-backed
  progress and budget checks, discoveries, and shared Alert candidates.
- `references/tool-orchestration.md`: owner selection, adaptive teams, sidecar,
  OpenSpec, Brainstorm, Feature Tracker, and Flow Runner.
- `references/loop-off-loop.md`: supervisor.md contract, Goal or Loop command
  invocation wrappers, drift classes, and packet semantics.
- `references/design-origin.md`: original user discussion, FAQ, and design
  rationale for evolving this skill.
- `references/frontdoor-rule.toml`: project frontdoor declaration.
