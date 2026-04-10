# Implementation Loop

Use this when converting a design reference into a running webpage.

Do not enter this loop until `reference-intent.md` exists and either a stronger
provided reference is recorded or image2 has produced a design reference. A
preserved image prompt alone is only enough for handoff when image generation is
unavailable; it is not enough to claim visual implementation completion.
An agent-authored browser page is also not enough. HTML/CSS is the
implementation medium, so using a locally coded page as the design authority
turns the task into self-reference instead of design-led implementation.

## Reference Provenance Gate

Before implementation, write `reference-provenance-ledger.md`.

Classify the reference source:

- `external_strong`: provided Figma frame, approved screenshot, brand mockup,
  real asset set, design system, structured content, or data examples
- `image2_filesystem`: Image2 produced a saved design artifact that can be
  compared against browser screenshots
- `browser_exploration_only`: a locally coded HTML/CSS sketch used to explore
  layout, feasibility, or product workflow; it cannot satisfy any design
  reference or parity gate
- `blocked_no_reference`: no stronger reference exists and no generated
  reference artifact is available

`browser_exploration_only` must not be promoted into the visual source of
truth, even when it was written before app implementation and frozen as a
screenshot. It may inform an Image2 prompt, a design brief, or a feasibility
prototype, but the executor must still retry Image2 or obtain another stronger
reference before claiming visual completion. If Image2 cannot produce a saved
artifact after reasonable retries, stop with `reference_blocked` and preserve
the prompt, constraints, and retry evidence.

For skill-quality validation experiments, this is stricter: a missing
`external_strong` or `image2_filesystem` reference invalidates the experiment
for proving this skill. Do not continue into implementation to collect partial
workflow credit, and do not report `conditional_pass` from a fallback browser
exploration. Retry reference generation or stop with `invalid_no_reference`.

Do not enter this loop until `visual-decomposition.md` and
`design-spec-ledger.md` exist. The decomposition must translate the reference
image into concrete targets for layout proportions, toolbar/nav structure,
focal composition, typography, palette, materials, component shapes, spacing,
and signature details. The design spec ledger must turn those targets into
implementable tokens and geometry standards instead of leaving the agent to
eyeball small details during CSS work.

Before implementation, run an `asset-requirement-pass.md` for high-craft or
strongly styled references. If the reference's craft relies on material,
texture, illustration, edge masks, glyphs, icon language, glow/noise overlays,
custom frames, or other non-geometric details, CSS-only approximation is not
enough. Generate or obtain an asset kit first and record it in
`asset-generation-ledger.md`; otherwise record why CSS and vector primitives
are sufficient for the current reference.

Do not implement meaningful branch states until `state-reference-set.md` exists
or an equivalent state map is recorded. A single happy-path image is not enough
for a stateful interface. Each important state should be covered by a reference
frame, a reusable component/state rule extracted from the reference, or an
explicit gap. Do not DIY selected, hover, empty, loading, modal, error,
filtered, or responsive state visuals when they materially define the product
feel.

Non-happy states must be semantically coherent. If source material, selected
objects, cart items, generation inputs, permissions, network state, or backing
data are missing, do not leave the previous player, editor, transcript,
timeline, citation, queue, checkout, canvas, or inspector looking live. The
surface must be disabled, emptied, hidden, or clearly marked stale with a
visible recovery path.

Primary commit actions need a negative-path proof. When blockers remain,
buttons that look like finalizing actions, such as publish, stage, approve,
checkout, sign off, release, queue, export, send, or book, must either be
disabled, demoted to an explicit review/recovery packet, or proven by browser
evidence to avoid creating a completed receipt. Do not verify only the path
after the blocker is fixed; test the blocked state before recovery and record
the expected refusal, disabled state, or non-final receipt.

For high-craft work, do not implement until `ambition-bar.md` exists. It must
name the reference tier, product-specific delight moment, signature detail, and
anti-generic risks. "Clean and usable" is a baseline, not the ambition target.

If there is a strong original reference, generated state frames must be derived
from that reference, not from the current implementation. Reject a state board
that makes current implementation drift look intentional.

