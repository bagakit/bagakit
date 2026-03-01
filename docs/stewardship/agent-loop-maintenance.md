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

`agent_loop` must not:

- redefine current-item selection in host-local caches
- scrape runner stdout as execution truth
- archive tracker-sourced items
- decide feature closeout
- introduce a second hidden progress ledger

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
- refresh commands update normalized item state without creating hidden truth
- `agent_loop` still consumes flow-runner contract surfaces, not ad hoc text

## Boundary Reminder

If a proposed `agent_loop` change starts needing:

- new item-state fields
- new checkpoint semantics
- new archive authority
- new closeout rules

the change probably belongs in `bagakit-flow-runner`, not in `dev/agent_loop`.
