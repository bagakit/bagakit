# Intake Handoff And Core Veto

This reference defines the minimal Core adapter for consuming an
`intake_packet` from `bagakit-writing-intake`.

Core uses the packet as context for generic writing quality. Core does not
learn, store, rank, or enforce personal taste.

## Input Boundary

A well-formed `intake_packet` must provide:

- task route
- audience, channel, and genre
- source material state
- evidence ledger and privacy boundary
- language profile
- expression strengths and frictions
- protected spans
- style candidates
- rewrite-feedback rule candidates
- proposed Core veto risks
- handoff owner

Core treats these fields as advisory input unless they expose a generic quality
gate. The packet does not override Core checks. If a supplied packet is missing
required shape, broken evidence references, a privacy boundary, or known enum
values, Core treats it as unstable route context and asks Intake or the user for
the smallest repair before drafting.

## Core-Owned Decisions

Core owns the decision to proceed, pause, or veto when a task touches:

- foundation sufficiency
- evidence architecture and source parentage
- sample boundary and counterevidence
- content preservation and protected-span respect
- no-regression against source material and user intent
- title promise, structure, and claim/support quality
- clarity for the target audience
- task fitness for the requested artifact
- review packet completeness

These decisions are style-neutral. They should be expressed as concrete risks
against the task, not as taste preferences.

## Not Core-Owned

Core must not absorb:

- personal taste calibration
- voice imitation
- preferred metaphor density
- rewrite-feedback extraction from before/after samples into personal or
  style-specific candidate rules
- qihan-specific priority order
- Feishu layout defaults
- private sample retention rules beyond checking the declared boundary
- final style overlay selection when generic quality is already satisfied

Those belong to Intake, style overlays, delivery skills, or user instruction.

## Consumption Steps

1. Confirm packet scope.
   - Identify task route, audience, channel, genre, source material state, and
     handoff owner.
   - Validate `packet_version`, required top-level fields, evidence ids,
     `privacy_boundary`, and known enum values before consuming profile or style
     fields.
   - If route-critical fields are absent, fall back to Core's ordinary route
     memo flow instead of guessing from style fields.
2. Check provenance and privacy.
   - Use `evidence_ledger` and `privacy_boundary` only to understand evidence
     boundaries, retention constraints, and sample parentage.
   - Do not copy private samples into Core references, examples, or durable
     skill payloads.
3. Map packet fields to Core gates.
   - `source_material_state` maps to foundation sufficiency.
   - `evidence_ledger` and `privacy_boundary` map to evidence architecture,
     sample boundary, source parentage, and retention constraints.
   - `protected_spans` maps to content preservation and no-regression.
   - `audience`, `channel`, and `genre` map to clarity and task fitness.
   - `rewrite_feedback_rule_candidates` map to Core validation only for
     clarity, structure, evidence, semantic preservation, and no-regression.
   - `style_candidates` map only to handoff planning after Core gates pass.
4. Run Core review before style overlay.
   - Check foundation, evidence, content preservation, no-regression, clarity,
     and task fitness.
   - Record any veto before asking a style overlay to rewrite.
5. Handoff cleanly.
   - If Core passes, pass the packet plus Core notes to the selected overlay.
   - If Core vetoes, return the smallest fixable reason and the next owner.

## Intake Risk To Core Veto Map

Use this map when turning `core_risk_candidates[]` into Core review attention.
The candidate itself is not a veto until Core confirms it.

| Intake risk candidate | Core veto to consider |
| --- | --- |
| `semantic_drift` | `content_regression` |
| `evidence_loss` | `evidence_insufficient` |
| `task_mismatch` | `task_mismatch` |
| `unclear_audience` | `clarity_failure` |
| `weak_foundation` | `foundation_unstable` |
| `over_style` | `style_overrides_substance` |

## Core Vetoes

Use a Core veto when proceeding would make the artifact less correct, less
auditable, or less useful for its stated task.

Canonical veto kinds:

- `foundation_unstable`: object boundary, first question, or source material is
  not stable enough to draft.
- `evidence_insufficient`: claims outrun available source material,
  counterevidence, or sample boundary.
- `content_regression`: rewrite would drop required facts, constraints,
  implementation details, or user-provided meaning.
- `protected_span_risk`: protected wording, quotes, identifiers, or required
  terms would be altered without permission.
- `clarity_failure`: the target audience cannot understand the artifact without
  missing definitions, context, or examples.
- `task_mismatch`: the proposed artifact does not answer the requested route,
  channel, genre, or delivery need.
- `style_overrides_substance`: a style candidate would weaken evidence,
  semantics, structure, or task fitness.

## Veto Note Shape

When vetoing, record:

```text
core_veto:
  kind: <canonical veto kind>
  evidence: <packet field, source span, route memo item, or review finding>
  blocked_action: <draft, rewrite, style overlay, publish, or handoff>
  owner: <intake, core, style overlay, delivery skill, or user>
  smallest_next_action: <one concrete repair>
```

The veto note should not include personal taste claims. If the concern is only
"this is not the preferred voice," hand it to Intake or the selected style
overlay instead of treating it as a Core veto.
