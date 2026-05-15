# Goal File Contract

Use this reference when creating, rewriting, compressing, or reviewing a Goal
file.

## Contents

- Quality Bar
- Placement
- Protocol Version
- Goal Surface State
- Event Streams And Reconciliation
- Evolver Review Receipts
- Supervisor Contract
- Frontmatter Lifecycle
- Goal Wrapper
- Minimum Structure
- What Belongs In The Goal
- What Belongs Elsewhere
- Fresh-Executor Check
- Alignment Recap

## Quality Bar

A high-quality Goal file lets a fresh executor continue after restart, compact,
or handoff without reading the whole prior chat. It explains:

- what outcome must be achieved
- why the outcome matters and what principles protect it
- what is already known, done, blocked, or deliberately out of scope
- where detailed truth lives
- how to schedule the next execution round
- how to know when to stop, ask, or correct drift

The Goal file is a steering index. It is not a full task plan, changelog,
research notebook, transcript, or backlog.

## Placement

Default durable placement is the target project's local Goal surface:

- `.bagakit/goal/<goal-id>.md`
- `.bagakit/goal/current.md`
- `.bagakit/goal/state.yaml`
- `.bagakit/goal/supervisor.md` when supervision is active
- `.bagakit/goal/events/<goal-id>.jsonl` for append-only Goal control events
- `.bagakit/goal/reviews/<review-id>.json` for event-bound Evolver review
  request/receipt records
- `.bagakit/goal/upgrade.json` only while a protocol upgrade is blocked
- `.bagakit/goal/archive/`

This path is relative to the project or host repository whose agent will execute
the work. Do not place durable Goal files inside the installed skill directory,
global skills directory, or another repository unless the user explicitly asks.

`.bagakit/goal/` is runtime/control-plane material. A project may ignore the
directory when Goals are private execution state; commit only the Goal files the
team intentionally wants to share as project control surfaces.

If `.bagakit/goal/` is materialized as a Bagakit runtime surface, it should carry
`surface.toml` according to the host's runtime-surface contract.

Accepted temporary placement:

- a pasted text-file reference such as
  `pasted text file: <path>. Read this file before continuing.`
- a user-supplied path when the user explicitly wants that path

Use repo-relative paths or logical ids. Do not write machine-local absolute
paths into durable Goal files.

## Protocol Version

The current Goal protocol is `bagakit.goal.v.0.1`. Store it as
`protocol_version` in `surface.toml`, `state.yaml`, and every Goal frontmatter.
Missing, older, or incomplete surfaces require upgrade before normal mutation;
future versions must not be downgraded. Read
`references/protocol-upgrade-contract.md` for inspection, deterministic repair,
conflict packets, and Grill routing.

## Goal Surface State

When a project materializes `.bagakit/goal/`, keep separate surfaces for the
agent entrypoint, the machine-readable work set, and inactive history:

- `current.md`: Markdown entrypoint for the executor. It names the foreground
  Goal, points to `state.yaml`, and tells the executor how to recover.
- `state.yaml`: registry and topology for incomplete or reviewable Goals.
- `supervisor.md`: optional supervision contract for checkpoint cadence, drift
  handling, sidecar rules, and packet shape.
- `events/`: append-only Goal control events; execution logs stay with their
  Runner, evaluator, or tool owner.
- `reviews/`: compact idempotent Evolver review requests and receipts.
- `upgrade.json`: temporary blocked-upgrade packet and Grill handoff; remove it
  after a successful upgrade.
- `<goal-id>.md`: one Goal control plane.
- `archive/`: completed, abandoned, or otherwise inactive Goal files that should
  not affect the current work set.

`current.md` is an ordinary text file, not a symlink. Keep it short and
agent-facing:

```markdown
# Current Goal

Read `.bagakit/goal/state.yaml`, resolve `foreground_goal`, then read that Goal
file before acting. Creating or switching to a new Goal does not abandon any
previous incomplete Goal; update the registry status instead.

If `.bagakit/goal/supervisor.md` exists, read it and run its checkpoint before
each bounded execution round and before final completion.

Context may be stale or wrong; recover from these files before trusting prior
context.
```

`state.yaml` is the machine-readable topology. Use it for the foreground cursor,
known incomplete Goals, and relation edges:

