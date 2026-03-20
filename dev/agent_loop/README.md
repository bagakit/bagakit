# Agent Loop

`agent_loop` is the maintainer-only outer driver for repeated
`bagakit-flow-runner` sessions.

It exists to orchestrate bounded runner launches around canonical flow-runner
item state without creating a second execution truth surface.

Shared launch substrate:

- `dev/agent_runner/`

## Install Shape

Source lives under:

- `dev/agent_loop/`

Consumer-repo entrypoint should live under:

- `.bagakit/bin/agent-loop`

Use `apply` to initialize `.bagakit/agent-loop/` and install that repo-local
entrypoint.

Do not wire `dev/agent_loop/` into the consumer repo just to get a command.
`dev/agent_loop/` is the source tree; `.bagakit/bin/agent-loop` is the
installed operator entrypoint.

## What It Owns

- repo-local run locking under `.bagakit/agent-loop/run.lock`
- runner launch configuration under `.bagakit/agent-loop/runner.json`
- per-session host exhaust under `.bagakit/agent-loop/runner-sessions/`
- per-run host summaries under `.bagakit/agent-loop/runs/`
- typed host stop payloads for `run`, `next`, and `watch`
- host-owned stop-attention objects on operator-required stops

It does not own:

- feature or ticket planning truth
- flow-runner item state
- checkpoint semantics
- archive authority for tracker-sourced items
- notification delivery transport

## Public Commands

- `.bagakit/bin/agent-loop apply`
- `.bagakit/bin/agent-loop configure-runner`
- `.bagakit/bin/agent-loop configure-notification`
- `.bagakit/bin/agent-loop current`
- `.bagakit/bin/agent-loop deliver-notification`
- `.bagakit/bin/agent-loop next`
- `.bagakit/bin/agent-loop status`
- `.bagakit/bin/agent-loop run`
- `.bagakit/bin/agent-loop resume`
- `.bagakit/bin/agent-loop session-run`
- `.bagakit/bin/agent-loop watch`
- `.bagakit/bin/agent-loop validate`

When working on `agent_loop` itself in this source repo, maintainers may still
invoke `dev/agent_loop/agent-loop.sh` directly.

`watch` supports one-shot snapshot rendering and live terminal refresh when
stdout is a TTY.

`current` resolves the current item without launching anything.

`status` renders one read-only host snapshot without entering the live watch
loop.

`resume` may pin one explicit item with `--item`, or trust the same current
selection flow that powers `current`, then fall back to resume candidates only
when needed.

`session-run` executes exactly one bounded session for one explicit item and
stops.

## Core Rule

`agent_loop` is a host driver, not a second state machine.

That means:

- resolve work from `bagakit-flow-runner`
- launch one bounded runner session at a time
- refresh from canonical flow-runner state after each launch
- reconcile one stopped session with refreshed canonical flow truth before
  deciding whether the host should stop
- persist host exhaust for inspection only
- return typed stop reasons instead of hiding control flow in local caches
- emit host-owned stop-attention intent without redefining runtime truth

## Runner Contract

`agent_loop` currently supports one launch transport:

- `stdin_prompt`

For `stdin_prompt`, known CLIs must still be configured in non-interactive
forms such as `codex exec` or `claude -p`.

Maintainers may still choose one local launcher shape in `argv`, for example:

- `["bash","-lc","codex exec ..."]`
- `["npx","codex","exec", ...]`
- one repo-local wrapper script

That is a configuration detail, not a new stable runner concept.

Bagakit should reason about:

- first-class runners
- generic-process runners

rather than promoting one machine-local launcher name into system vocabulary.

For first-class runners such as `codex` or `claude`, host wall-clock timeout is
not authoritative liveness truth. Long sessions are allowed. If Bagakit later
adds stuck-session fallback for weaker runners, that fallback should stay
evidence-based and accuracy-first instead of interrupting long sessions just
because elapsed time is large.

When one recoverable session stop still leaves canonical flow truth runnable,
`agent_loop` may open one bounded recovery session automatically. That recovery
context is also persisted in host run payloads so a later explicit rerun does
not lose the previous session exhaust.

Configured runner argv is stored in:

- `.bagakit/agent-loop/runner.json`

Built-in `configure-runner --preset` values are convenience shims only.
They do not redefine the stable host contract.

Notification delivery uses a separate host config under
`.bagakit/agent-loop/notification.json`.

It is not part of runner launch mechanics.

## Read Path

When maintaining this tool, read in this order:

1. `docs/specs/agent-runner-contract.md`
2. `docs/specs/agent-loop-contract.md`
3. `docs/stewardship/agent-loop-maintenance.md`
4. `docs/stewardship/flow-runner-maintenance.md`
