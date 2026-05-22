# Goal File Contract

Use this reference when creating, upgrading, compressing, or reviewing a Goal.

## Quality Bar

A high-quality Goal is a staleness-safe execution control brief. It lets a fresh
executor recover the promised destination and the rules for reaching it, then
find current execution truth in exactly one owner.

Apply this admission question to every proposed Kernel statement:

> Would normal successful execution make this statement false?

If yes, keep it out of the Goal Markdown. Put it in the execution owner or
another native Spec, Plan, Research, Runner, or decision surface.

The Goal is not a current-state snapshot, plan, backlog, transcript, evidence
store, supervisor log, or fixed team roster.

## Placement And Version

The default private runtime surface is:

- `.bagakit/goal/current.md`
- `.bagakit/goal/state.yaml`
- `.bagakit/goal/<goal-id>.md`
- `.bagakit/goal/supervisor.md` when supervision is active
- `.bagakit/goal/events/<goal-id>.jsonl`
- `.bagakit/goal/reviews/<review-id>.json`
- temporary `.bagakit/goal/upgrade.json`
- `.bagakit/goal/archive/`

Projects may ignore `.bagakit/goal/`; commit only Goals intentionally shared as
project control surfaces. Materialized top-level runtime surfaces still require
`surface.toml`. Durable text uses repo-relative refs, never machine-local paths.

The current protocol is `bagakit.goal.v.0.3`. Record it in `surface.toml`,
`state.yaml`, and every Goal frontmatter. Missing, older, or incomplete surfaces
must be upgraded before execution. Never downgrade a future protocol.

## Recovery Chain

Recovery order is fixed:

```text
current.md
-> state.yaml
-> foreground Goal Kernel
-> execution_owner
-> current owner task, runner receipt, or verification evidence
```

`current.md` is generated and short:

```markdown
# Current Goal

Read `.bagakit/goal/state.yaml`, resolve `foreground_goal`, then read that Goal
Kernel and its `execution_owner` before acting. Read current task, next action,
blockers, waits, and evidence from that owner rather than from the Goal file.

If `.bagakit/goal/supervisor.md` exists, read it before execution and run its
checkpoint rules.

Context may be stale or wrong; recover from these files before trusting prior context.
```

## State Registry

`state.yaml` is the machine-readable foreground, topology, lifecycle cache,
owner pointer, and Goal-event cursor:

```yaml
schema: bagakit.goal-state.v1
protocol_version: bagakit.goal.v.0.3
foreground_goal: <goal-id>

supervision:
  mode: self # off | self | external
  contract: .bagakit/goal/supervisor.md
  checkpoint: before_action_and_after_round

goals:
  <goal-id>:
    file: .bagakit/goal/<goal-id>.md
    status: active
    role: foreground
    execution_owner:
      kind: bagakit-feature-tracker
      ref: .bagakit/feature-tracker/features/<feature-id>
    event_log: .bagakit/goal/events/<goal-id>.jsonl
    reconciled_through: 1

edges: []
archive:
  dir: .bagakit/goal/archive
```

Rules:

- Keep exactly one foreground Goal; keep any number of incomplete backlog Goals.
- Every unarchived Goal has exactly one existing, repo-relative
  `execution_owner`; the Goal frontmatter is authoritative and the registry
  mirrors it.
- A new Goal does not abandon the previous one. Pause, wait, block, or review it
  according to actual scheduling intent.
- Edges such as `depends_on`, `blocks`, `interrupts`, `resumes_after`, or
  `supersedes` describe scheduling and recovery, not permission to execute two
  foreground Goals concurrently.
- Archive `complete` and explicitly `abandoned` Goals and remove them from the
  active registry.

## Execution Owner

Reuse one compatible owner when it already represents current execution truth:

- accepted Spec or equivalent lifecycle surface
- Bagakit Feature Tracker feature
- another project-native owner with task, state, and evidence semantics

If none exists, create a Feature with `bagakit-feature-tracker`. Use
`bagakit-flow-runner` beneath that owner when repeated bounded rounds are needed.
Do not vendor either skill's state model into Goal.

Dynamic ownership mapping:

| Dynamic truth | Owner location |
| --- | --- |
| current state and current task | Feature `state.json` / `tasks.json` or equivalent |
| next execution instruction | current task or Flow Runner receipt |
| recent decisions | proposal, spec delta, Spec, or Consensus Ledger |
| open questions | owner task, Grill, proposal, or Consensus Ledger |
| blockers, waits, loss lines, no-progress counts | owner task lifecycle and runtime receipt |
| HEAD, release, authorization, environment state | verification or runtime receipt |
| current supervisor packet | execution owner packet or checkpoint receipt |
| execution evidence | task gates, `verification.md`, Runner, or evaluator |

Goal may mirror only the coarse lifecycle status needed to schedule multiple
Goals. It must not duplicate the owner's mutable details.

