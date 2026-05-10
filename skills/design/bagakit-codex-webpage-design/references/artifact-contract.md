# Artifact Contract

Use these names when a webpage design task needs durable local artifacts.

Recommended root:

- `.bagakit/codex-webpage-design/<task-slug>/`

Files:

- `design-brief.md`
  - goal, audience, content, brand/assets, visual direction, constraints
- `redesign-preservation-audit.md`
  - required before editing an existing project or page; records current
    stack, styling method, brand tokens, IA, content blocks, reusable
    components, accessibility wins, analytics-sensitive labels, routes, risky
    dependencies, and low-risk upgrade order
- `reference-intent.md`
  - strongest available reference context, intent class, why image2 is needed
    or why a provided reference is stronger
- `reference-provenance-ledger.md`
  - source class, produced artifact, non-substitution constraints, and
    reference review status
- `reference-survey-ledger.md`
  - comparable product/page references, source class, inspected strengths,
    information density, composition model, copy/icon language, component and
    interaction conventions, responsive treatment, signature craft, cannot-lose
    comparison points, and where the design should exceed the archetype
- `design-core-design-packet.toml`
  - optional peer packet from `bagakit-design-core`; target register, source
    evidence refs, tone axes, rule coverage, observed/derived/fallback split,
    accepted uncertainty, and downstream hints
- `design-core-draft-review.md`
  - draft review against the design packet's tonality, reference tier, and
    full-surface rule coverage before implementation
- `visual-decomposition.md`
  - reference image reading: page frame, region proportions, toolbar,
    navigation, focal object, typography, palette, materials, component shapes,
    spacing rhythm, and signature details
- `image-extraction-checklist.md`
  - required when implementing from an image, screenshot, Figma frame,
    generated reference, or state board; records visible text, typography,
    spacing, buttons/components, color roles, section rhythm, density, image
    treatment, unclear details, and detail-frame or accepted-uncertainty needs
- `semantic-visual-map.md`
  - major visual regions mapped to the user question, object, state, action,
    risk, visual expression, and merge/demote decision each region owns
- `information-compression-pass.md`
  - core concept model, duplicate concepts or claims, redundant modules,
    merged/removed/demoted surfaces, and the final object-state-action-next-step
    reading path
- `surface-composition-pass.md`
  - how surfaces, layers, density, material, contrast, typography, and state
    treatment carry hierarchy without relying on wireframe outlines or stacked
    generic cards
- `density-budget.md`
  - first-viewport density, region gaps, card/list density, component padding,
    row height, scroll length, and accepted reasons for any large whitespace
- `copy-icon-budget.md`
  - copy budget, icon/control semantics, required labels, removable explanation
    text, status/count/grouping cues, and visual-noise risks
- `design-spec-ledger.md`
  - token and visual-system source of truth inferred from the reference:
    typography, color palette, spacing, hierarchy, borders/elevation/radius,
    state styling, density, motion, brand tone, page grid, control geometry,
    component density, source/usage for repeated values, gaps or
    inconsistencies, and accepted uncertainty
- `design-core-plan-review.md`
  - concrete design plan review that maps packet tone and design rules into
    CSS tokens, assets, component geometry, states, and responsive behavior
- `asset-requirement-pass.md`
  - determines whether reference craft needs generated or provided material
    assets rather than CSS approximation; lists required textures, masks,
    sprites, icon sheets, overlays, provenance, formats, and fallback behavior
- `asset-generation-ledger.md`
  - generated or provided asset refs, prompts, accepted/rejected variants,
    asset roles, crop manifest, alpha/mask or slice metadata, responsive
    behavior, usage map, optimization notes, provenance, and integration status
- `frame-specimen-sheet.md`
  - required when accepted assets include scalable UI frames; shows the
    nine-slice renderer at minimum, normal, wide, tall, dense-content, and
    mobile sizes with edge, corner, center-fill, padding, min-size, and
    clipping findings
- `ambition-bar.md`
  - high-craft target, comparison tier, product-specific delight moment,
    signature detail, anti-generic risks, and judge score target
- `mvp-experiment-plan.md`
  - required only for skill-quality experiments; product MVP concept, object
    types, views/states, workflows, primary actions, responsive scope, delight
    moment, and why the test is more than a toy single-page prototype
