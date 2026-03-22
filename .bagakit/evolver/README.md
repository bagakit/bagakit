# Evolver State

This directory holds project-local evolver state for this repository.

Machine-readable ownership lives in:

- `surface.toml`

Current structure:

- `index.json`
  - repository-wide topic registry
- `topics/<topic>/topic.json`
  - topic-local evolver state
- `topics/<topic>/README.md`
  - quick human-readable topic summary

Weak-link note:

- topics may carry repo-relative `local_context_refs`
- those refs are optional context pointers, not hard dependencies
