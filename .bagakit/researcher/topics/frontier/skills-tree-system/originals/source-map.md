# Skills Tree System Source Map

Research date:

- 2026-04-19

## Local Bagakit Sources

### L01. Repository system stance

- authority: local primary
- url: `skills/README.md`
- why kept:
  - establishes that `skills/` is the canonical monorepo
  - defines runtime versus maintainer boundary at repo scale

### L02. Runtime tree shape

- authority: local primary
- url: `skills/skills/README.md`
- why kept:
  - defines the family layout inside the canonical runtime tree
  - shows which parts of `skills/skills` are real payload today

### L03. Primary architecture

- authority: local primary
- url: `skills/docs/architecture/A1-system-architecture.md`
- why kept:
  - defines the L1 / L2 / L3 model
  - defines `evidence -> decision memory -> promotion -> durable surface`

### L04. Harness topology

- authority: local primary
- url: `skills/docs/architecture/A3-core-harness-topology.md`
- why kept:
  - defines how `selector`, `researcher`, `living-knowledge`, `feature-tracker`,
    `flow-runner`, and `evolver` fit together
  - clarifies where explicit composition is supposed to live

### L05. Evidence and promotion flow

- authority: local primary
- url: `skills/docs/architecture/C1-evidence-and-promotion-flow.md`
- why kept:
  - defines the learning chain Bagakit is already trying to protect
  - provides the baseline for all external comparisons in this topic

## External Comparison Sources

### G01. gstack README

- authority: external implementation primary
- url: `https://github.com/garrytan/gstack/blob/main/README.md`
- date: repo snapshot inspected 2026-04-19
- why kept:
  - best concise statement of `gstack` as a workflow product
  - shows the explicit sprint chain and host integration stance

### G02. gstack architecture

- authority: external implementation primary
- url: `https://github.com/garrytan/gstack/blob/main/ARCHITECTURE.md`
- date: repo snapshot inspected 2026-04-19
- why kept:
  - explains the daemon/tooling split and doc-generation model
  - shows what `heavy capability in code, orchestration in markdown` looks like

### G03. gstack skill deep dives

- authority: external implementation primary
- url: `https://github.com/garrytan/gstack/blob/main/docs/skills.md`
- date: repo snapshot inspected 2026-04-19
- why kept:
  - shows how one workflow stage hands artifacts to the next
  - surfaces where persona branding helps and where it overreaches

### G04. gstack host generation and contribution surface

- authority: external implementation primary
- url: `https://github.com/garrytan/gstack/blob/main/docs/ADDING_A_HOST.md`
- date: repo snapshot inspected 2026-04-19
- why kept:
  - useful reference for multi-host projection without per-host forks
  - relevant to Bagakit projection and install surfaces

### A01. Building effective agents

- authority: external primary
- url: `https://www.anthropic.com/engineering/building-effective-agents`
- date: 2024-12-19
- why kept:
  - strongest Bagakit-compatible baseline for when to keep systems simple
  - clarifies workflow versus agent patterns

### A02. Introducing Contextual Retrieval

- authority: external primary
- url: `https://www.anthropic.com/engineering/contextual-retrieval`
- date: 2024-09-19
- why kept:
  - strongest Anthropic source on retrieval quality and context packaging
  - directly relevant to `researcher` and `living-knowledge`

### A03. Introducing the Model Context Protocol

- authority: external primary
- url: `https://www.anthropic.com/news/model-context-protocol`
- date: 2024-11-25
- why kept:
  - useful reference for external system seams
  - relevant if Bagakit later standardizes tool and context connectors

### A04. How Anthropic teams use Claude Code

- authority: external primary
- url: `https://claude.com/blog/how-anthropic-teams-use-claude-code`
- date: 2025-07-24
- why kept:
  - real organizational usage reference, not only API theory
  - useful for instruction layering and human review loop design

### A05. Writing effective tools for agents - with agents

- authority: external primary
- url: `https://www.anthropic.com/engineering/writing-tools-for-agents`
- date: 2025-09-11
- why kept:
  - strongest Anthropic source on agent-facing tool ergonomics
  - directly relevant to Bagakit runtime surface design

### A06. Effective context engineering for AI agents

- authority: external primary
- url: `https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents`
- date: 2025-09-29
- why kept:
  - strongest Anthropic source on context budgets, layering, and pruning
  - especially relevant to long-running Bagakit loops

### A07. Building agents with the Claude Agent SDK

- authority: external primary
- url: `https://claude.com/blog/building-agents-with-the-claude-agent-sdk`
- date: 2025-09-29
- why kept:
  - useful operational reference for explicit agent loops
  - relevant to `flow-runner` and task-oriented harness design

### O01. OpenAI Codex AGENTS.md guide

- authority: external primary
- url: `https://developers.openai.com/codex/guides/agents-md`
- date: retrieved 2026-04-19
- why kept:
  - clear official reference for repo-local instruction layering
  - directly relevant to `AGENTS.md` precedence and path-local rules

### O02. OpenAI background mode

- authority: external primary
- url: `https://developers.openai.com/api/docs/guides/background`
- date: retrieved 2026-04-19
- why kept:
  - useful official reference for durable async task state
  - relevant to `flow-runner` task lifecycle evolution

### O03. OpenAI sandbox agents

- authority: external primary
- url: `https://developers.openai.com/api/docs/guides/agents/sandboxes`
- date: retrieved 2026-04-19
- why kept:
  - clear control-plane versus execution-plane example
  - relevant to future Bagakit runner isolation choices

### O04. OpenAI agent evals

- authority: external primary
- url: `https://developers.openai.com/api/docs/guides/agent-evals`
- date: retrieved 2026-04-19
- why kept:
  - useful trace-first eval artifact model
  - relevant to `skill-evolver`, `gate_eval`, and harness regression evidence

### O05. OpenAI Codex skills

- authority: external primary
- url: `https://developers.openai.com/codex/skills`
- date: retrieved 2026-04-19
- why kept:
  - official reference for markdown-first skill packaging
  - relevant to Bagakit skill metadata and discoverability

### C01. GitHub Copilot repository instructions

- authority: external primary
- url: `https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions`
- date: retrieved 2026-04-19
- why kept:
  - another mainstream example of path-scoped repo instructions
  - useful as a counterpoint to `AGENTS.md`-only models

### F01. LangGraph durable execution

- authority: external framework primary
- url: `https://docs.langchain.com/oss/python/langgraph/durable-execution`
- date: retrieved 2026-04-19
- why kept:
  - useful reference for resumable execution semantics
  - relevant to `flow-runner` and checkpoint meaning

### F02. LangGraph memory

- authority: external framework primary
- url: `https://docs.langchain.com/oss/python/langgraph/memory`
- date: retrieved 2026-04-19
- why kept:
  - useful reference for typed memory surfaces
  - relevant to `living-knowledge` and memory taxonomy formalization

### P01. MCP SEP-1686 Tasks

- authority: external protocol primary
- url: `https://modelcontextprotocol.io/community/seps/1686-tasks`
- date: 2025-10-20
- why kept:
  - strong task-object reference for async long-running work
  - useful input for a more formal `flow-runner` contract
