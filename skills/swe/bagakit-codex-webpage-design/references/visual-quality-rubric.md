# Visual Quality Rubric

Use this to critique both the generated design reference and the implemented
page.

Start by checking reference intent. An `exact` reference should be judged much
more tightly than a `style_reference`, while `asset`, `content_context`, and
`data_context` references should be judged by whether the implementation uses
the input faithfully and communicates the page goal.

Then check reference provenance. A browser-rendered reference created by the
agent is not equivalent to Image2 or an external design source. Treat
agent-authored HTML/CSS as exploration only. It may help shape an Image2
prompt, design brief, or feasibility prototype, but it cannot clear visual
parity, generated-reference, or state-reference gates.

If a strong original reference exists, it stays authoritative. Later generated
state boards must be judged against that original reference before they can
guide implementation. Reject state boards that copy visual drift from a failed
implementation.

For image2-generated webpage mockups, default to a strong visual target:
preserve layout, hierarchy, proportions, materials, focal object, and signature
details unless the user explicitly says the image is loose inspiration.

"Cannot pixel-align" is not permission to approximate broadly. Acceptable
differences should be limited to dynamic data, user-provided content,
responsive breakpoints, browser or font rendering, real asset substitution,
accessibility, or documented web feasibility constraints. Everything else
should basically align with the reference: grid, spacing, proportions,
typography, material, component treatment, interaction state treatment, and
signature details.

## Five Checks

1. Direction
   - Does the page have a clear visual point of view for this domain?
2. Hierarchy
   - Is the primary action, primary object, or primary claim instantly clear?
3. Craft
   - Are typography, spacing, color, imagery, and details intentional?
4. Web Fit
   - Does the design survive real content, responsive viewports, and browser
     rendering?
5. Originality
   - Does it avoid generic AI/SaaS/page-builder patterns?
6. Ambition And Delight
   - Does it contain one product-specific moment of craft, motion,
     composition, or interaction that helps the user understand or enjoy the
     product?
   - Would a strong designer call it distinctive, not merely clean?
   - Does the surprise serve the task instead of becoming decoration?

For interactive pages, add a sixth check:

7. Interaction Fit
   - Do the controls, graph, search, filters, forms, motion, or workflow states
     support the user's task flow rather than merely matching the static image?
8. Information Architecture
   - Are object types, content groups, navigation levels, region
     responsibilities, and progressive disclosure understandable from the UI?
   - Do labels, counts, status, grouping, and previews give enough
     information scent for the user to choose the next path?
9. Workflow Legibility
   - What does the user do first, what object is being changed, what happens
     next, and how does the page show progress or completion?
10. Control Architecture
   - Does each mode switch, tab group, toolbar, inspector action, footer
     control, and floating control have clear ownership and scope without
     unexplained duplication?

Then add implementation checks:

11. State Parity
   - Are the important branch states based on a state reference frame or
     reusable rule from the reference set rather than local improvisation?
12. Full-Page Structural Parity
   - Do whole-page and first-viewport screenshots preserve the reference's
     page frame, section order, region proportions, control placement, primary
     object layout, and mobile hierarchy?
13. Design Spec Fidelity
   - Did the implementation derive and use a design spec ledger for grid,
     spacing, typography, control geometry, material tokens, and state
     treatment rather than ad hoc CSS guesses?
14. Micro-Parity
   - Do cropped details such as button spacing, icon alignment, row density,
     borders, shadows, text leading, dividers, and selected/hover states match
     the reference or have accepted reasons?
15. Material Parity
   - When the reference depends on texture, torn edges, illustrated glyphs,
     custom icon language, glow/noise overlays, or other material craft, did
     the implementation use an asset kit rather than flattening the design
     into clean CSS boxes?
   - Are generated or provided assets reusable, responsive-safe, readable, and
     proven against the reference?
   - If custom glyphs or icons worked, were they preserved as fixed-size
     reference-specific sprites instead of replaced by generic icons?
   - If panel or card frames scale, does a nine-slice renderer keep corners,
     edges, center fill, padding, and min size stable across specimen sizes?
16. Code Craft
   - Are repeated UI structures data-driven and componentized with shared
     tokens, or did visual iteration leave a large brittle one-off component?
17. Behavior Proof
   - Do visible interactive affordances actually work in the browser, including
     click selection, search/filter, reset, capture editing, keyboard
     activation, and drag/pan/zoom when implied?
