# Skill Eval Results

Generated run artifacts belong under:

- `gate_eval/backbone/skill/results/runs/<run-id>/`

Expected contents for each run:

- `summary.json`
  - aggregate case status and environment snapshot
- `cases/<case-id>.json`
  - per-case probe details and normalized outputs

This directory is intentionally non-gating. Maintainers may inspect results,
compare runs, or archive interesting failures, but nothing here is read by
`gate_validation/`.
