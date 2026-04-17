# Spark Eval

`gate_eval/skills/harness/bagakit-spark/` is the non-gating eval slice for
`skills/harness/bagakit-spark/`.

It uses deterministic fixtures to check that Spark review artifacts preserve
dialogue closure evidence, weak-question findings, and explicit next actions
before a thinking session is treated as accepted.

Primary entrypoint:

```bash
node --experimental-strip-types dev/eval/src/cli.ts run --root . --suite gate_eval/skills/harness/bagakit-spark/suite.ts
```

Default result root:

- `gate_eval/skills/harness/bagakit-spark/results/runs/`
