# Frontend Architecture Reference

Use this reference when a webpage-design task needs an implementation plan
before code. It turns the visual and product model artifacts into a maintainable
frontend shape without replacing the design-spec, asset, or component-sourcing
ledgers.

## When To Use

Write `frontend-architecture-plan.md` before implementation when any of these
are true:

- the page has repeated sections, cards, rows, controls, or stateful views
- the task uses an existing host application, router, design system, or asset
  pipeline
- the implementation needs React, Vite, a dev server, or another component
  runtime
- the page has search, filters, forms, tabs, drawers, modals, graph/canvas,
  media, workflow states, or non-happy paths
- visual parity will likely require later cleanup of repeated markup, shared
  tokens, or state ownership

The plan belongs after `design-spec-ledger.md`, `visual-decomposition.md`, and
the required product-model artifacts for product-like or interactive work. It
belongs before creating or reorganizing frontend files. For product-like pages,
architecture is the bridge from product design to code: components should own
product objects, states, and workflow steps, not just visual boxes.

## When Not Needed

Use `not_needed_simple_static_page` only when all of these are true:

- one static page or section can be implemented with ordinary HTML/CSS and
  minimal script
- repeated elements are few enough that duplication will not hide behavior,
  state, or token drift
- there is no host component sourcing decision beyond using the existing page
  shell or static file pattern
- there are no meaningful branch states beyond responsive layout, hover, focus,
  and disabled treatment already covered by the design spec

Even then, record the route before coding. Create a short
`frontend-architecture-plan.md` with `Status: not_needed_simple_static_page`,
and mirror that value in the task's `capability-route.md` and final handoff.

Do not use this escape hatch for a page that merely looks simple after the
workflow, data model, or responsive states have been under-modeled.

## Artifact Schema

Recommended location:

- `.bagakit/codex-webpage-design/<task-slug>/frontend-architecture-plan.md`

Minimum schema:

```markdown
# Frontend Architecture Plan

- Status: planned | not_needed_simple_static_page | blocked
- Route: host_stack | static_html | react_vite | other
- Route reason: <why this route is the smallest adequate route>
- Host inspection: <existing stack, router, components, style system, assets>
- Source artifacts:
  - product model: <information-architecture/workflow/design-core ref or not_needed>
  - design spec: <ref>
  - component sourcing ledger: <ref or not_needed>
  - token source: <design-spec-ledger ref>
  - asset ledger: <ref or not_needed>

## Component Tree

- <PageOrRoute>
  - <Region owner, product job, and semantic visual role>
    - <Component: owned object, data source, states, controls>

## Product Model Mapping

| Product object or workflow step | UI owner | State changes | Feedback/recovery | Completion proof |
| --- | --- | --- | --- | --- |
| <object/step> | <component/route> | <state> | <feedback> | <browser proof> |

## Repeated Data Structures

| Structure | Source | Key field | Renders | Empty state |
| --- | --- | --- | --- | --- |
| <name> | <const/json/api/host> | <id> | <components> | <state> |

## State Ownership

| State | Owner | Consumers | Initial value | Browser proof |
| --- | --- | --- | --- | --- |
| <state> | <component/store/url/host> | <components> | <value> | <planned evidence> |

## File And Style Organization

- Files to create or edit: <repo-relative paths or logical host slots>
- Style owner: <host tokens/theme/css module/global sheet/component styles>
- Asset owner: <asset-generation-ledger refs or host assets>
- Integration notes: <routing/build/dev-server notes>

## Design Standards

| Standard | Source in design-spec ledger | Implementation owner |
| --- | --- | --- |
| Type scale and line height | <ref> | <theme/css variable/component prop> |
| Color roles and contrast | <ref> | <theme/css variable/component prop> |
| Hierarchy and density | <ref> | <layout/component rule> |
| Spacing and gutters | <ref> | <spacing tokens/component props> |
| Border, radius, elevation | <ref> | <surface/control tokens> |
| Motion and state treatment | <ref> | <component/state styles> |
| Brand tone and imagery | <ref> | <assets/components/copy rules> |
| Product density and affordance vocabulary | <ref> | <component/layout rule> |

## Accessibility Hooks

- Landmarks/headings:
- Control names:
- Keyboard path:
- Focus and disabled states:
- Motion/reduced-motion:

## Post-Parity Refactor Targets

- <target, trigger, and expected cleanup after visual parity>
```

If the route is `not_needed_simple_static_page`, the artifact may stop after
status, route reason, source artifacts, and the static file/style owner.

## Route Rules

Prefer routes in this order.

1. `host_stack`
   - Use the existing app framework, router, component system, icon library,
     build command, style conventions, and asset locations.
   - Record which host surfaces will be reused and which local components are
     justified.
   - Do not add React/Vite, Tailwind, CSS-in-JS, a component kit, or a parallel
     theme layer when the host already has an adequate path.

2. `static_html`
   - Use for a standalone static page, a design proof, or a page with only
     small local interactions.
   - Keep the file structure boring: one HTML entry, one style file when useful,
     one script file only when behavior is real.
   - Still use CSS variables or constants derived from the design spec when
     repeated visual values appear.

3. `react_vite`
   - Use when no host stack exists and the page needs component boundaries,
     state, reusable data structures, browser iteration, or package-based
     capabilities.
   - Keep the app shape small: route shell, data module, components, styles,
     assets, and browser evidence.
   - Add libraries only for central behavior such as graph, map, chart, editor,
     animation, canvas, or 3D work recorded in `capability-route.md`.

