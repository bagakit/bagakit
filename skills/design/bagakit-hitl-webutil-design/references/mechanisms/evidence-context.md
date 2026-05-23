# Evidence Context

## Owns

- Capture runtime context, source reason, logs, build identifiers, outputs, and
  other evidence that explains an observation or judgment.
- Keep evidence items grouped under the case and run they support.

## Does Not Own

- Provenance label taxonomy beyond the shared guard.
- Whether evidence appears as a sidebar, table, or timeline.
- The review mode or Agent-advice reveal policy.

## Design Checks

- A reviewer can see why a conclusion was made.
- Observations and supporting evidence stay connected.
- Agent-generated conclusions are labeled separately from observed evidence.
- Independent mode can defer Agent conclusions without hiding source evidence.
- Raw outputs remain evidence items or subchecks when they answer one decision.

## Outputs Or Evidence

- Context fields, evidence items, evidence refs, provenance, and source-linked
  notes.

## Failure Signals

- Results cannot be audited later.
- Evidence becomes a dump with no relationship to the decision.
- Agent interpretation is visually indistinguishable from observed evidence.
