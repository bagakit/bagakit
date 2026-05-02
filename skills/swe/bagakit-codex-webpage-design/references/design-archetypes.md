# Design Archetypes

Use this reference when `reference-survey-ledger.md` or
`comparative-design-review.md` needs sharper comparison targets.

An archetype is a decision aid. It helps decide which references matter, which
layout and interaction norms apply, and what the final page must beat. It must
not override a user-provided exact reference, approved brand system, provided
mockup, or real product constraint. If an exact reference exists, route the
task as `reference_locked` and use archetype notes only to explain risk,
review coverage, or accepted deviation.

## Router Artifact Section

Add this section near the top of `reference-survey-ledger.md` when reference
comparison is required. It may also be copied into `comparative-design-review.md`
with final verdicts filled in.

```markdown
## Archetype Router

- exact_reference_override:
  <none | reference_locked and the artifact name>
- primary_archetype:
  <Bagakit archetype name>
- secondary_archetype:
  <none | Bagakit archetype name and limited reason>
- fit_signal:
  <why this page belongs here>
- non_fit_signal:
  <what this route must not become>
- primary_object:
  <the object the user scans, changes, buys, reads, or commands>
- layout_grammar:
  <page regions, navigation shape, surface rhythm, and hierarchy rule>
- interaction_norms:
  <expected controls, state feedback, and workflow behavior>
- density_target:
  <sparse | balanced | dense | compressed, plus reason>
- reference_targets:
  <same-job references first; trait references only when scoped>
- failure_modes_to_check:
  <archetype-specific risks>
- what_to_beat:
  <comparison qualities the final design must match or improve>
```

Router rules:

- Prefer the archetype with the same page job and primary object over one with
  a similar color, mood, or component shape.
- If a page blends two archetypes, name one primary route and one scoped
  secondary route. Do not average their norms.
- Use cross-archetype references only for a named trait, such as command bar
  economy, dense table scanning, spatial browsing, or long-form reading.
- A style reference cannot lower the task below the selected archetype's
  minimum workflow, density, state, and navigation expectations.
- If the final output is weaker than the selected `what_to_beat` list, mark
  `comparative-design-review.md` as `needs_iteration`.

## Archetype Fields

Use these fields for every routed archetype:

- `fit`: page jobs, user goals, and content patterns that belong here.
- `non_fit`: nearby shapes that should be routed elsewhere.
- `primary_object`: the object the page makes legible and actionable.
- `layout_grammar`: region model, navigation rhythm, hierarchy, and surface
  composition.
- `interaction_norms`: controls, states, keyboard or pointer expectations, and
  feedback loops the user will expect.
- `density`: expected information pressure and spacing discipline.
- `reference_targets`: what kind of references should be inspected first.
- `failure_modes`: common ways this route produces generic or misleading work.
- `what_to_beat`: concrete qualities the final page must match or improve
  against the survey.

## Bagakit Archetypes

### Story Field

For editorial, magazine-like, narrative, portfolio, launch story, or immersive
content pages.

- `fit`: the page must guide attention through a sequence of ideas, visuals,
  scenes, profiles, or arguments.
- `non_fit`: pages whose main job is repeated operation, dense monitoring,
  comparison shopping, or document study.
- `primary_object`: story unit, article, feature, profile, case, project, or
  visual sequence.
- `layout_grammar`: strong opening signal, paced section rhythm, meaningful
  image placement, pull details, and scroll tempo that changes by section job.
- `interaction_norms`: reading progress, media reveal, anchors, light filters,
  share/save, and motion that supports pacing instead of becoming decoration.
- `density`: balanced to sparse in hero and narrative beats; denser only for
  indexes, credits, timelines, specs, or evidence blocks.
- `reference_targets`: publication features, high-craft portfolios, launch
  stories, and long-form visual essays with similar subject pressure.
- `failure_modes`: empty hero theatrics, repeated split sections, decorative
  imagery with weak content, oversized type inside small panels, and card
  stacks that break narrative tempo.
- `what_to_beat`: first-viewport subject clarity, section rhythm, image/text
  relationship, typographic confidence, and memorable signature detail.

### Tool Bench

For builder workspaces, code-like environments, technical consoles, project
organizers, and multi-pane task surfaces.

- `fit`: the user edits, inspects, runs, reviews, compares, or coordinates
  work objects over repeated sessions.
- `non_fit`: passive reading, marketing narrative, pure KPI monitoring, or
  one-shot checkout flows.
- `primary_object`: file, run, task, issue, workspace, artifact, environment,
  or object under construction.
- `layout_grammar`: stable shell, left navigation or tree, central work area,
  right inspector when needed, bottom/status rail when process feedback matters.
- `interaction_norms`: command search, tabs, selection state, undoable actions,
  keyboard-friendly controls, logs, diffs, previews, and explicit disabled or
  stale states.
