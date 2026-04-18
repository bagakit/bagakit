---
name: bagakit-codex-webpage-design
description: Use when Codex should create a high-craft webpage or landing page from discussion through image-generation design reference to frontend implementation, browser debugging, and visual parity iteration. Use for strongly styled pages, design-led frontend work, image2 prompt drafting, screenshot-to-implementation loops, and visual polish; not for backend-heavy app features or purely textual design advice.
metadata:
  bagakit:
    swe_layer: design-engineering
---

# Bagakit Codex Webpage Design

`bagakit-codex-webpage-design` is a reference-context-first webpage design
engineering workflow. It turns intent into a concrete design reference, a
working frontend page, browser screenshot evidence, and a reviewed parity
decision.

Image2 is the default reference generator when the user has no stronger
reference. Stronger references include Figma frames, approved screenshots,
brand mockups, real assets, design systems, structured content, or data
examples. Do not start implementation with no design reference.

The reference source must be auditable. A browser-rendered page created by the
agent is not a substitute for Image2 or an external reference. It may be an
exploration sketch or implementation artifact, but it cannot satisfy the
reference-first, design-reference, state-reference, or parity gates. If Image2
cannot produce a usable saved reference, retry or stop with a blocker handoff
instead of coding from agent-authored HTML.

The `SKILL.md` file is intentionally a thin operating protocol. Detailed
checks live in `references/` and historical failures live in `gate_eval/`.
When a new failure appears, prefer adding or updating a bench case, validation
anchor, or reference rule over adding another paragraph to this file.
The structured gate contract lives in `references/workflow-contract.toml`;
validation should check that contract and its case mappings before resorting
to wording anchors.

## When To Use

Use this skill for:

- high-craft webpages, landing pages, microsites, visual prototypes, or
  design-led frontend work
- image2 prompt drafting and generated webpage design references
- implementing from a generated design, screenshot, Figma frame, or visual
  reference
- screenshot-to-implementation debugging and visual parity iteration

Do not use it for backend-heavy work, routine UI fixes without design
direction, slideshow/video outputs, or pure image generation with no webpage
implementation.

## Operating Spine

Every substantial task follows this invariant spine, while the exact route can
adapt to the project:

1. `design-brief`
   - goal, audience, content, constraints, viewport, and success bar
2. `reference-intent`
   - strongest reference source and intent class:
     `exact`, `style_reference`, `asset`, `content_context`, or `data_context`
3. `reference-provenance-ledger` and `reference-survey-ledger`
   - source class, comparison tier, and non-substitution constraints
4. `image-prompt` and `design-reference`
   - required when no stronger reference exists; Image2 design generation is
     mandatory before coding unless unavailable, in which case the missing
     image is a blocker handoff
5. `state-reference-set`
   - default, selected, search/filter, empty/error, modal, disabled, responsive
6. `visual-decomposition`, optional design-core packet, and design-draft passes
   - page frame, regions, typography, palette, material, component treatment,
     information compression, surface composition, density, copy/icon budget,
     hierarchy, and signature details
7. `design-spec-ledger`
   - concrete grid, spacing, type, control, material, and state tokens
8. `asset-requirement-pass` and `asset-generation-ledger`
   - required when CSS alone cannot carry texture, masks, glyphs, or craft
9. `ambition-bar`
   - required for high-craft work; names the reference tier,
     product-specific delight moment, signature detail, and anti-generic risks
10. `information-architecture-map`, `workflow-model`,
    `control-surface-map`, and `interaction-model`
   - required for interactive pages before implementation
11. `capability-route`
   - stack and libraries matched to graph, search, editing, canvas, or 3D
12. implementation and browser loop
   - run, capture screenshots, exercise interactions, and iterate
13. completion ledgers
   - `affordance-inventory`, `behavior-matrix`, `visual-bug-ledger`,
     `full-page-structural-parity-ledger`, `micro-parity-checklist`,
     `material-parity-checklist`, `canvas-stability-report`, `visual-parity-ledger`,
     `interaction-parity-ledger`, `visual-judge-scorecards`,
     `judge-aggregation`, `code-quality-review`, and `handoff`

## Stage Rules

### Reference First

Classify the reference route before coding. If no stronger reference exists,
generate an image2 design reference or preserve the image prompt as a blocking
handoff. A failed or under-review implementation screenshot must not become
the new design source unless the user explicitly approves it as the baseline.

Use `reference-provenance-ledger` before coding. If an agent-authored browser
page is proposed as the reference, treat it as exploration only and apply the
non-substitution rule in `references/implementation-loop.md`; otherwise the
task remains blocked even if the page later looks good.

When meaningful states or breakpoints exist, design references must form a
coherent set. Do not DIY important state visuals during implementation unless
the state is trivial and follows a documented component rule.

Read `references/image-prompt-guide.md` when writing image prompts, generating
state boards, or checking reference drift.

### Product Model Before Pixels

For interactive pages, visual composition is not enough. Before coding, write
or inspect:

- `information-architecture-map`: content/object taxonomy, navigation
  hierarchy, page regions, global/local/contextual surfaces, object
  relationships, and progressive disclosure strategy
- `workflow-model`: primary user path, core business object, state-changing
  action, next action, decision points, system feedback, and completion signal
- `control-surface-map`: owner region, scope, state, and duplicate status for
  every mode switch, tab group, toolbar, command bar, inspector action,
  floating control, footer control, canvas control, and global navigation item
- `interaction-model`: user goals, object states, task flow, feedback,
  branch states, and accessibility expectations

Unexplained duplicate controls block acceptance. If two controls perform the
same mode switch or workflow action, one must be a justified mirrored shortcut
with shared state and workflow value, or it must be removed, merged, disabled,
or restyled.

