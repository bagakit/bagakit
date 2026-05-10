# Goal Event Stream Contract

Use this reference when Goal maintenance produces repeated observations,
supervisor checkpoints, accepted deltas, or execution records.

## Contents

- Format Ownership
- Goal Control Events
- Execution Event Routing
- Reconciliation
- Recovery Rules

## Format Ownership

Choose the format from the information lifecycle:

| Content | Format | Owner |
| --- | --- | --- |
| current objective, principles, acceptance, compact state, next move | Markdown | `.bagakit/goal/<goal-id>.md` |
| foreground cursor, topology, lifecycle cache, reconciliation cursor | YAML | `.bagakit/goal/state.yaml` |
| stable supervision policy | Markdown | `.bagakit/goal/supervisor.md` |
| append-only Goal control events | JSONL | `.bagakit/goal/events/<goal-id>.jsonl` |
| execution rounds, retries, process exits, command output | JSONL or owner-native structured state | Flow Runner, evaluator, or execution owner |
| immutable request or review receipt | JSON | the owning review surface |
| analysis intended for people | Markdown | Research, report, Plan, or Handoff owner |

Markdown states what the executor should believe now. JSONL records how
control state changed. A fresh executor must not need to replay the JSONL stream
before acting.

## Goal Control Events

The Goal-owned stream records only events that may change steering or explain a
control-plane decision. Each line is one JSON object:

```json
{"schema":"bagakit.goal-event.v1","seq":1,"event_id":"e-000001","goal_id":"demo-goal","kind":"supervisor_checkpoint","owner":"goal-supervisor","summary":"The previous retry condition did not change.","evidence_refs":[".bagakit/flow-runner/runs/demo/checkpoint.json"],"control_effect":"replace_next_instruction"}
```

Required fields:

- `schema`: `bagakit.goal-event.v1`
- `seq`: positive contiguous integer within one Goal stream
- `event_id`: `e-` plus the zero-padded sequence number
- `goal_id`: owning Goal id
- `kind`: `goal_created`, `goal_updated`, `goal_reconciled`,
  `supervisor_checkpoint`, `delta_proposed`, `delta_applied`, or
  `status_changed`
- `owner`: logical producer id, never a username or hostname
- `summary`: concise event meaning, not raw output
- `evidence_refs`: repo-relative owner artifacts
- `control_effect`: `none`, `update_current_state`,
  `replace_next_instruction`, `patch_goal`, `change_status`, or `ask_user`

Use sequence order for semantics. A private runtime may record time in an owner
log, but timestamps are not required Goal event identity and must not replace
`seq`.

Keep one writer per Goal event stream. Parallel executors should write to their
own run streams and let the supervisor distill their outcomes into the Goal
stream.

## Execution Event Routing

Do not write these into the Goal event stream:

- per-case progress and score details
- command stdout or stderr
- process heartbeats and routine waits
- retry attempts and stack traces
- raw sidecar analysis
- full validation output
- repeated snapshots that do not change direction

Write them to the execution owner's structured stream or artifact. The Goal
keeps one compact pointer and only the conclusion that changes objective,
principles, acceptance, risk, status, or next execution instruction.

## Reconciliation

Reconciliation rebuilds current control truth; it is not another append-only
summary.

Run it after a material milestone, before compact or handoff, when current
instructions conflict with newer evidence, or when the Goal starts accumulating
checkpoint history.

1. Read the indexed owner truth and Goal events after `reconciled_through`.
2. Replace `Current State` with a compact factual snapshot.
3. Replace `Next Execution Instruction` with one current bounded move.
4. Fold accepted deltas into the objective, principles, acceptance, risks, or
   orchestration pointers they actually change.
5. Keep only a few future-relevant items under `Recent Decisions`; move detailed
   history to its owner surface.
6. Remove resolved questions and stale directions.
7. Append one `goal_reconciled` event and advance `reconciled_through` to it.

When reconciling an older Goal, remove an append-only Markdown `Goal Delta Log`
after preserving any still-relevant decision in the Goal or an owner artifact.

Each active Goal registry entry uses:

```yaml
event_log: .bagakit/goal/events/<goal-id>.jsonl
reconciled_through: 12
```

`reconciled_through` is the highest Goal event sequence already reflected in
the Markdown control plane. An event with a non-`none` control effect after that
cursor means the Goal requires reconciliation before a fresh executor should
continue.

## Recovery Rules

- Normal recovery reads `current.md`, `state.yaml`, the foreground Goal, its
  indexed owner files, and `supervisor.md` when active.
- Read Goal JSONL only for reconciliation, audit, or unresolved control drift.
- Never tell a fresh executor to replay all historical events before acting.
- Archive the Goal event stream with the Goal when its lifecycle closes.
- If the event stream and Markdown disagree, owner truth plus the newest valid
  control event informs reconciliation; neither silently overrides a user gate.
