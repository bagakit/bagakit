---
name: bagakit-hitl-webutil-design
description: Design or resume an explicit human-in-the-loop web page, course handoff, evidence review surface, or result-capture flow. Use for page contracts and continuity; route implementation to the webpage skill only when the user asks to build or verify the page.
---

# Bagakit HITL Webutil Design

HITL owns the human action, evidence, continuity, judgment, and handoff
contract. Use Design Core for visual/design reasoning when needed, and hand
implementation plus browser proof to Codex Webpage Design. `bagakit-explain` is
an optional pre-action foundation, not a second owner of HITL history or
judgment.

`bagakit-hitl-webutil-design` is the purpose-first design skill for HITL web
pages.

It owns page-purpose decomposition, not frontend implementation. Use it to
decide what a HITL page must do for the human and the agent, how that page
should scan in a concrete scene, and what durable artifact should round-trip
back to the agent.

## Choose Capabilities Before Style

Choose in this order: human purpose, required interactions, delivery route,
then visual style. Crosswalk styles are defaults; adapt them to the audience,
material, device, or the user's reference while preserving judgment, evidence,
history, continuity, and export requirements.

- Use the lightweight route for explanation, option comparison, choices, and
  comments when fixed components can carry every selected requirement.
- Use the stateful route for case/run history, independent review, consequential
  approval, or adaptive feedback. A compact visual style still needs those
  capabilities.
- Keep the selected route and its evidence in one brief. Stage artifacts may
  be sections of that brief; do not create a separate file for every selection.

Read the route rules in `references/composition-crosswalk.md`. An installed
`answer-me-with-html` can supply fixed rendering when it fits; load its skill
only when selected. The webpage implementation owner remains responsible for
the HITL contract and browser proof, including any missing export or identity
adapter. Renderer availability does not lower the completion bar.

## Explicit Invocation Contract

When the user explicitly invokes `bagakit-hitl-webutil-design`, treat that as a
request for a HITL page, not merely a request to discuss HITL principles.

Treat an existing page submission, attempt packet, `course_id` plus resume
intent, or request to continue a built course as a continuation trigger. Reuse
the stable page locator from the handoff packet and return evaluated feedback
and the next action to that page; do not restart the course in chat.

For an explicit HITL page or course-continuation request, default delivery is a
built page. A brief or critique without a page request stops at design output;
`design_only` and `no_file_mutation` are explicit downgrade modes.

Default output:

- design a concrete page brief
- choose the scene route when one fits
- bind mechanisms, style, artifacts, and any matching template
- return the brief, selected route, and artifact contract

For an explicit page request, hand implementation and desktop plus mobile
browser verification to `bagakit-codex-webpage-design` and return the running
page location with evidence unless a downgrade mode is explicit.

If one crosswalk scene or template strongly matches the request, design from
that scenario first. Do not stay at mechanism-only abstraction unless the user
explicitly asks for taxonomy work, critique, or planning without a page.

Scenario pages are cross-products, not atomic modules.

- `mechanisms/`
  - reusable jobs such as knowledge transfer, runbooks, result capture, local
    session state, or interaction-result packaging
- `styles/`
  - visual and interaction routes such as verification console, learning atlas,
    repo workbench, or intelligence briefing
- `artifacts/`
  - durable outputs such as page manifests, report exports, and agent handoff
    packets
- `components/`
  - reusable page modules such as copy/export controls that should compose
    across templates and scenes
- `templates/`
  - reusable page blueprints that bind mechanisms, style, artifacts, and data
    contracts for one repeatable HITL page family
- `composition-crosswalk.md`
  - the bridge from scene to mechanism set, style route, artifacts, audience
    mode, and minimum eval

## Operating Spine

1. Write the page brief.
   - clarify scene, operator mode, success bar, and what the human must return
     to the agent
   - name required interactions and choose lightweight or stateful delivery
     before selecting visual style
   - for multi-turn pages, declare the primary interaction surface, one
     continuity route, projection versioning, sync states, and fallback
   - when the page asks for judgment, name the decision question, review mode,
     reveal policy, and downstream effect
2. Select or compose the scene route.
   - start from `references/composition-crosswalk.md`
   - if no row fits, extend the crosswalk instead of inventing a scene-first
     mechanism
   - if the human must first understand an unfamiliar system, select the
     optional `bagakit-explain` explanatory foundation before the HITL action
     surface
   - for an interactive course, consume the mastery-learning handoff when
     present; otherwise keep page and mastery claims separate
3. Select mechanisms.
   - load only the mechanism files that materially shape the page job
4. Select one style route.
   - style owns layout, density, pane treatment, scanning behavior, and visual
     language
   - treat the crosswalk style as a default; record the chosen style and a
     short reason without changing the required interactions
   - make selected/current case, pane, tab, or mode states legible without
     defaulting to a thin one-sided rail as the only cue; apply the shared
     `bagakit-design-core` selected-state rule and record any semantic
     exception
   - keep cognitive and export semantics in mechanisms or artifacts
5. Select artifacts.
   - define what the human will copy, export, or hand back to the agent
6. Select reusable components.
   - name component boundaries for the implementation handoff
   - avoid treating a monolithic single-page HTML file as the durable design
     target when the host can implement reusable modules
7. Run HITL hardening.
   - use `references/workflow-contract.toml`
   - keep v0 guards explicit for status/error semantics, provenance labeling,
     local persistence lifetime/reset, information-load budget, audience
     mismatch, human judgment, history retention, and schema alignment
   - for adaptive pages, prove one full attempt, Agent feedback, next-task,
     retry or submission, restore, and export round trip
