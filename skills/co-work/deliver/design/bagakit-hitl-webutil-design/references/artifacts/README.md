# Artifact References

Artifacts own durable outputs and round-trip contracts.

Artifacts should stay narrow in v0.

Each artifact file should answer:

- what object is produced
- what fields or schema elements are required
- what round-trip behavior is expected
- what failure signals mean the artifact contract drifted

Current artifacts include:

- `case-catalog.md`
  - stable case identity, revisioned runs, attention state, and history
- `page-manifest.md`
  - the generated page route and data-contract identity
- `report-export.md`
  - human-readable and machine-readable review output
- `agent-handoff-packet.md`
  - the packet returned to an Agent
