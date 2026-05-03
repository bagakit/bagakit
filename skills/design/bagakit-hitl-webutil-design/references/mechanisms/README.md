# Mechanism References

Mechanisms own reusable HITL page jobs.

Each mechanism file should answer:

- what job it owns
- what it does not own
- required design checks
- output or evidence it must produce
- failure signals

Keep cross-cutting concerns lean in v0:

- status/error semantics live in `../workflow-contract.toml`
- provenance labeling lives in `../workflow-contract.toml`
- export schemas live in `../artifacts/`

Do not create a scene-first mechanism when a crosswalk composition is enough.
