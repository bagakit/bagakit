# Copy Result Control

Component id: `copy-result-control`

## Use When

Use this component whenever a HITL page lets the human copy, download, or hand
back a structured result to an agent.

This component is generic. It applies to manual QA reports, understanding
packets, review findings, comparison notes, and other interaction results.

## Owns

- The visible copy or download action.
- Success, failure, disabled, and copied states.
- Clear action labels such as copy report, copy result, download JSON, or copy
  reproduction.
- A fallback route when clipboard access is unavailable.
- A stable binding between one action and one generated payload.

## Does Not Own

- The meaning of the interaction result.
- The Markdown, JSON, or packet schema.
- The scene-specific report grouping.
- The visual density of the surrounding toolbar or panel.

## Required Inputs

- `payload_builder`
  - function or data contract that produces the current payload
- `format`
  - markdown, json, text, or another explicit export format
- `label`
  - human-readable action label
- `success_feedback`
  - visible copy/export confirmation
- `disabled_reason`
  - why the result cannot be copied yet, when applicable

## Design Checks

- The human can copy the result without editing generated text.
- The control says what will be copied or downloaded.
- The copied payload includes enough metadata for agent reentry.
- Copy success or failure is visible without relying on browser chrome.
- Export actions share the same payload semantics as copy actions.

## Failure Signals

- Each page reimplements copy/export behavior with different semantics.
- The button only says copy, but the user cannot tell what payload it emits.
- Clipboard failure silently loses the result.
- Markdown and JSON actions export different conclusions for the same state.
- The page can show results but cannot hand them back as a packet.
