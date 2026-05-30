# Set Loop Goal Evals

This non-gating suite checks the public convergence-marker admission boundary
and preserves sanitized forward cases derived from real Goal drift. The case
inventory is a semantic trial set, not proof that static text contains the
right words.

Run:

```bash
node --experimental-strip-types dev/eval/src/cli.ts run \
  --root . \
  --suite gate_eval/skills/harness/bagakit-set-loop-goal/suite.ts
```
