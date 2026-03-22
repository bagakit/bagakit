# Skill Selector State

This directory is the canonical runtime root for `bagakit-skill-selector` in
this repository.

It exists so selector state can stay:

- task-local
- reviewable
- append-friendly
- separate from repository-level evolver memory

## What Lives Here

- task records under `tasks/<task-slug>/`
- optional private day notes under `daily/`
- optional host-local preference hints such as `project-preferences.toml`

## What Does Not Live Here

- shared durable knowledge
  - `docs/`
- repository-evolution memory
  - `.bagakit/evolver/`
- researcher evidence workspaces
  - `.bagakit/researcher/`

## Rule

Task-local skill usage truth belongs here when selector is the chosen entry
surface.

Repository-level learning must not silently drift into this subtree.