## Goal Kernel

Frontmatter:

```yaml
---
schema: bagakit.loop-goal.v1
protocol_version: bagakit.goal.v.0.3
goal_id: <goal-id>
status: active
truth_surface: .bagakit/goal/<goal-id>.md
execution_owner:
  kind: bagakit-feature-tracker
  ref: .bagakit/feature-tracker/features/<feature-id>
completion_evidence: []
---
```

Kernel template:

```markdown
# Goal: <short name>

## Prime Directive
<final outcome and why it is important>

## Protected Invariants
- <principle or constraint that stays true throughout execution>
- Non-goals: <neighboring outcomes that must not replace the target>

## Acceptance And Stop Rules
- Acceptance: <observable end-state evidence>
- Insufficient: <plausible partial results that do not count>
- Stop and ask when: <authority, risk, cost, privacy, or irreversible boundary>
- Stop as complete when: <completion evidence contract>

## Authority And Orchestration
- Resolve the exact execution owner from frontmatter; `state.yaml` mirrors it
  for registry recovery.
- <durable delegation, parallelism, review, merge, and evidence principles>
- <who may change outcome, scope, acceptance, or irreversible state>

## Context References
- `<ref>`: explains <invariant or rationale>; read when <specific condition>.
```

The compact multi-agent brief pattern is structural, not a word-count target:

- state the exact outcome
- name plausible results that are still insufficient
- define adaptive search or execution heuristics
- require concrete outputs and evidence
- require adversarial or independent audit where risk warrants it
- define the return or stopping condition

Do not hard-code a worker count or fixed role allocation into Goal unless it is
a true external constraint. Live approach registries, team assignments, and
resource use belong in the owner.

## Context References

Context References preserve stable material that explains why the Kernel is
true without becoming current execution truth. Each entry contains only:

- a repo-relative path or stable id
- what invariant or rationale it explains
- the condition under which the executor should read it

Do not copy long summaries, runtime status, or evidence into this section.

## Kernel Gaps And Grill

Use `inspect-upgrade` or the upsert requirements as the decision tool.

- Repair generated files, protocol metadata, empty optional Context References,
  and other deterministic shape gaps directly.
- Inspect code, owner state, and local docs before asking questions.
- If final outcome, importance, invariant, non-goal, acceptance, insufficiency,
  stop boundary, owner choice, or authority remains ambiguous, preserve a
  concrete conflict packet and use `bagakit-grill`.
- Ask one decision-bearing question at a time. Do not use Grill merely to fill
  formatting or restate evidence already available locally.

## Lifecycle

Allowed statuses are `draft`, `active`, `waiting`, `paused`, `blocked`,
`ready_for_review`, `complete`, and `abandoned`.

- `waiting` and `blocked` are coarse Goal scheduling states only. Recovery
  event, loss line, reassessment count, blocker detail, and fallback work live
  in the execution owner.
- `complete` requires concise repo-relative `completion_evidence`.
- Do not add a second completion boolean.
- Archive complete or abandoned Goals. Update `truth_surface` to the archive
  path.
- Validate the replacement foreground before mutation, then publish the Goal,
  event stream, registry, entrypoint, and replacement update as one serialized
  file transaction. Failed or competing archive requests must not expose a
  partial lifecycle state.

## Goal Wrapper

Use these fixed host prompts. Only paths and supervisor presence may vary.

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

## Fresh-Executor Check

A fresh executor must be able to:

1. state the final outcome, importance, invariants, non-goals, and acceptance
2. distinguish completion from plausible but insufficient partial progress
3. identify authority, escalation, and adaptive orchestration rules
4. resolve exactly one execution owner
5. find current task, blockers, waits, packets, and evidence in that owner

If prior chat would materially change these answers, the Kernel or owner is
incomplete.

## Alignment Recap

After nontrivial creation or direction-changing updates, explain in plain
language:

- the outcome and why it matters
- invariants, non-goals, acceptance, and insufficiency boundaries
- the execution owner and execution mode
- assumptions or risks that could change direction
- only the points where user correction would change execution

Generate this recap from Kernel plus owner evidence. It is transient, not a
second source of truth. Write user corrections back to the Kernel or owner and
rerun the fresh-executor check.

## Driver Feedback

Render Driver output from explicit owner evidence:

```text
[[BAGAKIT]]
- Goal: ID=<goal-id>; Status=<transition>; Event=<event>; Progress=<owner gates or unknown>; Drift=<summary>; Budget=<assessment or unknown>; Discovery=<material discovery or none>; Evidence=<owner refs>; Next=<owner action>
```

Never infer progress from mutable checkboxes in the Kernel. Report `unknown`
when owner evidence has no denominator, time baseline, or token budget. Use the
shared Bagakit Alert aggregate for decision-bearing exceptions.