- `state-reference-set.md`
  - reference frames or reusable component/state rules for default, selected,
    search/filter, empty/loading/error, modal/drawer/open panel, hover/focus,
    disabled, and responsive states that materially affect the product feel
- `section-reference-plan.md`
  - required for multi-section generated landing, marketing, product,
    portfolio, or full-site references; records section count, ordered section
    names, section job, frame label, canvas ratio, composition anchor,
    background mode/material treatment, concept spine, image role, second-read
    detail, CTA role, density level, and responsive implication
- `section-frame-continuity-ledger.md`
  - required when generated references are split across multiple section
    frames; records shared palette, type scale, spacing cadence, CTA family,
    radius/material language, imagery grade, icon or mark style, copy tone,
    visual throughline, and any one-time delayed-recognition detail
- `information-architecture-map.md`
  - object taxonomy, navigation hierarchy, page region responsibilities,
    content grouping, progressive disclosure, information scent, object
    relationships, and where relationships become actionable
- `workflow-model.md`
  - primary user path, core business object, state-changing action, decision
    points, next action, completion signal, and what the page must make
    understandable without external explanation
- `control-surface-map.md`
  - owner region, scope, state, duplicate status, and behavior evidence for
    each mode switch, tab group, toolbar, command bar, inspector action,
    floating control, canvas control, footer control, and global navigation item
- `interaction-model.md`
  - user goals, task flow, core objects, object states, feedback, and
    accessibility expectations for non-static pages
- `interaction-intuition-pass.md`
  - first action discoverability, status visibility, convention fit, control
    ownership, feedback, reversibility, error prevention, recovery paths,
    keyboard behavior, and touch alternatives before implementation
- `mobile-interaction-plan.md`
  - navigation adaptation, tab/drawer/sheet ownership, target size, gesture
    alternatives, primary action placement, visualization fallback, selected
    states, and mobile evidence plan for dense or interactive pages
- `capability-route.md`
  - stack and library choices mapped to required effects such as graph,
    search, charting, rich text, animation, canvas, or 3D
- `frontend-architecture-plan.md`
  - component hierarchy, repeated data structures, state ownership,
    file/style organization, mapping from the design-spec ledger to CSS or
    theme tokens, shared token usage, and post-parity refactor targets before
    code; simple static pages may record `not_needed_simple_static_page`
- `component-source-ledger.md`
  - source status for major components and widgets: `host_component`,
    `accessible_primitive`, `domain_library`, `custom_reference_craft`,
    `custom_simple`, or `blocked`, with rationale, owner, variants, states,
    token usage, accessibility hooks, do/don't rules, and replacement rule
- `affordance-inventory.md`
  - every visible interactive affordance classified exactly once as `working`,
    `disabled`, `hidden`, or `explicitly_out_of_scope`
- `reference-coverage-matrix.md`
  - every reference-visible control, state, and important detail mapped to
    implemented, disabled, hidden, merged, renamed, or explicitly out of scope
- `behavior-matrix.md`
  - expected action, expected result, keyboard expectation, and browser
    evidence for every `working` affordance
- `visual-bug-ledger.md`
  - overlap, clipping, malformed controls, accidental scrollbars, layout jumps,
    unreadable text, state inconsistencies, spatial label collisions, material
    readability defects, mobile first-viewport defects, screenshot-review
    findings, blocker status, and finding bucket: `blocker`,
    `quality_issue`, or `polish_recommendation`
- `full-page-structural-parity-ledger.md`
  - whole-page and first-viewport comparison of reference versus
    implementation for page frame, section order, region proportions, control
    placement, primary object layout, scroll density, and mobile hierarchy
- `micro-parity-checklist.md`
  - cropped detail-level comparison for page shell, controls, typography,
    icons, card/list density, borders, shadows, dividers, material, and state
    styling
- `material-parity-checklist.md`
  - asset-backed comparison for texture density, surface grain, torn/masked
    edges, ink bleed, glyph/icon character, image overlays, tiling seams,
    loading fallback, and whether generated assets preserve signature craft
