# Design Rule System

Use this reference to review a draft, concrete design plan, or final result
with broad design coverage instead of taste-only comments.

## Target Register

Start by classifying what the surface should optimize:

- `brand`
  - memorability, point of view, distinctive first impression, and narrative
    fit
- `product`
  - task clarity, trust, state visibility, workflow speed, and repeat use
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

## Coverage Dimensions

Review every serious design across these dimensions:

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

## Rule Governance

Design rules should be register-aware:

- A quiet product tool may need dense tables and restrained typography.
- A brand page may need a stronger point of view and less conventional rhythm.
- A data surface should sacrifice decoration before it sacrifices comparison.
- A game may use atmosphere and motion that would be distracting in a CRM.

Avoid eternal taste bans. Time-sensitive generic-output tells should be
recorded with evidence and retired when the pattern no longer predicts weak
work.

## Review Method

Run the same rule system at three checkpoints:

1. draft review
   - Is the direction strong enough before implementation starts?
2. concrete design plan
   - Are tokens, geometry, components, states, assets, and responsive behavior
     specific enough to build without visual guessing?
3. result review
   - Did the rendered or generated result preserve tone, rules, reference tier,
     and accepted uncertainty?

A clean implementation cannot pass result review when the design packet's tone
or rule coverage regressed.
