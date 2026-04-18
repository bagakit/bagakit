---
name: bagakit-design-core
description: Use when a design task needs brand-tonality extraction, design-rule coverage, reference-tier reasoning, or review of a design draft, concrete design plan, or final result. Compose with web, Figma, image-generation, or implementation skills; do not use it alone to claim shipped code.
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
- comparable-reference inspection before a draft is accepted
- design-rule review beyond taste, including hierarchy, density, copy,
  interaction states, accessibility, and generic-output risks
- review of a design draft, implementation plan, or final rendered result
- a reusable design packet for another skill to consume

Do not use it for pure implementation, backend work, one-line UI tweaks, or
early ambiguous ideation that still needs `bagakit-spark`.

## Operating Spine

1. `target-register`
   - classify the surface as brand, product, editorial, tool, game, data, or
     mixed; state what design should optimize
2. `source-evidence`
   - inspect provided sites, screenshots, generated references, code tokens,
     assets, or user direction before asking for style opinions
3. `brand-tonality`
   - map adjectives to observable axes: palette temperature, chroma, density,
     typography, surface depth, radii, motion, icon geometry, and voice
4. `design-rule-coverage`
   - review hierarchy, information architecture, typography, layout, color,
     interaction states, accessibility, motion, copy, and generic-output tells
5. `design-packet`
   - write one structured packet as the task SSOT; Markdown reviews are
     narrative projections, not duplicate state
6. checkpoint reviews
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
