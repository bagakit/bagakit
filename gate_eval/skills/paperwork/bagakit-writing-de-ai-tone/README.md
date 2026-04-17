# Bagakit Writing De-AI-Tone Eval

`gate_eval/skills/paperwork/bagakit-writing-de-ai-tone/` is the non-gating eval
slice for `skills/paperwork/bagakit-writing-de-ai-tone/`.

It checks that the public CLI detects high-signal AI-tone patterns, preserves
technical-profile exemptions, and remains reachable through writing-core.

Primary entrypoint:

```bash
node --experimental-strip-types dev/eval/src/cli.ts run --root . --suite gate_eval/skills/paperwork/bagakit-writing-de-ai-tone/suite.ts
```

Default result root:

- `gate_eval/skills/paperwork/bagakit-writing-de-ai-tone/results/runs/`
