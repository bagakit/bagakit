# Agent Loop Contract

This document defines the stable host-side runtime contract for `dev/agent_loop`.

## Scope

This contract covers:

- repo-local runner launch configuration
- repo-local run locking
- per-session host exhaust
- per-run host summaries
- typed host stop payloads
- host-owned stop-attention intent for operator-required stops

This contract does not define:

- feature or ticket lifecycle truth
- flow-runner item state
- checkpoint semantics
- archive authority for tracker-sourced items

Those remain owned by `bagakit-flow-runner` and, when applicable,
`bagakit-feature-tracker`.

## Runtime Surfaces

Stable host surfaces live under:

- `.bagakit/agent-loop/runner.json`
- `.bagakit/agent-loop/run.lock`
- `.bagakit/agent-loop/runner-sessions/<session-id>/session-brief.json`
- `.bagakit/agent-loop/runner-sessions/<session-id>/prompt.txt`
- `.bagakit/agent-loop/runner-sessions/<session-id>/stdout.txt`
- `.bagakit/agent-loop/runner-sessions/<session-id>/stderr.txt`
- `.bagakit/agent-loop/runner-sessions/<session-id>/session-meta.json`
- `.bagakit/agent-loop/runner-sessions/<session-id>/runner-result.json`
- `.bagakit/agent-loop/runs/<run-id>.json`

`runner-sessions/` is host exhaust.

`runs/` is host summary exhaust.

Neither surface becomes flow-runner truth.

## Source-Of-Truth Rule

Hosts should trust:

- `.bagakit/flow-runner/items/<item-id>/state.json`
- `.bagakit/flow-runner/next-action.json`
- `.bagakit/flow-runner/resume-candidates.json`
- flow-runner checkpoint and progress receipts

Hosts must not trust:

- runner stdout as control-plane truth
- `.bagakit/agent-loop/` host exhaust as execution truth
- local caches as hidden current-item selection truth

`agent_loop` may read host exhaust for watch or inspection, but must not feed it
back into selection or closeout decisions.

## Runner Config Contract

`runner.json` currently uses schema `bagakit/agent-loop/runner-config/v1`.

Supported fields:

- `runner_name`
- `transport`
- `argv[]`
- `env{}`
- `timeout_seconds`
- `refresh_commands[][]`

Current supported transport:

- `stdin_prompt`

For `stdin_prompt`, known CLIs must be configured in non-interactive forms.

`refresh_commands` are host-side refresh hooks.

They may refresh normalized item mirrors before or after a session, but they
must not create a second truth surface.

## Session Brief Contract

`session-brief.json` currently uses schema `bagakit/agent-loop/session-brief/v1`.

It exists to hand one bounded session enough context to operate without giving
the runner ownership of host state.

It may contain:

- selected item identity
- current flow-runner next payload
- repo-relative paths to handoff and host artifacts
- explicit boundary reminders
- required completion steps

## Runner Result Contract

`runner-result.json` currently uses schema `bagakit/agent-loop/runner-result/v1`.

Supported fields:

- `session_id`
- `status`
- `checkpoint_written`
- `note`

This file is advisory host exhaust.

`agent_loop` still refreshes from flow-runner after each launch.

If the runner fails or emits malformed host exhaust, `agent_loop` returns a
typed stop.

It does not synthesize flow-runner checkpoints on the runner's behalf.

## Run Payload Contract

`run` currently emits schema `bagakit/agent-loop/run/v2`.

Stable fields:

- `run_status`
- `stop_reason`
- `operator_message`
- `next_safe_action`
- `next_command_example`
- `can_resume`
- `item_id`
- `sessions_launched`
- `session_budget`
- `checkpoint_observed`
- `runner_session_id`
- `run_record_path`
- `flow_next`
- optional `host_notification_request`
- optional `resume_candidates`

`host_notification_request` is host-plane intent.

It may tell the host how much attention a stop deserves and what the maintainer
should do next.

It does not become flow-runner truth.

When `resume` cannot resolve one live candidate by itself, `run` payloads may
also carry `resume_candidates` so the host can inspect the ambiguity without
scraping flow-runner output.

## Run Record Contract

`runs/<run-id>.json` currently uses schema `bagakit/agent-loop/run-record/v2`.

Stable fields include:

- `run_status`
- `stop_reason`
- `operator_message`
- `next_safe_action`
- `next_command_example`
- `can_resume`
- `sessions_launched`
- `session_budget`
- optional `host_notification_request`

## Watch Contract

`watch --json` currently emits schema `bagakit/agent-loop/watch/v2`.

Stable fields include:

- `refreshed_at`
- optional `watch_issue`
- `runner_config_status`
- `runner_name`
- `run_lock`
- `decision`
- optional `focus_item`
- optional `latest_run`
- optional `latest_session`
- optional `current_notification`
- `recent_runs[]`
- `recent_sessions[]`
- `detail`

The non-JSON `watch` surface is a read-only host renderer over that same watch
payload.

`current_notification` is only populated when the latest run for the watched
scope is still `operator_action_required`.

If `watch_issue` is present, the watch surface must show that degraded host
read-path state before any optimistic launch banner.

## Fail-Closed Rules

- run lock acquisition must be atomic
- stale lock recovery is allowed only when the recorded pid is dead
- session budget exhaustion must return a typed stop
- auto-resolved resume must fail closed when there are zero or multiple live
  candidates
- runner output without a valid `runner-result.json` must not be treated as
  success
- runner failure must not cause `agent_loop` to invent flow-runner checkpoints
- operator-required stops must carry host-owned stop-attention intent
- tracker-sourced items must not be archived by `agent_loop`
- host exhaust must not become selection or lifecycle truth
