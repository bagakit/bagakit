# bagakit-researcher

Standalone local-first research workflow for repositories that need:

- topic-scoped research workspaces
- source cards
- reusable summaries
- topic indexes
- researcher-local wiki/frontdoor pages derived from topic evidence

## Runtime Surface Declaration

- top-level runtime surface root when materialized:
  - `.bagakit/researcher/`
- shared path protocol file:
  - `docs/.bagakit-knowledge.toml`
- stable contract:
  - `docs/specs/runtime-surface-contract.md`
- if the top-level root exists in a host repo, it should carry `surface.toml`

## Core Surfaces

- default runtime root:
  - `.bagakit/researcher/topics/<topic-class>/<topic>/`
- configured runtime root, when `docs/.bagakit-knowledge.toml` declares
  `researcher_root` under `.bagakit/`:
  - `<researcher_root>/topics/<topic-class>/<topic>/`
- required topic files:
  - `originals/`
  - `summaries/`
  - `index.md`
- optional derived frontdoor:
  - `.bagakit/researcher/index.md`
  - `.bagakit/researcher/wiki/`

## Quick Start

```bash
sh scripts/bagakit-researcher.sh refresh-wiki --root .
sh scripts/bagakit-researcher.sh list-topics --root .
sh scripts/bagakit-researcher.sh doctor --root . --wiki

sh scripts/bagakit-researcher.sh init-topic \
  --root . \
  --topic-class frontier \
  --topic researcher-skill \
  --title "Researcher Skill"

sh scripts/bagakit-researcher.sh add-source-card \
  --root . \
  --topic-class frontier \
  --topic researcher-skill \
  --source-id a01 \
  --title "Example Source" \
  --url "https://example.com" \
  --authority primary \
  --why "sets the baseline"

sh scripts/bagakit-researcher.sh add-summary \
  --root . \
  --topic-class frontier \
  --topic researcher-skill \
  --source-id a01 \
  --title "Example Source Summary" \
  --why-matters "clarifies the core pattern"

sh scripts/bagakit-researcher.sh refresh-index \
  --root . \
  --topic-class frontier \
  --topic researcher-skill

sh scripts/bagakit-researcher.sh refresh-wiki --root .
sh scripts/bagakit-researcher.sh doctor --root . --wiki
```

## Design Notes

- `bagakit-researcher` is the evidence-production surface, not the promotion surface.
- `topics/` is the evidence source of truth; `wiki/` is a derived navigation layer.
- New research should read the wiki/frontdoor first when prior topics exist.
- A loop that reads the wiki and changes topic evidence should refresh the
  relevant topic index, refresh the wiki, and run `doctor --wiki` before
  handoff.
- Shared conclusions may later move into a host knowledge system or evolver,
  but that is an explicit next step.
- The default contract stays filesystem-first and human-readable first.