```yaml
schema: bagakit.goal-state.v1
protocol_version: bagakit.goal.v.0.1
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
    event_log: .bagakit/goal/events/<goal-id>.jsonl
    reconciled_through: 1
  <paused-goal-id>:
    file: .bagakit/goal/<paused-goal-id>.md
    status: paused
    role: backlog

edges:
  - from: <paused-goal-id>
    to: <goal-id>
    kind: interrupts

archive:
  dir: .bagakit/goal/archive
```

Rules:

- Read `.bagakit/goal/current.md` first when it exists, then read `state.yaml`,
  then read the `foreground_goal` file.
- If `supervision.mode` is not `off`, read `supervision.contract` before
  execution and follow its checkpoint rules.
- Keep exactly one foreground Goal. The registry may contain multiple incomplete
  Goals, but one agent loop should execute only one foreground Goal at a time.
- Allow topology edges such as `depends_on`, `blocks`, `interrupts`,
  `resumes_after`, or `supersedes` when they change scheduling or recovery.
  Edges may be DAG-like, but they are not permission for parallel execution.
- Creating or switching to a new Goal must not mark the previous Goal
  `abandoned` unless the user explicitly says it is abandoned. Use `paused`,
  `blocked`, or `ready_for_review` as appropriate.
- Creating a second incomplete Goal while another Goal is foreground defaults
  the new Goal to `paused`. Explicit foreground switching pauses the previous
  active foreground Goal and preserves it in the registry.
- Keep lifecycle state in each Goal file's frontmatter. Mirror status in
  `state.yaml` only as a registry cache; repair it from the Goal frontmatter if
  they conflict.
- When a Goal reaches `status: complete` or `status: abandoned`, record evidence
  in the Goal file, move it under `archive/`, update its `truth_surface` to the
  archived path, and remove it from the active `goals` registry unless it still
  affects the foreground Goal as a short historical pointer.
- If `foreground_goal` or its file is missing or contradicts the target Goal's
  frontmatter, repair the state before execution or stop and ask.

## Event Streams And Reconciliation

Keep the Goal Markdown as current control truth. Store append-only Goal control
events in `.bagakit/goal/events/<goal-id>.jsonl`; store execution rounds,
retries, process output, case progress, and validation logs in the owning
Runner, evaluator, or tool surface.

Do not require normal recovery to replay JSONL. Reconcile after a material
milestone, before compact or handoff, when current instructions conflict with
newer evidence, or when checkpoint history starts accumulating:

1. read owner truth and unreconciled Goal events
2. replace `Current State`
3. replace the single `Next Execution Instruction`
4. fold accepted deltas into their owning Goal sections
5. keep only future-relevant `Recent Decisions`
6. remove resolved questions and stale directions
7. advance the registry `reconciled_through` cursor

Read `references/event-stream-contract.md` for format ownership, the JSONL
schema, control effects, cursor behavior, and archive rules.

## Evolver Review Receipts

Use `.bagakit/goal/reviews/<review-id>.json` when a bounded Goal checkpoint may
contain reusable repository learning. The caller supplies a stable `review_id`;
requesting the same id for the same Goal and trigger is idempotent and must not
reset a completed receipt. Exact request replay is allowed; a different request
payload under the same id is rejected and must use a new review id.

```json
{
  "schema": "bagakit.goal-evolver-review.v1",
  "goal_id": "<goal-id>",
  "review_id": "<review-id>",
  "trigger": "after_round",
  "status": "requested",
  "evidence_refs": [".bagakit/flow-runner/runs/<run-id>/checkpoint.json"],
  "drift": [],
  "next_instruction": "Run an Evolver review over the referenced evidence and record the disposition.",
  "approval": "not_required",
  "evolver_disposition": "pending"
}
```

Contract:

- `trigger`: `before_round`, `after_round`, `risk`, `stale`, `pre_closeout`, or
  `session_end`.
- `status`: `requested`, `completed`, `blocked`, or `skipped`.
- `approval`: `not_required`, `pending`, `approved`, or `rejected`. This field
  records the applicable gate; it does not grant new permission to read private
  session evidence.
- `evolver_disposition`: `pending`, `no_signal`, `signal_candidate`, or
  `deferred`.
- State pairs are fixed: `requested/pending`, `completed/no_signal`,
  `completed/signal_candidate`, `blocked/deferred`, or `skipped/no_signal`.
  `signal_candidate` also requires `approval` to be `not_required` or
  `approved`.
- `evidence_refs` contains repo-relative source or result references. Raw
  transcript content does not belong in this receipt. Absolute paths and refs
  that escape the repository root are invalid.
