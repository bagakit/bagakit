# HITL Course Handoff

Use this artifact whenever delivery mode is `built_page`. Interactive-course,
learning-interface, and learning-workbench intent selects this mode by default.

## Delivery Policy

- default chain:
  - `bagakit-mastery-learning`
  - `bagakit-writing-core` with its `bagakit-writing-de-ai-tone` review route
  - `bagakit-hitl-webutil-design`
  - `bagakit-codex-webpage-design`
- do not stop at this handoff or at a page brief
- complete only after frontend implementation and desktop plus mobile browser
  evidence
- downgrade only for explicit `dialogue_only`, `design_only`, or
  `no_file_mutation`, or when a required peer is unavailable

## Required Fields

- `course_id`
- `learning_goal`
- `learner_mode`
- `mastery_packet_ref`
- `learner_copy_review_ref`
- `copy_review_status`
- `protected_copy_spans`
- `unreviewed_copy_blocks`
- `active_objective_ids`
- `active_task_ref`
- `task_version`
- `task_quality_receipt`
- `prompt_defect_disposition`
- `course_graph`
- `content_blocks`
- `evidence_tasks`
- `support_policy`
- `mastery_dimensions`
- `learner_event_fields`
- `evidence_record_fields`
- `state_requirements`
- `handoff_export_fields`
- `presentation_constraints`
- `continuity_requirements`
- `delivery_mode`
- `downgrade_reason`

## Page Requirements

- expose the current objective, why it matters, and what counts as evidence
- consume reviewed learner copy and preserve its protected meaning
- keep explanation, learner action, feedback, and evidence state distinct
- support contextual learner questions without exposing backstage production
  details
- preserve local-only scope, reset, and stale-state recovery when state is
  stored in the browser
- export attempts, questions, evidence status, blockers, and next action
- preserve stable learner-event and dimension-evidence refs on round trip
- keep the page as the primary learner-action surface after the first attempt;
  feedback, repaired tasks, retries, and next actions must return to the page
- require an explicit continuity route when Agent evaluation happens outside
  the browser; chat may notify or provide a fallback but must not become the
  hidden primary course UI
- preserve `page_id`, `page_manifest_ref`, and `projection_target_ref` after
  implementation so later submission receipts can target the same page
- treat a course id, attempt packet, or page-submission receipt as a
  continuation trigger: evaluate in Mastery, then update the page or emit its
  versioned import projection before notifying in chat

## Delivery Receipt

For `built_page`, return:

- `page_brief_ref`
- `implementation_entrypoint`
- `running_page_location`
- `browser_evidence_refs`
- `verified_viewports`
- `adaptive_round_trip_evidence`
- `page_id`
- `page_manifest_ref`
- `projection_target_ref`
- `unresolved_delivery_blockers`

## Boundary

This artifact does not prescribe CSS, pane geometry, frontend stack, or browser
storage APIs. HITL owns the page projection.

HITL must not reinterpret page completion, interaction count, or self-reported
confidence as mastery. Generic page states such as `passed` or `failed` do not
map to mastery status. HITL presents the mastery packet's evidence and
unresolved states without mutating upstream meaning. UI compression may shorten
copy, but it must not change source boundaries, diagnostic intent, task demand,
rubric criteria, support meaning, or evidence status literals.

## Standalone Fallback

If a required page peer is unavailable, deliver the same course graph, tasks,
evidence state, and handoff packet as structured text, mark the `built_page`
route blocked, and name the missing peer. Do not silently report the
interactive-course request as complete.
