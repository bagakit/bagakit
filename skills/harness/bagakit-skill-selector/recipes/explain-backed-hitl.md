# Explain-Backed HITL

## Fit Signals

Use this recipe when a human must inspect, test, compare, judge, or approve an
unfamiliar system and needs a causal model before the HITL action.

Good fit:

- concept, repository, or situation pages where the human needs a whole-system
  map before acting
- HITL pages where evidence is difficult to interpret without causal context
- interactive courses where explanation follows an upstream blind diagnostic

## Non-Fit Signals

Do not use this recipe when:

- the human is an expert and the evidence already supplies sufficient context
- the task is a standalone visual explanation with no HITL action or handoff
- the task requires mastery claims but has no upstream mastery contract

## Participants

- `bagakit-skill-selector`
- `bagakit-explain`
- `bagakit-hitl-webutil-design`
- optional: `bagakit-mastery-learning`
- optional: `bagakit-codex-webpage-design`

## Execution Order

1. `bagakit-skill-selector`
   Record the explicit composition and route reason.
2. `bagakit-explain`
   Produce the architecture map, causal mechanism, boundary, and changed-case
   explanation in the user's language.
3. `bagakit-hitl-webutil-design`
   Bind the explanation to the selected HITL action, evidence, judgment,
   history, handoff, and continuity surfaces.
4. `bagakit-mastery-learning` when the route is an interactive course
   Keep blind diagnosis and mastery semantics upstream; allow explanation only
   after the diagnostic permits it.
5. `bagakit-codex-webpage-design` when the route is a built page
   Implement and verify the composed page on desktop and mobile.

## Required Steps

- name one explanation foundation: `native`, `explain`, or
  `explain_after_diagnostic`
- show the whole-system map before detail when the human is unfamiliar
- connect the root mechanism and changed case to the next human action
- keep evidence, provenance, judgment, history, handoff, and continuity in
  their HITL or upstream owners
- return one canonical HITL packet; do not treat explanation completion as
  mastery or decision completion

## Optional Steps

- use functional motion only when it improves causal or temporal understanding
- capture a contextual question tied to the explanation scene
- add a changed-case prediction or self-explanation as evidence when the route
  needs understanding proof

## Skill Responsibilities

- `bagakit-skill-selector`
  - owns composition visibility and usage evidence
- `bagakit-explain`
  - owns novice-first visual explanation and causal understanding
- `bagakit-hitl-webutil-design`
  - owns the HITL page route, action/evidence contract, and handoff
- `bagakit-mastery-learning`
  - owns diagnostics, adaptation, transfer, retention, and mastery evidence
- `bagakit-codex-webpage-design`
  - owns frontend implementation and browser evidence

## Inputs

- unfamiliar system, concept, repository, or situation
- intended human action or judgment
- source context and provenance boundaries
- selected HITL scene and required handoff fields
- mastery packet when the route is an interactive course

## Outputs

- Explain-backed page context with architecture, causal mechanism, boundary,
  and changed-case evidence
- HITL page manifest and canonical handoff packet when an HITL page is needed
- implementation and browser evidence when built-page delivery is selected

## Synthesis Artifact

Recommended synthesis artifact:

- one crosswalk-selected HITL design packet that records the explanation
  foundation and derives the page's action, evidence, and handoff boundaries

## Evidence To Record In `skill-usage.toml`

- `[[recipe_log]]` for `explain-backed-hitl`
- `[[skill_plan]]` entries for Explain and HITL, plus any selected peers
- `[[usage_log]]` showing the explanation model and HITL binding were both used
- a route-level verification reference for the changed-case and handoff

## Fallback And Degrade

- if the human already has sufficient context, use `native` and skip Explain
- if Explain is unavailable, keep the HITL route standalone and record the
  missing explanatory foundation as a limitation
- if HITL is not needed, use Explain standalone and do not invent an HITL
  packet or judgment state

## When It Is Not Worth It

Do not pay for this composition when explanation does not change the human's
next action, evidence interpretation, or judgment quality.
