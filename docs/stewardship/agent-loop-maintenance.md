# Agent Loop Maintenance

Maintainers should treat `agent_loop` as host-side orchestration around
`bagakit-flow-runner`, not as a second execution runtime.

## Main Rule

`agent_loop` may:

- acquire and release one repo-local run lock
- launch one bounded runner session at a time
- refresh from flow-runner before and after each launch
- persist host exhaust for later inspection
- auto-archive runner-owned items only by calling the canonical flow-runner
  archive command
- emit host-owned stop-attention intent for operator-required stops
- delegate notification delivery through a separate host-only adapter config

`agent_loop` must not:

- redefine current-item selection in host-local caches
- scrape runner stdout as execution truth
- synthesize flow-runner checkpoints after runner failure
- archive tracker-sourced items
- decide feature closeout
- introduce a second hidden progress ledger
- couple notification delivery transport into runner launch config

## Config Rule

Keep `.bagakit/agent-loop/runner.json` focused on launch mechanics.

Good uses:

- runner argv
- timeout
- host env
- explicit refresh commands

Bad uses:

- lifecycle policy
- closeout authority
- archive rules
- task or feature planning

## Review Checklist

- `runner.json` still matches the documented schema
- `run.lock` is either absent or held by a live pid
- session directories contain brief, prompt, meta, stdout, stderr, and
  runner-result artifacts together
- run records point back to typed stop reasons instead of raw runner output
- operator-required runs carry next-action intent and continuation handles
- refresh commands update normalized item state without creating hidden truth
- runner failure paths stop cleanly without mutating flow-runner truth on their
  own
- `agent_loop` still consumes flow-runner contract surfaces, not ad hoc text

## Front-Door Rule

`resume` should trust flow-runner `resume-candidates`.

That means:

- if `flow-runner next` already selects one current item, trust that first
- if exactly one live candidate exists, auto-resolve it
- if zero or multiple live candidates exist, fail closed with a typed host stop
- do not invent a second host-local current-item resolver

## Session Host Rule

The lower session host substrate should stay separately usable through
`session-run`.

It may:

- launch one bounded session
- write full session exhaust
- reduce session exhaust into read-only session status

It must not:

- repeat outer-loop orchestration
- own current or resume resolution
- own notification policy

## Watch Rule

`watch` is read-only.

Its information order should stay:

1. action banner
2. focus item
3. loop status
4. recent host history
5. detail tails

If a watch change gives logs more visual weight than next action or current
focus, reject it.

Historical notification residue must not outrank the current flow-runner
decision. Only the latest watched operator-required run may become
`current_notification`.

Likewise, a degraded watch read path must not render as `READY` or `IDLE`.
Show the host read-path issue first.

## Boundary Reminder

If a proposed `agent_loop` change starts needing:

- new item-state fields
- new checkpoint semantics
- new archive authority
- new closeout rules

the change probably belongs in `bagakit-flow-runner`, not in `dev/agent_loop`.
