# Goal Event Stream Contract

Use this reference to keep Goal control history separate from mutable execution
truth.

## Ownership

| Content | Format | Owner |
| --- | --- | --- |
| staleness-safe Goal Kernel | Markdown | `.bagakit/goal/<goal-id>.md` |
| foreground, topology, lifecycle cache, owner pointer, cursor | YAML | `.bagakit/goal/state.yaml` |
| stable supervision policy | Markdown | `.bagakit/goal/supervisor.md` |
| Kernel/lifecycle control events | JSONL | `.bagakit/goal/events/<goal-id>.jsonl` |
| tasks, progress, waits, packets, retries, evidence | owner-native structured state | execution owner |
| repeated execution rounds | owner-native state or JSONL | Flow Runner or evaluator |
| immutable Evolver review receipt | JSON | `.bagakit/goal/reviews/<review-id>.json` |

A fresh executor does not replay Goal JSONL. It reads the Kernel and then the
execution owner.

## Goal Events

Append an event only when it explains a Kernel, lifecycle, authority, or user
gate change:

```json
{"schema":"bagakit.goal-event.v1","seq":2,"event_id":"e-000002","goal_id":"demo","kind":"goal_updated","owner":"bagakit-set-loop-goal","summary":"Acceptance now requires an independent audit.","evidence_refs":[".bagakit/feature-tracker/features/demo/proposal.md"],"control_effect":"patch_kernel"}
```

Required fields:

- `schema`: `bagakit.goal-event.v1`
- `seq`: contiguous positive integer
- `event_id`: `e-` plus zero-padded sequence
- `goal_id`: owning Goal
- `kind`: `goal_created`, `goal_updated`, `goal_reconciled`, `goal_upgraded`,
  `delta_proposed`, `delta_applied`, or `status_changed`
- `owner`: logical producer id, never a person or hostname
- `summary`: concise control meaning
- `evidence_refs`: repo-relative owner or review artifacts
- `control_effect`: `none`, `owner_update_required`, `patch_kernel`,
  `change_status`, or `ask_user`

Sequence is event identity; timestamps are unnecessary. Keep one writer per
Goal stream.

Do not write routine checkpoints, current supervisor packets, task progress,
command output, retry attempts, waiting polls, no-progress counts, HEAD or
release state, raw sidecar output, or validation logs here. Those belong to the
execution owner.

## Reconciliation

Reconciliation means that the Kernel and execution owner now reflect all
direction-changing Goal events through a cursor. It does not copy current state
or a next instruction into Goal Markdown.

1. Read events after `reconciled_through`.
2. Update owner-native task, decision, question, waiting, packet, or evidence
   truth first.
3. Update the Kernel only when final outcome, invariant, non-goal, acceptance,
   stop boundary, authority, or stable context reference changed.
4. Run `reconcile-goal` with an existing evidence ref inside the execution
   owner.
5. Append `goal_reconciled` and advance `reconciled_through`.

An unreconciled non-`none` effect blocks `fresh-check`. Reconciliation evidence
outside the owner does not prove that current execution truth is recoverable.

## Upgrades And Archive

Protocol v0.3 upgrades preserve the full pre-v0.3 Goal and event stream under
`archive/` before rewriting. Legacy dynamic sections must first be migrated to
the selected execution owner and classified through a hash-bound structured
owner migration receipt. A different existing snapshot is an archive collision.

When a Goal closes, archive its active event stream with the Goal. Historical
events remain audit material; they never become the recovery path for current
execution. Closed-Goal migration must remove the old active event path after
writing its legacy snapshot and canonical archived v0.3 stream.

## Evolver Reviews

Goal may schedule event-bound review receipts for `before_round`, `after_round`,
`risk`, `stale`, `pre_closeout`, or opportunistic `session_end`. `stale` means
expected evidence is absent, not that time merely passed. Goal owns request and
receipt identity; Evolver owns intake, adoption, routing, and promotion.
