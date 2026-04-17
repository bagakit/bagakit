# Bagakit Writing Core Eval

`gate_eval/skills/paperwork/bagakit-writing-core/` is the non-gating eval slice
for `skills/paperwork/bagakit-writing-core/`.

It checks that route/foundation, lint/prose mechanics, review packet, and
anti-rationalization surfaces are reachable through the skill CLI.

Primary entrypoint:

```bash
node --experimental-strip-types dev/eval/src/cli.ts run --root . --suite gate_eval/skills/paperwork/bagakit-writing-core/suite.ts
```

Default result root:

- `gate_eval/skills/paperwork/bagakit-writing-core/results/runs/`
