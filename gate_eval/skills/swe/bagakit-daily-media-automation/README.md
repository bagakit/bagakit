# Daily Media Automation Eval

`gate_eval/skills/swe/bagakit-daily-media-automation/` is the non-gating eval
slice for `skills/swe/bagakit-daily-media-automation/`.

It exercises deterministic fixture runs for domain-pack initialization,
ledger completion, no-publish blockers, status separation, run validation, and
the completeness of a paired fresh-session agent-behavior dataset.

The deterministic suite validates that the behavior dataset can test
golden-path activation, direct component routing, and side-effect control. It
does not claim an agent-quality improvement until maintainers execute the
paired baseline and with-skill sessions and review their captured outputs.

Primary entrypoint:

```bash
node --experimental-strip-types dev/eval/src/cli.ts run --root . --suite gate_eval/skills/swe/bagakit-daily-media-automation/suite.ts
```

Default result root:

- `gate_eval/skills/swe/bagakit-daily-media-automation/results/runs/`