- `canvas-stability-report.md`
  - graph, map, canvas, whiteboard, timeline, or spatial-surface state model,
    library settings, manipulation quality, drag/pan/zoom evidence, safe-zone
    placement, overlay behavior, mobile touch-control evidence, and
    before/mid/after drag frame evidence
- `visual-judge-scorecards.md`
  - independent quiet-room judge scorecards with 1-5 dimension scores,
    screenshot-region evidence, blocker findings, and rationale
- `comparative-design-review.md`
  - final comparison against the reference survey for information clarity,
    density, surface composition, copy/icon economy, responsive handling,
    material craft, signature detail, and any accepted weaker-than-reference
    deltas
- `design-core-result-review.md`
  - final review against the consumed design-core packet; required when a
    packet, draft review, or plan review shaped the work
- `review-packet.md`
  - paired or independent review packet following
    `docs/specs/review-packet-contract.md`; records reviewer ownership,
    visual counterevidence, accepted deviations, merge rule, verdict, and next
    action
- `judge-aggregation.md`
  - median/minimum scores, disagreement notes, blocker list, decision, and
    iteration actions from the visual gate protocol; aggregate accessibility,
    hierarchy/rhythm, interaction-state, anti-default, token, component, and
    visual defects before prioritizing fixes
- `image-prompt.md`
  - exact prompt, reference inputs, negative constraints, revision notes
- `design-reference.md`
  - generated image refs or provided design refs, critique, selected direction
- `implementation-notes.md`
  - stack choice, file refs, key layout decisions, known trade-offs
- `visual-parity-ledger.md`
  - screenshot refs, viewport, mismatches, fixes, accepted deltas
- `interaction-parity-ledger.md`
  - flow and state checks against the interaction model and state reference set
  - required browser interaction evidence for click, drag/pan/zoom,
    search/filter, clear/reset, capture editing, keyboard activation, and other
    visible primary affordances
- `code-quality-review.md`
  - component boundaries, repeated UI extraction, shared tokens, data model,
    duplication, accessibility hooks, and remaining maintainability risks
- `handoff.md`
  - final artifact refs, validation, remaining risks, next action

Do not store absolute filesystem paths in these files. Use repo-relative paths
or logical artifact names.

`design-core-design-packet.toml` is optional composition, not a hard dependency.
When it exists, consume it as design guidance for image prompts, design spec,
assets, component rules, and result review. When it is absent, this skill stays
self-contained and uses its local reference survey, decomposition, ambition,
and visual quality rules. Do not duplicate the packet into Markdown as a second
source of truth; checkpoint reviews should cite packet fields and record
verdicts, deltas, and blockers.

`reference-intent.md`, `visual-decomposition.md`, `design-spec-ledger.md`, and
state coverage are blocking artifacts for implementation. For high-craft work,
`reference-survey-ledger.md`, `ambition-bar.md`, and the design-draft quality
passes are also blocking before implementation. If no stronger reference
exists, `design-reference.md` must point to an image2-generated reference before
implementation can claim visual completion. If image generation is unavailable,
preserve `image-prompt.md` and hand off the blocker instead of coding directly
from text requirements.

`reference-provenance-ledger.md` is blocking whenever a generated or provided
reference will guide implementation. It must classify the source as
`external_strong`, `image2_filesystem`, `browser_exploration_only`, or
`blocked_no_reference`. Only `external_strong` and `image2_filesystem` can pass
the reference gate for visual implementation completion. A browser-rendered
HTML/CSS page authored by the agent is `browser_exploration_only`: it may help
shape an Image2 prompt, design brief, or feasibility prototype, but it cannot
become the design source of truth, even if it was created first and frozen as a
screenshot. If Image2 cannot produce a saved artifact and no stronger reference
exists, mark `reference_blocked` and preserve the retry evidence instead of
coding directly from text or HTML.

For skill-quality experiments, `blocked_no_reference` means the experiment is
`invalid_no_reference`, not a partial implementation score. Stop before app
implementation and preserve the prompt, retry evidence, and blocker handoff.

`redesign-preservation-audit.md` is blocking before editing an existing
project, route, or page. It protects continuity without freezing the old
design. Record what should be preserved, what should be intentionally improved,
what is risky to rename or move, and the order of low-risk changes. The audit
should cover host stack, routing, styling approach, token/theme sources,
component and asset reuse, content and IA, accessibility behavior, analytics or
test-sensitive labels, and dependencies. A redesign may exceed the old UI, but
it should know what it is replacing.

