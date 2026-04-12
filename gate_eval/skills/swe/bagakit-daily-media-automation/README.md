# Daily Media Automation Eval

`gate_eval/skills/swe/bagakit-daily-media-automation/` is the non-gating eval
slice for `skills/swe/bagakit-daily-media-automation/`.

It exercises deterministic fixture runs for domain-pack initialization,
ledger completion, no-publish blockers, status separation, and run validation.

Primary entrypoint:

```bash
node --experimental-strip-types dev/eval/src/cli.ts run --root . --suite gate_eval/skills/swe/bagakit-daily-media-automation/suite.ts
```

Default result root:

- `gate_eval/skills/swe/bagakit-daily-media-automation/results/runs/`