- `density`: dense, with compact rows, tight controls, and clear grouping;
  whitespace must preserve scan lanes rather than feel decorative.
- `reference_targets`: professional workspaces with comparable object editing,
  artifact inspection, run feedback, and mode switching.
- `failure_modes`: fake controls, duplicated mode switches, toy sample data,
  low-density marketing cards, unclear active object, and panels without state
  ownership.
- `what_to_beat`: object-state-action legibility, control economy, pane
  hierarchy, error/status feedback, and repeated-use efficiency.

### Signal Deck

For dashboards, cockpits, operations boards, metric rooms, and health monitors.

- `fit`: the page explains status, change, risk, drivers, and where attention
  should go next.
- `non_fit`: open-ended editing, content storytelling, spatial exploration, or
  product browsing where comparison leads to purchase.
- `primary_object`: metric, system, segment, queue, account, service, market,
  or operational state.
- `layout_grammar`: summary band, driver regions, time and segment controls,
  alert or exception lane, and drill paths that preserve context.
- `interaction_norms`: filters, date ranges, compare modes, hover details,
  selection-linked panels, thresholds, drilldown, refresh or recency cues, and
  empty/error states for missing data.
- `density`: dense to compressed; hierarchy comes from grouping, scale, and
  salience, not from making every card large.
- `reference_targets`: analytical products with similar metric complexity,
  time pressure, exception handling, and decision cadence.
- `failure_modes`: vanity numbers with no decision path, chart clutter, weak
  denominators, equal-weight cards, hidden filters, and first viewport wasted
  on generic greetings.
- `what_to_beat`: scan speed, metric trust, exception visibility, drill clarity,
  responsive chart survival, and actionability of the next step.

### Creation Studio

For visual editors, media tools, capture tools, writing environments, design
surfaces, and authoring flows.

- `fit`: the user creates or transforms a visible artifact and needs direct
  feedback from tools, canvas, timeline, preview, or inspector state.
- `non_fit`: read-only galleries, static product pages, dashboards with no
  editable artifact, or command boards where the main job is routing action.
- `primary_object`: canvas, scene, document, clip, frame, layer, prompt, asset,
  timeline, or generated variant.
- `layout_grammar`: dominant work surface, tool rail, contextual inspector,
  asset or layer browser, timeline or history when sequence matters, and
  preview/export affordance.
- `interaction_norms`: selection handles, drag/drop, keyboard shortcuts,
  brush/tool modes, generation states, undo/redo, zoom, history, and clear
  working versus disabled controls.
- `density`: dense around tools and inspectors, balanced around the canvas so
  the artifact remains the focus.
- `reference_targets`: authoring tools with comparable artifact type, tool
  count, preview fidelity, and state complexity.
- `failure_modes`: decorative canvas in a card, non-working toolbars, unclear
  selected object, inspector mismatch, modal-heavy editing, and controls that
  resize the work surface unpredictably.
- `what_to_beat`: artifact prominence, tool discoverability, selection feedback,
  inspector relevance, latency/state treatment, and export confidence.

### Place Atlas

For maps, geospatial browsing, route planning, venue guides, network topology,
and location-heavy exploration.

- `fit`: location, distance, route, territory, density, or spatial relation is
  the primary way users understand the content.
- `non_fit`: ordinary lists with address metadata, chart dashboards, or catalogs
  where geography is only a filter.
- `primary_object`: place, route, region, layer, stop, node, zone, or spatial
  cluster.
- `layout_grammar`: large spatial field, layer controls, search, result list or
  detail drawer, legend, scale/context cues, and safe zones for overlays.
- `interaction_norms`: pan, zoom, search, select, hover/tap details, layer
  toggles, route or cluster behavior, recentering, and mobile touch controls.
- `density`: balanced over the map; dense in drawers and legends only when
  visual encoding stays readable.
- `reference_targets`: spatial products with similar layer count, browse depth,
  route complexity, and mobile needs.
- `failure_modes`: static map wallpaper, floating UI covering important places,
  unreadable labels, missing legend, fake layer controls, and detail panels that
  break spatial context.
- `what_to_beat`: spatial legibility, overlay placement, layer clarity, result
  selection, mobile gesture safety, and continuity between map and details.

### Choice Shelf

For catalog, marketplace, commerce, booking, pricing, and comparison surfaces.

- `fit`: users compare options, evaluate trust, narrow a set, and commit to a
  purchase, booking, subscription, or shortlist.
- `non_fit`: pure brand storytelling, internal workspaces, document reading, or
  dashboards where metrics are the object.
- `primary_object`: product, plan, listing, package, offer, booking slot,
  vendor, or bundle.
- `layout_grammar`: browsable grid/list, filters and sort, comparison signals,
  item detail, trust proof, price or availability, and checkout or lead action.
