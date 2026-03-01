# Skill Eval

`gate_eval/backbone/skill/` is the non-gating eval surface for the repo
`skill` command surface.

It measures observable CLI behavior against deterministic fixture repos. The
goal is maintainer confidence, not release blocking.

## What It Covers

- directory-protocol discovery ordering and selector resolution
- family-name precedence over bare skill-id selectors
- installable skill layout drift and safety checks
- link creation, idempotence, and force-replace conflict handling
- package archive generation, archive hygiene, and symlink retention

## What It Does Not Do

- it does not register release-blocking checks
- it does not replace the gated skill-surface regression tests
- it does not mutate the real repository under test

Each run materializes fixture repos in a temporary directory, invokes
`scripts/skill.ts`, and writes a run report under:

- `gate_eval/backbone/skill/results/runs/<run-id>/`

## Run

From the `skills/` repo root:

```bash
node gate_eval/backbone/skill/run_eval.mjs
```

Useful options:

```bash
node gate_eval/backbone/skill/run_eval.mjs --list
node gate_eval/backbone/skill/run_eval.mjs --case selector-resolution
node gate_eval/backbone/skill/run_eval.mjs --out gate_eval/backbone/skill/results/runs/manual-smoke
```

The runner exits non-zero when one or more eval probes fail, but that outcome
is still non-gating unless a maintainer explicitly chooses to act on it.

See `protocol.md` for the case schema and result format.
