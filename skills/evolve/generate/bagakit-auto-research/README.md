# bagakit-auto-research

Bounded M1 orchestration for improving an existing Agent, skill, prompt,
retrieval rule, controller, or harness from evidence.

It owns the round brief, candidate hypothesis, experiment budget and stop rule,
structured baseline/candidate comparison, and an explicit handoff packet. It
uses optional host adapters such as `dev/eval/`, `bagakit-replay-lab`, and
`bagakit-researcher`; those systems keep their own evidence and execution
contracts. `bagakit-skill-evolver` remains the owner of repository-level routing
and promotion.

The public CLI is intentionally read-only: use `--help`, `describe`, or
`contract` to inspect this protocol. Experiment execution remains with the
shared eval and replay owners.

The skill has no dedicated persistent `.bagakit/` runtime surface. Keep active
round notes and temporary comparison output under `.tmp/`, and leave durable
artifacts with the owner that consumes them.
