# Agent Handoff Packet

## Owns

- The durable packet the human returns to the Agent after using the page.

## Required Fields

- `scene`
- `summary`
- `status`
- `observations`
- `blockers`
- `evidence_refs`
- `next_action`

## Adaptive Continuity Fields

Include for a multi-turn page:

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

## Judgment-Page Fields

- `case_id`
- `case_run_id`
- `review_mode`
- `evidence_sufficiency`
- `provisional_human_judgment`
- `agent_position` when revealed
- `disagreement`
- `final_human_judgment`
- `prior_run_refs`

## Learning-Page Fields

Include when supplied by the course contract:

- `course_id`
- `mastery_packet_ref`
- `objective_id`
- `learner_event_refs`
- `evidence_record_refs`
- `attempt_refs`
- `question_events`
- `evidence_status`
- `support_level`
- `transfer_distance`
- `retention_interval`
- `provenance`

These fields report course evidence. The page must not derive mastery from
progress, interaction count, or confidence alone.

The page appends events and projects upstream evidence; it does not rewrite
attempt history or map generic page `passed` / `failed` state to mastery. Copy
and download preserve the same stable learner-event and evidence-record refs.

When Agent evaluation happens outside the browser, the returned projection
uses the continuity fields to bind feedback and the next task to the preserved
attempt and to the original page. A stale or conflicting projection remains
visible rather than silently replacing local state.

## Round-Trip Expectation

- The Agent can continue work without asking the human to restate the same
  context.
- The packet preserves which conclusions were human-entered, Agent-generated,
  or inferred.

## Failure Signals

- The packet mixes summary and raw evidence with no structure.
- The Agent still has to ask basic recovery questions the page should answer.
- The final judgment cannot be distinguished from the Agent position.