4. `other`
   - Use only when the host or required capability makes another mainstream
     route clearly smaller. Record the reason and the integration boundary.

## Component Tree

The component tree must mirror ownership, not decoration. Start from the
page shell, then list regions from `visual-decomposition.md`,
`information-architecture-map.md`, and `control-surface-map.md`.

For each component, record:

- job: what product object, action, workflow step, or state it owns
- data: the structure it renders and the key field for repeated instances
- controls: live, disabled, hidden, or out-of-scope affordances it contains
- variants: default, selected, hover/focus, empty, loading, error, modal,
  responsive, or other state-reference variants
- source: host component, sourced component, custom local component, or
  asset-backed component from the relevant ledger

Repeated UI should come from arrays, maps, fixtures, or host data. Do not paste
parallel card, row, tab, badge, or control markup unless the repetition is too
small to hide drift.

If a component only exists because a visual region looked balanced, revisit the
product model. Either assign it a user question, object, state, action, or risk
from the semantic map, or remove/demote it before implementation hardens it.

## State And Data Model

Name the primary objects before naming UI state. The state model should explain
which data changes during the workflow and which state only changes the view.

Record:

- primary object types and stable ids
- seed data, host data, generated fixtures, or API-shaped mocks
- selected object, active mode, filter/search query, drawer/modal state,
  loading/error/empty state, and blocked-action state when present
- which component, store, URL state, or host owner controls each state
- derived data and memoization needs for heavy charts, graph nodes, canvas
  objects, media timelines, or large lists
- browser evidence planned for each visible working state

State should not be split across mirrored controls unless the control-surface
map classifies one as a mirrored shortcut and the plan names the shared owner.

## File And Style Organization

Follow the host's file layout first. If the host has no pattern, keep a small
route-oriented layout:

- entry or route file for page composition
- data file for repeated content and typed constants
- component files only where repetition, state, or readability justifies them
- style file or module aligned with the host style convention
- asset imports mapped from `asset-generation-ledger.md` when assets are used

The plan should list repo-relative files or logical host slots, not absolute
paths. Keep generated artifacts, screenshots, and ledgers out of runtime skill
payloads unless the owning reference says they are runtime assets.

Design standards belong in the plan before code when repeated UI exists. The
standard is not a second design spec; it maps `design-spec-ledger.md` values
into the concrete implementation owner: host theme, CSS variables, component
props, data constants, or an asset-backed renderer.

## CSS And Token Integration

This reference does not define the token system. It connects architecture to
the token source.

- Treat `design-spec-ledger.md` as the minimum visual token source.
- Do not create a parallel token ledger for webpage-design; map the
  `design-spec-ledger.md` decisions into the host theme, CSS variables,
  constants, or component props.
- If a component sourcing ledger exists, cite it and record whether each major
  control comes from the host, a library, a custom local component, or an
  asset-backed renderer.
- Define shared CSS variables, theme constants, or component props before
  styling repeated UI.
- When visual review changes spacing, typography, color, material, control
  geometry, or state treatment, update the token source first and then the
  implementation.

Do not let one-off CSS fixes become a hidden second design spec.

## Accessibility Hooks

The architecture plan should reserve the hooks needed to prove real browser
behavior later:

- landmarks and heading order for the page frame
- accessible names for icon buttons, tabs, menu triggers, form controls, and
  primary actions
- keyboard path for live controls, including tab order and activation keys
- focus, selected, disabled, invalid, loading, and busy states that match the
  state reference set
- ARIA only where semantic HTML or host components do not already express the
  state
- touch target and responsive control placement for mobile
- reduced-motion or no-motion fallback when motion is not essential

If exact visual parity conflicts with readability, focus visibility, keyboard
access, or touch usability, record the accepted delta in the parity artifacts
instead of hiding the accessibility trade-off.

## Post-Visual-Parity Refactor Review

Do not start broad refactors while visual parity is still unstable. After the
latest desktop and mobile screenshots pass the visual gates, review the code
and update `code-quality-review.md`.

Check:

- component boundaries match the planned tree or deviations are justified
- repeated UI is data-driven and keyed by stable ids
- state has one owner per mode, selected object, filter, modal, or workflow
  branch
- host components and sourced components were used where the sourcing ledger
  required them
- CSS values still come from the design spec ledger
- asset-backed components still use the asset ledger's role, selector, fallback,
  and responsive rules
- accessibility hooks exist in code and browser evidence
- dead prototype controls, stale fixture data, unused styles, and temporary
  parity hacks are removed or explicitly tracked

The review may accept small duplication when extraction would obscure a
one-off signature detail. It should not accept broad pasted markup, scattered
state, or token drift.

## Failure Modes

Treat these as blockers or explicit risks:

- implementation starts without either a full plan or
  `not_needed_simple_static_page`
- the plan chooses React/Vite while an adequate host route exists
- a static route is used for meaningful state, repeated data, or sourced
  components
- component hierarchy follows visual boxes instead of object, workflow, and
  control ownership
- repeated cards, rows, tabs, badges, or controls are pasted instead of
  generated from data
- selected mode, filter, drawer, modal, or object state is owned in multiple
  places
- design-spec and component-source ledgers are cited but not mapped into files,
  props, CSS variables, or host components
- visual parity fixes create scattered one-off CSS that contradicts the design
  spec
- accessibility hooks are added after the visual pass and force avoidable
  layout churn
- `code-quality-review.md` claims the structure is clean while screenshots,
  browser evidence, or source still show fake controls, stale states, or
  brittle duplication