16. Affordance Honesty
   - Has every visible live-looking control been inventoried and classified as
     working, disabled, hidden, or explicitly out of scope?
17. Reference Coverage
   - Has every reference-visible control, state, and signature detail been
     implemented or explicitly accounted for before judging parity?
18. State Coherence
   - When the app enters blocked, empty, missing-input, failed, disconnected,
     permission-denied, or low-confidence states, do primary surfaces clearly
     become unavailable, stale, recoverable, or scoped instead of looking live?
19. Canvas Stability
   - If the page presents a graph, map, canvas, whiteboard, or spatial surface,
     does manipulation feel smooth without flicker, object reset, pan/drag
     conflict, or layout jumps?
20. Motion-Frame Stability
   - Do before, mid-drag, and after-drag frames show continuous movement without
     flashing, disappearing content, z-order jumps, unwanted transitions, or
     relation-line redraw artifacts?
21. Mobile State Honesty
   - Do mobile tabs, drawers, bottom sheets, and segmented controls visually
     match the content being shown?
   - Do core mobile visualizations such as waveforms, charts, maps, timelines,
     and media scrubbers remain visible and operable instead of collapsing into
     blank or clipped blocks?
22. Spatial Label Legibility
   - Do graph, map, timeline, and spatial labels avoid overlap, collision,
     unreadable clustering, or ambiguous ownership?
   - Are label placement and truncation reviewed in screenshots, not only by
     DOM existence or final selected state?

For high-craft requests, also ask:

- Would this surprise a careful user in a useful way?
- What is the one signature detail they would remember?
- Is the page competing with a high-quality product reference tier, or merely
  avoiding visible mistakes?

For skill-quality experiments, also ask:

- Is this complex enough to falsify the skill, or only a smoke test?
- Does it feel like a sellable product MVP with coherent object model,
  workflow, states, responsive behavior, and code structure?
- Would a polished static single page pass this test without proving the hard
  parts of the skill? If yes, raise the experiment complexity.

## Anti-Generic Checklist

Watch for:

- oversized generic hero text with vague copy
- gradient blob backgrounds
- repeated rounded cards without information design
- stock-like abstract imagery
- one-note palettes
- fake dashboard screenshots with unreadable text
- decorative detail that has no relation to the product or audience
- mobile text overflow, clipped buttons, or crowded controls
- broken or oversized SVG/icons caused by broad CSS selectors
- default, hover, selected, empty, loading, modal, or error states that look
  unrelated to the reference frame
- generated state boards that look like the failed implementation rather than
  the strong original reference
- browser-rendered design references that are really implementation sketches,
  lack provenance, or share source files and design decisions with the app
  being judged
- browser-rendered references whose frozen screenshots or receipt appear after
  app implementation files already exist
- whole-page layout drift hidden by local crop checks or style-language
  similarity
- image2-generated `style_reference` being treated as a loose moodboard when
  the user expected the reference structure to guide implementation
- moving topbar controls into a hero panel, changing a compact product
  workspace into a loose landing page, or replacing the generated mobile frame
  with an unrelated responsive layout without explicit acceptance
- missing design spec ledger, scattered one-off CSS values, or detail fixes
  that change the implementation without updating the visual SSOT
- material-heavy references rendered only with clean CSS boxes, simple
  gradients, generic noise, or plain borders when the reference's craft depends
  on texture, masks, glyphs, handmade edges, illustrated marks, or overlays
- generated full-page images used as fake backgrounds instead of an actual UI
  plus reusable material assets
- asset kits with no provenance, no usage map, no fallback, unreadable
  overlays, obvious tiling seams, or inconsistent material treatment across
  states
- accepted reference-specific glyphs or icon sprites replaced by generic icon
  libraries, font symbols, or visibly rescaled sheet crops
- parchment, card, inspector, modal, or frame backgrounds stretched as one
  bitmap so corners deform, edge texture warps, center fill muddies text, or
  min-size constraints are violated
- missing `frame-specimen-sheet.md` or specimen screenshots for scalable
  textured frames
- specimen screenshots whose labels, helper text, disabled captions, focus
  rings, or dense sample content are hard to read on the rendered material
- visual bug ledgers that equate "no browser-detected overflow" with "no
  visual bugs" without an explicit screenshot review by the executor, parent,
  or visual judges
