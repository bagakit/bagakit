# Page Manifest

## Owns

- The stable identity card for one generated HITL page.
- The route and data-contract refs used to keep rendering, state, and export
  aligned.

## Required Fields

- `page_id`
- `scene`
- `template_id`
- `operator_mode`
- `primary_interaction_surface`
- `feedback_transport`
- `projection_contract_ref`
- `mechanisms`
- `style`
- `components`
- `artifacts`
- `data_contract_refs`
- `runtime_assumptions`
- `known_limitations`

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
  renderer and export route.
- A multi-turn page declares how Agent feedback returns to the primary surface
  and how projection versions reconcile with local state.

## Failure Signals

- The manifest omits selected mechanisms, components, or artifacts.
- The page cannot be re-entered or reviewed from the manifest alone.
- The manifest names a stale scene or template.
- The renderer or export references fields outside the selected data contract.
