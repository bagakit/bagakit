# Loop-Off-Loop Control

The inner loop executes owner tasks. The outer supervisor compares owner
evidence with the Goal Kernel and corrects drift without becoming an executor.

## Invocation Wrapper

Use these fixed host prompts. Do not rewrite them as free-form prose.

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

If supervision is added later, `current.md` recalls it. If present when the Goal
or Loop is set, include both references for stronger recovery.

## Stable Supervisor File

`supervisor.md` owns only:

- executor versus supervisor role boundary
- checkpoint cadence
- drift classes
- packet ownership and response rules
- sidecar handling
- stop, ask, and Kernel-patch boundaries

It does not own task state, packets, logs, assignments, evidence, or waits.

## Supervisor Cycle

1. Read `current.md`, `state.yaml`, the foreground Kernel, its
   `execution_owner`, and `supervisor.md` when active.
2. Read the latest owner-native task, packet, checkpoint, diff, validation,
   incident, and user decision evidence.
3. Classify alignment as `on_track`, `needs_correction`, `waiting`, `blocked`,
   or `ready_to_stop`.
4. Update the owner for current state, next action, task, wait, blocker, packet,
   or evidence changes.
5. Patch the Kernel only for final outcome, invariant, non-goal, acceptance,
   stop boundary, authority, or stable context-reference changes.
6. Append a Goal event only for Kernel, lifecycle, authority, or user-gate
   effects. Reconcile its cursor against owner evidence.
7. Continue unrelated safe work while one branch waits. Block the whole loop
   only when the waiting boundary actually gates all useful work.

## Drift Classes

- target: solving a neighboring problem
- method: continuing a poor approach without new mechanism
- scope: expansion without stronger value or authority
- evidence: claims outrunning proof
- retry: repeating the same failed move
- risk: privacy, cost, publication, or reversibility changed
- context: recovery no longer preserves why the Kernel is true

## Waiting And Blocking

Store the full decision in the execution owner:

1. If safe valuable work can advance, keep working.
2. Otherwise, if a known external event can resume work, record waiting,
   `resume_on`, and one task-specific loss line in owner state.
3. Before the loss line, do not count no-progress rounds or spend full turns
   polling.
4. After it, use bounded reassessment and task judgment. Counts are evidence,
   never an automatic block trigger.
5. Mark blocked only when no credible recovery path remains for the task.

Goal may mirror `waiting` or `blocked` only as a coarse multi-Goal scheduling
status. The owner remains truth for recovery event, counters, fallback work,
authorization state, and observation backoff.

## Supervisor Packet

Store the current packet inside the execution owner or Runner:

```toml
goal_id = "<goal-id>"
kernel_ref = ".bagakit/goal/<goal-id>.md"
owner_ref = "<execution-owner-ref>"
status = "on_track"
goal_delta = "none"
drift = []
evidence = []
owner_update = ""
kernel_patch = ""
next_action = ""
user_question = ""
```

Packets are mutable execution truth. Goal JSONL may point to one only when it
causes a Kernel, lifecycle, authority, or user-gate event.

## Evolver Review Checkpoints

Use event-bound review triggers: `before_round`, `after_round`, `risk`, `stale`,
`pre_closeout`, or opportunistic `session_end`. `stale` means expected evidence
is missing. Goal owns compact request/receipt identity; Evolver owns intake,
adoption, routing, and promotion. Send a `signal_candidate` receipt to Evolver's
session-review intake; do not create Evolver topic state from Goal.

## Relationship To bagakit-loop-supervisor

There is no separate supervisor skill until supervision owns an independent
operator and durable runtime. For now, it is a mode of
`bagakit-set-loop-goal`; `supervisor.md` is policy and the execution owner holds
live state.
