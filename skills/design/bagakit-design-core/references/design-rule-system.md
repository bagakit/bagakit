# Design Rule System

Use this reference to review a draft, concrete design plan, or final result
with broad design coverage instead of taste-only comments.

## Target Register

Start by classifying what the surface should optimize:

- `brand`
  - memorability, point of view, distinctive first impression, and narrative
    fit
- `product`
  - user outcome, object clarity, task flow, trust, state visibility, workflow
    speed, recovery, and repeat use
- `tool`
  - density, low friction, predictable controls, keyboard/mouse ergonomics,
    and recoverability
- `editorial`
  - reading rhythm, hierarchy, source clarity, and restraint
- `game`
  - feedback, legibility under motion, atmosphere, and interaction feel
- `data`
  - comparison, precision, scale, filtering, drilldown, and uncertainty

Mixed surfaces should name which register wins in conflict.

## Product Model Before Pixels

For product-like surfaces, app shells, dashboards, settings, tools, and
stateful workflows, do not start from visual polish. First name:

- user need and product outcome
- primary object, secondary objects, and evidence or metadata objects
- current user context and first plausible action
- state-changing action, feedback, recovery path, and completion signal
- business, safety, accessibility, or domain constraint that changes the UI

This is the transferable part of "Product Design" for agents: it narrows the
design problem before style choices. A product UI can be beautiful, but it
fails if the user cannot tell what object is live, what state changed, what
happens next, or how to recover.

Brand surfaces may optimize memorability and point of view. Product surfaces
usually optimize earned familiarity, consistent components, readable density,
fast workflows, and confidence under repeated use. If a product surface uses a
surprising visual move, record the product value it creates.

## Reference And Industry Bar

Before accepting a direction, name the relevant reference family or industry
archetype and what strong work in that family tends to do well. Keep this as
transferable practice, not imitation:

- what information density, navigation, controls, and mobile behavior users
  already expect
- which best-in-class qualities must not be lost, such as comparison speed,
  editorial rhythm, canvas manipulation, brand memorability, or purchase
  confidence
- which qualities are unsafe to borrow because they depend on a different
  product model, brand promise, content source, legal boundary, or audience
- what the proposed design should exceed rather than merely match

If no good comparison is available, record the search gap and lower confidence
instead of pretending the design is frontier.

Use this bar as a user-experience contract. A strong design may depart from
the reference family, but it should be able to explain which user expectation
it preserves, which convention it improves, and why the departure helps the
task.

## Coverage Dimensions

Review every serious design across these dimensions:

- product outcome, user task, primary object, workflow, and success signal
- information architecture and object ownership
- visual hierarchy and first action
- typography scale, line length, rhythm, and contrast
- layout density, spacing, responsive adaptation, and scan path
- color semantics, contrast, state color, and palette drift
- component geometry, affordance shape, control grouping, and touch targets
- interaction states, empty/error/loading/disabled behavior, and recovery
- accessibility, keyboard/focus behavior, text fit, and reduced motion
- motion purpose, temporal continuity, and distraction risk
- copy economy, label clarity, status language, and AI-like filler
- icon semantics, consistency, fallback honesty, and decorative overload
- originality, signature detail, and reference-tier comparison
- implementation readiness and drift from the design packet

## Semantic Economy

Every major visual expression should own a distinct job. During review, ask:

- what object, state, action, decision, risk, or relationship this region
  represents
- whether repeated cards, icons, labels, metrics, panels, or CTAs duplicate
  the same concept
- whether a visual motif clarifies meaning or only decorates
- what can be merged, demoted, hidden, or moved into progressive disclosure
- whether the first screen exposes the core object, current state, first
  action, and next step without repeating prose

A design can be visually polished and still fail if its regions cannot explain
why they exist.

## Rule Governance

Design rules should be register-aware:

- A quiet product tool may need dense tables and restrained typography.
- A brand page may need a stronger point of view and less conventional rhythm.
- A data surface should sacrifice decoration before it sacrifices comparison.
- A game may use atmosphere and motion that would be distracting in a CRM.

Avoid eternal taste bans. Time-sensitive generic-output tells should be
recorded with evidence and retired when the pattern no longer predicts weak
work.

## Anti-Default Risk Scan

Use `anti-default-risk-scan.md` when the work is high-craft, generated,
reference-light, premium, frontier, or especially opinionated. This scan
should not say that a pattern is always forbidden. Each row should record:

- risk pattern, such as generic hero rhythm, repeated rounded cards, one-note
  palette, decorative icon noise, vague copy, stock-like image treatment, or
  pasted component defaults
- evidence in the brief, reference, draft, or implementation
- likely user harm: lower comprehension, weaker trust, slower workflow,
  brand drift, inaccessible state, or reduced memorability
- mitigation or redesign move
- `override_reason` when the pattern is intentionally kept
- checkpoint owner: draft, plan, or result review

Rules with no evidence become vibes. Risks with no override path become dogma.
Keep the scan sharp enough to catch weak default output while still allowing a
good designer to break the pattern deliberately.

## Review Method

Run the same rule system at three checkpoints:

1. draft review
   - Is the direction strong enough, and does any product model precede the
     visual choices?
2. concrete design plan
   - Are tokens, geometry, components, states, assets, and responsive behavior
     specific enough to build without visual guessing, and do they preserve
     the product objects and workflow?
3. result review
   - Did the rendered or generated result preserve tone, rules, reference tier,
     product-model commitments, and accepted uncertainty?

A clean implementation cannot pass result review when the design packet's tone
or rule coverage regressed.
