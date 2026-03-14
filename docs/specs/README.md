# Specs

This directory holds Bagakit-authored specifications that need stable meaning
across multiple runtime, validation, tooling, or stewardship surfaces.

## Purpose

Use `docs/specs/` when the repository needs one durable answer to:

- what a shared concept means
- what a shared contract requires
- what a stable repository rule allows or forbids

`docs/specs/` is the stable semantic layer of the repository docs system.

## First Principle

Specs own stable semantics, not complete system design and not maintainer
procedure.

That means:

- architecture explains structure and flow
- specs define stable contracts and stable vocabulary
- stewardship explains how maintainers operate those contracts in practice

If a document is still mostly comparing Bagakit with an external or source
system, it is not ready for `docs/specs/` yet.

## What Belongs Here

- shared metadata formats
- shared runtime contracts
- stable repository vocabulary
- stable placement and authority rules
- stable validation and tooling semantics
- concept registries that support architecture without replacing it

## What Does Not Belong Here

- one-off migration notes
- source-import comparisons
- maintainer operating procedure
- runtime help that must ship inside one skill
- full system architecture design

Those belong in:

- `mem/`
  - source-import comparisons that are not yet stable Bagakit semantics
- `docs/stewardship/`
  - one-off migration notes and maintainer operating procedure
- `skills/`
  - runtime help that must ship inside one skill
- `docs/architecture/`
  - full system architecture design

## Authority Relationship

When specs and architecture touch the same topic:

- `docs/architecture/` is the SSOT for system structure, ownership, and flow
- `docs/specs/` is the SSOT for stable contracts, stable vocabulary, and
  durable semantics

When specs and stewardship touch the same topic:

- `docs/specs/` keeps the stable rule
- `docs/stewardship/` keeps the maintainer procedure for using or reviewing it

## Examples

Current examples include:

- `canonical-capability-ladder.md`
- `document-surface-rules.md`
- `feature-tracker-id-issuance.md`
- `bagakit-driver-contract.md`
- `evolver-memory.md`
- `flow-runner-contract.md`
- `harness-concepts.md`
- `living-knowledge-system.md`
- `selector-evolver-boundary.md`
- `selector-planning-entry-routes.md`
- `tooling-rules.md`
- `validation-system.md`

## Writing Rule

Specs should be boundary-first and stable-first:

- say what the surface owns
- say what it does not own
- say how it relates to neighboring surfaces
- avoid migration-history narration unless that history is required to define
  the stable contract
