# Curated Shortlist

## Why These Sources

This shortlist is intentionally narrow.

`bagakit-researcher` does not need every article about web search or every
multi-agent research stack. It needs a few strong sources that answer:

- when research complexity is justified
- how evidence should be compressed
- how to avoid context sprawl
- where the seam to the rest of Bagakit should stay

## A01. Building effective agents

- source: Anthropic, 2024-12-19
- keep:
  - start with the simplest workable pattern
  - treat orchestration complexity as something to earn, not assume
  - distinguish deterministic workflow from dynamic agent behavior
- implication for `bagakit-researcher`:
  - default flow should stay local-first and single-operator
  - parallel or delegated research should be optional, not baseline behavior

## A02. How we built our multi-agent research system

- source: Anthropic, 2025-06-13
- keep:
  - parallel tracks only when the topic really decomposes
  - subagent output must compress back into a smaller steward-facing artifact
  - cost and evidence quality both matter
- implication for `bagakit-researcher`:
  - the skill should support decomposed research as a pattern, but not as a required runtime
  - Bagakit needs concise source cards and index pages more than giant transcripts

## A03. Effective context engineering for AI agents

- source: Anthropic, 2025-09-29
- keep:
  - context is a finite budget
  - durable state and disposable working context should stay separate
  - compact digests beat raw history growth
- implication for `bagakit-researcher`:
  - each topic should prefer `index.md` plus reusable summaries over rolling notes
  - a future operator should see a reading order, not a dump

## O01. New tools for building agents

- source: OpenAI, 2025-03-11
- keep:
  - tool use, orchestration, and observability should be designed together
  - stable tool boundaries matter more than ad hoc wrappers
- implication for `bagakit-researcher`:
  - the Bagakit version should expose a small stable operator surface
  - interfaces to `selector`, `living-knowledge`, and `evolver` should remain explicit and optional

## Short Conclusion

The frontier pattern Bagakit should adopt is:

- small default workflow
- deliberate evidence preservation
- explicit summary and index compression
- optional parallelization and optional downstream handoff

The frontier pattern Bagakit should reject is:

- default multi-agent orchestration
- giant transcript storage
- implicit promotion from search notes into shared truth
