# Agent Runner

`dev/agent_runner/` is the maintainer-only shared substrate for launching one
bounded agent runner session.

It exists to let:

- `dev/agent_loop/`
- `dev/eval/`

share the same low-level runner launch mechanics without collapsing their
higher-level semantics into one tool.

## Boundary

`dev/agent_runner/` owns:

- one bounded `stdin_prompt` runner launch
- argv and env template expansion
- prompt artifact writing
- stdout and stderr capture
- session meta writing for one launch
- launch timeout and launch-error capture

`dev/agent_runner/` does not own:

- item selection
- run locking
- host stop reasons
- flow-runner refresh
- eval case loading
- eval grading
- result-packet aggregation

Those remain owned by:

- `dev/agent_loop/`
- `dev/eval/`
- `gate_eval/`

## Design Rule

If a maintainer tool needs to drive exactly one bounded runner session, it
should reuse this substrate.

If a tool needs orchestration, task selection, retries, grading, or benchmark
aggregation, it should build that above this layer instead of extending the
substrate until it becomes another control plane.

## Entry Surface

Current primary library entry:

- `src/lib/session.ts`

Current stable shared contract:

- `docs/specs/agent-runner-contract.md`