- `drift` contains compact observed drift or the expected evidence missing at a
  `stale` checkpoint.
- `next_instruction` is the next Goal-side action, not Evolver topic or routing
  state.
- A `signal_candidate` receipt hands the repo-relative receipt path to
  Evolver's session-review intake. Goal must not create or update Evolver
  topics, adoption, route, or promotion state.
- Once a receipt leaves `requested`, the same `review_id` is immutable. A
  materially different outcome or evidence packet requires a new review id.

Review scheduling is event-bound. Do not add a daemon or timer service merely
to generate review files. `session_end` is opportunistic only; failure to run
it must not invalidate otherwise complete Goal evidence. `stale` means expected
evidence is absent, not that wall-clock time alone elapsed.

## Supervisor Contract

Use `.bagakit/goal/supervisor.md` when the Goal needs self-supervision or a
separate outer loop. This file is a reusable supervision contract, not a log and
not a second Goal schema.

Template:

````markdown
# Goal Supervisor

## Role Boundary
- Inner loop: execute one bounded step toward the foreground Goal.
- Supervisor checkpoint: observe evidence, detect drift, and update the Goal or
  next instruction before more implementation.
- Do not become a second executor.

## Checkpoint Cadence
- Run before each bounded execution round.
- Run after each bounded execution round.
- Run before claiming `status: complete`.

## Drift Classes
- target drift
- method drift
- scope drift
- evidence drift
- retry drift
- risk drift
- context drift

## Packet
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

## Evolver Review Checkpoints
- Use event-bound review triggers: `before_round`, `after_round`, `risk`,
  `stale`, `pre_closeout`, or opportunistic `session_end`.
- `stale` means expected evidence is missing; do not add a timer or daemon.
- Store request/receipt state under `.bagakit/goal/reviews/`; Goal does not own
  Evolver topic, adoption, routing, or promotion state.

## Rules
- Patch the Goal only when new information changes execution direction or
  recovery.
- Ask before changing the promised outcome, dropping a requirement, or taking
  irreversible, privacy-sensitive, publication, or cost-bearing action.
- Distill sidecar output into a Goal delta, risk, non-goal, acceptance
  criterion, open question, or owner-file pointer.
````

## Frontmatter Lifecycle

Every durable Goal file should start with machine-readable frontmatter. Use one
status field as the lifecycle source of truth.

```yaml
---
schema: bagakit.loop-goal.v1
protocol_version: bagakit.goal.v.0.1
goal_id: <goal-id>
status: draft # draft | active | paused | blocked | ready_for_review | complete | abandoned
truth_surface: .bagakit/goal/<goal-id>.md
completion_evidence: []
---
```

Status meanings:

- `draft`: the Goal is being shaped and should not drive execution yet.
- `active`: execution should continue.
- `paused`: the Goal is intentionally not foreground but may be resumed.
- `blocked`: execution needs a user decision, missing evidence, or unavailable
  tooling.
- `ready_for_review`: acceptance likely holds, but review or user confirmation
  is still needed.
- `complete`: acceptance and stop rules have been met.
- `abandoned`: the Goal was deliberately stopped without completion.

Do not add a separate `complete: true` field; it can conflict with `status`.
When the Goal is complete, set `status: complete` and add concise
`completion_evidence` using repo-relative refs, command names, or observable
results. Do not add timestamps, usernames, hostnames, or absolute paths unless
the user explicitly requires them for a private runtime file.

If the Goal is archived, update `truth_surface` to the archived path, usually
`.bagakit/goal/archive/<goal-id>.md`.

## Goal Wrapper

When the user asks for "a paragraph to set as Goal", write a short wrapper that
points at the Goal file instead of pasting the full control plane into chat.
If `.bagakit/goal/current.md` exists, point the wrapper there first so the
executor can resolve `state.yaml` and the foreground Goal before reading the
Goal file. If `.bagakit/goal/supervisor.md` exists at creation time, include it
as a second file reference in the wrapper; `current.md` should still recall it
later if supervision is added after the initial Goal is set.

The wrapper should:

- state that the agent must read the Goal file before continuing
- explain the importance of the goal and why completion matters
- tell the agent to use CodexL for each concrete execution action when that is
  the user's desired execution model
- keep logical supervision with the current agent: inspect context, judge the
  result, update the Goal when needed, and decide the next iteration
- allow arbitrarily many execution iterations until the task is genuinely
  complete
- require context recovery after restart, compact, or handoff
- require the agent to set frontmatter `status: complete` and record
  `completion_evidence` before claiming final completion
