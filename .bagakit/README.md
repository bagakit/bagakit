# .bagakit

This directory holds project-local Bagakit state and managed artifacts for this
repository.

Rules:

- operational project state may live here
- canonical Bagakit runtime state may live here when one Bagakit system owns
  that state explicitly
- researcher-owned evidence workspaces live under `.bagakit/researcher/`
- evolver-owned decision memory lives under `.bagakit/evolver/`
- stable public rules still belong in `docs/`
- `docs/` must not become a fallback runtime root for Bagakit systems
