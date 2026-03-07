# Research Workflow SOP

This document defines the maintainer research workflow for this repository.

## Purpose

Research should compound into local repository knowledge instead of being
re-done from scratch in each session.

The goal is:

- search local context first
- when external research is needed, preserve original material
- create summaries that are usable later
- keep topic indexes current so future research starts from local memory

## Storage Rule

Research results should be stored in the canonical `bagakit-researcher`
runtime root.

For this repository, the default root is:

- `.bagakit/researcher/`

If `.bagakit/knowledge_conf.toml` declares `researcher_root`, use that
configured root instead.

## Topic Workspace Rule

Each research topic should have a topic workspace.

Recommended shape:

```text
<researcher_root>/topics/<topic-class>/<topic>/
├── originals/
├── summaries/
└── index.md
```

`researcher_root` may override the default root only when it stays under
`.bagakit/`.

Recommended meaning:

- `originals/`
  - downloaded source files or full excerpted originals
- `summaries/`
  - per-source summaries or syntheses
- `index.md`
  - topic-level map of what exists locally and what changed

## Research Procedure

1. Check local repository research first.
2. If the topic already exists locally, read its current index before searching.
3. Only then search externally for missing or weak coverage.
4. For every externally used source, preserve the original material locally.
5. For every preserved original, create a usable summary.
6. Update or expand the local topic content after the research pass.
7. Update the topic index in the same pass.

This is mandatory behavior, not a suggestion.

## Original Material Rule

When a source is important enough to inform repository decisions, do not keep
only a short note or a URL.

You must preserve one of:

- the downloaded original file
- a complete local excerpt or transcription of the original material

The intent is to keep enough original evidence for later re-reading or
verification without depending on memory alone.

Do not keep only:

- a short quote
- a link
- a summary without original evidence

## Summary Rule

For each preserved original, create a summary that is useful for later work.

A good summary should cover:

- what the source is
- why it matters
- the key claims or mechanisms
- what Bagakit should adopt, reject, or revisit

## Topic Index Rule

Each topic workspace must keep an index file.

The topic index should be updated whenever:

- new originals are added
- old summaries are revised
- the topic scope changes
- a new conclusion changes what future sessions should read first

The index should help the next maintainer answer:

- what local material already exists
- what is new since the last pass
- what remains missing
- which files to read first

## Evolver Link Rule

A research topic may be weakly referenced from `.bagakit/evolver/`.

This is optional.

Rules:

- the researcher workspace is not a hard dependency of the evolver tool
- missing or moved researcher paths should not block evolver operation
- if a maintainer chooses to add a local context ref, it should stay
  repo-relative
