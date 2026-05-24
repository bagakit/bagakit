# Feature Tracker Eval

`gate_eval/skills/harness/bagakit-feature-tracker/` is the non-gating eval
slice for `skills/harness/bagakit-feature-tracker/`.

It reuses the shared `dev/eval` runner for two high-signal quality surfaces:
status projection coherence and planning-entry handoff integration. Lifecycle
correctness remains owned by the skill's gating validation rather than being
duplicated here.

Primary entrypoint:

```bash
node --experimental-strip-types dev/eval/src/cli.ts run --root . --suite gate_eval/skills/harness/bagakit-feature-tracker/suite.ts
```

Default result root:

- `gate_eval/skills/harness/bagakit-feature-tracker/results/runs/`
