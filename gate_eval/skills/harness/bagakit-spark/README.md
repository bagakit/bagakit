# Spark Eval

`gate_eval/skills/harness/bagakit-spark/` is the non-gating eval slice for
`skills/harness/bagakit-spark/`.

The serious-moment pilot uses five sanitized skill-goal cases with positive and
negative polarity, provenance/privacy labels, calibration refs, trial targets,
and structured guard ids. Its baseline/candidate score measures guard coverage,
not live dialogue quality.

Primary entrypoint:

```bash
node --experimental-strip-types dev/eval/src/cli.ts run --root . --suite gate_eval/skills/harness/bagakit-spark/suite.ts
```

Default result root:

- `gate_eval/skills/harness/bagakit-spark/results/runs/`
