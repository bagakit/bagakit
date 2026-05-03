# Page Manifest

## Owns

- The stable identity card for one generated HITL page.

## Required Fields

- `page_id`
- `scene`
- `operator_mode`
- `mechanisms`
- `style`
- `artifacts`
- `runtime_assumptions`
- `known_limitations`

## Round-Trip Expectation

- Another agent can inspect the manifest and understand the page route without
  reopening the full design discussion.

## Failure Signals

- The manifest omits selected mechanisms or artifacts.
- The page cannot be re-entered or reviewed from the manifest alone.
