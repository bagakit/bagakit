# Design Rule Synthesis

Source note:

- `github:pbakaus/impeccable@1aedbcf538e3fa6694ccbf00294cc18e59ba1f21`

This file records Bagakit's local synthesis from the reference project. It is
not a runtime dependency and does not mirror the reference project's taxonomy.

## Bagakit Takeaways

Design review should start from context:

- what register the surface belongs to
- who uses it
- what the surface should optimize
- which comparable references define the bar
- which existing tokens, components, and assets constrain the result

Then review the whole surface, not only the visible polish:

- information architecture and object ownership
- hierarchy, first action, and workflow legibility
- typography, layout rhythm, density, and responsive behavior
- color semantics, contrast, and state treatment
- component geometry, affordance grouping, focus, and touch targets
- loading, empty, error, disabled, hover, selected, and modal states
- motion purpose and reduced-motion fallback
- copy economy and AI-like filler
- icon semantics and decorative noise
- accessibility, text fit, and implementation readiness
- originality and comparison against the stated reference tier

## Runtime Use

`bagakit-design-core` should apply the same rule map at three checkpoints:

- Draft Review
- concrete design plan review
- result review

Rules are register-aware. Brand pages may need memorability and point of view;
product tools may need density and predictable state; data views may need
comparison over decoration. A rule that helps one register can weaken another.