- graph, map, or spatial labels that visibly overlap, collide, clip, or cluster
  into unreadable text while automated browser checks still pass
- button spacing, icon alignment, typography leading, row density, border
  weight, surface shadow, or selected-state treatment that visibly drifts from
  the reference after the broad layout has matched
- static screenshots accepted despite non-working visible controls
- visible primary controls treated as harmless prototype decoration
- blocked, empty, missing-source, permission-denied, or failed states that
  leave a previous player, transcript, citation set, cart, queue, editor,
  graph, or inspector looking live without stale or disabled treatment
- reference-visible controls, state frames, or signature details missing from
  the implementation because the inventory only counted implemented controls
- object types, navigation levels, or page regions that are visually present
  but semantically unexplained
- inspector, canvas, feed, table, timeline, map, search, and action areas that
  expose the same information without a declared hierarchy
- information architecture invented from visual layout after coding instead of
  modeled before implementation
- information scent that is too weak to tell the user what object, state, or
  next action matters
- unclear first action, next action, current business object, or completion
  signal
- duplicate mode controls, repeated tab groups, or repeated action strips whose
  scope is not visibly different
- global navigation, local lens controls, canvas controls, inspector actions,
  and footer controls competing for the same job
- a visually attractive workspace that reads as a pile of panels rather than a
  business workflow
- graph or canvas manipulation that flickers, resets positions, or fights
  selection and panning
- drag or pan that only passes final-position assertions while visibly flashing
  during movement
- mobile tabs, drawers, or segmented controls whose highlighted state does not
  match the visible panel, or whose labels disappear because active and inactive
  styling was only tested through DOM state
- mobile tabs or segmented modes that render the same panel under different
  labels instead of owning distinct content, scope, or workflow value
- mobile waveform, chart, timeline, map, or media visualization that appears as
  a blank block, clipped rectangle, missing markers, or unreadable graphic while
  desktop appears correct
- competent but unsurprising design when the task asks for high-craft,
  frontier, premium, or delightful work
- a toy single-page prototype used as evidence for sellable product-MVP
  capability
- a product MVP claim with fewer than three meaningful object types, branch
  states, or workflow steps
- a sellable product MVP test that can be passed by a polished static
  composition without proving creation, review, decision, or exception flows
- a single giant component with repeated markup, duplicated styles, and no
  clear data model after the visual target is stable

## Parity Rating

Use:

- `match`
  - the implementation preserves the reference's structure, hierarchy, and
    distinctive details under the declared reference intent
- `acceptable_delta`
  - differences are local, documented, and caused by dynamic data, real
    content, responsive constraints, browser rendering, accessibility, or web
    feasibility while preserving the reference's overall layout, hierarchy,
    proportions, materials, focal object, state treatment, and signature details
- `needs_iteration`
  - visible mismatch remains in hierarchy, spacing, typography, color, imagery,
    responsive behavior, overall layout, focal composition, materials, or
    signature details

Never mark `match` without browser screenshot evidence and a recorded
reference intent.

Never mark `match` or `acceptable_delta` when the required
`reference-provenance-ledger.md` is missing, the reference source is
`blocked_no_reference`, or the reference source is `browser_exploration_only`.
An agent-authored HTML/CSS page cannot become visual authority through
freeze-order evidence, screenshot polish, or independent review.

Never mark `acceptable_delta` when the implementation looks like a different
page from the design reference. A pleasant page, good interaction model,
appropriate library choice, and clean console do not prove visual parity.

Never mark `acceptable_delta` when `full-page-structural-parity-ledger.md` is
missing for an exact, image2-generated, or state-board implementation. Local
crops, micro-parity checks, component token matching, and style-language notes
cannot prove that the overall page structure matches.

Never mark `acceptable_delta` while the full-page ledger has high-severity
drift in first viewport composition, section order, region proportions, control
placement, primary object layout, scroll density, or mobile hierarchy.

Never mark `acceptable_delta` when visible bugs remain, including overlap,
clipping, unreadable text, malformed icons, broken assets, accidental
scrollbars, layout jumps, inconsistent state styling, or branch states that
were implemented without a reference frame or reusable state rule.

