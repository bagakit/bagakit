# Interactive Learning Course

## Use When

Use this template when the user requests an interactive course, learning
workbench, guided concept study, or a page projected from a mastery-learning
packet.

This template owns the page projection. It does not define, certify, or
guarantee mastery.

## Default Delivery

This template defaults to `built_page`.

- consume the mastery-learning handoff
- produce the page brief and component/state contract
- continue through `bagakit-codex-webpage-design`
- start the implementation and verify desktop plus mobile browser behavior
- return the running page location and browser evidence

Do not return the page brief as the final deliverable unless the user explicitly
selects `design_only` or `no_file_mutation`.

## Crosswalk Binding

- scene: `interactive-course-learning`
- mechanisms:
  - `knowledge-transfer`
  - `evidence-context`
  - `local-session-state`
  - `adaptive-session-continuity`
  - `interaction-result-packet`
- primary style: `learning-atlas`
- components:
  - `contextual-question-capture`
  - `adaptive-feedback-panel`
  - `copy-result-control`
- artifacts:
  - `page-manifest`
  - `agent-handoff-packet`

## Inputs

Required input for a mastery-composed course:

- the course handoff described by
  `bagakit-mastery-learning/references/hitl-course-handoff.md`

Fallback inputs:

- bounded learning goal
- content or source refs
- course or concept graph
- learner actions and expected evidence
- state and handoff requirements
- known limitations

When the mastery handoff is absent, design a useful learning page but do not
invent delayed-retention or transfer evidence.

## Three-Zone Workbench

- navigation and progress zone
  - course graph, current objective, attention state, and re-entry points
- explanation and action zone
  - minimal explanation, coordinated media, retrieval, teach-back, application,
    and transfer tasks supplied by the course input
- evidence and handoff zone
  - attempt state, Agent feedback, sync state, support level, questions,
    evidence status, blockers, next action, copy, and download

On narrow screens, preserve this order and use tabs or a drawer rather than
shrinking all three zones into unreadable columns.

## Component Boundaries

- course graph navigator
- active objective header
- explanation and evidence viewer
- learner action renderer
- feedback and retry region
- adaptive feedback and sync panel
- support-level indicator
- contextual question capture
- learner evidence summary
- copy-result control

Standalone HTML may inline modules for delivery, but the implementation handoff
must preserve their state and payload boundaries.

## Learner-Facing Rules

- Show what the learner is trying to do and what evidence is expected.
- Keep source-backed material distinct from teaching inference.
- Use diagrams or media only when they clarify a relation the learner must use.
- Say "saved on this device" rather than naming storage APIs.
- Do not display skill ids, source file names, template names, build narration,
  or how the page was generated.
- Do not use interaction count, progress percentage, or confidence alone as a
  mastery claim.

## State And Handoff

- Preserve `mastery_packet_ref`, objective state, append-only learner-event
  refs, dimension-evidence refs, attempts, contextual question events, support
  level, transfer distance, retention interval, blockers, and next action when
  supplied by the course contract.
- Declare `primary_interaction_surface=page` and choose one feedback transport:
  `local_exchange`, `manual_round_trip`, or `page_reprojection`.
- Preserve projection version, last-applied event ref, sync state, active task
  ref, feedback ref, page id, manifest ref, and projection target. Show stale
  or conflicting projections explicitly.
- After the first attempt, return Agent feedback, repaired tasks, retries, and
  next actions to the page. Chat may notify or carry an explicit fallback, but
  it must not become the hidden primary course UI.
- Make local-only lifetime, reset, stale-state recovery, and export scope
  visible.
- Export enough context for the next Agent to resume without replaying the full
  session.
- Keep copied and downloaded payload semantics aligned.
- Never map generic page `passed` or `failed` status into mastery evidence.

## Completion

Page-session completion means the page has a stable next action and exportable
state. Course or mastery completion remains owned by the upstream learning
contract.

Delivery completion additionally requires an implementation entrypoint, a
running page location, and desktop plus mobile browser evidence. For an
adaptive course, browser evidence must cover one complete round trip: learner
attempt, Agent feedback projection, next task, another learner action, restore,
and export. A page brief or first-attempt-only page is incomplete for the
default route.

## Failure Signals

- The page is a long article with decorative quizzes.
- Reading or clicking is presented as mastery.
- Agent answers replace learner attempts.
- Learner questions lose their context.
- The page captures the first attempt while feedback and every later task move
  into chat.
- Local page state and Agent course state advance with no projection version or
  stale-state warning.
- Backstage implementation chrome appears in the learning surface.
