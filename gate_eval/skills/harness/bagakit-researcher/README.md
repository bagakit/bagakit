# Researcher Eval

`gate_eval/skills/harness/bagakit-researcher/` is the non-gating eval slice for
`skills/harness/bagakit-researcher/`.

It reuses the shared `dev/eval` runner to capture deterministic quality
evidence around topic indexing and evidence-card linkage without duplicating the
release gate.

Current coverage:

- topic initialization and refresh
- source-card and summary linkage in `index.md`
- topic listing and doctor visibility

Primary entrypoint:

```bash
node --experimental-strip-types dev/eval/src/cli.ts run --suite gate_eval/skills/harness/bagakit-researcher/suite.ts
```

Default result root:

- `gate_eval/skills/harness/bagakit-researcher/results/runs/`
