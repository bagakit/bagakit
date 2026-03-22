# .bagakit

This directory holds project-local Bagakit state and managed artifacts for this
repository.

Rules:

- operational project state may live here
- canonical Bagakit runtime state may live here when one Bagakit system owns
  that state explicitly
- each materialized top-level runtime surface under `.bagakit/` should carry
  `surface.toml` as its machine-readable ownership marker
- researcher-owned evidence workspaces live under `.bagakit/researcher/`
- evolver-owned decision memory lives under `.bagakit/evolver/`
- selector-owned task-local evidence lives under `.bagakit/skill-selector/`
- generated local living-knowledge helper output lives under
  `.bagakit/living-knowledge/`
- root-adjacent protocol files such as `.bagakit/knowledge_conf.toml` still
  need one explicit owner
- stable public rules still belong in `docs/`
- `docs/` must not become a fallback runtime root for Bagakit systems

Stable contract:

- `docs/specs/runtime-surface-contract.md`