## Design Spec Gate

Before implementation, write `design-spec-ledger.md` from the reference image
or provided design authority. It is the local visual SSOT for CSS tokens,
component geometry, and micro-detail review.

Record concrete standards for:

- page frame: viewport assumptions, shell dimensions, column widths, topbar or
  hero height, section rhythm, safe margins, and responsive breakpoints
- spacing scale: canonical values for region gaps, component padding, button
  groups, inline icon gaps, list row spacing, and card internals
- typography scale: font families or fallbacks, size, line height, weight,
  letter spacing, heading/body/caption usage, and display-type exceptions
- color and material tokens: background, surface, border, divider, text,
  accent, muted, shadow, blur, glass, grain, gradient, and focus colors
- control geometry: button height, padding, radius, icon size, icon-text gap,
  input height, tab dimensions, segmented control dimensions, and toolbar
  density
- component density: card size, card padding, media ratio, list row height,
  badge shape, table or feed density, and repeated module spacing
- state treatment: hover, selected, active, disabled, focus, loading, empty,
  pressed, modal/drawer, and responsive variants
- accepted uncertainty: details that cannot be measured exactly from the
  reference and the conservative web-safe value chosen

Use the ledger while implementing. Define CSS variables, theme tokens,
component props, or equivalent constants from it before styling repeated UI.
If a later review changes the visual standard, update the ledger first and
then update the implementation to match it. Do not let scattered one-off CSS
become the design source of truth.

## Material Asset Gate

Use this gate when the visual reference has craft that cannot be faithfully
rendered by layout CSS alone.

The `asset-requirement-pass.md` must classify:

- `css_sufficient`: geometry, flat color, typography, simple shadows, and
  vector icons can carry the reference
- `asset_required`: texture, masks, illustration, custom glyphs, icon sheets,
  sprite frames, image overlays, or material noise are required
- `asset_blocked`: assets are required but generation, sourcing, or license
  provenance is unavailable

When assets are required, create an `asset-generation-ledger.md` before final
implementation. The ledger should include:

- asset inventory: texture tiles, torn-edge masks, frame slices, glyph sheets,
  icon sets, overlays, sprites, or other concrete assets
- asset role: `texture_tile`, `alpha_mask`, `nine_slice_frame`,
  `sprite_or_glyph_sheet`, `responsive_art`, or `overlay`
- generation prompts or source provenance for each asset
- accepted and rejected variants with reason
- target format and constraints: transparent PNG, SVG, repeatable tile, mask,
  nine-slice/frame, responsive-safe overlay, or fallback color
- crop manifest when cut from a sheet: source ref, crop rectangle, output
  dimensions, trim threshold if used, and extraction command or tool
- alpha, luminance-mask, opaque, or not-needed transparency semantics
- slice or patch metadata for frame assets: margins, border widths, fill
  behavior, renderer strategy, edge stretch or tile, content padding, and
  minimum size
- density and responsive behavior: `srcset`, `image-set`, breakpoint swap,
  repeat, crop, scale, or replacement
- usage map from asset to component/CSS selector
- optimization notes such as dimensions, compression, repeat behavior, and
  contrast/readability constraints
- failure fallback when the asset fails to load

For accepted reference-specific glyphs, icon sprites, stamps, or small marks,
preserve target size, alpha semantics, component owner, fallback, and reference
comparison. Do not replace a successful custom glyph language with generic
icons during later cleanup.

For `nine_slice_frame` assets, do not proceed from image file to live panel
until a renderer strategy exists:

- `css_border_image` for rectangular DOM panels
- `dom_patch_component` for custom `NineSlicePanel`, grid, or absolute patch
  rendering with independent corners, edges, center, masks, and content
- `canvas_nine_slice` for Pixi, Phaser, or equivalent canvas/game surfaces

Render a frame specimen before live use at minimum, normal, wide, tall,
dense-content, and mobile sizes. If corners stretch, edge texture warps, seams
appear, center fill hurts readability, content clips, or min-size is violated,
the material gate remains open.

