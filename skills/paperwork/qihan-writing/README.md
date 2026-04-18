# qihan-writing

Writing and rewrite skill for producing technical, research, and execution-facing
documents in a qihan style: concise, deep, metaphor-aware, hopeful where earned,
alert to risk, evidence-first, and low AI smell.

`qihan-writing` is a paperwork L2 overlay.

Use `bagakit-writing-core` for generic route, foundation, structure, evidence,
de-AI-tone orchestration, lint, and review primitives. The canonical AI-tone
taxonomy and bilingual lexicon live in `bagakit-writing-de-ai-tone`; qihan
normally reaches that primitive through core. This skill keeps the qihan-specific
Chinese-writing defaults: personal taste calibration, preferred priority order,
the qihan style north star, Feishu-oriented layout guidance, accepted rewrite
examples, and the stricter publish bar for the user's own longform writing.

The skill remains standalone-first. If the sibling core is not installed, use
the bundled local references and scripts, then record that core composition was
unavailable.

The bundled generic references are fallback-only copies. They are present so
the L2 can still run in a host that has not installed `bagakit-writing-core`;
they are not parallel authority. Generic route, structure, evidence, lint, and
review changes should sync from `bagakit-writing-core`; AI-tone taxonomy should
sync from `bagakit-writing-de-ai-tone`; qihan-specific overlays stay local.

## What problem this skill solves

Many drafts are structurally correct but still weak in three places:

- conclusions arrive too late
- claims are hard to verify
- the prose keeps project-specific jargon, filler, or AI-ish scaffolding
- the article runs on the wrong narrative spine even when the materials are good

`qihan-writing` turns those problems into an explicit runtime workflow:

- identify the writing scenario first
- route the operator through one visible operating surface before drafting
- choose a narrative angle before drafting longform text
- escalate into deeper research when the article foundation is weak instead of forcing a card choice
- force evidence and mechanism ahead of vague praise
- review longform drafts against the qihan north star: density, mechanism,
  mapping, agency, and alertness
- absorb user rewrites as reusable rules
- run a lightweight lint pass by default before non-trivial final delivery,
  including rewrites, review / polish outputs, Feishu drafts, external sharing,
  long-term storage, or any markdown artifact that can be checked
- run a plain-language pass so no-context readers can understand the object,
  claim, and next action without guessing from private context
  也就是做一次大白话自检：无上下文读者能否复述对象、核心判断和下一步
- review longform drafts with an explicit rubric and a multi-role quiet-room panel instead of relying on taste alone

## Operator route

- `Must do`
  Open `references/workflow/OPERATING_SURFACE_MATRIX.md` first. It is the authoritative router.
- `Must read before non-trivial drafting`
  Follow the route-scoped must-read set defined in `references/workflow/OPERATING_SURFACE_MATRIX.md`. Do not reconstruct your own reading list from scattered docs.
- `Escalate when foundation is weak`
  If you cannot state a stable article promise, first question, object boundary, or evidence shape, switch to `references/workflow/DEPTH_ESCALATION_LOOP.md` and use its packet / handoff route before you return to card selection.

## What ships in this skill

- qihan overlay instructions for Chinese longform taste and channel defaults
- qihan-specific style north-star rules for density, mechanism, mapping,
  agency, and alertness
- fallback-only local copies of the generic route, structure, evidence, lint,
  and review primitives, synced from `bagakit-writing-core` rather than owned
  as a second truth source
- qihan-specific rewrite examples and accepted style calibration
- one operator route for starting, escalating, and reviewing when used
  standalone

File-level inventory stays in `references/README.md`.

## Runtime Surface Declaration

- top-level Bagakit runtime surface roots:
  - none by default
- this skill operates through its installed payload, references, and explicit
  output targets rather than one Bagakit-owned persistent runtime root
- stable contract:
  - `docs/specs/runtime-surface-contract.md`

## Reference layout

- `references/workflow`
  route the task, choose the lane, govern interaction, decide depth escalation, run insight loop, absorb rewrites
- `references/writing`
  voice, qihan north star, inline-code discipline, angle selection, angle review, structure, layout, tone, POV, and no-regression rules
- `references/knowledge`
  route memos, depth research packets, research handoffs, reverse outlines, evidence architecture, research templates, interview records, and rewrite casebooks
- `references/review`
  lint-facing metrics, audience-panel review, longform rubric, and review templates

## Notes on examples

The rewrite examples are preserved because the sentence-level differences are the
useful part of the skill. Names and identifiable mechanism labels have been
de-identified so the package can be shared without carrying project-specific
identifiers into the runtime payload.

## Common usage

```bash
bash scripts/qihan-writing-cli.sh validate
bash scripts/qihan-writing-cli.sh core describe
bash scripts/qihan-writing-cli.sh lint article.md
bash scripts/qihan-writing-cli.sh route check-foundation route-memo.md
bash scripts/qihan-writing-cli.sh route derive-route handoff.md --output route-state.md
```

`derive-route` only emits a derived route-state view. The handoff remains the
authority surface.

The `core` command dispatches to the sibling `bagakit-writing-core` CLI when it
is installed next to this skill.

Exit code semantics:

- `0`: no findings
- `2`: warnings or failures found
