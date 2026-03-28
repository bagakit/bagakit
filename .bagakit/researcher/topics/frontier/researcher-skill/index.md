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
.bagakit/researcher/topics/frontier/researcher-skill/
├── originals/
│   ├── source-map.md
│   ├── r01-current-implementation-audit.md
│   ├── r02-related-skill-ecosystem.md
│   └── r03-anti-drift-active-mining-skill-scan.md
└── summaries/
    ├── 00-curated-shortlist.md
    ├── 10-first-principles-optimization.md
    ├── 20-related-skill-ecosystem.md
    ├── 30-parallel-research-optimization-plan.md
    ├── 40-anti-drift-active-mining-design.md
    ├── 50-integrated-implementation-plan.md
    ├── 60-brainstorm-comparison.md
    └── 99-gap-analysis.md
```

## Curated Source Set

- A01
  - title: Building effective agents
  - source: `https://www.anthropic.com/research/building-effective-agents`
- A02
  - title: How we built our multi-agent research system
  - source: `https://www.anthropic.com/engineering/multi-agent-research-system`
- A03
  - title: Effective context engineering for AI agents
  - source: `https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents`
- O01
  - title: New tools for building agents
  - source: `https://openai.com/index/new-tools-for-building-agents/`
- H01
  - title: Helixent deep-research-plan skill
  - source: `https://github.com/MagicCube/helixent/blob/main/skills/deep-research-plan/SKILL.md`
- R03
  - title: Academic Deep Research skill
  - source: `https://openclawlaunch.com/skills/academic-deep-research`
- L01
  - title: Open Deep Research
  - source: `https://github.com/langchain-ai/open_deep_research`
- G01
  - title: GPT Researcher
  - source: `https://github.com/assafelovic/gpt-researcher`

## Recommended Reading Order

1. [summaries/00-curated-shortlist.md](./summaries/00-curated-shortlist.md)
2. [summaries/10-first-principles-optimization.md](./summaries/10-first-principles-optimization.md)
3. [summaries/20-related-skill-ecosystem.md](./summaries/20-related-skill-ecosystem.md)
4. [summaries/30-parallel-research-optimization-plan.md](./summaries/30-parallel-research-optimization-plan.md)
5. [summaries/40-anti-drift-active-mining-design.md](./summaries/40-anti-drift-active-mining-design.md)
6. [summaries/50-integrated-implementation-plan.md](./summaries/50-integrated-implementation-plan.md)
7. [summaries/60-brainstorm-comparison.md](./summaries/60-brainstorm-comparison.md)

Historical baseline:

- [summaries/99-gap-analysis.md](./summaries/99-gap-analysis.md)

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

After the initial operator landed, the optimization focus moved from basic
workspace creation to quality and handoff:

- warn when source cards, summaries, or indexes are incomplete
- preserve hand-authored index curation during refresh
- emit optional handoff artifacts without performing promotion

The adjacent skill ecosystem strengthens that direction:

- Nuwa contributes framework-extraction discipline, not a mandate to become a
  persona-skill factory
- `autoresearch` contributes small-surface, fixed-budget iteration discipline
- Darwin contributes ratchet-style evaluation, but belongs closer to eval or
  evolver than researcher
- larger deep-research systems contribute artifact discipline, not a template
  for a giant pipeline

The next concrete optimization should make parallel research a first-class
researcher workflow:

- plan topic passes into explicit track files
- give each worker disjoint output ownership
- merge track outputs through source cards, summaries, and synthesis
- keep researcher responsible for evidence protocol, not subagent orchestration

The anti-drift pass sharpens that plan. Researcher should also add:

- a topic charter before non-trivial retrieval
- track contracts that preserve parent scope
- source cards with role, scope fit, limitations, and authority
- a claim ledger that separates observations, inferences, and recommendations
- insight cards for cross-source or cross-track synthesis
- a lead queue so proactive mining does not silently expand scope
- warning-only `doctor --drift` checks before making quality debt gating

The key design constraint is that active mining should increase recall without
changing the topic contract behind the user's back.

The integrated implementation plan is now the canonical next-step read before
changing code. Its sequence is:

- add the charter, pass, track, claim, insight, and lead surfaces
- add `plan-pass`, `add-track`, and `list-tracks`
- add warning-only `doctor --quality` and `doctor --drift`
- convert `refresh-index` to managed-section preservation
- add optional claim, insight, lead, synthesis, and handoff helpers
- extend validation and eval so drift is surfaced before synthesis

The brainstorm comparison adds one boundary clarification:

- absorb raw-vs-derived provenance, plan-only boundaries, option framing, and
  handoff destination discipline
- keep mandatory expert forum, mandatory user approval, and generic ideation
  outside researcher core
