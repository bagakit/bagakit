# Evolver Memory

This document defines the current Bagakit evolver memory contract.

This spec describes the `memory plane` of `evolver`.

It does not define the full research workflow.
Research may be produced by separate systems and then linked or summarized into
evolver state.

The optional pre-topic intake buffer is defined separately in:

- `docs/specs/evolver-evidence-intake.md`

## Scope

The evolver operator reads and writes project-local state under
`.bagakit/evolver/`.

This is a local runtime surface. Host repositories may ignore `.bagakit/`;
materializing `.bagakit/evolver/` still requires its `surface.toml` marker per
`docs/specs/runtime-surface-contract.md`.

This surface is downstream of task-local evidence, not the raw home of it.
Selector-owned task logs stay under `.bagakit/skill-selector/tasks/` until
their contents are routed or summarized into repository-level learning.

Optional intake may additionally pass through:

- `.mem_inbox/`

before it is adopted into structured topic state.

Current structure:

```text
.bagakit/evolver/
├── index.json
└── topics/
    └── <topic-slug>/
        ├── HANDOFF.md
        ├── REPORT.md
        ├── README.md
        └── topic.json
```

Archived topics additionally carry:

```text
.bagakit/evolver/topics/<topic-slug>/ARCHIVE.md
```

## Files

### `index.json`

Repository-wide topic registry.

Current fields:

- `version`
- `topics[]`
  - `slug`
  - `title`
  - `status`
  - `preflight_decision` (optional)
  - `local_context_ref_count`
  - `candidate_count`
  - `source_count`
  - `feedback_count`
  - `benchmark_count`
  - `promotion_count`
  - `note_count`

### `topics/<topic>` topic file

Topic-local evolver record.

Current fields:

- `version`
- `revision`
- `mutation_receipts[]`
- `slug`
- `title`
- `status`
- `preflight`
- `routing`
- `local_context_refs[]`
- `candidates[]`
- `sources[]`
- `feedback[]`
- `benchmarks[]`
- `promotions[]`
- `notes[]`

Candidate record fields:

- `id`
- `kind`
- `source`
- `summary`
- `status`

Preflight record fields:

- `decision`
- `rationale`

Routing record fields:

- `decision`
  - `host`
  - `upstream`
  - `split`
- `rationale`
- `acceptance_authority` (optional until promotion readiness)
  - authority that accepted the route
- `acceptance_ref` (optional until promotion readiness)
  - repo-relative current evidence of that acceptance
- `counterevidence_disposition` (optional until promotion readiness)
  - `none_found`
  - `addressed`
  - `accepted_risk`
  - `open`
- `target_owner` (optional until promotion readiness)
  - owner responsible for the landing target
- `proof_plan` (optional until promotion readiness)
  - stable name of the landing verification plan
- `proof_plan_ref` (optional until promotion readiness)
  - repo-relative current artifact defining that proof plan
- `host_target` (optional)
  - repo-relative intended host-side landing path when the route keeps
    material host-local
- `host_ref` (optional)
  - repo-relative proof path for the host-side landing when it already exists
- `upstream_promotion_ids[]`
  - promotion ids that carry the upstream part of the route

Routing rule:

- routing is a repository-level decision-plane record
- it is not a task-level selector hint
- a route may exist before every referenced promotion is landed
- `split` exists so one topic can explicitly keep one host-side outcome and one
  upstream durable promotion trail without forcing them into one fake target

Source record fields:

- `id`
- `kind`
- `title`
- `origin`
- `local_ref` (optional)
- `summary_ref` (optional)

Feedback record fields:

- `channel`
- `signal`
- `detail`

Benchmark record fields:

- `id`
- `metric`
- `result`
- `baseline` (optional)
- `detail` (optional)

Promotion record fields:

- `id`
- `surface`
- `status`
- `target`
- `summary`
- `ref` (optional)
- `proof_refs[]`

Note record fields:

- `kind`
- `title` (optional)
- `text`
- `related_candidates[]` (optional)

Local context ref values:

- repo-relative paths only
- intended for weak references to local context such as
  `.bagakit/researcher/topics/<topic-class>/<topic>/`
- not required to exist for the evolver topic to remain valid

## Current Enumerations

Topic status values:

- `active`
- `paused`
- `completed`
- `archived`

Candidate status values:

- `planned`
- `trial`
- `promoted`
- `accepted`
- `rejected`
- `revisit`

Preflight decision values:

- `skip`
- `note-only`
- `track`

Promotion surface values:

- `spec`
- `stewardship`
- `skill`

Meaning:

- `spec`
  - promotion into `docs/specs/`
- `stewardship`
  - promotion into `docs/stewardship/`
- `skill`
  - promotion into `skills/`

Promotion status values:

- `proposed`
- `accepted_for_landing`
- `landed_verified`
- `rejected`
- `superseded`

Promotion rule:

- promotion records are stable topic-local objects, not append-only prose
- a promotion may move from `proposed` to `accepted_for_landing`, then to
  `landed_verified`
- rejected or replaced proposals end as `rejected` or `superseded`
- the stable identity is `id`
- `landed_verified` promotions must include a current `ref`
- `landed_verified` promotions must include one or more current `proof_refs`
- promotion state outside this vocabulary is invalid and must be migrated
  explicitly before normal mutation
