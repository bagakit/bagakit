# Execution Surface Naming

Historical note:

- this note captures the naming decision phase that led to the current tracker
  and runner split
- it should not be read as the active normative boundary text
- the remaining body is preserved largely as-written from the naming-settlement
  phase and may still use active decision language from that time
- for current canonical boundaries, use:
  - `skills/harness/bagakit-feature-tracker/README.md`
  - `skills/harness/bagakit-flow-runner/README.md`
  - `docs/specs/flow-runner-contract.md`

## Historically Settled

- `bagakit-long-run` should be renamed toward `bagakit-flow-runner`.
- `bagakit-feat-task-harness` should be renamed toward `bagakit-feature-tracker`.

Reason:

- it is not the work item itself
- it is the adjustable repeated execution flow around normalized work items
- `runner` matches the existing outer-runner vocabulary already present in the
  current implementation
- `feature` preserves the current demand-unit intuition
- `tracker` shows that the surface owns planned work state and lifecycle rather
  than only generic runtime behavior
- `feature-tracker` reads as a system surface more clearly than `ticketing`
  while avoiding the over-broad `runtime` label

Historical intended split:

- `bagakit-feature-tracker`
  - owns feature or ticket truth, planning state, workspace state, task gates,
    and closeout lifecycle
- `bagakit-flow-runner`
  - owns adjustable repeated execution flow over normalized work items
