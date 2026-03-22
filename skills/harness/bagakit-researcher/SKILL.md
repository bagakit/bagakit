---
name: bagakit-researcher
description: Use when a repository needs a standalone local-first research workflow with topic workspaces, source cards, reusable summaries, and refreshed topic indexes that can later feed living-knowledge or evolver without becoming a hard dependency.
metadata:
  bagakit:
    harness_layer: l2-behavior
---

# Bagakit Researcher

`bagakit-researcher` is the Bagakit runtime surface for evidence production.

It should stay:

- standalone-first
- independently distributable
- independently usable without a mandatory knowledge or evolver system

## When To Use

Use this skill when a repository needs:

- one local-first research loop instead of repeated ad hoc searching
- preserved source cards for important material
- reusable per-source summaries
- topic indexes that tell the next operator what already exists
- explicit separation between research evidence and later promotion

Do not use this skill when:

- you only need one quick lookup and no durable local research record
- the work is already mature shared knowledge that belongs directly in the shared knowledge root
- the work is a repository-evolution decision topic that should live in `evolver`

## Boundary

This skill does:

- create and maintain topic-scoped research workspaces
- keep local-first research behavior explicit
- preserve important source cards
- write reusable summaries
- refresh topic indexes
- produce evidence that may later feed `bagakit-living-knowledge` or `bagakit-skill-evolver`

This skill does not:

- own shared project knowledge
- own repository-system evolution memory
- decide durable promotion on its own
- require another Bagakit skill in default mode

## Runtime Surface Declaration

- top-level runtime surface root when materialized:
  - `.bagakit/researcher/`
- optional root-adjacent protocol file:
  - `.bagakit/knowledge_conf.toml`
- stable contract:
  - `docs/specs/runtime-surface-contract.md`
- if the top-level root exists in a host repo, it should carry `surface.toml`

## Core Surfaces

Researcher uses the configured `researcher_root` when `.bagakit/knowledge_conf.toml` exists.

Current default:

- `.bagakit/researcher`

Each topic lives under:

- `<researcher_root>/topics/<topic-class>/<topic>/`

Rule:

- `researcher_root` may override the default path only when it stays under
  `.bagakit/`
- hidden `docs/.<topic-class>/...` roots are not valid Bagakit researcher
  runtime paths

Required topic members:

- `originals/`
  - source cards and preserved source references
- `summaries/`
  - reusable per-source summaries
- `index.md`
  - topic map and reading order

## Recommended Flow

1. Initialize one topic workspace:

```bash
sh scripts/bagakit-researcher.sh init-topic \
  --root . \
  --topic-class frontier \
  --topic researcher-skill \
  --title "Researcher Skill"
```

2. Add one source card:

```bash
sh scripts/bagakit-researcher.sh add-source-card \
  --root . \
  --topic-class frontier \
  --topic researcher-skill \
  --source-id a01 \
  --title "Example Source" \
  --url "https://example.com" \
  --authority primary \
  --published <yyyy-mm-dd> \
  --why "sets the baseline for the topic"
```

3. Add one reusable summary:

```bash
sh scripts/bagakit-researcher.sh add-summary \
  --root . \
  --topic-class frontier \
  --topic researcher-skill \
  --source-id a01 \
  --title "Example Source Summary" \
  --why-matters "it clarifies the core pattern" \
  --borrow "one strong reusable idea" \
  --avoid "one wrong direction" \
  --implication "one Bagakit-specific consequence"
```

4. Refresh the topic index:

```bash
sh scripts/bagakit-researcher.sh refresh-index \
  --root . \
  --topic-class frontier \
  --topic researcher-skill \
  --title "Researcher Skill"
```

5. Before new search, inspect what already exists:

```bash
sh scripts/bagakit-researcher.sh list-topics --root .
sh scripts/bagakit-researcher.sh doctor --root .
```

## Handoff

If another system needs the result, hand off explicitly:

- `bagakit-living-knowledge`
  - ingest reviewed summaries or conclusions into the shared knowledge root
- `bagakit-skill-evolver`
  - attach the research workspace as optional local context or summarize key sources into topic state
- `bagakit-skill-selector`
  - record `bagakit-researcher` as a task candidate and log whether the research pass helped

These handoffs are optional and contract-driven.
Standard cross-skill combinations should be expressed through
`bagakit-skill-selector/recipes/`, not hidden as researcher-side runtime
coupling.

## Footer Contract

When the surrounding workflow explicitly asks for research-task reporting, it may use:

```text
[[BAGAKIT]]
- Researcher: Topic=<topic-class/topic>; Evidence=<index + source cards + summaries>; Next=<one deterministic next action>
```

## References

- `references/research-workspace-spec.md`
