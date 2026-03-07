# Architecture

This directory is reserved for repository-level architecture design.

Use it for the complete system design of the Bagakit repository, not for
low-level stable contracts and not for maintainer procedures.

## Primary Document

- `docs/architecture/A1-system-architecture.md`
  - the current primary architecture document
  - start here

## Related Documents

- `docs/architecture/A2-governance-structure.md`
  - governance structure, self-hosting, and distributable runtime boundary
- `docs/architecture/A3-core-harness-topology.md`
  - core harness skill topology, explicit composition, and standalone-first
    coupling rules
- `docs/architecture/B1-execution-architecture.md`
  - L1 execution design
- `docs/architecture/B2-behavior-architecture.md`
  - L2 behavior design
- `docs/architecture/B3-framework-architecture.md`
  - L3 framework design
- `docs/architecture/B4-living-knowledge-boundary.md`
  - successor boundary for `bagakit-living-knowledge`
- `docs/architecture/C1-evidence-and-promotion-flow.md`
  - main learning and promotion chain
- `docs/architecture/C2-routing-model.md`
  - `host / upstream / split` and `.mem_inbox`
- `docs/specs/harness-concepts.md`
  - concept registry and stable layer vocabulary
  - supports the architecture document without replacing it
- `docs/specs/evolver-memory.md`
  - stable memory contract for the evolver system
- `docs/specs/evolver-evidence-intake.md`
  - optional `.mem_inbox/` intake buffer and signal contract for evolver
- `docs/stewardship/README.md`
  - maintainer governance and operating stance

## Reading Order

1. `docs/architecture/A1-system-architecture.md`
2. `docs/architecture/A2-governance-structure.md`
3. `docs/architecture/A3-core-harness-topology.md`
4. `docs/architecture/B1-execution-architecture.md`
5. `docs/architecture/B2-behavior-architecture.md`
6. `docs/architecture/B3-framework-architecture.md`
7. `docs/architecture/B4-living-knowledge-boundary.md`
8. `docs/architecture/C1-evidence-and-promotion-flow.md`
9. `docs/architecture/C2-routing-model.md`
10. `docs/specs/harness-concepts.md`
11. `docs/specs/evolver-memory.md`
12. `docs/specs/evolver-evidence-intake.md`
13. `docs/stewardship/README.md`

## Boundary

This directory should contain:

- system architecture overviews
- layer models
- system interaction maps
- ownership and routing models
- architecture decisions that shape multiple surfaces at once

This directory should not contain:

- low-level stable data contracts
  - those belong in `docs/specs/`
- maintainer procedures
  - those belong in `docs/stewardship/`
- local research capture
  - that belongs in `bagakit-researcher` workspaces under
    `.bagakit/researcher/topics/<topic-class>/<topic>/`
- runtime skill instructions
  - those belong in skill payloads

## Quality Rule

This directory is doing its job only if:

- `README.md` stays a thin entry surface
- `system-architecture.md` stays the primary architecture source
- concept, contract, and stewardship docs do not compete to become duplicate
  architecture documents
