# Anthropic Context And Durable Records

This note summarizes official Anthropic material that most directly informs
`bagakit-brainstorm` memory-quality design.

## Sources

- [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Managing context on the Claude Developer Platform](https://claude.com/blog/context-management)
- [Memory tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)
- [Citations](https://platform.claude.com/docs/en/build-with-claude/citations)
- [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Long-running Claude for scientific computing](https://www.anthropic.com/research/long-running-Claude)
- [Writing effective tools for agents — with agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
- [Scaling Managed Agents: Decoupling the brain from the hands](https://www.anthropic.com/engineering/managed-agents)
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents)

## High-Value Takeaways

- Anthropic repeatedly treats context as scarce working memory, not the place
  where all durable record-keeping should live.
- Multi-agent and long-running workflows work better when each worker writes
  durable artifacts and returns short pointers instead of dumping raw material
  back into the parent context.
- Anthropic separates:
  - active context editing
  - persistent memory
  - event or transcript history
- Exact provenance matters. The citations system is designed around precise
  source location, not loose attribution.
- Naming quality matters. Human-readable names plus stable ids reduce ambiguity
  in handoffs and future session replay.
- End-of-session memory updates are treated as first-class workflow steps.

## Brainstorm Implications

- `bagakit-brainstorm` should keep raw discussion append-only.
- Normalized memory should be separate from raw wording.
- Every derived recommendation should keep source pointers.
- Each run should have a lightweight initializer or charter surface.
  Current best fit in brainstorm is still `input_and_qa.md`, but it should
  carry explicit naming, scope, and time anchors.
- Handoff artifacts should prefer links to bulky detail instead of pasting
  everything inline.

## Anthropic-Specific Rules Worth Borrowing

- use concise indexes plus detailed linked artifacts
- keep failed paths and dead ends, not only successful conclusions
- require explicit scope, objective, and next step in handoffs
- anchor artifacts with timestamps and stable participant identities