Read `references/implementation-loop.md` for workflow, control-surface,
interaction, capability, browser, and canvas stability gates.

### Implement With The Right Capability

Inspect the host project before adding a stack. Prefer existing components,
routing, CSS, assets, and icon libraries. If no host stack exists, use static
HTML/CSS/JS for simple pages or React/Vite when components, state, a dev
server, or repeated browser iteration matter.

If the page effect depends on graph, map, canvas, chart, search, rich text,
animation, 3D, or similar domain behavior, choose an appropriate library or
host component before hand-rolling it. Record the choice in `capability-route`.

### Browser Evidence Beats Source Confidence

Do not claim visual completion from source review. Run the page in a browser,
capture desktop and mobile screenshots, compare them side by side with the
design reference, and exercise the required interactions.

Automation is execution evidence, not visual parity proof. Build, lint,
console checks, DOM checks, and Playwright actions can pass while screenshots
still show overlap, clipping, duplicated controls, unreadable text, broken
canvas elements, or an unclear workflow.

### Completion Gate

Before final handoff, verify:

- `reference-intent`, `visual-decomposition`, and required state references
  exist
- `reference-provenance-ledger` passes the reference-source gate
- the reference source is `external_strong` or `image2_filesystem`; an
  agent-authored browser page is not reference authority
- `design-spec-ledger` exists and the implementation uses its token and
  geometry standards instead of ad hoc visual guesses
- required material assets exist and `material-parity-checklist` has no
  unresolved blocker when CSS-only rendering cannot carry the reference craft
- no implementation began from text alone or from an agent-authored HTML
  reference when image2 or a stronger reference was needed
- workflow and control ownership are legible for interactive pages
- every visible live-looking affordance is classified and every `working`
  affordance has behavior evidence
- non-working controls are disabled, hidden, or explicitly out of scope with
  non-primary treatment
- non-happy states do not leave stale primary surfaces looking live; dependent
  player, editor, timeline, transcript, citation, cart, queue, or inspector
  surfaces must be disabled, emptied, hidden, or explicitly marked stale when
  the backing object is unavailable
- graph, map, canvas, whiteboard, timeline, or spatial manipulation has
  before, mid-drag, and after-drag motion-frame evidence
- canvas controls, overlays, minimaps, legends, and floating UI stay in safe
  zones and meet mobile touch expectations
- `visual-bug-ledger` has zero blockers
- `full-page-structural-parity-ledger` proves the whole reference page was
  compared against whole-page and first-viewport screenshots before any local
  crop or micro-parity pass can claim alignment
- `micro-parity-checklist` has no unresolved blocker or high-severity detail
  mismatches in controls, spacing, typography, borders, shadows, icon
  alignment, density, or state styling
- `material-parity-checklist` passes when generated or provided assets are
  needed for texture, masks, glyphs, icons, overlays, or craft
- important UX work, generated design references, and exact-reference
  implementations pass `visual-judge-scorecards` and `judge-aggregation`
- mobile screenshots prove core mobile visualizations, selected tab or drawer
  states, and evidence surfaces in the actual selected states; desktop
  screenshots or DOM assertions alone cannot clear mobile interaction bugs
- high-craft or brand-heavy work preserves any design-core packet and meets
  the ambition bar; "nice but not surprising" is still `needs_iteration`
- latest artifacts correspond to the latest screenshots and validation run
- browser interaction results are preserved as named artifacts, and stale or
  contradictory console logs are resolved or recorded as evidence conflicts
- code structure was reviewed after visual iteration for component boundaries,
  shared tokens, data-driven repeated UI, and justified duplication
- for paired or independent review, `review-packet.md` is filled from
  `references/review-packet-template.md` with visual counterevidence,
  accepted deviations, reviewer ownership, and merge verdict

Read `references/visual-quality-rubric.md` for visual scoring, judge
aggregation, parity ratings, and blocker rules. Read
`references/artifact-contract.md` for artifact names and handoff shape.

## Failure Learning

This skill should improve through evidence, not by growing indefinitely.

When a task exposes a repeated or decision-changing failure:

1. record the failure in the task-local selector log or Spark state
2. route long-lived skill-quality decisions through `bagakit-skill-evolver`
3. add or update a non-gating bench case under `gate_eval/skills/swe/`
4. promote only the smallest stable rule into this skill or its references

Use bench cases for failures such as:

- coding from text or agent-authored HTML without an Image2 or external design
  reference
- state frames drifting from the original reference
- missing information architecture that makes a complex product feel like a
  pile of panels
- fake or unverified visible controls
- graph/canvas drag that passes final-position tests but flickers in motion
- screenshots passing automation while visual blockers remain
- full-page structure drifting from the design reference while local crops and
  style-language notes are used to justify an `acceptable_delta`
- button spacing, control geometry, or other small craft details drifting
  because the reference was not converted into design tokens and checked
  through a micro-parity pass
- clean but unsurprising output for a high-craft request
- duplicated or conflicting mode controls that make the business flow unclear
- toy single-page experiments used as false proof that the skill can build a
  sellable product MVP
- design drafts without comparable references, information compression, density
  discipline, surface-led composition, or copy/icon economy

## References
Load the relevant reference:

- `references/image-prompt-guide.md` - image2 prompt structure, state boards, reference-drift checks
- `references/implementation-loop.md` - stack choice, workflow/control gates, affordance evidence, canvas stability, browser loop
- `references/asset-pipeline.md` - generated asset roles and slice/mask/crop
- `references/visual-quality-rubric.md` - aesthetic review, parity rating, judge scoring, blockers
- `references/artifact-contract.md` - artifact names, blocking artifacts, final handoff format
- `references/workflow-contract.toml` - stages, completion artifacts, guards, failure coverage
