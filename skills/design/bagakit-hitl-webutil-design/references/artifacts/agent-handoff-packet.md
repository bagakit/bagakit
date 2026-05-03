# Agent Handoff Packet

## Owns

- The durable packet the human returns to the agent after using the page.

## Required Fields

- `scene`
- `summary`
- `status`
- `observations`
- `blockers`
- `evidence_refs`
- `next_action`

## Round-Trip Expectation

- The agent can continue work without asking the human to restate the same
  context.

## Failure Signals

- The packet mixes summary and raw evidence with no structure.
- The agent still has to ask basic recovery questions the page should answer.
