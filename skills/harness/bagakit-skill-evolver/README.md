# bagakit-skill-evolver

Agent-facing skill for deciding when repository evolution topics need
structured tracking and how to use `.bagakit/evolver/` without turning hidden local
research workspaces into a hard dependency.

This skill is the behavioral layer.

This skill ships its own low-level operator scripts for working with
`.bagakit/evolver/`.

Current capability set:

- topic lifecycle
- preflight
- repository-level route decisions
- candidates
- sources
- feedback
- benchmarks
- promotions
- weak local context refs
- steward-facing topic reports
- next-session handoff artifacts
- archive receipts for archived topics
- explicit durable promotion surfaces
- explicit promotion status
- stable promotion identities for proposal-to-landing tracking

Current known next optimizations:

- add richer promotion workflows into stable repository surfaces
- add stronger promotion-readiness eval and routing coverage
- add better steward-facing views over source, feedback, and benchmark evidence
