# bagakit-living-knowledge

Shared filesystem-first knowledge substrate for repositories that need:

- one configurable shared knowledge root
- system pages for progressive loading
- generated maintenance-route guidance through `must-sop.md`
- reusable-items governance inside the shared knowledge root
- deterministic recall over shared checked-in knowledge
- a thin ingestion path for reviewed markdown
- repo-relative references and low-leakage durable identifiers

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

## Hygiene

- Use repo-relative paths only in shared pages, managed bootstrap text, and
  durable examples.
- Do not publish absolute filesystem paths, timestamp-derived file names, raw
  source file names, raw source file contents, or user-identity hints into
  shared knowledge surfaces.
- If one imported or normalized page needs a durable handle, prefer a short
  opaque repo-local id such as `k-2ab7qxk9`.
- Human-authored shared page names may stay descriptive, but raw source-derived
  or action-time-derived names must be normalized before publication.

## Quick Start

```bash
export BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR="<repo-relative-installed-skill-dir>"

sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" apply --root .
sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" paths --root .
sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" index --root .

sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" recall search --root . "shared knowledge"
sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" recall get --root . docs/must-guidebook.md --from 1 --lines 20

sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" ingest \
  --root . \
  --source docs/reviewed-note.md \
  --dest notes/k-2ab7qxk9.md

sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" doctor --root .
```

When normalizing reviewed material into the shared root:

- keep command examples repo-relative
- do not reuse timestamped capture names such as `howto-learning-20260426.md`
  as durable shared page names
- do not preserve raw source-path or action-time frontmatter keys such as
  `source_path` or `captured_at`

## Design Notes

- `bagakit-living-knowledge` owns protocol, normalization, indexing, recall, generated `must-sop.md`, and reusable-items governance.
- `bagakit-researcher` owns research evidence production.
- `bagakit-skill-selector` owns task-level composition and usage evidence.
- `bagakit-skill-evolver` owns repository evolution memory.
- legacy `learning-contract` does not return here because it was an inbox/memory signal exchange mechanism, not a substrate mechanism.