`image-extraction-checklist.md` is blocking when visual implementation starts
from an image-like reference. Extract the reference into buildable facts before
writing CSS: exact or approximate text, type scale, line height, spacing,
layout proportions, component geometry, button/input states, color roles,
background and image treatment, density, section rhythm, and signature details.
When important details are too small or ambiguous, generate or request a
detail frame, inspect a crop, or record accepted uncertainty before guessing in
code.

`design-spec-ledger.md` must be concrete enough to implement from and is the
token and visual-system source of truth. It must cover typography, color
palette, spacing, hierarchy, borders/elevation/radius, state styling, density,
motion, brand tone, page grid, control geometry, component density, and accepted
uncertainty. Do not create a separate `visual-system-ledger.md`; strengthen this
ledger instead. If the implementation uses scattered one-off CSS values instead
of the ledger's variables, tokens, or constants, code quality and visual parity
remain incomplete. When review changes a standard, update the ledger first so
the design source of truth does not drift.

`asset-requirement-pass.md` is blocking for high-craft references whose visual
quality depends on non-geometric material details: grain, worn paper, fabric,
metal, glass, ink, paint, hand-cut edges, glyph stamps, illustrated icons,
noise fields, glow overlays, custom frames, or other details that ordinary
CSS borders, shadows, and gradients would flatten. If the pass says assets are
needed, implementation must not claim visual completion until
`asset-generation-ledger.md` maps each required asset to a generated, provided,
or deliberately rejected artifact.

Generated asset kits should be specific and reusable rather than another full
page mockup. Prefer transparent PNG/SVG sprites, repeatable texture tiles,
edge masks, overlay images, custom icon or glyph sheets, frame slices, and
state-specific material treatments. Record how each asset is applied in CSS or
components, how it behaves responsively, and what readable fallback appears if
the asset fails to load.

For every accepted asset, record the role from `asset-pipeline.md`:
`texture_tile`, `alpha_mask`, `nine_slice_frame`, `sprite_or_glyph_sheet`,
`responsive_art`, or `overlay`. If the asset was cut from a generated sheet,
record the crop rectangle, output dimensions, trim threshold if used, and
extraction command or tool. If the asset needs transparent edges, record alpha
or mask semantics and reject black-background crops that leave halos or seams.
If the asset is a scalable frame, record slice margins, border widths, fill
behavior, renderer strategy, edge stretch or tile, content padding, and
minimum size. The renderer strategy must be `css_border_image`,
`dom_patch_component`, or `canvas_nine_slice`; otherwise the asset is not ready
for live UI. If the asset changes across viewports or densities, record the
selected desktop and mobile behavior.

If the accepted asset is a reference-specific icon, glyph, stamp, or small
mark, record target size, alpha semantics, component owner, fallback, and
reference comparison. A successful custom glyph should not be replaced by a
generic library icon or sheet crop unless the reference intent changes.

`ambition-bar.md` must name the useful surprise or signature craft moment. If
the target is only "clean" or "nice", the task is under-specified for
high-craft work.

For skill-quality experiments, `mvp-experiment-plan.md` is a blocking artifact.
It must describe a sellable product MVP test with at least three meaningful
object types, at least three states or views including one non-happy path, one
creation/capture/commit action, one review/comparison/synthesis/decision
workflow, desktop and mobile scope, and a product-specific delight moment. A
single static page can be a smoke test, but it must not be used as proof that
the skill handles product MVP complexity.

For skill-quality experiments, the MVP plan must also name why the chosen
complexity can falsify the skill. It should explain which information
architecture, workflow, state, interaction, responsive, and code-structure
risks a toy page would miss. If those risks are not testable, label the run
`smoke_test` or `single-page-prototype` before implementation.

State coverage means each meaningful branch state has one of:

- a reference frame from image2 or another stronger design source
- a reusable component/state rule extracted from the reference
- an explicit gap marked blocking or accepted before implementation

Do not implement important state visuals from local invention.

