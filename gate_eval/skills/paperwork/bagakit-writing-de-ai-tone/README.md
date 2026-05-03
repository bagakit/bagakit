# Bagakit Writing De-AI-Tone Eval

`gate_eval/skills/paperwork/bagakit-writing-de-ai-tone/` is the non-gating eval
slice for `skills/paperwork/bagakit-writing-de-ai-tone/`.

It checks that the public CLI detects high-signal AI-tone patterns, preserves
technical-profile exemptions, and remains reachable through writing-core.

It also carries a qualitative rewrite dataset:

- `cases/ai-tone-rewrite-eval-dataset.json`

That dataset is intended for manual or subagent runs where subjective rewrite
quality matters: protected-span survival, scene fit, evidence preservation,
second-pass audit, and knowing when not to rewrite already-human prose.

The `holdout` split is public and reserved for future comparison runs. It is
not a hidden or answer-key-isolated blind split.

Primary entrypoint:

```bash
node --experimental-strip-types dev/eval/src/cli.ts run --root . --suite gate_eval/skills/paperwork/bagakit-writing-de-ai-tone/suite.ts
```

Default result root:

- `gate_eval/skills/paperwork/bagakit-writing-de-ai-tone/results/runs/`
