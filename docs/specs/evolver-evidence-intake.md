# Evolver Evidence Intake

This document defines the stable intake contract that replaces the legacy
`learning-contract` behavior.

It belongs to `evolver`, not to `living-knowledge`.

## Purpose

Use this spec when repository-level learning needs one explicit intake seam
before it becomes structured evolver topic state.

This spec defines:

- the optional `.mem_inbox/` buffer
- the signal exchange contract used to import and export intake items
- the rule for adopting one intake signal into evolver topic state

It does not define:

- host knowledge substrate behavior
- task-level selector logging
- full evolver topic memory
- durable promotion landing

Those belong respectively to:

- `docs/specs/living-knowledge-system.md`
- `docs/specs/selector-evolver-boundary.md`
- `docs/specs/evolver-memory.md`

## First Principle

`learning-contract` used to mix three different concerns:

- importing and exporting lightweight learning signals
- staging not-yet-reviewed learning
- semi-automatic promotion by confidence

The modern successor keeps only the first two inside the intake seam.

It does not keep auto-promotion.

Reason:

- `evolver` owns repository-level route decisions
- `evolver` owns promotion state
- reviewed routing must happen before durable promotion

So `.mem_inbox/` is a buffer, not a shadow promotion engine.

## Runtime Surface

The optional intake buffer lives at:

- `.mem_inbox/`

Current layout:

```text
.mem_inbox/
├── README.md
└── signals/
    └── <signal-id>.json
```

Meaning:

- `README.md`
  - derived human-readable overview of the current intake buffer
- `signals/<signal-id>.json`
  - SSOT for one intake signal

Rule:

- `.mem_inbox/` is evolver-owned project state
- it is not shared knowledge truth
- it is not structured topic memory yet
- it is optional; some repositories may go directly to topic state when the
  material is already mature

## Signal File Contract

Each signal file must contain:

```json
{
  "version": 1,
  "id": "living-knowledge-doc-taxonomy",
  "kind": "decision",
  "title": "Doc taxonomy signal",
  "summary": "Several host-side notes point to one reusable taxonomy gap.",
  "producer": "bagakit-living-knowledge",
  "source_channel": "host",
  "topic_hint": "living-knowledge-doc-taxonomy",
  "confidence": 0.78,
  "evidence": [
    "repeated host-side maintenance churn"
  ],
  "local_refs": [
    "docs/notes/doc-taxonomy.md"
  ],
  "status": "pending",
  "adopted_topic": null,
  "resolution_note": null,
  "created_at": "2026-04-20T00:00:00Z",
  "updated_at": "2026-04-20T00:00:00Z"
}
```

Required fields:

- `version`
  - must be `1`
- `id`
  - stable signal identifier
- `kind`
  - one of:
    - `decision`
    - `preference`
    - `gotcha`
    - `howto`
    - `glossary`
- `title`
- `summary`
- `producer`
- `source_channel`
- `confidence`
  - number between `0` and `1`
- `evidence[]`
  - string list; may be empty
- `local_refs[]`
  - repo-relative refs; may be empty
- `status`
  - one of:
    - `pending`
    - `adopted`
    - `dismissed`
- `created_at`
- `updated_at`

Optional fields:

- `topic_hint`
  - non-authoritative suggested topic slug
- `adopted_topic`
  - topic slug once the signal is adopted
- `resolution_note`
  - short note when the signal is adopted or dismissed

## Exchange Contract

The exchange JSON used by `validate-signals`, `import-signals`, and
`export-signals` has this root shape:

```json
{
  "schema": "bagakit.evolver.signal.v1",
  "producer": "bagakit-living-knowledge",
  "generated_at": "2026-04-20T00:00:00Z",
  "signals": []
}
```

Rules:

- `schema` must be `bagakit.evolver.signal.v1`
- `signals[]` carries signal records in the same semantic shape as the
  on-disk files
- import must normalize repo-relative refs and signal ids
- export must not invent route or promotion state that is not present

## Intake Rule

Signals in `.mem_inbox/` are not structured topic state yet.

They become topic-state evidence only through an explicit adoption step.

That adoption must:

- choose one evolver topic
- optionally add weak local refs into `local_context_refs`
- add one structured source record
- add one structured note describing the intake
- mark the signal as `adopted`

Adoption must not silently:

- create route decisions
- create landed promotions
- infer upstream truth from confidence alone

Those steps remain explicit evolver operations.

## Why No Auto-Promotion

The legacy flow promoted by confidence threshold.

That is intentionally rejected here.

Confidence may help prioritize review.

Confidence must not replace:

- topic creation judgment
- routing judgment
- durable promotion judgment

The intake seam exists to preserve operator review, not to bypass it.

## Relationship To Topic Memory

`.mem_inbox/` is pre-topic state.

`topic.json` under `.bagakit/evolver/topics/<slug>/` is structured topic state.

The boundary is:

- intake buffer
  - lightweight, provisional, optionally imported
- topic state
  - repository-level memory with routing and promotion semantics

Do not collapse these into one flat bag.
