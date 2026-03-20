# Evolver Eval Protocol

## Purpose

This protocol defines the deterministic eval contract for
`gate_eval/skills/harness/bagakit-skill-evolver/`.

The runner creates isolated temporary repositories, executes evolver CLI
commands, inspects generated artifacts, and writes normalized reports.

## Eval Families

The minimum case families in this slice are:

- evidence ingest
- report quality
- promotion readiness
- routing
- weak-link references

These families are repository-level learning checks.
They are not selector task-loop checks.

## Case Convention

Cases are code-defined inside `run_eval.ts`.

Each case must declare:

- `id`
- `title`
- `summary`
- deterministic command sequence
- deterministic assertions

Each case should write enough normalized output that a maintainer can inspect:

- what commands ran
- what passed
- what failed
- which artifacts mattered

## Result Convention

Default output root:

- `gate_eval/skills/harness/bagakit-skill-evolver/results/runs/<run-id>/`

Each run directory contains:

- `summary.json`
  - aggregate status and case index
- `cases/<case-id>.json`
  - per-case details

Machine-local temporary paths must be sanitized to `<temp-repo>` before
results are written.
