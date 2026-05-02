# Loop-Off-Loop Control

Use this reference when a Goal file supports an inner execution loop observed
by an outer supervisor loop.

## Model

- Inner loop: implements or advances the task.
- Outer loop: observes evidence, detects drift, and updates the Goal or next
  instruction.
- Goal file: the steering index both loops share.

The outer loop should correct the control plane, not become a second executor.

## Supervisor Cycle

1. Re-read `current.md`, `state.yaml`, and the foreground Goal file when the
   Goal surface exists; otherwise re-read the explicit Goal file.
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

## Relationship To bagakit-loop-supervisor

If `bagakit-loop-supervisor` is available, it owns repeated supervisor packets,
drift logs, and sidecar session logs. This skill owns the Goal file that the
supervisor reads and updates.

If no supervisor skill is available, still apply the cycle manually and keep the
Goal file compact.
