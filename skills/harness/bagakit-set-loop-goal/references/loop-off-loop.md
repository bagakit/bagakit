# Loop-Off-Loop Control

Use this reference when a Goal file supports an inner execution loop observed
by an outer supervisor loop or by a self-supervised executor checkpoint.

## Contents

- Model
- Invocation Wrapper
- Supervisor File
- Supervisor Cycle
- Evolver Review Checkpoints
- Drift Classes
- Supervisor Packet
- Relationship To bagakit-loop-supervisor

## Model

- Inner loop: implements or advances one bounded step.
- Supervisor checkpoint: observes evidence, detects drift, and updates the Goal
  or next instruction.
- Goal surface: `current.md`, `state.yaml`, optional `supervisor.md`, and the
  foreground Goal file.
- Event surface: Goal steering events use Goal JSONL; inner execution events
  stay in the Runner, evaluator, or tool-owned stream.

The supervisor should correct the control plane, not become a second executor.

## Invocation Wrapper

When the host supports file references, the text set in the Codex Goal command,
Claude Loop command, or a comparable agent goal should reference the Goal
entrypoint directly.

Use the fixed templates below. Do not rewrite them as free-form prose. Only
change repo-relative paths when the host project uses a different Goal surface,
and only omit the supervisor block when `supervisor.md` does not exist.

With supervisor:

```text
@./.bagakit/goal/current.md
Read current.md first; it resolves state.yaml, foreground_goal, and the active Goal.

@./.bagakit/goal/supervisor.md
Read supervisor.md when present; run checkpoint rules around bounded work.

Context may be stale or wrong; recover from these files before trusting prior context.
```

Without supervisor:

```text
@./.bagakit/goal/current.md
Read current.md first; it resolves state.yaml, foreground_goal, and the active Goal.

Context may be stale or wrong; recover from this file before trusting prior context.
```

If supervision is added later, `current.md` should recall `supervisor.md`; if it
exists at Goal setup time, include both references because direct file inclusion
improves recovery.

When file references are unavailable, use the same instructions with
repo-relative paths.

## Supervisor File

Use `.bagakit/goal/supervisor.md` for shared supervision rules when
`state.yaml` sets `supervision.mode` to `self` or `external`.

Keep `supervisor.md` focused on:

- role boundary between executor and supervisor checkpoint
- checkpoint cadence
- drift classes
- packet schema
- sidecar/Grok handling
- stop, ask, and patch rules

Do not put run logs, raw sidecar output, or task details in `supervisor.md`.

## Supervisor Cycle

1. Re-read `current.md`, `state.yaml`, `supervisor.md` when present, and the
   foreground Goal file when the Goal surface exists; otherwise re-read the
   explicit Goal file.
2. Read inner-loop evidence: checkpoint, diff, validation, incident, or user
   discussion.
3. Classify whether execution is aligned, drifting, blocked, or ready to stop.
4. Distill new information into one of:
   - Goal patch
   - owner-file pointer
   - open user question
   - next inner-loop instruction
   - stop recommendation
5. Update the Goal only when the update changes execution direction or recovery.
6. Append the steering observation as a Goal control event. Reconcile the Goal
   before more execution when that event changes current state, next action,
   status, or a user gate.

## Evolver Review Checkpoints

Request an Evolver review when a bounded execution event may reveal a reusable
repository lesson:

- `before_round`: evidence or a known risk should influence the next round
- `after_round`: the round produced comparison, retry, failure, or feedback
  evidence
- `risk`: privacy, cost, publication, reversibility, or repeated failure may
  reveal a reusable control rule
- `stale`: expected checkpoint, validation, decision, or feedback evidence is
  missing
- `pre_closeout`: review reusable lessons before final Goal archive
- `session_end`: opportunistic review when session-end evidence is available

Write the request or receipt under `.bagakit/goal/reviews/`. The Goal surface
does not run a timer service and does not own Evolver topic, adoption, routing,
or promotion state. A `signal_candidate` disposition emits a deterministic next
instruction to pass the receipt path to Evolver's session-review intake.

## Drift Classes

- target drift: the work is solving the neighboring problem
- method drift: the chosen path is increasingly poor
- scope drift: the work is expanding without stronger justification
- evidence drift: claims are outrunning validation
- retry drift: the same failed move keeps repeating
- risk drift: the next move changes privacy, cost, publication, or reversibility
- context drift: a compact/restart/handoff would lose the reason behind current
  choices

## Supervisor Packet

When useful, emit a concise packet:

```toml
goal_state_file = ".bagakit/goal/state.yaml"
goal_file = ".bagakit/goal/<goal-id>.md"
foreground_goal = "<goal-id>"
status = "on_track" # on_track | needs_correction | blocked | ready_to_stop
goal_delta = "none" # none | clarify | narrow | broaden | replace
sidecar = "not_needed" # not_needed | dispatched | pending | unavailable | incorporated
drift = []
evidence = []
goal_patch = ""
next_instruction = ""
stop_rule = ""
user_question = ""
```

Rules:

- `next_instruction` is for the inner loop.
- `goal_patch` changes the Goal before further execution.
- `goal_delta = "replace"` requires user confirmation unless the user already
  delegated the change.
- `blocked` names the missing evidence or decision.
- `ready_to_stop` names acceptance evidence.
- Store repeated packets as JSONL control events, not appended Markdown in
  `supervisor.md`. Keep raw execution telemetry in the execution owner.

## Relationship To bagakit-loop-supervisor

There should not be a separate `bagakit-loop-supervisor` skill until supervision
has an independent operator that owns durable packet logs, drift logs, sidecar
sessions, and runner integration. Until then, supervision is a mode of
`bagakit-set-loop-goal`, with `supervisor.md` as the optional contract file.
