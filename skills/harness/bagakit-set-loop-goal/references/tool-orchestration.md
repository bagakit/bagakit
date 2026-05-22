# Tool Orchestration

The Goal defines durable authority and orchestration principles. Exactly one
execution owner holds the live plan, tasks, assignments, packets, and evidence.

## Owner Selection

Choose in order:

1. an existing accepted Spec, Feature, or project-native owner that already
   owns current execution truth
2. a new Feature created through `bagakit-feature-tracker`
3. beneath that owner, `bagakit-flow-runner` for repeated bounded rounds

Do not point `execution_owner` into `.bagakit/goal/`. Do not list several owners
as peers. Secondary tools are indexed by the owner.

## Adaptive Teams

Use parallel workers when branches are genuinely independent, outputs have
distinct owners, and the merge or audit rule is clear. Scale effort to task
value, dependency shape, context size, and cost.

The durable Goal may state:

- preserve several independent approaches before converging
- give each branch an objective, boundaries, output format, tools or sources,
  evidence bar, and stop condition
- require adversarial review of candidate results
- keep unrelated safe work moving while one branch waits
- avoid global synchronous barriers

The owner records the live approach registry, worker count, assignments,
progress, budget, packet state, and merge disposition. Do not hard-code a
worker count or fixed roster in Goal unless an external constraint makes it
permanently true.

Multi-agent work is not free. Prefer it for high-value parallel branches and
large independent context. Coding tasks often expose fewer safe parallel
writes than research; use disjoint write scopes and explicit integration.

## Supervisor

`supervisor.md` defines stable checkpoint policy. The execution owner stores
the current packet and evidence. A supervisor may:

- identify target, method, scope, evidence, retry, risk, or context drift
- update owner truth
- propose a Kernel delta
- ask for a decision at a protected boundary
- recommend stop or closeout

It must not duplicate implementation, wait as a global barrier when unrelated
work is available, or write live packet state into Goal Markdown.

## Sidecar Analysis

Grok or another sidecar is analysis, not executor authority. Its raw output
stays in a sidecar or research surface. Distill only:

- a candidate Kernel delta
- an owner task or decision update
- a risk, non-goal, acceptance change, or context reference
- a Grill question when user authority is required

Unavailable sidecar analysis must be recorded as unavailable, never implied.

## Specs, Plans, Brainstorm, And Research

- OpenSpec or equivalent owns formal requirements and accepted change state.
- Feature Tracker owns feature lifecycle, tasks, gates, and workspace state.
- Flow Runner owns repeated rounds, checkpoints, incidents, and resume payloads.
- Brainstorm owns option exploration and trade-offs.
- Grill owns dependency-ordered user decisions for a concrete conflict.
- Researcher owns source cards, claims, counterevidence, and synthesis.
- Consensus Ledger owns recoverable shared-understanding state.

The Goal keeps only stable principles and bounded references. The execution
owner indexes whichever secondary surfaces affect current work.

## Delegation Packet

Every delegated branch should receive:

```text
objective: exact branch outcome
boundaries: files, decisions, and actions it may or may not own
output: required artifact or structured result
tools_and_sources: preferred or forbidden routes
evidence: what makes the result usable
stop: completion, escalation, and budget condition
```

This packet lives with the owner or runner because assignments change. The Goal
may retain only the durable rule that such packets are required.