- promotion records describe durable-upstream landing tracks
- routing remains separate so `host` and `split` decisions do not need to
  pretend that every outcome is one upstream promotion

## Ownership

- the evolver CLI owns the write path
- maintainers may inspect these files directly
- direct hand-edits should be rare and followed by `check`

## Canonical Mutation Contract

`topic.json` is the only canonical topic truth.

Topic mutation commands must:

- acquire a topic-local short lock with owner metadata
- reclaim a lock only when its owner is dead, with a short grace period for a
  newly created lock whose owner metadata is not yet visible
- reread `topic.json` after acquiring the lock
- replace `topic.json` atomically through a same-directory temporary file,
  file fsync, rename, and directory fsync
- increment `revision` on each committed mutation
- when `--operation-id` is supplied, preserve a bounded receipt with
  `operation_id` so an identical retry is idempotent and reuse with different
  semantics fails as a conflict

`README.md`, `REPORT.md`, `HANDOFF.md`, `ARCHIVE.md`, and `index.json` are
rebuildable projections. They are refreshed from the latest committed topic
truth under a separate projection lock. Evolver does not claim a transaction
across `topic.json`, projections, or intake signal files.

## Derived Artifacts

Each topic may have up to four derived steward-facing artifacts:

- `README.md`
  - concise topic registry view
- `REPORT.md`
  - steward-facing topic synthesis with the layer map, evidence summary, and
    promotion summary
- `HANDOFF.md`
  - next-session compression artifact with route state, blockers, and the
    recommended next move
- `ARCHIVE.md`
  - archive receipt and evidence/promotion summary for archived topics only

These files are derived from `topic.json`.

If they drift, `check` should fail and `refresh-index` should rewrite them.

`refresh-index` is a derived-artifact sync command.

It should refresh:

- `index.json`
- topic `README.md`
- topic `REPORT.md`
- topic `HANDOFF.md`
- topic `ARCHIVE.md` when the topic status is `archived`

It should not rewrite `topic.json`.

## Routing And Promotion Readiness

Evolver should answer two different questions without collapsing them:

1. what route this lesson takes:
   - `host`
   - `upstream`
   - `split`
2. what maturity state the durable-upstream portion is in:
   - evidence only
   - proposal only
   - accepted for landing
   - landed and verified

The route belongs to `routing`.

The durable-upstream track belongs to `promotions`.

This split exists so Bagakit can preserve:

- host-side adoption outcomes
- upstream promotion state
- split outcomes that contain both

without forcing one field to impersonate all three.

Selector may inform the route.
Selector does not own the repository-level route decision.

Promotion readiness additionally requires:

- an explicit acceptance authority and current acceptance ref
- a closed counterevidence disposition; `open` is blocking
- a named target owner
- a named proof plan and current proof-plan ref
- a current host landing ref for `host` and `split` routes
- current landing and proof refs for every `landed_verified` upstream promotion
- terminal candidate disposition before archive

`archive-topic` and `set-topic-status --status archived` must consume this
readiness result. Archive is allowed only when the selected route is landed,
all referenced landings are currently verifiable, and every promotion is
`landed_verified`, `rejected`, or `superseded`.

## Practice-Evidence Pattern

Research evidence is only one input to evolver.

Repository-level practice evidence may also enter through:

- summarized selector findings
- selector-originated `evolver_signal_log` records once they are explicitly
  exported or bridged into evolver intake
- host-side feedback digests
- benchmark summaries
- incident or review notes that survive beyond one task

The evolver memory surface does not own the raw task logs for those sources.

Instead, it owns the repository-level compression layer:

- summarized source records
- feedback records
- benchmark records
- routing and promotion state

That preserves the selector-versus-evolver boundary while still letting
practice evidence become repository learning.

## Four-Layer Upgrade Rule

Bagakit should keep evolver information separated by authority and recovery
purpose.

The intended layers are:

1. researcher workspace evidence
   - local evidence and exploratory material under
     `.bagakit/researcher/topics/<topic-class>/<topic>/`
2. structured decision memory
   - topic-local evidence and decisions under `.bagakit/evolver/topics/<slug>/`
3. project runtime state
   - repository-wide operational state under `.bagakit/evolver/`
4. durable repository surfaces
   - `docs/specs/`, `docs/stewardship/`, and `skills/`

The evolver operator should not collapse these layers into one storage surface.

Current implication:

- researcher workspaces remain weak-link only
- topic-local JSON and derived reports remain the evolver memory and
  decision-memory surface
- durable promotions are explicitly typed by `surface`

## Weak-Link Rule

`local_context_refs` are weak links.

That means:

- evolver memory may point to local researcher workspaces
- evolver validation checks reference format
- missing targets may be reported as warnings
- missing targets must not make the topic invalid or block the evolver tool

## Project-State Rule

Live evolver operator state belongs to `.bagakit/evolver/`, not to `mem/`.

Reason:

- it is operational project state
- it is manipulated by the evolver operator
- it should stay distinct from more general repository memory and notes

Commit rule:

- do not make `.bagakit/evolver/` a checked-in public archive
- if an evolver conclusion should survive as public repository truth, promote
  the reviewed result into `docs/`, `mem/`, `gate_validation/`, `gate_eval/`,
  or `skills/` according to the owning surface

## Validation

Primary validation entrypoint:

```bash
bash scripts/gate.sh validate
```
