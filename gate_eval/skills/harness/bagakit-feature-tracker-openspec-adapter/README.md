# OpenSpec Adapter Eval

`gate_eval/skills/harness/bagakit-feature-tracker-openspec-adapter/` is the
non-gating eval slice for the OpenSpec bridge skill.

It reuses the shared `dev/eval` runner to measure round-trip bridge fidelity
without moving the adapter into the release gate.

Primary entrypoint:

```bash
node --experimental-strip-types dev/eval/src/cli.ts run --root . --suite gate_eval/skills/harness/bagakit-feature-tracker-openspec-adapter/suite.ts
```

Default result root:

- `gate_eval/skills/harness/bagakit-feature-tracker-openspec-adapter/results/runs/`