Never mark `acceptable_delta` when `design-spec-ledger.md` or
`micro-parity-checklist.md` is missing for an exact, image2-generated, or
state-board implementation. A whole-page screenshot that "basically feels
right" does not prove button spacing, control geometry, typography rhythm,
border/shadow treatment, or repeated-component density.

Never mark `acceptable_delta` when `material-parity-checklist.md` is missing
for a high-craft reference whose signature quality depends on generated or
provided material assets rather than CSS-only primitives.

Never mark `acceptable_delta` when the page structure matches but the material
system loses the reference's signature craft: paper grain becomes flat beige,
torn edges become clean rectangles, handmade glyphs become generic text,
custom icons become library defaults, glow/noise is absent, or overlays make
content unreadable.

Never mark `acceptable_delta` when assets are generated but not integrated as
real UI support. Full-page bitmap backdrops, screenshots used as surfaces, and
unresponsive image-only panels do not count as material parity.

Never mark `acceptable_delta` when generated assets lack a role-specific
pipeline: crop manifests, alpha or mask semantics, nine-slice or patch
metadata, density or responsive behavior, selector usage, and fallback
behavior must be recorded for assets that affect visible craft.

Never mark material parity as pass when `frame-specimen-sheet.md` only proves
that specimen nodes exist. The specimen screenshot must show readable labels,
body text, helper text, focus rings, and dense sample content on the actual
rendered material.

Never mark `acceptable_delta` when black-background or RGB sheet crops create
halos, dirty torn edges, opaque boxes, unreadable overlays, or seams around
transparent-looking UI. Retry the asset, create a clean alpha or mask
extraction, or mark the asset gap as blocking.

Never mark `acceptable_delta` when desktop material parity looks acceptable
but mobile screenshots show asset-caused clipping, cropped controls, broken
hit targets, unreadable texture overlays, accidental horizontal scroll, or
density that compresses the product into an unusable desktop miniature.

Never mark `acceptable_delta` while first-viewport controls or primary repeated
components have unresolved high-severity micro mismatches, including wrong
button padding, inconsistent group gaps, off-center icons, mismatched input
height, uneven card internals, heavy dividers, or state treatments that do not
belong to the reference system.

Never mark `acceptable_delta` when required interactions are fake or
unverified. If a visible control is intentionally non-functional in a
prototype, document it as out of scope and ensure it is visually non-primary,
disabled, hidden, or otherwise not presented as a live first-viewport or
primary-flow control.

Never mark `match` or `acceptable_delta` when affordance classifications are
not mutually exclusive, or when an enabled live-looking control is described as
out of scope without being disabled, hidden, removed, or made visibly
non-primary.

Never mark interaction proof complete when the latest browser check results are
only described in a ledger. Preserve the structured run output, including
interaction results, console results, and overflow results, as a named artifact
or mark the evidence incomplete. Every `working` affordance should map to that
structured evidence, not only to a sampled primary workflow.

Never treat wildcard inventory entries as exact affordance coverage. Repeated
or data-driven controls may have a summary, but each visible live instance must
be classified and mapped to structured evidence.

Never mark `acceptable_delta` when a non-happy state contradicts the product
model by leaving unavailable primary surfaces looking live. Missing-source,
blocked-generation, empty-cart, permission-denied, disconnected, or failed
states must disable, hide, empty, or explicitly mark stale any dependent
player, transcript, citation, checkout, editor, queue, graph, or inspector
surface.

Never mark `acceptable_delta` when mobile screenshots show selected tabs,
drawers, bottom sheets, or segmented controls out of sync with the visible
content.

Never mark `acceptable_delta` when two visible mobile tabs or segmented modes
show the same content with only the selected label changed. Merge duplicate
modes or give each selected state distinct content and evidence.

Never mark full-page structural parity as `match` when a reference-visible
primary action changes owner region, scope, or label. Record an accepted delta
or mismatch and judge whether the workflow remains clear.

Never mark `acceptable_delta` when a core mobile visualization is blank,
clipped, unreadable, or missing the markers that make it useful, even if
desktop and DOM checks pass.

Never mark visual bug review complete when the ledger only reports automated
console, overflow, and interaction status. It must include screenshot-review
findings for visible overlap, label collisions, contrast, clipped content,
material readability, malformed controls, and mobile first-viewport defects.

Never mark graph, map, timeline, or spatial visualization quality as pass when
labels overlap, collide, or become unreadable in screenshots, even if the
underlying node selection and view state are correct.

