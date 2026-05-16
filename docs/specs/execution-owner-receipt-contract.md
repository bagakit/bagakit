# Execution Owner Receipt Contract

## Purpose

An execution owner receipt lets a compact Goal verify current planning or work
truth without parsing owner prose or copying the owner's task state.

The owner remains authoritative. Consumers record only the semantic revision
they observed and fail closed when the owner changes.

## Receipt

An owner writes `owner-receipt.json` beside its canonical runtime state:

```json
{
  "schema": "bagakit.execution-owner-receipt.v1",
  "owner_kind": "feature_tracker",
  "owner_id": "f-example",
  "semantic_revision": "<stable semantic digest>",
  "lifecycle_status": "in_progress",
  "continuation": "continue",
  "current_item_id": "T-001",
  "blocker": null,
  "replacement_ref": null,
  "evidence_refs": [
    ".bagakit/feature-tracker/features/f-example/state.json",
    ".bagakit/feature-tracker/features/f-example/tasks.json"
  ],
  "evidence_hashes": {
    ".bagakit/feature-tracker/features/f-example/state.json": "<sha256>",
    ".bagakit/feature-tracker/features/f-example/tasks.json": "<sha256>"
  }
}
```

Required behavior:

- `evidence_hashes` contains the current sha256 digest of every artifact in
  `evidence_refs`; keys must match exactly.
- `semantic_revision` is the sha256 of canonical compact JSON over
  `owner_kind`, `owner_id`, `lifecycle_status`, `continuation`,
  `current_item_id`, `blocker`, `replacement_ref`, and `evidence_hashes`.
  Timestamps, logs, and rendered projections do not affect it.
- `continuation` is one of `continue`, `blocked`, `complete`, `superseded`, or
  `unavailable`.
- `blocker` is null or contains non-empty `class` and `reason` strings.
- `replacement_ref` is null unless another repo-relative owner artifact
  supersedes this owner.
- `evidence_refs` are existing repo-relative canonical owner artifacts. A
  missing file or hash mismatch makes the receipt invalid, including a crash
  between canonical owner mutation and receipt refresh.
- The owner refreshes the receipt in the same canonical mutation boundary as
  its state. A projection job must not invent a newer revision.

## Consumer Binding

A Goal may persist this optional frontmatter binding:

```yaml
owner_binding:
  owner_kind: feature_tracker
  owner_id: f-example
  receipt_ref: .bagakit/feature-tracker/features/f-example/owner-receipt.json
  observed_revision: <stable semantic digest>
  required: true
```

Rules:

- identity and revision must match the current receipt
- a changed revision blocks the old Goal instruction until explicit reconcile
- `blocked` or `unavailable` requires a blocked or paused Goal
- `complete` or `superseded` cannot leave the Goal in active execution
- Goal reconciliation may acknowledge a new revision, but it does not mutate
  the owner
- continuation-bearing bindings are always required; an unavailable receipt
  blocks execution

## Boundary

The receipt is a typed handoff, not shared authority. It does not authorize the
Goal to update Feature Tracker, infer task completion, or replay owner history.
