# bagakit-researcher

Standalone local-first research workflow for repositories that need:

- topic-scoped research workspaces
- source cards
- reusable summaries
- topic indexes

## Core Surfaces

- default runtime root:
  - `.bagakit/researcher/topics/<topic-class>/<topic>/`
- configured runtime root, when `.bagakit/knowledge_conf.toml` declares
  `researcher_root`:
  - `<researcher_root>/topics/<topic-class>/<topic>/`
- required topic files:
  - `originals/`
  - `summaries/`
  - `index.md`

## Quick Start

```bash
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

sh scripts/bagakit-researcher.sh list-topics --root .
sh scripts/bagakit-researcher.sh doctor --root .
```

## Design Notes

- `bagakit-researcher` is the evidence-production surface, not the promotion surface.
- Shared conclusions may later move into a host knowledge system or evolver,
  but that is an explicit next step.
- The default contract stays filesystem-first and human-readable first.