After the specimen screenshot is captured, perform a human or judge screenshot
review of the actual rendered specimen. Do not mark the frame as pass only
because Playwright found six specimen elements. Low-contrast labels, pale
helper text on parchment, muddy center fill, clipped focus rings, or dense
sample text that is technically present but hard to read are blockers.

Do not use one full-page generated image as a background to fake an
implementation. The page must remain a real browser UI; assets should support
materials, illustrations, marks, and frames while controls, text, layout,
states, and interactions remain inspectable and responsive.

If Image2 generates an asset kit, preserve the filesystem artifacts and copy
only the needed assets into the experiment or app asset directory. Do not
delete the original generated images. If the image tool cannot produce
transparent or cleanly separable assets, either retry with more specific
asset prompts, cut the generated sheet into usable pieces with a documented
process, or mark the material parity gap instead of accepting CSS-only drift.

Read `asset-pipeline.md` before cutting or integrating generated assets. A
black-background or RGB sheet is not acceptable for transparent UI edges unless
the extraction creates clean alpha and screenshots show no halo. A scalable
decorative panel should use nine-slice, `border-image`, masks, or equivalent
patch logic rather than a single stretched bitmap. Asset-backed UI must still
be real browser UI: assets support material, frames, masks, icons, and
overlays; text, controls, states, layout, and interactions remain inspectable.

## Information Architecture Gate

Before implementation, write or inspect `information-architecture-map.md` for
complex product, workspace, dashboard, editor, research, knowledge, commerce,
or workflow pages. Include:

- object taxonomy: primary objects, secondary objects, metadata, and evidence
  objects
- navigation hierarchy: global navigation, local navigation, contextual
  navigation, and deep-linkable views
- page region responsibilities: what each region owns and what it must never
  duplicate
- content grouping and progressive disclosure: overview, detail, drilldown,
  compare, create, review, and empty/error states
- information scent: labels, counts, status, and visual cues that tell the
  user where to go next
- cross-object relationships and where those relationships become actionable
- role of search, filters, command palette, tabs, inspector, canvas, and
  timeline/map/table alternatives
- sellable-product proof: whether the modeled objects, relationships,
  branch states, and primary workflow are complex enough to reveal the hard
  parts of the product instead of only proving a static composition

The information architecture map must make the product understandable before
the page becomes beautiful. If the app has multiple object types but the
screen does not explain how they relate, keep modeling before visual judging.

Do not let decorative layout define the information architecture after the
fact. A premium-looking set of panels is not a product MVP unless the object
model, navigation model, and action hierarchy are legible.

For skill-quality experiments, inspect information architecture before judging
visual craft. A sellable product MVP experiment should make one coherent
business system legible: what objects exist, how evidence or state moves
between them, which region owns each decision, and why the next action matters.
If the surface could be replaced by a nice static dashboard without losing the
test, mark the run as `smoke_test`, not proof of product-MVP capability.

## Product Workflow Gate

Before implementation, write or inspect `workflow-model.md` for interactive
workspace, dashboard, editor, graph, canvas, or tool pages. Include:

- primary user path: first action, next action, and completion signal
- core business object and the state that changes during the flow
- decision points, alternate paths, and system feedback
- what the user should understand without reading external explanation
- where the page should challenge, narrow, capture, compare, review, or commit
  work

The workflow model must be understandable as a product flow, not only as visual
composition. If the primary path cannot be described in one sentence, keep
clarifying before coding.

## Control Surface Gate

Before implementation, write or inspect `control-surface-map.md`. Include:

- every tab group, segmented control, toolbar, command bar, inspector action,
  floating control, canvas control, footer control, and global navigation item
- one canonical owner region for each mode, lens, action, or workflow step
- scope: global page, selected object, canvas, current lens, inspector, or
  local component
- state: selected, available, disabled, hidden, or out of scope
- duplicate status: canonical, mirrored shortcut, redundant, or conflicting
- browser evidence needed to prove state sharing for mirrored shortcuts

Unexplained duplicate controls are blockers. If two regions expose the same
`Relations / Questions / Evidence` lens, the map must prove that they have
different scope or that one is a mirrored shortcut with shared state and real
workflow value. Otherwise remove, merge, or restyle one before visual judging.

