# Skill Selector Eval

`gate_eval/skills/harness/bagakit-skill-selector/` is the non-gating eval
slice for `skills/harness/bagakit-skill-selector/`.

It reuses the shared `dev/eval` runner to capture deterministic evidence around
explicit composition logging, retry backoff, and derived reports.

Primary entrypoint:

```bash
node --experimental-strip-types dev/eval/src/cli.ts run --root . --suite gate_eval/skills/harness/bagakit-skill-selector/suite.ts
```

Default result root:

- `gate_eval/skills/harness/bagakit-skill-selector/results/runs/`
