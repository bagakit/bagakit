---
name: bagakit-writing-de-ai-tone
description: Use when a writing task needs AI-tone detection, protected-span handling, bilingual lexicon review, or meaning-preserving rewrite guidance.
metadata:
  bagakit:
    harness_layer: l1-writing-primitive
---

# bagakit-writing-de-ai-tone

This skill owns only AI-tone, protected spans, and meaning-preserving rewrite
checks. For publishable prose, Writing Core is the primary owner and composes
this pass; standalone invocation is for explicit tone review or rewrite work.

Use this skill when the task is to remove AI-toned writing patterns from
Chinese or English prose.

This is a paperwork L1 primitive. It is not a personal style profile and not a
technical-writing workflow. `bagakit-writing-core` composes this skill for
publishable prose review; L2 skills should normally reach it through core.

## Scope

Owns:

- AI-tone detection and rewrite protocol
- Chinese and English AI-smell lexicon
- protected-span preflight for commands, paths, code, URLs, dates, metrics,
  versions, API symbols, quoted sources, product/UI labels, and
  responsibility-bearing identifiers
- structural AI tells: uniform rhythm, template phrases, fake contrast,
  parallelism without information gain, vague authority, PR inflation
- importance-ranking meta language that announces what is “most important”
  instead of letting evidence carry the judgment
- preservation of first-person corrections, error admissions, changed
  judgments, and explicit uncertainty during rewrites
- AI-tone overlap with hidden actions or decorative nominalization, while
  generic terminology, referent, actor, and instruction clarity remain owned
  by `bagakit-writing-core`
- context profile exceptions for technical, docs, blog, social, and casual prose
- scene packs for chat, status, docs, public-writing, and technical prose

Does not own:

- title promise, evidence architecture, route memo, audience inference, or
  longform review
- qihan personal taste
- technical article fact verification or execution handoff
- detector evasion or claims that a text is human-authored

## Default Workflow

1. Detect the dominant language and profile.
2. Detect or infer the scene pack.
3. Load `references/protected-spans.md` and preserve hard-information spans.
4. Load `references/rewrite-protocol.md`.
5. For detailed pattern examples, load `references/patterns.md`.
6. For word-level checks or script-backed audit, use
   `scripts/bagakit-writing-de-ai-tone-cli.sh lint` or the detection alias
   `scripts/bagakit-writing-de-ai-tone-cli.sh detect`.
7. In rewrite mode, produce:
   - issues found
   - protected spans and scene assumption
   - rewritten version
   - change summary
   - second-pass audit
   - a precision cross-check for stable terms, actors, referents, sequence,
     qualifiers, protected facts, and author-owned corrections

## Modes

- `detect`: identify AI-tone issues only; group by P0/P1/P2.
- `rewrite`: detect, rewrite, summarize changes, then run a second-pass audit.

The CLI implements detection, validation, reference printing, and
`rewrite-plan`. It does not automatically rewrite prose; rewrite mode is an
agent protocol or downstream workflow contract.

If the original text is already strong, say so and avoid unnecessary edits.
De-AI-tone work should remove fake polish, not flatten useful voice.

## Required Quality Rule

For final prose, include tone and protected-meaning review in the owning
writing review. A short edit may use direct inspection. Run a separate lint
command for explicit tone audits, long prose, or identified tone risk; reuse
current Core receipts instead of repeating the same pass.

Research notes, route memos, source excerpts, and private scratch artifacts may
skip this pass.

## Runtime Surface Declaration

- top-level Bagakit runtime surface roots:
  - none by default
- this skill works through installed references, scripts, and explicit task
  outputs
- stable contract:
  - `docs/specs/runtime-surface-contract.md`

## CLI

```bash
bash scripts/bagakit-writing-de-ai-tone-cli.sh lint --profile blog --scene public-writing --fail-on warn artifact.md
bash scripts/bagakit-writing-de-ai-tone-cli.sh detect --profile casual --fail-on warn note.md
bash scripts/bagakit-writing-de-ai-tone-cli.sh rewrite-plan
bash scripts/bagakit-writing-de-ai-tone-cli.sh print-rewrite-protocol
bash scripts/bagakit-writing-de-ai-tone-cli.sh print-protected-spans
```

`ADVISORY` findings should guide rewriting but should not block by themselves.

## Bagakit Footer

When reporting a standalone de-AI-tone pass, use:

```text
[[BAGAKIT]]
- DeAITone: Mode=<detect|rewrite>; Profile=<blog|technical|docs|social|business|internal-share|casual>; Gate=<pass|warn|fail>; Evidence=<lint/report>; Next=<next deterministic action>
```
