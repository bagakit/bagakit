# Living Knowledge Boundary

This document records the architectural boundary decision for
`bagakit-living-knowledge`.

It exists because legacy `bagakit-living-docs` bundled too many mechanisms into
one runtime and the monorepo rewrite split several of them into separate
systems.

## Decision

`bagakit-living-knowledge` is not the full one-to-one successor of legacy
`bagakit-living-docs`.

It is the canonical successor only for the host or project knowledge substrate
role.

That means it owns:

- the shared checked-in knowledge surface
- the managed bootstrap reading surface
- the path protocol for related host-facing systems
- normalization, indexing, recall, and explicit reviewed ingestion into shared
  knowledge
- progressive-loading system pages such as `must-guidebook.md`,
  `must-authority.md`, and `must-recall.md`

It does not own:

- research workspaces
- task-level inbox or composition state
- repository-system memory and promotion state
- global generated `must-sop.md`
- repository-wide frontmatter governance for ordinary docs
- reusable-items runtime behavior
- learning-contract runtime behavior

The old integrated skill is therefore being decomposed, not mechanically
renamed.

## Why

This boundary keeps three first principles intact:

- standalone distribution must remain real
- host knowledge must not collapse into repository-system evolution memory
- knowledge substrate should stay human-readable and auditable instead of
  becoming a catch-all workflow shell

If `living-knowledge` keeps reabsorbing inbox, promotion, research exchange,
and document-governance engines, it stops being a substrate and becomes another
all-in-one host control plane.

That would recreate the same boundary blur that the split was meant to remove.

## Legacy Mechanism Mapping

### Kept In `bagakit-living-knowledge`

- managed `AGENTS.md` bootstrap block
- progressive-loading `must-*` reading surfaces
- shared path protocol through `.bagakit/knowledge_conf.toml`
- shared knowledge normalization
- deterministic recall over shared knowledge
- explicit reviewed ingestion into the shared knowledge root

### Moved To Peer Systems

- research capture, source cards, summaries, topic indexes
  - owner: `bagakit-researcher`
- task-level intake, composition visibility, usage evidence
  - owner: `bagakit-skill-selector`
- repository-level memory, decision state, promotion tracking
  - owner: `bagakit-skill-evolver`

### Removed From The Core `living-knowledge` Contract

- shared inbox to shared memory runtime
- generated `must-sop.md`
- mandatory frontmatter governance for ordinary docs
- learning-contract exchange runtime
- reusable-items runtime scaffolding

These may still appear in one host repository as ordinary content or as part of
another explicit skill contract.

They are not implicit obligations of `bagakit-living-knowledge`.

## Clarifications

### `must-*` stays, but thinner

The old skill used `must-*` as a broad governance shell.

The new system keeps only the part that serves progressive loading and shared
authority:

- `must-guidebook.md`
- `must-authority.md`
- `must-recall.md`

It does not require one generated `must-sop.md` as a global control document.

If a host wants maintenance-route guidance, that guidance should live as
ordinary shared pages or as a future explicit generator contract owned by a
different skill.

### Frontmatter is no longer a repository-wide living-knowledge rule

Some runtime skills may still use frontmatter where structured documents help.

That does not make frontmatter the universal governance mechanism for the host
knowledge substrate.

Document-local schemas should be owned by the skill or surface that needs them.

### Reusable items become content, not a hidden engine

If a repository wants reusable patterns, checklists, or examples, those may
live as ordinary curated pages under the shared knowledge root.

`living-knowledge` does not own a special reusable-items runtime, generator, or
enforcement loop.

If that behavior becomes important enough, it should be promoted as its own
explicit canonical skill.

### Promotion is explicit

`living-knowledge` may ingest reviewed material into shared knowledge.

It does not own the broader promotion pipeline that decides whether something
should stay task-local, stay research-local, become host knowledge, or become
upstream Bagakit truth.

That routing belongs to explicit outer decisions and, for repository-level
promotion memory, to `bagakit-skill-evolver`.

## Non-Goals

This decision does not imply:

- that the removed legacy mechanisms were worthless
- that no repository may ever use frontmatter, SOP pages, or reusable-item
  catalogs
- that `living-knowledge` may never grow

It only means growth now needs explicit ownership and a clean boundary, instead
of silently inheriting every useful thing old `bagakit-living-docs` once did.
