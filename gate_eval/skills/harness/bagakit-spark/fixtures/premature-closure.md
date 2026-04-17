# Premature Closure Fixture

## Transcript Signals

- The assistant summarizes the topic as solved.
- The assistant does not ask a decision-changing question.
- The user has not accepted a snapshot.
- There is no explicit research sufficiency judgment.

## Expected Review Finding

- verdict: `fail`
- reason: missing accepted snapshot and next question
- next_action: continue the dialogue before creating durable handoff material
