# Adaptive Session Continuity

## Owns

- Keep one declared primary human-action surface across multi-turn HITL work.
- Carry attempts to the Agent and return feedback, repaired tasks, evidence
  projections, and next actions to the page.
- Make projection version, pending work, stale state, conflict, and fallback
  status visible without exposing transport internals.

## Does Not Own

- Learning feedback, rubric decisions, mastery evidence, or task selection.
- Backend architecture, polling frequency, browser storage APIs, or host
  process supervision.

## Continuity Routes

Choose one route before implementation:

- `local_exchange`
  - the page and Agent exchange packets through a host-local endpoint or owned
    inbox
- `manual_round_trip`
  - the human exports an attempt packet and imports one Agent projection packet
- `page_reprojection`
  - the Agent produces a new versioned page projection that merges local draft
    and attempt history on reload

Prefer `manual_round_trip` or `page_reprojection` for a static or occasional
course. Use `local_exchange` only when the host already provides an owned
exchange surface or when one-step submission materially improves a repeated
workflow. Do not add accounts, a database, push infrastructure, or a generic
course service only to satisfy continuity.

Chat may notify the human that feedback is ready or explain a fallback. It must
not become the hidden primary task UI when the selected route is a built page.

## Design Checks

- The page names the current task, feedback projection, and stable next action.
- The handoff preserves page id, manifest ref, and projection target so a later
  Agent can find the original page.
- A submitted attempt has an explicit waiting or delivery state.
- The page can apply a newer projection without erasing drafts, attempts, or
  contextual questions.
- Stale and conflicting projections are visible and recoverable.
- The human never has to guess whether refreshing will load Agent feedback.
- A transport failure preserves one canonical export packet and a clear import
  or retry path.

## Outputs Or Evidence

- Declared primary surface and continuity route.
- Versioned feedback projection with last-applied event ref and sync state.
- Browser evidence for one complete adaptive round trip.

## Failure Signals

- The page captures only the first attempt while all feedback and later tasks
  move into chat.
- Browser checks stop before Agent feedback returns to the page.
- Local page state and Agent course state advance independently with no stale
  projection warning.
- The user is told to refresh even though the page has no new projection to
  load.
