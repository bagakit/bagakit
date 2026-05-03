# Mythic Signal Desk Real Reference Run

This evidence note records a skill-quality experiment where Image2 produced a
saved design reference and the implementation preserved structured browser
evidence, but the parent screenshot review found unresolved visible blockers
after the quiet-room executor reported `strictPass`.

Failure pattern:

- reference provenance was correct: `image2_filesystem`
- browser checks and executor ledgers reported pass
- parent screenshot review still found first-viewport visual blockers:
  crowded inspector action stack, truncated rail labels, dense lower inspector
  content, and mobile/desktop parity details that should not be accepted as
  residual deltas
- the prior pass decision had to be downgraded until screenshots and ledgers
  were refreshed

Expected skill behavior:

- a named reviewer-visible blocker overrides self-reported strict pass
- `visual-bug-ledger`, `judge-aggregation`, and browser result summaries must
  not preserve pass status beside unresolved screenshot blockers
- the executor must fix, recapture, and rerun visual gates before claiming
  strict pass again
