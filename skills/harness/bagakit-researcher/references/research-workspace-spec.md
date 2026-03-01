# Research Workspace Spec

## Goal

Keep repository research local, reusable, and separate from durable promotion.

## Topic Layout

Default runtime root:

```text
.bagakit/researcher/topics/<topic-class>/<topic>/
├── originals/
├── summaries/
└── index.md
```

Configured runtime when `.bagakit/knowledge_conf.toml` declares
`researcher_root`:

```text
<researcher_root>/topics/<topic-class>/<topic>/
├── originals/
├── summaries/
└── index.md
```

## Source Preservation Rule

When a source materially informs Bagakit decisions, preserve a stable local
source card with:

- source id
- title
- published date when known
- authority level
- URL
- one short note on why it was kept

## Summary Rule

Each summary should cover:

- what the source is
- why it matters
- what to borrow
- what not to copy
- Bagakit-specific implication

## Index Rule

`index.md` should answer:

- what the topic is for
- which local materials already exist
- what to read first
- what is still missing

## Optional Next-Step Routes

- host/shared knowledge:
  - hand off through the host knowledge protocol, if one exists
- repository evolution:
  - `.bagakit/evolver/` via weak local context refs or summarized source records
- task-level evidence:
  - `.bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml`

The research workspace stays the evidence-production surface even when one of
these later routes is used.
