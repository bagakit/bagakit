# Agent Memory System Patterns

This note summarizes primary-source memory-architecture material that informs
how brainstorm records should separate raw capture, normalized memory, and
derived outputs.

## Sources

- [Generative Agents](https://arxiv.org/abs/2304.03442)
- [MemoryBank](https://arxiv.org/abs/2305.10250)
- [Cognitive Architectures for Language Agents (CoALA)](https://arxiv.org/abs/2309.02427)
- [MemGPT](https://arxiv.org/abs/2310.08560)
- [HippoRAG](https://arxiv.org/abs/2405.14831)
- [Mem0](https://arxiv.org/abs/2504.19413)
- [Memex(RL)](https://arxiv.org/abs/2603.04257)
- [LangMem conceptual guide](https://langchain-ai.github.io/langmem/concepts/conceptual_guide/)
- [Letta archival memory](https://docs.letta.com/guides/core-concepts/memory/archival-memory)
- [Letta memory blocks](https://docs.letta.com/guides/core-concepts/memory/memory-blocks)

## Stable Pattern Across Sources

The sources differ in implementation, but they converge on a few durable
patterns:

- raw history should not be the only working surface
- normalized memory should not erase raw provenance
- memory is more useful when typed instead of stored as one generic blob
- retrieval should move from compact summaries to exact underlying evidence when
  the task needs chronology or wording fidelity

## Brainstorm-Oriented Borrowed Rules

- Keep an immutable raw discussion surface.
- Add normalized records that can say what one entry means without mutating the
  original wording.
- Prefer typed records such as:
  - question
  - answer
  - idea
  - challenge
  - convergence
  - decision update
- Use source links such as `source_refs` from derived items back to raw entries
  and source artifacts.
- Avoid summary-on-summary drift by updating normalized records from raw
  evidence rather than only from previous summaries.
- Keep a concise current-state layer for handoff, but make exact replay
  possible when ambiguity matters.

## Bagakit Design Conclusion

For `bagakit-brainstorm`, the cleanest current fit is:

1. `raw_discussion_log.md`
   - append-only raw record + normalized helper fields
2. stage artifacts
   - analysis, forum, handoff
   - each referencing raw and prior stage evidence explicitly
3. archive + outcome artifacts
   - compact handoff/index surfaces

This preserves the current file model while adopting the strongest memory
lessons from the research set.
