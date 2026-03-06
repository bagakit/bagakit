# Living Knowledge Eval

`gate_eval/skills/harness/bagakit-living-knowledge/` is the non-gating eval
slice for `skills/harness/bagakit-living-knowledge/`.

It reuses the shared `dev/eval` runner to capture deterministic evidence around
shared-root recall and reviewed-note ingestion.

Primary entrypoint:

```bash
node --experimental-strip-types dev/eval/src/cli.ts run --root . --suite gate_eval/skills/harness/bagakit-living-knowledge/suite.ts
```

Default result root:

- `gate_eval/skills/harness/bagakit-living-knowledge/results/runs/`
