# Interaction Result Packet

## Owns

- Normalize human interaction into a copyable or exportable packet for Agent
  reentry.
- Define what the page should package after understanding, testing, or review.

## Does Not Own

- Markdown or JSON schema details that live in `../artifacts/`.
- Button styling or panel treatment.

## Design Checks

- The human can produce one packet without manual cleanup.
- The packet distinguishes observation, inference, blocker, and judgment state.
- Evidence-review packets preserve `case_id`, `case_run_id`, evaluation
  contract, review mode, reveal policy, evidence sufficiency, provisional human
  judgment, Agent position, disagreement, final human judgment, and prior-run
  refs.
- Copy and download actions use one payload builder.

## Outputs Or Evidence

- Required copy/export affordance plus a normalized handoff payload.

## Failure Signals

- The page collects data but does not round-trip it cleanly.
- Export behavior and exported shape drift apart.
- A new run exports only the latest answer and loses prior-run identity.
