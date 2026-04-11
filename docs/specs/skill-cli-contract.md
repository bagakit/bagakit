# Skill CLI Contract

This document defines the stable Bagakit contract for skill-owned CLI
declarations and the repository-level `bagakit-cli` aggregator.

## Purpose

Use this spec when deciding:

- how one installable skill declares an independently usable CLI
- what the central `bagakit-cli` may discover and dispatch
- why central aggregation must not absorb skill-owned runtime semantics
- how skill CLI declarations relate to runtime surfaces and install payloads

This file is the SSOT for:

- the conventional `references/skill-cli.toml` declaration
- skill CLI discovery requirements
- central aggregator boundaries
- dispatch semantics for `bagakit-cli run`

It is not the SSOT for:

- one skill's command behavior
- runtime-surface ownership
- Bagakit driver footer guidance
- installable skill directory protocol

Those belong respectively in:

- the owning skill docs and shipped operator
- `docs/specs/runtime-surface-contract.md`
- `docs/specs/bagakit-driver-contract.md`
- `docs/specs/canonical-skill-layout.md` when that contract is split out, or
  the current canonical skill layout validation surfaces

## First Principle

Each skill owns its own CLI.

The central `bagakit-cli` is an operator view and dispatch layer. It may:

- discover installable skills
- read skill CLI declarations
- list skill CLI availability
- list runtime surfaces
- summarize repository status
- dispatch to one skill-owned CLI

It must not:

- reimplement skill-owned business commands
- make skill CLIs depend on the central aggregator
- treat missing central registration as meaning a skill has no CLI
- use a central manifest as the source of skill semantics
- merge runtime surfaces into one shared state root
- become the owner of per-skill command behavior, state transitions, or
  business validation semantics

This keeps skill installability real while still giving operators one coherent
management entrypoint.

## Declaration Path

A skill that exposes an operator CLI should declare it at:

- `references/skill-cli.toml`

For canonical Bagakit monorepo installable skills, this declaration is the
default expectation. Each installable skill should expose one small
skill-owned CLI declaration, even when the initial command set is only
read-only inspection such as `describe`, `list-references`, or `validate`.
That keeps installable skills independently operable while letting
`bagakit-cli` aggregate them.

Outside the canonical monorepo, or for a skill with no meaningful operator
surface yet, the file may be absent. Absence means:

- the skill has no declared CLI for central discovery
- the skill may still have helper scripts, but `bagakit-cli` should not guess
  their command shape

The declaration is part of the skill payload. It must not point outside the
skill directory, either lexically or through symlink realpath escape.

## Declaration Format

Baseline format:

```toml
version = 1
skill = "bagakit-living-knowledge"
cli_id = "bagakit-living-knowledge"
entrypoint = "scripts/bagakit-living-knowledge.sh"
runner = "shell"
usage = "sh scripts/bagakit-living-knowledge.sh <command> [args...]"
summary = "Manage the repository living-knowledge substrate."
surface_refs = [
  ".bagakit/living-knowledge",
  ".bagakit/knowledge_conf.toml",
]

[[command]]
name = "doctor"
summary = "Run non-destructive diagnostics."

[[command]]
name = "index"
summary = "Refresh generated guidebook surfaces."
```

Required fields:

- `version`
  - current value: `1`
- `skill`
  - the skill id, matching the installable directory name
- `cli_id`
  - stable CLI id shown by aggregators
- `entrypoint`
  - repo-relative path from the skill root to the skill-owned executable or
    script
- `runner`
  - one of:
    - `shell`
    - `node`
    - `python`
- `usage`
  - compact usage string for humans
- `summary`
  - one-line CLI purpose

Optional fields:

- `surface_refs`
  - repo-relative navigational refs to concrete runtime or protocol paths this
    CLI commonly operates on

Optional command table:

- `[[command]]`
  - `name`
  - `summary`

The command table is a discoverability aid. It is not a complete schema for
the skill's CLI.

## Runner Semantics

`runner` tells an aggregator how to launch the entrypoint:

- `shell`
  - execute the entrypoint through `bash <entrypoint>`
- `node`
  - execute with `node --experimental-strip-types`
- `python`
  - execute with `python3`

Skill authors should prefer a small shell wrapper when a skill uses Python or
TypeScript internally. The wrapper gives the skill one stable executable
entrypoint and lets the aggregator stay simple.

## Aggregator Dispatch

`bagakit-cli run <skill-or-selector> -- <args...>` resolves one declared skill
CLI and forwards `<args...>` to its declared entrypoint.

Dispatch rules:

- the skill must have `references/skill-cli.toml`
- the selector must resolve to exactly one declared CLI
- forwarded arguments must appear after `--`
- the aggregator may append no hidden skill-specific flags
- the child process inherits stdio
- the child working directory is the repository root by default

The aggregator may support `--json` for discovery commands, but dispatch
should preserve the skill CLI's own output contract.

## Aggregator Views

Recommended central commands:

- `skills`
  - list installable skills and declared CLI availability
- `skill <selector>`
  - show one skill's declared CLI metadata
- `surfaces`
  - list materialized `.bagakit/<surface>/surface.toml` records
- `status`
  - summarize skills, declared CLIs, and runtime surfaces
- `run <selector> -- <args...>`
  - dispatch to the selected skill CLI

These views are derived. They are not durable repository truth.

## Validation Rules

Validators should reject:

- invalid TOML declarations
- `version` values other than `1`
- declarations where `skill` does not match the installable directory name
- missing declared entrypoints
- absolute entrypoint paths
- entrypoints that escape the skill directory
- entrypoints whose symlink-resolved real target escapes the skill directory
- unknown `runner` values
- duplicate command names in one declaration
- absolute filesystem paths in `surface_refs`
- parent-escaping or broad repository-root refs in `surface_refs`

Validators should warn, not fail, when:

- a skill has executable scripts but no declaration
- a declaration has no `[[command]]` entries

Warnings should not force every third-party or non-canonical skill to expose a
CLI. Canonical monorepo validation may set a stronger repository bar that
requires every current installable skill to declare `references/skill-cli.toml`.

## Boundary With Runtime Surfaces

`references/skill-cli.toml` does not declare ownership of runtime state.

Runtime ownership remains in:

- the owning skill docs
- materialized `.bagakit/<surface>/surface.toml`
- `docs/specs/runtime-surface-contract.md`

`surface_refs` only helps operators navigate likely related runtime or protocol
paths. It must not become a second runtime-surface registry or a broad package
scope declaration.
