# Interaction Result Packet

## Owns

- Normalize human interaction into a copyable or exportable packet for agent
  reentry.
- Define what the page should package after understanding, testing, or review.

## Does Not Own

- Markdown or JSON schema details that live in `../artifacts/`.
- Button styling or panel treatment.

## Design Checks

- The human can produce one packet without manual cleanup.
- The packet distinguishes observation, inference, and blocker state well
  enough for the agent to continue.

## Outputs Or Evidence

- Required copy/export affordance plus a normalized handoff payload.

## Failure Signals

- The page collects data but does not round-trip it cleanly.
- Export behavior and exported shape drift apart.
