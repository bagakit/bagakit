---
name: bagakit-explain
description: Create a low-text visual HTML explanation with an architecture map and causal mechanism. Use for explicit explanation pages, not courses or mastery claims.
---

# Bagakit Explain

Build runnable, responsive HTML for a reader with no topic knowledge. Big
pictures teach; "few words" applies per scene, not to the number of ideas.

## Artifact Contract

Every run starts with a small route packet. It must name `topic`, `audience`,
`language`, and the `question` answered by the first scene. Add
`evidence_refs` when the explanation is grounded in a repository, source, or
measurement, and use `route: technical-architecture` when the repository
playbook applies. A missing topic, audience, language, or question is a route
failure; do not decorate an underspecified page.

The build artifact is one self-contained `.html` file written to a
caller-owned path, normally under `.tmp/`. It must contain a meaningful
`<title>`, a `lang` attribute, one main reading region, and the conclusion,
map, mechanism, changed case, evidence boundary, and limits required by the
route. Explain owns no persistent runtime surface. Compose Pageville after
validation when a stable review link is needed; Pageville owns the link and
version, while Explain owns page content.

Write `explanation-receipt.json` beside the HTML or at a caller-specified
path. It records `artifact_path`, `language`, `primary_diagram_family`,
`motion_decision`, `evidence_refs`, `desktop_mobile_evidence`,
`changed_case_result`, and `limits`. The receipt proves artifact construction
and review evidence; it never proves reader understanding or mastery.

## Defaults

- use the language of the user's latest substantive request everywhere
- deliver working HTML; preserve exact identifiers, formulas, and proper nouns
- make every large visual explain a relationship, sequence, comparison, or mechanism

## Make It Understandable

1. Start from the learner's goal and current knowledge; for a complex topic,
   show a stable whole-system map before detail and introduce terms only when needed.
2. Let each scene answer one question, share the work between visuals and words,
   and remove anything that does not change understanding.
3. Reach the real causal mechanism, then test it with a changed-case prediction
   or self-explanation; fluent reading is not understanding.

For technical architecture analysis grounded in a real repository, load
`references/technical-architecture-analysis.md`. It routes the reader's
question to one primary diagram family, separates observed facts from
inference and unknowns, and keeps architecture decisions and code changes with
their owning workflows. Choose a depth of orientation, mechanism,
failure-analysis, or decision-support so technical explanations can go deeper
when the reader needs evidence, root cause, measurement, safety, or trade-offs.

## Keep the Critical Content

1. Put the one conclusion, judgment, or action the user must retain first.
2. Organize by causal and dependency order, not source order; show each major
   part's job, input, change, output, and necessity.
3. If removing something does not weaken correct explanation, prediction, or
   action, delete it or progressively disclose it.

## Use Motion Only When It Teaches

1. Animate only when removing motion would remove temporal, state, or causal
   information the reader needs to infer.
2. Keep entities and spatial references stable, expose the changing relation,
   and preserve deliberate inspection and a meaningful reduced-motion state.
3. Compare static and animated versions on prediction, explanation, or transfer;
   if motion improves only preference or experience, keep the static version.

## Build

1. Map the scenes before coding. A complex topic needs the architecture, major
   parts, one end-to-end example, root mechanism, boundary, and changed case.
   For a technical architecture route, inspect repository entrypoints,
   runtime boundaries, storage, transports, configuration, and relevant tests
   before authoring a relationship; never infer runtime causality from file
   proximity or visual layout.
2. Choose a visual world from the audience and topic, not a technical-dark
   stereotype; implement an accessible static page that works on desktop and mobile.
3. Verify the static artifact with the skill CLI before exposing it to the user
   as a real milestone.
4. Then review motion. If it qualifies, replace only that visual at the same
   path with accessible inline SVG and reverify; otherwise stop with the static page.

Return the artifact path, language, primary diagram family when applicable,
motion decision, evidence refs, desktop/mobile evidence, changed-case result,
and limits. Artifact completion never proves learner understanding or mastery.

## HITL Composition Boundary

When a human must inspect, test, compare, judge, or approve something they do
not yet understand, Explain may provide the explanatory foundation before the
HITL action surface.

- Explain owns the whole-system map, causal mechanism, boundary, and changed
  case that let the human understand what is happening.
- The HITL page owns the human action, evidence capture, judgment policy,
  case/run history, handoff export, and multi-turn continuity.
- For an interactive course, render the explanatory foundation only after the
  upstream blind diagnostic permits it; Explain never supplies mastery status.
- Keep this composition optional and route-conditioned. Expert operators and
  pages whose evidence already supplies sufficient context should not pay for
  an extra explanation layer.

This skill owns no persistent runtime surface; put ad hoc intermediates under
`.tmp/`.