## Stack Selection

1. Existing host project stack.
2. Static HTML/CSS/JS when one page and simple interactions are enough.
3. React/Vite or the repo's mainstream equivalent when components, state,
   tooling, or repeated browser iteration matter.

Do not add a heavy framework only to render a static design.

## MVP Experiment Gate

Use this gate when the task is testing or evolving this skill, not for every
ordinary webpage request.

A skill-quality experiment must be complex enough to falsify the workflow. A
single static page or shallow dashboard is not sufficient evidence that this
skill can deliver high-craft product work or a sellable product MVP.
The experiment plan must say how the chosen task can falsify the skill, not
only how it can look impressive.

Default experiment bar:

- product concept could plausibly be sold or demoed as an MVP
- at least three object types with visible relationships
- at least three meaningful states or views, including one non-happy path
- at least one primary creation, capture, or commit action
- at least one review, comparison, synthesis, or decision workflow
- meaningful search, filter, graph, table, timeline, map, editor, or inspector
  behavior when the concept implies it
- responsive desktop and mobile framing
- visible product-specific delight that clarifies the product model
- code factored into reusable components, data models, and tokens rather than a
  one-off page composition

If a test task does not meet this bar, label it `smoke_test` or
`single-page-prototype`. A single static page can be a smoke test, but do not
use it as evidence that the skill can build a sellable high-craft product MVP.

## Interaction Model Gate

Before implementation, write or inspect `interaction-model.md` when the page is
not purely static. Include:

- user goal and task flow
- core objects and states
- primary actions and system feedback
- empty, loading, error, selected, hover, focus, and disabled states
- blocked primary actions: what happens when a user tries to commit, stage,
  publish, queue, sign off, or pay while required evidence or input is missing
- keyboard or accessibility expectations for primary controls

For dense information interfaces, use an information-seeking model such as
overview first, zoom/filter, then details-on-demand.

## Affordance Inventory Gate

Before claiming an interactive page is complete, write
`affordance-inventory.md` and `behavior-matrix.md`.

Inventory both sides, not only the implementation:

- every reference-visible affordance from the design reference or state board
- every implementation-visible affordance in the live page

- buttons, icon buttons, menu triggers, segmented controls, and tabs
- inputs, editors, toggles, checkboxes, sliders, and selects
- links, clickable cards, clickable rows, and action list items
- graph controls, draggable nodes or objects, canvas gestures, and keyboard
  targets

For each reference-visible affordance, classify the implementation status as
`implemented`, `disabled`, `hidden`, `merged`, `renamed`, or
`explicitly_out_of_scope`, and record the reason. Missing reference controls
are blockers unless they are deliberately merged, disabled, hidden, or marked
out of scope before implementation judging. The `reference-coverage-matrix` must
also cover reference states such as default, filtered, empty, selected,
mobile, and modal/drawer states.

Classify each item as `working`, `disabled`, `hidden`, or
`explicitly_out_of_scope`. Anything visible and styled as live defaults to
`working`.

Classification must be mutually exclusive. The same affordance cannot be both
`working` and `explicitly_out_of_scope`, both `working` and `disabled`, or
otherwise counted in two states. Enabled live-looking controls with no handler,
state change, or structured browser evidence are blockers.

For every `working` item, the behavior matrix must name:

- visible label or accessible name
- expected user action
- expected state change or result
- keyboard expectation where applicable
- browser evidence path or test assertion

The browser evidence must point to a saved structured result, such as
`browser-check-results.json`, for every `working` affordance. Sampling only the
primary workflow is not enough if other enabled controls remain visible.
For primary commit actions, include both the blocked-state attempt and the
post-recovery success path when the product has a non-happy state.

Structured browser evidence must be self-validating. For each working
affordance, store the expected state and the actual observed state, then fail
the check unless they match. A record such as `ok: true` is invalid if the same
object records the wrong active mode, stale visible view, unchanged selection,
missing receipt, unchanged count, or unchanged disabled state.