Never mark `acceptable_delta` when the affordance inventory is missing or when
`working` controls lack behavior-matrix evidence.

Never mark `acceptable_delta` when the reference coverage matrix is missing for
an exact, image2-generated, or state-board implementation. If the reference
shows a control or state and the implementation omits it without an explicit
merge, rename, disabled treatment, hidden treatment, or out-of-scope decision,
the result remains `needs_iteration`.

Never mark `acceptable_delta` for graph, map, canvas, whiteboard, timeline, or
spatial interfaces when drag, pan, zoom, or object manipulation visibly
flickers, resets, jumps, or conflicts with selection.

Never mark `acceptable_delta` from a final-position drag assertion alone.
Dragging is a motion-quality claim and needs frame-level or recording-derived
evidence.

Never mark `acceptable_delta` for spatial interfaces when minimaps, zoom
controls, legends, status chips, library handles, or floating panels cover
important nodes, labels, or graph branches in the default screenshot.

Never mark `acceptable_delta` for mobile when mode switches, canvas controls,
capture controls, or other primary controls are clipped, hidden by overflow, or
too small for practical touch operation.

Never mark `acceptable_delta` while `visual-bug-ledger` has blocker items.

Never keep a prior `match` or `acceptable_delta` decision after the user
reports visible errors. Downgrade to `needs_iteration`, record the report in
the visual bug ledger, and rerun the visual gate after fixes.

## Visual Gate Protocol

Use this gate for important UX work, exact-reference implementations, and any
image2-generated design reference that will become an implementation target.

Run two scoring passes:

- design reference score
  - required when the design reference is generated or exploratory
  - optional only when the user supplies an approved design authority
- implementation score
  - required after browser screenshots, state screenshots, behavior evidence,
    visual bug ledger, and canvas stability evidence exist

Use at least three independent quiet-room judges when available. Do not expose
prior judge conclusions to later judges. Suggested judge lenses:

- reference parity judge
- product interaction and affordance judge
- visual defect and canvas stability judge

Each judge writes one `visual-judge-scorecard` with 1-5 scores and concrete
screenshot-region evidence for these dimensions:

| dimension | question |
| --- | --- |
| wholeness | Does it feel like one coherent product system? |
| intent | Does the composition show deliberate product-specific direction? |
| craft | Are typography, spacing, contrast, iconography, material, and states clean? |
| operability | Can the user understand context, status, and next action without hesitation? |
| reference alignment | Does it preserve layout, proportions, density, materials, component treatment, and signature details? |
| information architecture | Are object taxonomy, navigation hierarchy, page region responsibilities, and progressive disclosure clear? |
| workflow legibility | What does the user do first, what changes next, and how is completion or progress visible? |
| control architecture | Does each control group have one clear owner, scope, and non-duplicated purpose? |
| state quality | Do selected, empty, responsive, disabled, and branch states belong to the same system? |
| full-page structural parity | Do whole-page screenshots preserve first viewport, section order, region proportions, control placement, primary object layout, and mobile hierarchy? |
| design spec fidelity | Were grid, spacing, type, color, material, control, and state tokens inferred and used consistently? |
| micro-parity | Do cropped details match the reference in controls, typography, borders, shadows, density, and icon alignment? |
| spatial label legibility | Are graph, map, timeline, and spatial labels readable without overlap or ambiguous ownership? |
| material readability | Are frame specimens and material-backed panels readable in real screenshots, including helper and disabled text? |
| interaction honesty | Do visible controls work, disable honestly, hide, or become non-primary? |
| accessibility/actionability | Are labels, focus behavior, keyboard paths, and dragging alternatives acceptable? |
| ambition/delight | Does the result contain a product-specific high-craft moment that is useful, memorable, and non-generic? |
| mvp complexity | For skill experiments, does the task prove a sellable product MVP rather than a toy single page? |
| motion-frame stability | Does drag/pan remain visually continuous during movement, not only after mouseup? |

Each judge must also list blockers. A blocker is any visible defect that should
prevent ship or handoff: major layout mismatch, incoherent product identity,
clipped primary content, unclear information architecture, unclear primary
workflow, duplicated or conflicting control groups, fake primary control,
unreadable or inaccessible primary action, missing full-page structural
parity, missing design-spec evidence, unresolved high-severity micro-parity
drift, unstable canvas manipulation, or branch state that looks unrelated to
the system.

