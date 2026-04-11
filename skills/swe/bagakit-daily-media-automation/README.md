# Bagakit Daily Media Automation

Installable orchestration skill for recurring research-to-publication runs.

Use it to coordinate source acquisition, evidence review, generated assets,
webpage production, deployment, mobile notification, and run archiving.

Primary runtime doc:

- `SKILL.md`

## Runtime Surface Declaration

- top-level runtime surface root when materialized:
  - `.bagakit/daily-media-automation/`
- stable contract:
  - `docs/specs/runtime-surface-contract.md`
- if the top-level root exists in a host repo, it should carry `surface.toml`

Operator references:

- `references/runbook.md`
- `references/adapter-matrix.md`
- `references/run-artifacts.md`
