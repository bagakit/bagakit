# Roles

This document defines the maintainer-facing roles relevant to the Bagakit
skills repository.

## Steward

Stewards are responsible for repository-level coherence.

Typical responsibilities:

- keep source-of-truth boundaries clear
- review structural changes across `skills/`, `docs/`, `dev/`, `mem/`, and
  `catalog/`
- keep `gate_validation/` and `gate_eval/` boundaries coherent
- keep direct-install rules stricter than convenience-driven compatibility
- decide when evolving memory is ready to be promoted into stable repository
  rules
- keep transition work from creating a second hidden control plane

## Tool Maintainer

Tool maintainers own executable repository tools.

Typical responsibilities:

- keep CLI entrypoints usable and documented
- keep implementation quality proportional to tool scope
- prevent duplicated tooling logic from drifting
- keep maintainer-only tooling out of runtime skill payloads
- keep each first-level `dev/` directory coherent as one complete tool project
- keep tool cores generic instead of coupling them to one business semantic
  surface
- keep `dev/validator/` focused on framework mechanics instead of owner-local
  validation semantics
- push business-specific meaning into adapters, inputs, specs, or memory rather
  than burying it inside generic tool code
- avoid letting steward tools quietly become the primary home of agent-facing
  workflow semantics

## Skill Steward

Skill stewards own the structure and readiness of a skill family or skill
source once it becomes canonical in this repo.

Typical responsibilities:

- keep runtime payload boundaries clear
- keep family-level structure coherent
- coordinate projection to legacy distribution targets during transition
- keep agent-facing workflow semantics in skills even when related steward tools
  exist elsewhere in the repo
- register release-blocking skill validation under `gate_validation/skills/`
  instead of scattering gate files into runtime skill directories
- reject `SKILL_PAYLOAD.json` or similar manifest fallbacks for installable
  skill sources

## Promotion Rule

When deciding whether content belongs in `mem/`, `docs/`, or `skills/`:

- use `mem/` for durable but still-evolving evidence and context
- use `docs/` for stable, reviewable rules and stewardship guidance
- use `skills/` only for runtime-facing skill sources and payload content
