# Flow Runner Eval

`gate_eval/skills/co-work/orchestrate/execution/bagakit-flow-runner/` is the non-gating eval slice
for `skills/co-work/orchestrate/execution/bagakit-flow-runner/`.

It reuses the shared `dev/eval` runner to capture deterministic evidence around
next-action packets, resume candidates, and closeout signaling.

Primary entrypoint:

```bash
node --experimental-strip-types dev/eval/src/cli.ts run --root . --suite gate_eval/skills/co-work/orchestrate/execution/bagakit-flow-runner/suite.ts
```

Default result root:

- `gate_eval/skills/co-work/orchestrate/execution/bagakit-flow-runner/results/runs/`
