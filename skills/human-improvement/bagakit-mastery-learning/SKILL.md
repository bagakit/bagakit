---
name: bagakit-mastery-learning
description: Turn articles, documentation, repositories, concepts, or procedures into evidence-backed learning experiences aimed at fast, bounded-complete, transferable mastery. Use when a user asks to thoroughly learn, fully understand, internalize, retain, teach back, apply, or generalize from source material; requests an interactive course; needs diagnostic routing, active retrieval, feedback, support fading, transfer checks, and spaced re-entry; or submits an attempt packet or page receipt to continue an existing course. Learner-facing copy defaults to review through bagakit-writing-core, including its de-AI-tone route. Interactive-course or learning-interface requests then continue to a built and browser-verified HITL webpage through bagakit-hitl-webutil-design and bagakit-codex-webpage-design unless the user explicitly requests dialogue-only, design-only, or no-file delivery. This skill owns learning semantics and mastery evidence, not writing mechanics, webpage design, or frontend implementation.
---

# Bagakit Mastery Learning

`bagakit-mastery-learning` turns source material into a bounded learning
contract, adaptive course path, and honest mastery evidence.

Its north star is the shortest defensible path to independent capability. It
does not equate reading, page completion, self-confidence, assisted success, or
one passing quiz with mastery.

## Explicit Invocation Contract

When the user asks to "彻底学会", learn completely, learn quickly and transfer,
or create an interactive course, produce a concrete mastery packet and learning
route. Do not stop at a summary, syllabus, or list of learning-science tips.

An existing `course_id`, attempt packet, page-submission receipt, or explicit
request to continue or review a course is also a Mastery invocation. Resume the
course state, evaluate the new attempt, update evidence, and hand a versioned
projection back to the existing HITL page. Chat should only confirm that the
page projection is ready or explain an explicit fallback.

Resolve delivery before authoring:

- `built_page` is the default for "interactive course", "交互式课程", learning
  interface, learning workbench, or equivalent interface intent
- `dialogue_only` requires an explicit request to keep the course in chat
- `design_only` requires an explicit request for a brief, plan, or critique
- `no_file_mutation` applies when the user or host forbids creating files

For `built_page`, compose in this order:

1. author the mastery packet and first-turn state
2. audit each evidence task for capability alignment, answerability, and
   decision relevance
3. review learner-facing copy through `bagakit-writing-core`; Writing Core
   composes `bagakit-writing-de-ai-tone`
4. verify that the rewrite preserved source, diagnostic, task, rubric, and
   evidence meaning
5. hand the reviewed packet to `bagakit-hitl-webutil-design`
6. continue through `bagakit-codex-webpage-design` for frontend implementation
7. run the page and collect desktop and mobile browser evidence
8. return the page URL or local entrypoint plus the bounded learning state

Do not substitute a chat-formatted diagnostic, page brief, or handoff packet
for the built page. Stop at a fallback only when a downgrade mode is explicit
or a peer is unavailable, and state the blocker.

Author the full packet and route internally or as a resumable artifact. Do not
dump that authoring artifact into the first learner-visible page state or chat
turn.

Before that state, read and apply `references/first-course-turn.md` verbatim as
the output-shape contract.

For the first course page state, or the first chat response in `dialogue_only`,
use this order:

1. `Scope receipt`
   - state the requested anchor and stop boundary
   - name included, excluded, or unresolved dependencies that affect coverage
2. `Evidence receipt`
   - say the course is authored but every learner capability, transfer result,
     and delayed-retention result is still `not_assessed`
   - name the unaided changed-context task and delayed re-entry required before
     any bounded mastery claim
3. `Blind diagnostic`
   - ask for the learner's first unaided attempt
   - do not place the core model, source answers, numerical answer cues, worked
     examples, or keyed reply hints before this attempt

This ordering is a completion gate, not optional presentation advice. Teach the
core model and show the rest of the course map only after the first diagnostic
attempt has been captured.

Default output:

- close the requested source boundary and identify missing dependencies
- define what the learner should be able to do without assistance
- design diagnostic, retrieval, explanation, application, and transfer tasks
- reject tasks that measure familiarity with an internal mnemonic, hidden
  ontology, or arbitrary implementation detail instead of the capability
- specify feedback, retry, support-fading, and retention behavior
- review learner-facing explanations, prompts, hints, feedback, transitions,
  and status copy without changing learning semantics
- report what is demonstrated, fragile, unassessed, or due for retest
- for `built_page`, emit the HITL course handoff and continue until the page is
  implemented and browser-verified

The mastery skill remains usable without page peers for non-interface learning
or explicit downgrade modes. Peer absence is a visible fallback, not a reason
to silently turn an interactive-course request into chat.

## Operating Spine

1. Write the learning brief.
   - bound the source, learner goal, target application, prior knowledge,
     retention horizon, time budget, and constraints
   - infer reasonable provisional values when asking would not change the route
