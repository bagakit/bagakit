# Page Manifest

## Owns

- The stable identity card for one generated HITL page.
- The route and data-contract refs used to keep rendering, state, and export
  aligned.

## Required Fields

- `page_id`
- `scene`
- `explanation_foundation`
- `template_id`
- `operator_mode`
- `required_interactions`
- `delivery_route`
- `primary_interaction_surface`
- `feedback_transport`
- `projection_contract_ref`
- `mechanisms`
- `style`
- `style_reason`
- `components`
- `artifacts`
- `data_contract_refs`
- `runtime_assumptions`
- `known_limitations`

## Lightweight Decision Fields

- `projection_version`
- `questions`: stable `question_id` plus the current display reference

The actual style may differ from the crosswalk default. Its reason explains
the audience or material fit; required interactions remain unchanged. A fixed
renderer's title, panel letter, or output path is not a stable question id.

## Judgment-Page Fields

- `review_mode`
- `reveal_policy`
- `evaluation_contract_id`
- `evaluation_contract_version`
- `history_retention_policy`

## Round-Trip Expectation

- Another Agent can inspect the manifest and understand the page route without
  reopening the full design discussion.
- The manifest scene, template id, and selected data contracts match the
  renderer and export route; its explanation foundation is compatible with
  the crosswalk route default or an explicitly justified override.
- A multi-turn page declares how Agent feedback returns to the primary surface
  and how projection versions reconcile with local state.

## Failure Signals

- The manifest omits selected mechanisms, components, or artifacts.
- The page cannot be re-entered or reviewed from the manifest alone.
- The manifest names a stale scene or template.
- The manifest silently requires or omits Explain contrary to the selected
  crosswalk route.
- The renderer or export references fields outside the selected data contract.
