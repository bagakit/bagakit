# Skill Eval Protocol

This protocol defines the shared expectations for skill-owned eval slices under
`gate_eval/skills/`.

## Purpose

Skill eval slices should stay:

- non-gating
- skill-owned
- case-truth local
- packet-compatible across the repo

## Required Local Truth

Each serious skill eval slice should keep its own:

- `README.md`
- `validation.toml`
- suite module or runner entrypoint
- default result output root under `results/runs/`

The shared maintainer harness may run these slices, but it must not become the
home of their case truth.

## Case Style

Skill suites may use either:

- code-defined deterministic cases
- declarative case packs interpreted by a thin skill-owned adapter

Choose the simpler style for the owning skill.

## Result Rule

All shared-harness skill suites must emit the packet shape defined in:

- `docs/specs/eval-run-packet.md`

## Focus Rule

Each case should declare one or more focus dimensions that explain what the
case is measuring.

Examples:

- `state-transition`
- `handoff-quality`
- `tool-routing`
- `archive-integrity`
- `trace-safety`

## Boundary Rule

`gate_validation/` may require that a skill-owned eval slice exists.

That does not make the eval slice release-blocking.

It only protects the structural presence of the measurement surface.