For tabs, segmented controls, modes, and mirrored shortcuts, use scoped
locators anchored to the owning control surface and stable selectors such as
`data-mode`, `id`, or accessible names within the owner region. Do not use an
ambiguous page-wide `.first()` click when the same label can appear in multiple
regions. The evidence should record at least: control owner, expected selected
label or key, actual selected label or key, expected visible region, actual
visible region, and a screenshot for the selected state when the state affects
workflow or mobile behavior.

For generated or data-driven controls, inventory concrete instances, not only a
wildcard group. A group summary such as `atlas-node-*` is allowed only as an
index; each visible generated control still needs a concrete classified row and
matching structured browser evidence key.

Do not leave first-viewport, primary-flow, or repeatedly emphasized controls as
fake prototype controls. If a control is not implemented, remove it, make it
semantically disabled, or restyle it as non-primary static information.

Do not let implementation scope silently shrink the design reference. If the
reference shows search clear, filter chips, empty results, evidence cards,
question rows, next actions, review queue, inspector pin/star/close controls,
table/timeline/map modes, mobile command controls, or composer attachments,
the matrix must account for each one.

For tab, segmented-control, drawer, and bottom-sheet navigation, browser
evidence must include screenshots for each mobile state that affects the
workflow. The selected visual state must match the visible content. DOM state,
ARIA state, or text assertions are not enough if the screenshot shows the wrong
tab highlighted, missing tab text, disabled-looking active tabs, or stale
content.

Each mobile tab, drawer section, or segmented mode must own distinct content,
scope, or workflow value. If two tabs show the same panel, same evidence, or
same control set, merge them or remove one. Do not pass selected-state honesty
by only changing the highlighted tab while reusing identical content.

## Capability Route Gate

Before coding, map the design target to implementation capabilities:

- graph/network/map/chart/data visualization
- search, command palette, filtering, sorting
- rich text, markdown, code, or document editing
- animation, gesture, canvas, WebGL, or 3D
- forms, validation, workflows, review queues, or state machines

If a capability is central to the page effect, prefer a proven library or host
component over hand-rolled behavior. Record the choice in
`capability-route.md` or `implementation-notes.md`.

For graph, map, canvas, whiteboard, timeline, or spatial interfaces, also write
`canvas-stability-report.md`. Record:

- library or host component used
- state model for object identity and positions
- drag, pan, zoom, snapping, auto-pan, and viewport-fit settings
- whether heavy node/object components are memoized or otherwise stabilized
- whether drag updates avoid rebuilding unrelated scene state
- browser evidence that drag or pan is smooth enough for the design intent
- before, mid-drag, and after-drag frame evidence, or an equivalent frame-sample
  report, for motion quality

Flicker, position reset, accidental selection churn, pan/drag conflict, or
layout jumps during manipulation are blocker bugs.

A final-position assertion after mouseup is not enough for drag quality.
Dragging is a motion claim. Verify that the dragged object, labels, edges,
shadows, z-order, and surrounding graph remain visually continuous during
movement.

Also record the canvas safety zone:

- where minimaps, zoom controls, legends, reset controls, inspectors, and
  floating status UI are allowed to sit
- which important nodes, labels, branches, or cards must remain unobscured
- the mobile placement and touch size of canvas controls
- whether third-party default controls were moved, replaced, restyled, or hidden

Library defaults are suspect until proven in screenshots. A minimap, control
rail, attribution, handle, or overlay that covers important content, exposes
implementation artifacts, or falls below mobile touch size is a blocker even
when Playwright interactions pass.

## Build Order

1. Establish `reference-provenance-ledger.md` and confirm the reference is not
   a self-referential implementation sketch. If no stronger reference exists,
   retry Image2 until it produces a saved artifact or stop with
   `reference_blocked`.
2. Establish `design-spec-ledger.md` and convert it into shared CSS or theme
   tokens.
3. Establish page shell, dimensions, typography scale, and color tokens from
   the ledger.
