# Skill Selector Eval

`gate_eval/skills/co-work/orchestrate/execution/bagakit-skill-selector/` is the non-gating eval
slice for `skills/co-work/orchestrate/execution/bagakit-skill-selector/`.

It reuses the shared `dev/eval` runner to capture deterministic evidence around
selective persisted composition and retry evidence, opt-in task-local evolver
review signals, explicit bridge into evolver intake, planning-entry route
logging, selective persistence disposition, gold-ready daily collection fields,
real-episode eval scaffolding, and derived reports. Retry state is derived by
the operator; the eval does not require a hand-written footer diary.

Primary entrypoint:

```bash
node --experimental-strip-types dev/eval/src/cli.ts run --root . --suite gate_eval/skills/co-work/orchestrate/execution/bagakit-skill-selector/suite.ts
```

Default result root:

- `gate_eval/skills/co-work/orchestrate/execution/bagakit-skill-selector/results/runs/`

## Real Episode Scaffolding

Use `scaffold_eval_case.ts` to turn one real selector episode into a reviewable
silver or gold candidate:

```bash
node --experimental-strip-types gate_eval/skills/co-work/orchestrate/execution/bagakit-skill-selector/scaffold_eval_case.ts \
  --file .bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml \
  --out gate_eval/skills/co-work/orchestrate/execution/bagakit-skill-selector/cases \
  --label silver
```

The generated case directory contains:

- `episode.json`
  - what the selector episode recorded
- `expected.json`
  - initial expected labels derived from the episode
- `README.md`
  - maintainer review checklist

Treat generated `silver` labels as scaffolds. Promote to `gold` only after a
maintainer checks the original task prompt, final artifact, verification
evidence, missed candidates, rejected candidates, candidate results, lesson
updates, and evolver signals.
