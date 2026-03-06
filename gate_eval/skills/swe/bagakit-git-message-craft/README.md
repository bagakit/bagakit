# Git Message Craft Eval

`gate_eval/skills/swe/bagakit-git-message-craft/` is the non-gating eval slice
for `skills/swe/bagakit-git-message-craft/`.

It reuses the shared `dev/eval` runner to capture deterministic evidence around
message drafting, linting, and archive output.

Primary entrypoint:

```bash
node --experimental-strip-types dev/eval/src/cli.ts run --root . --suite gate_eval/skills/swe/bagakit-git-message-craft/suite.ts
```

Default result root:

- `gate_eval/skills/swe/bagakit-git-message-craft/results/runs/`
