# bagakit-living-knowledge

Shared filesystem-first knowledge substrate for repositories that need:

- one configurable shared knowledge root
- system pages for progressive loading
- generated maintenance-route guidance through `must-sop.md`
- reusable-items governance inside the shared knowledge root
- deterministic recall over shared checked-in knowledge
- a thin ingestion path for reviewed markdown

This skill does not own:

- research runtime
- task-level inbox/runtime
- repository evolution memory

## Core Surfaces

- config:
  - `.bagakit/knowledge_conf.toml`
- shared root:
  - default `docs/`
- system pages under the shared root:
  - `must-guidebook.md`
  - `must-authority.md`
  - `must-sop.md`
  - `must-recall.md`
- governed reusable-items content:
  - `norms-maintaining-reusable-items.md`
  - starter `notes-reusable-items-knowledge.md`
- local helper outputs:
  - `.bagakit/living-knowledge/.generated/`
- bootstrap layer:
  - `AGENTS.md`

## Quick Start

```bash
export BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR="<path-to-bagakit-living-knowledge-skill>"

sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" apply --root .
sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" paths --root .
sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" index --root .

sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" recall search --root . "shared knowledge"
sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" recall get --root . docs/must-guidebook.md --from 1 --lines 20

sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" ingest \
  --root . \
  --source docs/reviewed-note.md \
  --dest notes/reviewed-note.md

sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" doctor --root .
```

## Design Notes

- `bagakit-living-knowledge` owns protocol, normalization, indexing, recall, generated `must-sop.md`, and reusable-items governance.
- `bagakit-researcher` owns research evidence production.
- `bagakit-skill-selector` owns task-level composition and usage evidence.
- `bagakit-skill-evolver` owns repository evolution memory.
- legacy `learning-contract` does not return here because it was an inbox/memory signal exchange mechanism, not a substrate mechanism.
