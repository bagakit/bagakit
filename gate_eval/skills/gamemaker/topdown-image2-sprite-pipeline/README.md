# Topdown Image2 Sprite Pipeline Eval

`gate_eval/skills/gamemaker/topdown-image2-sprite-pipeline/` is the
non-gating eval slice for
`skills/gamemaker/topdown-image2-sprite-pipeline/`.

It checks review-handoff behavior around package completeness, reviewer
ownership, provenance, visual review, and accepted deviations. Image processing
itself remains dependency-gated by the skill CLI.

Primary entrypoint:

```bash
node --experimental-strip-types dev/eval/src/cli.ts run --root . --suite gate_eval/skills/gamemaker/topdown-image2-sprite-pipeline/suite.ts
```

Default result root:

- `gate_eval/skills/gamemaker/topdown-image2-sprite-pipeline/results/runs/`
