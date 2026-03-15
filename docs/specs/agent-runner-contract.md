# Agent Runner Contract

This document defines the stable shared contract for `dev/agent_runner/`.

## Purpose

Bagakit needs one reusable bounded-session substrate so that:

- `dev/agent_loop/` does not own runner-launch mechanics by accident
- `dev/eval/` can drive the same runner substrate when a suite needs a real
  agent session
- higher-level tools stay free to own orchestration or grading without
  duplicating spawn, timeout, and transcript capture code

## Scope

`dev/agent_runner/` owns:

- one bounded `stdin_prompt` launch
- argv and env template expansion
- prompt capture
- stdout and stderr capture
- one neutral session meta artifact
- optional host timeout and launch-error capture

It does not own:

- work selection
- retries across multiple sessions
- run locking
- host stop-attention policy
- eval case loading
- eval grading
- repository execution truth

It also does not own:

- whether one timeout should have any authority over runner liveness truth

That policy belongs to the higher-level host using this substrate.

## Session Meta

The neutral session meta schema is:

- `bagakit/agent-runner/session-meta/v1`

It records:

- session id
- workload id
- runner name
- transport
- started timestamp
- exit code
- signal
- launch error
- expanded argv
- expanded env key list

`launch_error` is only a runner-session-layer fact.

It must not be treated as execution truth by itself.

## Shared Template ABI

All tools using `dev/agent_runner/` must provide these stable template keys:

- `repo_root`
- `session_dir`
- `session_id`
- `workload_id`
- `prompt_file`
- `stdout_file`
- `stderr_file`
- `session_meta_file`

Tools may add higher-level keys above this layer.

Examples:

- `dev/agent_loop/` may add `session_brief` and `runner_result`
- `dev/eval/` may stay on the shared key set only

## Boundary Rule

If a tool needs exactly one bounded runner launch, it should use
`dev/agent_runner/`.

If a tool needs orchestration, stop policy, or grading, it should build that
above this layer instead of pushing more policy into the substrate.

That includes:

- deciding whether first-class runners such as `codex` or `claude` should
  ignore host wall-clock timeout
- deciding whether a stopped session implies bounded recovery or operator stop

## Eval Boundary

Not every eval suite needs a real agent session.

Rules:

- deterministic runtime suites may continue to call the subject CLI directly
- agent-driven suites should use `dev/agent_runner/`
- both modes still report through the same eval packet contract in
  `docs/specs/eval-run-packet.md`
