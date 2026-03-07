# Anthropic Minimum Pack

## Purpose

When Bagakit maintainers want the smallest high-value Anthropic reading set for
`skills/skills`, start here.

If time is tight, read these five first:

1. `A01` Building effective agents
2. `A06` Effective context engineering for AI agents
3. `A05` Writing effective tools for agents
4. `A04` How Anthropic teams use Claude Code
5. `A02` Introducing Contextual Retrieval

## A01. Building effective agents

- source: Anthropic Engineering
- date: 2024-12-19
- why it is mandatory:
  - this is the cleanest statement that workflows, agents, and orchestration
    should not be flattened into one default pattern
- use it for:
  - deciding when Bagakit should stay simple
  - resisting unnecessary multi-agent expansion

## A02. Introducing Contextual Retrieval

- source: Anthropic Engineering
- date: 2024-09-19
- why it is mandatory:
  - this is the most relevant retrieval paper for a filesystem-first project
    that still wants stronger recall quality
- use it for:
  - improving `researcher` and `living-knowledge` retrieval strategy
  - deciding when simple direct context beats heavier retrieval machinery

## A03. Introducing the Model Context Protocol

- source: Anthropic
- date: 2024-11-25
- why it is in the pack:
  - Bagakit should not adopt MCP as truth storage, but it should understand MCP
    as a connector seam
- use it for:
  - external tool and data integration boundaries
  - future projection or connector design

## A04. How Anthropic teams use Claude Code

- source: Claude Blog
- date: 2025-07-24
- why it is mandatory:
  - this is one of the better primary sources on real organizational
    agent-assisted work, not just toy examples
- use it for:
  - instruction layering
  - human-review loop design
  - long-running agent work with bounded human checkpoints

## A05. Writing effective tools for agents

- source: Anthropic Engineering
- date: 2025-09-11
- why it is mandatory:
  - Bagakit already has multiple runtime surfaces; this source sharpens how
    those surfaces should be named, described, and evaluated
- use it for:
  - tool interface design
  - tool-description quality
  - tool-eval methodology

## A06. Effective context engineering for AI agents

- source: Anthropic Engineering
- date: 2025-09-29
- why it is mandatory:
  - this is the most directly transferable source for Bagakit's next frontier
  - Bagakit needs explicit rules for context budget, carry-forward, and summary
    compression
- use it for:
  - loop context assembly
  - pruning and digest rules
  - deciding what stays hot versus what can stay cold

## A07. Building agents with the Claude Agent SDK

- source: Claude Blog
- date: 2025-09-29
- why it is in the pack:
  - this is a practical runtime-loop reference, especially useful when reading
    `flow-runner`
- use it for:
  - gather-context / act / verify / repeat loop design
  - deciding what Bagakit should encode as task-level cycle semantics

## Pack Takeaway

Anthropic's most useful lesson for Bagakit is not "use more agents."

It is:

- keep patterns explicit
- keep context engineered
- keep tools agent-native
- keep long-running work externally stateful
- keep complexity earned
