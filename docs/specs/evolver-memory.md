# Evolver Memory

This document defines the current Bagakit evolver memory contract.

This spec describes the `memory plane` of `evolver`.

It does not define the full research workflow.
Research may be produced by separate systems and then linked or summarized into
evolver state.

## Scope

The evolver operator reads and writes project-local state under
`.bagakit/evolver/`.

This surface is downstream of task-local evidence, not the raw home of it.
Selector-owned task logs stay under `.bagakit/skill-selector/tasks/` until
their contents are routed or summarized into repository-level learning.

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
  - `updated_at`
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
- `slug`
- `title`
- `status`
- `created_at`
- `updated_at`
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
- `added_at`

Preflight record fields:

- `decision`
- `rationale`
- `assessed_at`

Routing record fields:

- `decision`
  - `host`
  - `upstream`
  - `split`
- `rationale`
- `decided_at`
- `host_target` (optional)
  - intended host-side landing target when the route keeps material host-local
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
- `added_at`

Feedback record fields:

- `channel`
- `signal`
- `detail`
- `created_at`

Benchmark record fields:

- `id`
- `metric`
- `result`
- `baseline` (optional)
- `detail` (optional)
- `created_at`

Promotion record fields:

- `id`
- `surface`
- `status`
- `target`
- `summary`
- `ref` (optional)
- `proof_refs[]`
- `created_at`
- `updated_at`

Note record fields:

- `kind`
- `title` (optional)
- `text`
- `created_at`
- `related_candidates[]` (optional)

Local context ref values:

- repo-relative paths only
- intended for weak references to local context such as hidden docs research
  workspaces
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
- `landed`

Promotion rule:

- promotion records are stable topic-local objects, not append-only prose
- a promotion may move from `proposed` to `landed`
- the stable identity is `id`
- `landed` promotions must include `ref`
- `landed` promotions must include one or more `proof_refs`
- promotion records describe durable-upstream landing tracks
- routing remains separate so `host` and `split` decisions do not need to
  pretend that every outcome is one upstream promotion

## Ownership

- the evolver CLI owns the write path
- maintainers may inspect these files directly
- direct hand-edits should be rare and followed by `check`

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
   - landed

The route belongs to `routing`.

The durable-upstream track belongs to `promotions`.

This split exists so Bagakit can preserve:

- host-side adoption outcomes
- upstream promotion state
- split outcomes that contain both

without forcing one field to impersonate all three.

Selector may inform the route.
Selector does not own the repository-level route decision.

## Practice-Evidence Pattern

Research evidence is only one input to evolver.

Repository-level practice evidence may also enter through:

- summarized selector findings
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

1. hidden research
   - local evidence and exploratory material under
     `.bagakit/researcher/topics/<topic-class>/<topic>/`
   - or the standalone hidden-docs fallback `docs/.<topic-class>/...`
2. structured decision memory
   - topic-local evidence and decisions under `.bagakit/evolver/topics/<slug>/`
3. project runtime state
   - repository-wide operational state under `.bagakit/evolver/`
4. durable repository surfaces
   - `docs/specs/`, `docs/stewardship/`, and `skills/`

The evolver operator should not collapse these layers into one storage surface.

Current implication:

- local hidden docs remain weak-link only
- topic-local JSON and derived reports remain the evolver memory and
  decision-memory surface
- durable promotions are explicitly typed by `surface`

## Weak-Link Rule

`local_context_refs` are weak links.

That means:

- evolver memory may point to local hidden docs workspaces
- evolver validation checks reference format
- missing targets may be reported as warnings
- missing targets must not make the topic invalid or block the evolver tool

## Project-State Rule

Evolver state belongs to `.bagakit/evolver/`, not to `mem/`.

Reason:

- it is operational project state
- it is manipulated by the evolver operator
- it should stay distinct from more general repository memory and notes

## Validation

Primary validation entrypoint:

```bash
bash scripts/gate.sh validate
```
