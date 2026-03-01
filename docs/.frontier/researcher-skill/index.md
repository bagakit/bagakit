# Researcher Skill

## Goal

Curate frontier and representative references for `bagakit-researcher`, the
Bagakit evidence-production skill.

The focus here is not generic web search. The focus is:

- how a repository should do local-first research
- what to preserve from frontier agent research systems
- what to reject so `bagakit-researcher` stays standalone-first and small

## Local Topic Layout

```text
docs/.frontier/researcher-skill/
├── originals/
│   └── source-map.md
└── summaries/
    ├── 00-curated-shortlist.md
    └── 99-gap-analysis.md
```

## Curated Source Set

- A01
  - title: Building effective agents
  - source: `https://www.anthropic.com/research/building-effective-agents`
  - local summary: [../agentic-repo-workflow/summaries/A01-building-effective-agents.md](../agentic-repo-workflow/summaries/A01-building-effective-agents.md)
- A02
  - title: How we built our multi-agent research system
  - source: `https://www.anthropic.com/engineering/multi-agent-research-system`
  - local summary: [../evolver-enhancement-map/summaries/F03-multi-agent-research-system.md](../evolver-enhancement-map/summaries/F03-multi-agent-research-system.md)
- A03
  - title: Effective context engineering for AI agents
  - source: `https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents`
  - local summary: [../evolver-enhancement-map/summaries/F04-effective-context-engineering.md](../evolver-enhancement-map/summaries/F04-effective-context-engineering.md)
- O01
  - title: New tools for building agents
  - source: `https://openai.com/index/new-tools-for-building-agents/`
  - local summary: [../agentic-repo-workflow/summaries/O03-new-tools-for-building-agents.md](../agentic-repo-workflow/summaries/O03-new-tools-for-building-agents.md)

## Recommended Reading Order

1. [summaries/00-curated-shortlist.md](./summaries/00-curated-shortlist.md)
2. [summaries/99-gap-analysis.md](./summaries/99-gap-analysis.md)

## Current View

The frontier does not justify a giant research platform inside Bagakit.

The strongest shape is smaller:

- local-first topic workspaces
- preserved source references
- reusable source summaries
- explicit indexes and read order
- optional downstream handoff into knowledge or evolver

The main missing piece is not concept discovery. It is a dedicated runtime skill
that makes this workflow repeatable without collapsing into either
`living-knowledge` or `evolver`.