8. Complete implementation.
   - for an explicit page, build, or continuation route, compose with
     `bagakit-codex-webpage-design`, start the page, and verify desktop plus
     mobile behavior
   - on the lightweight route, reuse a suitable fixed renderer and verify one
     choice or comment through export and Agent reentry; require adaptive
     feedback and restore proof only when the selected task needs them
   - otherwise stop at the page brief

## Reference Routing

Read only the route files that materially shape the selected page. Start with
`references/composition-crosswalk.md`; load `references/workflow-contract.toml`
for hardening and then the relevant mechanism, style, artifact, component, or
template README.

Route catalogs (read only the selected category):

- `references/mechanisms/README.md`
- `references/styles/README.md`
- `references/artifacts/README.md`
- `references/components/README.md`
- `references/templates/README.md`

Read by route:

- explanation, briefing, or repo-understanding page
  - `skills/co-work/human-improvement/bagakit-explain/SKILL.md` when the selected
    explanation foundation is `explain`
  - `references/mechanisms/knowledge-transfer.md`
  - `references/mechanisms/evidence-context.md`
  - `references/mechanisms/interaction-result-packet.md`
  - `references/components/copy-result-control.md`
  - one of:
    - `references/styles/learning-atlas.md`
    - `references/styles/repo-reading-workbench.md`
    - `references/styles/intelligence-briefing-desk.md`
- manual execution or verification page
  - `references/templates/manual-test-console.md`
  - `references/mechanisms/case-inventory.md`
  - `references/mechanisms/procedure-runbook.md`
  - `references/mechanisms/copyable-reproduction.md`
  - `references/mechanisms/result-capture.md`
  - `references/mechanisms/evidence-context.md`
  - `references/mechanisms/local-session-state.md`
  - `references/mechanisms/interaction-result-packet.md`
  - `references/components/copy-result-control.md`
  - `references/styles/ide-verification-console.md`
  - `references/artifacts/report-export.md`
- evidence review, human adjudication, or approval page
  - `references/templates/evidence-review-console.md`
  - `references/mechanisms/case-inventory.md`
  - `references/mechanisms/human-judgment-guidance.md`
  - `references/mechanisms/result-capture.md`
  - `references/mechanisms/evidence-context.md`
  - `references/mechanisms/local-session-state.md`
  - `references/mechanisms/interaction-result-packet.md`
  - `references/components/case-directory-panel.md`
  - `references/components/copy-result-control.md`
  - `references/styles/ide-verification-console.md`
  - `references/artifacts/case-catalog.md`
  - `references/artifacts/page-manifest.md`
  - `references/artifacts/report-export.md`
- interactive course or learning workbench
  - `skills/co-work/human-improvement/bagakit-explain/SKILL.md` when the selected
    explanation foundation is `explain_after_diagnostic`
  - `references/templates/interactive-learning-course.md`
  - `references/mechanisms/knowledge-transfer.md`
  - `references/mechanisms/evidence-context.md`
  - `references/mechanisms/local-session-state.md`
  - `references/mechanisms/adaptive-session-continuity.md`
  - `references/mechanisms/interaction-result-packet.md`
  - `references/components/adaptive-feedback-panel.md`
  - `references/components/contextual-question-capture.md`
  - `references/components/copy-result-control.md`
  - `references/styles/learning-atlas.md`
  - `references/artifacts/page-manifest.md`
  - `references/artifacts/agent-handoff-packet.md`
- report-heavy review route
  - `references/styles/dense-test-report.md`
  - `references/artifacts/report-export.md`

## Composition Boundaries

- `bagakit-hitl-webutil-design`
  - owns HITL page decomposition, crosswalk choice, artifact contracts, and
    HITL-specific hardening
- `bagakit-codex-webpage-design`
  - owns frontend implementation, visual reference workflow, browser evidence,
    and parity iteration
- `bagakit-explain`
  - owns novice-first visual explanation, architecture maps, causal depth,
    boundaries, and changed-case understanding when the selected scene needs
    explanatory context
  - does not own HITL actions, evidence capture, judgment, history, handoff,
    continuity, or mastery status
- `bagakit-design-core`
  - owns brand or tone review when a design packet or design-rule pass is
    needed, including the shared selected-state signal rule
- `bagakit-spark`
  - use when the page purpose, scene boundary, or eval meaning is still too
    unclear to scaffold
- `bagakit-mastery-learning`
  - optionally owns learning goals, diagnostics, course sequence, transfer,
    support fading, retention, and mastery evidence
  - HITL owns only the interactive page projection

## Lean V0 Rule

Keep every reference file short and contract-like.

Do not split cross-cutting concerns into more files unless repeated eval
failures prove the current guard is too weak. In v0:

- export control behavior stays in
  `references/mechanisms/interaction-result-packet.md`
- concrete copy/download component treatment stays in
  `references/components/copy-result-control.md`
- output shapes stay in `references/artifacts/`
- status/error semantics and provenance labeling stay in
  `references/workflow-contract.toml`
- multi-turn page/Agent continuity stays in
  `references/mechanisms/adaptive-session-continuity.md`; the concrete feedback
  and sync UI stays in `references/components/adaptive-feedback-panel.md`
- judgment, history-retention, and schema-alignment invariants stay in
  `references/workflow-contract.toml`
