# Implementation Loop

Use this when converting a design reference into a running webpage.

Do not enter this loop until `reference-intent.md` exists and either a stronger
provided reference is recorded or image2 has produced a design reference. A
preserved image prompt alone is only enough for handoff when image generation is
unavailable; it is not enough to claim visual implementation completion.

Do not enter this loop until `visual-decomposition.md` exists. The
decomposition must translate the reference image into concrete targets for
layout proportions, toolbar/nav structure, focal composition, typography,
palette, materials, component shapes, spacing, and signature details.

Do not implement meaningful branch states until `state-reference-set.md` exists
or an equivalent state map is recorded. A single happy-path image is not enough
for a stateful interface. Each important state should be covered by a reference
frame, a reusable component/state rule extracted from the reference, or an
explicit gap. Do not DIY selected, hover, empty, loading, modal, error,
filtered, or responsive state visuals when they materially define the product
feel.

For high-craft work, do not implement until `ambition-bar.md` exists. It must
name the reference tier, product-specific delight moment, signature detail, and
anti-generic risks. "Clean and usable" is a baseline, not the ambition target.

If there is a strong original reference, generated state frames must be derived
from that reference, not from the current implementation. Reject a state board
that makes current implementation drift look intentional.

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

For every `working` item, the behavior matrix must name:

- visible label or accessible name
- expected user action
- expected state change or result
- keyboard expectation where applicable
- browser evidence path or test assertion

Do not leave first-viewport, primary-flow, or repeatedly emphasized controls as
fake prototype controls. If a control is not implemented, remove it, make it
semantically disabled, or restyle it as non-primary static information.

Do not let implementation scope silently shrink the design reference. If the
reference shows search clear, filter chips, empty results, evidence cards,
question rows, next actions, review queue, inspector pin/star/close controls,
table/timeline/map modes, mobile command controls, or composer attachments,
the matrix must account for each one.

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

1. Establish page shell, dimensions, typography scale, and color tokens.
2. Establish the ambition-bar signature detail for high-craft work.
3. Establish the information architecture map for complex product surfaces.
4. Match the decomposed page regions and focal composition.
5. Implement the workflow model, control surface map, interaction model, and
   capability route.
6. Place primary layout blocks and real content.
7. Implement repeated UI through components, data arrays, and shared tokens.
8. Add media, icons, and signature visual details.
9. Add responsive behavior.
10. Add interactions and states from the state reference set.
11. Complete the reference coverage matrix, affordance inventory, and behavior
    matrix.
12. Run browser screenshot and interaction checks.
13. Run a pre-judge information-architecture sanity check: what objects exist,
    how navigation is organized, which region owns each object/action, and
    whether the user can infer the product model without explanation.
14. Run a pre-judge interaction-logic sanity check: what does the user do
    first, what changes next, which control owns each mode, and whether any
    duplicate control is redundant or conflicting.
15. Run a pre-judge screenshot sanity check. If screenshots visibly contain
    blocker defects, update the ledgers and keep iterating before using judge
    passes.
16. Iterate on visible mismatches, blocker bugs, fake controls, unclear
    information architecture, unclear workflow, duplicate controls, and
    insufficient ambition.
17. Refactor after visual parity so the implementation is maintainable rather
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
- affordance inventory actionability and state-change checks
- required behavior interactions: click selection, search/filter, reset/clear,
  capture editing, keyboard activation, and drag/pan/zoom when the interface
  presents the graph or canvas as interactive
- graph/canvas stability checks for smooth manipulation, no flicker, no object
  reset, no layout jump, and no pan/drag conflict when spatial manipulation is
  present
- motion-frame checks for drag/pan: before, mid-drag, and after-drag evidence
  or recording-derived frame samples
- graph/canvas safety checks that minimaps, zoom controls, legends, status UI,
  and third-party handles do not obscure important content
- mobile touch checks for canvas controls, mode switches, and primary capture
  controls
- ambition-bar checks for a useful product-specific surprise, signature craft
  detail, and non-generic result when the task asks for high-craft work
- screenshots or DOM checks for branch states in the state reference set
- obvious visual bugs: overlap, malformed icons, broken assets, inconsistent
  spacing, unreadable text, accidental scrollbars, and layout jumps
- component/code structure after iteration: duplication, repeated markup,
  shared tokens, component boundaries, and data-driven repeated UI

## Visual Difference Triage

Fix in this order:

1. page structure and focal hierarchy
2. region proportions and center composition
3. toolbar, navigation, and inspector structure
4. typography scale and weight
5. color, material, background, and contrast
6. component shape, line treatment, and asset treatment
7. micro-details, shadows, borders, and motion
8. ambition and delight: signature detail, product-specific surprise, and
   whether the page feels memorable rather than merely competent

Do not chase decorative pixels before the layout and hierarchy match.

Do not use `acceptable_delta` for a page that has a different overall
composition from the design reference.

Do not use `acceptable_delta` for visible bugs or unreferenced state styling.
If the only reason for mismatch is dynamic data, real content substitution,
responsive constraints, browser/font rendering, accessibility, or documented
web feasibility, record it as an accepted delta. Otherwise keep iterating.

Do not use `acceptable_delta` while blocker items remain in
`visual-bug-ledger.md`, while primary visible controls are fake, or while
graph/canvas manipulation visibly flickers.

Do not use `acceptable_delta` for high-craft work when the result is merely
competent, generic, or unsurprising. Raise the ambition bar or record that the
user explicitly lowered the target.

Do not treat automated validation as a substitute for visual review. Build,
lint, Playwright actions, overflow checks, and console checks can pass while the
screen is still visually blocked by overlap, clipping, undersized controls,
library artifacts, or a responsive state that was never actually designed.

Refresh artifacts after each iteration that changes layout, behavior,
screenshots, or validation scripts. Stale `visual-bug-ledger.md`,
`behavior-matrix.md`, `interaction-parity-ledger.md`,
`canvas-stability-report.md`, `visual-parity-ledger.md`, or
`code-quality-review.md` block final handoff because the result is no longer
auditable.

## Trade-Off Rule

If exact visual parity would hurt accessibility, responsive behavior, or real
content integrity, keep the better web behavior and record the difference in
the parity ledger.
