# Evidence Context

## Owns

- Capture runtime context, source reason, logs, build identifiers, and other
  evidence that explains the observation.
- Keep evidence linked to the scene and result packet.

## Does Not Own

- Provenance label taxonomy beyond the shared guard.
- Whether evidence appears as a sidebar, table, or timeline.

## Design Checks

- A reviewer can see why a conclusion was made.
- Observations and supporting evidence stay connected.

## Outputs Or Evidence

- Context fields, evidence refs, and source-linked notes.

## Failure Signals

- Results cannot be audited later.
- Evidence becomes a dump with no relationship to the decision.