4. Establish the ambition-bar signature detail for high-craft work.
5. Establish the information architecture map for complex product surfaces.
6. Match the decomposed page regions and focal composition.
7. Implement the workflow model, control surface map, interaction model, and
   capability route.
8. Place primary layout blocks and real content.
9. Implement repeated UI through components, data arrays, and shared tokens.
10. Integrate media, icons, and signature assets through the asset pipeline.
11. Add responsive behavior.
12. Add interactions and states from the state reference set.
13. Complete the reference coverage matrix, affordance inventory, and behavior
    matrix.
14. Run browser screenshot and interaction checks. Save structured interaction,
    console, and overflow results as named artifacts before claiming pass.
15. Create an implementation checkpoint before long visual iteration: working
    URL, files created, latest screenshot refs, current blocker count, and next
    action. If the run stalls after reference or asset setup, stop with
    `blocked_in_implementation` rather than silently waiting.
16. Run `full-page-structural-parity-ledger.md` against the reference and the
    latest full-page/first-viewport screenshots. Fix high-severity structure
    drift before crop or micro-parity review.
17. Run a pre-judge information-architecture sanity check: what objects exist,
    how navigation is organized, which region owns each object/action, and
    whether the user can infer the product model without explanation.
18. Run a pre-judge interaction-logic sanity check: what does the user do
    first, what changes next, which control owns each mode, and whether any
    duplicate control is redundant or conflicting.
19. Run a pre-judge screenshot sanity check. If screenshots visibly contain
    blocker defects, update the ledgers and keep iterating before using judge
    passes.
20. Run `material-parity-checklist.md` when assets are required. Check crop
    manifests, alpha/mask integrity, nine-slice behavior, tiling seams,
    responsive asset behavior, fallback, desktop screenshots, and mobile
    screenshots before visual judging.
21. Run `micro-parity-checklist.md` against reference crops for topbar,
    navigation, primary content, repeated components, controls, and responsive
    states. Fix high-severity spacing, typography, border, shadow, icon, and
    control-geometry mismatches before judge review.
22. Iterate on visible mismatches, blocker bugs, fake controls, unclear
    information architecture, unclear workflow, duplicate controls, and
    insufficient ambition.
23. Refactor after visual parity so the implementation is maintainable rather
    than a pasted one-off prototype.

## Browser Loop

For each iteration:

```text
Reference: <image/design ref>
Reference intent: <exact|style_reference|asset|content_context|data_context>
Viewport: <width x height>
Observed mismatch:
- <specific visible issue>
Change:
- <file/function/style updated>
Result:
- <fixed/partially fixed/deferred and why>
```

Use Playwright or available browser tools to check:

- desktop screenshot
- mobile screenshot
- console errors
- asset loading
- reference provenance: source classification, produced artifact, and
  non-substitution constraints are recorded before implementation parity is
  judged
- reference authority: an agent-authored browser page is not accepted as the
  design source when Image2 or an external strong reference is required
- text overflow and clipping
- primary interaction states
- information architecture legibility: object taxonomy, navigation hierarchy,
  page region responsibilities, progressive disclosure, and information scent
  are clear without external explanation
- workflow legibility: first action, current object, next action, and
  completion signal are visible without external explanation
- control surface ownership: each mode switch, tab group, toolbar, footer
  action, and inspector action has one owner and scope
- duplicate control checks: repeated controls are either deliberate mirrored
  shortcuts with shared state and value, or blockers
- full-page structural parity: reference and implementation are compared as
  whole pages and first viewports before relying on crops or component-level
  checks
- design spec conformance: live CSS and component tokens still match the
  latest `design-spec-ledger.md`
- material asset pipeline: role, crop manifest, alpha/mask semantics,
  nine-slice or patch behavior, selector usage, fallback behavior, density, and
  desktop/mobile responsive behavior are recorded before material parity passes
- mobile spatial adaptation: dense board, graph, map, pin-wall, and timeline
  surfaces use a deliberate mobile layout pattern instead of a shrunken desktop
  board with fragmented text or crowded controls
- micro-parity crops: topbar or hero controls, nav/sidebar, primary cards,
  repeated list rows, buttons, inputs, badges, icons, shadows, borders,
  dividers, and responsive controls are checked at detail level
