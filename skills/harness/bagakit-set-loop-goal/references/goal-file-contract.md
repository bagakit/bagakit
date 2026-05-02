# Goal File Contract

Use this reference when creating, rewriting, compressing, or reviewing a Goal
file.

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

## Goal Surface State

When a project materializes `.bagakit/goal/`, keep separate surfaces for the
agent entrypoint, the machine-readable work set, and inactive history:

- `current.md`: Markdown entrypoint for the executor. It names the foreground
  Goal, points to `state.yaml`, and tells the executor how to recover.
- `state.yaml`: registry and topology for incomplete or reviewable Goals.
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
```

`state.yaml` is the machine-readable topology. Use it for the foreground cursor,
known incomplete Goals, and relation edges:

```yaml
schema: bagakit.goal-state.v1
foreground_goal: <goal-id>

goals:
  <goal-id>:
    file: .bagakit/goal/<goal-id>.md
    status: active
    role: foreground
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
- Keep exactly one foreground Goal. The registry may contain multiple incomplete
  Goals, but one agent loop should execute only one foreground Goal at a time.
- Allow topology edges such as `depends_on`, `blocks`, `interrupts`,
  `resumes_after`, or `supersedes` when they change scheduling or recovery.
  Edges may be DAG-like, but they are not permission for parallel execution.
- Creating or switching to a new Goal must not mark the previous Goal
  `abandoned` unless the user explicitly says it is abandoned. Use `paused`,
  `blocked`, or `ready_for_review` as appropriate.
- Keep lifecycle state in each Goal file's frontmatter. Mirror status in
  `state.yaml` only as a registry cache; repair it from the Goal frontmatter if
  they conflict.
- When a Goal reaches `status: complete` or `status: abandoned`, record evidence
  in the Goal file, move it under `archive/`, update its `truth_surface` to the
  archived path, and remove it from the active `goals` registry unless it still
  affects the foreground Goal as a short historical pointer.
- If `foreground_goal` or its file is missing or contradicts the target Goal's
  frontmatter, repair the state before execution or stop and ask.

## Frontmatter Lifecycle

Every durable Goal file should start with machine-readable frontmatter. Use one
status field as the lifecycle source of truth.

```yaml
---
schema: bagakit.loop-goal.v1
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
Goal file.

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

Template:

```text
Read `<current-file-or-goal-file>` before continuing and treat it as the
execution control plane for this task. If this is `.bagakit/goal/current.md`,
read `.bagakit/goal/state.yaml`, resolve `foreground_goal`, and read that Goal
file before acting.

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
file before acting.
```

State file:

```yaml
schema: bagakit.goal-state.v1
foreground_goal: <goal-id>

goals:
  <goal-id>:
    file: .bagakit/goal/<goal-id>.md
    status: active
    role: foreground

edges: []

archive:
  dir: .bagakit/goal/archive
```

Goal file:

```markdown
---
schema: bagakit.loop-goal.v1
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

## Goal Delta Log
- <accepted delta, source, and why it changes execution>

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
| repeated execution checkpoints, incidents, retry history | Flow Runner or session logs |
| raw Grok/sidecar output | sidecar log; Goal keeps distilled delta or pointer |
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
