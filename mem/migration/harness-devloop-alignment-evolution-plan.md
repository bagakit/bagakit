# Harness Devloop Alignment Evolution Plan

Historical note:

- this is a Bagakit-side migration and alignment note based on verified reading
  of an external `harness-devloop` planning surface
- it is not the active canonical contract for Bagakit planning-entry,
  feature-tracker, flow-runner, or outer-driver behavior
- when this note conflicts with landed Bagakit runtime or contract text, follow:
  - `skills/`
  - `docs/specs/`
  - `docs/stewardship/`

Status: active migration note

Scope:

- source comparison:
  - external `harness-devloop` brainstorm and maintainer plan
- target:
  - canonical Bagakit monorepo

Current execution artifact:

- `mem/migration/harness-devloop-alignment-execution-checklist.json`
  - machine-readable checklist for the completed alignment slice

This note answers one question:

- how Bagakit should evolve from the current per-surface planning and execution
  stack into a user-demand-to-execution loop that satisfies the same core
  product demands without copying source taxonomy or reintroducing a bundled
  runtime

## Verified Source-Side Demands

The external plan consistently asks for five things:

1. user demand must enter through an explicit planning front door
2. user clarification and approval must become durable artifacts instead of
   staying only in chat context
3. planning truth and execution truth must be separated
4. maintainer-side host tooling must stay outside distributed runtime truth
5. the next step is protocol hardening, not early runtime expansion

Relevant source evidence:

- `.bagakit/brainstorm/archive/20260412T045456Z--harness-devloop-architecture-plan/input_and_qa.md`
- `NEXT.md`

## Verified Bagakit Coverage Today

Bagakit already covers most of that demand shape in clean-room form.

### 1. Clarification and decision capture already exists

`bagakit-brainstorm` already owns:

- staged clarification and analysis flow
- question-card structure
- `raw_discussion_log.md` as append-only raw record
- explicit `discussion_clear` and `user_review_status` gates
- archive-completion semantics

Relevant Bagakit surfaces:

- `skills/harness/bagakit-brainstorm/SKILL.md`
- `skills/harness/bagakit-brainstorm/scripts/bagakit-brainstorm.py`
- `gate_validation/skills/harness/bagakit-brainstorm/check-bagakit-brainstorm.sh`

### 2. Planning-entry routing already exists

`bagakit-skill-selector` already defines and validates explicit planning-entry
routes:

- `planning-entry-brainstorm-only`
- `planning-entry-brainstorm-to-feature`
- `planning-entry-feature-to-flow`
- `planning-entry-brainstorm-feature-flow`

Relevant Bagakit surfaces:

- `skills/harness/bagakit-skill-selector/SKILL.md`
- `docs/specs/selector-selection-model.md`
- `docs/specs/selector-planning-entry-routes.md`
- `gate_validation/skills/harness/bagakit-skill-selector/check-selector-planning-entry.sh`

### 3. Planning truth and execution truth are already split

Bagakit already keeps:

- planning truth in `bagakit-feature-tracker`
- bounded execution truth in `bagakit-flow-runner`
- host orchestration in `dev/agent_loop/`

Relevant Bagakit surfaces:

- `docs/specs/feature-tracker-contract.md`
- `docs/specs/flow-runner-contract.md`
- `docs/specs/agent-loop-contract.md`
- `dev/agent_loop/README.md`

### 4. Outer-driver boundary is already cleaner than the source system

`dev/agent_loop/` already states that it:

- wraps bounded runner launches around canonical flow-runner state
- does not own feature planning truth
- does not own checkpoint semantics
- does not create a second execution truth surface

This means Bagakit should preserve the current `feature-tracker ->
flow-runner -> agent_loop` layering instead of importing source-side
`playbook/work-item/Ralph` naming or bundled runtime structure.

## Completed Alignment Slice

The original main gap was not a new runner.

It was the lack of one explicit, durable bridge from:

- user-facing planning artifacts

into:

- canonical planning truth
- canonical execution truth

That slice is now implemented in Bagakit:

- `bagakit-brainstorm` can export one approved planning-entry handoff json
- `bagakit-feature-tracker` can materialize canonical planning truth from that
  handoff
- `bagakit-flow-runner` can activate one execution-ready tracker feature into a
  runnable flow packet
- deterministic validation and eval now cover the stitched route

So the current repository state is no longer only:

- selected
- logged
- validated

It is now also:

- materialized
- replayable
- proven across the planning-to-execution bridge

## Evolution Target

Bagakit should converge on this user-demand chain:

1. `user demand`
2. `bagakit-skill-selector` preflight
3. `bagakit-brainstorm` only when ambiguity or review is still needed
4. one explicit planning-entry handoff payload
5. `bagakit-feature-tracker` as canonical planning truth
6. `bagakit-flow-runner` as canonical bounded execution truth
7. `dev/agent_loop/` as optional maintainer-side host wrapper

Target properties:

- user clarification is durable and source-traceable
- approval state is durable and explicit
- planning truth is no longer inferred from brainstorm prose alone
- execution truth is no longer inferred from tracker notes alone
- host tooling remains convenience-only
- no new bundled runtime is introduced just to compensate for missing bridge
  contracts

