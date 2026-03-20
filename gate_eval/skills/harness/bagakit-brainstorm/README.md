# Brainstorm Eval

`gate_eval/skills/harness/bagakit-brainstorm/` is the non-gating eval slice
for `skills/harness/bagakit-brainstorm/`.

It reuses the shared `dev/eval` runner to capture deterministic artifact
readiness evidence for init-time review surfaces and status reporting.

Primary entrypoint:

```bash
node --experimental-strip-types dev/eval/src/cli.ts run --root . --suite gate_eval/skills/harness/bagakit-brainstorm/suite.ts
```

Default result root:

- `gate_eval/skills/harness/bagakit-brainstorm/results/runs/`