- affordance inventory actionability and state-change checks
- required behavior interactions: click selection, search/filter, reset/clear,
  capture editing, keyboard activation, and drag/pan/zoom when the interface
  presents the graph or canvas as interactive
- blocked-action checks: primary commit actions in non-happy states do not
  create final receipts, queue items, release state, or completion status before
  recovery or explicit review-packet wording
- graph/canvas stability checks for smooth manipulation, no flicker, no object
  reset, no layout jump, and no pan/drag conflict when spatial manipulation is
  present
- motion-frame checks for drag/pan: before, mid-drag, and after-drag evidence
  or recording-derived frame samples
- graph/canvas safety checks that minimaps, zoom controls, legends, status UI,
  and third-party handles do not obscure important content
- mobile touch checks for canvas controls, mode switches, and primary capture
  controls
- mobile screenshots for selected tab, drawer, bottom-sheet, and core
  visualization states that affect the workflow
- desktop and mobile screenshots of non-spatial core visualizations such as
  audio waveforms, player timelines, charts, progress rails, transcript
  heatmaps, evidence strips, and media scrubbers. Do not accept a mobile state
  where the visualization becomes a blank block, clipped container, unreadable
  chart, or loses the markers that make it operable.
- ambition-bar checks for a useful product-specific surprise, signature craft
  detail, and non-generic result when the task asks for high-craft work
- screenshots or DOM checks for branch states in the state reference set
- obvious visual bugs: overlap, malformed icons, broken assets, inconsistent
  spacing, unreadable text, accidental scrollbars, and layout jumps
- component/code structure after iteration: duplication, repeated markup,
  shared tokens, component boundaries, and data-driven repeated UI
- saved browser check results: interaction, console, overflow, and capture
  status are preserved as named artifacts rather than only described in prose
- browser result integrity: each `ok: true` interaction records expected versus
  actual state and contains no contradiction such as the wrong active mode,
  stale visible view, unchanged selected object, missing receipt, or disabled
  state mismatch

## Full-Page Structural Parity Pass

Run this after browser screenshots exist and before local crop or
micro-parity review. The pass catches the failure where a page preserves the
style language but becomes a different layout.

Create `full-page-structural-parity-ledger.md` with whole-reference and
whole-implementation screenshots side by side. Compare:

- first viewport: header, hero, primary work area, right/secondary panel, and
  the hint of the next section
- global frame: max width, gutters, margins, page density, section order, and
  scroll length
- region proportions: left/middle/right columns, hero size, matrix/card area,
  inspector/detail panel size, evidence/feed rails, and footer sections
- control placement: search, filters, mode switches, nav, reset, primary
  action, mobile menu, and mobile search/filter placement
- object layout: card grid count and density, selected/detail surface,
  source/evidence areas, article/briefing sections, and responsive ordering
- mobile frame: whether the mobile reference is implemented as a real
  breakpoint with the same hierarchy, not replaced by an unrelated stacked page

For each row, record status `match|minor_delta|high_mismatch|not_applicable`,
severity, fix, and accepted reason if any. A `high_mismatch` in first-viewport
structure, region proportions, control placement, primary object layout, or
mobile hierarchy blocks `acceptable_delta`.

Primary action ownership must be compared explicitly. If the reference shows a
primary action in the topbar, hero, inspector, footer, or mobile command area
and implementation moves, replaces, renames, or changes its scope, record
`minor_delta` or `high_mismatch` with rationale. Do not call control placement
`match` merely because an equivalent action exists somewhere else.

Image2-generated references are not loose moodboards by default. Even when
`reference-intent` is `style_reference`, preserve the generated reference's
whole-page structure, hierarchy, proportions, and control placement unless the
user explicitly says the image is only visual mood. Do not downgrade reference
intent. Do not use `style_reference` to justify large structural rewrites
such as moving topbar controls into the hero, changing a product workspace into
a landing page, changing a three-column product surface into a different scroll
composition, or replacing the generated mobile frame with an unrelated
responsive design.

