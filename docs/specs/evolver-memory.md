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
        ├── REPORT.md
        ├── README.md
        └── topic.json
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

## Ownership

- the evolver CLI owns the write path
- maintainers may inspect these files directly
- direct hand-edits should be rare and followed by `check`

## Derived Artifacts

Each topic has two derived steward-facing artifacts:

- `README.md`
  - concise topic registry view
- `REPORT.md`
  - steward-facing topic synthesis with the layer map, evidence summary, and
    promotion summary

These files are derived from `topic.json`.

If they drift, `check` should fail and `refresh-index` should rewrite them.

`refresh-index` is a derived-artifact sync command.

It should refresh:

- `index.json`
- topic `README.md`
- topic `REPORT.md`

It should not rewrite `topic.json`.

## Four-Layer Upgrade Rule

Bagakit should keep evolver information separated by authority and recovery
purpose.

The intended layers are:

1. hidden research
   - local evidence and exploratory material under `docs/.<topic-class>/...`
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
