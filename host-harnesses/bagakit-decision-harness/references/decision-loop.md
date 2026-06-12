# Decision Loop

The loop is conditional:

```text
local text input
-> Signal
-> Decision Receipt (when the input records a decision)
-> Outcome Review (when an outcome is available)
-> Pattern Candidate (when review or repetition reveals a transferable lesson)
-> Pattern Adoption (only after an explicit user decision)
-> Human Practice Update (when an adopted pattern changes practice)
-> AI Update Receipt (when an approved change to AI behavior is warranted)
```

No arrow is automatic. Stop after the latest stage whose entry condition and
acceptance evidence are present; a one-off input may end at Signal or Decision
Receipt.

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
