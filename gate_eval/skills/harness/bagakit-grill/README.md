# Grill Eval

`gate_eval/skills/harness/bagakit-grill/` is the non-gating eval slice for
`skills/harness/bagakit-grill/`.

It runs deterministic checks over the first-version grill lifecycle:

- structured run truth
- generated read-only brief
- one-question progression
- research-needed handoff behavior
- sanitized protected-principle, route, false-binary, and convergence cases

The pilot comparison measures structured guard coverage. It does not claim
three-trial live-agent reliability.

Primary entrypoint:

```bash
node --experimental-strip-types dev/eval/src/cli.ts run --root . --suite gate_eval/skills/harness/bagakit-grill/suite.ts
```

Default result root:

- `gate_eval/skills/harness/bagakit-grill/results/runs/`
