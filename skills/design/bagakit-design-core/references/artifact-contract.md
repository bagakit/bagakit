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

- `design-read.md`
  - compact read before design judgment: surface kind, audience, user task,
    current or desired vibe, reference/system family, constraints, and
    accepted unknowns
- `target-register.md`
  - surface class, audience, purpose, optimization target, and what the design
    must not optimize for
- `source-evidence.md`
  - context route, inspected sites, screenshots, generated references, code
    tokens, assets, user direction, confidence, and missing evidence; if the
    task is greenfield, record the explicit aesthetic starting point instead
    of pretending existing system evidence exists
- `tone-axis-map.toml`
  - concrete axes for palette, type, density, material, radius, motion, icon
    geometry, copy voice, and fallback confidence
- `rule-coverage-map.md`
  - coverage across hierarchy, information architecture, typography, layout,
    color, product-model fit, interaction states, accessibility, motion, copy,
    and generic-output risks
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

- `product-model-map.md`
  - required when the surface is product-like, tool-like, data-heavy,
    workflow-heavy, or interactive; records users, product outcome, primary and
    secondary objects, current context, first action, state-changing action,
    feedback, recovery, completion signal, and constraints that should shape
    the interface before visual style
- `first-frame-composition.md`
  - first viewport background field, focal subject, relation layer, safe text
    zone, motion, responsive behavior, and asset honesty
- `visual-language-profile.md`
  - reusable visual-system vocabulary inferred from evidence: color roles with
    source names and usage, type scale, spacing scale, radius, shadow, motion,
    component variants, states, accessibility hooks, do/don't rules, surface
    depth, icon style, image style, and content voice
- `reference-tier-map.md`
  - comparable references, comparison tier, cannot-lose qualities, and
    downgrade rationale if the target bar changes
- `rights-boundary-ledger.md`
  - proprietary assets, user-provided assets, fallback substitutions, and
    redistribution risks
- `brand-system-board.md`
  - required when identity or brand-system work matters; records strategy,
    metaphor, logo logic, palette, typography, application examples, image
    direction, and reference-transfer limits
- `anti-default-risk-scan.md`
  - required for high-craft, generated-reference, reference-light, or
    frontier/premium work; records generic-output risks with evidence,
    consequence, mitigation, and `override_reason` rather than hard taste bans

## Packet Semantics

`design-packet.toml` should carry:

- `schema_version = 1`
- `design_read_ref`
- `target_register`
- `product_model_ref`
  - use `not_needed` only when the surface is not product-like, tool-like,
    data-heavy, workflow-heavy, or interactive
- `source_evidence_refs`
- `tone_axis_ref`
- `taste_dials`
- `brand_system_board_ref`
- `rule_coverage_ref`
- `anti_default_risk_ref`
- `checkpoint_refs`
- `known_blockers`
- `accepted_uncertainty`
- `downstream_hints`

Do not store absolute filesystem paths in these artifacts. Use repo-relative
paths, logical artifact names, or external source ids such as
`github:owner/repo@commit`.
