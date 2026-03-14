# Planning Surface Eval

`gate_eval/backbone/planning_surface/` is the non-gating comparative eval slice
for planning-entry surfaces.

It compares three currently relevant planning modes:

- `planning-with-files`
- `bagakit-feature-tracker`
- `bagakit-brainstorm`

The goal is not to force one global winner.

The goal is to make one narrower question observable:

- which planning-surface properties are actually present in each system

## What It Measures

- declared host-entry behavior
- runtime shape
- execution-binding evidence
- staged-analysis evidence
- validation and eval presence

This slice is a property comparison, not a weighted scorecard.

## Run

From the `skills/` repo root:

```bash
node --experimental-strip-types dev/eval/src/cli.ts run --root . --suite gate_eval/backbone/planning_surface/suite.ts
```

If `planning-with-files` is not in the default install location, set:

```bash
export PLANNING_WITH_FILES_SKILL_DIR="<path-to-planning-with-files>"
```

Default result root:

- `gate_eval/backbone/planning_surface/results/runs/`
