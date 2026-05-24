# Project Chronicle Graduation Review

## Review Target

- scope: installable skill source
- target id: `bagakit-project-chronicle`
- requested level: `graduation`
- review date: 2026-07-30
- reviewer: Codex repository operator

## Claim Summary

- why this claim is being reviewed now:
  - the runtime skill, stable contract, validation, and non-gating eval surfaces
    are complete enough to enter the canonical install flow
- claimed user or maintainer value:
  - turn a declared census of project sessions into an evidence-grounded epic
    chronicle and a source-bound harness-evolution ledger
- baseline or prior level:
  - ungraduated candidate

## Evidence Freshness

- comparison set changed since last review: not applicable to graduation
- benchmark task set changed since last review: the first serious-moment case
  bank and forward-test receipt were added for this review
- validation or install model changed since last review: no
- runtime contract changed since last review: this is the initial review of the
  canonical runtime contract

## Graduation Evidence

- canonical directory-protocol path:
  - `skills/harness/bagakit-project-chronicle/SKILL.md`
- validation evidence:
  - the system skill quick validator passes
  - `make validate-repo` selects and passes the owner-local layout and CLI smoke
    suites together with the affected repository suites
  - the deterministic non-gating goal-case eval passes for all eight sanitized
    serious-moment cases
  - `gate_eval/skills/harness/bagakit-project-chronicle/cases/forward-test-receipt.md`
    records one epic-fidelity holdout and one single-session route control
- package evidence:
  - `make package-one SELECTOR=harness/bagakit-project-chronicle` produces the
    family-scoped `bagakit-project-chronicle.skill` archive from the canonical
    directory-is-payload source
  - archive inspection shows one skill root containing only the declared
    runtime payload
- link evidence:
  - `make link-skills SELECTOR=harness/bagakit-project-chronicle DEST=<temporary-skills-root>`
    creates the expected flat skill link
  - strict install-status reports the temporary projection as installed and
    current against `skills/harness/bagakit-project-chronicle`
- consistency check across docs, package flow, and gates:
  - `docs/specs/project-chronicle-contract.md`, the frontdoor declaration, the
    installable payload, owner-local validation, and non-gating eval all name
    the same skill identity and runtime boundary
  - no compatibility manifest, submodule indirection, or external source of
    truth is required

## Frontier Evidence

- named comparison set: not established for a capability claim
- benchmark task set: no shared comparative benchmark
- primary metrics: not preregistered for a comparative run
- repeated runs: none
- cost or latency notes: not measured
- contamination or benchmark-integrity notes:
  - the two forward routes were exercised once from sanitized artifacts
- known loss cases:
  - real-project literary quality, broad user preference, and three-trial
    reliability remain unproven

## Flywheel Evidence

- prior frontier evidence: none
- failures converted into shared assets:
  - the first optimization round produced a quality contract and serious-moment
    eval cases
- later review showing measurable benefit:
  - none beyond the initial guard-coverage calibration
- new reusable gate, eval, spec, or tool outcome:
  - owner-local layout and CLI smoke gates, a stable contract, and a non-gating
    goal-case eval exist

## Safeguard Evidence

- release or safety constraints that apply:
  - literary framing must not become evidence
  - census gaps, contradictions, privacy limits, and inference status remain
    explicit
  - reviewed ledger entries do not automatically promote themselves into
    shared knowledge or repository-evolution state
- human-confirmation points if the target can take actions:
  - accepting or promoting an evolution candidate remains an explicit later
    decision
- red-team or misuse evidence:
  - the serious-moment bank includes invented-dialogue pressure, partial
    archives, false-green reversals, single-session over-routing, and automatic
    promotion pressure
- unresolved risk notes:
  - adapter completeness and literary quality still require source-aware human
    judgment

## Review Outcome

- approved level: `graduation`
- rejected level: `frontier` and `flywheel` are not approved
- downgrade reason if applicable: not applicable
- archive destination: `mem/decisions/project-chronicle-graduation.md`

The approved claim is intentionally narrow. The observed guard-coverage change
from `0.375` to `1.0` is contract coverage over the current case bank, not a
measurement of literary quality or general Agent capability.

## Required Follow-through

- directory-protocol or runtime-path changes: none
- spec changes: keep `docs/specs/project-chronicle-contract.md` aligned with the
  installed output contract
- stewardship changes: re-review after a material runtime, install-model, or
  benchmark change
- gate or eval changes: keep owner-local gates and the serious-moment case bank
  active; record loss cases instead of converting them into wording checks
- benchmark retirement or replacement changes: a future frontier review must
  declare a named comparison set, shared tasks, and primary metrics before its
  repeated runs