Section reference coverage means each planned generated section has one
focused horizontal frame or an explicit accepted gap before implementation.
For generated multi-section landing, marketing, product, portfolio, or
full-site work, `section-reference-plan.md` and
`section-frame-continuity-ledger.md` are blocking artifacts before coding. The
plan is the count and ordering source of truth; `design-reference.md` points to
the generated frame artifacts and must not silently omit planned sections.

If both a tall overview and section frames exist, the section frames carry
section-level craft and implementation detail. The tall overview may help with
scroll order, but it must not override missing per-section frames. If only
section frames exist, `full-page-structural-parity-ledger.md` compares the
implemented scroll against the ordered frame set: section order, first
viewport, region proportions, rhythm, responsive hierarchy, and accepted
deltas.

The continuity ledger should summarize one shared brand system rather than
duplicate per-frame state. Use it to prevent palette, typography, CTA,
material, imagery, icon, or copy drift across generated frames while allowing
composition, density, and background treatment to vary deliberately.

The section plan should also prevent vague section generation. Each section
frame needs a composition anchor, background mode, concept spine, second-read
detail, CTA role, and density level. If a section cannot name these controls,
it is not ready for image generation or implementation.

If there is a strong original reference, state frames must preserve that
reference. Do not derive state boards from a failed or under-review
implementation screenshot. Such screenshots may be recorded as bug evidence,
not as design source, unless the user explicitly approves them as the new
baseline.

For complex product pages and non-static pages,
`information-architecture-map.md`, `workflow-model.md`,
`control-surface-map.md`, `interaction-model.md`, `interaction-intuition-pass.md`,
`mobile-interaction-plan.md`, `frontend-architecture-plan.md`,
`component-source-ledger.md`, and the capability route are also blocking
artifacts. Do not implement a graph, editor, search experience, workflow
surface, chart, map, animation-heavy page, canvas, WebGL, or 3D experience from
a static reference alone.

For product-like, content-heavy, and high-craft pages, `semantic-visual-map.md`
must assign a semantic job to each major visual region before implementation.
Each region should state the user question it answers, the object/state/action
or risk it represents, the visual expression it uses, and whether overlapping
regions were merged, demoted, or removed. Simple one-message pages may satisfy
this through `visual-decomposition.md` and `copy-icon-budget.md`.

`information-architecture-map.md` must define the product's object model before
visual implementation: primary and secondary objects, metadata, evidence
objects, global/local/contextual navigation, page region responsibilities,
progressive disclosure, information scent, and cross-object relationships. If
the page cannot explain what exists, where it lives, and how regions relate,
the implementation is not ready for visual judging.

Information scent must be checked in the rendered screenshots, not only in the
artifact. Labels, counts, status, priority, grouping, previews, and next-action
cues should make the user's path discoverable without external narration.

`workflow-model.md` must state the primary user path in a way that can be
checked against screenshots: starting context, current business object, action
that changes state, next action, decision points, system feedback, and
completion signal. If the page cannot explain what the user does first and why,
the implementation is not ready for visual judging.

`control-surface-map.md` must assign one canonical owner to each mode, lens,
action, and workflow step. Unexplained duplicate controls are blockers. A
duplicate control is allowed only when it is classified as a mirrored shortcut,
shares state and terminology with the canonical owner, and has a documented
workflow reason. Otherwise remove, merge, disable, or restyle the duplicate
before completion.

For responsive tabs, drawers, sheets, and segmented controls, each selected
state must expose distinct owner content or a distinct workflow scope. If two
tabs render the same panel, they are duplicate controls and must be merged,
removed, or re-scoped before completion.

`interaction-intuition-pass.md` must make the first plausible action testable
before implementation. It should connect workflow, control ownership, status,
feedback, reversibility, error prevention, recovery, keyboard behavior, and
touch alternatives to browser evidence. Purely static pages may record
`not_needed_simple_static_page`.

`mobile-interaction-plan.md` is blocking before code for interactive, dense,
spatial, editor, dashboard, or commerce surfaces. It must choose mobile
navigation, drawer/sheet/tab ownership, target sizes, gesture alternatives,
primary action placement, visualization fallback, and selected-state evidence
before screenshots expose late mobile failures. Simple static pages may record
responsive typography and content order instead of a separate plan.

