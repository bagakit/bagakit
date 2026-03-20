# Feature Tracker Eval

`gate_eval/skills/harness/bagakit-feature-tracker/` is the non-gating eval
slice for `skills/harness/bagakit-feature-tracker/`.

It reuses the shared `dev/eval` runner to capture deterministic quality
evidence around feature state transitions and status projection coherence.

Primary entrypoint:

```bash
node --experimental-strip-types dev/eval/src/cli.ts run --root . --suite gate_eval/skills/harness/bagakit-feature-tracker/suite.ts
```

Default result root:

- `gate_eval/skills/harness/bagakit-feature-tracker/results/runs/`
