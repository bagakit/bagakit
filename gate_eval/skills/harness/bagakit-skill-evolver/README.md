# Evolver Eval

This slice contains deterministic non-gating eval for
`skills/harness/bagakit-skill-evolver/`.

It exists to measure closure quality beyond validation structure:

- evidence ingest behavior
- report and handoff quality surfaces
- promotion-readiness behavior
- repository-level routing behavior
- weak-link reference handling

Runtime validation remains owned by `gate_validation/`.

This eval slice stays non-gating.
It is meant to make closure quality visible, not to become a second release
gate.

Primary entrypoint:

```bash
node --experimental-strip-types gate_eval/skills/harness/bagakit-skill-evolver/run_eval.ts
```

Results are written under:

- `gate_eval/skills/harness/bagakit-skill-evolver/results/runs/<run-id>/`