`frontend-architecture-plan.md` must be written before code for componentized or
stateful work. It should name component hierarchy, repeated data structures,
state ownership, file/style organization, shared token usage from
`design-spec-ledger.md`, and post-parity refactor targets. Simple static pages
may record `not_needed_simple_static_page`.

`component-source-ledger.md` must prefer host components first, mature
accessible primitives for common widgets, domain libraries for complex tables,
graphs, editors, maps, and gestures, and custom components only when reference
craft, host constraints, or simple low-risk behavior justify them. A `blocked`
source status must stop implementation or narrow the scope before coding.

For graph, map, timeline, and other spatial views, screenshot review must
inspect labels and ownership cues. Passing node selection or final-state
assertions does not clear visual quality when labels overlap, collide, truncate
badly, or make node ownership ambiguous.

For non-static pages, `affordance-inventory.md` and `behavior-matrix.md` are
blocking completion artifacts. Do not claim completion from a few sampled
interactions. Every visible live-looking control must be inventoried; every
`working` control must have browser behavior evidence; every non-working
control must be disabled, hidden, or explicitly out of scope with non-primary
treatment.

Primary commit actions need negative-path evidence. If the page has a
non-happy state, the behavior matrix must include the attempt before recovery
for publish, stage, approve, queue, checkout, sign off, send, export, or other
finalizing controls. The expected result must be disabled, refused, converted
to a clearly labeled review packet, or otherwise proven not to create a final
completion receipt while blockers remain.

Affordance classification must be mutually exclusive. If the same visible
control is listed as `working` and also out of scope, disabled, hidden, or
unverified, the inventory is invalid. Every `working` row must map to a saved
structured browser-check result, not only a prose ledger statement.

Browser-check results must include assertion integrity, not only execution
logs. For every `ok: true` interaction, save expected and actual values for the
meaningful state change. Mode, tab, drawer, and shortcut checks must record the
control owner, expected active key, actual active key, expected visible region,
actual visible region, and selected-state screenshot when relevant. If the
actual value is wrong, unchanged, stale, or ambiguous, the entry is a failed
check even if the click did not throw.

Data-driven affordances must still be concrete in the inventory. Wildcard
groups may summarize repeated controls, but each visible generated thesis row,
node, card, heatmap cell, tab, or path that is styled as live must have its own
classification and browser evidence key.

For exact-reference, image2-generated, or state-board implementations,
`reference-coverage-matrix.md` is also a blocking completion artifact. It must
list reference-visible controls, states, and signature details before judging
the implementation. Missing reference-visible behavior is a blocker unless it
is explicitly merged, renamed, disabled, hidden, or out of scope with a
documented reason. A page that only inventories what it happened to implement
has not proven reference coverage.

For graph, map, canvas, whiteboard, timeline, or spatial interfaces,
`canvas-stability-report.md` is a blocking completion artifact. Drag, pan,
zoom, object manipulation, and selection must be tested for flicker, object
reset, layout jump, and gesture conflict.

Drag and pan stability require motion-frame evidence. A final-position check
after mouseup is not enough. Record before, mid-drag, and after-drag
screenshots or a frame-sample report that can reveal flashing, redraw artifacts,
z-order jumps, disappearing text, transition lag, and scene rebuilds.

For spatial interfaces, `canvas-stability-report.md` must also prove safe
placement for minimaps, zoom controls, legends, status UI, library handles, and
floating panels. These controls must not cover important content in default
desktop or mobile screenshots. Mobile canvas controls and mode switches must be
fully visible and practically touchable.

For spatial, board, graph, canvas, pin-wall, map, timeline, or other dense
object-layout pages, mobile must be an intentional adaptation. Do not shrink a
desktop board into a miniature if cards, nodes, labels, or controls become
hard to read or operate. Use a deliberate mobile list, carousel, focus path,
selected-object sheet, grouped lanes, or drilldown pattern, and record the
chosen pattern in `state-reference-set.md` and
`full-page-structural-parity-ledger.md`. Browser `overflow-x: false` is not
enough if the screenshot still shows unreadable density.

If a meaningful mobile state exists, `state-reference-set.md` must include a
mobile reference frame, a mobile-specific state rule, or an explicit blocking
gap. A desktop design squeezed into mobile is not enough for completion.

