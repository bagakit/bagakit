# Design Core Artifact Contract

Use these names when a task needs durable design reasoning artifacts.

Recommended root:

- `.bagakit/design/<task-slug>/`

The task-level source of truth is:

- `design-packet.toml`

Markdown files in this root are review projections or evidence notes. They
should summarize decisions, blockers, and rationale without duplicating packet
state as an independently editable source of truth.

## Required Files

- `target-register.md`
  - surface class, audience, purpose, optimization target, and what the design
    must not optimize for
- `source-evidence.md`
  - inspected sites, screenshots, generated references, code tokens, assets,
    user direction, confidence, and missing evidence
- `tone-axis-map.toml`
  - concrete axes for palette, type, density, material, radius, motion, icon
    geometry, copy voice, and fallback confidence
- `rule-coverage-map.md`
  - coverage across hierarchy, information architecture, typography, layout,
    color, interaction states, accessibility, motion, copy, and generic-output
    risks
- `design-packet.toml`
  - structured SSOT for design decisions, evidence refs, confidence, accepted
    uncertainty, blockers, and downstream consumption hints
- `draft-checkpoint-review.md`
  - review of the proposed design direction before implementation
- `plan-checkpoint-review.md`
  - review of the concrete implementation/design plan before build work
- `result-checkpoint-review.md`
  - review of the final rendered or generated result against the packet
- `handoff.md`
  - final refs, unresolved blockers, accepted trade-offs, and next action

## Optional Files

- `first-frame-composition.md`
  - first viewport background field, focal subject, relation layer, safe text
    zone, motion, responsive behavior, and asset honesty
- `visual-language-profile.md`
  - tokens, component treatment, surface depth, icon style, image style, and
    content voice inferred from evidence
- `reference-tier-map.md`
  - comparable references, comparison tier, cannot-lose qualities, and
    downgrade rationale if the target bar changes
- `rights-boundary-ledger.md`
  - proprietary assets, user-provided assets, fallback substitutions, and
    redistribution risks

## Packet Semantics

`design-packet.toml` should carry:

- `schema_version = 1`
- `target_register`
- `source_evidence_refs`
- `tone_axis_ref`
- `rule_coverage_ref`
- `checkpoint_refs`
- `known_blockers`
- `accepted_uncertainty`
- `downstream_hints`

Do not store absolute filesystem paths in these artifacts. Use repo-relative
paths, logical artifact names, or external source ids such as
`github:owner/repo@commit`.
