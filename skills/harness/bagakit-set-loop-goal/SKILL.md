---
name: bagakit-set-loop-goal
description: Create or update a high-quality Goal file that can be set as an agent's goal for long-running work. Use when a task needs restart, compact, handoff, loop supervision, sidecar analysis, or execution control through a compact steering index rather than a chat transcript, full plan, or log bucket.
metadata:
  bagakit:
    harness_layer: l1-execution
---

# Bagakit Set Loop Goal

Create a Goal file that works as an execution steering index. The file must let
a fresh executor recover the objective, current state, principles, acceptance
bar, orchestration surfaces, and next move after restart, compact, or handoff.

Core contract:

- Treat the Goal file as a control plane, not a notebook, task tracker, spec,
  research log, or full plan.
- Preserve only direction-changing context: final objective, execution
  principles, constraints, acceptance criteria, current state, key refs, next
  strategy, stop rules, risks, and open questions.
- Route detailed work into the owning Feature, Plan, Spec, Research, Runner, or
  Handoff file; keep compact pointers and summaries in the Goal.
- Use Goal frontmatter `status` as the machine-readable lifecycle marker;
  completion means `status: complete` plus concise completion evidence.
- Maintain `.bagakit/goal/current.md` as the agent-facing entrypoint and
  `.bagakit/goal/state.yaml` as the Goal registry/topology when the Goal surface
  exists.
- When supervision is active, maintain `.bagakit/goal/supervisor.md` as the
  supervisor contract; do not create a separate supervisor skill or schema fork.
- Keep exactly one foreground Goal for execution, but allow multiple incomplete
  Goals to remain registered with statuses such as `paused`, `blocked`, or
  `ready_for_review`, and roles such as backlog or review work.
- Never mark a previous incomplete Goal abandoned merely because a new Goal is
  created or selected; archive completed or explicitly abandoned Goals under
  `.bagakit/goal/archive/` so they do not interfere with the active work set.
- Treat new user ideas as proposed Goal deltas before implementation. Sidecar
  analysis such as Grok may inform deltas, but must not directly execute.
- Support loop-off-loop control: the outer loop observes inner execution,
  updates the Goal when alignment drifts, and sends corrections without taking
  over implementation.
- When the user asks for text to set as an Agent Goal, write a short Goal
  wrapper that uses file references for `current.md`, and also `supervisor.md`
  when present. Use the fixed wrapper templates in
  `references/loop-off-loop.md`; do not freestyle equivalent prose.

Minimal workflow:

1. Choose or create a goal path, usually `.bagakit/goal/<goal-id>.md` plus
   `.bagakit/goal/current.md`, `.bagakit/goal/state.yaml`, optional
   `.bagakit/goal/supervisor.md`, and `.bagakit/goal/archive/`, or a
   user-supplied pasted text file reference.
   Durable Goal files default to the target project's `.bagakit/goal/`, not the
   installed skill directory or a global agent directory.
2. Read `current.md`, `state.yaml`, the foreground Goal, and all indexed owner
   files before editing.
3. Classify each new fact as Goal material, owner-file material, sidecar input,
   open question, or discard.
4. Update the Goal and state registry with a compact delta and pointers to owner
   files.
5. Run a fresh-executor check: a new agent should know why, where, current
   state, principles, acceptance, risks, and next action from the Goal.
6. If supervision is active, emit or update the next supervisor instruction
   instead of directly changing implementation.

Read references only when needed:

- `references/goal-file-contract.md`: required Goal structure, quality bar,
  placement rules, Goal wrapper, and template.
- `references/tool-orchestration.md`: Team mode, Grok sidecar, OpenSpec,
  Brainstorm, Feature Tracker, Flow Runner, and related surfaces.
- `references/loop-off-loop.md`: supervisor.md contract, Goal or Loop command
  invocation wrappers, drift classes, and packet semantics.
- `references/design-origin.md`: original user discussion, FAQ, and design
  rationale for evolving this skill.
- `references/frontdoor-rule.toml`: project frontdoor declaration.