2. Close the source.
   - inspect anchors, links, prerequisites, definitions, examples, and omitted
     dependencies
   - distinguish source coverage from capability coverage
3. Define the mastery contract.
   - name capability claims before writing lessons
   - bind each claim to an evidence task, rubric, transfer level, and confidence
     limit
4. Design the diagnostic express lane.
   - skip only capabilities supported by unaided evidence
   - route fragile prerequisites and misconceptions into corrective branches
5. Build the course graph.
   - order nodes by generative dependency, not source heading order
   - use explanations and media to prepare evidence-producing learner actions
6. Audit evidence-task quality.
   - use `references/evidence-and-adaptation.md`
   - make the learner role, situation, decision or output, available evidence,
     constraints, and scoring boundary answerable without guessing the
     author's private framework
   - request only details that can change the rubric decision or next action
   - treat a defective prompt as a task defect, not a learner weakness
7. Review learner-facing copy.
   - use `references/learner-copy-review.md`
   - compose through `bagakit-writing-core`, which invokes its de-AI-tone pass
   - preserve protected spans and re-check diagnostic and rubric meaning
8. Run the active learning loop.
   - orient, diagnose, model, retrieve, explain, apply, transfer, correct, fade
     support, and schedule re-entry
9. Update evidence and adapt.
   - preserve original attempts, questions, hint use, feedback, and retests
   - version repaired tasks and keep prompt-defect dispositions separate from
     learner support
   - revise only the affected course branch when evidence identifies a gap
10. Issue an honest mastery report.
   - keep dimension-level evidence visible
   - distinguish assisted performance from unaided and delayed performance
11. Complete the selected delivery.
   - use `references/hitl-course-handoff.md`
   - keep page layout, controls, state presentation, and export UI in HITL
   - for `built_page`, require implementation and browser evidence from the
     webpage peer before task completion
   - for a multi-turn course, require a deterministic adaptive round trip that
     returns feedback and a next task to the page, preserves history on restore,
     and exports the canonical packet

Course authoring, a live learning session, and delayed re-entry are separate
lifecycle phases. A first response can complete course authoring while every
learner evidence record remains `not_assessed`; it must not pretend the learner
has already executed transfer or retention checks.

## Mastery Claim Rule

Use `references/mastery-learning-contract.toml` as the structured contract.

Do not say "mastered" without a bounded scope and evidence. Prefer:

- `not_assessed`
- `supported`
- `fragile`
- `demonstrated`
- `retest_due`
- `blocked`

`demonstrated` means the declared evidence bar was met for the declared
scope. It is not a universal or permanent claim.

## Reference Routing

Always read:

- `references/mastery-learning-contract.toml`
- `references/mastery-packet.md`

Read before the first response of every new interactive course:

- `references/first-course-turn.md`
- `references/learner-copy-review.md`

Read when designing the course and learner actions:

- `references/learning-loop.md`
- `references/evidence-and-adaptation.md`

Read for every `built_page` route:

- `references/hitl-course-handoff.md`

## Composition Boundaries

- `bagakit-mastery-learning`
  - owns source closure, mastery claims, diagnostics, learning sequence,
    adaptation, transfer, support fading, retention, and mastery evidence
- `bagakit-writing-core`
  - owns audience fit, prose structure, clarity, no-regression review, and
    de-AI-tone orchestration for learner-visible copy
- `bagakit-writing-de-ai-tone`
  - is normally reached through Writing Core and owns AI-tone detection,
    protected-span handling, meaning-preserving rewrite, and second-pass audit
- `bagakit-hitl-webutil-design`
  - owns the interactive page projection, reusable components,
    learner-facing state, and copy/export interaction
- `bagakit-codex-webpage-design`
  - owns frontend implementation, browser evidence, and visual iteration
- `bagakit-researcher`
  - owns new evidence collection when the learning method or source domain
    requires research beyond the available packet

Composition is artifact-based. It is required for `built_page` delivery and
optional for non-interface learning or explicit downgrade modes. Mastery must
not absorb writing mechanics, page-design, or frontend-implementation
ownership. Copy review may change wording and rhythm, but it must not change
the course graph, evidence task, rubric, source claim, or mastery status.

A Writing Core or de-AI-tone pass does not certify evidence-task quality.
Mastery must first prove that the task measures the declared capability and is
answerable without hidden schema knowledge.

## Lean V0 Rule

Keep V0 smaller than an LMS or probabilistic tutor.

- one mastery packet is the task source of truth
- one append-oriented learner event stream preserves attempts and questions
- one report projects current evidence and next action
- one learner-copy review receipt covers the visible course blocks
- use explicit evidence-driven branches before adding knowledge tracing
- treat motivation, accessibility, privacy, and time as constraints, not
  decorative personalization

## Runtime Surface Declaration

Owns `.bagakit/mastery-learning/` when a host materializes course packets,
learner events, mastery reports, or evaluation runs.

Stable runtime rules:

- `docs/specs/runtime-surface-contract.md`
