# Curated Shortlist

## Why These Sources

This shortlist is narrow on purpose.

The question is not "what are the best AI articles in general."
The question is:

- which sources most directly improve Bagakit as a filesystem-first harness
- which sources improve task contracts, context handling, knowledge layering,
  tool quality, and projection design

## G01. gstack workflow product

- source: `gstack` README and `docs/skills.md`
- keep:
  - treat the workflow as the product surface
  - make stage-to-stage handoff explicit
  - give operators one coherent sprint chain instead of many unrelated prompts
- implication for Bagakit:
  - Bagakit should keep its multi-surface architecture, but expose clearer
    end-to-end paths across `selector`, `flow-runner`, `researcher`,
    `living-knowledge`, and `evolver`

## G02. gstack architecture and host generation

- source: `gstack` `ARCHITECTURE.md` and `docs/ADDING_A_HOST.md`
- keep:
  - heavy capabilities live in code, not in prompt text
  - host integration is generated from declarative config instead of forked
    per-host logic
  - SKILL docs are template-generated and freshness-checked
- implication for Bagakit:
  - any nontrivial Bagakit harness capability should prefer a real operator or
    runtime tool surface
  - projection should stay thin and data-driven

## A01. Building effective agents

- source: Anthropic, 2024-12-19
- keep:
  - start with the simplest workable pattern
  - distinguish deterministic workflow from higher-autonomy agent behavior
  - add orchestration only when evidence justifies it
- implication for Bagakit:
  - keep default harness flows small and legible
  - do not treat multi-agent orchestration as the baseline

## A02. Effective context engineering for AI agents

- source: Anthropic, 2025-09-29
- keep:
  - context is an engineered budget, not an infinite dump
  - durable state, working state, and injected context should stay separate
  - summary and pruning policy need explicit design
- implication for Bagakit:
  - make context assembly a first-class contract around `flow-runner`,
    `researcher`, and `living-knowledge`

## A03. Writing effective tools for agents

- source: Anthropic, 2025-09-11
- keep:
  - tools must be designed for agent cognition, not only for human API taste
  - tool output quality and namespacing matter
  - tool eval is a real engineering problem
- implication for Bagakit:
  - tighten runtime surface design for shell, tracker, recall, and projection
  - define tool-eval artifacts instead of relying only on static validation

## A04. How Anthropic teams use Claude Code

- source: Anthropic / Claude, 2025-07-24
- keep:
  - repo-local instructions matter
  - long loops can be delegated to the agent, then reviewed by humans
  - cross-functional usage patterns matter, not only coding prompts
- implication for Bagakit:
  - formalize instruction layering and review handoff
  - keep the system open to non-code knowledge and operator workflows

## O01. Repo-local instruction layering

- source: OpenAI Codex `AGENTS.md` guide and GitHub Copilot repository instructions
- keep:
  - instruction precedence should be path-aware and explicit
  - repo-shared instructions and local overlays should not be conflated
  - layered instruction systems need lint, not trust
- implication for Bagakit:
  - define precedence across root `AGENTS.md`, local overlays, family-local
    guidance, and skill-local instruction surfaces

## O02. Formal task objects for long-running work

- source: OpenAI background mode and MCP SEP-1686 Tasks
- keep:
  - long-running work should expose a task object with stable lifecycle
  - poll, cancel, resume, and result-envelope semantics matter
  - async work deserves explicit state instead of implicit chat continuation
- implication for Bagakit:
  - upgrade `bagakit-flow-runner` from checkpoint-first to task-contract-first

## O03. Trace-first eval loops

- source: OpenAI agent evals
- keep:
  - traces, datasets, graders, and runs are separate artifacts
  - operational regressions should be compared, not just noticed
- implication for Bagakit:
  - `skill-evolver` and `gate_eval` should grow around real run traces and
    comparison assets

## F01. Typed memory and durable execution

- source: LangGraph durable execution and memory
- keep:
  - resumable execution needs explicit recovery semantics
  - memory should be typed by scope and durability
  - working state and durable knowledge should not share one bucket
- implication for Bagakit:
  - formalize memory classes for `living-knowledge`
  - make `flow-runner` checkpoint meaning more stable

## Short Conclusion

The best frontier direction for Bagakit is:

- explicit task contracts
- explicit context assembly
- typed memory surfaces
- trace-first eval
- thin projection layers

The weakest possible direction would be:

- ever-larger role catalogs
- prompt-heavy orchestration without contract hardening
- hidden global home-directory truth