Judges should treat screenshots as higher authority than automation summaries.
If automation says the interaction passes but the screenshot shows overlap,
clipping, undersized controls, library artifacts, or an unframed mobile state,
the blocker stands.

Executor self-review, browser automation, and judge medians can be overridden
by a later parent, user, or independent reviewer screenshot review when that
review names concrete visible blockers. Treat visible first-viewport crowding,
clipped labels, overlapped action stacks, unreadable dense text, malformed
frames, or mobile cutoffs as `needs_iteration` until the screenshots and
ledgers are refreshed. Do not preserve `strictPass: true` beside unresolved
reviewer-visible blockers.

Aggregate into `judge-aggregation`:

- per-dimension median
- per-dimension minimum
- overall median
- judge disagreement notes
- blocker list with screenshot-region refs
- decision: `pass`, `needs_iteration`, or `blocked`

Default pass threshold:

- overall median >= 4.0
- every dimension median >= 3.5
- no dimension minimum below 3.0 unless explicitly accepted with rationale
- zero unresolved blockers

For high-craft work, use the stricter ambition threshold unless the user
explicitly lowers it:

- craft median >= 4.2
- intent median >= 4.2
- wholeness median >= 4.2
- ambition/delight median >= 4.0
- no judge may call the result "generic", "library-default", or "nice but not
  surprising" without that becoming a `needs_iteration` finding

If the gate fails, convert judge findings into visual-bug-ledger items and keep
iterating. Do not average away blockers.

Before spawning or assigning judges, run a local pre-judge sanity check. If
known screenshots already show obvious blockers, do not spend judge passes to
rediscover them. Record the defects, fix, refresh artifacts, and only then run
the independent visual gate.

## Side-By-Side Visual Decomposition

Before implementation and after each screenshot pass, review:

| reference feature | implemented status | severity | action |
| --- | --- | --- | --- |
| page frame and region proportions | <match/partial/miss> | <high/medium/low> | <fix/defer> |
| navigation and toolbar structure | <match/partial/miss> | <high/medium/low> | <fix/defer> |
| information architecture | <clear/partial/unclear> | <high/medium/low> | <fix/defer> |
| workflow legibility | <clear/partial/unclear> | <high/medium/low> | <fix/defer> |
| control architecture and duplicate controls | <clear/partial/conflicting> | <high/medium/low> | <fix/defer> |
| focal object and center composition | <match/partial/miss> | <high/medium/low> | <fix/defer> |
| full-page structure and section order | <match/partial/miss> | <high/medium/low> | <fix/defer> |
| typography hierarchy | <match/partial/miss> | <high/medium/low> | <fix/defer> |
| design spec and token conformance | <match/partial/miss> | <high/medium/low> | <fix/defer> |
| micro-parity details | <match/partial/miss> | <high/medium/low> | <fix/defer> |
| palette, material, and background | <match/partial/miss> | <high/medium/low> | <fix/defer> |
| component shape and line treatment | <match/partial/miss> | <high/medium/low> | <fix/defer> |
| signature details | <match/partial/miss> | <high/medium/low> | <fix/defer> |
| branch states and responsive frames | <match/partial/miss> | <high/medium/low> | <fix/defer> |
| visible bugs and polish defects | <none/partial/present> | <high/medium/low> | <fix/defer> |
| required interaction behavior | <works/partial/fake> | <high/medium/low> | <fix/defer> |
| affordance inventory and behavior matrix | <complete/partial/missing> | <high/medium/low> | <fix/defer> |
| graph/canvas stability | <smooth/partial/flickers/not_applicable> | <high/medium/low> | <fix/defer> |
| motion-frame stability | <smooth/partial/flickers/not_applicable> | <high/medium/low> | <fix/defer> |
| graph/canvas safe zones | <clear/partial/blocked/not_applicable> | <high/medium/low> | <fix/defer> |
| mobile touch and mode entry | <clear/partial/blocked/not_applicable> | <high/medium/low> | <fix/defer> |
| visual judge aggregation | <pass/needs_iteration/blocked/missing> | <high/medium/low> | <fix/defer> |
| component/code structure | <clean/partial/brittle> | <high/medium/low> | <fix/defer> |
