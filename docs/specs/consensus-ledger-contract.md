# Consensus Ledger Contract

This spec defines the stable Bagakit contract for task-local shared
understanding ledgers.

It is a workflow and runtime-state contract, not a research log, dialogue
style, or shared knowledge system.

## Purpose

Use this contract when an agent and user need a recoverable record of what is
confirmed, inferred, unknown, contested, deferred, or ready for handoff in the
current task.

The goal is to stop later agents from inheriting only a chat transcript or a
final summary while losing the status of the underlying shared understanding.

## Boundary

This contract owns:

- shared vocabulary for task-local consensus state
- the embeddable ledger placement protocol
- epistemic item classes and lifecycle statuses
- goal-dimension and skill-lens semantics
- generic evidence requirements and satisfaction state
- promotion boundaries from working ledger to durable knowledge

It does not own:

- raw discussion logs
- researcher source cards or source-bound summaries
- Spark's dialogue loop
- Grill's question DAG and convergence state machine
- living-knowledge shared truth
- repository evolution memory

Owning skills may implement this contract through their own run or session
directories instead of writing to a central ledger root.

## Placement Model

Consensus ledger is an embeddable protocol with a standalone fallback.

Default placement order:

1. If an upstream skill or workflow owns a run, session, feature, or task
   directory, place the ledger inside that owner directory.
2. If there is no stronger owner, use the standalone fallback under
   `.bagakit/consensus-ledger/ledgers/<ledger-id>/`.
3. If multiple skills need the same ledger, they reference the owner ledger;
   they do not copy it into parallel ledgers.

Examples:

```text
.bagakit/spark/sessions/<session-id>/consensus-ledger.json
.bagakit/grill/runs/<run-id>/consensus-ledger.json
.bagakit/consensus-ledger/ledgers/<ledger-id>/ledger.json
```

Placement rules:

- the owning workflow controls the physical directory and lifecycle
- `bagakit-consensus-ledger` controls schema, status vocabulary, and operator
  behavior
- no two owners should mutate the same ledger unless an explicit append or
  merge protocol is in place
- promotion to living knowledge or evolver requires a separate snapshot or
  handoff; the working ledger is not shared truth

## Core Record

A ledger should contain these conceptual sections:

- `goal_context`
  - current task, protected goal, success bar, and non-goals
- `epistemic_items`
  - task-local understanding items with status and provenance
- `goal_dimensions`
  - goal-relative dimensions that organize items, questions, risks, and next
    probes
- `questions`
  - decision-changing or coverage-bearing questions
- `decision_items`
  - optional question/option/criteria/rationale records for decisions
- `skill_lenses`
  - skill-specific mappings over the common dimensions
- `evidence_requirements`
  - tool-neutral statements of what evidence is needed, what would satisfy it,
    and whether it has been satisfied
- `evidence_refs`
  - pointers to user answers, artifacts, source summaries, or tool output
- `snapshots`
  - candidate or accepted summaries for handoff
- `promotion_state`
  - whether anything has been promoted, deferred, or blocked from promotion

## Epistemic Classes

`epistemic_class` records where an item sits in the working understanding map:

- `known_known`
  - confirmed or directly available understanding
- `known_unknown`
  - an explicit open question, gap, risk, or missing fact
- `unknown_known`
  - an inferred or latent understanding that may be true but needs confirmation
- `unknown_unknown`
  - a proposed blind spot or unexplored dimension

These classes do not by themselves mean the user accepted the item.

## Item Statuses

`status` records the lifecycle of one item as shared understanding:

- `confirmed`
  - user-confirmed or otherwise accepted for the current task
- `proposed`
  - offered as a candidate understanding
- `inferred`
  - inferred by the agent and not yet confirmed
- `contested`
  - challenged, corrected, or rejected by the user or evidence
- `deferred`
  - known to matter but intentionally postponed
- `superseded`
  - replaced by later understanding
- `stale`
  - may no longer be reliable because context changed
- `promoted`
  - copied or summarized into a durable owner surface through explicit
    promotion

Operational rule:

- never treat `inferred`, `proposed`, `unknown_known`, or `unknown_unknown`
  as user-confirmed consensus without a confirmation event or accepted
  snapshot

## Goal Dimensions

Goal dimensions are the bridge between general ledger semantics and specific
skills.

Each dimension should preserve:

- id and name
- why the dimension matters to the current goal
- current state
- linked epistemic items
- open questions
- risks if ignored
- next probe or action

The core ledger should not hard-code Spark or Grill dimensions. Skills provide
lenses over dimensions.

## Skill Lenses

A skill lens maps one skill's workflow onto the common ledger.

Spark lens examples:

- goal and success bar
- user model
- exploration branches
- idea space
- value tradeoffs
- research gaps
- experiment candidates

Grill lens examples:

- target goal
- success criteria
- dependency chain
- risk branches
- evidence gaps
- rejected alternatives
- convergence conditions

Lens rule:

- a lens may add skill-specific labels and refs
- a lens must not redefine epistemic classes or item statuses
- a lens should point back to shared dimensions and items instead of copying
  understanding into a separate local format

## Evidence Requirement Boundary

The ledger owns the declarative requirement, not the route that produces it.

Common evidence kinds are:

- `user_confirmation`
- `local_artifact`
- `source_evidence`
- `prototype_observation`
- `runtime_observation`

Each requirement should preserve its subject, acceptance criteria, lifecycle
status, linked dimensions, and evidence refs. Owner workflows may map these
kinds to their own resolution routes, but the ledger must not invoke research,
prototype, implementation, validation, or other tools.

This keeps the ledger reusable outside Spark and Grill while still letting
both skills share one explicit evidence-sufficiency model.

## Decision Items

For decision-bearing questions, use a compact rationale shape inspired by
question/option/criteria and decision-record practices:

- question or issue
- options considered
- criteria or rationale
- recommended or chosen path
- rejected alternatives
- risk or consequence
- status

Do not force every minor clarification into a decision item. Use it only when
the answer changes downstream action, validation, convergence, or handoff.

## Spark And Grill Integration

Spark should use the ledger to:

- keep visible shared-understanding state
- separate confirmed user agreement from inferred user model
- choose the next decision-changing question
- prepare consensus snapshot candidates
- record why research or evaluation changes the question

Spark should keep its own files for dialogue-loop protocol, snapshot
acceptance, evaluation envelopes, and Spark-specific output shape.

Grill should use the ledger to:

- preserve the protected goal or principle
- map question nodes to target dimensions
- record which gaps each question closes or defers
- support branch-width and convergence checks
- record the evidence requirement behind each non-conversational resolution
  route and mark it satisfied when evidence returns

Grill should keep its own files for the question DAG, answer events, lifecycle
status, and generated brief.

## Promotion Boundary

A ledger is task-local working state by default.

Promotion requires:

- an accepted snapshot or handoff
- evidence refs for the promoted claim
- failure boundaries when the claim should transfer
- a target owner surface such as living-knowledge, evolver, or a skill/spec
  change

Do not promote a ledger wholesale as shared knowledge.
