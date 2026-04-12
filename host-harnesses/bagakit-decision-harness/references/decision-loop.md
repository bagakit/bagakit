# Decision Loop

The core loop is:

```text
local text input
-> Signal
-> Decision Receipt
-> Outcome Review
-> Pattern Candidate
-> Pattern Adoption
-> Human Practice Update
-> AI Update Receipt
```

## Intake

Inputs are already-textual local materials:

- typed note
- pasted chat excerpt
- agent trace
- transcript produced elsewhere
- manual retro

The harness does not own audio transcription.

## Decision Receipt

A Decision Receipt records:

- decision question
- options
- confidence
- reversibility
- expected outcome
- review date
- evidence refs
- AI roles used

## Review

Outcome review records:

- actual outcome
- result gap
- calibration note
- what to keep
- what to revise
- next practice update

## Pattern Adoption

Patterns start as candidates. Durable patterns require explicit user adoption.

Allowed pattern states:

- `candidate`
- `accepted`
- `rejected`
- `merged`
- `expired`

## AI Update Receipt

AI-side changes require:

- observed signal
- inferred preference or pattern
- candidate change
- scope
- evaluation
- expiry
- rollback
