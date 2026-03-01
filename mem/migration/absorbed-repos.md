# Absorbed Standalone Repos

This file records standalone repositories that have already been absorbed into
the canonical Bagakit monorepo as the primary authoring surface.

Absorbed here means:

- the monorepo path is now the intended canonical authoring source
- the standalone repo should no longer be treated as equal architectural truth
- the standalone repo may remain as a legacy distribution, projection, or
  freeze target until projection flow is finalized

## Current Entries

### `bagakit-git-commit-spec`

- source repo:
  - `bagakit-git-commit-spec`
- absorbed as:
  - canonical skill id: `bagakit-git-message-craft`
  - canonical path: `skills/swe/bagakit-git-message-craft/`
- absorbed role:
  - standalone-first Git message planning, drafting, linting, and archive
    handoff under the cleaner canonical name `bagakit-git-message-craft`
- cutover scope:
  - canonical runtime payload now lives at the monorepo destination as the only
    authoring surface
  - installable runtime source and skill-owned validation now live at the
    monorepo destination
- onboarding status:
  - authoring absorbed
  - installability and skill-owned validation are landed at the monorepo
    destination
- standalone repo status:
  - legacy standalone source
  - freeze or projection candidate
- why it is considered absorbed:
  - canonical repo metadata now routes this skill through the monorepo
    destination instead of the standalone repo
  - the monorepo validation surface now owns the maintainer-only gate for this
    skill
  - the standalone repo should no longer remain equal architectural truth now
    that the canonical payload copy has landed

### `bagakit-skill-evolve`

- source repo:
  - `bagakit-skill-evolve`
- absorbed as:
  - canonical skill id: `bagakit-skill-selector`
  - canonical path: `skills/harness/bagakit-skill-selector/`
- absorbed role:
  - task-level or host-level skill selection and usage evidence loop
- cutover scope:
  - canonical authoring has moved to the monorepo destination
- onboarding status:
  - authoring absorbed
  - installable runtime source is landed at the monorepo destination
- standalone repo status:
  - legacy standalone source
  - freeze or projection candidate
- why it is considered absorbed:
  - the monorepo copy already carries the newer positioning and routing model
  - the monorepo copy is the version that is being aligned with the current
    Bagakit system model
  - the standalone repo no longer needs to remain a parallel architectural
    source of truth

### `bagakit-living-docs`

- source repo:
  - `bagakit-living-docs`
- absorbed as:
  - canonical skill id: `bagakit-living-knowledge`
  - canonical path: `skills/harness/bagakit-living-knowledge/`
- absorbed role:
  - standalone host or project knowledge substrate with:
    - managed bootstrap reading surfaces
    - shared checked-in knowledge
    - normalization, indexing, and recall over that shared knowledge
    - local runtime state for private overlays, signals, and maintenance runs
- cutover scope:
  - canonical authoring has moved to the monorepo destination
  - the host or project knowledge substrate role is now owned by the monorepo
    destination
  - related runtime mechanisms have been split out to peer systems instead of
    being inherited as one bundled successor
- onboarding status:
  - authoring absorbed
  - substrate boundary is landed
  - remaining adoption work belongs to peer systems and host integration, not
    to re-expanding `living-knowledge`
- standalone repo status:
  - legacy standalone source
  - freeze or projection candidate
- why it is considered absorbed:
  - the monorepo copy now defines the canonical naming, boundary model, and
    runtime surface for this capability
  - the legacy integrated bundle is now treated as decomposed into:
    - `bagakit-living-knowledge`
    - `bagakit-researcher`
    - `bagakit-skill-selector`
    - `bagakit-skill-evolver`
  - the old standalone repo should no longer remain equal architectural truth
    once the canonical substrate boundary is owned here

### `bagakit-brainstorm`

- source repo:
  - `bagakit-brainstorm`
- absorbed as:
  - canonical skill id: `bagakit-brainstorm`
  - canonical path: `skills/harness/bagakit-brainstorm/`
- absorbed role:
  - Markdown-to-options planning and handoff workflow with explicit artifact stages
- cutover scope:
  - canonical runtime payload copy now exists in the monorepo destination
  - installable runtime source now lives at the monorepo destination
- onboarding status:
  - authoring absorbed
  - runtime onboarding is still in progress while Bagakit-native routing and
    review semantics continue to settle
- standalone repo status:
  - legacy standalone source
  - freeze or projection candidate
- why it is considered absorbed:
  - the monorepo copy is now the canonical Bagakit landing surface for this skill
  - future contract cleanup can happen against the monorepo destination instead of keeping split truth
  - the standalone repo should no longer remain equal architectural truth once monorepo onboarding continues

## Entry Rule

Add a standalone repo here only when:

- its monorepo destination is clear
- the monorepo copy is the intended canonical authoring surface
- the standalone repo should no longer be treated as equal truth

Do not add a repo here merely because a copy exists.
