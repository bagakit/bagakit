# Local Session State

## Owns

- Preserve in-browser progress across long HITL sessions.
- Make save, restore, reset, and local-only scope explicit.

## Does Not Own

- The visual style of the saved-state indicator.

## Design Checks

- The page tells the human whether state is local only.
- Reset and stale-state recovery are visible.

## Outputs Or Evidence

- Recoverable local progress with clear lifetime expectations.

## Failure Signals

- Progress disappears silently.
- Sensitive detail persists with no clear or reset route.
