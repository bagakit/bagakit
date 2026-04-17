# Bagakit Paperwork Technical Writing

Technical-writing L2 skill for turning technical notes, drafts, and transcripts
into publishable article outputs plus execution-ready handoff material.

Use `bagakit-writing-core` for generic writing mechanics: route, foundation,
structure, evidence architecture, de-AI-tone orchestration, rewrite feedback,
and review packet shape. The canonical AI-tone taxonomy and bilingual lexicon
live in `bagakit-writing-de-ai-tone`; this L2 reaches that primitive through
core.

This skill owns the technical article delivery envelope:

- `article.md`
- `execution_appendix.md`
- `review_report.md`
- technical profile budgets and hard gates
- engineering evidence, baseline regression, and source-parentage reporting

It remains standalone-first. If the sibling core is not installed, use the
bundled local references and checker, then record that core composition was
unavailable.

## Commands

```bash
bash scripts/bagakit-paperwork-technical-writing-cli.sh validate
bash scripts/bagakit-paperwork-technical-writing-cli.sh core describe
bash scripts/bagakit-paperwork-technical-writing-cli.sh check-article --input article.md --profile general --strict
bash scripts/bagakit-paperwork-technical-writing-cli.sh print-review-packet-template
```

The `core` command dispatches to the sibling `bagakit-writing-core` CLI when it
is installed next to this skill.

## Runtime Surface Declaration

- top-level Bagakit runtime surface roots:
  - none by default
- this skill writes explicit working-directory outputs instead of owning one
  Bagakit persistent runtime root
- stable contract:
  - `docs/specs/runtime-surface-contract.md`
