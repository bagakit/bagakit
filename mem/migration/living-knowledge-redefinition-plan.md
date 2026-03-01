# Living Knowledge Redefinition Plan

## Purpose

Define the re-absorption plan for `bagakit-living-docs` into the canonical
Bagakit monorepo as `bagakit-living-knowledge`.

This plan exists before runtime implementation on purpose.
The goal is to lock the architectural stance first and only then land the new
runtime contract.

## Decision Anchors

- independent distribution is a hard principle
- the current repository should adapt to the final `living-knowledge` system
  instead of forcing self-hosting-only defaults
- the final system should be filesystem-first and must not require RAG or
  vector infrastructure
- the checked-in knowledge surface should feel like a clean filesystem wiki and
  remain comfortable for humans to read
- `living_knowledge` is the host or project knowledge substrate
- `evolver` is the repository-system evolution control plane
- the relationship between them is routed evidence flow, not a superset
  relation
- maintainer planning and migration notes belong in `mem/`, not in runtime
  payload

## First-Principles Definition

`bagakit-living-knowledge` should be treated as a standalone project knowledge
system that can be distributed into any host repository.

Its first job is not "generate docs".
Its first job is to give a project one coherent knowledge substrate that
supports:

- project-facing wiki-like knowledge surfaces
- managed agent instructions
- shared inbox and reviewed shared memory
- local private overlays and maintenance state
- deterministic recall
- local promotion into more durable project knowledge

The Bagakit repository must be able to adopt that same system without turning
self-hosting into a special compatibility branch.

## Non-Goals

The redefinition should not:

- merge host knowledge and repository-system evolution memory
- turn `bagakit-living-knowledge` into a second `evolver`
- preserve the old `bagakit-living-docs` contract unchanged just to avoid
  migration work
- lock the new contract to one repository's current directory layout
- leak maintainer-only migration or review materials into the skill payload

## Why Redefinition Is Required

The legacy `bagakit-living-docs` repo is not ready to absorb unchanged.

Main reasons:

- it is named and framed around "docs" even though the capability is broader
- its default contract is tied to the older `docs/must-*.md` system-doc model
- its current validation assumes one specific docs layout
- its current wording does not sharply separate host knowledge from
  repository-system evolution memory
- it is not yet explicit enough about human-readable wiki structure as the
  checked-in primary surface
- it does not distinguish shared inbox and reviewed shared memory from local
  private runtime state strongly enough for the new contract

So the right move is not "rename and copy".
The right move is "redefine the final system, then migrate the current repo to
match it".

## Redefinition Workstreams

### 1. Canonical Runtime Contract

Define the final runtime contract for:

- knowledge surfaces
- managed instruction block
- shared inbox and reviewed shared memory layout
- local private runtime layout
- recall contract
- local promotion contract
- optional generic signal exchange plus routed-evidence handoff toward
  `evolver`

The contract must be distributable without requiring Bagakit self-hosting.

### 2. Current Repository Adoption

Adapt the `skills` repository to the new living-knowledge system.

This includes:

- identifying which current repository docs surfaces map cleanly into the new
  knowledge contract
- deciding which current files are durable project knowledge, evolving memory,
  or system evolution state
- migrating repository structure where the final system requires it

### 3. Payload And Boundary Cleanup

Absorb only runtime-appropriate payload into:

- `skills/harness/bagakit-living-knowledge/`

Move maintainer-only materials to repository surfaces such as:

- `mem/`
- `docs/specs/`
- `docs/stewardship/`
- `gate_validation/`

Do not use `SKILL_PAYLOAD.json`.

### 4. Validation And Delivery Registration

After the contract is stable enough:

- add canonical registry entry
- add delivery profile
- add skill-specific validation
- add absorption/migration memory updates

## Immediate Next Moves

1. write the final `bagakit-living-knowledge` boundary and trigger contract
2. decide the Bagakit profile line for managed instructions and completion
   footer
3. define the new default project knowledge layout without self-hosting
   exceptions
4. compare that layout against the current repository and list required
   migrations
5. only then port scripts/templates from `bagakit-living-docs`

## Completion Signal For This Plan Phase

This planning phase is complete when:

- the canonical skill directory exists
- the redefinition stance is explicit
- the next implementation pass can proceed without reopening the basic
  architectural question