For visual parity completion, `visual-bug-ledger.md` must have zero blocker
items. Visible clipping, overlap, malformed controls, accidental scrollbars,
dead primary affordances, or unstable canvas manipulation cannot be accepted as
`acceptable_delta`.

`visual-bug-ledger.md` must use screenshots as evidence, not only automation
summaries. Console, DOM, overflow, and interaction checks can say the page is
executable, but they do not prove that text, labels, frames, maps, controls,
and materials are visually correct. The ledger must record a screenshot-review
row from the executor, parent, or judge set before it can claim zero blockers.

For visual parity completion, `full-page-structural-parity-ledger.md` is
blocking for exact, image2-generated, and state-board implementations. It must
compare the reference and implementation as whole pages and first viewports
before local crops or micro-parity can pass. High-severity mismatch in first
viewport composition, section order, region proportions, control placement,
primary object layout, scroll density, or mobile hierarchy keeps parity at
`needs_iteration`.

If the reference is generated by image2, `style_reference` means style plus
structural guidance unless the user explicitly says the image is only a mood
reference. Do not use `style_reference` to justify large structural rewrites.

Reference-visible primary actions and control ownership are part of structural
parity. If a reference topbar action is moved into an inspector, replaced by a
different command, or changed from global to local scope, record that as a
delta with rationale. Do not mark it `match`.

For visual parity completion, `micro-parity-checklist.md` must also have no
unresolved high-severity mismatches. It should compare cropped regions against
the reference for button spacing, group gaps, input height, icon size and
centering, typography leading, card/list density, border weight, divider
strength, shadow/blur/material treatment, and selected/hover/focus states.
Whole-page screenshots are not enough when small craft details are the
remaining source of drift.

Build, lint, console, overflow, and interaction checks are execution evidence,
not visual parity evidence. If screenshots still show visible blocker defects,
`visual-bug-ledger.md` remains open even when automation passes.

Artifact freshness is required for completion. When layout, interaction,
screenshots, or validation scripts change, refresh the affected ledgers before
judge review or final handoff.

Browser evidence freshness is part of artifact freshness. Save the latest
interaction, console, overflow, and screenshot-capture results as named
artifacts. If old logs remain in the evidence bundle and contradict the latest
claim, either mark them superseded or record the conflict.

Browser evidence conflicts block completion. If structured results mark an
interaction as passing while the recorded actual state does not equal the
expected state, reopen `visual-bug-ledger.md` or `interaction-parity-ledger.md`
and downgrade parity to `needs_iteration`.

Missing blocked-action evidence is also a conflict. If a non-happy screenshot
shows an enabled primary commit action but the latest browser results only test
that action after recovery, reopen the interaction ledger and downgrade parity
to `needs_iteration`.

For important UX work, generated design references, and exact-reference
implementations, `visual-judge-scorecards.md` and `judge-aggregation.md` are
blocking completion artifacts. A generated or exploratory design reference
must pass the design-reference score before coding. The implemented result
must pass the implementation score before `match` or `acceptable_delta`.

For high-craft work, the judge aggregation must include ambition/delight and
motion-frame stability dimensions. A result that is competent but "nice, not
surprising" remains `needs_iteration` unless the user explicitly lowers the
bar.

User-reported visible errors invalidate the prior visual gate decision. Reopen
`visual-bug-ledger.md`, downgrade parity to `needs_iteration`, rerun judge
aggregation after fixes, and record whether the report was resolved or
explicitly accepted as a trade-off.

The same override applies when the executor, parent agent, or an independent
visual judge finds concrete screenshot blockers after an artifact claims
`strictPass`. Record the blocker with a screenshot-region reference, downgrade
`judge-aggregation` and `browser-check-results` to `needs_iteration` or
conflicted evidence, fix the page, then recapture screenshots before restoring
pass status.

## Handoff Shape

