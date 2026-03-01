# Agent Loop

`agent_loop` is the maintainer-only outer driver for repeated
`bagakit-flow-runner` sessions.

It exists to orchestrate bounded runner launches around canonical flow-runner
item state without creating a second execution truth surface.

## What It Owns

- repo-local run locking under `.bagakit/agent-loop/run.lock`
- runner launch configuration under `.bagakit/agent-loop/runner.json`
- per-session host exhaust under `.bagakit/agent-loop/runner-sessions/`
- per-run host summaries under `.bagakit/agent-loop/runs/`
- typed host stop payloads for `run`, `next`, and `watch`

It does not own:

- feature or ticket planning truth
- flow-runner item state
- checkpoint semantics
- archive authority for tracker-sourced items

## Public Commands

- `agent-loop.sh apply`
- `agent-loop.sh configure-runner`
- `agent-loop.sh next`
- `agent-loop.sh run`
- `agent-loop.sh resume`
- `agent-loop.sh watch`
- `agent-loop.sh validate`

## Core Rule

`agent_loop` is a host driver, not a second state machine.

That means:

- resolve work from `bagakit-flow-runner`
- launch one bounded runner session at a time
- refresh from canonical flow-runner state after each launch
- persist host exhaust for inspection only
- return typed stop reasons instead of hiding control flow in local caches

## Runner Contract

`agent_loop` currently supports one launch transport:

- `stdin_prompt`

Configured runner argv is stored in:

- `.bagakit/agent-loop/runner.json`

Built-in `configure-runner --preset` values are convenience shims only.
They do not redefine the stable host contract.

## Read Path

When maintaining this tool, read in this order:

1. `docs/specs/agent-loop-contract.md`
2. `docs/stewardship/agent-loop-maintenance.md`
3. `docs/stewardship/flow-runner-maintenance.md`
