# Bagakit Writing Core

Generic writing-quality primitives for the Bagakit `paperwork` family.

Use this skill when a writing task needs route, foundation, structure,
evidence, de-AI-tone orchestration, prose-mechanics, rewrite-feedback, or review discipline
without adopting a personal writing style or a delivery-specific artifact
envelope.

This is an L1 paperwork core. It is meant to be reused by L2 skills such as:

- `qihan-writing`
- `bagakit-paperwork-technical-writing`
- `bagakit-writing-de-ai-tone` as the required L1 primitive for publishable
  prose polish

It is not a book exporter, PDF generator, Feishu layout skill, or personal
style profile.

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
bash scripts/bagakit-writing-core-cli.sh lint --fail-on warn artifact.md
bash scripts/bagakit-writing-core-cli.sh de-ai-tone lint --profile blog artifact.md
bash scripts/bagakit-writing-core-cli.sh route check-foundation route-memo.md
bash scripts/bagakit-writing-core-cli.sh route review-foundation artifact.md
bash scripts/bagakit-writing-core-cli.sh rules validate
bash scripts/bagakit-writing-core-cli.sh inventory compare source.md rewrite.md --fail-on risk
bash scripts/bagakit-writing-core-cli.sh print-review-packet-template
bash scripts/bagakit-writing-core-cli.sh print-anti-rationalization-table
```

For final prose, public-facing summaries, rewritten drafts, titles, abstracts,
and review reports, core MUST run the de-AI-tone pass unless the user explicitly
asks for raw notes or detect-only output.

L2 skills should call these commands explicitly through composition or their
own `core` dispatch. The core should not silently inherit an L2's personal style
or delivery envelope.
