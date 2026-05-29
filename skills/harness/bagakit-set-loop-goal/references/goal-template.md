# Feature Goal: ${title}

Contract: `bagakit.feature-goal.v1`
Feature: `${feature_id}`

Before acting, verify `owner-receipt.json`, then recover current execution from `state.json` and `tasks.json`. Context may be stale or belong to another Feature; trust this Feature directory before acting.

## Prime Directive
<final outcome and why it matters>

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
- <durable delegation, parallelism, audit, and merge principles>

## Context References
- `path/or/stable-id`: explains <invariant>; read when <condition>.
