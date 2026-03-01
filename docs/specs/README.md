# Specs

This directory is reserved for Bagakit-authored specifications that need stable
meaning across skills, packaging, validation, or release flows.

Typical content that belongs here:

- shared metadata formats
- packaging semantics
- validation system semantics
- projection semantics
- repository-level vocabulary that must stay consistent
- repository-level capability-claim semantics
- concept registries and stable layer vocabulary that support architecture docs

Typical content that does not belong here:

- one-off migration notes
- runtime help that belongs inside a specific skill
- maintainer process notes that belong under `docs/stewardship/`
- complete system architecture design

Primary architecture design now lives under:

- `docs/architecture/`

When architecture and specs touch the same topic:

- architecture is the SSOT for system design, structure, and flow
- specs are the SSOT for stable contracts, stable vocabulary, and stable
  concept meanings

Current examples:

- `canonical-capability-ladder.md`
- `document-surface-rules.md`
- `evolver-memory.md`
- `harness-concepts.md`
- `selector-evolver-boundary.md`
- `selector-driver-contract.md`
- `tooling-rules.md`
- `validation-system.md`
