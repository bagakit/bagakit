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

- `.bagakit/bin/agent-loop`
- `.bagakit/agent-loop/runner.json`
- `.bagakit/agent-loop/notification.json`
- `.bagakit/agent-loop/notification-delivery/`
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

`.bagakit/bin/agent-loop` is the installed repo-local operator entrypoint.

It is convenience surface only.

It must not become execution truth or a second config plane.

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

For first-class runners such as `codex` and `claude`, `timeout_seconds` does
not override runner liveness truth.

Bagakit outer drivers may keep that field for generic-process fallbacks, but
they must not let host wall-clock timeout become authoritative stop truth for a
live first-class runner session.

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
- optional recovery context from one previous stopped session
- explicit boundary reminders
- required completion steps

Current host-path payload includes:

- `session_dir`
- `session_brief`
- `prompt_file`
- `stdout_file`
- `stderr_file`
- `session_meta_file`
- `runner_result_file`

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

One stopped session does not automatically mean the flow stopped.

`agent_loop` must reconcile runner-session facts with refreshed flow-runner
truth before deciding whether to continue, recover, or stop.

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

`run_status=operator_action_required` is a host decision, not a raw runner
transport fact.

For first-class runners, Bagakit should prefer:

- refreshed flow reconciliation
- bounded recovery continuation

before escalating one stopped session into host stop.

When `resume` cannot resolve one live candidate by itself, `run` payloads may
also carry `resume_candidates` so the host can inspect the ambiguity without
scraping flow-runner output.

## Current Contract

`current` currently emits schema `bagakit/agent-loop/current/v1`.

Stable fields:

- `selection_status`
- `selection_reason`
- `next_safe_action`
- `flow_next`
- optional `item_id`
- optional `resume_candidates`

## Status Contract

`status` currently emits schema `bagakit/agent-loop/status/v1`.

It is the one-shot read-only host snapshot surface built above `current` and
`watch`.

## Session-Run Contract

`session-run` currently emits schema `bagakit/agent-loop/session-run/v1`.

Stable fields:

- `session_status`
- `stop_reason`
- `operator_message`
- `next_safe_action`
- `item_id`
- `runner_session_id`
- `checkpoint_observed`
- `flow_next`

`session-run` uses the lower agent-runner substrate and does not own repeated
orchestration.

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
- optional `resume_candidates`

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

## Notification Delivery Contract

Notification delivery config currently uses schema
`bagakit/agent-loop/notification-config/v1`.

Current transport modes:

- `disabled`
- `command`

Delivery receipts currently use schema
`bagakit/agent-loop/notification-receipt/v1`.

They belong to host exhaust only.

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
- notification delivery config must remain separate from runner launch config
- tracker-sourced items must not be archived by `agent_loop`
- host exhaust must not become selection or lifecycle truth
