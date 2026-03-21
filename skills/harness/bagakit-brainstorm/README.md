# bagakit-brainstorm

Brainstorm from Markdown context and convert ideas into an analysis + handoff package.

## What it does

- Extracts goals/constraints from Markdown input.
- Generates multiple idea options with trade-offs.
- Builds a decision matrix and recommends a path.
- Produces reusable stage artifacts (`input_and_qa.md`, `finding_and_analyze.md`, `expert_forum.md`, `outcome_and_handoff.md`).
- Produces a dedicated raw-discussion artifact (`raw_discussion_log.md`) so the summarized forum is not the only preserved discussion surface.
- Uses forum-centric design: all critical debate and convergence must be centralized in `expert_forum.md`.
- Uses question-card structure in `input_and_qa.md` so every user-facing clarification question is asked with the same readable shape.
- Keeps question cards low-noise and user-facing; detailed normalization stays in the raw discussion log.
- Uses a question ladder so brainstorm does not ask “whatever comes to mind”:
  - frame
  - blockers
  - branch splitters
  - detail expansion
  - final confirmation
- Adds memory-quality structure for future readability: canonical entity names, resolved references, time anchors, and source refs.
- Enforces an expert-forum completion gate (`discussion_clear: true`) before brainstorm can be complete.
- Keeps runtime artifacts sample-free: evidence/scoring tables ship with headers only, and obvious placeholder/example residue is blocked before completion.
- Anchors option generation to a compact frontier context and asks each expert to declare domain identity, frontier focus, and judgment boundaries.
- Supports forum modes: `deep_dive_forum`, `lightning_talk_forum`, `industry_readout_forum`.
- Uses warnings for frontier-quality gaps (stale/low-authority evidence, missing boundary statements, weak frontier context) instead of quota-style hard gates.
- In deep-dive/lightning modes, requires expert web references and 0~10 cross-scoring.
- Supports local experiment bonus (1~5) when experiments are recorded under `experimental/`.
- Supports optional deep-dive artifact (`related_insights.md`).
- Routes outputs via optional adapter contracts (`.bagakit/brainstorm/adapters/action/*.json`) or local fallback files.
- Writes archive records and moves completed artifacts into `.bagakit/brainstorm/archive/`.

## Quick Start

```bash
sh scripts/bagakit-brainstorm.sh init --topic "new feature" --root .
sh scripts/bagakit-brainstorm.sh init --topic "new feature" --root . --with-review-quality --with-eval-effect-review
sh scripts/bagakit-brainstorm.sh status --dir .bagakit/brainstorm/runs/<timestamp>--new-feature
sh scripts/bagakit-brainstorm.sh archive --dir .bagakit/brainstorm/runs/<timestamp>--new-feature --root .
sh scripts/bagakit-brainstorm.sh check-complete --dir .bagakit/brainstorm/runs/<timestamp>--new-feature --root .
```

Optional artifacts:

- `review_quality.md`
  - structured review packet for one brainstorm run
- `eval_effect_review.md`
  - structured discussion of whether the current eval stack helped, over-warned, or missed issues

Default support artifact:

- `raw_discussion_log.md`
  - append-only capture of original user questions/answers, expert disagreements, and decision updates
  - also carries memory-safe restatement fields so later sessions can understand the record without losing the raw wording
  - clarification prefers QA bundles so one question and its answer stay together

## Runtime Payload

This skill uses the directory itself as the runtime payload boundary.

The runtime entrypoint is:

- `SKILL.md`

## Maintainer Validation

Repository-owned validation for the canonical monorepo skill lives outside the
runtime payload under:

- `gate_validation/skills/harness/bagakit-brainstorm/`

Monorepo maintainers should run the normal repository validation entrypoint
from the repo root rather than treating repo-owned gate scripts as installed
runtime commands.
