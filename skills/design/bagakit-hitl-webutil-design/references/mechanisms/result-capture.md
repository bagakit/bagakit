# Result Capture

## Owns

- Capture per-item status, notes, observed result, and blocker reason.
- Preserve enough structure for export and agent reentry.

## Does Not Own

- Final report layout or export file schema.

## Design Checks

- The human can record both outcome and uncertainty.
- Status values map to the shared vocabulary in `../workflow-contract.toml`.

## Outputs Or Evidence

- Structured per-item observations and statuses.

## Failure Signals

- Results collapse into free-form notes only.
- Blockers and failures are hard to separate from passes.
