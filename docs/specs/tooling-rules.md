# Tooling Rules

This document defines repository-level tooling rules for the Bagakit skills
monorepo.

## Intent

Bagakit tools should be usable, reviewable, and maintainable as the repository
grows. Tooling should not collapse into one-off shell fragments with duplicated
logic and unclear ownership.

## Rules

1. Prefer CLI entrypoints for repository tools.
2. Treat each first-level directory under `dev/` as one independent tool
   project.
3. A `dev/` tool project must stay generic and must not couple itself to one
   business-domain semantic surface.
4. A `dev/` tool project should be complete enough to own its README, CLI
   entrypoint, implementation code, and validation approach.
5. `dev/` tools are steward-facing operator tools.
6. Agent-facing workflow semantics should not live primarily in `dev/`.
7. If a capability needs agent-facing behavioral guidance, that guidance should
   live in a skill and may optionally use skill-shipped operator scripts as its
   low-level operator.
8. Repository validation framework mechanics belong in `dev/validator/`, while
   validation truth belongs in `gate_validation/`.
9. Small helper scripts may use the language best suited to the task.
10. Larger tools must be designed with engineering quality in mind.
11. For larger tools, default to TypeScript unless Python has a clear practical
   advantage.
12. If another language is the better fit, choose it deliberately and record
   why in the owning README or stewardship note.
13. Keep tooling DRY. Shared behavior should move into reusable modules instead
   of being copied across scripts.

## Tool Project Boundary

Repository-level interpretation of `dev/`:

- each first-level child directory under `dev/` is a tool boundary
- that boundary should remain reusable across multiple repository contexts
- domain-specific semantics belong in `skills/`, `mem/`, or `docs/`, not in the
  generic tool core
- if a tool needs project-specific adapters, keep the core generic and isolate
  the adapter layer explicitly

## Practical Guidance

- shell is acceptable for thin wrappers and short task-specific glue
- Python is acceptable for compact data-processing or scripting tasks when it
  is clearly simpler
- TypeScript is the default for tools that are growing into maintained
  repository software
- a tool that gains subcommands, shared models, validation layers, or repeated
  parsing logic should be treated as a candidate for TypeScript or another
  stronger engineering language
- a `dev/` directory that cannot explain its CLI, scope, and ownership in its
  own README is probably not yet a complete tool project
- release-blocking validation logic should not be scattered across `validate.sh`
  files when `dev/validator` plus `gate_validation/` can express it cleanly
- do not add compatibility layers that weaken the direct-install contract of
  installable skill directories

## Anti-Patterns

- multiple near-copy scripts that drift over time
- hidden operator logic buried in one-off shell pipelines
- large Python scripts kept as "temporary" tools after they have become
  repository infrastructure
- repo validation semantics embedded into `dev/validator/` instead of registered
  through `gate_validation/`
- manifest-based payload selection reintroduced to compensate for poor
  directory hygiene
- tool behavior that exists only in prose and has no CLI or callable entrypoint
- a `dev/` directory that is really just one business workflow disguised as a
  generic tool
- repository semantics hard-coded into a tool core when they should be passed
  through configuration, inputs, or adapters
