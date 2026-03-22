# Researcher

This directory is the canonical runtime root for `bagakit-researcher` in this
repository.

It exists so research evidence can stay:

- local
- reusable
- filesystem-first
- separate from durable promotion

Machine-readable ownership lives in:

- `surface.toml`

## What Lives Here

- topic workspaces under `topics/<topic-class>/<topic>/`
- researcher-owned evidence artifacts such as:
  - `originals/`
  - `summaries/`
  - `index.md`

## What Does Not Live Here

- shared durable knowledge root
  - `docs/`
- repository evolution memory
  - `.bagakit/evolver/`
- task-local composition and usage evidence
  - `.bagakit/skill-selector/`

## Rule

`bagakit-researcher` workspaces are the canonical Bagakit research runtime
surface for this repository.

Do not fall back to hidden `docs/.<topic-class>/...` workspaces.
