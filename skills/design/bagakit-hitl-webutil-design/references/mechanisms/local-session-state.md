# Local Session State

## Owns

- Preserve in-browser progress across long HITL sessions.
- Make save, restore, reset, and local-only scope explicit.
- Migrate local state when the case catalog or evaluation contract changes.
- Reconcile local drafts and attempts with newer external feedback projections.

## Does Not Own

- The visual style of the saved-state indicator.
- Durable case-history truth, which belongs to `../artifacts/case-catalog.md`.

## Design Checks

- The page tells the human whether state is local only.
- Reset and stale-state recovery are visible.
- State carries a schema version and stable case/run ids.
- A restored filter cannot hide newly introduced attention-required cases.
- Migration preserves prior judgments and run relations or reports a specific
  recovery error.
- Projection version and last-applied event ref make stale external state
  visible; a new projection never silently overwrites local drafts or attempts.

## Outputs Or Evidence

- Recoverable local progress with clear lifetime, migration, and reset behavior.

## Failure Signals

- Progress disappears silently.
- Sensitive detail persists with no clear reset route.
- A new case set discards old annotations or keeps a stale filter that hides
  new work.
- Refresh restores an older page state while the Agent has already advanced the
  task, with no stale-projection warning or recovery action.
