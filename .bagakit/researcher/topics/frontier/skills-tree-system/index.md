# Skills Tree System

## Goal

Understand canonical `skills/skills` as one cooperating Bagakit runtime tree,
then curate frontier references that can improve the current harness,
knowledge, and projection model.

This topic treats `skills/skills` as a system, not as a bag of unrelated
payloads.

## Local Topic Layout

```text
docs/.frontier/skills-tree-system/
├── originals/
│   └── source-map.md
└── summaries/
    ├── 00-project-scan.md
    ├── 10-curated-shortlist.md
    ├── 20-anthropic-minimum-pack.md
    ├── 30-gstack-takeaways.md
    └── 99-gap-analysis.md
```

## Topic Split

### T01. Execution And Composition

- `skills/harness/bagakit-feature-tracker`
- `skills/harness/bagakit-flow-runner`
- `skills/harness/bagakit-skill-selector`

Core question:

- what is the stable task contract
- what should remain execution truth
- where should multi-skill composition stay explicit

### T02. Evidence And Knowledge

- `skills/harness/bagakit-researcher`
- `skills/harness/bagakit-living-knowledge`
- `skills/harness/bagakit-brainstorm`

Core question:

- how should sources be preserved
- how should summaries be reused
- what belongs in host knowledge versus temporary research state

### T03. Repository Learning And Quality

- `skills/harness/bagakit-skill-evolver`
- `gate_validation/`
- `gate_eval/`

Core question:

- how do repeated failures become structured learning
- what evidence should stay local
- what deserves promotion into durable Bagakit truth

### T04. Projection And Distribution

- `skills/skills/`
- `catalog/`
- `dev/release_projection/`

Core question:

- how should canonical runtime sources project into install, package, and host
  integration surfaces without creating split truth

## Recommended Reading Order

1. [summaries/00-project-scan.md](./summaries/00-project-scan.md)
2. [summaries/20-anthropic-minimum-pack.md](./summaries/20-anthropic-minimum-pack.md)
3. [summaries/30-gstack-takeaways.md](./summaries/30-gstack-takeaways.md)
4. [summaries/10-curated-shortlist.md](./summaries/10-curated-shortlist.md)
5. [summaries/99-gap-analysis.md](./summaries/99-gap-analysis.md)

## Current View

The strongest reading of Bagakit is:

- filesystem-first
- explicit-evidence-first
- explicit-promotion-first
- runtime-versus-maintainer split

The weakest reading is:

- one more prompt-skill collection
- one more roleplay toolkit
- one more install wrapper around hidden home-directory state

Compared with `gstack` and mainstream agent stacks, Bagakit already has a
clearer architecture vocabulary than most. The main next frontier is not
another large role catalog. It is formalizing:

- context assembly
- task contracts
- memory types
- eval artifacts
- projection surfaces