## Non-Goals

Do not do these as part of this evolution:

- do not recreate source-side `playbook` naming as Bagakit canonical truth
- do not recreate source-side `work-item` bundle as a Bagakit bundled planning
  owner above tracker and runner
- do not turn `dev/agent_loop/` into the planning front door
- do not silently auto-execute downstream surfaces from selector
- do not introduce daemon, inbox, or long-lived runtime first

## Proposed Evolution Order

### Phase 0: Freeze the target boundary

Goal:

- make the intended Bagakit end-state explicit before adding more features

Required outputs:

- this migration note
- one later Bagakit-owned architecture promotion once the bridge shape stops
  moving

Decision:

- keep the current clean-room split:
  - selector for entry routing
  - brainstorm for ambiguity reduction and approval capture
  - feature-tracker for planning truth
  - flow-runner for execution truth
  - agent_loop for host orchestration

### Phase 1: Define one planning-entry handoff contract

Status:

- completed in the current alignment slice

Goal:

- create one minimal Bagakit-owned contract that can carry downstream planning
  facts out of brainstorm without making brainstorm the planning truth owner

The handoff contract should include only downstream-critical fields such as:

- demand summary
- success criteria
- hard constraints
- unresolved questions
- answered-or-deferred clarification status
- review approval status
- recommended route
- source refs back to brainstorm artifacts

The handoff contract should not include:

- raw full transcript replacement
- duplicated tracker state
- duplicated flow-runner state

Suggested landing:

- first as evolving memory and implementation note
- then promote stable semantics into `docs/specs/`

Phase-exit condition:

- Bagakit can name exactly which fields downstream surfaces may trust from a
  brainstorm-to-planning handoff

### Phase 2: Materialize `brainstorm -> feature-tracker`

Status:

- completed in the current alignment slice

Goal:

- add one explicit bridge that converts a planning-entry handoff into canonical
  tracker truth

Rules:

- explicit trigger only
- no hidden selector auto-execution
- no new generic root planning files
- no second planning SSOT

Desired result:

- one approved brainstorm handoff can initialize or update tracker truth in a
  replayable way
- tracker becomes the first canonical owner after the handoff boundary

Phase-exit condition:

- the route `planning-entry-brainstorm-to-feature` is not only loggable but
  executable and replayable

### Phase 3: Materialize `feature-tracker -> flow-runner`

Status:

- completed in the current alignment slice

Goal:

- make execution-ready transition explicit once planning truth is already
  canonical

Bagakit already has a partial form of this through:

- `flow-runner` ingestion from `feature-tracker`

What still needs tightening:

- the exact handoff or activation contract from tracked planning truth into one
  execution-ready flow-runner item
- the expected evidence that the route is now executable without ad hoc human
  translation

Phase-exit condition:

- the route `planning-entry-feature-to-flow` is executable as a stable bridge,
  not only a conceptual recommendation

### Phase 4: Add one end-to-end planning-surface proof

Status:

- completed in the current alignment slice

Goal:

- prove the full Bagakit chain with one deterministic or minimally mocked
  end-to-end regression

Minimum scenario:

1. user demand requires clarification
2. brainstorm records questions, answers, and approval
3. one planning-entry handoff is produced
4. tracker consumes the handoff into planning truth
5. flow-runner exposes execution-ready state
6. optional host wrapper can run above that truth without owning it

Why this phase matters:

- current per-surface smoke proves the pieces
- this phase would prove the stitched control-plane story

Phase-exit condition:

- Bagakit has one end-to-end proof for `planning-entry-brainstorm-feature-flow`

### Phase 5: Promote only the stable parts

Goal:

- move only the stabilized semantics into canonical docs

Promotion order:

1. `docs/specs/`
   - planning-entry handoff semantics
2. `docs/architecture/`
   - cross-surface user-demand flow
3. `docs/stewardship/`
   - maintainer operating route and review guidance

Do not promote before:

- field meanings stop moving
- the bridge has at least one verified end-to-end proof
- the boundary between tracker, runner, and outer driver is still clean

## Remaining Immediate Work Queue

Priority order now:

1. decide whether the new handoff and activation semantics should be promoted
   from migration memory into more permanent architecture or stewardship text
2. keep the new bridge surfaces under regression as the surrounding planning
   vocabulary evolves
3. only then decide whether any host-facing promotion or wrapper simplification
   is still worth adding

## Acceptance Bar For The Final Target

Bagakit reaches the target when all of these are true:

1. a substantial user request can be routed from selector into the right
   planning-entry chain without hidden execution
2. clarification, approval, and handoff evidence are durable and source-traceable
3. tracker becomes canonical planning truth after the planning boundary
4. flow-runner becomes canonical execution truth after the execution boundary
5. agent_loop remains an optional host wrapper, not a planning owner
6. one end-to-end regression proves the full route

## Promotion Note

This note should be promoted or split only after Bagakit can answer these
questions without relying on source-side comparison:

1. what exact handoff payload does Bagakit trust
2. what exact command or bridge materializes `brainstorm -> feature-tracker`
3. what exact command or bridge materializes `feature-tracker -> flow-runner`
4. what end-to-end proof keeps that chain from regressing
