# Evolver Session Review

This document defines the reviewed compression boundary from operational
session evidence into Evolver's existing signal intake.

It does not make raw transcripts, checkpoints, traces, or Goal state part of
Evolver memory. Those sources stay under their owning runtime and retention
policy. Evolver receives only source references, a typed candidate, and an
independent review receipt.

## Authority Boundary

The session-review bridge may:

- validate structured session evidence metadata
- validate candidate provenance, counterevidence, limitations, supersession,
  and conflict links
- validate one review receipt per candidate
- convert accepted, non-`noop` candidates into
  `bagakit.evolver.signal.v1` records under `.mem_inbox/`

It must not:

- persist a raw transcript or opaque session payload
- bridge `rejected`, `needs_more_evidence`, or `conflict_open` candidates
- create or update an Evolver topic
- decide a repository route
- create or land a promotion

An accepted signal remains `pending` intake. Topic adoption, dismissal,
routing, and promotion remain separate Evolver decisions.

## Exchange Contract

The CLI accepts this root shape:

```json
{
  "schema": "bagakit.evolver.session-review.v1",
  "producer": "goal-reviewer",
  "generated_at": "2001-01-02T00:00:00Z",
  "session_evidence": {},
  "candidates": [],
  "reviews": []
}
```

The v1 shape is strict. Unsupported fields are rejected so callers cannot
hide raw transcript content inside the review contract.

## SessionEvidenceRef

`session_evidence` contains:

- `session_id`
- `run_id`
- `source_channel`
  - `session-review`
  - `goal-review`
- `source_refs[]`
  - unique repo-relative references to operational evidence, approved slices,
    or a Goal review receipt
- `captured_at`
- `sensitivity`
  - `public`, `internal`, `confidential`, or `restricted`
- `privacy_disposition`
  - `metadata_only`, `approved_slices`, `redacted`, or `restricted`
- `retention_disposition`
  - `retained`, `expires`, `expired`, `deleted`, or `external`
- optional `retention_until`
  - required when `retention_disposition = expires`
- `redaction_policy`

The metadata describes the evidence source. It does not copy that source into
Evolver.

For a new accepted signal, every declared source ref must resolve to a current
repo-relative file, privacy disposition must be `approved_slices` or
`redacted`, and retention must not already be `expired` or `deleted`. An
`expires` contract must still be inside its retention window when rendered.
Expired or deleted sources may support a no-change or non-accepted review
record, but they cannot substantiate a new pending Evolver signal.

When `source_channel = goal-review`, at least one source ref must be a valid
`.bagakit/goal/reviews/<review-id>.json` receipt with `status = completed`,
`evolver_disposition = signal_candidate`, and compatible approval. Its evidence
refs must also appear in `session_evidence.source_refs`.

## Candidate Contract

Each `candidates[]` entry contains:

- `signal_id`
- `operation`
  - `add`, `revise`, `retire`, or `noop`
- one existing Evolver signal `kind`
- `title`
- `statement`
- `observed_outcome`
- `proposed_generalization`
- `scope`
- `confidence`
- `source_refs[]`
- `source_spans[]`
  - `{ "ref": "<declared source ref>", "locator": "<bounded line/event/turn locator>" }`
- `counterevidence_refs[]`
- `supersedes[]`
- `conflicts_with[]`
- `limitations[]`
- optional `topic_hint`

Candidate source and counterevidence refs must already be declared in
`session_evidence.source_refs[]`. An accepted non-`noop` candidate must cite at
least one supporting source ref and one bounded source span. Candidate text is
compressed evidence, not a transcript container: title, statement, outcome,
generalization, scope, limitations, review rationale, and locator fields have
explicit size and count limits enforced by the validator.

## Review Receipt

Each `reviews[]` entry contains:

- `signal_id`
- `coverage`
- `preservation`
- `faithfulness`
  - each check is `pass`, `fail`, or `unclear`
- `disposition`
  - `accepted`, `rejected`, `needs_more_evidence`, or `conflict_open`
- `reviewer`
- `reviewed_at`
- `rationale`

Every candidate must have exactly one receipt. `accepted` requires all three
checks to pass. `conflict_open` requires at least one `conflicts_with` link.
Review time must be between evidence capture and contract generation. When
retention expires, an accepted review must occur before `retention_until`.

An accepted `noop` represents a valid no-change review decision in the
caller-owned contract but does not produce an intake signal or a new Evolver
receipt.

## Signal Normalization

`bridge-session-review` converts each accepted, non-`noop` candidate into the
existing signal contract:

- `id` comes from `signal_id` and is normalized by the existing signal bridge
- `summary` comes from `proposed_generalization`
- `producer` comes from the review contract
- `source_channel` comes from `SessionEvidenceRef`
- `status` is always `pending`
- all session, candidate supporting, and counterevidence refs are preserved in
  `local_refs[]`
- operation, observation, generalization, scope, supporting refs,
  counterevidence, conflicts, limitations, privacy, retention, redaction, and
  review results are preserved in `evidence[]`

No review contract file is copied into `.mem_inbox/`. The pending signal is the
only Evolver-owned output.

## CLI Boundary

```text
validate-session-review --contract <json> [--root <repo-root>]
bridge-session-review --contract <json> [--root <repo-root>]
```

`validate-session-review` is read-only.

`bridge-session-review` validates the full contract before writing any signal.
If one accepted signal collides with resolved intake or fails the existing
signal contract, the bridge fails instead of partially routing session
evidence.

Replaying an identical pending signal is idempotent. Reusing the same normalized
signal id with different semantic content is rejected; revisions must use a new
signal id plus explicit `supersedes` or `conflicts_with` evidence.
