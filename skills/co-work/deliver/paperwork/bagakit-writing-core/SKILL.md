---
name: bagakit-writing-core
description: Provide generic writing-quality routing, structure, evidence,
  semantic-preservation, de-AI-tone, and review primitives when no
  style-specific or delivery skill owns the task, or as the paperwork L1 core.
metadata:
  bagakit:
    paperwork_layer: l1-core
---

# Bagakit Writing Core

Core owns generic writing quality and contributes one composed Core review.
The selected L2 delivery skill remains the final publishability authority for
its artifact; Core does not silently replace an article, channel, or personal
style gate. De-AI-tone is its focused peer for AI-tone and protected-span
analysis; invoke it through Core for final prose, then use the result as one
composed finding set rather than duplicating a second lexicon or rewrite audit.

`bagakit-writing-core` is the reusable writing foundation for the `paperwork`
family.

It exists because the strongest writing mechanics in the family should not be
locked inside one style-specific skill.

## Boundary

This skill owns generic writing primitives:

- task routing before drafting
- intake packet consumption from `bagakit-writing-intake`
- foundation sufficiency checks
- title promise and title-pattern discipline
- structure, paragraph movement, and claim/support quality
- terminology stability, referent and actor clarity, instruction atomicity,
  and reader-burden review
- evidence architecture, source parentage, sample boundary, and counterevidence
- content preservation, no-regression checks, task fitness, and Core vetoes
- Core rule metadata for reusable generic writing checks
- de-AI-tone orchestration through `bagakit-writing-de-ai-tone`
- prose-mechanics lint and publishable-prose review discipline
- Core validation of Intake-extracted rewrite-feedback rule candidates for
  clarity, structure, evidence, semantic preservation, and no-regression
- generic longform review, audience-fit checks, optional portfolio/series
  structure review, and review packet shape
- anti-rationalization discipline for common agent excuses

It does not own:

- personal taste calibration
- personal language profile distillation
- qihan-specific Chinese longform defaults
- Feishu or channel-specific layout
- a technical article delivery envelope
- PDF, HTML, slide, or book export
- research source capture

Those belong to L2 skills or peer systems.

## Relationship To L2 Skills

Use this core as the L1 writing substrate.

- `bagakit-writing-intake`
  - owns diagnostic intake, evidence ledger, privacy boundary, personal
    language profile distillation, style candidates, rewrite-feedback rule
    candidate extraction, and handoff owner
  - emits an `intake_packet` that Core may consume as route context
  - does not decide generic publishability, evidence sufficiency, semantic
    preservation, no-regression, or Core veto outcomes

- `bagakit-writing-de-ai-tone`
  - owns AI-tone detection, protected-span handling, rewrite protocol,
    bilingual lexicon, profile exceptions, and script-backed de-AI-tone lint
  - does not replace core-owned title, evidence, structure, audience, or
    longform review decisions
  - supplies one tone review within the composed final review; a separate CLI
    pass is useful for long prose, explicit audits, or identified tone risk

- `qihan-writing`
  - owns personal Chinese-writing taste, priority order, channel defaults, and
    personal rewrite cases
- `bagakit-paperwork-technical-writing`
  - owns `article.md`, `execution_appendix.md`, `review_report.md`, engineering
    evidence, baseline regression, and profile-specific hard gates

L2 skills should remain standalone-first. If this core is absent in a host
install, the L2 should either use its documented fallback or ask selector to
compose the core explicitly.

## Workflow

Use one composed final review, scaled to the requested artifact. For a short
edit, preserve meaning and review the changed passage directly; do not create a
route memo or longform report merely to activate this skill.

Prefer literal wording when it states the meaning clearly. Keep an analogy
only when it makes a relationship easier to understand and preserves its
limits; see `references/writing/PRECISION_AND_READER_BURDEN.md`.

- For an unclear writing route, consult
  `references/workflow/OPERATING_SURFACE_MATRIX.md`. Consume a supplied Intake
  packet through `references/workflow/INTAKE_HANDOFF_AND_CORE_VETO.md`.
- For an uncertain foundation, use the existing route/foundation checker; do not
  require a new memo when the reader, evidence, and intended action are clear.
- For structure or title decisions, read `references/writing/NARRATIVE_ANGLE_SELECTION.md`
  and its review heuristic only when those choices are unresolved.
- Review protected facts, claim support, clarity, and tone once. Use
  `bash scripts/bagakit-writing-core-cli.sh de-ai-tone lint --profile <profile> <artifact.md>`
  for an explicit tone audit, long prose, or identified tone risk. Run
  `scripts/writing_core_lint.py` for applicable mechanics, not to duplicate a
  downstream check on the same unchanged text.
- For substantial rewrites with a baseline, compare retained meaning and use
  `scripts/writing_core_inventory.py compare` when an inventory adds evidence.
- Use the longform rubric and hard-metric references for full articles, and
  portfolio review only for multiple related articles.

Reuse current receipts for unchanged text. Repeat a check only after a relevant
edit, a new material failure, or a changed acceptance criterion. L2-specific
facts and publication conditions remain with their L2 owner; combine them with
Core findings in one result instead of running a second generic review stack.

## Runtime Surface Declaration

- top-level Bagakit runtime surface roots:
  - none by default
- this skill works through installed references, templates, scripts, and
  explicit task outputs
- stable contract:
  - `docs/specs/runtime-surface-contract.md`

## Commands

```bash
bash scripts/bagakit-writing-core-cli.sh validate
bash scripts/bagakit-writing-core-cli.sh list-references
bash scripts/bagakit-writing-core-cli.sh lint --fail-on warn <artifact.md>
bash scripts/bagakit-writing-core-cli.sh de-ai-tone lint --profile blog <artifact.md>
bash scripts/bagakit-writing-core-cli.sh route check-foundation <route-memo.md>
bash scripts/bagakit-writing-core-cli.sh route review-foundation <artifact.md>
bash scripts/bagakit-writing-core-cli.sh rules validate
bash scripts/bagakit-writing-core-cli.sh inventory compare <source.md> <rewrite.md> --fail-on risk
bash scripts/bagakit-writing-core-cli.sh print-review-packet-template
bash scripts/bagakit-writing-core-cli.sh print-intake-handoff
```

## References

- `references/README.md`
- `references/workflow/INTAKE_HANDOFF_AND_CORE_VETO.md`
- `references/workflow/OPERATING_SURFACE_MATRIX.md`
- `references/rules/core-rule-registry.toml`
- `references/knowledge/PRE_DRAFT_ROUTE_MEMO_TEMPLATE.md`
- `references/writing/AI_SMELLS.md`
- `references/writing/PRECISION_AND_READER_BURDEN.md`
- `references/writing/STRUCTURE_PYRAMID.md`
- `references/review/QA_HARD_METRICS.md`
- `references/review/ANTI_RATIONALIZATION_TABLE.md`
- `references/review/REVIEW_PACKET_TEMPLATE.md`
- `references/review/PORTFOLIO_REVIEW.md`
