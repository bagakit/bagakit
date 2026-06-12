---
name: bagakit-design-core
description: Use for design tone, product-model, design-rule, reference-tier, or draft/result review. Compose with implementation skills; do not claim shipped code.
metadata:
  bagakit:
    design_layer: core
---

# Bagakit Design Core

This skill owns design judgment and the reviewable design packet. It does not
own human workflow semantics or frontend delivery: hand a page-purpose problem
to HITL and a build/browser-proof problem to Codex Webpage Design.

`bagakit-design-core` is the medium-neutral design reasoning layer for
Bagakit. It turns brand evidence, comparable references, and design rules into
a reviewable design packet before another skill implements the result.

The skill is intentionally not a webpage builder. It owns design judgment,
tonality, reference-tier comparison, and design-rule coverage. Use a compact
review route for a local question; materialize a design packet only when the
result must be handed to another skill, retained, or reviewed at a meaningful
quality boundary. Implementation skills own code, browser evidence, and
delivery.

## When To Use

Use this skill when a task needs:

- brand or product tonality translated into concrete design axes
- a vague brief, concept, or reference set read into design-relevant project
  logic before visual choices
- product-like work shaped by users, outcomes, objects, workflow, states, and
  success signals before visual choices
- comparable-reference inspection before a draft is accepted
- design-rule review beyond taste, including hierarchy, density, copy,
  interaction states, accessibility, and generic-output risks
- review of a design draft, implementation plan, or final rendered result
- a reusable design packet for another skill to consume

Do not use it for pure implementation, backend work, one-line UI tweaks, or
early ambiguous ideation that still needs `bagakit-spark`.

## Operating Spine

Choose the smallest route that answers the request:

- `quick-review`: inspect the relevant evidence and return a bounded design
  judgment without creating a durable packet
- `packet`: create the baseline packet when another skill needs it, the work is
  brand/system or high-risk, or the user asks for a reusable handoff

For the `packet` route, keep the three checkpoint artifacts as short deltas
against the same packet; they are not three independent reviewer rounds. Add
the conditional stages only when their trigger applies.

1. `design-read` — baseline for a packet; for a quick review, keep it in the
   review notes
   - record surface kind, audience, task, vibe, reference/system family,
     constraints, unknowns, and whether the brief is clear enough for design
     judgment or needs an explicit clarification route
2. `target-register` — baseline for a packet
   - classify the surface as brand, product, editorial, tool, game, data, or
     mixed; state what design should optimize
3. `product-model` — only for product-like, tool-like, data-heavy,
   workflow-heavy, or interactive work
   - record users, product outcome, primary objects,
     workflow, state changes, feedback, recovery, and completion signal before
     choosing pixels
4. `source-evidence` — baseline for a packet; for a quick review, inspect only
   the evidence relevant to the decision
   - inspect the strongest available context: brand, design-system, code,
     screenshots, comparable references, assets, or explicit greenfield intent
     before choosing an aesthetic direction
5. `brand-tonality` — when brand, product, website, screenshot, generated
   design, or named visual direction exists
   - map adjectives to observable axes: palette temperature, chroma, density,
     typography, surface depth, radii, motion, icon geometry, and voice; for
     high-craft work also record variance, motion, and density dials
6. `design-rule-coverage` — baseline for a packet; scope the review to the
   requested surface and risk
   - review hierarchy, information architecture, typography, layout, color,
     product model fit, interaction states (including the selected-state
     signal rule), accessibility, motion, copy, semantic economy,
     reference-tier fit, and generic-output risks with override reasons
7. `design-packet` — only on the `packet` route
   - write one structured packet as the task SSOT; Markdown reviews are
     narrative projections, not duplicate state
8. checkpoint reviews — on the `packet` route, review draft, concrete plan,
   and result against the same packet; keep each review concise and record
   `not_applicable` when a requested phase does not exist instead of running a
   separate workflow

## Composition

Compose by artifact contract, not by hard dependency.

- This skill may write `.bagakit/design/<task-slug>/design-packet.toml`.
- A peer skill may consume that packet when present.
- If the packet is absent, the peer skill must remain self-contained and use
  its local fallback rules.
- This skill does not call a peer implementation flow as a required step.

## Runtime Surface Declaration

Owns `.bagakit/design/` when a repository materializes project-local design
synthesis, design packets, or review artifacts.

Root-adjacent protocol files: none.

Read `references/design-rule-system.md` for the full review dimensions,
selected-state signal rule, and evidence-bound anti-default risk handling.

Stable contract:

- `docs/specs/runtime-surface-contract.md`
