# Project Chronicle Contract

This specification defines the stable Bagakit boundary for turning project
sessions into an evidence-grounded chronicle and harness-evolution ledger.

## First Principle

Epic framing is an editorial lens, not an evidence class.

A project chronicle may make project history memorable through generations,
roles, reversals, inheritance, and unresolved quests. It must keep every
factual or reusable claim traceable to a bounded session source and must expose
coverage gaps, inference, contradiction, and privacy limits.

## Owning Boundary

The project-chronicle capability owns:

- a declared project-session boundary
- a census of discovered, included, excluded, and unreadable sessions
- source-bound session-card compression
- cross-session lineage and capability-generation boundaries
- function-based dramatic casting
- an edited narrative chronicle
- a parallel harness-evolution ledger
- editorial review and optional exchange projections

It does not own:

- raw transcript or host-session retention
- host-specific discovery APIs
- repository evolution topics, routing, or promotion
- shared checked-in knowledge publication
- model training or generalized capability claims

## Runtime Surface

The skill owns one optional project-local runtime root:

- `.bagakit/project-chronicle/`

Materialized roots follow `docs/specs/runtime-surface-contract.md` and contain
`surface.toml`.

One run lives under:

- `.bagakit/project-chronicle/runs/<run-id>/`

The runtime is reviewable project-local state and may be ignored by Git.
Accepted material becomes public repository truth only through explicit
promotion into an owning durable surface.

## Completeness Semantics

“All project sessions” means all sessions discoverable within a declared
boundary through named adapters.

The census must distinguish:

- `open`
- `complete`
- `partial`

`complete` means every adapter named in the boundary was exhausted and every
discovered session was registered. It does not imply access to deleted,
unretained, unrelated-account, or otherwise unauthorized sessions.

`partial` is a valid result when its concrete gaps remain visible in the
chronicle and review.

## Dual Output Rule

Every completed run produces both:

- `chronicle.md`
  - publication-facing narrative
- `evolution-ledger.json`
  - evidence-facing harness learning

The narrative must not become the only location for reusable principles. The
ledger must not replace readable history with a process report.

## Generational Rule

A generation boundary records a changed inherited capability baseline, such
as:

- a task becomes reliably executable
- a source of truth becomes explicit
- a failure becomes observable earlier
- human explanation or approval burden changes
- repeated execution becomes materially cheaper
- uncertainty becomes represented instead of hidden

Chronological convenience alone is not a generation boundary.

Each generation preserves:

- baseline before
- pressure
- intervention
- observed delta
- baseline after
- member sessions and evidence refs
- remaining tensions

## Dramatic Casting Rule

Roles describe the operational function sessions played in project lineage.
They do not assign human worth, motive, blame, consensus, or fictional identity.

Every included session must appear in at least one role. Each role must retain
its member sessions, fit rationale, and evidence refs.

## Harness Learning Rule

Reusable entries follow `docs/specs/principle-layer-contract.md` and preserve:

- what
- why
- intended generalization
- failure boundary
- behavior examples
- transfer checks
- evidence refs
- counterevidence

Supported learning kinds are:

- `success-principle`
- `corrected-belief`
- `quality-ratchet`
- `friction-lever`
- `cost-lever`
- `unresolved-tension`

Editorial acceptance does not authorize repository promotion.

## Review Gate

A completed run requires explicit review of:

- coverage honesty
- evidence fidelity
- contradiction handling
- epic framing without fabrication
- real generational delta
- actionable harness value
- privacy and retention

Structured validation proves artifact closure and evidence-link shape. It does
not prove literary excellence, universal causal truth, complete access to an
external host, publication permission, or promotion readiness.

Skill-goal guards for non-gating case evaluation live in
`skills/harness/bagakit-project-chronicle/references/chronicle-quality-contract.toml`.
Case coverage is optimization evidence, not a capability or release claim.

## Neighbor Boundaries

- Task-level selection evidence remains selector-owned.
- Repository evolution state, adoption, route, and promotion remain
  Evolver-owned.
- Shared checked-in knowledge publication remains living-knowledge-owned.
- Research acquisition outside the session corpus remains researcher-owned.

Project Chronicle may emit reviewed projections for those owners. It must not
directly run or mutate their default workflows.

## Runtime Reference

Installed field-level instructions and operator usage live in:

- `skills/harness/bagakit-project-chronicle/SKILL.md`
- `skills/harness/bagakit-project-chronicle/references/chronicle-quality-contract.toml`
- `skills/harness/bagakit-project-chronicle/references/output-contract.md`
