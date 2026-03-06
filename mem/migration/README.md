# Migration Memory

This directory is reserved for durable migration observations, checkpoints, and
cross-cutting notes that may inform later migration decisions.

These files are migration memory, not active canonical architecture by default.
When a migration note conflicts with landed runtime or contract text, follow:

- `skills/`
- `docs/specs/`
- `docs/stewardship/`

Current records:

- `absorbed-repos.md`
  - absorbed repo entries plus explicit lineage coverage for split or partial
    carry-forward cases that should not be mistaken for full successors
- `harness-devloop-alignment-evolution-plan.md`
  - Bagakit-side alignment note for evolving the current selector ->
    brainstorm -> feature-tracker -> flow-runner -> agent_loop stack toward a
    full user-demand-to-execution loop without reintroducing a bundled runtime
- `harness-devloop-alignment-execution-checklist.json`
  - machine-readable execution checklist for the completed alignment pass,
    including landed bridges and the end-to-end proof with evidence refs
- `source-harness-import-review.md`
  - import review for reusable harness surfaces and boundaries
- `living-knowledge-redefinition-plan.md`
  - historical planning note from the earlier `living-knowledge` redefinition
    pass
- `execution-surface-naming.md`
  - historical naming rationale for the tracker and runner split