- point to the Goal file as the control plane

For the Codex Goal command, Claude Loop command, or any host that supports file
references, use one of these fixed templates instead of improvising prose. Only
the file paths and the presence of the `supervisor.md` block may vary; keep the
one-sentence file guidance and stale-context warning intact.

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

Template:

```text
Read `<current-file-or-goal-file>` before continuing and treat it as the
execution control plane for this task. If this is `.bagakit/goal/current.md`,
read `.bagakit/goal/state.yaml`, resolve `foreground_goal`, and read that Goal
file before acting. If `.bagakit/goal/supervisor.md` is referenced or exists,
read it before execution and run its checkpoint rules around each bounded work
round.

Your job is to complete the objective described in that Goal file, not merely
make one attempt. For every concrete execution action, dispatch the work through
CodexL when available, while you retain responsibility for reading context,
checking the code, judging progress, updating the Goal when direction-changing
facts appear, and choosing the next iteration. Continue through as many
iterations as needed until the Goal's acceptance and stop rules say the task is
genuinely complete. After restart, compact, or handoff, recover state from the
Goal file and its indexed owner files before acting. Before reporting final
completion, update the Goal frontmatter to `status: complete`, add concise
`completion_evidence`, and archive the Goal so it no longer interferes with the
active work set. If the work is paused, blocked, needs review, or is abandoned,
write that status instead of claiming completion.
```

## Minimum Structure

Use this spine unless the host already has a compatible format:

Current entrypoint:

```markdown
# Current Goal

Read `.bagakit/goal/state.yaml`, resolve `foreground_goal`, then read that Goal
file before acting. If `.bagakit/goal/supervisor.md` exists, read it before
execution and run its checkpoint rules.

Context may be stale or wrong; recover from these files before trusting prior
context.
```

State file:

```yaml
schema: bagakit.goal-state.v1
protocol_version: bagakit.goal.v.0.1
foreground_goal: <goal-id>

supervision:
  mode: off
  contract: .bagakit/goal/supervisor.md
  checkpoint: before_action_and_after_round

goals:
  <goal-id>:
    file: .bagakit/goal/<goal-id>.md
    status: active
    role: foreground
    event_log: .bagakit/goal/events/<goal-id>.jsonl
    reconciled_through: 1

edges: []

archive:
  dir: .bagakit/goal/archive
```

Supervisor file when `supervision.mode` is not `off`:

```markdown
# Goal Supervisor

Run a checkpoint before and after each bounded execution round. Classify
alignment as `on_track`, `needs_correction`, `blocked`, or `ready_to_stop`.
Patch the Goal only when new information changes direction or recovery.
```

Goal file:

```markdown
---
schema: bagakit.loop-goal.v1
protocol_version: bagakit.goal.v.0.1
goal_id: <goal-id>
status: active
truth_surface: .bagakit/goal/<goal-id>.md
completion_evidence: []
---

# Goal: <short name>

## Prime Directive
<one paragraph stating the final outcome and why it matters>

## Current State
- Last known progress: <compact factual state>
- Active branch: <what the executor should currently optimize for>
- Blockers: <none or decision/evidence/tooling gap>

## Execution Principles
- <principle that should shape choices>
- <constraint or invariant that must not be violated>
- Non-goals: <what not to do>

## Acceptance And Stop Rules
- Acceptance: <observable evidence required>
- Stop and ask when: <user decision, irreversible action, privacy/cost risk>
- Stop as complete when: <completion evidence>

## Orchestration Index
- Specs: <OpenSpec/spec refs or none>
- Plans: <Plan on Fire/plan refs or none>
- Brainstorm: <brainstorm refs or none>
- Feature truth: <feature tracker refs or none>
- Runner truth: <flow runner/session refs or none>
- Research/evidence: <research refs or none>
- Supervisor/sidecar: <supervisor packet, Grok sidecar, or pending refs>

## Next Execution Instruction
<one concrete next instruction for the executor>

## Recent Decisions
- <only a few accepted decisions that still affect future execution>

## Open Questions
- <question, owner, and what changes based on the answer>
```

## What Belongs In The Goal

Write into the Goal when information changes execution direction or recovery:

- final objective and success bar
- execution principle or invariant
- hard constraint, non-goal, privacy/cost/publication/reversibility gate
- acceptance criterion, evidence standard, or stop rule
- current execution state and next instruction
- compact risk, blocker, or open question
- pointer to owning feature, plan, spec, research, runner, handoff, or sidecar
- accepted Goal delta from user discussion or supervisor review

