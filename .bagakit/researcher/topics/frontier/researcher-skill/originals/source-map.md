# Researcher Skill Source Map

## Goal

Keep one compact source ledger for the `bagakit-researcher` research pass.

## Sources

### A01. Building effective agents

- authority: primary
- published_at: 2024-12-19
- url: `https://www.anthropic.com/research/building-effective-agents`
- why kept:
  - Bagakit needs the "start simple, add complexity only with evidence" rule.
  - This source is the clearest Bagakit-compatible guardrail against overbuilding a research runtime.

### A02. How we built our multi-agent research system

- authority: primary
- published_at: 2025-06-13
- url: `https://www.anthropic.com/engineering/multi-agent-research-system`
- why kept:
  - This is the strongest official reference for when parallel research is justified.
  - It clarifies that parallel tracks are useful only when sub-questions are truly independent and later compressed.

### A03. Effective context engineering for AI agents

- authority: primary
- published_at: 2025-09-29
- url: `https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents`
- why kept:
  - Research systems fail when notes accumulate without curation.
  - This source supports source cards, digest snapshots, and bounded context per pass.

### O01. New tools for building agents

- authority: primary
- published_at: 2025-03-11
- url: `https://openai.com/index/new-tools-for-building-agents/`
- why kept:
  - This is a useful non-Anthropic counterpoint on tools, orchestration, and observability.
  - It supports keeping `bagakit-researcher` small while still leaving room for explicit interfaces.
