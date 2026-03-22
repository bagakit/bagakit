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
- route the operator through one visible operating surface before drafting
- choose a narrative angle before drafting longform text
- escalate into deeper research when the article foundation is weak instead of forcing a card choice
- force evidence and mechanism ahead of vague praise
- absorb user rewrites as reusable rules
- run a lightweight lint pass before publishing or long-term storage
- review longform drafts with an explicit rubric and a multi-role quiet-room panel instead of relying on taste alone

## Operator route

- `Must do`
  Open `references/workflow/OPERATING_SURFACE_MATRIX.md` first. It is the authoritative router.
- `Must read before non-trivial drafting`
  Follow the route-scoped must-read set defined in `references/workflow/OPERATING_SURFACE_MATRIX.md`. Do not reconstruct your own reading list from scattered docs.
- `Escalate when foundation is weak`
  If you cannot state a stable article promise, first question, object boundary, or evidence shape, switch to `references/workflow/DEPTH_ESCALATION_LOOP.md` and use its packet / handoff route before you return to card selection.

## What ships in this skill

- one operator route for starting, escalating, and reviewing
- one writing route for card selection and structural drafting
- one knowledge route for packet, handoff, reverse-outline, and route-tool compression
- one review route for lint, rubric, and longform checks

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
  voice, inline-code discipline, angle selection, angle review, structure, layout, tone, POV, and no-regression rules
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
python3 scripts/qihan_write_lint.py article.md
python3 scripts/qihan_route_tools.py check-foundation route-memo.md
python3 scripts/qihan_route_tools.py derive-route handoff.md --output route-state.md
```

`derive-route` only emits a derived route-state view. The handoff remains the
authority surface.

Exit code semantics:

- `0`: no findings
- `2`: warnings or failures found