```markdown
## Result

- Page: <repo-relative route or file>
- Design reference: <repo-relative artifact ref>
- Reference intent: <exact|style_reference|asset|content_context|data_context>
- Reference provenance: <external_strong|image2_filesystem|browser_exploration_only|blocked_no_reference and ref>
- Reference survey ledger: <ref or not_needed_stronger_reference_low_craft>
- Visual decomposition: <ref>
- Semantic visual map: <ref or not_needed_simple_page>
- Information compression pass: <ref or not_needed_simple_page>
- Surface composition pass: <ref or not_needed_low_craft>
- Density budget: <ref or not_needed_simple_page>
- Copy/icon budget: <ref or not_needed_simple_page>
- Design spec ledger: <ref>
- Ambition bar: <ref or not_needed_low_craft>
- MVP experiment plan: <ref or not_needed_not_skill_experiment>
- State reference set: <ref or not_needed_static_page>
- Information architecture map: <ref or not_needed_simple_page>
- Workflow model: <ref or not_needed_static_page>
- Control surface map: <ref or not_needed_static_page>
- Interaction model: <ref or not_needed_static_page>
- Interaction intuition pass: <ref or not_needed_simple_static_page>
- Mobile interaction plan: <ref or not_needed_simple_static_page>
- Capability route: <ref or not_needed_static_page>
- Frontend architecture plan: <ref or not_needed_simple_static_page>
- Component source ledger: <ref or not_needed_simple_static_page>
- Affordance inventory: <ref or not_needed_static_page>
- Behavior matrix: <ref or not_needed_static_page>
- Visual bug ledger: <ref and blocker count>
- Full-page structural parity ledger: <ref and high-mismatch count>
- Micro parity checklist: <ref and high-mismatch count>
- Asset requirement pass: <ref or not_needed_css_sufficient>
- Asset generation ledger: <ref or not_needed_no_assets>
- Material parity checklist: <ref and high-mismatch count or not_needed_no_assets>
- Canvas stability: <ref or not_needed_non_spatial_page>
- Canvas safe zones: <passed|partial|blocked|not_needed and ref>
- Visual judge scorecards: <ref or not_needed_low_risk>
- Comparative design review: <ref or not_needed_no_reference_survey>
- Judge aggregation: <pass|needs_iteration|blocked|not_needed_low_risk and ref>
- Image2 status: <generated|not_needed_stronger_reference|blocked_unavailable>
- Reference provenance gate: <passed|blocked with evidence ref>
- Stack: <framework or static>

## Validation

- desktop screenshot: <ref>
- mobile screenshot: <ref>
- console/runtime: <result>
- interaction/state parity: <ref or not_needed_static_page>
- browser check results: <ref with interaction/console/overflow result>
- visual-system token integrity: <passed|partial|blocked with evidence ref>
- information architecture review: <passed|partial|blocked|not_applicable with evidence ref>
- semantic visual review: <passed|partial|blocked|not_applicable with evidence ref>
- workflow legibility: <passed|partial|blocked|not_applicable with evidence ref>
- control surface review: <passed|partial|blocked|not_applicable with evidence ref>
- interaction intuition review: <passed|partial|blocked|not_applicable with evidence ref>
- required interactions: <passed|partial|not_applicable with evidence ref>
- affordance behavior: <passed|partial|not_applicable with evidence ref>
- mobile interaction plan: <passed|partial|blocked|not_applicable with evidence ref>
- canvas stability: <passed|partial|not_applicable with evidence ref>
- motion-frame stability: <passed|partial|blocked|not_applicable with evidence ref>
- mobile touch/mode entry: <passed|partial|blocked|not_applicable with evidence ref>
- visual judge gate: <passed|needs_iteration|blocked|not_needed with evidence ref>
- MVP complexity gate: <passed|partial|blocked|not_applicable with evidence ref>
- visible bug scan: <result>
- full-page structural parity scan: <passed|partial|blocked with evidence ref>
- micro-parity scan: <passed|partial|blocked with evidence ref>
- material parity scan: <passed|partial|blocked|not_needed with evidence ref>
- asset pipeline integrity: <passed|partial|blocked|not_needed with role/crop/alpha/slice/responsive refs>
- frontend architecture review: <passed|partial|blocked|not_applicable with evidence ref>
- component source review: <passed|partial|blocked|not_applicable with evidence ref>
- code quality review: <ref>
- parity rating: <match|acceptable_delta|needs_iteration>
- side-by-side ledger: <ref>

## Trade-Offs

- <accepted visual delta and reason>

## Next

- <one concrete next action>
```
