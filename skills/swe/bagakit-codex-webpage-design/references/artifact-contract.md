# Artifact Contract

Use these names when a webpage design task needs durable local artifacts.

Recommended root:

- `.bagakit/codex-webpage-design/<task-slug>/`

Files:

- `design-brief.md`
  - goal, audience, content, brand/assets, visual direction, constraints
- `reference-intent.md`
  - strongest available reference context, intent class, why image2 is needed
    or why a provided reference is stronger
- `visual-decomposition.md`
  - reference image reading: page frame, region proportions, toolbar,
    navigation, focal object, typography, palette, materials, component shapes,
    spacing rhythm, and signature details
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
- `capability-route.md`
  - stack and library choices mapped to required effects such as graph,
    search, charting, rich text, animation, canvas, or 3D
- `affordance-inventory.md`
  - every visible interactive affordance classified as `working`, `disabled`,
    `hidden`, or `explicitly_out_of_scope`
- `reference-coverage-matrix.md`
  - every reference-visible control, state, and important detail mapped to
    implemented, disabled, hidden, merged, renamed, or explicitly out of scope
- `behavior-matrix.md`
  - expected action, expected result, keyboard expectation, and browser
    evidence for every `working` affordance
- `visual-bug-ledger.md`
  - overlap, clipping, malformed controls, accidental scrollbars, layout jumps,
    unreadable text, state inconsistencies, mobile first-viewport defects, and
    blocker status
- `canvas-stability-report.md`
  - graph, map, canvas, whiteboard, timeline, or spatial-surface state model,
    library settings, manipulation quality, drag/pan/zoom evidence, safe-zone
    placement, overlay behavior, mobile touch-control evidence, and
    before/mid/after drag frame evidence
- `visual-judge-scorecards.md`
  - independent quiet-room judge scorecards with 1-5 dimension scores,
    screenshot-region evidence, blocker findings, and rationale
- `judge-aggregation.md`
  - median/minimum scores, disagreement notes, blocker list, decision, and
    iteration actions from the visual gate protocol
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

`reference-intent.md`, `visual-decomposition.md`, and state coverage are
blocking artifacts for implementation. For high-craft work, `ambition-bar.md`
is also blocking before implementation. If no stronger reference exists,
`design-reference.md` must point to an image2-generated reference before
implementation can claim visual completion. If image generation is unavailable,
preserve `image-prompt.md` and hand off the blocker instead of coding directly
from text requirements.

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

If there is a strong original reference, state frames must preserve that
reference. Do not derive state boards from a failed or under-review
implementation screenshot. Such screenshots may be recorded as bug evidence,
not as design source, unless the user explicitly approves them as the new
baseline.

For complex product pages and non-static pages,
`information-architecture-map.md`, `workflow-model.md`,
`control-surface-map.md`, `interaction-model.md`, and the capability route are
also blocking artifacts. Do not implement a graph, editor, search experience,
workflow surface, chart, map, animation-heavy page, canvas, WebGL, or 3D
experience from a static reference alone.

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

For non-static pages, `affordance-inventory.md` and `behavior-matrix.md` are
blocking completion artifacts. Do not claim completion from a few sampled
interactions. Every visible live-looking control must be inventoried; every
`working` control must have browser behavior evidence; every non-working
control must be disabled, hidden, or explicitly out of scope with non-primary
treatment.

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

If a meaningful mobile state exists, `state-reference-set.md` must include a
mobile reference frame, a mobile-specific state rule, or an explicit blocking
gap. A desktop design squeezed into mobile is not enough for completion.

For visual parity completion, `visual-bug-ledger.md` must have zero blocker
items. Visible clipping, overlap, malformed controls, accidental scrollbars,
dead primary affordances, or unstable canvas manipulation cannot be accepted as
`acceptable_delta`.

Build, lint, console, overflow, and interaction checks are execution evidence,
not visual parity evidence. If screenshots still show visible blocker defects,
`visual-bug-ledger.md` remains open even when automation passes.

Artifact freshness is required for completion. When layout, interaction,
screenshots, or validation scripts change, refresh the affected ledgers before
judge review or final handoff.

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

## Handoff Shape

```markdown
## Result

- Page: <repo-relative route or file>
- Design reference: <repo-relative artifact ref>
- Reference intent: <exact|style_reference|asset|content_context|data_context>
- Visual decomposition: <ref>
- Ambition bar: <ref or not_needed_low_craft>
- MVP experiment plan: <ref or not_needed_not_skill_experiment>
- State reference set: <ref or not_needed_static_page>
- Information architecture map: <ref or not_needed_simple_page>
- Workflow model: <ref or not_needed_static_page>
- Control surface map: <ref or not_needed_static_page>
- Interaction model: <ref or not_needed_static_page>
- Capability route: <ref or not_needed_static_page>
- Affordance inventory: <ref or not_needed_static_page>
- Behavior matrix: <ref or not_needed_static_page>
- Visual bug ledger: <ref and blocker count>
- Canvas stability: <ref or not_needed_non_spatial_page>
- Canvas safe zones: <passed|partial|blocked|not_needed and ref>
- Visual judge scorecards: <ref or not_needed_low_risk>
- Judge aggregation: <pass|needs_iteration|blocked|not_needed_low_risk and ref>
- Image2 status: <generated|not_needed_stronger_reference|blocked_unavailable>
- Stack: <framework or static>

## Validation

- desktop screenshot: <ref>
- mobile screenshot: <ref>
- console/runtime: <result>
- interaction/state parity: <ref or not_needed_static_page>
- information architecture review: <passed|partial|blocked|not_applicable with evidence ref>
- workflow legibility: <passed|partial|blocked|not_applicable with evidence ref>
- control surface review: <passed|partial|blocked|not_applicable with evidence ref>
- required interactions: <passed|partial|not_applicable with evidence ref>
- affordance behavior: <passed|partial|not_applicable with evidence ref>
- canvas stability: <passed|partial|not_applicable with evidence ref>
- motion-frame stability: <passed|partial|blocked|not_applicable with evidence ref>
- mobile touch/mode entry: <passed|partial|blocked|not_applicable with evidence ref>
- visual judge gate: <passed|needs_iteration|blocked|not_needed with evidence ref>
- MVP complexity gate: <passed|partial|blocked|not_applicable with evidence ref>
- visible bug scan: <result>
- code quality review: <ref>
- parity rating: <match|acceptable_delta|needs_iteration>
- side-by-side ledger: <ref>

## Trade-Offs

- <accepted visual delta and reason>

## Next

- <one concrete next action>
```
