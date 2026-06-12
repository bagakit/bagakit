# Result Capture

## Owns

- Capture per-item status, observations, notes, judgment, uncertainty, and
  blocker reason.
- Preserve enough structure for export and Agent reentry.
- Distinguish provisional human judgment, revealed Agent position,
  disagreement, and final judgment when the review mode requires them.

## Does Not Own

- Final report layout or export file schema.

## Design Checks

- The human can record both outcome and uncertainty.
- Insufficient evidence is a valid result with a next action.
- Status values map to the shared vocabulary in `../workflow-contract.toml`.
- Judgment state does not overwrite the evidence or prior case run.

## Outputs Or Evidence

- Structured per-item observations, statuses, judgments, disagreements, and
  blocker state.

## Failure Signals

- Results collapse into free-form notes only.
- Blockers and failures are hard to separate from passes.
- The final answer erases the provisional human judgment or prior run.
