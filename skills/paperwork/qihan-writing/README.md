# qihan-writing

Writing and rewrite skill for producing technical, research, and execution-facing
documents in a sharp, evidence-first style with low AI smell.

## What problem this skill solves

Many drafts are structurally correct but still weak in three places:

- conclusions arrive too late
- claims are hard to verify
- the prose keeps project-specific jargon, filler, or AI-ish scaffolding
- the article runs on the wrong narrative spine even when the materials are good

`qihan-writing` turns those problems into an explicit runtime workflow:

- identify the writing scenario first
- choose a narrative angle before drafting longform text
- force evidence and mechanism ahead of vague praise
- absorb user rewrites as reusable rules
- run a lightweight lint pass before publishing or long-term storage
- review longform drafts with an explicit rubric instead of relying on taste alone

## What ships in this skill

- `SKILL.md`
  runtime workflow and hard style constraints
- `references/README.md`
  grouped index for workflow, writing, knowledge, and review
- `references/*`
  workflow rules, writing rules, knowledge assets, and review standards
- `references/writing/NARRATIVE_ANGLE_SELECTION.md`
  angle-selection guide that separates workflow lane choice from article spine choice
- `references/writing/NARRATIVE_ANGLE_REVIEW_HEURISTIC.md`
  pre-draft routing heuristic for picking the right narrative-angle card
- `references/writing/narrative-angles/*`
  reusable narrative-angle cards with frontmatter-scoped fit signals, representative articles, and mini reverse outlines
- `scripts/qihan_write_lint.py`
  objective markdown checks for structure, list ratio, AI-ish wording, negation-crutch overuse, and local-path leakage
- `agents/openai.yaml`
  runtime metadata for agent surfaces that read agent descriptors

## Runtime Surface Declaration

- top-level Bagakit runtime surface roots:
  - none by default
- this skill operates through its installed payload, references, and explicit
  output targets rather than one Bagakit-owned persistent runtime root
- stable contract:
  - `docs/specs/runtime-surface-contract.md`

## Reference layout

- `references/workflow`
  route the task, choose the lane, govern interaction, run insight loop, absorb rewrites
- `references/writing`
  voice, angle selection, angle review, structure, layout, tone, POV, and no-regression rules
- `references/knowledge`
  evidence architecture, research template, interview record template, and rewrite casebook
- `references/review`
  lint-facing metrics, longform rubric, and review template

## Notes on examples

The rewrite examples are preserved because the sentence-level differences are the
useful part of the skill. Names and identifiable mechanism labels have been
de-identified so the package can be shared without carrying project-specific
identifiers into the runtime payload.

## Common usage

```bash
python3 scripts/qihan_write_lint.py article.md
```

Exit code semantics:

- `0`: no findings
- `2`: warnings or failures found
