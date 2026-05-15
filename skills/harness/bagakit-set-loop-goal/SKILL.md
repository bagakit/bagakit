---
name: bagakit-set-loop-goal
description: Create, upgrade, or update high-quality Goal control files for long-running agent work. Use when a task needs restart, compact, handoff, loop supervision, sidecar analysis, multiple coexisting Goals, legacy or incomplete Goal recovery, protocol migration, or execution control through a compact steering index rather than a chat transcript, full plan, or log bucket.
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
- Keep current control truth in Markdown and append-only Goal control events in
  JSONL. Route execution logs to their Runner, evaluator, or tool owner.
- Route detailed work into the owning Feature, Plan, Spec, Research, Runner, or
  Handoff file; keep compact pointers and summaries in the Goal.
- Use Goal frontmatter `status` as the machine-readable lifecycle marker;
  completion means `status: complete` plus concise completion evidence.
- Lock the Goal protocol to `bagakit.goal.v.0.1`. Inspect and upgrade missing,
  older, or incomplete Goal surfaces before normal mutation; route semantic
  conflicts to Grill instead of guessing.
- Maintain `.bagakit/goal/current.md` as the agent-facing entrypoint and
  `.bagakit/goal/state.yaml` as the machine-readable registry, incomplete-Goal
  topology cache, reconciliation cursor, and foreground selector.
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
- After nontrivial Goal creation or direction-changing updates, give the user a
  plain-language alignment recap; route corrections back into Goal deltas,
  owner files, or open questions rather than creating a second truth surface.
- After material checkpoints, render the Goal's Bagakit Driver projection from
  reconciled truth; aggregate decision-bearing problems under the shared Alert
  line rather than inventing Goal-specific warning formats.
- Reconcile after material milestones, before compact or handoff, or whenever
  newer evidence makes Current State or Next Execution Instruction stale.
- Support loop-off-loop control: the outer loop observes inner execution,
  updates the Goal when alignment drifts, and sends corrections without taking
  over implementation.
- Schedule event-bound Evolver reviews through compact request/receipts. Goal
  owns review scheduling and receipts; Evolver owns intake and promotion.
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
2. Inspect protocol version and surface completeness. Apply deterministic
   upgrades; stop with a Grill conflict packet when user intent is required.
3. Read `current.md`, `state.yaml`, the foreground Goal, and all indexed owner
   files before editing.
4. Classify each new fact as Goal material, owner-file material, sidecar input,
   Goal control event, open question, or discard.
5. Write repeated execution records to their owner stream. Append only
   steering-relevant events to the Goal JSONL stream.
6. Reconcile the Goal by replacing current state and the one next instruction,
   folding accepted deltas into their owning sections, and advancing the event
   cursor.
7. Run a fresh-executor check: a new agent should know why, where, current
   state, principles, acceptance, risks, and next action from the Goal.
8. For nontrivial creation or direction-changing updates, show a concise
   alignment recap to the user before activation or continued execution.
9. If supervision is active, append its checkpoint as a Goal control event and
   reconcile any direction-changing effect before the next execution round.
10. When a checkpoint can expose reusable repository learning, request an
   Evolver review and later record its compact disposition without copying
   Evolver state into the Goal surface.

Read references only when needed:

- `references/goal-file-contract.md`: required Goal structure, quality bar,
  placement rules, alignment recap, Goal wrapper, and template.
- `references/event-stream-contract.md`: JSONL Goal control events, execution
  log routing, reconciliation, cursor semantics, and archive rules.
- `references/protocol-upgrade-contract.md`: version detection, legacy and
  incomplete-surface upgrades, conflict packets, and Grill routing.
- `references/bagakit-driver.toml`: event-driven Goal reporting, evidence-backed
  progress and budget checks, discoveries, and shared Alert candidates.
- `references/tool-orchestration.md`: Team mode, Grok sidecar, OpenSpec,
  Brainstorm, Feature Tracker, Flow Runner, and related surfaces.
- `references/loop-off-loop.md`: supervisor.md contract, Goal or Loop command
  invocation wrappers, drift classes, and packet semantics.
- `references/design-origin.md`: original user discussion, FAQ, and design
  rationale for evolving this skill.
- `references/frontdoor-rule.toml`: project frontdoor declaration.
