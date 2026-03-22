# Living Knowledge Local State

This directory holds project-local helper outputs for
`bagakit-living-knowledge`.

It is not the shared checked-in knowledge root.
That role belongs to `docs/` in this repository.

## What Lives Here

- generated helper output under `.generated/`

## What Does Not Live Here

- shared durable knowledge pages
  - `docs/`
- researcher workspaces
  - `.bagakit/researcher/`
- selector task logs
  - `.bagakit/skill-selector/`
- repository evolution memory
  - `.bagakit/evolver/`

## Rule

Treat this root as generated local helper state.
The shared path protocol still begins at `.bagakit/knowledge_conf.toml`.