## Micro-Parity Pass

Run this after the broad screenshot sanity check and before visual judges.
The pass is intentionally picky. Its job is to catch the small detail drift
that makes a page feel unlike the reference even when the large composition is
correct.

Create `micro-parity-checklist.md` with rows for:

- page shell margins, gutters, region widths, and section vertical rhythm
- topbar, navigation, hero, and inspector spacing
- button groups, segmented controls, tabs, inputs, and search controls
- icon size, icon stroke weight, icon-text gap, and vertical centering
- heading/body/caption scale, line height, weight, and text block spacing
- card/list/table/feed padding, row height, media ratios, and repeated-module
  rhythm
- border width, divider strength, radius, shadow, blur, texture, and surface
  contrast
- hover, selected, active, disabled, focus, empty, loading, and responsive
  state treatment

For each row, record: reference cue, implemented cue, status
`match|minor_delta|high_mismatch|not_applicable`, severity, and fix. Any
`high_mismatch` in first-viewport controls, primary components, typography,
spacing, or signature detail blocks `acceptable_delta`.

Use cropped screenshots or browser zoom when whole-page screenshots hide the
problem. Button spacing, control padding, icon alignment, line-height drift,
and inconsistent repeated-card density are not "subjective polish" when the
reference intent is exact or image2-generated; they are parity defects unless
accepted with a concrete reason.

## Visual Difference Triage

Fix in this order:

1. page structure and focal hierarchy
2. region proportions and center composition
3. toolbar, navigation, and inspector structure
4. typography scale and weight
5. design-token and control-geometry conformance
6. color, material, background, and contrast
7. component shape, line treatment, and asset treatment
8. micro-details, shadows, borders, and motion
9. ambition and delight: signature detail, product-specific surprise, and
   whether the page feels memorable rather than merely competent

Do not chase decorative pixels before the layout and hierarchy match.

Do not use `acceptable_delta` for a page that has a different overall
composition from the design reference.

Do not use `acceptable_delta` while `full-page-structural-parity-ledger.md` is
missing or while it contains unresolved high-severity mismatch in first
viewport, region proportions, control placement, primary object layout, section
order, or mobile hierarchy.

Do not use `acceptable_delta` for visible bugs or unreferenced state styling.
If the only reason for mismatch is dynamic data, real content substitution,
responsive constraints, browser/font rendering, accessibility, or documented
web feasibility, record it as an accepted delta. Otherwise keep iterating.

Do not use `acceptable_delta` while blocker items remain in
`visual-bug-ledger.md`, while primary visible controls are fake, or while
graph/canvas manipulation visibly flickers.

Do not use `acceptable_delta` while `micro-parity-checklist.md` has unresolved
high-severity detail mismatches in first-viewport controls, primary repeated
components, typography, spacing, icon alignment, borders, shadows, material, or
state styling.

Do not use `acceptable_delta` for high-craft work when the result is merely
competent, generic, or unsurprising. Raise the ambition bar or record that the
user explicitly lowered the target.

Do not treat automated validation as a substitute for visual review. Build,
lint, Playwright actions, overflow checks, and console checks can pass while the
screen is still visually blocked by overlap, clipping, undersized controls,
library artifacts, or a responsive state that was never actually designed.

Refresh artifacts after each iteration that changes layout, behavior,
screenshots, or validation scripts. Stale `visual-bug-ledger.md`,
`behavior-matrix.md`, `full-page-structural-parity-ledger.md`,
`interaction-parity-ledger.md`,
`canvas-stability-report.md`, `micro-parity-checklist.md`,
`visual-parity-ledger.md`, or
`code-quality-review.md` block final handoff because the result is no longer
auditable.

If old console logs, trace files, screenshots, or check outputs contradict the
latest pass claim, either supersede them with a clearly named latest-result
artifact or record the conflict in `visual-bug-ledger.md`. Do not claim "no
console errors" while stale visible error logs remain unexplained.

## Trade-Off Rule

If exact visual parity would hurt accessibility, responsive behavior, or real
content integrity, keep the better web behavior and record the difference in
the parity ledger.