- `interaction_norms`: filter chips, sort, search, variants, saved items,
  compare, cart/quote/booking state, inventory or eligibility feedback, and
  clear unavailable treatment.
- `density`: balanced to dense; tiles must carry enough decision data without
  burying the action or trust signal.
- `reference_targets`: catalogs with similar option count, risk level, price
  complexity, visual dependence, and conversion path.
- `failure_modes`: pretty tiles with no decision data, hidden filters, weak
  trust cues, inconsistent item imagery, vague primary action, and checkout
  controls that feel disconnected from selection.
- `what_to_beat`: scan-and-compare speed, filter usefulness, offer clarity,
  trust density, responsive item cards, and conversion confidence.

### Reading Room

For documents, reports, knowledge bases, legal or policy text, research notes,
and focused reading products.

- `fit`: the user studies, searches, annotates, cites, audits, or navigates
  structured text.
- `non_fit`: narrative marketing pages, artifact creation studios, catalog
  browsing, or dashboards where charts are the primary object.
- `primary_object`: document, section, clause, paragraph, citation, note,
  comment, version, or evidence span.
- `layout_grammar`: readable central column or document pane, outline or table
  of contents, search and find, annotation/comment rail, metadata, and version
  or source context when needed.
- `interaction_norms`: search, anchors, highlights, comments, citations,
  compare versions, copy/share, collapsible outline, keyboard navigation, and
  stable scroll position.
- `density`: balanced in the reading pane; dense in outlines, search results,
  and annotation rails.
- `reference_targets`: serious reading and review products with similar text
  length, citation needs, collaboration model, and search pressure.
- `failure_modes`: landing-page typography in a work reader, weak line length,
  noisy sidebars, no location memory, annotations that obscure text, and
  decorative cards around paragraphs.
- `what_to_beat`: reading comfort, orientation, search precision, annotation
  usefulness, citation trust, and long-document navigation.

### Action Bridge

For command centers, incident rooms, triage queues, support operations, launch
rooms, and coordination surfaces where action must be taken quickly.

- `fit`: the user must detect priority, assign or trigger action, track state,
  and coordinate across people, queues, systems, or incidents.
- `non_fit`: passive dashboards with no action loop, authoring tools, catalogs,
  or narrative pages.
- `primary_object`: incident, ticket, alert, queue item, task, request, actor,
  runbook step, escalation, or decision.
- `layout_grammar`: priority lane, queue or board, detail/decision pane,
  action bar, ownership/status surface, activity stream, and runbook or
  dependency context.
- `interaction_norms`: assign, acknowledge, escalate, resolve, comment, bulk
  action, status transition, keyboard triage, audit trail, and guarded
  destructive action.
- `density`: dense to compressed; every region should help decide, act, or
  confirm state.
- `reference_targets`: operational products with comparable urgency, ownership,
  queue depth, audit needs, and state transitions.
- `failure_modes`: dashboard without action ownership, vague priority, hidden
  assignee/status, overdecorated alerts, fake bulk controls, and no audit or
  confirmation model.
- `what_to_beat`: priority recognition, action speed, ownership clarity,
  transition feedback, audit confidence, and reduced coordination load.

## Ledger Integration

### `reference-survey-ledger.md`

Use the router before choosing references:

- Record the `Archetype Router` section before the reference table.
- Pick same-archetype references first. They are the default comparison tier.
- Add cross-archetype references only with a scoped `trait_target`, such as
  "dense triage queue", "map overlay safety", or "reader annotation rail".
- For each surveyed reference, record:
  - `archetype_fit`
  - `comparison_role`
  - `primary_object_match`
  - `density_match`
  - `interaction_norms_observed`
  - `cannot_lose`
- Convert the strongest `cannot_lose` observations into the router's
  `what_to_beat` list.

### `comparative-design-review.md`

Use the same router at completion:

- Restate `primary_archetype`, any scoped `secondary_archetype`, and whether an
  exact reference locked the route.
- Compare the final screenshots against the `what_to_beat` list, not against a
  generic sense of polish.
- Check the archetype fields that matter most: primary object, layout grammar,
  interaction norms, density, reference targets, and failure modes.
- Mark each field `beats`, `matches`, `acceptable_delta`, or
  `needs_iteration`.
- If a cross-archetype trait was used, review only that trait. Do not import
  unrelated norms from the secondary route.
- If the final page is more generic, less dense, less actionable, or less
  legible than the surveyed references, record the blocker or accepted delta
  explicitly. Do not hide it under visual preference.

## Review Shortcut

When time is tight, ask these five questions:

1. What is the primary object?
2. What page job does the user expect from that object?
3. Which archetype has the same job and object pressure?
4. Which references prove the expected density, navigation, controls, and
   interaction states?
5. What exactly must the final page beat, and did the screenshots prove it?