## What Belongs Elsewhere

Do not turn the Goal into a storage bin.

| Content | Owner |
| --- | --- |
| feature scope, task breakdown, lifecycle state | Feature Tracker or feature file |
| implementation steps and technical plan | Plan, handoff, or runner item |
| formal requirements and change lifecycle | OpenSpec or equivalent spec tool |
| raw discussion, options, expert review | Brainstorm |
| source notes, claims, evidence | Researcher or evidence files |
| repeated execution checkpoints, incidents, retry history | Flow Runner or owner JSONL/session state |
| append-only steering events and reconciliation history | Goal JSONL event stream |
| raw Grok/sidecar output | sidecar log; Goal keeps distilled delta or pointer |
| supervisor protocol and checkpoint cadence | `.bagakit/goal/supervisor.md` |
| Evolver signals, topics, adoption, routing, promotion | `bagakit-skill-evolver`; Goal keeps only the review request/receipt |
| completed or abandoned Goal history | `.bagakit/goal/archive/` |

When unsure, add a one-line pointer in the Goal and put the detail in the owner
surface.

## Fresh-Executor Check

Before handing off, ask:

1. Can a new executor state the final objective in one paragraph?
2. Can the executor explain the principles behind the target, not just the todo
   list?
3. Can the executor find detailed specs, plans, research, feature state, and
   runner state from the Goal?
4. Can the executor identify the next action and the stop condition?
5. Would adding the prior chat materially change the executor's next move?

If answer 5 is yes, the Goal is missing key control-plane information.

## Alignment Recap

After nontrivial Goal creation or a direction-changing Goal update, give the
user a short plain-language recap before activation or continued execution. This
recap proves user-agent agreement, not executor recovery.

Include only decision-bearing points:

- Goal: <what outcome the Goal is steering toward>
- Why it matters: <why this outcome is worth completing>
- Scope: <in scope and out of scope>
- Execution mode: <current/state/supervisor, CodexL, Team mode, sidecar, or
  owner tools when relevant>
- Risks or assumptions: <what could change the Goal, acceptance bar, or next
  move>
- Please correct: <only the points where a user answer changes execution>

Rules:

- Generate the recap from the Goal and indexed owner refs.
- Do not store the recap as a second source of truth.
- Distill user corrections into Goal deltas, owner-file updates, or open
  questions before activation.
- If the correction changes the promised outcome, acceptance bar, or execution
  mode, update the Goal and run the fresh-executor check again.
- For tiny mechanical updates where the user already delegated execution, the
  recap may be informational and need not block progress.

## Event-Driven Driver Feedback

Use the Goal Driver as a read-only feedback tool after owner truth has been
updated. The fixed summary shape is:

```text
[[BAGAKIT]]
- Goal: ID=<goal-id>; Status=<previous→current or current>; Event=<latest material event>; Progress=<passed gates/total gates or unknown>; Drift=<none or summary>; Budget=<time/token assessment or unknown>; Discovery=<decision-bearing discovery or none>; Evidence=<refs>; Next=<one deterministic action>
```

Run the full report after:

- restart, compact recovery, or execution handoff
- a bounded execution round or material milestone
- status, foreground, acceptance, or next-action changes
- drift, blocking, retry backoff, or budget risk
- a discovery that changes scope, risk, acceptance, or orchestration
- pre-closeout and completion

For every new user input, assess drift internally. Do not emit another full
report unless the input creates a Goal delta, an alert candidate, or a material
checkpoint. This keeps the reinforcement loop active without turning the
conversation into a log stream.

Progress and resource rules:

- prefer checked acceptance gates and explicit counts over guessed percentages
- report `unknown` when no denominator, timer baseline, token counter, or token
  budget exists
- surface discoveries only when they can change the Goal or next execution move
- generate the report from Goal and indexed owner evidence; never write the
  rendered footer back into the Goal

Use the shared Bagakit alert aggregate for decision-bearing exceptions:

```text
- 👩🏻‍🚒 ALERTS !! P1[Goal/<id>] Signal=<what changed>; Impact=<why it matters>; Response=<one corrective action>; Evidence=<refs>
```

Goal contributes alert candidates for protocol incompatibility, unreconciled
truth, blocking, material drift, and budget risk. It must not create a separate
Goal Alert section. Run `driver-report` to render the projection or obtain its
structured JSON form.
