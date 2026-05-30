# Feature Goal: ${title}

Contract: `bagakit.feature-goal.v1`
Feature: `${feature_id}`
Convergence: `${convergence}`
Closure: `${closure}`

Before acting, verify `owner-receipt.json`, then recover current execution from `state.json` and `tasks.json`. Context may be stale or belong to another Feature; trust this Feature directory before acting.

## Prime Directive
<final outcome and why it matters>

## Convergence Contract
- Smallest sufficient closure: <the narrowest independently valuable outcome this Feature must close>
- Oracle or ratchet: <observable state, threshold, budget result, or monotonic comparison>
- Scope expansion: <route adjacent discoveries to child Features or backlog unless required for this closure>
- Completion or cycle stop: <the evidence that ends a terminal Goal or one bounded frontier cycle>

## Protected Invariants
- <principle or constraint that must remain true>
- Non-goal: <neighboring outcome that must not replace this Goal>

## Acceptance And Stop Rules
- Acceptance: <observable final evidence>
- Insufficient: <plausible partial result that does not count>
- Stop and ask before: <authority, privacy, cost, risk, or irreversible boundary>

## Authority And Orchestration
- Follow only this Feature's owner receipt, state, and reviewed tasks.
- Before any new optimization or implementation, compare the request with this Goal and current Feature task truth; stop on unexplained drift.
- Do not implement a chat-only requirement. First record each accepted new requirement in the appropriate reviewed Feature Task through Feature Tracker.
- Prove the cheapest representative user-visible vertical before broad horizontal infrastructure.
- For engineering work, satisfy acceptance first; among valid solutions minimize enduring states, owners, APIs, abstractions, duplicated truth, and temporary scaffolding.
- <durable delegation, parallelism, audit, and merge principles>

## Context References
- `path/or/stable-id`: explains <invariant>; read when <condition>.
