# Document Surface Rules

This document defines the placement and writing rules for repository documents
by authority, stability, and owning surface.

## Purpose

Use this rule before adding or significantly rewriting a repository document.

The goal is to keep:

- architecture truth in architecture surfaces
- stable semantics in spec surfaces
- maintainer procedure in stewardship surfaces
- evolving comparison and migration context in memory surfaces
- runtime-facing instructions inside runtime payloads

## First Principle

One document path should express one authority boundary.

Do not let one file silently become:

- part architecture
- part stable contract
- part maintainer SOP
- part migration notebook

If a topic spans those concerns, split the topic by authority instead of
forcing one hybrid document.

## Surface Placement Rules

### `docs/architecture/`

Owns:

- complete system design
- boundary decisions
- layer relationships
- governance structure
- cross-surface flow design
- routing and promotion structure

Does not own:

- field-level contracts
- maintainer SOPs
- runtime skill instructions
- source-analysis notes

### `docs/specs/`

Owns:

- stable shared semantics
- shared concept definitions
- shared contract rules
- durable semantic rules
- document-placement and authority rules

Does not own:

- migration comparisons
- source-alias tables
- rename-candidate tracking
- import reviews
- maintainer operating procedures

### `docs/stewardship/`

Owns:

- maintainer-facing procedures
- operating guidance
- review workflows
- repository governance practice

Does not own:

- runtime payload content
- stable shared semantic contracts
- primary architecture truth

### `mem/`

Owns:

- durable but still-evolving observations
- migration notes
- source mappings
- import comparisons
- rewrite plans that are not yet stable Bagakit truth

Promotion rule:

- if content is still comparing Bagakit with an external or source system, keep
  it in `mem/`
- promote into `docs/` only after the Bagakit-owned result has been rewritten
  in Bagakit terms

### `skills/`

Owns:

- runtime-facing skill payload content
- agent-facing workflow semantics that must ship with one skill

Does not own:

- maintainer-only explanation
- repo-level architecture or stable specs

### `dev/`

Owns:

- maintainer-only executable tooling
- tool project README files that explain those tools

Does not own:

- primary runtime workflow semantics
- stable repository semantics

## Root Rule

Do not add new root-level design or spec files for repository semantics unless:

- the user explicitly asks for a root-level file
- or an existing repository rule already defines that root-level surface

Default rule:

- repository semantics belong under `docs/`, not at repo root

## Authority Rule

When multiple surfaces touch one topic:

- `docs/architecture/` is the SSOT for system structure, ownership, and flow
- `docs/specs/` is the SSOT for stable contracts, vocabulary, and durable
  semantics
- `docs/stewardship/` is the SSOT for maintainer-facing operating procedure
- `mem/` is the holding area for analysis that is not yet stable Bagakit truth

## Successor Boundary Rule

When a document describes a successor to an older bundled surface:

- say whether it is a full successor, a partial successor, or a decomposition
  target
- say which mechanisms are kept, moved, or removed
- name the peer systems that now own moved mechanisms
- do not keep legacy bundle language once a newer boundary document exists

This rule applies to repository docs and to canonical skill docs.

## Documentation Shape Rule

For canonical documents that define one surface or boundary, prefer a
boundary-first shape close to the `bagakit-living-knowledge` pattern:

1. `Purpose`
2. `First Principle`
3. ownership or surface model
4. explicit non-ownership or removed-from-contract scope
5. related surfaces or composition notes
6. practical rules, flow, or maintenance guidance

Use this shape when it improves clarity.
Do not force it into documents that are better expressed as registries,
templates, or protocol references.

## Pre-Write Check

Before creating or heavily rewriting a document, answer these questions:

1. Is this architecture, stable semantics, stewardship guidance, evolving
   memory, runtime payload, or tooling?
2. Does the proposed path match that authority?
3. Is this document defining Bagakit truth directly, or still analyzing a
   source or external system?
4. If it is still analysis, why is it not in `mem/`?
5. If this is a successor or boundary document, does it explicitly say what was
   kept, moved, or removed?
