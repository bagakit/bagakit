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
- timeout and launch-error capture

It does not own:

- work selection
- retries across multiple sessions
- run locking
- host stop-attention policy
- eval case loading
- eval grading
- repository execution truth

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

## Boundary Rule

If a tool needs exactly one bounded runner launch, it should use
`dev/agent_runner/`.

If a tool needs orchestration, stop policy, or grading, it should build that
above this layer instead of pushing more policy into the substrate.
