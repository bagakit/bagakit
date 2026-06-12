# Feature Goal: ${title}

Contract: `bagakit.feature-goal.v1`
Feature: `${feature_id}`
Convergence: `${convergence}`
Closure: `${closure}`

This Goal contains durable direction and state-recovery rules only. Keep current and historical snapshots, query results, and execution evidence in Feature-owned surfaces.

## State Recovery
- Before acting, verify `owner-receipt.json`, then recover the current task, continuation, blockers, and evidence references from `state.json` and `tasks.json` in this Feature directory.
- Follow those evidence references and the reviewed tasks' verification procedures to establish acceptance status; consult authoritative sources again when freshness matters.
- Context may be stale or belong to another Feature. If owner state is missing or inconsistent, follow the owner repair or escalation path before resuming execution; do not infer state from chat or Goal prose.

## Prime Directive
<final outcome and why it matters>

## Convergence Contract
- Smallest sufficient closure: <the narrowest independently valuable outcome this Feature must close>
- Oracle or ratchet: <observable state, threshold, budget result, or monotonic comparison>
- Scope expansion: <route adjacent discoveries to child Features or backlog unless required for this closure>
- Completion or cycle stop: <the evidence that ends a terminal Goal or one bounded frontier cycle>
- Requirement authority: <user Goal and reviewed Feature Task truth; derived plans remain provisional>
- Re-plan boundary: <falsifying signal, closure evidence, or effort threshold plus the re-plan budget>

## Protected Invariants
- <principle or constraint that must remain true>
- Non-goal: <neighboring outcome that must not replace this Goal>

## Acceptance And Stop Rules
- Acceptance: <observable final evidence>
- Insufficient: <plausible partial result that does not count>
- Stop and ask before: <authority, privacy, cost, risk, or irreversible boundary>

## Authority And Orchestration
- Follow only this Feature's owner receipt, state, and reviewed tasks.
- Before substantial work and after every review, re-read this Goal and the current acceptance evidence.
- Take the smallest action that directly advances that evidence or removes a real blocker. Defer anything not required for the current closure; stop when acceptance and applicable mandatory gates are satisfied.
- Do not implement a chat-only requirement. First record each accepted new requirement in the appropriate reviewed Feature Task through Feature Tracker.
- Label new statements as user Goal, reviewed Feature Task, derived plan
  hypothesis, or environment observation. Do not promote a plan hypothesis to
  acceptance without the reviewed Feature path.
- Do not rewrite the plan after every local setback. Re-plan only on the
  declared trigger and record the reason, expected payoff, and remaining
  budget in Feature-owned state.
- Prove the cheapest representative user-visible vertical before broad horizontal infrastructure.
- For engineering work, satisfy acceptance first; among valid solutions minimize enduring states, owners, APIs, abstractions, duplicated truth, and temporary scaffolding.
- <durable delegation, parallelism, audit, and merge principles>

## Context References
- `path/or/stable-id`: explains <invariant>; read when <condition>.
