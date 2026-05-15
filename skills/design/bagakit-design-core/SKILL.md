---
name: bagakit-design-core
description: Use when a design task needs brand-tonality extraction, product-model reasoning, design-rule coverage, reference-tier reasoning, or review of a design draft, concrete design plan, or final result. Compose with web, Figma, image-generation, or implementation skills; do not use it alone to claim shipped code.
metadata:
  bagakit:
    design_layer: core
---

# Bagakit Design Core

`bagakit-design-core` is the medium-neutral design reasoning layer for
Bagakit. It turns brand evidence, comparable references, and design rules into
a reviewable design packet before another skill implements the result.

The skill is intentionally not a webpage builder. It owns design judgment,
tonality, reference-tier comparison, design-rule coverage, and three checkpoint
reviews. Implementation skills own code, browser evidence, and delivery.

## When To Use

Use this skill when a task needs:

- brand or product tonality translated into concrete design axes
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

1. `design-read`
   - record surface kind, audience, task, vibe, reference/system family,
     constraints, and unknowns
2. `target-register`
   - classify the surface as brand, product, editorial, tool, game, data, or
     mixed; state what design should optimize
3. `product-model`
   - for product-like work, record users, product outcome, primary objects,
     workflow, state changes, feedback, recovery, and completion signal before
     choosing pixels
4. `source-evidence`
   - inspect the strongest available context: brand, design-system, code,
     screenshots, comparable references, assets, or explicit greenfield intent
     before choosing an aesthetic direction
5. `brand-tonality`
   - map adjectives to observable axes: palette temperature, chroma, density,
     typography, surface depth, radii, motion, icon geometry, and voice; for
     high-craft work also record variance, motion, and density dials
6. `design-rule-coverage`
   - review hierarchy, information architecture, typography, layout, color,
     product model fit, interaction states, accessibility, motion, copy,
     semantic economy, reference-tier fit, and generic-output risks with
     override reasons
7. `design-packet`
   - write one structured packet as the task SSOT; Markdown reviews are
     narrative projections, not duplicate state
8. checkpoint reviews
   - review the draft, the concrete design plan, and the final result against
     the same packet before accepting completion

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

Stable contract:

- `docs/specs/runtime-surface-contract.md`
