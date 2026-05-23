# Adaptive Feedback Panel

Component id: `adaptive-feedback-panel`

## Use When

Use this component when an Agent evaluates a page submission and the human must
continue with feedback, a repaired task, or a new task in the same HITL page.

## Owns

- Current feedback, active task, next action, and sync-state presentation.
- Submit, waiting, import/apply, stale, conflict, retry, and offline-fallback
  controls for the selected continuity route.
- Stable binding between one feedback projection and the attempt and learner
  events it addresses.

## Required Inputs

- `page_id`
- `page_manifest_ref`
- `projection_target_ref`
- `primary_interaction_surface`
- `feedback_transport`
- `projection_version`
- `last_applied_event_ref`
- `sync_state`
- `active_task_ref`
- `feedback_ref`
- `attempt_refs`
- `next_action`

## Design Checks

- Feedback says which attempt it addresses and does not overwrite the attempt.
- The active task and evidence state come from upstream semantics.
- Waiting and stale states explain exactly what can happen next.
- Manual fallback uses the same canonical payload as normal submission.
- Applying a projection preserves local drafts and contextual questions.
- Internal endpoint names, skill ids, file paths, and storage APIs stay hidden.

## Does Not Own

- The feedback content, rubric, learner support level, or mastery consequence.
- The packet schema, persistence backend, or transport implementation.

## Failure Signals

- Feedback appears only in chat while the page still presents an older task.
- The panel says complete or passed when upstream evidence is unresolved.
- A new projection silently discards local learner state.
- Import and normal submission produce different course meanings.
