# Docs

This directory is the repository-owned documentation system for the canonical
Bagakit monorepo.

## Purpose

`docs/` exists so Bagakit can keep:

- architecture truth separate from stable contracts
- stable contracts separate from maintainer procedure
- maintainer procedure separate from runtime payload
- local research and migration analysis out of stable documentation by default

It is not a generic bucket for every markdown file in the repository.

## First Principle

`docs/` owns reviewable repository writing outside installed runtime payloads.

That means:

- runtime-facing workflow instructions belong in `skills/`
- stable repository semantics belong in `docs/specs/`
- complete repository design belongs in `docs/architecture/`
- maintainer-facing governance belongs in `docs/stewardship/`
- still-evolving comparisons, migration notes, and import reviews belong in
  `mem/`

If one topic needs all of those at once, split the topic by authority instead
of collapsing it into one catch-all document.

## Surface Model

### `docs/architecture/`

Owns:

- system structure
- layer boundaries
- cross-surface flow design
- governance structure
- architecture decisions that shape multiple surfaces

Does not own:

- stable field contracts
- maintainer SOPs
- runtime skill instructions

### `docs/specs/`

Owns:

- stable contracts
- stable vocabulary
- stable placement rules
- stable semantics that multiple repository surfaces depend on

Does not own:

- complete architecture design
- maintainer runbooks
- source-analysis or migration comparison notes

### `docs/stewardship/`

Owns:

- maintainer-facing operating guidance
- review discipline
- stewardship procedures
- repository governance practice

Does not own:

- primary architecture truth
- stable shared contracts
- runtime-facing instructions

## Related Repository Surfaces

- `skills/`
  - installable runtime skill payloads
- `gate_validation/`
  - release-blocking proof surface
- `gate_eval/`
  - non-blocking measurement surface
- `dev/`
  - maintainer-only tools
- `mem/`
  - durable but still-evolving memory, migration notes, and analysis

## Authority Order

When multiple surfaces touch the same topic, use this order:

1. `docs/architecture/`
   - structure, ownership, and flow
2. `docs/specs/`
   - durable contracts, vocabulary, and stable semantics
3. `docs/stewardship/`
   - maintainer procedure and operating guidance
4. `mem/`
   - evolving comparison or migration context that is not yet stable truth
5. `skills/`
   - runtime instructions that ship with one installable skill

## Local Working Areas

First-level hidden directories under `docs/` are reserved for local working
areas such as docs-local scratch notes and temporary draft material.

Rules:

- keep them hidden at the first level
- keep them out of stable docs by default
- do not treat them as the canonical runtime root for `bagakit-researcher`
- promote from them only after Bagakit-owned conclusions are rewritten in
  Bagakit terms

## Documentation Norms

- Keep documents boundary-first. Say what the surface owns before explaining
  how it works.
- Prefer explicit non-goals when a document is replacing or narrowing an older
  bundled surface.
- If a document describes a successor surface, say whether it is a full
  successor, a partial successor, or a decomposition target.
- Rewrite imported source ideas in Bagakit terms before promoting them into
  stable docs.
- Do not duplicate the same rule across architecture, specs, and stewardship
  just to make each file feel complete.

Detailed placement and authority rules live in:

- `docs/specs/document-surface-rules.md`

## Read Path

Start here when orienting to the repository docs system:

1. `docs/must-guidebook.md`
2. `docs/must-authority.md`
3. `docs/must-sop.md`
4. `docs/must-recall.md`
5. `docs/architecture/A0-README.md`
6. `docs/specs/README.md`
7. `docs/stewardship/README.md`
