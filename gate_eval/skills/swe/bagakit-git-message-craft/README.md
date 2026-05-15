# Git Message Craft Eval

`gate_eval/skills/swe/bagakit-git-message-craft/` is the non-gating eval slice
for `skills/swe/bagakit-git-message-craft/`.

It reuses the shared `dev/eval` runner to capture deterministic evidence around
message drafting, linting, archive output, and the completeness of a paired
fresh-session agent-behavior dataset.

The deterministic suite validates that the behavior dataset is runnable and
contains observable routing, quality, and side-effect boundaries. It does not
claim that skill activation improves model behavior until maintainers execute
the paired baseline and with-skill sessions and review their captured outputs.

Primary entrypoint:

```bash
node --experimental-strip-types dev/eval/src/cli.ts run --root . --suite gate_eval/skills/swe/bagakit-git-message-craft/suite.ts
```

Default result root:

- `gate_eval/skills/swe/bagakit-git-message-craft/results/runs/`
