# Document Surface Rules

This document defines where Bagakit repository documents belong by authority
and stability.

## Purpose

Use this rule before adding a new repository document.

The goal is to keep:

- system-design truth in architecture surfaces
- stable Bagakit truth in stable surfaces
- evolving analysis in evolving surfaces
- runtime-facing content in runtime surfaces
- maintainer-only guidance out of runtime payload

## Placement Rules

### `docs/architecture/`

Use for:

- complete system design
- system boundary
- governance structure
- layer relationships
- cross-surface flow design
- routing and promotion structure

Do not use for:

- field-level data contracts
- maintainer SOPs
- runtime skill instructions
- evolving comparison notes

### `docs/specs/`

Use for:

- stable shared semantics
- shared concept definitions
- shared contract rules
- durable semantic rules

Do not use for:

- migration comparisons
- source-alias tables
- rename-candidate tracking
- import reviews
- maintainer operating procedures

### `docs/stewardship/`

Use for:

- maintainer-facing procedures
- operating guidance
- review workflows
- stewardship notes tied to repository operation

Do not use for:

- runtime skill payload content
- stable shared contract semantics

### `mem/`

Use for:

- durable but still-evolving observations
- migration notes
- import comparisons
- source mappings
- rename candidates
- evidence and context that are not yet stable Bagakit truth

Promotion rule:

- if content is still comparing Bagakit with an external or source system, keep
  it in `mem/`
- promote into `docs/specs/` only after the Bagakit-owned result has been
  rewritten in Bagakit terms

### `skills/`

Use for:

- runtime-facing skill payload content
- agent-facing workflow semantics that must ship with the skill

Do not use for:

- maintainer-only docs
- repo-level stable specs

### `dev/`

Use for:

- maintainer-only executable tooling

Do not use for:

- primary agent-facing workflow semantics
- stable repository semantics

## Root Rule

Do not add new root-level design or spec files for repository semantics unless:

- the user explicitly asks for a root-level file
- or an existing repository rule already defines that root-level surface

Default rule:

- repository semantics belong under `docs/`, not at repo root

## Authority Rule

When architecture and specs both touch the same topic:

- `docs/architecture/` is the SSOT for system structure, ownership, and flow
- `docs/specs/` is the SSOT for stable contracts, stable vocabulary, and
  durable semantic rules
- `docs/stewardship/` is the SSOT for maintainer-facing operating procedure

## Pre-Write Check

Before creating a new document, answer these questions:

1. Is this stable semantics, stewardship guidance, evolving memory, runtime
   payload, or tooling?
2. Does the proposed path match that authority?
3. Is this document defining Bagakit truth directly, or still analyzing a
   source/external system?
4. If it is still analysis, why is it not in `mem/`?
